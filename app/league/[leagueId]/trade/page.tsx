'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SleeperPlayer, SleeperRoster, LeagueUser, TradedPick } from '@/lib/types'
import {
  getSleeperPlayerValue,
  calculateTradeFairness,
  getDraftPickValue,
  getPickPosition,
  OwnedDraftPick,
} from '@/lib/fantasypros'
import { getCurrentSeason } from '@/lib/sleeper'

interface PlayerWithInfo extends SleeperPlayer {
  value: number
  ownerName: string
  rosterId: number
}

interface TeamOption {
  rosterId: number
  name: string
  players: PlayerWithInfo[]
  ownedPicks: OwnedDraftPick[]
}

type TabType = 'players' | 'picks'

export default function TradePage() {
  const params = useParams()
  const leagueId = params.leagueId as string

  const [teams, setTeams] = useState<TeamOption[]>([])
  const [loading, setLoading] = useState(true)

  const [team1Id, setTeam1Id] = useState<number | null>(null)
  const [team2Id, setTeam2Id] = useState<number | null>(null)
  const [team1Players, setTeam1Players] = useState<PlayerWithInfo[]>([])
  const [team2Players, setTeam2Players] = useState<PlayerWithInfo[]>([])
  const [team1Picks, setTeam1Picks] = useState<OwnedDraftPick[]>([])
  const [team2Picks, setTeam2Picks] = useState<OwnedDraftPick[]>([])

  const [team1Tab, setTeam1Tab] = useState<TabType>('players')
  const [team2Tab, setTeam2Tab] = useState<TabType>('players')

  useEffect(() => {
    async function fetchData() {
      try {
        const [rostersRes, usersRes, playersRes, tradedPicksRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
          fetch('https://api.sleeper.app/v1/players/nfl'),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/traded_picks`),
        ])

        const rosters: SleeperRoster[] = await rostersRes.json()
        const users: LeagueUser[] = await usersRes.json()
        const allPlayers: Record<string, SleeperPlayer> = await playersRes.json()
        const tradedPicks: TradedPick[] = await tradedPicksRes.json()

        const userMap = new Map(users.map((u) => [u.user_id, u]))
        const totalTeams = rosters.length

        // Sort rosters by standings (wins, then points) to determine pick positions
        // This represents "last year's" standings for pick valuation
        const sortedRosters = [...rosters].sort((a, b) => {
          if (b.settings.wins !== a.settings.wins) {
            return b.settings.wins - a.settings.wins
          }
          return (
            b.settings.fpts + b.settings.fpts_decimal / 100 -
            (a.settings.fpts + a.settings.fpts_decimal / 100)
          )
        })

        // Create a map of roster_id to standings rank (1 = best, totalTeams = worst)
        const standingsMap = new Map<number, number>()
        sortedRosters.forEach((roster, index) => {
          standingsMap.set(roster.roster_id, index + 1)
        })

        // Create roster name map
        const rosterNameMap = new Map<number, string>()
        rosters.forEach((roster) => {
          const owner = userMap.get(roster.owner_id)
          rosterNameMap.set(
            roster.roster_id,
            owner?.metadata?.team_name || owner?.display_name || `Team ${roster.roster_id}`
          )
        })

        // Build draft pick ownership for each team
        // Start with each team owning their own picks for future years
        const currentSeason = parseInt(getCurrentSeason())
        const futureYears = [currentSeason + 1, currentSeason + 2, currentSeason + 3]
        const rounds = [1, 2, 3, 4]

        // Initialize pick ownership: each team owns their own picks
        const pickOwnership = new Map<string, number>() // pickId -> currentOwnerId

        rosters.forEach((roster) => {
          futureYears.forEach((year) => {
            rounds.forEach((round) => {
              const pickId = `${year}-${round}-${roster.roster_id}`
              pickOwnership.set(pickId, roster.roster_id)
            })
          })
        })

        // Apply traded picks to update ownership
        tradedPicks.forEach((trade) => {
          const year = parseInt(trade.season)
          if (futureYears.includes(year)) {
            const pickId = `${trade.season}-${trade.round}-${trade.roster_id}`
            pickOwnership.set(pickId, trade.owner_id)
          }
        })

        // Build team options with players and picks
        const teamOptions: TeamOption[] = rosters.map((roster) => {
          const owner = userMap.get(roster.owner_id)
          const name = rosterNameMap.get(roster.roster_id) || 'Unknown'

          const players: PlayerWithInfo[] = (roster.players || [])
            .map((playerId) => {
              const player = allPlayers[playerId]
              if (!player || !player.position) return null

              return {
                ...player,
                value: getSleeperPlayerValue(
                  player.first_name,
                  player.last_name,
                  player.position,
                  player.team
                ),
                ownerName: name,
                rosterId: roster.roster_id,
              }
            })
            .filter((p): p is PlayerWithInfo => p !== null)
            .sort((a, b) => b.value - a.value)

          // Find all picks this team currently owns
          const ownedPicks: OwnedDraftPick[] = []

          pickOwnership.forEach((ownerId, pickId) => {
            if (ownerId === roster.roster_id) {
              const [yearStr, roundStr, originalOwnerStr] = pickId.split('-')
              const year = parseInt(yearStr)
              const round = parseInt(roundStr)
              const originalOwnerId = parseInt(originalOwnerStr)

              // Get the original owner's standings rank to determine pick position
              const standingsRank = standingsMap.get(originalOwnerId) || Math.ceil(totalTeams / 2)
              const position = getPickPosition(standingsRank, totalTeams, year)
              const value = getDraftPickValue(year, round, position)

              const originalOwnerName = rosterNameMap.get(originalOwnerId) || `Team ${originalOwnerId}`
              const isOwnPick = originalOwnerId === roster.roster_id

              // Display labels: early=High (top of draft, more valuable), late=Low (bottom of draft, less valuable)
              const posLabelMap: Record<string, string> = { early: 'High', mid: 'Mid', late: 'Low' }
              const posLabel = posLabelMap[position] || 'Mid'
              const ordinal = getOrdinal(round)

              ownedPicks.push({
                id: pickId,
                season: yearStr,
                round,
                originalOwnerId,
                currentOwnerId: roster.roster_id,
                originalOwnerName,
                position,
                value,
                label: isOwnPick
                  ? `${year} ${posLabel} ${ordinal}`
                  : `${year} ${posLabel} ${ordinal} (${originalOwnerName})`,
              })
            }
          })

          // Sort picks by year, then round, then value
          ownedPicks.sort((a, b) => {
            if (a.season !== b.season) return parseInt(a.season) - parseInt(b.season)
            if (a.round !== b.round) return a.round - b.round
            return b.value - a.value
          })

          return {
            rosterId: roster.roster_id,
            name,
            players,
            ownedPicks,
          }
        })

        setTeams(teamOptions.sort((a, b) => a.name.localeCompare(b.name)))
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [leagueId])

  // Helper function for ordinals
  function getOrdinal(n: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
  }

  const team1 = teams.find((t) => t.rosterId === team1Id)
  const team2 = teams.find((t) => t.rosterId === team2Id)

  const team1PlayerTotal = team1Players.reduce((sum, p) => sum + p.value, 0)
  const team1PickTotal = team1Picks.reduce((sum, p) => sum + p.value, 0)
  const team1Total = team1PlayerTotal + team1PickTotal

  const team2PlayerTotal = team2Players.reduce((sum, p) => sum + p.value, 0)
  const team2PickTotal = team2Picks.reduce((sum, p) => sum + p.value, 0)
  const team2Total = team2PlayerTotal + team2PickTotal

  const difference = team1Total - team2Total

  const hasAssets =
    team1Players.length > 0 ||
    team2Players.length > 0 ||
    team1Picks.length > 0 ||
    team2Picks.length > 0

  const fairness = hasAssets
    ? calculateTradeFairness(team1Total, team2Total)
    : null

  const togglePlayer = (player: PlayerWithInfo, side: 'team1' | 'team2') => {
    if (side === 'team1') {
      const exists = team1Players.find((p) => p.player_id === player.player_id)
      if (exists) {
        setTeam1Players(team1Players.filter((p) => p.player_id !== player.player_id))
      } else {
        setTeam1Players([...team1Players, player])
      }
    } else {
      const exists = team2Players.find((p) => p.player_id === player.player_id)
      if (exists) {
        setTeam2Players(team2Players.filter((p) => p.player_id !== player.player_id))
      } else {
        setTeam2Players([...team2Players, player])
      }
    }
  }

  const togglePick = (pick: OwnedDraftPick, side: 'team1' | 'team2') => {
    if (side === 'team1') {
      const exists = team1Picks.find((p) => p.id === pick.id)
      if (exists) {
        setTeam1Picks(team1Picks.filter((p) => p.id !== pick.id))
      } else {
        setTeam1Picks([...team1Picks, pick])
      }
    } else {
      const exists = team2Picks.find((p) => p.id === pick.id)
      if (exists) {
        setTeam2Picks(team2Picks.filter((p) => p.id !== pick.id))
      } else {
        setTeam2Picks([...team2Picks, pick])
      }
    }
  }

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB':
        return 'bg-red-600'
      case 'RB':
        return 'bg-green-600'
      case 'WR':
        return 'bg-blue-600'
      case 'TE':
        return 'bg-orange-600'
      case 'K':
        return 'bg-purple-600'
      case 'DEF':
        return 'bg-yellow-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getRoundColor = (round: number) => {
    switch (round) {
      case 1:
        return 'bg-yellow-600'
      case 2:
        return 'bg-gray-500'
      case 3:
        return 'bg-amber-700'
      default:
        return 'bg-gray-600'
    }
  }

  const getPickPositionBadge = (position: 'early' | 'mid' | 'late') => {
    switch (position) {
      case 'early':
        return 'text-green-400'
      case 'mid':
        return 'text-yellow-400'
      case 'late':
        return 'text-red-400'
    }
  }

  const clearTrade = () => {
    setTeam1Players([])
    setTeam2Players([])
    setTeam1Picks([])
    setTeam2Picks([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading teams and draft picks...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Trade Analyzer</h1>
        <p className="text-gray-400">
          Compare player and draft pick values for dynasty trades
        </p>
      </div>

      {/* Trade Summary */}
      {hasAssets && (
        <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">Trade Summary</h2>
            <button
              onClick={clearTrade}
              className="text-sm text-gray-400 hover:text-white"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Team 1 Receives */}
            <div>
              <p className="text-gray-400 text-sm mb-2">
                {team1 ? (
                  <Link
                    href={`/league/${leagueId}/team/${team1.rosterId}`}
                    className="hover:text-sleeper-highlight transition-colors"
                  >
                    {team1.name}
                  </Link>
                ) : (
                  'Team 1'
                )}{' '}
                receives:
              </p>
              <div className="space-y-2">
                {team2Players.map((p) => (
                  <div
                    key={p.player_id}
                    className="flex justify-between items-center bg-sleeper-accent px-3 py-2 rounded"
                  >
                    <Link
                      href={`/league/${leagueId}/player-analysis?playerId=${p.player_id}`}
                      className="text-sm hover:text-sleeper-highlight transition-colors"
                    >
                      {p.full_name}
                    </Link>
                    <span className="text-green-400 text-sm">
                      {p.value.toLocaleString()}
                    </span>
                  </div>
                ))}
                {team2Picks.map((pick) => (
                  <div
                    key={pick.id}
                    className="flex justify-between items-center bg-sleeper-accent px-3 py-2 rounded"
                  >
                    <span className="text-sm flex items-center gap-2">
                      <span className="text-yellow-400">PICK</span>
                      {pick.label}
                    </span>
                    <span className="text-green-400 text-sm">
                      {pick.value.toLocaleString()}
                    </span>
                  </div>
                ))}
                {team2Players.length === 0 && team2Picks.length === 0 && (
                  <p className="text-gray-500 text-sm">Nothing selected</p>
                )}
              </div>
              <p className="mt-2 text-right font-semibold text-green-400">
                Total: {team2Total.toLocaleString()}
              </p>
            </div>

            {/* Comparison */}
            <div className="flex flex-col items-center justify-center">
              <div
                className={`text-4xl font-bold ${
                  difference > 0
                    ? 'text-red-400'
                    : difference < 0
                    ? 'text-green-400'
                    : 'text-gray-400'
                }`}
              >
                {difference > 0 ? '+' : ''}
                {difference.toLocaleString()}
              </div>
              <p className="text-gray-500 text-sm">value difference</p>

              {fairness && (
                <div
                  className={`mt-4 px-4 py-2 rounded-full text-sm font-semibold ${
                    fairness === 'fair'
                      ? 'bg-green-900 text-green-200'
                      : fairness === 'slight_advantage'
                      ? 'bg-yellow-900 text-yellow-200'
                      : 'bg-red-900 text-red-200'
                  }`}
                >
                  {fairness === 'fair'
                    ? 'Fair Trade'
                    : fairness === 'slight_advantage'
                    ? 'Slight Advantage'
                    : 'Unfair Trade'}
                </div>
              )}
            </div>

            {/* Team 2 Receives */}
            <div>
              <p className="text-gray-400 text-sm mb-2">
                {team2 ? (
                  <Link
                    href={`/league/${leagueId}/team/${team2.rosterId}`}
                    className="hover:text-sleeper-highlight transition-colors"
                  >
                    {team2.name}
                  </Link>
                ) : (
                  'Team 2'
                )}{' '}
                receives:
              </p>
              <div className="space-y-2">
                {team1Players.map((p) => (
                  <div
                    key={p.player_id}
                    className="flex justify-between items-center bg-sleeper-accent px-3 py-2 rounded"
                  >
                    <Link
                      href={`/league/${leagueId}/player-analysis?playerId=${p.player_id}`}
                      className="text-sm hover:text-sleeper-highlight transition-colors"
                    >
                      {p.full_name}
                    </Link>
                    <span className="text-green-400 text-sm">
                      {p.value.toLocaleString()}
                    </span>
                  </div>
                ))}
                {team1Picks.map((pick) => (
                  <div
                    key={pick.id}
                    className="flex justify-between items-center bg-sleeper-accent px-3 py-2 rounded"
                  >
                    <span className="text-sm flex items-center gap-2">
                      <span className="text-yellow-400">PICK</span>
                      {pick.label}
                    </span>
                    <span className="text-green-400 text-sm">
                      {pick.value.toLocaleString()}
                    </span>
                  </div>
                ))}
                {team1Players.length === 0 && team1Picks.length === 0 && (
                  <p className="text-gray-500 text-sm">Nothing selected</p>
                )}
              </div>
              <p className="mt-2 text-right font-semibold text-green-400">
                Total: {team1Total.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team 1 */}
        <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
          <div className="p-4 border-b border-sleeper-accent">
            <select
              value={team1Id || ''}
              onChange={(e) => {
                setTeam1Id(e.target.value ? parseInt(e.target.value) : null)
                setTeam1Players([])
                setTeam1Picks([])
              }}
              className="w-full bg-sleeper-accent text-white px-3 py-2 rounded border border-sleeper-accent focus:outline-none focus:border-sleeper-highlight"
            >
              <option value="">Select Team 1</option>
              {teams
                .filter((t) => t.rosterId !== team2Id)
                .map((team) => (
                  <option key={team.rosterId} value={team.rosterId}>
                    {team.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-sleeper-accent">
            <button
              onClick={() => setTeam1Tab('players')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                team1Tab === 'players'
                  ? 'bg-sleeper-accent text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Players
              {team1Players.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-sleeper-highlight rounded-full text-xs">
                  {team1Players.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTeam1Tab('picks')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                team1Tab === 'picks'
                  ? 'bg-sleeper-accent text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Draft Picks
              {team1Picks.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-sleeper-highlight rounded-full text-xs">
                  {team1Picks.length}
                </span>
              )}
            </button>
          </div>

          {/* Players Tab */}
          {team1Tab === 'players' && team1 && (
            <div className="max-h-96 overflow-y-auto divide-y divide-sleeper-accent">
              {team1.players.map((player) => {
                const isSelected = team1Players.some(
                  (p) => p.player_id === player.player_id
                )
                return (
                  <button
                    key={player.player_id}
                    onClick={() => togglePlayer(player, 'team1')}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-sleeper-highlight/20'
                        : 'hover:bg-sleeper-accent/50'
                    }`}
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${getPositionColor(
                        player.position
                      )}`}
                    >
                      {player.position}
                    </span>
                    <Link
                      href={`/league/${leagueId}/player-analysis?playerId=${player.player_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 hover:text-sleeper-highlight transition-colors"
                    >
                      {player.full_name}
                    </Link>
                    <span className="text-gray-400 text-sm">
                      {player.value.toLocaleString()}
                    </span>
                    {isSelected && (
                      <span className="text-sleeper-highlight">&#10003;</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Picks Tab */}
          {team1Tab === 'picks' && team1 && (
            <div className="max-h-96 overflow-y-auto">
              {team1.ownedPicks.length === 0 ? (
                <p className="p-4 text-gray-500 text-center">
                  No draft picks owned
                </p>
              ) : (
                <div className="divide-y divide-sleeper-accent">
                  {team1.ownedPicks.map((pick) => {
                    const isSelected = team1Picks.some((p) => p.id === pick.id)
                    return (
                      <button
                        key={pick.id}
                        onClick={() => togglePick(pick, 'team1')}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-sleeper-highlight/20'
                            : 'hover:bg-sleeper-accent/50'
                        }`}
                      >
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${getRoundColor(
                            pick.round
                          )}`}
                        >
                          R{pick.round}
                        </span>
                        <span className="flex-1">
                          {pick.label}
                          <span className={`ml-2 text-xs ${getPickPositionBadge(pick.position)}`}>
                            ({pick.position})
                          </span>
                        </span>
                        <span className="text-gray-400 text-sm">
                          {pick.value.toLocaleString()}
                        </span>
                        {isSelected && (
                          <span className="text-sleeper-highlight">&#10003;</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {team1Tab === 'players' && !team1 && (
            <p className="p-4 text-gray-500 text-center">
              Select a team to view players
            </p>
          )}
          {team1Tab === 'picks' && !team1 && (
            <p className="p-4 text-gray-500 text-center">
              Select a team to view draft picks
            </p>
          )}
        </div>

        {/* Team 2 */}
        <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
          <div className="p-4 border-b border-sleeper-accent">
            <select
              value={team2Id || ''}
              onChange={(e) => {
                setTeam2Id(e.target.value ? parseInt(e.target.value) : null)
                setTeam2Players([])
                setTeam2Picks([])
              }}
              className="w-full bg-sleeper-accent text-white px-3 py-2 rounded border border-sleeper-accent focus:outline-none focus:border-sleeper-highlight"
            >
              <option value="">Select Team 2</option>
              {teams
                .filter((t) => t.rosterId !== team1Id)
                .map((team) => (
                  <option key={team.rosterId} value={team.rosterId}>
                    {team.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-sleeper-accent">
            <button
              onClick={() => setTeam2Tab('players')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                team2Tab === 'players'
                  ? 'bg-sleeper-accent text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Players
              {team2Players.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-sleeper-highlight rounded-full text-xs">
                  {team2Players.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTeam2Tab('picks')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                team2Tab === 'picks'
                  ? 'bg-sleeper-accent text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Draft Picks
              {team2Picks.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-sleeper-highlight rounded-full text-xs">
                  {team2Picks.length}
                </span>
              )}
            </button>
          </div>

          {/* Players Tab */}
          {team2Tab === 'players' && team2 && (
            <div className="max-h-96 overflow-y-auto divide-y divide-sleeper-accent">
              {team2.players.map((player) => {
                const isSelected = team2Players.some(
                  (p) => p.player_id === player.player_id
                )
                return (
                  <button
                    key={player.player_id}
                    onClick={() => togglePlayer(player, 'team2')}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                      isSelected
                        ? 'bg-sleeper-highlight/20'
                        : 'hover:bg-sleeper-accent/50'
                    }`}
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${getPositionColor(
                        player.position
                      )}`}
                    >
                      {player.position}
                    </span>
                    <Link
                      href={`/league/${leagueId}/player-analysis?playerId=${player.player_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 hover:text-sleeper-highlight transition-colors"
                    >
                      {player.full_name}
                    </Link>
                    <span className="text-gray-400 text-sm">
                      {player.value.toLocaleString()}
                    </span>
                    {isSelected && (
                      <span className="text-sleeper-highlight">&#10003;</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Picks Tab */}
          {team2Tab === 'picks' && team2 && (
            <div className="max-h-96 overflow-y-auto">
              {team2.ownedPicks.length === 0 ? (
                <p className="p-4 text-gray-500 text-center">
                  No draft picks owned
                </p>
              ) : (
                <div className="divide-y divide-sleeper-accent">
                  {team2.ownedPicks.map((pick) => {
                    const isSelected = team2Picks.some((p) => p.id === pick.id)
                    return (
                      <button
                        key={pick.id}
                        onClick={() => togglePick(pick, 'team2')}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                          isSelected
                            ? 'bg-sleeper-highlight/20'
                            : 'hover:bg-sleeper-accent/50'
                        }`}
                      >
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${getRoundColor(
                            pick.round
                          )}`}
                        >
                          R{pick.round}
                        </span>
                        <span className="flex-1">
                          {pick.label}
                          <span className={`ml-2 text-xs ${getPickPositionBadge(pick.position)}`}>
                            ({pick.position})
                          </span>
                        </span>
                        <span className="text-gray-400 text-sm">
                          {pick.value.toLocaleString()}
                        </span>
                        {isSelected && (
                          <span className="text-sleeper-highlight">&#10003;</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {team2Tab === 'players' && !team2 && (
            <p className="p-4 text-gray-500 text-center">
              Select a team to view players
            </p>
          )}
          {team2Tab === 'picks' && !team2 && (
            <p className="p-4 text-gray-500 text-center">
              Select a team to view draft picks
            </p>
          )}
        </div>
      </div>

      <div className="text-gray-500 text-sm text-center space-y-1">
        <p>Player values based on FantasyPros ECR. Draft pick values based on current standings.</p>
        <p className="text-xs">
          <span className="text-green-400">Early</span> = bottom third |
          <span className="text-yellow-400 ml-1">Mid</span> = middle third |
          <span className="text-red-400 ml-1">Late</span> = top third
        </p>
      </div>
    </div>
  )
}

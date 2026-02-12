'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import PageHeader from '@/components/PageHeader'
import { SleeperPlayer, SleeperRoster, LeagueUser, TradedPick } from '@/lib/types'
import {
  getSleeperPlayerValue,
  getDraftPickValue,
  getPickPosition,
  OwnedDraftPick,
} from '@/lib/fantasypros'
import { getCurrentSeason } from '@/lib/sleeper'

interface TeamValue {
  rosterId: number
  name: string
  playerValue: number
  pickValue: number
  totalValue: number
  playerCount: number
  pickCount: number
  topPlayers: { playerId: string; name: string; value: number; position: string }[]
  picks: OwnedDraftPick[]
}

export default function ValueAnalyzerPage() {
  const params = useParams()
  const leagueId = params.leagueId as string

  const [teams, setTeams] = useState<TeamValue[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [rostersRes, usersRes, playersRes, tradedPicksRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
          fetch('/api/players'),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/traded_picks`),
        ])

        const rosters: SleeperRoster[] = await rostersRes.json()
        const users: LeagueUser[] = await usersRes.json()
        const allPlayers: Record<string, SleeperPlayer> = await playersRes.json()
        const tradedPicks: TradedPick[] = await tradedPicksRes.json()

        const userMap = new Map(users.map((u) => [u.user_id, u]))
        const totalTeams = rosters.length

        // Sort rosters by standings to determine pick positions
        const sortedRosters = [...rosters].sort((a, b) => {
          if (b.settings.wins !== a.settings.wins) {
            return b.settings.wins - a.settings.wins
          }
          return (
            b.settings.fpts + b.settings.fpts_decimal / 100 -
            (a.settings.fpts + a.settings.fpts_decimal / 100)
          )
        })

        // Create standings map
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

        // Build draft pick ownership
        const currentSeason = parseInt(getCurrentSeason())
        const futureYears = [currentSeason + 1, currentSeason + 2, currentSeason + 3]
        const rounds = [1, 2, 3, 4]

        const pickOwnership = new Map<string, number>()

        rosters.forEach((roster) => {
          futureYears.forEach((year) => {
            rounds.forEach((round) => {
              const pickId = `${year}-${round}-${roster.roster_id}`
              pickOwnership.set(pickId, roster.roster_id)
            })
          })
        })

        // Apply traded picks
        tradedPicks.forEach((trade) => {
          const year = parseInt(trade.season)
          if (futureYears.includes(year)) {
            const pickId = `${trade.season}-${trade.round}-${trade.roster_id}`
            pickOwnership.set(pickId, trade.owner_id)
          }
        })

        // Calculate team values
        const teamValues: TeamValue[] = rosters.map((roster) => {
          const owner = userMap.get(roster.owner_id)
          const name = rosterNameMap.get(roster.roster_id) || 'Unknown'

          // Calculate player values
          const playersWithValue = (roster.players || [])
            .map((playerId) => {
              const player = allPlayers[playerId]

              if (!player) {
                // Player not in database - still show them
                return {
                  playerId,
                  name: `Unknown (${playerId})`,
                  value: 0,
                  position: 'Unknown',
                }
              }

              const position = player.position || 'Unknown'
              const value = player.position
                ? getSleeperPlayerValue(
                    player.first_name,
                    player.last_name,
                    player.position,
                    player.team
                  )
                : 0

              return {
                playerId,
                name: player.full_name || `Player ${playerId}`,
                value,
                position,
              }
            })
            .sort((a, b) => b.value - a.value)

          const playerValue = playersWithValue.reduce((sum, p) => sum + p.value, 0)

          // Calculate pick values
          const ownedPicks: OwnedDraftPick[] = []

          pickOwnership.forEach((ownerId, pickId) => {
            if (ownerId === roster.roster_id) {
              const [yearStr, roundStr, originalOwnerStr] = pickId.split('-')
              const year = parseInt(yearStr)
              const round = parseInt(roundStr)
              const originalOwnerId = parseInt(originalOwnerStr)

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

          ownedPicks.sort((a, b) => {
            if (a.season !== b.season) return parseInt(a.season) - parseInt(b.season)
            if (a.round !== b.round) return a.round - b.round
            return b.value - a.value
          })

          const pickValue = ownedPicks.reduce((sum, p) => sum + p.value, 0)

          return {
            rosterId: roster.roster_id,
            name,
            playerValue,
            pickValue,
            totalValue: playerValue + pickValue,
            playerCount: playersWithValue.length,
            pickCount: ownedPicks.length,
            topPlayers: playersWithValue,
            picks: ownedPicks,
          }
        })

        // Sort by total value
        setTeams(teamValues.sort((a, b) => b.totalValue - a.totalValue))
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [leagueId])

  function getOrdinal(n: number): string {
    const suffixes = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  const maxValue = teams[0]?.totalValue || 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="League Value"
        subtitle="Total dynasty value for each team (players + draft picks)"
        icon="value"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent">
          <p className="text-gray-400 text-sm">Highest Value</p>
          <p className="text-2xl font-bold text-green-400">
            {teams[0]?.totalValue.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">{teams[0]?.name}</p>
        </div>
        <div className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent">
          <p className="text-gray-400 text-sm">Lowest Value</p>
          <p className="text-2xl font-bold text-red-400">
            {teams[teams.length - 1]?.totalValue.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">{teams[teams.length - 1]?.name}</p>
        </div>
        <div className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent">
          <p className="text-gray-400 text-sm">League Average</p>
          <p className="text-2xl font-bold">
            {Math.round(
              teams.reduce((sum, t) => sum + t.totalValue, 0) / teams.length
            ).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">per team</p>
        </div>
        <div className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent">
          <p className="text-gray-400 text-sm">Value Gap</p>
          <p className="text-2xl font-bold text-yellow-400">
            {(teams[0]?.totalValue - teams[teams.length - 1]?.totalValue).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">1st to last</p>
        </div>
      </div>

      {/* Team Value Rankings */}
      <div className="space-y-3">
        {teams.map((team, index) => {
          const isExpanded = expandedTeam === team.rosterId
          const valuePercentage = (team.totalValue / maxValue) * 100

          return (
            <div
              key={team.rosterId}
              className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden"
            >
              <button
                onClick={() => setExpandedTeam(isExpanded ? null : team.rosterId)}
                className="w-full p-4 text-left hover:bg-sleeper-accent/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-sleeper-accent flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href={`/league/${leagueId}/team/${team.rosterId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold truncate hover:text-sleeper-highlight transition-colors"
                      >
                        {team.name}
                      </Link>
                      <span className="text-xl font-bold text-green-400 ml-4">
                        {team.totalValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>
                        Players: <span className="text-white">{team.playerValue.toLocaleString()}</span>
                      </span>
                      <span>
                        Picks: <span className="text-white">{team.pickValue.toLocaleString()}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 bg-sleeper-accent rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all"
                        style={{ width: `${valuePercentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-gray-500 ml-2">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-sleeper-accent p-4 bg-sleeper-accent/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Players */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <span className="text-green-400">Players</span>
                        <span className="text-gray-500 text-sm font-normal">
                          ({team.playerCount} total)
                        </span>
                      </h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {team.topPlayers.map((player, pIndex) => (
                          <div
                            key={pIndex}
                            className="flex items-center justify-between bg-sleeper-primary px-3 py-2 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${getPositionColor(
                                  player.position
                                )}`}
                              >
                                {player.position}
                              </span>
                              <Link
                                href={`/league/${leagueId}/player-analysis?playerId=${player.playerId}`}
                                className="text-sm hover:text-sleeper-highlight transition-colors"
                              >
                                {player.name}
                              </Link>
                            </div>
                            <span className="text-green-400 text-sm">
                              {player.value.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Draft Picks */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <span className="text-yellow-400">Draft Picks</span>
                        <span className="text-gray-500 text-sm font-normal">
                          ({team.pickCount} total)
                        </span>
                      </h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {team.picks.length === 0 ? (
                          <p className="text-gray-500 text-sm">No draft picks owned</p>
                        ) : (
                          team.picks.map((pick) => (
                            <div
                              key={pick.id}
                              className="flex items-center justify-between bg-sleeper-primary px-3 py-2 rounded"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-bold ${getRoundColor(
                                    pick.round
                                  )}`}
                                >
                                  R{pick.round}
                                </span>
                                <span className="text-sm">{pick.label}</span>
                              </div>
                              <span className="text-green-400 text-sm">
                                {pick.value.toLocaleString()}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Value Breakdown Bar */}
                  <div className="mt-4 pt-4 border-t border-sleeper-accent">
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <span className="text-gray-400">Value Breakdown:</span>
                      <span className="text-green-400">
                        {Math.round((team.playerValue / team.totalValue) * 100)}% Players
                      </span>
                      <span className="text-gray-500">|</span>
                      <span className="text-yellow-400">
                        {Math.round((team.pickValue / team.totalValue) * 100)}% Picks
                      </span>
                    </div>
                    <div className="h-3 bg-sleeper-accent rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${(team.playerValue / team.totalValue) * 100}%` }}
                      />
                      <div
                        className="h-full bg-yellow-500"
                        style={{ width: `${(team.pickValue / team.totalValue) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="text-gray-500 text-sm text-center">
        <p>Values based on Half-PPR 1QB dynasty rankings. Click a team to see breakdown.</p>
      </div>
    </div>
  )
}

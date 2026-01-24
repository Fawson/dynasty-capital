'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { SleeperPlayer, SleeperRoster, LeagueUser } from '@/lib/types'
import { getSleeperPlayerValue, getAllPlayerValues } from '@/lib/fantasypros'

interface AllPlayersTabProps {
  leagueId: string
  allPlayers: Record<string, SleeperPlayer>
  rosters: SleeperRoster[]
  users: LeagueUser[]
  onSelectPlayer?: (playerId: string) => void
}

interface PlayerWithRoster extends SleeperPlayer {
  value: number
  ownerName: string
  rosterId: number
}

export default function AllPlayersTab({
  leagueId,
  allPlayers,
  rosters,
  users,
  onSelectPlayer,
}: AllPlayersTabProps) {
  const [filter, setFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'value' | 'name'>('value')
  const [searchQuery, setSearchQuery] = useState('')
  const [freeAgentsOnly, setFreeAgentsOnly] = useState(false)

  const players = useMemo(() => {
    const userMap = new Map(users.map((u) => [u.user_id, u]))
    const allPlayersList: PlayerWithRoster[] = []
    const rosteredPlayerIds = new Set<string>()

    // First, add all rostered players
    rosters.forEach((roster) => {
      const owner = userMap.get(roster.owner_id)
      const ownerName = owner?.metadata?.team_name || owner?.display_name || 'Unknown'

      roster.players?.forEach((playerId) => {
        const player = allPlayers[playerId]
        if (player && player.position) {
          rosteredPlayerIds.add(playerId)
          const value = getSleeperPlayerValue(
            player.first_name,
            player.last_name,
            player.position,
            player.team
          )

          allPlayersList.push({
            ...player,
            value,
            ownerName,
            rosterId: roster.roster_id,
          })
        }
      })
    })

    // Then add free agents from our value database
    const valuedPlayers = getAllPlayerValues()
    valuedPlayers.forEach((valuedPlayer) => {
      // Find the Sleeper player by name AND position to avoid name collisions (e.g., multiple "Josh Allen"s)
      const sleeperPlayer = Object.values(allPlayers).find(
        (p) => (p.full_name?.toLowerCase() === valuedPlayer.name.toLowerCase() ||
               `${p.first_name} ${p.last_name}`.toLowerCase() === valuedPlayer.name.toLowerCase()) &&
               p.position === valuedPlayer.position
      )

      if (sleeperPlayer && !rosteredPlayerIds.has(sleeperPlayer.player_id)) {
        allPlayersList.push({
          ...sleeperPlayer,
          value: valuedPlayer.value,
          ownerName: 'Free Agent',
          rosterId: 0,
        })
      }
    })

    return allPlayersList
  }, [allPlayers, rosters, users])

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF']

  // Calculate position ranks
  const positionRanks = useMemo(() => {
    const ranks = new Map<string, number>()
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

    positions.forEach(pos => {
      const posPlayers = [...players]
        .filter(p => p.position === pos)
        .sort((a, b) => b.value - a.value)

      posPlayers.forEach((player, index) => {
        ranks.set(player.player_id, index + 1)
      })
    })

    return ranks
  }, [players])

  const filteredPlayers = players
    .filter((p) => filter === 'ALL' || p.position === filter)
    .filter((p) => !freeAgentsOnly || p.ownerName === 'Free Agent')
    .filter((p) => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      return (
        p.full_name?.toLowerCase().includes(query) ||
        p.first_name?.toLowerCase().includes(query) ||
        p.last_name?.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'value') return b.value - a.value
      return a.full_name.localeCompare(b.full_name)
    })

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB': return 'bg-red-600'
      case 'RB': return 'bg-green-600'
      case 'WR': return 'bg-blue-600'
      case 'TE': return 'bg-orange-600'
      case 'K': return 'bg-purple-600'
      case 'DEF': return 'bg-yellow-600'
      default: return 'bg-gray-600'
    }
  }

  const getValueColor = (value: number) => {
    if (value >= 9000) return 'text-yellow-400'
    if (value >= 8000) return 'text-green-400'
    if (value >= 7000) return 'text-blue-400'
    if (value >= 5000) return 'text-gray-300'
    return 'text-gray-500'
  }

  const rosteredCount = players.filter(p => p.ownerName !== 'Free Agent').length
  const freeAgentCount = players.filter(p => p.ownerName === 'Free Agent').length

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-400">
          {filteredPlayers.length} players ({rosteredCount} rostered, {freeAgentCount} free agents)
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search players..."
          className="w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {positions.map((pos) => (
            <button
              key={pos}
              onClick={() => setFilter(pos)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                filter === pos
                  ? 'bg-sleeper-highlight text-white'
                  : 'bg-sleeper-accent text-gray-400 hover:text-white'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSortBy('value')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              sortBy === 'value'
                ? 'bg-sleeper-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sort by Value
          </button>
          <button
            onClick={() => setSortBy('name')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              sortBy === 'name'
                ? 'bg-sleeper-accent text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sort by Name
          </button>
          <button
            onClick={() => setFreeAgentsOnly(!freeAgentsOnly)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              freeAgentsOnly
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Free Agents Only
          </button>
        </div>
      </div>

      {/* Players Table */}
      <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-sleeper-accent">
            <tr>
              <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold text-gray-300">Rank</th>
              <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold text-gray-300">Pos. Rank</th>
              <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold text-gray-300">Player</th>
              <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold text-gray-300">Pos</th>
              <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold text-gray-300 hidden sm:table-cell">Team</th>
              <th className="px-3 sm:px-4 py-3 text-left text-sm font-semibold text-gray-300">Owner</th>
              <th className="px-3 sm:px-4 py-3 text-right text-sm font-semibold text-gray-300">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sleeper-accent">
            {filteredPlayers.slice(0, 100).map((player, index) => (
              <tr
                key={player.player_id}
                className="hover:bg-sleeper-accent/50 transition-colors cursor-pointer"
                onClick={() => onSelectPlayer?.(player.player_id)}
              >
                <td className="px-3 sm:px-4 py-3 text-gray-500">{index + 1}</td>
                <td className="px-3 sm:px-4 py-3 text-gray-400">{player.position}{positionRanks.get(player.player_id)}</td>
                <td className="px-3 sm:px-4 py-3">
                  <span className="font-medium hover:text-sleeper-highlight transition-colors">
                    {player.full_name}
                  </span>
                  {player.injury_status && (
                    <span className="text-xs text-red-400 ml-2">{player.injury_status}</span>
                  )}
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${getPositionColor(player.position)}`}>
                    {player.position}
                  </span>
                </td>
                <td className="px-3 sm:px-4 py-3 text-gray-400 hidden sm:table-cell">{player.team || 'FA'}</td>
                <td className="px-3 sm:px-4 py-3">
                  {player.ownerName === 'Free Agent' ? (
                    <span className="text-amber-500 text-sm sm:text-base">Free Agent</span>
                  ) : (
                    <Link
                      href={`/league/${leagueId}/team/${player.rosterId}`}
                      className="text-gray-400 hover:text-sleeper-highlight transition-colors text-sm sm:text-base"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {player.ownerName}
                    </Link>
                  )}
                </td>
                <td className={`px-3 sm:px-4 py-3 text-right font-semibold ${getValueColor(player.value)}`}>
                  {player.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredPlayers.length > 100 && (
        <p className="text-gray-500 text-center">
          Showing top 100 of {filteredPlayers.length} players
        </p>
      )}
    </div>
  )
}

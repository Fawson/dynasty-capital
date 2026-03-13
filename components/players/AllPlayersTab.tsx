'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { FixedSizeList as List } from 'react-window'
import { SleeperPlayer, SleeperRoster, LeagueUser } from '@/lib/types'
import { getSleeperPlayerValue, getAllPlayerValues } from '@/lib/fantasypros'
import { POSITION_BG_CLASSES, getValueColorClass, ALL_FILTER_POSITIONS } from '@/lib/constants'

interface AllPlayersTabProps {
  leagueId: string
  allPlayers: Record<string, SleeperPlayer>
  rosters: SleeperRoster[]
  users: LeagueUser[]
  userId?: string | null
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
  userId,
  onSelectPlayer,
}: AllPlayersTabProps) {
  // Find the user's roster_id for highlighting
  const userRosterId = useMemo(() => {
    if (!userId) return null
    const roster = rosters.find(r => r.owner_id === userId)
    return roster?.roster_id ?? null
  }, [userId, rosters])
  const [filter, setFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'value' | 'name'>('value')
  const [searchQuery, setSearchQuery] = useState('')
  const [freeAgentsOnly, setFreeAgentsOnly] = useState(false)
  const [rookiesOnly, setRookiesOnly] = useState(false)

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

  // Memoize filtered + sorted players
  const filteredPlayers = useMemo(() =>
    players
      .filter((p) => filter === 'ALL' || p.position === filter)
      .filter((p) => !freeAgentsOnly || p.ownerName === 'Free Agent')
      .filter((p) => !rookiesOnly || p.years_exp === 1)
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
      }),
    [players, filter, freeAgentsOnly, rookiesOnly, searchQuery, sortBy]
  )

  const getPositionBgClass = useCallback((pos: string) => {
    return POSITION_BG_CLASSES[pos] || 'bg-gray-600'
  }, [])

  const rosteredCount = players.filter(p => p.ownerName !== 'Free Agent').length
  const freeAgentCount = players.filter(p => p.ownerName === 'Free Agent').length

  // Virtual row renderer for react-window
  const ROW_HEIGHT = 52
  const VISIBLE_ROWS = Math.min(filteredPlayers.length, 200)
  const listHeight = Math.min(VISIBLE_ROWS * ROW_HEIGHT, 600)

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const player = filteredPlayers[index]
    if (!player) return null
    const isUserPlayer = userRosterId !== null && player.rosterId === userRosterId

    return (
      <div
        style={style}
        className={`flex items-center hover:bg-gray-700/50 transition-colors cursor-pointer border-b border-gray-700/50 ${
          isUserPlayer ? 'bg-amber-500/10 border-l-4 border-l-amber-500' : ''
        }`}
        onClick={() => onSelectPlayer?.(player.player_id)}
        role="row"
      >
        <div className="w-14 px-3 text-gray-500 text-sm shrink-0">{index + 1}</div>
        <div className="w-16 px-2 text-gray-400 text-sm shrink-0">{player.position}{positionRanks.get(player.player_id)}</div>
        <div className="flex-1 px-2 min-w-0">
          <span className="font-medium truncate">{player.full_name}</span>
          {player.injury_status && (
            <span className="text-xs text-red-400 ml-2">{player.injury_status}</span>
          )}
        </div>
        <div className="w-14 px-2 shrink-0">
          <span className={`px-2 py-1 rounded text-xs font-bold ${getPositionBgClass(player.position)}`}>
            {player.position}
          </span>
        </div>
        <div className="w-12 px-2 text-gray-400 text-sm hidden sm:block shrink-0">{player.team || 'FA'}</div>
        <div className="w-28 px-2 truncate shrink-0">
          {player.ownerName === 'Free Agent' ? (
            <span className="text-amber-500 text-sm">Free Agent</span>
          ) : (
            <Link
              href={`/league/${leagueId}/team/${player.rosterId}`}
              className="text-gray-400 hover:text-amber-500 transition-colors text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {player.ownerName}
            </Link>
          )}
        </div>
        <div className={`w-20 px-3 text-right font-semibold text-sm shrink-0 ${getValueColorClass(player.value)}`}>
          {player.value.toLocaleString()}
        </div>
      </div>
    )
  }, [filteredPlayers, userRosterId, positionRanks, getPositionBgClass, leagueId, onSelectPlayer])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-400">
          {filteredPlayers.length} players ({rosteredCount} rostered, {freeAgentCount} free agents)
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <label htmlFor="player-search" className="sr-only">Search players</label>
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="player-search"
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
            aria-label="Clear search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Position filters">
          {ALL_FILTER_POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setFilter(pos)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                filter === pos
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
              aria-pressed={filter === pos}
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
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-pressed={sortBy === 'value'}
          >
            Sort by Value
          </button>
          <button
            onClick={() => setSortBy('name')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              sortBy === 'name'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-pressed={sortBy === 'name'}
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
            aria-pressed={freeAgentsOnly}
          >
            Free Agents Only
          </button>
          <button
            onClick={() => setRookiesOnly(!rookiesOnly)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              rookiesOnly
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-pressed={rookiesOnly}
          >
            Rookies Only
          </button>
        </div>
      </div>

      {/* Virtualized Players List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center bg-gray-700 text-sm font-semibold text-gray-300" role="row">
          <div className="w-14 px-3 py-3 shrink-0" role="columnheader">Rank</div>
          <div className="w-16 px-2 py-3 shrink-0" role="columnheader">Pos.</div>
          <div className="flex-1 px-2 py-3" role="columnheader">Player</div>
          <div className="w-14 px-2 py-3 shrink-0" role="columnheader">Pos</div>
          <div className="w-12 px-2 py-3 hidden sm:block shrink-0" role="columnheader">Team</div>
          <div className="w-28 px-2 py-3 shrink-0" role="columnheader">Owner</div>
          <div className="w-20 px-3 py-3 text-right shrink-0" role="columnheader">Value</div>
        </div>

        {/* Virtualized rows */}
        {filteredPlayers.length > 0 ? (
          <List
            height={listHeight}
            itemCount={filteredPlayers.length}
            itemSize={ROW_HEIGHT}
            width="100%"
          >
            {Row}
          </List>
        ) : (
          <div className="py-12 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-lg">No players found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {filteredPlayers.length > 200 && (
        <p className="text-gray-500 text-center text-sm">
          Showing {Math.min(filteredPlayers.length, 200)} of {filteredPlayers.length} players. Use search or filters to narrow results.
        </p>
      )}
    </div>
  )
}

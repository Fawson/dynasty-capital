'use client'

import { useState, useMemo } from 'react'
import { SleeperPlayer, SleeperRoster, LeagueUser } from '@/lib/types'
import { getSleeperPlayerValue } from '@/lib/fantasypros'
import PlayerNews from '@/components/players/PlayerNews'

interface NewsTabProps {
  allPlayers: Record<string, SleeperPlayer>
  rosters: SleeperRoster[]
  users: LeagueUser[]
}

export default function NewsTab({ allPlayers, rosters, users }: NewsTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<SleeperPlayer | null>(null)

  // Create roster ownership map
  const ownershipMap = useMemo(() => {
    const userMap = new Map(users.map((u) => [u.user_id, u]))
    const map = new Map<string, { ownerName: string; rosterId: number }>()

    rosters.forEach((roster) => {
      const owner = userMap.get(roster.owner_id)
      const ownerName = owner?.metadata?.team_name || owner?.display_name || `Team ${roster.roster_id}`

      roster.players?.forEach((playerId) => {
        map.set(playerId, { ownerName, rosterId: roster.roster_id })
      })
    })

    return map
  }, [rosters, users])

  // Filter players based on search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []

    const query = searchQuery.toLowerCase()
    const results: Array<SleeperPlayer & { value: number; ownerName: string | null }>[] = []

    Object.values(allPlayers).forEach((player) => {
      if (!player.position || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) return

      const fullName = `${player.first_name} ${player.last_name}`.toLowerCase()
      const searchName = player.search_full_name?.toLowerCase() || ''

      if (fullName.includes(query) || searchName.includes(query)) {
        const ownership = ownershipMap.get(player.player_id)
        results.push({
          ...player,
          value: getSleeperPlayerValue(player.first_name, player.last_name, player.position, player.team),
          ownerName: ownership?.ownerName || null,
        })
      }
    })

    return results
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
  }, [searchQuery, allPlayers, ownershipMap])

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB': return 'bg-red-600'
      case 'RB': return 'bg-green-600'
      case 'WR': return 'bg-blue-600'
      case 'TE': return 'bg-orange-600'
      default: return 'bg-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-xl">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a player to see their news..."
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
        />

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {searchResults.map((player) => (
              <button
                key={player.player_id}
                onClick={() => {
                  setSelectedPlayer(player)
                  setSearchQuery('')
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0"
              >
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPositionColor(player.position)}`}>
                  {player.position}
                </span>
                <div className="flex-1">
                  <span className="font-medium">{player.first_name} {player.last_name}</span>
                  <span className="text-gray-500 ml-2">{player.team || 'FA'}</span>
                </div>
                {player.ownerName && (
                  <span className="text-sm text-gray-400">{player.ownerName}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Player News */}
      {selectedPlayer && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Player Info Card */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className={`px-3 py-1.5 rounded text-sm font-bold ${getPositionColor(selectedPlayer.position)}`}>
                {selectedPlayer.position}
              </span>
              <div>
                <h2 className="text-xl font-bold">
                  {selectedPlayer.first_name} {selectedPlayer.last_name}
                </h2>
                <p className="text-gray-400">{selectedPlayer.team || 'Free Agent'}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {selectedPlayer.age && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Age</span>
                  <span>{selectedPlayer.age}</span>
                </div>
              )}
              {selectedPlayer.years_exp !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Experience</span>
                  <span>{selectedPlayer.years_exp} {selectedPlayer.years_exp === 1 ? 'year' : 'years'}</span>
                </div>
              )}
              {selectedPlayer.college && (
                <div className="flex justify-between">
                  <span className="text-gray-500">College</span>
                  <span>{selectedPlayer.college}</span>
                </div>
              )}
            </div>
          </div>

          {/* News Component */}
          <div className="lg:col-span-1 xl:col-span-2">
            <PlayerNews
              playerId={selectedPlayer.player_id}
              playerName={`${selectedPlayer.first_name} ${selectedPlayer.last_name}`}
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedPlayer && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-400 mb-2">Player News</h3>
          <p className="text-gray-500">Search for a player above to see their latest news and updates</p>
        </div>
      )}
    </div>
  )
}

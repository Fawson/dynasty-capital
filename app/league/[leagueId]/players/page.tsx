'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { SleeperPlayer, SleeperRoster, LeagueUser } from '@/lib/types'
import { getSleeperPlayerValue } from '@/lib/fantasypros'

interface PlayerWithRoster extends SleeperPlayer {
  value: number
  ownerName: string
  rosterId: number
}

export default function PlayersPage() {
  const params = useParams()
  const leagueId = params.leagueId as string

  const [players, setPlayers] = useState<PlayerWithRoster[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'value' | 'name'>('value')

  useEffect(() => {
    async function fetchData() {
      try {
        const [rostersRes, usersRes, playersRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
          fetch('https://api.sleeper.app/v1/players/nfl'),
        ])

        const rosters: SleeperRoster[] = await rostersRes.json()
        const users: LeagueUser[] = await usersRes.json()
        const allPlayers: Record<string, SleeperPlayer> = await playersRes.json()

        const userMap = new Map(users.map((u) => [u.user_id, u]))

        const rosteredPlayers: PlayerWithRoster[] = []

        rosters.forEach((roster) => {
          const owner = userMap.get(roster.owner_id)
          const ownerName =
            owner?.metadata?.team_name || owner?.display_name || 'Unknown'

          roster.players?.forEach((playerId) => {
            const player = allPlayers[playerId]
            if (player && player.position) {
              const value = getSleeperPlayerValue(
                player.first_name,
                player.last_name,
                player.position,
                player.team
              )

              rosteredPlayers.push({
                ...player,
                value,
                ownerName,
                rosterId: roster.roster_id,
              })
            }
          })
        })

        setPlayers(rosteredPlayers)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [leagueId])

  const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF']

  const filteredPlayers = players
    .filter((p) => filter === 'ALL' || p.position === filter)
    .sort((a, b) => {
      if (sortBy === 'value') return b.value - a.value
      return a.full_name.localeCompare(b.full_name)
    })

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

  const getValueColor = (value: number) => {
    if (value >= 9000) return 'text-yellow-400'
    if (value >= 8000) return 'text-green-400'
    if (value >= 7000) return 'text-blue-400'
    if (value >= 5000) return 'text-gray-300'
    return 'text-gray-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading players...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Players</h1>
        <p className="text-gray-400">
          {filteredPlayers.length} players ({players.length} total rostered)
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          {positions.map((pos) => (
            <button
              key={pos}
              onClick={() => setFilter(pos)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === pos
                  ? 'bg-sleeper-highlight text-white'
                  : 'bg-sleeper-accent text-gray-400 hover:text-white'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
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
        </div>
      </div>

      {/* Players Table */}
      <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
        <table className="w-full">
          <thead className="bg-sleeper-accent">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                Player
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                Pos
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                Team
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">
                Owner
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sleeper-accent">
            {filteredPlayers.slice(0, 100).map((player, index) => (
              <tr
                key={player.player_id}
                className="hover:bg-sleeper-accent/50 transition-colors"
              >
                <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{player.full_name}</p>
                  {player.injury_status && (
                    <span className="text-xs text-red-400">
                      {player.injury_status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${getPositionColor(
                      player.position
                    )}`}
                  >
                    {player.position}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {player.team || 'FA'}
                </td>
                <td className="px-4 py-3 text-gray-400">{player.ownerName}</td>
                <td
                  className={`px-4 py-3 text-right font-semibold ${getValueColor(
                    player.value
                  )}`}
                >
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

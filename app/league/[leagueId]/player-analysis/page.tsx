'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SleeperPlayer, SleeperRoster, LeagueUser } from '@/lib/types'
import { getSleeperPlayerValue } from '@/lib/fantasypros'
import { getCurrentSeason } from '@/lib/sleeper'

interface PlayerStats {
  [key: string]: number | undefined
}

interface WeeklyStats {
  week: number
  stats: PlayerStats
}

interface PlayerWithDetails extends SleeperPlayer {
  value: number
  ownerName: string | null
  rosterId: number | null
  weeklyStats: WeeklyStats[]
  seasonTotals: PlayerStats
}

// Stat display configuration
const STAT_CONFIG: Record<string, { label: string; format: (v: number) => string; positions: string[] }> = {
  // Passing
  pass_yd: { label: 'Passing Yards', format: (v) => v.toFixed(0), positions: ['QB'] },
  pass_td: { label: 'Passing TDs', format: (v) => v.toFixed(0), positions: ['QB'] },
  pass_int: { label: 'Interceptions', format: (v) => v.toFixed(0), positions: ['QB'] },
  pass_att: { label: 'Pass Attempts', format: (v) => v.toFixed(0), positions: ['QB'] },
  pass_cmp: { label: 'Completions', format: (v) => v.toFixed(0), positions: ['QB'] },
  pass_cmp_pct: { label: 'Completion %', format: (v) => v.toFixed(1) + '%', positions: ['QB'] },

  // Rushing
  rush_yd: { label: 'Rushing Yards', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR'] },
  rush_td: { label: 'Rushing TDs', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR'] },
  rush_att: { label: 'Rush Attempts', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR'] },
  rush_ypc: { label: 'Yards/Carry', format: (v) => v.toFixed(1), positions: ['QB', 'RB', 'WR'] },

  // Receiving
  rec: { label: 'Receptions', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'] },
  rec_yd: { label: 'Receiving Yards', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'] },
  rec_td: { label: 'Receiving TDs', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'] },
  rec_tgt: { label: 'Targets', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'] },
  rec_ypr: { label: 'Yards/Reception', format: (v) => v.toFixed(1), positions: ['RB', 'WR', 'TE'] },

  // Fantasy
  pts_half_ppr: { label: 'Fantasy Points (Half PPR)', format: (v) => v.toFixed(1), positions: ['QB', 'RB', 'WR', 'TE'] },
  pts_ppr: { label: 'Fantasy Points (PPR)', format: (v) => v.toFixed(1), positions: ['QB', 'RB', 'WR', 'TE'] },
  pts_std: { label: 'Fantasy Points (Standard)', format: (v) => v.toFixed(1), positions: ['QB', 'RB', 'WR', 'TE'] },

  // Misc
  fum_lost: { label: 'Fumbles Lost', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR', 'TE'] },
  bonus_rec_te: { label: 'TE Premium Bonus', format: (v) => v.toFixed(1), positions: ['TE'] },
}

export default function PlayerAnalysisPage() {
  const params = useParams()
  const leagueId = params.leagueId as string

  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({})
  const [rosters, setRosters] = useState<SleeperRoster[]>([])
  const [users, setUsers] = useState<LeagueUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithDetails | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [expandedStat, setExpandedStat] = useState<string | null>(null)
  const [weeklyStatsCache, setWeeklyStatsCache] = useState<Record<string, Record<string, Record<string, PlayerStats>>>>({})

  const currentSeason = getCurrentSeason()

  useEffect(() => {
    async function fetchData() {
      try {
        const [rostersRes, usersRes, playersRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
          fetch('https://api.sleeper.app/v1/players/nfl'),
        ])

        const rostersData: SleeperRoster[] = await rostersRes.json()
        const usersData: LeagueUser[] = await usersRes.json()
        const playersData: Record<string, SleeperPlayer> = await playersRes.json()

        setRosters(rostersData)
        setUsers(usersData)
        setAllPlayers(playersData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [leagueId])

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
    const results: Array<SleeperPlayer & { value: number; ownerName: string | null }> = []

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
      .slice(0, 20)
  }, [searchQuery, allPlayers, ownershipMap])

  // Fetch player stats when selected
  async function selectPlayer(player: SleeperPlayer & { value: number; ownerName: string | null }) {
    setSelectedPlayer(null)
    setLoadingStats(true)
    setExpandedStat(null)

    try {
      const ownership = ownershipMap.get(player.player_id)
      const weeklyStats: WeeklyStats[] = []
      const seasonTotals: PlayerStats = {}

      // Fetch stats for weeks 1-18 (or current week)
      const currentWeek = getCurrentWeek()
      const weeksToFetch = Math.min(currentWeek, 18)

      // Check cache first, then fetch missing weeks
      const statsPromises: Promise<{ week: number; data: Record<string, PlayerStats> }>[] = []

      for (let week = 1; week <= weeksToFetch; week++) {
        if (weeklyStatsCache[currentSeason]?.[week.toString()]) {
          // Use cached data
          const cachedStats = weeklyStatsCache[currentSeason][week.toString()]
          const playerStats = cachedStats[player.player_id]
          if (playerStats) {
            weeklyStats.push({ week, stats: playerStats })
          }
        } else {
          // Need to fetch
          statsPromises.push(
            fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${currentSeason}/${week}`)
              .then((res) => res.json())
              .then((data) => ({ week, data }))
              .catch(() => ({ week, data: {} }))
          )
        }
      }

      // Fetch missing weeks
      if (statsPromises.length > 0) {
        const results = await Promise.all(statsPromises)

        // Update cache and collect stats
        const newCache = { ...weeklyStatsCache }
        if (!newCache[currentSeason]) newCache[currentSeason] = {}

        results.forEach(({ week, data }) => {
          newCache[currentSeason][week.toString()] = data
          if (data[player.player_id]) {
            weeklyStats.push({ week, stats: data[player.player_id] })
          }
        })

        setWeeklyStatsCache(newCache)
      }

      // Sort by week
      weeklyStats.sort((a, b) => a.week - b.week)

      // Calculate season totals
      weeklyStats.forEach(({ stats }) => {
        Object.entries(stats).forEach(([key, value]) => {
          if (typeof value === 'number') {
            seasonTotals[key] = (seasonTotals[key] || 0) + value
          }
        })
      })

      // Calculate derived stats
      if (seasonTotals.pass_att && seasonTotals.pass_cmp) {
        seasonTotals.pass_cmp_pct = (seasonTotals.pass_cmp / seasonTotals.pass_att) * 100
      }
      if (seasonTotals.rush_att && seasonTotals.rush_yd) {
        seasonTotals.rush_ypc = seasonTotals.rush_yd / seasonTotals.rush_att
      }
      if (seasonTotals.rec && seasonTotals.rec_yd) {
        seasonTotals.rec_ypr = seasonTotals.rec_yd / seasonTotals.rec
      }

      setSelectedPlayer({
        ...player,
        ownerName: ownership?.ownerName || null,
        rosterId: ownership?.rosterId || null,
        weeklyStats,
        seasonTotals,
      })
    } catch (error) {
      console.error('Failed to fetch player stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  function getCurrentWeek(): number {
    const season = parseInt(currentSeason)
    const seasonStart = new Date(`${season}-09-05`)
    const now = new Date()
    const diffTime = now.getTime() - seasonStart.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const week = Math.floor(diffDays / 7) + 1
    return Math.min(Math.max(week, 1), 18)
  }

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB': return 'bg-red-600'
      case 'RB': return 'bg-green-600'
      case 'WR': return 'bg-blue-600'
      case 'TE': return 'bg-orange-600'
      default: return 'bg-gray-600'
    }
  }

  // Get relevant stats for player's position
  const relevantStats = useMemo(() => {
    if (!selectedPlayer) return []

    return Object.entries(STAT_CONFIG)
      .filter(([key, config]) => {
        if (!config.positions.includes(selectedPlayer.position)) return false
        // Only show stats that have values
        return selectedPlayer.seasonTotals[key] !== undefined && selectedPlayer.seasonTotals[key] !== 0
      })
      .map(([key, config]) => ({
        key,
        ...config,
        value: selectedPlayer.seasonTotals[key] || 0,
      }))
  }, [selectedPlayer])

  // Get trend data for expanded stat
  const trendData = useMemo(() => {
    if (!selectedPlayer || !expandedStat) return []

    return selectedPlayer.weeklyStats.map(({ week, stats }) => ({
      week,
      value: stats[expandedStat] || 0,
    }))
  }, [selectedPlayer, expandedStat])

  // Calculate max value for chart scaling
  const maxTrendValue = useMemo(() => {
    if (trendData.length === 0) return 1
    return Math.max(...trendData.map((d) => d.value), 1)
  }, [trendData])

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
        <h1 className="text-2xl font-bold mb-2">Player Analysis</h1>
        <p className="text-gray-400">
          Search for any player to view their stats and performance trends
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for a player..."
          className="w-full px-4 py-3 bg-sleeper-primary border border-sleeper-accent rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-sleeper-highlight"
        />

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-sleeper-primary border border-sleeper-accent rounded-lg shadow-lg max-h-96 overflow-y-auto">
            {searchResults.map((player) => (
              <button
                key={player.player_id}
                onClick={() => {
                  selectPlayer(player)
                  setSearchQuery('')
                }}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-sleeper-accent/50 transition-colors border-b border-sleeper-accent last:border-b-0"
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
                <span className="text-green-400 text-sm">{player.value.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading Stats */}
      {loadingStats && (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading player stats...</div>
        </div>
      )}

      {/* Selected Player */}
      {selectedPlayer && !loadingStats && (
        <div className="space-y-6">
          {/* Player Header */}
          <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent">
            <div className="flex items-start gap-4">
              <span className={`px-3 py-1.5 rounded text-sm font-bold ${getPositionColor(selectedPlayer.position)}`}>
                {selectedPlayer.position}
              </span>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">
                  {selectedPlayer.first_name} {selectedPlayer.last_name}
                </h2>
                <div className="flex items-center gap-4 mt-1 text-gray-400">
                  <span>{selectedPlayer.team || 'Free Agent'}</span>
                  {selectedPlayer.age && <span>Age: {selectedPlayer.age}</span>}
                  <span>Exp: {selectedPlayer.years_exp} {selectedPlayer.years_exp === 1 ? 'year' : 'years'}</span>
                </div>
                {selectedPlayer.ownerName && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500">Owned by:</span>{' '}
                    <span className="text-sleeper-highlight">{selectedPlayer.ownerName}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-400">
                  {selectedPlayer.value.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Dynasty Value</div>
              </div>
            </div>
          </div>

          {/* Season Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{currentSeason} Season Stats</h3>
            <p className="text-gray-500 text-sm mb-4">Click any stat to see weekly trend</p>

            {relevantStats.length === 0 ? (
              <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent text-center text-gray-400">
                No stats available for this season
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {relevantStats.map((stat) => {
                  const isExpanded = expandedStat === stat.key
                  return (
                    <button
                      key={stat.key}
                      onClick={() => setExpandedStat(isExpanded ? null : stat.key)}
                      className={`p-4 rounded-lg border text-left transition-all ${
                        isExpanded
                          ? 'bg-sleeper-highlight/20 border-sleeper-highlight'
                          : 'bg-sleeper-primary border-sleeper-accent hover:border-sleeper-highlight'
                      }`}
                    >
                      <div className="text-gray-400 text-sm">{stat.label}</div>
                      <div className="text-2xl font-bold mt-1">{stat.format(stat.value)}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Trend Chart */}
          {expandedStat && trendData.length > 0 && (
            <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent">
              <h3 className="text-lg font-semibold mb-4">
                {STAT_CONFIG[expandedStat]?.label} - Weekly Trend
              </h3>

              {/* Simple bar chart */}
              <div className="space-y-2">
                {trendData.map(({ week, value }) => (
                  <div key={week} className="flex items-center gap-3">
                    <div className="w-16 text-sm text-gray-400">Week {week}</div>
                    <div className="flex-1 h-8 bg-sleeper-accent rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sleeper-highlight to-green-400 transition-all duration-300"
                        style={{ width: `${(value / maxTrendValue) * 100}%` }}
                      />
                    </div>
                    <div className="w-20 text-right font-medium">
                      {STAT_CONFIG[expandedStat]?.format(value) || value.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats summary */}
              <div className="mt-6 pt-4 border-t border-sleeper-accent grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-gray-400 text-sm">Average</div>
                  <div className="text-lg font-bold">
                    {STAT_CONFIG[expandedStat]?.format(
                      trendData.reduce((sum, d) => sum + d.value, 0) / trendData.length
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Best Week</div>
                  <div className="text-lg font-bold text-green-400">
                    {STAT_CONFIG[expandedStat]?.format(Math.max(...trendData.map((d) => d.value)))}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">Games Played</div>
                  <div className="text-lg font-bold">{trendData.filter((d) => d.value > 0).length}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!selectedPlayer && !loadingStats && (
        <div className="bg-sleeper-primary p-12 rounded-lg border border-sleeper-accent text-center">
          <div className="text-gray-500 text-lg">
            Search for a player above to view their stats and trends
          </div>
        </div>
      )}
    </div>
  )
}

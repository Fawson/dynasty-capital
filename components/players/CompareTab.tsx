'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { SleeperPlayer, SleeperRoster, LeagueUser } from '@/lib/types'
import { getSleeperPlayerValue } from '@/lib/fantasypros'
import { getCurrentSeason } from '@/lib/sleeper'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from 'recharts'

interface CompareTabProps {
  leagueId: string
  allPlayers: Record<string, SleeperPlayer>
  rosters: SleeperRoster[]
  users: LeagueUser[]
}

interface PlayerStats {
  [key: string]: number | undefined
}

interface WeeklyStats {
  week: number
  stats: PlayerStats
}

interface SeasonStats {
  season: string
  weeklyStats: WeeklyStats[]
  totals: PlayerStats
}

interface PlayerWithDetails extends SleeperPlayer {
  value: number
  ownerName: string | null
  rosterId: number | null
  seasonData: SeasonStats[]
}

interface PlayerSlot {
  player: PlayerWithDetails | null
  searchQuery: string
  loading: boolean
  historicalValues: { date: string; value: number }[]
}

// Stat display configuration
const STAT_CONFIG: Record<string, { label: string; format: (v: number) => string; positions: string[]; isSpecial?: boolean }> = {
  dynasty_value: { label: 'Dynasty Value', format: (v) => v.toLocaleString(), positions: ['QB', 'RB', 'WR', 'TE'], isSpecial: true },
  pts_half_ppr: { label: 'Fantasy Pts', format: (v) => v.toFixed(1), positions: ['QB', 'RB', 'WR', 'TE'] },
  pass_yd: { label: 'Pass Yards', format: (v) => v.toFixed(0), positions: ['QB'] },
  pass_td: { label: 'Pass TDs', format: (v) => v.toFixed(0), positions: ['QB'] },
  rush_yd: { label: 'Rush Yards', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR'] },
  rush_td: { label: 'Rush TDs', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR'] },
  rec: { label: 'Receptions', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'] },
  rec_yd: { label: 'Rec Yards', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'] },
  rec_td: { label: 'Rec TDs', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'] },
  rec_tgt: { label: 'Targets', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'] },
}

const PLAYER_COLORS = ['#00ceb8', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6'] // Teal, Orange, Purple, Red, Blue
const MAX_PLAYERS = 5

// Linear regression calculation
function calculateLinearRegression(data: { index: number; value: number }[]): { slope: number; intercept: number } {
  const n = data.length
  if (n < 2) return { slope: 0, intercept: data[0]?.value || 0 }

  const sumX = data.reduce((sum, d) => sum + d.index, 0)
  const sumY = data.reduce((sum, d) => sum + d.value, 0)
  const sumXY = data.reduce((sum, d) => sum + d.index * d.value, 0)
  const sumXX = data.reduce((sum, d) => sum + d.index * d.index, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  return { slope: isNaN(slope) ? 0 : slope, intercept: isNaN(intercept) ? 0 : intercept }
}

const createEmptySlot = (): PlayerSlot => ({
  player: null,
  searchQuery: '',
  loading: false,
  historicalValues: [],
})

export default function CompareTab({
  leagueId,
  allPlayers,
  rosters,
  users,
}: CompareTabProps) {
  const [playerSlots, setPlayerSlots] = useState<PlayerSlot[]>([createEmptySlot(), createEmptySlot()])
  const [selectedStat, setSelectedStat] = useState('pts_half_ppr')

  // Zoom state
  const [zoomLeft, setZoomLeft] = useState<string | null>(null)
  const [zoomRight, setZoomRight] = useState<string | null>(null)
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)

  const currentSeason = getCurrentSeason()
  const currentSeasonNum = parseInt(currentSeason)

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

  // Search function
  const searchPlayers = useCallback((query: string) => {
    if (!query.trim() || query.length < 2) return []

    const q = query.toLowerCase()
    const results: Array<SleeperPlayer & { value: number; ownerName: string | null }> = []

    Object.values(allPlayers).forEach((player) => {
      if (!player.position || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) return

      const fullName = `${player.first_name} ${player.last_name}`.toLowerCase()
      const searchName = player.search_full_name?.toLowerCase() || ''

      if (fullName.includes(q) || searchName.includes(q)) {
        const ownership = ownershipMap.get(player.player_id)
        results.push({
          ...player,
          value: getSleeperPlayerValue(player.first_name, player.last_name, player.position, player.team),
          ownerName: ownership?.ownerName || null,
        })
      }
    })

    return results.sort((a, b) => b.value - a.value).slice(0, 15)
  }, [allPlayers, ownershipMap])

  function getCurrentWeek(): number {
    const seasonStart = new Date(`${currentSeasonNum}-09-05`)
    const now = new Date()
    const diffTime = now.getTime() - seasonStart.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const week = Math.floor(diffDays / 7) + 1
    return Math.min(Math.max(week, 1), 18)
  }

  const updateSlot = useCallback((index: number, updates: Partial<PlayerSlot>) => {
    setPlayerSlots(prev => prev.map((slot, i) => i === index ? { ...slot, ...updates } : slot))
  }, [])

  async function selectPlayer(
    player: SleeperPlayer & { value: number; ownerName: string | null },
    slotIndex: number
  ) {
    updateSlot(slotIndex, { loading: true, searchQuery: '' })

    try {
      const ownership = ownershipMap.get(player.player_id)
      const seasonData: SeasonStats[] = []

      // Fetch stats for last 5 seasons
      const seasons = Array.from({ length: 5 }, (_, i) => currentSeasonNum - i)

      for (const season of seasons) {
        const weeklyStats: WeeklyStats[] = []
        const totals: PlayerStats = {}

        const weeksToFetch = season === currentSeasonNum ? getCurrentWeek() : 18

        const weekPromises = Array.from({ length: weeksToFetch }, (_, i) => i + 1).map(week =>
          fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`)
            .then(res => res.ok ? res.json() : ({} as Record<string, PlayerStats>))
            .then((data: Record<string, PlayerStats>) => ({ week, data }))
            .catch(() => ({ week, data: {} as Record<string, PlayerStats> }))
        )

        const results = await Promise.all(weekPromises)

        results.forEach(({ week, data }) => {
          if (data[player.player_id]) {
            weeklyStats.push({ week, stats: data[player.player_id] })
          }
        })

        weeklyStats.sort((a, b) => a.week - b.week)

        weeklyStats.forEach(({ stats }) => {
          Object.entries(stats).forEach(([key, value]) => {
            if (typeof value === 'number') {
              totals[key] = (totals[key] || 0) + value
            }
          })
        })

        if (weeklyStats.length > 0) {
          seasonData.push({ season: season.toString(), weeklyStats, totals })
        }
      }

      const playerWithDetails: PlayerWithDetails = {
        ...player,
        ownerName: ownership?.ownerName || player.ownerName || null,
        rosterId: ownership?.rosterId || null,
        seasonData,
      }

      // Fetch historical dynasty values
      let historicalValues: { date: string; value: number }[] = []
      try {
        const playerFullName = `${player.first_name} ${player.last_name}`
        const histRes = await fetch(`/api/historical-values?player=${encodeURIComponent(playerFullName)}`)
        if (histRes.ok) {
          const histData = await histRes.json()
          historicalValues = histData.history || []
        }
      } catch (histError) {
        console.error('Failed to fetch historical values:', histError)
      }

      updateSlot(slotIndex, { player: playerWithDetails, historicalValues, loading: false })
    } catch (error) {
      console.error('Failed to fetch player stats:', error)
      updateSlot(slotIndex, { loading: false })
    }
  }

  const removePlayer = useCallback((slotIndex: number) => {
    updateSlot(slotIndex, { player: null, historicalValues: [] })
  }, [updateSlot])

  const addPlayerSlot = useCallback(() => {
    if (playerSlots.length < MAX_PLAYERS) {
      setPlayerSlots(prev => [...prev, createEmptySlot()])
    }
  }, [playerSlots.length])

  const removePlayerSlot = useCallback((slotIndex: number) => {
    if (playerSlots.length > 2) {
      setPlayerSlots(prev => prev.filter((_, i) => i !== slotIndex))
    }
  }, [playerSlots.length])

  // Reset zoom when stat changes
  useEffect(() => {
    setZoomLeft(null)
    setZoomRight(null)
  }, [selectedStat])

  // Zoom handlers
  const handleMouseDown = useCallback((e: any) => {
    if (e.activeLabel) {
      setRefAreaLeft(String(e.activeLabel))
      setIsSelecting(true)
    }
  }, [])

  const handleMouseMove = useCallback((e: any) => {
    if (isSelecting && e.activeLabel) {
      setRefAreaRight(String(e.activeLabel))
    }
  }, [isSelecting])

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      setZoomLeft(refAreaLeft)
      setZoomRight(refAreaRight)
    }
    setRefAreaLeft(null)
    setRefAreaRight(null)
    setIsSelecting(false)
  }, [refAreaLeft, refAreaRight])

  const resetZoom = useCallback(() => {
    setZoomLeft(null)
    setZoomRight(null)
  }, [])

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB': return 'bg-red-600'
      case 'RB': return 'bg-green-600'
      case 'WR': return 'bg-blue-600'
      case 'TE': return 'bg-orange-600'
      default: return 'bg-gray-600'
    }
  }

  // Get selected players (non-null)
  const selectedPlayers = useMemo(() => {
    return playerSlots
      .map((slot, index) => ({ ...slot, index, color: PLAYER_COLORS[index] }))
      .filter(slot => slot.player !== null) as Array<PlayerSlot & { index: number; color: string; player: PlayerWithDetails }>
  }, [playerSlots])

  // Get available stats for comparison
  const availableStats = useMemo(() => {
    if (selectedPlayers.length < 2) return Object.entries(STAT_CONFIG)

    return Object.entries(STAT_CONFIG).filter(([_, config]) => {
      return selectedPlayers.some(slot => config.positions.includes(slot.player.position))
    })
  }, [selectedPlayers])

  // Build comparison chart data with trend lines
  const chartData = useMemo(() => {
    if (selectedPlayers.length < 2) return []

    const statKey = selectedStat

    // Special handling for dynasty value - use historical values
    if (statKey === 'dynasty_value') {
      const playerDataMap: Record<number, Record<string, number>> = {}

      selectedPlayers.forEach(slot => {
        playerDataMap[slot.index] = {}
        const slotData = playerSlots[slot.index]
        slotData.historicalValues.forEach(h => {
          playerDataMap[slot.index][h.date] = h.value
        })
      })

      // Merge all dates and sort
      const allDates = new Set<string>()
      selectedPlayers.forEach(slot => {
        Object.keys(playerDataMap[slot.index]).forEach(date => allDates.add(date))
      })
      const sortedDates = Array.from(allDates).sort()

      // Calculate regressions
      const regressions: Record<number, { slope: number; intercept: number } | null> = {}
      selectedPlayers.forEach(slot => {
        const trendData = sortedDates
          .map((date, i) => playerDataMap[slot.index][date] != null ? { index: i, value: playerDataMap[slot.index][date] } : null)
          .filter((d): d is { index: number; value: number } => d !== null)
        regressions[slot.index] = trendData.length >= 2 ? calculateLinearRegression(trendData) : null
      })

      return sortedDates.map((date, i) => {
        // Format as MM-YY
        const [year, month] = date.split('-')
        const formattedDate = `${month}-${year.slice(2)}`
        const dataPoint: Record<string, string | number | null> = { name: formattedDate }

        selectedPlayers.forEach(slot => {
          const playerName = slot.player.full_name
          dataPoint[playerName] = playerDataMap[slot.index][date] ?? null
          const reg = regressions[slot.index]
          dataPoint[`${playerName} Trend`] = reg && playerDataMap[slot.index][date] != null
            ? reg.slope * i + reg.intercept
            : null
        })

        return dataPoint
      })
    }

    // Get all weekly data for all players
    const playerDataMap: Record<number, Record<string, number>> = {}

    selectedPlayers.forEach(slot => {
      playerDataMap[slot.index] = {}
      const seasonsOldestFirst = [...(slot.player.seasonData || [])].reverse()

      seasonsOldestFirst.forEach(season => {
        season.weeklyStats.forEach(w => {
          const key = `${season.season} W${w.week}`
          playerDataMap[slot.index][key] = w.stats[statKey] || 0
        })
      })
    })

    // Merge all keys and sort
    const allKeys = new Set<string>()
    selectedPlayers.forEach(slot => {
      Object.keys(playerDataMap[slot.index]).forEach(key => allKeys.add(key))
    })
    const sortedKeys = Array.from(allKeys).sort((a, b) => {
      const [aSeason, aWeek] = a.split(' W')
      const [bSeason, bWeek] = b.split(' W')
      if (aSeason !== bSeason) return parseInt(aSeason) - parseInt(bSeason)
      return parseInt(aWeek) - parseInt(bWeek)
    })

    // Calculate regressions
    const regressions: Record<number, { slope: number; intercept: number } | null> = {}
    selectedPlayers.forEach(slot => {
      const trendData = sortedKeys
        .map((key, i) => playerDataMap[slot.index][key] != null && playerDataMap[slot.index][key] > 0
          ? { index: i, value: playerDataMap[slot.index][key] }
          : null)
        .filter((d): d is { index: number; value: number } => d !== null)
      regressions[slot.index] = trendData.length >= 5 ? calculateLinearRegression(trendData) : null
    })

    return sortedKeys.map((key, i) => {
      const dataPoint: Record<string, string | number | null> = { name: key }

      selectedPlayers.forEach(slot => {
        const playerName = slot.player.full_name
        dataPoint[playerName] = playerDataMap[slot.index][key] ?? null
        const reg = regressions[slot.index]
        dataPoint[`${playerName} Trend`] = reg && playerDataMap[slot.index][key] != null && playerDataMap[slot.index][key] > 0
          ? reg.slope * i + reg.intercept
          : null
      })

      return dataPoint
    })
  }, [selectedPlayers, playerSlots, selectedStat])

  // Filter chart data based on zoom
  const zoomedChartData = useMemo(() => {
    if (!zoomLeft || !zoomRight || chartData.length === 0) return chartData

    const leftIndex = chartData.findIndex(d => d.name === zoomLeft)
    const rightIndex = chartData.findIndex(d => d.name === zoomRight)

    if (leftIndex === -1 || rightIndex === -1) return chartData

    const startIndex = Math.min(leftIndex, rightIndex)
    const endIndex = Math.max(leftIndex, rightIndex)

    const filteredData = chartData.slice(startIndex, endIndex + 1)

    // Recalculate trend lines for zoomed data
    const regressions: Record<number, { slope: number; intercept: number } | null> = {}
    selectedPlayers.forEach(slot => {
      const trendData = filteredData
        .map((d, i) => {
          const val = d[slot.player.full_name]
          return typeof val === 'number' && val > 0 ? { index: i, value: val } : null
        })
        .filter((d): d is { index: number; value: number } => d !== null)
      regressions[slot.index] = trendData.length >= 2 ? calculateLinearRegression(trendData) : null
    })

    return filteredData.map((d, i) => {
      const newPoint = { ...d }
      selectedPlayers.forEach(slot => {
        const playerName = slot.player.full_name
        const reg = regressions[slot.index]
        const val = d[playerName]
        newPoint[`${playerName} Trend`] = reg && typeof val === 'number' && val > 0
          ? reg.slope * i + reg.intercept
          : null
      })
      return newPoint
    })
  }, [chartData, zoomLeft, zoomRight, selectedPlayers])

  const isZoomed = zoomLeft !== null && zoomRight !== null

  // Calculate comparison stats for each player
  const comparisonStats = useMemo(() => {
    if (selectedPlayers.length < 2) return null

    const config = STAT_CONFIG[selectedStat]
    const isDynastyValue = selectedStat === 'dynasty_value'

    const stats = selectedPlayers.map(slot => {
      const valuesWithDates = chartData
        .map(d => ({ value: d[slot.player.full_name], date: d.name as string }))
        .filter((v): v is { value: number; date: string } => typeof v.value === 'number' && v.value > 0)

      const values = valuesWithDates.map(v => v.value)
      const total = values.reduce((sum, v) => sum + v, 0)
      const avg = values.length > 0 ? total / values.length : 0
      const max = values.length > 0 ? Math.max(...values) : 0
      const min = values.length > 0 ? Math.min(...values) : 0

      // Find peak and low dates
      const peakEntry = valuesWithDates.find(v => v.value === max)
      const lowEntry = valuesWithDates.find(v => v.value === min)
      // Current is the most recent value (last in the array)
      const currentEntry = valuesWithDates[valuesWithDates.length - 1]

      return {
        player: slot.player,
        color: slot.color,
        total,
        avg,
        max,
        min,
        current: currentEntry?.value || 0,
        peakDate: peakEntry?.date || '',
        lowDate: lowEntry?.date || '',
        games: values.length,
      }
    })

    return {
      players: stats,
      format: config?.format || ((v: number) => v.toFixed(1)),
      isDynastyValue,
    }
  }, [selectedPlayers, chartData, selectedStat])

  // Calculate Y-axis domain based on zoomed data
  const yDomain = useMemo(() => {
    if (zoomedChartData.length === 0 || selectedPlayers.length < 2) return [0, 100]

    const allValues = zoomedChartData.flatMap(d =>
      selectedPlayers.map(slot => d[slot.player.full_name])
    ).filter((v): v is number => typeof v === 'number' && v > 0)

    if (allValues.length === 0) return [0, 100]

    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const range = max - min || 1

    return [Math.max(0, min - range * 0.05), max + range * 0.05]
  }, [zoomedChartData, selectedPlayers])

  return (
    <div className="space-y-6">
      {/* Player Selection */}
      <div className="flex flex-wrap gap-4">
        {playerSlots.map((slot, index) => {
          const searchResults = searchPlayers(slot.searchQuery)

          return (
            <div key={index} className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent w-full md:w-auto md:min-w-[280px] md:flex-1 md:max-w-[320px]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[index] }} />
                  <span className="font-semibold">Player {index + 1}</span>
                </div>
                {playerSlots.length > 2 && (
                  <button
                    onClick={() => removePlayerSlot(index)}
                    className="text-gray-500 hover:text-red-400 transition-colors text-sm"
                    title="Remove slot"
                  >
                    &times;
                  </button>
                )}
              </div>

              {slot.player ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPositionColor(slot.player.position)}`}>
                      {slot.player.position}
                    </span>
                    <div>
                      <span className="font-medium">{slot.player.full_name}</span>
                      <p className="text-gray-500 text-sm">{slot.player.team || 'FA'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removePlayer(index)}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={slot.searchQuery}
                    onChange={(e) => updateSlot(index, { searchQuery: e.target.value })}
                    placeholder="Search for a player..."
                    className="w-full px-3 py-2 bg-sleeper-accent border border-sleeper-accent rounded text-white placeholder-gray-500 focus:outline-none focus:border-sleeper-highlight"
                  />
                  {slot.loading && (
                    <div className="absolute right-3 top-2 text-gray-400">Loading...</div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-sleeper-primary border border-sleeper-accent rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {searchResults.map((p) => (
                        <button
                          key={p.player_id}
                          onClick={() => selectPlayer(p, index)}
                          className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-sleeper-accent/50 transition-colors border-b border-sleeper-accent last:border-b-0"
                        >
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPositionColor(p.position)}`}>
                            {p.position}
                          </span>
                          <span className="flex-1">{p.first_name} {p.last_name}</span>
                          <span className="text-gray-500 text-sm">{p.team || 'FA'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Add Player Button */}
        {playerSlots.length < MAX_PLAYERS && (
          <button
            onClick={addPlayerSlot}
            className="bg-sleeper-primary p-4 rounded-lg border border-dashed border-sleeper-accent w-full md:w-auto md:min-w-[120px] flex items-center justify-center gap-2 text-gray-500 hover:text-white hover:border-sleeper-highlight transition-colors"
          >
            <span className="text-2xl">+</span>
            <span>Add Player</span>
          </button>
        )}
      </div>

      {/* Comparison Chart */}
      {selectedPlayers.length >= 2 && (
        <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
          {/* Stat Selector */}
          <div className="flex flex-wrap gap-2 p-4 border-b border-sleeper-accent">
            {availableStats.map(([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedStat(key)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  selectedStat === key
                    ? 'bg-sleeper-highlight text-white'
                    : 'bg-sleeper-accent text-gray-400 hover:text-white'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {STAT_CONFIG[selectedStat]?.label || selectedStat} Comparison
              </h3>
              {isZoomed && (
                <button
                  onClick={resetZoom}
                  className="px-3 py-1 text-sm bg-sleeper-accent text-gray-300 hover:text-white rounded transition-colors"
                >
                  Reset Zoom
                </button>
              )}
            </div>
            <p className="text-gray-500 text-xs mb-2">Click and drag to zoom. Double-click to reset.</p>

            <div className="h-80 select-none">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={zoomedChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onDoubleClick={resetZoom}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#6b7280"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#374151' }}
                    interval={Math.max(0, Math.floor(zoomedChartData.length / 8) - 1)}
                    allowDataOverflow
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#374151' }}
                    tickFormatter={(v) => STAT_CONFIG[selectedStat]?.format(v) || v.toFixed(1)}
                    width={55}
                    domain={yDomain}
                    allowDataOverflow
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(value: any, name?: string) => {
                      // Hide trend line values in tooltip
                      if (name?.endsWith(' Trend')) return null
                      const numValue = typeof value === 'number' ? value : 0
                      return [STAT_CONFIG[selectedStat]?.format(numValue) || numValue.toFixed(1), name || '']
                    }}
                    filterNull={true}
                    cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Legend />
                  {/* Faded data lines */}
                  {selectedPlayers.map((slot) => (
                    <Line
                      key={`data-${slot.index}`}
                      type="monotone"
                      dataKey={slot.player.full_name}
                      stroke={slot.color}
                      strokeWidth={2}
                      strokeOpacity={0.3}
                      dot={false}
                      activeDot={false}
                      connectNulls={false}
                    />
                  ))}
                  {/* Trend lines - non-interactive */}
                  {selectedPlayers.map((slot) => (
                    <Line
                      key={`trend-${slot.index}`}
                      type="linear"
                      dataKey={`${slot.player.full_name} Trend`}
                      stroke={slot.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={false}
                      connectNulls={true}
                      legendType="none"
                    />
                  ))}
                  {/* Selection highlight */}
                  {refAreaLeft && refAreaRight && (
                    <ReferenceArea
                      x1={refAreaLeft}
                      x2={refAreaRight}
                      strokeOpacity={0.3}
                      fill="#00ceb8"
                      fillOpacity={0.2}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Comparison Stats */}
            {comparisonStats && (
              <div className={`mt-6 grid gap-4 ${
                comparisonStats.players.length <= 2 ? 'grid-cols-2' :
                comparisonStats.players.length === 3 ? 'grid-cols-3' :
                comparisonStats.players.length === 4 ? 'grid-cols-2 md:grid-cols-4' :
                'grid-cols-2 md:grid-cols-5'
              }`}>
                {comparisonStats.players.map((stat) => (
                  <div key={stat.player.player_id} className="bg-sleeper-accent/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }} />
                      <span className="font-semibold text-sm truncate">{stat.player.full_name}</span>
                    </div>
                    {comparisonStats.isDynastyValue ? (
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-gray-400 text-xs">Current</div>
                          <div className="font-bold">{comparisonStats.format(stat.current)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Peak</div>
                          <div className="font-bold">{comparisonStats.format(stat.max)}</div>
                          <div className="text-gray-500 text-xs">{stat.peakDate}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Low</div>
                          <div className="font-bold">{comparisonStats.format(stat.min)}</div>
                          <div className="text-gray-500 text-xs">{stat.lowDate}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-gray-400 text-xs">Total</div>
                          <div className="font-bold">{comparisonStats.format(stat.total)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Avg/Game</div>
                          <div className="font-bold">{comparisonStats.format(stat.avg)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Best Week</div>
                          <div className="font-bold">{comparisonStats.format(stat.max)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Games</div>
                          <div className="font-bold">{stat.games}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedPlayers.length < 2 && (
        <div className="bg-sleeper-primary p-12 rounded-lg border border-sleeper-accent text-center">
          <div className="text-gray-500 text-lg">
            {selectedPlayers.length === 0
              ? 'Select at least two players above to compare their stats'
              : 'Select one more player to start comparing'}
          </div>
        </div>
      )}
    </div>
  )
}

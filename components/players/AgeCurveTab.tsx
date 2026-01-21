'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { SleeperPlayer } from '@/lib/types'
import { getSleeperPlayerValue } from '@/lib/fantasypros'
import { Skeleton, SkeletonChart } from '@/components/Skeleton'
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from 'recharts'

interface AgeCurveTabProps {
  allPlayers: Record<string, SleeperPlayer>
}

interface PlayerWithValue extends SleeperPlayer {
  value: number
  age: number
}

interface AgeDataPoint {
  age: number
  // Per-position averages
  QB_avg: number | null
  QB_band: [number, number] | null
  RB_avg: number | null
  RB_band: [number, number] | null
  WR_avg: number | null
  WR_band: [number, number] | null
  TE_avg: number | null
  TE_band: [number, number] | null
  // For scatter overlay
  [key: string]: number | [number, number] | null | undefined
}

interface SelectedPlayer {
  player: PlayerWithValue
  color: string
  historicalValues: { date: string; value: number; age: number }[]
  loading: boolean
}

const POSITION_COLORS: Record<string, string> = {
  QB: '#ef4444', // Red
  RB: '#22c55e', // Green
  WR: '#3b82f6', // Blue
  TE: '#f97316', // Orange
}

const PLAYER_OVERLAY_COLORS = ['#00ceb8', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

// Calculate mean and standard deviation
function calculateStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length

  if (values.length < 2) return { mean, stdDev: 0 }

  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1)
  const stdDev = Math.sqrt(variance)

  return { mean, stdDev }
}

export default function AgeCurveTab({ allPlayers }: AgeCurveTabProps) {
  const [playerSnapShares, setPlayerSnapShares] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set(['QB', 'RB', 'WR', 'TE']))
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showStdDev, setShowStdDev] = useState(true)

  // Zoom state
  const [zoomLeft, setZoomLeft] = useState<number | null>(null)
  const [zoomRight, setZoomRight] = useState<number | null>(null)
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null)
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)

  useEffect(() => {
    async function fetchSnapShares() {
      try {
        // Fetch snap share data from recent weeks (current season)
        const currentYear = new Date().getFullYear()
        const season = new Date().getMonth() >= 8 ? currentYear : currentYear - 1

        // Fetch last 8 weeks of data to get snap shares
        const snapShareData: Record<string, { total: number; count: number }> = {}

        const weekPromises = Array.from({ length: 8 }, (_, i) => i + 1).map(week =>
          fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`)
            .then(res => res.ok ? res.json() : {})
            .catch(() => ({}))
        )

        const weekResults = await Promise.all(weekPromises)

        weekResults.forEach(weekData => {
          Object.entries(weekData).forEach(([playerId, stats]: [string, any]) => {
            const offSnp = stats?.off_snp
            const tmOffSnp = stats?.tm_off_snp
            if (offSnp && tmOffSnp && tmOffSnp > 0) {
              const snapShare = (offSnp / tmOffSnp) * 100
              if (!snapShareData[playerId]) {
                snapShareData[playerId] = { total: 0, count: 0 }
              }
              snapShareData[playerId].total += snapShare
              snapShareData[playerId].count++
            }
          })
        })

        // Calculate average snap share per player
        const avgSnapShares: Record<string, number> = {}
        Object.entries(snapShareData).forEach(([playerId, data]) => {
          if (data.count > 0) {
            avgSnapShares[playerId] = data.total / data.count
          }
        })

        setPlayerSnapShares(avgSnapShares)
      } catch (error) {
        console.error('Failed to fetch snap shares:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSnapShares()
  }, [])

  // Get all players with values and ages (filtered by 50%+ snap share)
  const playersWithValues = useMemo(() => {
    const players: PlayerWithValue[] = []

    Object.values(allPlayers).forEach((player) => {
      if (!player.position || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) return
      if (!player.age || player.age < 20 || player.age > 40) return

      const value = getSleeperPlayerValue(player.first_name, player.last_name, player.position, player.team)
      if (value <= 0) return

      // Filter by snap share > 50%
      const snapShare = playerSnapShares[player.player_id]
      if (snapShare === undefined || snapShare < 50) return

      players.push({
        ...player,
        value,
        age: player.age,
      })
    })

    return players
  }, [allPlayers, playerSnapShares])

  // Calculate age curves with standard deviation (players with >50% snap share)
  const ageData = useMemo(() => {
    const positions = ['QB', 'RB', 'WR', 'TE']
    const integerAges = Array.from({ length: 21 }, (_, i) => i + 20) // Ages 20-40

    // Group all players by position and age
    const groupedData: Record<string, Record<number, number[]>> = {
      QB: {},
      RB: {},
      WR: {},
      TE: {},
    }

    playersWithValues.forEach(player => {
      if (!groupedData[player.position][player.age]) {
        groupedData[player.position][player.age] = []
      }
      groupedData[player.position][player.age].push(player.value)
    })

    // First calculate stats at integer ages
    const integerStats: Record<number, Record<string, { avg: number | null; band: [number, number] | null }>> = {}

    integerAges.forEach(age => {
      integerStats[age] = {}
      positions.forEach(pos => {
        const values = groupedData[pos][age] || []
        if (values.length >= 2) {
          const { mean, stdDev } = calculateStats(values)
          integerStats[age][pos] = {
            avg: mean,
            band: [Math.max(0, mean - stdDev), mean + stdDev]
          }
        } else {
          integerStats[age][pos] = { avg: null, band: null }
        }
      })
    })

    // Helper to interpolate between two values
    const interpolate = (v1: number | null, v2: number | null, t: number): number | null => {
      if (v1 === null || v2 === null) return null
      return v1 + (v2 - v1) * t
    }

    const interpolateBand = (b1: [number, number] | null, b2: [number, number] | null, t: number): [number, number] | null => {
      if (b1 === null || b2 === null) return null
      return [b1[0] + (b2[0] - b1[0]) * t, b1[1] + (b2[1] - b1[1]) * t]
    }

    // Create fine-grained data points (every 0.1 years)
    const dataPoints: AgeDataPoint[] = []
    for (let age = 20; age <= 40; age += 0.1) {
      const roundedAge = Math.round(age * 10) / 10
      const lowerAge = Math.floor(roundedAge)
      const upperAge = Math.ceil(roundedAge)
      const t = roundedAge - lowerAge // Interpolation factor (0 to 1)

      const point: AgeDataPoint = {
        age: roundedAge,
        QB_avg: null,
        QB_band: null,
        RB_avg: null,
        RB_band: null,
        WR_avg: null,
        WR_band: null,
        TE_avg: null,
        TE_band: null,
      }

      positions.forEach(pos => {
        const lower = integerStats[lowerAge]?.[pos]
        const upper = integerStats[upperAge]?.[pos]

        if (lower && upper) {
          point[`${pos}_avg` as keyof AgeDataPoint] = interpolate(lower.avg, upper.avg, t)
          point[`${pos}_band` as keyof AgeDataPoint] = interpolateBand(lower.band, upper.band, t)
        }
      })

      dataPoints.push(point)
    }

    return dataPoints
  }, [playersWithValues])

  // Search for players to overlay
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []

    const q = searchQuery.toLowerCase()
    const results = playersWithValues.filter(player => {
      const fullName = `${player.first_name} ${player.last_name}`.toLowerCase()
      return fullName.includes(q)
    })

    return results.sort((a, b) => b.value - a.value).slice(0, 10)
  }, [searchQuery, playersWithValues])

  const addPlayer = useCallback(async (player: PlayerWithValue) => {
    if (selectedPlayers.length >= 5) return
    if (selectedPlayers.some(sp => sp.player.player_id === player.player_id)) return

    const color = PLAYER_OVERLAY_COLORS[selectedPlayers.length]

    // Add player immediately with loading state
    setSelectedPlayers(prev => [...prev, { player, color, historicalValues: [], loading: true }])
    setSearchQuery('')

    // Fetch historical dynasty values
    try {
      const playerFullName = `${player.first_name} ${player.last_name}`
      const histRes = await fetch(`/api/historical-values?player=${encodeURIComponent(playerFullName)}`)

      if (histRes.ok) {
        const histData = await histRes.json()
        const history = histData.history || []

        // Calculate precise decimal age at each historical date
        // Estimate birth date based on current age (assume June 15 birthday)
        const currentDate = new Date()
        const estimatedBirthDate = new Date(
          currentDate.getFullYear() - player.age,
          5, // June (0-indexed)
          15
        )

        const historicalWithAge = history.map((h: { date: string; value: number }) => {
          const [yearStr, monthStr, dayStr] = h.date.split('-')
          const dataDate = new Date(
            parseInt(yearStr),
            parseInt(monthStr) - 1, // Month is 0-indexed
            parseInt(dayStr || '15') // Default to 15th if no day
          )

          // Calculate precise age in years (to many decimal places)
          const msPerYear = 365.25 * 24 * 60 * 60 * 1000
          const ageAtDate = (dataDate.getTime() - estimatedBirthDate.getTime()) / msPerYear

          return {
            date: h.date,
            value: h.value,
            age: Math.round(Math.max(20, Math.min(40, ageAtDate)) * 100) / 100, // 2 decimal places, clamped
          }
        }).sort((a: { age: number }, b: { age: number }) => a.age - b.age) // Sort by age

        setSelectedPlayers(prev => prev.map(sp =>
          sp.player.player_id === player.player_id
            ? { ...sp, historicalValues: historicalWithAge, loading: false }
            : sp
        ))
      } else {
        setSelectedPlayers(prev => prev.map(sp =>
          sp.player.player_id === player.player_id
            ? { ...sp, loading: false }
            : sp
        ))
      }
    } catch (error) {
      console.error('Failed to fetch historical values:', error)
      setSelectedPlayers(prev => prev.map(sp =>
        sp.player.player_id === player.player_id
          ? { ...sp, loading: false }
          : sp
      ))
    }
  }, [selectedPlayers])

  const removePlayer = useCallback((playerId: string) => {
    setSelectedPlayers(prev => prev.filter(sp => sp.player.player_id !== playerId))
  }, [])

  const togglePosition = useCallback((pos: string) => {
    setSelectedPositions(prev => {
      const next = new Set(prev)
      if (next.has(pos)) {
        next.delete(pos)
      } else {
        next.add(pos)
      }
      return next
    })
  }, [])

  // Zoom handlers
  const handleMouseDown = useCallback((e: any) => {
    if (e.activeLabel !== undefined) {
      setRefAreaLeft(Number(e.activeLabel))
      setIsSelecting(true)
    }
  }, [])

  const handleMouseMove = useCallback((e: any) => {
    if (isSelecting && e.activeLabel !== undefined) {
      setRefAreaRight(Number(e.activeLabel))
    }
  }, [isSelecting])

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft !== null && refAreaRight !== null && refAreaLeft !== refAreaRight) {
      const left = Math.min(refAreaLeft, refAreaRight)
      const right = Math.max(refAreaLeft, refAreaRight)
      setZoomLeft(left)
      setZoomRight(right)
    }
    setRefAreaLeft(null)
    setRefAreaRight(null)
    setIsSelecting(false)
  }, [refAreaLeft, refAreaRight])

  const resetZoom = useCallback(() => {
    setZoomLeft(null)
    setZoomRight(null)
  }, [])

  const isZoomed = zoomLeft !== null && zoomRight !== null

  // Calculate zoomed X domain
  const xDomain = useMemo(() => {
    if (isZoomed) {
      return [zoomLeft, zoomRight] as [number, number]
    }
    return [20, 40] as [number, number]
  }, [isZoomed, zoomLeft, zoomRight])

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB': return 'bg-red-600'
      case 'RB': return 'bg-green-600'
      case 'WR': return 'bg-blue-600'
      case 'TE': return 'bg-orange-600'
      default: return 'bg-gray-600'
    }
  }

  // Calculate fixed Y-axis domain based on position data only
  const yAxisDomain = useMemo(() => {
    const allValues: number[] = []

    ageData.forEach(point => {
      ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
        const avg = point[`${pos}_avg` as keyof AgeDataPoint]
        const band = point[`${pos}_band` as keyof AgeDataPoint]

        if (typeof avg === 'number' && avg > 0) {
          allValues.push(avg)
        }
        if (Array.isArray(band)) {
          allValues.push(band[0], band[1])
        }
      })
    })

    if (allValues.length === 0) return [0, 10000]

    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const padding = (max - min) * 0.1

    return [Math.max(0, min - padding), max + padding]
  }, [ageData])

  // Custom tooltip - manually looks up data from both ageData and selectedPlayers
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string; name?: string }>; label?: number }) => {
    if (!active || label == null) return null

    const hoveredAge = typeof label === 'number' ? label : parseFloat(String(label))
    if (isNaN(hoveredAge)) return null

    // Get curve data from payload (position averages)
    const curveData: Array<{ name: string; value: number; color: string }> = []

    if (payload) {
      payload.forEach(p => {
        if (p.value == null) return
        if (p.dataKey.includes('_band')) return

        if (p.dataKey.endsWith('_avg')) {
          curveData.push({
            name: p.dataKey.replace('_avg', '') + ' Curve',
            value: p.value,
            color: p.color
          })
        }
      })
    }

    // Manually look up player data near this age (within 0.5 year tolerance)
    const playerData: Array<{ name: string; value: number; color: string; age: number }> = []
    const tolerance = 0.5

    selectedPlayers.forEach(sp => {
      if (sp.historicalValues.length === 0) return

      // Find the closest data point to the hovered age
      let closestValue: number | null = null
      let closestAge: number | null = null
      let closestDist = Infinity

      sp.historicalValues.forEach(hv => {
        const dist = Math.abs(hv.age - hoveredAge)
        if (dist < closestDist && dist <= tolerance) {
          closestDist = dist
          closestValue = hv.value
          closestAge = hv.age
        }
      })

      if (closestValue !== null && closestAge !== null) {
        playerData.push({
          name: sp.player.full_name,
          value: closestValue,
          color: sp.color,
          age: closestAge
        })
      }
    })

    if (curveData.length === 0 && playerData.length === 0) return null

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg min-w-[180px]">
        <p className="text-gray-400 mb-2 font-medium">Age: {hoveredAge.toFixed(1)}</p>

        {curveData.length > 0 && (
          <div className="mb-2">
            <p className="text-gray-500 text-xs mb-1">Position Averages:</p>
            {curveData.map((entry, index) => (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {entry.name}: {entry.value.toLocaleString()}
              </p>
            ))}
          </div>
        )}

        {playerData.length > 0 && (
          <div>
            <p className="text-gray-500 text-xs mb-1">Players:</p>
            {playerData.map((entry, index) => (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {entry.name}: {entry.value.toLocaleString()}
                <span className="text-gray-500 text-xs ml-1">(age {entry.age.toFixed(1)})</span>
              </p>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent">
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-40" />
          </div>
        </div>
        <SkeletonChart className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent">
        <div className="flex flex-wrap items-center gap-4">
          {/* Position toggles */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Positions:</span>
            {['QB', 'RB', 'WR', 'TE'].map(pos => (
              <button
                key={pos}
                onClick={() => togglePosition(pos)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  selectedPositions.has(pos)
                    ? `${getPositionColor(pos)} text-white`
                    : 'bg-sleeper-accent text-gray-500'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>

          {/* Std Dev toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showStdDev}
              onChange={(e) => setShowStdDev(e.target.checked)}
              className="rounded border-gray-600 bg-sleeper-accent text-sleeper-highlight focus:ring-sleeper-highlight"
            />
            <span className="text-gray-400 text-sm">Show Std Dev</span>
          </label>
        </div>
      </div>

      {/* Player Search */}
      <div className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent">
        <h3 className="font-semibold mb-3">Compare Players</h3>

        {/* Selected Players */}
        {selectedPlayers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedPlayers.map(sp => (
              <div
                key={sp.player.player_id}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-sleeper-accent"
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sp.color }} />
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${getPositionColor(sp.player.position)}`}>
                  {sp.player.position}
                </span>
                <span className="text-sm">{sp.player.full_name}</span>
                <span className="text-gray-500 text-xs">Age {sp.player.age}</span>
                {sp.loading && <div className="w-3 h-3 border-2 border-sleeper-accent border-t-sleeper-highlight rounded-full animate-spin" />}
                {!sp.loading && sp.historicalValues.length > 0 && (
                  <span className="text-gray-500 text-xs">({sp.historicalValues.length} pts)</span>
                )}
                <button
                  onClick={() => removePlayer(sp.player.player_id)}
                  className="text-gray-500 hover:text-red-400 ml-1"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search Input */}
        {selectedPlayers.length < 5 && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a player to add..."
              className="w-full md:w-96 px-3 py-2 bg-sleeper-accent border border-sleeper-accent rounded text-white placeholder-gray-500 focus:outline-none focus:border-sleeper-highlight"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full md:w-96 mt-1 bg-sleeper-primary border border-sleeper-accent rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {searchResults.map((player) => (
                  <button
                    key={player.player_id}
                    onClick={() => addPlayer(player)}
                    className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-sleeper-accent/50 transition-colors border-b border-sleeper-accent last:border-b-0"
                  >
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPositionColor(player.position)}`}>
                      {player.position}
                    </span>
                    <span className="flex-1">{player.first_name} {player.last_name}</span>
                    <span className="text-gray-500 text-sm">Age {player.age}</span>
                    <span className="text-gray-400 text-sm">{player.value.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Dynasty Value by Age</h3>
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

        <div className="h-96 select-none">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={ageData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={resetZoom}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="age"
                type="number"
                domain={xDomain}
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: '#374151' }}
                allowDataOverflow
                label={{ value: 'Age', position: 'bottom', fill: '#6b7280', offset: 0 }}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#374151' }}
                tickFormatter={(v) => v.toLocaleString()}
                width={60}
                domain={yAxisDomain}
                allowDataOverflow
                label={{ value: 'Dynasty Value', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
              />
              <ZAxis range={[100, 100]} />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value: string) => {
                  if (value.endsWith('_avg')) return value.replace('_avg', '')
                  return value
                }}
              />

              {/* Standard deviation band areas */}
              {showStdDev && ['QB', 'RB', 'WR', 'TE'].map(pos => (
                selectedPositions.has(pos) && (
                  <Area
                    key={`${pos}_band`}
                    dataKey={`${pos}_band`}
                    stroke="none"
                    fill={POSITION_COLORS[pos]}
                    fillOpacity={0.15}
                    connectNulls
                    legendType="none"
                    isAnimationActive={false}
                  />
                )
              ))}

              {/* Average lines */}
              {['QB', 'RB', 'WR', 'TE'].map(pos => (
                selectedPositions.has(pos) && (
                  <Line
                    key={`${pos}_line`}
                    type="monotone"
                    dataKey={`${pos}_avg`}
                    stroke={POSITION_COLORS[pos]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: POSITION_COLORS[pos] }}
                    connectNulls
                    name={`${pos}_avg`}
                  />
                )
              ))}

              {/* Player historical value lines */}
              {selectedPlayers.map((sp) => (
                sp.historicalValues.length > 0 && (
                  <Line
                    key={`player-line-${sp.player.player_id}`}
                    data={sp.historicalValues}
                    dataKey="value"
                    name={sp.player.full_name}
                    stroke={sp.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: sp.color }}
                    connectNulls
                    legendType="circle"
                  />
                )
              ))}

              {/* Selection highlight */}
              {refAreaLeft !== null && refAreaRight !== null && (
                <ReferenceArea
                  x1={refAreaLeft}
                  x2={refAreaRight}
                  strokeOpacity={0.3}
                  fill="#00ceb8"
                  fillOpacity={0.2}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Player stats cards */}
        {selectedPlayers.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4">
            {selectedPlayers.map(sp => {
              // Find the position average for this player's age
              const agePoint = ageData.find(d => d.age === sp.player.age)
              const posAvg = agePoint?.[`${sp.player.position}_avg` as keyof AgeDataPoint] as number | null
              const diff = posAvg ? sp.player.value - posAvg : null
              const diffPercent = posAvg ? ((sp.player.value - posAvg) / posAvg * 100) : null

              // Calculate value change from historical data
              const historicalStart = sp.historicalValues.length > 0 ? sp.historicalValues[0] : null
              const historicalEnd = sp.historicalValues.length > 0 ? sp.historicalValues[sp.historicalValues.length - 1] : null
              const valueChange = historicalStart && historicalEnd ? historicalEnd.value - historicalStart.value : null
              const valueChangePercent = historicalStart && valueChange ? (valueChange / historicalStart.value * 100) : null

              return (
                <div key={sp.player.player_id} className="bg-sleeper-accent/30 rounded-lg p-3 flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sp.color }} />
                    <span className="font-semibold text-sm">{sp.player.full_name}</span>
                    {sp.loading && <span className="text-gray-400 text-xs">(Loading...)</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs">Current Value</div>
                      <div className="font-bold">{sp.player.value.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Age</div>
                      <div className="font-bold">{sp.player.age}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">{sp.player.position} Avg at {sp.player.age}</div>
                      <div className="font-bold">{posAvg?.toLocaleString() || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">vs Average</div>
                      <div className={`font-bold ${diff && diff > 0 ? 'text-green-400' : diff && diff < 0 ? 'text-red-400' : ''}`}>
                        {diff !== null ? `${diff > 0 ? '+' : ''}${diffPercent?.toFixed(0)}%` : 'N/A'}
                      </div>
                    </div>
                    {sp.historicalValues.length > 1 && (
                      <>
                        <div>
                          <div className="text-gray-400 text-xs">Age Range Tracked</div>
                          <div className="font-bold">{historicalStart?.age.toFixed(2)} → {historicalEnd?.age.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">Value Change</div>
                          <div className={`font-bold ${valueChange && valueChange > 0 ? 'text-green-400' : valueChange && valueChange < 0 ? 'text-red-400' : ''}`}>
                            {valueChange !== null ? `${valueChange > 0 ? '+' : ''}${valueChangePercent?.toFixed(0)}%` : 'N/A'}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent p-6">
        <h3 className="text-lg font-semibold mb-4">Position Peak Ages</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['QB', 'RB', 'WR', 'TE'].map(pos => {
            // Find peak age for this position
            const posData = ageData
              .filter(d => d[`${pos}_avg` as keyof AgeDataPoint] !== null)
              .map(d => ({ age: d.age, avg: d[`${pos}_avg` as keyof AgeDataPoint] as number }))

            const peak = posData.reduce((max, d) => d.avg > max.avg ? d : max, { age: 0, avg: 0 })

            return (
              <div key={pos} className="text-center">
                <div className={`inline-block px-3 py-1 rounded text-sm font-bold mb-2 ${getPositionColor(pos)}`}>
                  {pos}
                </div>
                <div className="text-2xl font-bold">{peak.age || 'N/A'}</div>
                <div className="text-gray-400 text-sm">Peak Age</div>
                <div className="text-gray-500 text-xs mt-1">
                  Avg Value: {peak.avg?.toLocaleString() || 'N/A'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

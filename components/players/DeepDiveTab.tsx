'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { SleeperPlayer, SleeperRoster, LeagueUser } from '@/lib/types'
import { getSleeperPlayerValue } from '@/lib/fantasypros'
import { Skeleton, SkeletonCard, SkeletonChart } from '@/components/Skeleton'
import { getCurrentSeason } from '@/lib/sleeper'
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Brush,
  ReferenceLine,
} from 'recharts'

interface DeepDiveTabProps {
  leagueId: string
  allPlayers: Record<string, SleeperPlayer>
  rosters: SleeperRoster[]
  users: LeagueUser[]
  initialPlayerId?: string | null
}

interface PlayerStats {
  [key: string]: number | undefined
}

interface WeeklyStats {
  week: number
  stats: PlayerStats
  team?: string
}

interface SeasonStats {
  season: string
  weeklyStats: WeeklyStats[]
  totals: PlayerStats
}

interface CachedPlayerData {
  seasonData: SeasonStats[]
  historicalValues: { date: string; value: number }[]
  timestamp: number
}

// Player data cache - persists across component re-renders
const playerDataCache = new Map<string, CachedPlayerData>()
const preloadingPlayers = new Set<string>() // Track which players are currently being preloaded
const CACHE_DURATION = 1000 * 60 * 30 // 30 minutes

interface PlayerWithDetails extends SleeperPlayer {
  value: number
  ownerName: string | null
  rosterId: number | null
  seasonData: SeasonStats[]
  currentSeasonTotals: PlayerStats
}

// Stat display configuration
const STAT_CONFIG: Record<string, { label: string; format: (v: number) => string; positions: string[]; higherIsBetter: boolean; isComputed?: boolean }> = {
  // Passing
  pass_yd: { label: 'Passing Yards', format: (v) => v.toFixed(0), positions: ['QB'], higherIsBetter: true },
  pass_td: { label: 'Passing TDs', format: (v) => v.toFixed(0), positions: ['QB'], higherIsBetter: true },
  pass_int: { label: 'Interceptions', format: (v) => v.toFixed(0), positions: ['QB'], higherIsBetter: false },
  pass_att: { label: 'Pass Attempts', format: (v) => v.toFixed(0), positions: ['QB'], higherIsBetter: true },
  pass_cmp: { label: 'Completions', format: (v) => v.toFixed(0), positions: ['QB'], higherIsBetter: true },

  // Rushing
  rush_yd: { label: 'Rushing Yards', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR'], higherIsBetter: true },
  rush_td: { label: 'Rushing TDs', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR'], higherIsBetter: true },
  rush_att: { label: 'Rush Attempts', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR'], higherIsBetter: true },

  // Receiving
  rec: { label: 'Receptions', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'], higherIsBetter: true },
  rec_yd: { label: 'Receiving Yards', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'], higherIsBetter: true },
  rec_td: { label: 'Receiving TDs', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'], higherIsBetter: true },
  rec_tgt: { label: 'Targets', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'], higherIsBetter: true },

  // Snap data
  snap_share: { label: 'Snap Share %', format: (v) => v.toFixed(1) + '%', positions: ['RB', 'WR', 'TE'], higherIsBetter: true, isComputed: true },
  off_snp: { label: 'Snap Count', format: (v) => v.toFixed(0), positions: ['RB', 'WR', 'TE'], higherIsBetter: true },

  // Fantasy
  pts_half_ppr: { label: 'Fantasy Pts (Half PPR)', format: (v) => v.toFixed(1), positions: ['QB', 'RB', 'WR', 'TE'], higherIsBetter: true },

  // Misc
  fum_lost: { label: 'Fumbles Lost', format: (v) => v.toFixed(0), positions: ['QB', 'RB', 'WR', 'TE'], higherIsBetter: false },
}

// NFL Team Colors
const NFL_TEAM_COLORS: Record<string, string> = {
  ARI: '#97233F', ATL: '#A71930', BAL: '#241773', BUF: '#00338D',
  CAR: '#0085CA', CHI: '#0B162A', CIN: '#FB4F14', CLE: '#311D00',
  DAL: '#003594', DEN: '#FB4F14', DET: '#0076B6', GB: '#203731',
  HOU: '#03202F', IND: '#002C5F', JAX: '#006778', KC: '#E31837',
  LAC: '#0080C6', LAR: '#003594', LV: '#A5ACAF', MIA: '#008E97',
  MIN: '#4F2683', NE: '#002244', NO: '#D3BC8D', NYG: '#0B2265',
  NYJ: '#125740', PHI: '#004C54', PIT: '#FFB612', SF: '#AA0000',
  SEA: '#002244', TB: '#D50A0A', TEN: '#0C2340', WAS: '#5A1414',
  FA: '#6B7280', // Free Agent - gray
}

// Linear regression calculation
function calculateLinearRegression(data: { index: number; value: number }[]): { slope: number; intercept: number } {
  const n = data.length
  if (n === 0) return { slope: 0, intercept: 0 }

  const sumX = data.reduce((sum, d) => sum + d.index, 0)
  const sumY = data.reduce((sum, d) => sum + d.value, 0)
  const sumXY = data.reduce((sum, d) => sum + d.index * d.value, 0)
  const sumXX = data.reduce((sum, d) => sum + d.index * d.index, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  return { slope: isNaN(slope) ? 0 : slope, intercept: isNaN(intercept) ? 0 : intercept }
}

// Interactive Line Chart Component with zoom/pan and team colors
function LineChart({
  data,
  label,
  format = (v: number) => v.toFixed(1),
  height = 280,
  color = '#00ceb8',
  showBrush = true,
  showTeamColors = false,
  hideTrend = false,
  position,
}: {
  data: { x: string; y: number; team?: string; snapShare?: number; inactive?: boolean }[]
  label: string
  format?: (v: number) => string
  height?: number
  color?: string
  showBrush?: boolean
  showTeamColors?: boolean
  hideTrend?: boolean
  position?: string
}) {
  if (data.length === 0) return null

  // Transform data for Recharts
  const chartData = data.map((d, i) => ({
    name: d.x,
    value: d.y,
    index: i,
    team: d.team || 'FA',
    snapShare: d.snapShare,
    inactive: d.inactive,
  }))

  // Count occurrences of each team (excluding inactive weeks)
  const teamCounts: Record<string, number> = {}
  chartData.forEach(d => {
    if (d.team && !d.inactive) {
      teamCounts[d.team] = (teamCounts[d.team] || 0) + 1
    }
  })

  // Get unique teams for legend (in order of appearance)
  // Filter out teams with < 3 data points (likely erroneous/fallback data)
  const teamsInOrder: string[] = []
  chartData.forEach(d => {
    if (d.team && !d.inactive && !teamsInOrder.includes(d.team) && teamCounts[d.team] >= 3) {
      teamsInOrder.push(d.team)
    }
  })

  // Reassign points with rare/erroneous teams or inactive weeks to the nearest valid team
  // This prevents gaps in the chart
  let lastValidTeam = teamsInOrder[0] || 'FA'
  chartData.forEach(d => {
    if (d.inactive || teamCounts[d.team] < 3) {
      d.team = lastValidTeam
    } else {
      lastValidTeam = d.team
    }
  })

  // For multi-team coloring, create separate data series for each team
  // Each series has values only for its team's segments (with overlap at transitions)
  const teamDataSeries: Record<string, (number | null)[]> = {}
  if (showTeamColors && teamsInOrder.length > 1) {
    teamsInOrder.forEach(team => {
      teamDataSeries[team] = chartData.map(() => null)
    })

    // Fill in values for each team, including overlap points at transitions
    chartData.forEach((d, i) => {
      const team = d.team
      if (teamDataSeries[team]) {
        teamDataSeries[team][i] = d.value
        // Add overlap point at transition (previous point if different team)
        if (i > 0 && chartData[i - 1].team !== team) {
          teamDataSeries[team][i - 1] = chartData[i - 1].value
        }
        // Add overlap point at next transition
        if (i < chartData.length - 1 && chartData[i + 1].team !== team) {
          teamDataSeries[team][i + 1] = chartData[i + 1].value
        }
      }
    })
  }

  // Default line color (used when not showing team colors or single team)
  const lineColor = showTeamColors && teamsInOrder.length > 0
    ? (NFL_TEAM_COLORS[teamsInOrder[0]] || color)
    : color

  // Calculate linear regression for trend line using filtered data points
  // Exclude inactive weeks, and for QBs exclude zero-point games, for others exclude games with <10% snap share AND 0 points
  const filteredData = chartData.filter(d => {
    if (d.inactive) return false
    if (position === 'QB') return d.value > 0
    // Exclude only if BOTH snap share < 10% AND points = 0
    if (d.snapShare !== undefined && d.snapShare < 10 && d.value === 0) return false
    // Also exclude if no snap share data and 0 points
    if (d.snapShare === undefined && d.value === 0) return false
    return true
  })
  const regressionData = filteredData.map(d => ({ index: d.index, value: d.value }))
  const { slope, intercept } = calculateLinearRegression(regressionData)

  // Add trend line values and team-specific values
  const chartDataWithTrend = chartData.map((d, i) => {
    const trendValue = slope * d.index + intercept
    const result: Record<string, any> = {
      ...d,
      trend: trendValue,
    }
    // Add team-specific values for multi-team charts
    if (showTeamColors && teamsInOrder.length > 1) {
      teamsInOrder.forEach(team => {
        result[`value_${team}`] = teamDataSeries[team][i]
      })
    }
    return result
  })

  // Custom tooltip with team info
  const CustomTooltip = ({ active, payload, label: tooltipLabel }: any) => {
    if (active && payload && payload.length) {
      // Find the actual value from any of the payloads
      const validPayload = payload.find((p: any) => p.value !== null && p.value !== undefined)
      if (!validPayload) return null
      const team = validPayload?.payload?.team
      const value = validPayload?.payload?.value
      const teamColor = showTeamColors && team ? NFL_TEAM_COLORS[team] || '#6B7280' : color
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-lg">
          <p className="text-gray-400 text-xs">{tooltipLabel}</p>
          <p className="text-white font-bold">{format(value)}</p>
          {showTeamColors && team && (
            <p className="text-xs mt-1" style={{ color: teamColor }}>{team}</p>
          )}
        </div>
      )
    }
    return null
  }

  // Determine trend direction for label
  const trendDirection = slope > 0.01 ? 'Trending Up' : slope < -0.01 ? 'Trending Down' : 'Stable'
  const trendColor = slope > 0.01 ? '#22c55e' : slope < -0.01 ? '#ef4444' : '#f59e0b'

  // Calculate dynamic Y-axis domain (5% padding below min, 5% above max)
  const values = chartData.filter(d => d.value > 0).map(d => d.value)
  const minValue = values.length > 0 ? Math.min(...values) : 0
  const maxValue = values.length > 0 ? Math.max(...values) : 100
  const range = maxValue - minValue || 1
  const yMin = Math.max(0, minValue - range * 0.05)
  const yMax = maxValue + range * 0.05

  // Check if we should render multiple team lines
  const useMultiTeamLines = showTeamColors && teamsInOrder.length > 1

  return (
    <div className="w-full" style={{ height: height + (showBrush ? 50 : 0) }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartDataWithTrend}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            {useMultiTeamLines ? (
              // Create gradients for each team
              teamsInOrder.map(team => (
                <linearGradient key={team} id={`gradient-${label}-${team}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={NFL_TEAM_COLORS[team] || color} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={NFL_TEAM_COLORS[team] || color} stopOpacity={0.05} />
                </linearGradient>
              ))
            ) : (
              <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.5} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0.08} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#9CA3AF"
            fontSize={10}
            tickLine={{ stroke: '#6B7280', strokeWidth: 1 }}
            tickSize={-4}
            tickMargin={8}
            axisLine={{ stroke: '#6B7280' }}
            interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
          />
          <YAxis
            stroke="#9CA3AF"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: '#6B7280' }}
            tickFormatter={(value) => value === 0 && yMin === 0 ? '' : format(value)}
            width={55}
            domain={[yMin, yMax]}
            allowDataOverflow={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          {useMultiTeamLines ? (
            // Render separate line for each team with its color
            teamsInOrder.map((team, idx) => (
              <Area
                key={team}
                type="monotone"
                dataKey={`value_${team}`}
                stroke={NFL_TEAM_COLORS[team] || color}
                strokeWidth={2.5}
                fill={`url(#gradient-${label}-${team})`}
                dot={false}
                activeDot={{ r: 6, fill: NFL_TEAM_COLORS[team] || color, stroke: '#1f2937', strokeWidth: 2 }}
                connectNulls={true}
                isAnimationActive={idx === 0}
              />
            ))
          ) : (
            <Area
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2.5}
              fill={`url(#gradient-${label})`}
              dot={false}
              activeDot={{ r: 6, fill: lineColor, stroke: '#1f2937', strokeWidth: 2 }}
            />
          )}
          {/* Linear best fit trend line - only show with 5+ data points */}
          {filteredData.length >= 5 && (
            <Line
              type="linear"
              dataKey="trend"
              stroke={trendColor}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls={true}
            />
          )}
          {showBrush && data.length > 5 && (
            <Brush
              dataKey="name"
              height={30}
              stroke={teamsInOrder.length > 0 ? (NFL_TEAM_COLORS[teamsInOrder[teamsInOrder.length - 1]] || color) : lineColor}
              fill="#1f2937"
              tickFormatter={() => ''}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {!hideTrend && filteredData.length >= 5 && (
        <div className="flex justify-end mt-1">
          <p className="text-xs" style={{ color: trendColor }}>
            {trendDirection} {slope !== 0 && `(${slope > 0 ? '+' : ''}${(slope * 10).toFixed(2)}/10 weeks)`}
          </p>
        </div>
      )}
    </div>
  )
}

export default function DeepDiveTab({
  leagueId,
  allPlayers,
  rosters,
  users,
  initialPlayerId,
}: DeepDiveTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerWithDetails | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [expandedStat, setExpandedStat] = useState<string | null>(null)
  const [historicalValues, setHistoricalValues] = useState<{ date: string; value: number }[]>([])
  const [loadingHistorical, setLoadingHistorical] = useState(false)
  const [chartPreset, setChartPreset] = useState<string>('career')
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const statsScrollRef = useRef<HTMLDivElement>(null)

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

  // Calculate all rostered players with values for ranking
  const rosteredPlayersRanked = useMemo(() => {
    const playerIds = new Set<string>()
    rosters.forEach(roster => {
      roster.players?.forEach(id => playerIds.add(id))
    })

    const playersWithValues: { playerId: string; position: string; value: number }[] = []

    playerIds.forEach(playerId => {
      const player = allPlayers[playerId]
      if (player && player.position && ['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
        const value = getSleeperPlayerValue(player.first_name, player.last_name, player.position, player.team)
        playersWithValues.push({ playerId, position: player.position, value })
      }
    })

    // Sort by value descending
    playersWithValues.sort((a, b) => b.value - a.value)

    return playersWithValues
  }, [rosters, allPlayers])

  // Get player rankings
  const getPlayerRanks = useCallback((playerId: string, position: string) => {
    const overallRank = rosteredPlayersRanked.findIndex(p => p.playerId === playerId) + 1
    const positionPlayers = rosteredPlayersRanked.filter(p => p.position === position)
    const positionRank = positionPlayers.findIndex(p => p.playerId === playerId) + 1

    return {
      overallRank,
      overallTotal: rosteredPlayersRanked.length,
      positionRank,
      positionTotal: positionPlayers.length,
    }
  }, [rosteredPlayersRanked])

  // Filter players based on search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []

    const query = searchQuery.toLowerCase()
    const results: Array<SleeperPlayer & { value: number; ownerName: string | null; rosterId: number | null }> = []

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
          rosterId: ownership?.rosterId || null,
        })
      }
    })

    return results
      .sort((a, b) => b.value - a.value)
      .slice(0, 20)
  }, [searchQuery, allPlayers, ownershipMap])

  async function selectPlayerById(player: SleeperPlayer, ownerName: string | null) {
    const fullPlayer = {
      ...player,
      value: getSleeperPlayerValue(player.first_name, player.last_name, player.position, player.team),
      ownerName,
    }
    await selectPlayer(fullPlayer)
  }

  // Handle initial player selection
  useEffect(() => {
    if (initialPlayerId && allPlayers[initialPlayerId] && !initialLoadDone) {
      const player = allPlayers[initialPlayerId]
      const userMap = new Map(users.map((u) => [u.user_id, u]))
      let ownerName: string | null = null

      for (const roster of rosters) {
        if (roster.players?.includes(initialPlayerId)) {
          const owner = userMap.get(roster.owner_id)
          ownerName = owner?.metadata?.team_name || owner?.display_name || null
          break
        }
      }

      selectPlayerById(player, ownerName)
      setInitialLoadDone(true)
    }
  }, [initialPlayerId, allPlayers, users, rosters, initialLoadDone])

  // Fetch player stats when selected (uses cache if available)
  async function selectPlayer(player: SleeperPlayer & { value: number; ownerName: string | null }) {
    setSelectedPlayer(null)
    setExpandedStat(null)
    setChartPreset('career')

    const ownership = ownershipMap.get(player.player_id)

    // Check cache first for instant load
    const cached = playerDataCache.get(player.player_id)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setSelectedPlayer({
        ...player,
        ownerName: ownership?.ownerName || player.ownerName || null,
        rosterId: ownership?.rosterId || null,
        seasonData: cached.seasonData,
        currentSeasonTotals: cached.seasonData[0]?.totals || {},
      })
      setExpandedStat('pts_half_ppr')
      setHistoricalValues(cached.historicalValues)
      return
    }

    setLoadingStats(true)
    setLoadingHistorical(true)

    try {
      const data = await fetchPlayerData(player)

      if (data) {
        setSelectedPlayer({
          ...player,
          ownerName: ownership?.ownerName || player.ownerName || null,
          rosterId: ownership?.rosterId || null,
          seasonData: data.seasonData,
          currentSeasonTotals: data.seasonData[0]?.totals || {},
        })
        setExpandedStat('pts_half_ppr')
        setHistoricalValues(data.historicalValues)
      }
    } catch (error) {
      console.error('Failed to fetch player stats:', error)
    } finally {
      setLoadingStats(false)
      setLoadingHistorical(false)
    }
  }

  function getCurrentWeek(): number {
    const season = currentSeasonNum
    const seasonStart = new Date(`${season}-09-05`)
    const now = new Date()
    const diffTime = now.getTime() - seasonStart.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const week = Math.floor(diffDays / 7) + 1
    return Math.min(Math.max(week, 1), 18)
  }

  // Fetch player data (used by both preload and select)
  const fetchPlayerData = useCallback(async (player: SleeperPlayer): Promise<CachedPlayerData | null> => {
    const playerId = player.player_id

    // Check cache first
    const cached = playerDataCache.get(playerId)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached
    }

    // Mark as preloading to prevent duplicate fetches
    if (preloadingPlayers.has(playerId)) {
      // Wait for the other fetch to complete
      while (preloadingPlayers.has(playerId)) {
        await new Promise(resolve => setTimeout(resolve, 100))
        const newCached = playerDataCache.get(playerId)
        if (newCached) return newCached
      }
      return playerDataCache.get(playerId) || null
    }

    preloadingPlayers.add(playerId)

    try {
      const seasonData: SeasonStats[] = []

      // Fetch team history from ESPN (if player has ESPN ID)
      let teamHistory: Record<string, string> = {}
      const espnId = (player as any).espn_id
      if (espnId) {
        try {
          const teamHistoryRes = await fetch(`/api/player-team-history?espnId=${espnId}`)
          if (teamHistoryRes.ok) {
            const data = await teamHistoryRes.json()
            teamHistory = data.teamHistory || {}
          }
        } catch {
          // Fall back to current team if team history fetch fails
        }
      }

      // Fetch stats for last 6 seasons - all in parallel for speed
      const seasons = Array.from({ length: 6 }, (_, i) => currentSeasonNum - i)

      // Fetch with timeout helper
      const fetchWithTimeout = async (url: string, timeout = 8000): Promise<Record<string, PlayerStats>> => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        try {
          const res = await fetch(url, { signal: controller.signal })
          clearTimeout(timeoutId)
          return res.ok ? res.json() : {}
        } catch {
          clearTimeout(timeoutId)
          return {}
        }
      }

      // Fetch all seasons in parallel
      const seasonPromises = seasons.map(async (season) => {
        const weeksToFetch = season === currentSeasonNum ? getCurrentWeek() : 18
        const weeklyStats: WeeklyStats[] = []
        const totals: PlayerStats = {}

        // Fetch all weeks for this season in parallel
        const weekPromises = Array.from({ length: weeksToFetch }, (_, i) => i + 1).map(async week => {
          const data = await fetchWithTimeout(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`)
          return { week, data }
        })

        const results = await Promise.all(weekPromises)

        results.forEach(({ week, data }) => {
          if (data[playerId]) {
            const stats = { ...data[playerId] }
            // Compute snap share percentage
            const offSnp = stats.off_snp as number | undefined
            const tmOffSnp = stats.tm_off_snp as number | undefined
            if (offSnp && tmOffSnp && tmOffSnp > 0) {
              stats.snap_share = (offSnp / tmOffSnp) * 100
            }
            // Use team from ESPN history if available
            const team = teamHistory[`${season}-${week}`] || ''
            weeklyStats.push({ week, stats, team })
          }
        })

        weeklyStats.sort((a, b) => a.week - b.week)

        // Fill in missing teams from nearby weeks
        let lastKnownTeam = ''
        weeklyStats.forEach(ws => {
          if (ws.team) {
            lastKnownTeam = ws.team
          } else if (lastKnownTeam) {
            ws.team = lastKnownTeam
          }
        })
        lastKnownTeam = ''
        for (let i = weeklyStats.length - 1; i >= 0; i--) {
          const currentTeam = weeklyStats[i].team
          if (currentTeam) {
            lastKnownTeam = currentTeam
          } else if (lastKnownTeam) {
            weeklyStats[i].team = lastKnownTeam
          }
        }
        const fallbackTeam = player.team || 'FA'
        weeklyStats.forEach(ws => {
          if (!ws.team) {
            ws.team = fallbackTeam
          }
        })

        // Calculate totals
        let snapShareSum = 0
        let snapShareCount = 0
        weeklyStats.forEach(({ stats }) => {
          Object.entries(stats).forEach(([key, value]) => {
            if (typeof value === 'number') {
              if (key === 'snap_share') {
                snapShareSum += value
                snapShareCount++
              } else {
                totals[key] = (totals[key] || 0) + value
              }
            }
          })
        })
        if (snapShareCount > 0) {
          totals.snap_share = snapShareSum / snapShareCount
        }

        return { season: season.toString(), weeklyStats, totals }
      })

      const allSeasonData = await Promise.all(seasonPromises)

      // Filter out empty seasons
      allSeasonData.forEach(data => {
        if (data.weeklyStats.length > 0) {
          seasonData.push(data)
        }
      })

      // Fetch historical dynasty values
      let historicalValues: { date: string; value: number }[] = []
      try {
        const playerFullName = `${player.first_name} ${player.last_name}`
        const histRes = await fetch(`/api/historical-values?player=${encodeURIComponent(playerFullName)}`)
        if (histRes.ok) {
          const histData = await histRes.json()
          historicalValues = histData.history || []
        }
      } catch {
        // Ignore historical values errors
      }

      const cachedData: CachedPlayerData = {
        seasonData,
        historicalValues,
        timestamp: Date.now(),
      }

      playerDataCache.set(playerId, cachedData)
      return cachedData
    } finally {
      preloadingPlayers.delete(playerId)
    }
  }, [currentSeasonNum])

  // Preload player data in background (doesn't set state)
  const preloadPlayer = useCallback((player: SleeperPlayer) => {
    // Don't preload if already cached or currently preloading
    const cached = playerDataCache.get(player.player_id)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return
    if (preloadingPlayers.has(player.player_id)) return

    // Fetch in background
    fetchPlayerData(player).catch(() => {
      // Ignore preload errors
    })
  }, [fetchPlayerData])

  // Preload roster players in background when component mounts
  useEffect(() => {
    // Get all unique rostered player IDs
    const rosteredPlayerIds = new Set<string>()
    rosters.forEach(roster => {
      roster.players?.forEach(playerId => {
        if (allPlayers[playerId]) {
          rosteredPlayerIds.add(playerId)
        }
      })
    })

    // Preload players in batches to avoid overwhelming the API
    const playerIds = Array.from(rosteredPlayerIds)
    let currentIndex = 0
    const batchSize = 3 // Preload 3 players at a time
    const batchDelay = 500 // 500ms between batches

    const preloadBatch = () => {
      const batch = playerIds.slice(currentIndex, currentIndex + batchSize)
      batch.forEach(playerId => {
        const player = allPlayers[playerId]
        if (player) {
          preloadPlayer(player)
        }
      })
      currentIndex += batchSize

      if (currentIndex < playerIds.length) {
        setTimeout(preloadBatch, batchDelay)
      }
    }

    // Start preloading after a short delay to let the UI render first
    const timeoutId = setTimeout(preloadBatch, 1000)

    return () => clearTimeout(timeoutId)
  }, [rosters, allPlayers, preloadPlayer])

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB': return 'bg-red-600'
      case 'RB': return 'bg-green-600'
      case 'WR': return 'bg-blue-600'
      case 'TE': return 'bg-orange-600'
      default: return 'bg-gray-600'
    }
  }

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return s[(v - 20) % 10] || s[v] || s[0]
  }

  // Check scroll position and update arrow visibility
  const checkScrollPosition = useCallback(() => {
    const container = statsScrollRef.current
    if (!container) return

    setCanScrollLeft(container.scrollLeft > 0)
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1)
  }, [])

  // Scroll the stats container
  const scrollStats = (direction: 'left' | 'right') => {
    const container = statsScrollRef.current
    if (!container) return

    const scrollAmount = 200
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  // Update scroll indicators when stats change
  useEffect(() => {
    checkScrollPosition()
    const container = statsScrollRef.current
    if (container) {
      container.addEventListener('scroll', checkScrollPosition)
      window.addEventListener('resize', checkScrollPosition)
      return () => {
        container.removeEventListener('scroll', checkScrollPosition)
        window.removeEventListener('resize', checkScrollPosition)
      }
    }
  }, [selectedPlayer, checkScrollPosition])

  // Get relevant stats for player's position with trends (all historical data)
  const relevantStats = useMemo(() => {
    if (!selectedPlayer || !selectedPlayer.seasonData[0]) return []

    const currentSeasonData = selectedPlayer.seasonData[0]

    return Object.entries(STAT_CONFIG)
      .filter(([key, config]) => {
        if (!config.positions.includes(selectedPlayer.position)) return false
        // Check if stat exists in any season
        return selectedPlayer.seasonData.some(s => s.totals[key] !== undefined && s.totals[key] !== 0)
      })
      .map(([key, config]) => {
        // Get all historical weekly data for this stat
        const allWeeklyData: { x: string; y: number; team?: string }[] = []
        const seasonsOldestFirst = [...selectedPlayer.seasonData].reverse()

        seasonsOldestFirst.forEach(season => {
          season.weeklyStats.forEach(w => {
            allWeeklyData.push({
              x: `'${season.season.slice(-2)} W${w.week}`,
              y: w.stats[key] || 0,
              team: w.team,
            })
          })
        })

        // Calculate career total (or career average for snap_share)
        let careerTotal: number
        if (key === 'snap_share') {
          // For snap share, calculate overall average across all weeks
          const allValues = allWeeklyData.filter(d => d.y > 0).map(d => d.y)
          careerTotal = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0
        } else {
          careerTotal = selectedPlayer.seasonData.reduce(
            (sum, season) => sum + (season.totals[key] || 0),
            0
          )
        }

        return {
          key,
          ...config,
          value: currentSeasonData.totals[key] || 0,
          careerTotal,
          weeklyData: allWeeklyData,
          isAverage: key === 'snap_share', // Flag for display purposes
        }
      })
  }, [selectedPlayer])

  // Get all weekly fantasy points across all seasons (main chart)
  const allWeeklyFantasyPoints = useMemo(() => {
    if (!selectedPlayer || !selectedPlayer.seasonData.length) return []

    // Combine all seasons, oldest first
    const allWeeks: { x: string; y: number; season: string; week: number; team?: string; snapShare?: number; inactive?: boolean }[] = []

    // Reverse to get oldest season first
    const seasonsOldestFirst = [...selectedPlayer.seasonData].reverse()

    seasonsOldestFirst.forEach(season => {
      // NFL has 18 weeks since 2021, 17 weeks before (each team plays 16/17 games with a bye)
      const seasonYear = parseInt(season.season)
      const totalWeeks = seasonYear >= 2021 ? 18 : 17

      // Create a map of existing weekly stats
      const weekMap = new Map(season.weeklyStats.map(w => [w.week, w]))

      // Fill in all weeks
      for (let week = 1; week <= totalWeeks; week++) {
        const existingWeek = weekMap.get(week)
        if (existingWeek) {
          allWeeks.push({
            x: `'${season.season.slice(-2)} W${week}`,
            y: existingWeek.stats.pts_half_ppr || 0,
            season: season.season,
            week,
            team: existingWeek.team,
            snapShare: existingWeek.stats.snap_share,
          })
        } else {
          // Player was inactive this week (bye, injury, not on roster, etc.)
          allWeeks.push({
            x: `'${season.season.slice(-2)} W${week}`,
            y: 0,
            season: season.season,
            week,
            team: undefined,
            snapShare: undefined,
            inactive: true,
          })
        }
      }
    })

    return allWeeks
  }, [selectedPlayer])

  // Filter data based on chart preset
  const filteredChartData = useMemo(() => {
    if (chartPreset === 'career') return allWeeklyFantasyPoints
    return allWeeklyFantasyPoints.filter(w => w.season === chartPreset)
  }, [allWeeklyFantasyPoints, chartPreset])

  // Get available seasons for presets
  const availableSeasons = useMemo(() => {
    if (!selectedPlayer) return []
    return selectedPlayer.seasonData.map(s => s.season)
  }, [selectedPlayer])

  return (
    <div className="space-y-6">
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
                onMouseEnter={() => preloadPlayer(player)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-sleeper-accent/50 transition-colors border-b border-sleeper-accent last:border-b-0"
              >
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getPositionColor(player.position)}`}>
                  {player.position}
                </span>
                <div className="flex-1">
                  <span className="font-medium">{player.first_name} {player.last_name}</span>
                  <span className="text-gray-500 ml-2">{player.team || 'FA'}</span>
                </div>
                {player.ownerName && player.rosterId && (
                  <Link
                    href={`/league/${leagueId}/team/${player.rosterId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-gray-400 hover:text-sleeper-highlight transition-colors"
                  >
                    {player.ownerName}
                  </Link>
                )}
                <span className="text-green-400 text-sm">{player.value.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading Stats */}
      {loadingStats && (
        <div className="space-y-6">
          <SkeletonCard />
          <SkeletonChart />
          <SkeletonCard />
        </div>
      )}

      {/* Selected Player */}
      {selectedPlayer && !loadingStats && (
        <div className="space-y-6">
          {/* Player Header */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
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
                {selectedPlayer.ownerName && selectedPlayer.rosterId && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500">Owned by:</span>{' '}
                    <Link
                      href={`/league/${leagueId}/team/${selectedPlayer.rosterId}`}
                      className="text-amber-500 hover:underline transition-colors"
                    >
                      {selectedPlayer.ownerName}
                    </Link>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-emerald-500">
                  {selectedPlayer.value.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Dynasty Value</div>
                {(() => {
                  const ranks = getPlayerRanks(selectedPlayer.player_id, selectedPlayer.position)
                  return ranks.overallRank > 0 ? (
                    <div className="text-gray-500 text-xs mt-1 space-y-0.5">
                      <div>{ranks.positionRank}{getOrdinalSuffix(ranks.positionRank)} of {ranks.positionTotal} {selectedPlayer.position}s</div>
                      <div>{ranks.overallRank}{getOrdinalSuffix(ranks.overallRank)} of {ranks.overallTotal} overall</div>
                    </div>
                  ) : null
                })()}
              </div>
            </div>
          </div>

          {/* Stat Selector Bar - Excel-style column headers */}
          <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
            {/* Stat Tabs - Scrollable with arrows */}
            <div className="relative border-b border-sleeper-accent">
              {/* Left scroll arrow */}
              {canScrollLeft && (
                <button
                  onClick={() => scrollStats('left')}
                  className="absolute left-0 top-0 bottom-0 z-10 px-2 bg-gradient-to-r from-sleeper-primary via-sleeper-primary to-transparent hover:from-gray-700 transition-colors flex items-center"
                  aria-label="Scroll left"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Right scroll arrow */}
              {canScrollRight && (
                <button
                  onClick={() => scrollStats('right')}
                  className="absolute right-0 top-0 bottom-0 z-10 px-2 bg-gradient-to-l from-sleeper-primary via-sleeper-primary to-transparent hover:from-gray-700 transition-colors flex items-center"
                  aria-label="Scroll right"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              <div ref={statsScrollRef} className="flex overflow-x-auto scrollbar-hide">
              {/* Dynasty Value - special tab */}
              <button
                onClick={() => setExpandedStat('dynasty_value')}
                className={`px-3 py-2 text-xs font-medium border-r border-sleeper-accent transition-colors flex-1 min-w-[70px] ${
                  expandedStat === 'dynasty_value'
                    ? 'bg-sleeper-highlight text-white'
                    : 'text-gray-400 hover:bg-sleeper-accent hover:text-white'
                }`}
              >
                <div className="text-center">
                  <div className="truncate">Value</div>
                  <div className="font-bold text-sm">{selectedPlayer?.value.toLocaleString()}</div>
                </div>
              </button>

              {/* Fantasy Points - special tab */}
              <button
                onClick={() => setExpandedStat('pts_half_ppr')}
                className={`px-3 py-2 text-xs font-medium border-r border-sleeper-accent transition-colors flex-1 min-w-[70px] ${
                  expandedStat === 'pts_half_ppr'
                    ? 'bg-sleeper-highlight text-white'
                    : 'text-gray-400 hover:bg-sleeper-accent hover:text-white'
                }`}
              >
                <div className="text-center">
                  <div className="truncate">Pts</div>
                  <div className="font-bold text-sm">
                    {(selectedPlayer?.seasonData[0]?.totals.pts_half_ppr || 0).toFixed(1)}
                  </div>
                </div>
              </button>

              {/* Other stats */}
              {relevantStats.filter(s => s.key !== 'pts_half_ppr').map((stat) => (
                <button
                  key={stat.key}
                  onClick={() => setExpandedStat(stat.key)}
                  className={`px-3 py-2 text-xs font-medium border-r border-sleeper-accent last:border-r-0 transition-colors flex-1 min-w-[70px] ${
                    expandedStat === stat.key
                      ? 'bg-sleeper-highlight text-white'
                      : 'text-gray-400 hover:bg-sleeper-accent hover:text-white'
                  }`}
                >
                  <div className="text-center">
                    <div className="truncate">{stat.label.replace('Passing ', '').replace('Rushing ', 'Rush ').replace('Receiving ', 'Rec ')}</div>
                    <div className="font-bold text-sm">{stat.format(stat.value)}</div>
                  </div>
                </button>
              ))}
              </div>
            </div>

            {/* Chart Content */}
            <div className="p-6">
              {/* Dynasty Value Chart */}
              {expandedStat === 'dynasty_value' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Dynasty Value</h3>
                      <p className="text-sm text-gray-400">
                        {historicalValues.length > 0
                          ? `${historicalValues.length} days of historical data`
                          : 'Current value from KeepTradeCut'}
                      </p>
                    </div>
                    <div className="text-3xl font-bold text-green-400">
                      {selectedPlayer?.value.toLocaleString()}
                    </div>
                  </div>
                  {loadingHistorical ? (
                    <div className="bg-sleeper-accent/30 rounded-lg p-4">
                      <div className="flex items-end gap-2 h-48">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <Skeleton
                            key={i}
                            className="flex-1"
                            style={{ height: `${30 + Math.random() * 60}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : historicalValues.length > 0 ? (
                    <>
                      <LineChart
                        data={historicalValues.map(h => {
                          const [year, month] = h.date.split('-')
                          return {
                            x: `${month}-${year.slice(2)}`, // Show MM-YY
                            y: h.value
                          }
                        })}
                        label="DynastyValue"
                        format={(v) => v.toLocaleString()}
                        height={300}
                        color="#a855f7"
                      />
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                        <div className="bg-sleeper-accent/30 rounded p-2">
                          <div className="text-gray-400">Current</div>
                          <div className="font-bold text-green-400">
                            {selectedPlayer?.value.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-sleeper-accent/30 rounded p-2">
                          <div className="text-gray-400">Highest</div>
                          <div className="font-bold text-yellow-400">
                            {Math.max(...historicalValues.map(h => h.value)).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-sleeper-accent/30 rounded p-2">
                          <div className="text-gray-400">Lowest</div>
                          <div className="font-bold text-red-400">
                            {Math.min(...historicalValues.map(h => h.value)).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-sleeper-accent/30 rounded p-2">
                          <div className="text-gray-400">Change</div>
                          <div className={`font-bold ${
                            historicalValues.length > 1 && historicalValues[historicalValues.length - 1].value > historicalValues[0].value
                              ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {historicalValues.length > 1
                              ? `${historicalValues[historicalValues.length - 1].value > historicalValues[0].value ? '+' : ''}${(historicalValues[historicalValues.length - 1].value - historicalValues[0].value).toLocaleString()}`
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-sleeper-accent/30 rounded-lg p-8 text-center text-gray-400">
                      <p>No historical data available for this player.</p>
                      <p className="text-sm mt-2">Value shown is the current KeepTradeCut dynasty value.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Fantasy Points Chart */}
              {expandedStat === 'pts_half_ppr' && allWeeklyFantasyPoints.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Fantasy Points (Half PPR)</h3>
                      <p className="text-sm text-gray-400">
                        {selectedPlayer?.seasonData.length} season{selectedPlayer?.seasonData.length !== 1 ? 's' : ''} of data
                      </p>
                    </div>
                    {/* Team Legend */}
                    {(() => {
                      const teams: string[] = []
                      allWeeklyFantasyPoints.forEach(d => {
                        if (d.team && !teams.includes(d.team)) teams.push(d.team)
                      })
                      return teams.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {teams.map(team => (
                            <div key={team} className="flex items-center gap-1.5">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: NFL_TEAM_COLORS[team] || '#6B7280' }}
                              />
                              <span className="text-sm text-gray-400">{team}</span>
                            </div>
                          ))}
                        </div>
                      ) : null
                    })()}
                  </div>
                  <div className="bg-gray-950 rounded-lg p-3 border border-gray-800">
                    <LineChart
                    data={filteredChartData}
                    label="FantasyPts"
                    format={(v) => v.toFixed(1)}
                    height={300}
                    color="#00ceb8"
                    showTeamColors={true}
                    hideTrend={true}
                    position={selectedPlayer.position}
                  />
                  </div>
                  {/* Chart Presets */}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button
                      onClick={() => setChartPreset('career')}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        chartPreset === 'career'
                          ? 'bg-amber-500 text-black'
                          : 'bg-sleeper-accent text-gray-400 hover:text-white'
                      }`}
                    >
                      Career
                    </button>
                    {availableSeasons.map(season => (
                      <button
                        key={season}
                        onClick={() => setChartPreset(season)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          chartPreset === season
                            ? 'bg-amber-500 text-black'
                            : 'bg-sleeper-accent text-gray-400 hover:text-white'
                        }`}
                      >
                        {season}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-center text-sm">
                    <div className="bg-sleeper-accent/30 rounded p-2">
                      <div className="text-gray-400">{chartPreset === 'career' ? 'Career Total' : 'Total'}</div>
                      <div className="font-bold text-green-400">
                        {filteredChartData.reduce((sum, w) => sum + w.y, 0).toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-sleeper-accent/30 rounded p-2">
                      <div className="text-gray-400 flex items-center justify-center gap-1">
                        Games
                        <span
                          className="inline-flex items-center justify-center w-4 h-4 text-xs rounded-full bg-gray-600 text-gray-300 cursor-help"
                          title="Games played out of total weeks. Zeros on the chart may be bye weeks, injuries, or games where the player was inactive."
                        >?</span>
                      </div>
                      <div className="font-bold">{filteredChartData.filter(w => {
                        if (w.inactive) return false
                        if (selectedPlayer.position === 'QB') return w.y > 0
                        // Exclude only if BOTH snap share < 10% AND points = 0
                        if (w.snapShare !== undefined && w.snapShare < 10 && w.y === 0) return false
                        if (w.snapShare === undefined && w.y === 0) return false
                        return true
                      }).length} out of {filteredChartData.length}</div>
                    </div>
                    <div className="bg-sleeper-accent/30 rounded p-2">
                      <div className="text-gray-400">Avg/Game</div>
                      <div className="font-bold">
                        {(filteredChartData.filter(w => w.y > 0).reduce((sum, w) => sum + w.y, 0) /
                          Math.max(filteredChartData.filter(w => w.y > 0).length, 1)).toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-sleeper-accent/30 rounded p-2">
                      <div className="text-gray-400">Best Week</div>
                      <div className="font-bold text-yellow-400">
                        {filteredChartData.length > 0 ? Math.max(...filteredChartData.map(w => w.y)).toFixed(1) : '0.0'}
                      </div>
                    </div>
                    {(() => {
                      const nonZero = filteredChartData.filter(w => {
                        if (w.inactive) return false
                        if (selectedPlayer.position === 'QB') return w.y > 0
                        // Exclude only if BOTH snap share < 10% AND points = 0
                        if (w.snapShare !== undefined && w.snapShare < 10 && w.y === 0) return false
                        if (w.snapShare === undefined && w.y === 0) return false
                        return true
                      }).map((w, i) => ({ index: i, value: w.y }))
                      if (nonZero.length < 5) return null
                      const n = nonZero.length
                      const sumX = nonZero.reduce((s, d) => s + d.index, 0)
                      const sumY = nonZero.reduce((s, d) => s + d.value, 0)
                      const sumXY = nonZero.reduce((s, d) => s + d.index * d.value, 0)
                      const sumX2 = nonZero.reduce((s, d) => s + d.index * d.index, 0)
                      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
                      const trendColor = slope > 0.01 ? 'text-green-400' : slope < -0.01 ? 'text-red-400' : 'text-yellow-400'
                      return (
                        <div className="bg-sleeper-accent/30 rounded p-2">
                          <div className="text-gray-400 flex items-center justify-center gap-1">
                            Trend
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 text-xs rounded-full bg-gray-600 text-gray-300 cursor-help"
                              title={selectedPlayer.position === 'QB' ? 'Points change per 10 games (excludes zero-point games)' : 'Points change per 10 games (excludes games with <10% snap share and 0 points)'}
                            >?</span>
                          </div>
                          <div className={`font-bold ${trendColor}`}>
                            {slope > 0 ? '+' : ''}{(slope * 10).toFixed(2)} per 10 wks
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Other Stat Charts */}
              {expandedStat && expandedStat !== 'dynasty_value' && expandedStat !== 'pts_half_ppr' && relevantStats.find(s => s.key === expandedStat) && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{STAT_CONFIG[expandedStat]?.label}</h3>
                      <p className="text-sm text-gray-400">
                        {selectedPlayer?.seasonData.length} season{selectedPlayer?.seasonData.length !== 1 ? 's' : ''} of data
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-950 rounded-lg p-3 border border-gray-800">
                    <LineChart
                      data={relevantStats.find(s => s.key === expandedStat)!.weeklyData}
                      label={expandedStat}
                      format={STAT_CONFIG[expandedStat]?.format || ((v) => v.toFixed(1))}
                      height={300}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
                    {(() => {
                      const statData = relevantStats.find(s => s.key === expandedStat)!
                      const isSnapShare = expandedStat === 'snap_share'
                      return (
                        <>
                          <div className="bg-sleeper-accent/30 rounded p-2">
                            <div className="text-gray-400">{isSnapShare ? 'Career Avg' : 'Career Total'}</div>
                            <div className="font-bold text-green-400">
                              {STAT_CONFIG[expandedStat]?.format(statData.careerTotal)}
                            </div>
                          </div>
                          <div className="bg-sleeper-accent/30 rounded p-2">
                            <div className="text-gray-400">Games</div>
                            <div className="font-bold">
                              {statData.weeklyData.filter(d => d.y > 0).length}
                            </div>
                          </div>
                          {!isSnapShare && (
                            <div className="bg-sleeper-accent/30 rounded p-2">
                              <div className="text-gray-400">Avg/Game</div>
                              <div className="font-bold">
                                {(() => {
                                  const nonZero = statData.weeklyData.filter(d => d.y > 0)
                                  return STAT_CONFIG[expandedStat]?.format(
                                    nonZero.length > 0 ? nonZero.reduce((sum, d) => sum + d.y, 0) / nonZero.length : 0
                                  )
                                })()}
                              </div>
                            </div>
                          )}
                          <div className="bg-sleeper-accent/30 rounded p-2">
                            <div className="text-gray-400">{isSnapShare ? 'Peak' : 'Best Week'}</div>
                            <div className="font-bold text-yellow-400">
                              {STAT_CONFIG[expandedStat]?.format(
                                Math.max(...statData.weeklyData.map(d => d.y))
                              )}
                            </div>
                          </div>
                          {isSnapShare && (
                            <div className="bg-sleeper-accent/30 rounded p-2">
                              <div className="text-gray-400">Low</div>
                              <div className="font-bold text-red-400">
                                {STAT_CONFIG[expandedStat]?.format(
                                  Math.min(...statData.weeklyData.filter(d => d.y > 0).map(d => d.y))
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* No stat selected */}
              {!expandedStat && (
                <div className="text-center text-gray-400 py-8">
                  Click a stat above to view the chart
                </div>
              )}
            </div>
          </div>

          {/* Historical Seasons Comparison */}
          {selectedPlayer.seasonData.length > 1 && (
            <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent">
              <h3 className="text-lg font-semibold mb-4">Season by Season Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-sleeper-accent">
                      <th className="text-left py-2 px-3 text-gray-400">Season</th>
                      <th className="text-right py-2 px-3 text-gray-400">Games</th>
                      <th className="text-right py-2 px-3 text-gray-400">Fantasy Pts</th>
                      <th className="text-right py-2 px-3 text-gray-400">PPG</th>
                      {selectedPlayer.position === 'QB' && (
                        <>
                          <th className="text-right py-2 px-3 text-gray-400">Pass Yds</th>
                          <th className="text-right py-2 px-3 text-gray-400">Pass TD</th>
                        </>
                      )}
                      {['RB', 'WR', 'TE'].includes(selectedPlayer.position) && (
                        <>
                          <th className="text-right py-2 px-3 text-gray-400">Rec</th>
                          <th className="text-right py-2 px-3 text-gray-400">Rec Yds</th>
                          <th className="text-right py-2 px-3 text-gray-400">Rec TD</th>
                        </>
                      )}
                      {['QB', 'RB'].includes(selectedPlayer.position) && (
                        <>
                          <th className="text-right py-2 px-3 text-gray-400">Rush Yds</th>
                          <th className="text-right py-2 px-3 text-gray-400">Rush TD</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlayer.seasonData.map((season, idx) => {
                      const games = season.weeklyStats.filter(w => (w.stats.pts_half_ppr || 0) > 0).length
                      const pts = season.totals.pts_half_ppr || 0
                      const ppg = games > 0 ? pts / games : 0

                      return (
                        <tr key={season.season} className={`border-b border-sleeper-accent/50 ${idx === 0 ? 'bg-sleeper-accent/20' : ''}`}>
                          <td className="py-2 px-3 font-medium">{season.season}</td>
                          <td className="text-right py-2 px-3">{games}</td>
                          <td className="text-right py-2 px-3">{pts.toFixed(1)}</td>
                          <td className="text-right py-2 px-3 text-green-400 font-medium">{ppg.toFixed(1)}</td>
                          {selectedPlayer.position === 'QB' && (
                            <>
                              <td className="text-right py-2 px-3">{(season.totals.pass_yd || 0).toFixed(0)}</td>
                              <td className="text-right py-2 px-3">{(season.totals.pass_td || 0).toFixed(0)}</td>
                            </>
                          )}
                          {['RB', 'WR', 'TE'].includes(selectedPlayer.position) && (
                            <>
                              <td className="text-right py-2 px-3">{(season.totals.rec || 0).toFixed(0)}</td>
                              <td className="text-right py-2 px-3">{(season.totals.rec_yd || 0).toFixed(0)}</td>
                              <td className="text-right py-2 px-3">{(season.totals.rec_td || 0).toFixed(0)}</td>
                            </>
                          )}
                          {['QB', 'RB'].includes(selectedPlayer.position) && (
                            <>
                              <td className="text-right py-2 px-3">{(season.totals.rush_yd || 0).toFixed(0)}</td>
                              <td className="text-right py-2 px-3">{(season.totals.rush_td || 0).toFixed(0)}</td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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

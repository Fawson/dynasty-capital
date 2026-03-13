import { NextRequest, NextResponse } from 'next/server'

// Server-side cache for weekly stats (shared across all player lookups)
// Key: "season-week", Value: full stats for ALL players that week
const weeklyStatsCache = new Map<string, { data: Record<string, Record<string, number>>; timestamp: number }>()
const WEEKLY_CACHE_DURATION = 1000 * 60 * 60 * 4 // 4 hours
const MAX_WEEKLY_CACHE_SIZE = 150 // ~6 seasons × 18 weeks + headroom

// Cache for assembled player results
const playerResultCache = new Map<string, { data: PlayerStatsResponse; timestamp: number }>()
const PLAYER_CACHE_DURATION = 1000 * 60 * 30 // 30 minutes
const MAX_PLAYER_CACHE_SIZE = 100

interface WeeklyStats {
  week: number
  stats: Record<string, number | undefined>
  team: string
}

interface SeasonStats {
  season: string
  weeklyStats: WeeklyStats[]
  totals: Record<string, number | undefined>
}

interface PlayerStatsResponse {
  seasonData: SeasonStats[]
  teamHistory: Record<string, string>
  historicalValues: { date: string; value: number }[]
}

function evictOldest(map: Map<string, { timestamp: number } & Record<string, unknown>>, maxSize: number) {
  if (map.size >= maxSize) {
    const oldestKey = map.keys().next().value
    if (oldestKey) map.delete(oldestKey)
  }
}

// Fetch a single week's stats with server-side caching
async function getWeekStats(season: number, week: number): Promise<Record<string, Record<string, number>>> {
  const cacheKey = `${season}-${week}`
  const cached = weeklyStatsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < WEEKLY_CACHE_DURATION) {
    return cached.data
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(
      `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`,
      { signal: controller.signal, next: { revalidate: 3600 } }
    )
    clearTimeout(timeoutId)

    if (!res.ok) return {}

    const data = await res.json()

    // Cache the full response (used for ALL player lookups)
    evictOldest(weeklyStatsCache as Map<string, { timestamp: number } & Record<string, unknown>>, MAX_WEEKLY_CACHE_SIZE)
    weeklyStatsCache.set(cacheKey, { data, timestamp: Date.now() })

    return data
  } catch {
    return {}
  }
}

// Fetch ESPN team history
async function getTeamHistory(espnId: string): Promise<Record<string, string>> {
  try {
    const now = new Date()
    const currentMonth = now.getMonth()
    const calendarYear = now.getFullYear()
    const currentNFLSeason = currentMonth < 8 ? calendarYear - 1 : calendarYear
    const seasons = Array.from({ length: 6 }, (_, i) => currentNFLSeason - i)

    const teamHistory: Record<string, string> = {}

    const seasonPromises = seasons.map(async (season) => {
      try {
        const gamelogRes = await fetch(
          `https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/gamelog?season=${season}`,
          { next: { revalidate: 86400 } }
        )
        if (!gamelogRes.ok) return

        const gamelog = await gamelogRes.json()

        let events: { eventId: string }[] = []
        let displayTeam: string | null = null

        const seasonTypes = gamelog?.seasonTypes || []
        for (const seasonType of seasonTypes) {
          if (seasonType.displayTeam) displayTeam = seasonType.displayTeam
          const categories = seasonType?.categories || []
          for (const category of categories) {
            if (category.splitType === "2" || category.displayName?.includes("Regular")) {
              events = category.events || []
              break
            }
          }
          if (events.length > 0) break
        }

        if (events.length === 0 && seasonTypes.length > 0) {
          events = seasonTypes[0]?.categories?.[0]?.events || []
        }

        const gamePromises = events.map(async (event: { eventId: string }) => {
          try {
            const gameRes = await fetch(
              `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${event.eventId}`,
              { next: { revalidate: 86400 } }
            )
            if (!gameRes.ok) return null

            const game = await gameRes.json()
            const week = game?.header?.week
            const homeTeam = game?.boxscore?.teams?.[0]?.team?.abbreviation
            const awayTeam = game?.boxscore?.teams?.[1]?.team?.abbreviation
            if (!week || !homeTeam || !awayTeam) return null

            const homeStats = game?.boxscore?.players?.[0]?.statistics || []
            const awayStats = game?.boxscore?.players?.[1]?.statistics || []

            let playerTeam: string | null = null

            outerHome: for (const stat of homeStats) {
              for (const athlete of (stat?.athletes || [])) {
                if (athlete?.athlete?.id === espnId) { playerTeam = homeTeam; break outerHome }
              }
            }
            if (!playerTeam) {
              outerAway: for (const stat of awayStats) {
                for (const athlete of (stat?.athletes || [])) {
                  if (athlete?.athlete?.id === espnId) { playerTeam = awayTeam; break outerAway }
                }
              }
            }
            if (!playerTeam && displayTeam) playerTeam = displayTeam

            return playerTeam && week ? { season, week, team: playerTeam } : null
          } catch { return null }
        })

        const results = await Promise.all(gamePromises)
        results.forEach(r => { if (r) teamHistory[`${r.season}-${r.week}`] = r.team })
      } catch {
        // Skip season
      }
    })

    await Promise.all(seasonPromises)
    return teamHistory
  } catch {
    return {}
  }
}

// Fetch historical dynasty values
async function getHistoricalValues(playerName: string, baseUrl: string): Promise<{ date: string; value: number }[]> {
  try {
    const res = await fetch(`${baseUrl}/api/historical-values?player=${encodeURIComponent(playerName)}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.history || []
  } catch {
    return []
  }
}

// Get current NFL week
function getCurrentWeek(season: number): number {
  const seasonStart = new Date(`${season}-09-05`)
  const now = new Date()
  const diffTime = now.getTime() - seasonStart.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const week = Math.floor(diffDays / 7) + 1
  return Math.min(Math.max(week, 1), 18)
}

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get('playerId')
  const playerName = request.nextUrl.searchParams.get('playerName')
  const espnId = request.nextUrl.searchParams.get('espnId')
  const playerTeam = request.nextUrl.searchParams.get('team')

  if (!playerId) {
    return NextResponse.json({ error: 'playerId required' }, { status: 400 })
  }

  // Check assembled player cache
  const cached = playerResultCache.get(playerId)
  if (cached && Date.now() - cached.timestamp < PLAYER_CACHE_DURATION) {
    return NextResponse.json(cached.data, {
      headers: { 'X-Cache': 'HIT' },
    })
  }

  const now = new Date()
  const currentMonth = now.getMonth()
  const calendarYear = now.getFullYear()
  const currentNFLSeason = currentMonth < 8 ? calendarYear - 1 : calendarYear
  const seasons = Array.from({ length: 6 }, (_, i) => currentNFLSeason - i)

  // Construct base URL for internal API calls
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  // Run ALL three data sources in parallel
  const [teamHistory, historicalValues, ...seasonResults] = await Promise.all([
    // 1. ESPN team history (if espnId provided)
    espnId ? getTeamHistory(espnId) : Promise.resolve({} as Record<string, string>),

    // 2. Historical dynasty values (if name provided)
    playerName ? getHistoricalValues(playerName, baseUrl) : Promise.resolve([]),

    // 3. All season stats in parallel
    ...seasons.map(async (season): Promise<SeasonStats> => {
      const weeksToFetch = season === currentNFLSeason ? getCurrentWeek(currentNFLSeason) : 18
      const weekNumbers = Array.from({ length: weeksToFetch }, (_, i) => i + 1)

      // Fetch all weeks for this season in parallel (server caches full responses)
      const weekDataArray = await Promise.all(
        weekNumbers.map(async (week) => {
          const allPlayerStats = await getWeekStats(season, week)
          return { week, stats: allPlayerStats[playerId] || null }
        })
      )

      const weeklyStats: WeeklyStats[] = []
      const totals: Record<string, number | undefined> = {}
      let snapShareSum = 0
      let snapShareCount = 0

      weekDataArray.forEach(({ week, stats }) => {
        if (!stats) return

        const processedStats: Record<string, number | undefined> = { ...stats }

        // Compute snap share percentage
        const offSnp = stats.off_snp
        const tmOffSnp = stats.tm_off_snp
        if (offSnp && tmOffSnp && tmOffSnp > 0) {
          processedStats.snap_share = (offSnp / tmOffSnp) * 100
        }

        weeklyStats.push({
          week,
          stats: processedStats,
          team: '', // Will be filled from teamHistory
        })

        // Accumulate totals
        Object.entries(processedStats).forEach(([key, value]) => {
          if (typeof value === 'number') {
            if (key === 'snap_share') {
              snapShareSum += value
              snapShareCount++
            } else {
              totals[key] = ((totals[key] as number) || 0) + value
            }
          }
        })
      })

      if (snapShareCount > 0) {
        totals.snap_share = snapShareSum / snapShareCount
      }

      weeklyStats.sort((a, b) => a.week - b.week)

      return { season: season.toString(), weeklyStats, totals }
    })
  ])

  // Apply team history to weekly stats
  const seasonData: SeasonStats[] = []
  const fallbackTeam = playerTeam || 'FA'

  seasonResults.forEach((season) => {
    if (season.weeklyStats.length === 0) return

    // Apply team from ESPN history
    season.weeklyStats.forEach(ws => {
      ws.team = teamHistory[`${season.season}-${ws.week}`] || ''
    })

    // Fill gaps from nearby weeks
    let lastKnownTeam = ''
    season.weeklyStats.forEach(ws => {
      if (ws.team) lastKnownTeam = ws.team
      else if (lastKnownTeam) ws.team = lastKnownTeam
    })
    lastKnownTeam = ''
    for (let i = season.weeklyStats.length - 1; i >= 0; i--) {
      if (season.weeklyStats[i].team) lastKnownTeam = season.weeklyStats[i].team
      else if (lastKnownTeam) season.weeklyStats[i].team = lastKnownTeam
    }
    season.weeklyStats.forEach(ws => { if (!ws.team) ws.team = fallbackTeam })

    seasonData.push(season)
  })

  const response: PlayerStatsResponse = {
    seasonData,
    teamHistory,
    historicalValues,
  }

  // Cache the assembled result
  evictOldest(playerResultCache as Map<string, { timestamp: number } & Record<string, unknown>>, MAX_PLAYER_CACHE_SIZE)
  playerResultCache.set(playerId, { data: response, timestamp: Date.now() })

  return NextResponse.json(response)
}

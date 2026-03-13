import { NextRequest, NextResponse } from 'next/server'

// Bounded cache for team history to avoid unbounded memory growth
const MAX_CACHE_SIZE = 200
const teamHistoryCache = new Map<string, { data: Record<string, string>; timestamp: number }>()
const CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 hours

function setCacheEntry(key: string, data: Record<string, string>) {
  // Evict oldest entries if cache is full
  if (teamHistoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = teamHistoryCache.keys().next().value
    if (oldestKey) teamHistoryCache.delete(oldestKey)
  }
  teamHistoryCache.set(key, { data, timestamp: Date.now() })
}

export async function GET(request: NextRequest) {
  const espnId = request.nextUrl.searchParams.get('espnId')

  if (!espnId) {
    return NextResponse.json({ error: 'ESPN ID required' }, { status: 400 })
  }

  // Check cache
  const cached = teamHistoryCache.get(espnId)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({ teamHistory: cached.data })
  }

  try {
    // Map of season-week to team abbreviation
    const teamHistory: Record<string, string> = {}

    // Fetch last 6 seasons to match stats data
    const now = new Date()
    const currentMonth = now.getMonth()
    const calendarYear = now.getFullYear()
    const currentNFLSeason = currentMonth < 8 ? calendarYear - 1 : calendarYear
    const seasons = Array.from({ length: 6 }, (_, i) => currentNFLSeason - i)

    // Process all seasons in parallel for speed
    const seasonPromises = seasons.map(async (season) => {
      const seasonResults: { season: number; week: number; team: string }[] = []

      try {
        const gamelogRes = await fetch(
          `https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/gamelog?season=${season}`,
          { next: { revalidate: 86400 } }
        )

        if (!gamelogRes.ok) return seasonResults

        const gamelog = await gamelogRes.json()

        let events: { eventId: string }[] = []
        let displayTeam: string | null = null

        const seasonTypes = gamelog?.seasonTypes || []
        for (const seasonType of seasonTypes) {
          if (seasonType.displayTeam) {
            displayTeam = seasonType.displayTeam
          }
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

        // Fetch all game details in parallel
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
              const athletes = stat?.athletes || []
              for (const athlete of athletes) {
                if (athlete?.athlete?.id === espnId) {
                  playerTeam = homeTeam
                  break outerHome
                }
              }
            }

            if (!playerTeam) {
              outerAway: for (const stat of awayStats) {
                const athletes = stat?.athletes || []
                for (const athlete of athletes) {
                  if (athlete?.athlete?.id === espnId) {
                    playerTeam = awayTeam
                    break outerAway
                  }
                }
              }
            }

            if (!playerTeam && displayTeam) {
              playerTeam = displayTeam
            }

            if (playerTeam && week) {
              return { season, week, team: playerTeam }
            }
            return null
          } catch {
            return null
          }
        })

        const results = await Promise.all(gamePromises)
        results.forEach(result => {
          if (result) {
            seasonResults.push(result)
          }
        })
      } catch {
        // Return empty for this season
      }

      return seasonResults
    })

    const allSeasonResults = await Promise.all(seasonPromises)

    allSeasonResults.flat().forEach(result => {
      if (result) {
        teamHistory[`${result.season}-${result.week}`] = result.team
      }
    })

    // Cache with bounded eviction
    setCacheEntry(espnId, teamHistory)

    return NextResponse.json({ teamHistory })
  } catch (error) {
    console.error('Failed to fetch team history:', error)
    return NextResponse.json({ error: 'Failed to fetch team history' }, { status: 500 })
  }
}

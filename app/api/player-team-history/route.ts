import { NextRequest, NextResponse } from 'next/server'

// Cache for team history to avoid repeated API calls
const teamHistoryCache = new Map<string, { data: Record<string, string>; timestamp: number }>()
const CACHE_DURATION = 1000 * 60 * 60 * 24 // 24 hours

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

    // Fetch last 3 seasons
    const currentYear = new Date().getFullYear()
    const seasons = [currentYear, currentYear - 1, currentYear - 2]

    for (const season of seasons) {
      try {
        // Fetch ESPN gamelog for this season
        const gamelogRes = await fetch(
          `https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${espnId}/gamelog?season=${season}`,
          { next: { revalidate: 86400 } } // Cache for 24 hours
        )

        if (!gamelogRes.ok) continue

        const gamelog = await gamelogRes.json()
        const events = gamelog?.seasonTypes?.[0]?.categories?.[0]?.events || []

        // Fetch game details for each event to get team info
        // Process in batches of 5 to avoid rate limiting
        for (let i = 0; i < events.length; i += 5) {
          const batch = events.slice(i, i + 5)

          const gamePromises = batch.map(async (event: { eventId: string }) => {
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

              // Check which team the player was on by looking at the roster/statistics
              // The player's team is whichever team they have stats for
              const homeStats = game?.boxscore?.players?.[0]?.statistics || []
              const awayStats = game?.boxscore?.players?.[1]?.statistics || []

              // Check if player is in home team stats
              let playerTeam: string | null = null

              for (const stat of homeStats) {
                const athletes = stat?.athletes || []
                for (const athlete of athletes) {
                  if (athlete?.athlete?.id === espnId) {
                    playerTeam = homeTeam
                    break
                  }
                }
                if (playerTeam) break
              }

              // If not found in home, check away
              if (!playerTeam) {
                for (const stat of awayStats) {
                  const athletes = stat?.athletes || []
                  for (const athlete of athletes) {
                    if (athlete?.athlete?.id === espnId) {
                      playerTeam = awayTeam
                      break
                    }
                  }
                  if (playerTeam) break
                }
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
              teamHistory[`${result.season}-${result.week}`] = result.team
            }
          })

          // Small delay between batches to avoid rate limiting
          if (i + 5 < events.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
      } catch {
        // Continue to next season if this one fails
        continue
      }
    }

    // Cache the result
    teamHistoryCache.set(espnId, { data: teamHistory, timestamp: Date.now() })

    return NextResponse.json({ teamHistory })
  } catch (error) {
    console.error('Failed to fetch team history:', error)
    return NextResponse.json({ error: 'Failed to fetch team history' }, { status: 500 })
  }
}

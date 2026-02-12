import { NextResponse } from 'next/server'

// Cache the player data in memory on the server
let cachedPlayers: Record<string, unknown> | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export async function GET() {
  const now = Date.now()

  // Return cached data if still valid
  if (cachedPlayers && (now - cacheTimestamp) < CACHE_DURATION) {
    return NextResponse.json(cachedPlayers, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        'X-Cache': 'HIT',
        'X-Cache-Age': String(Math.floor((now - cacheTimestamp) / 1000)),
      },
    })
  }

  // Fetch fresh data from Sleeper
  try {
    const response = await fetch('https://api.sleeper.app/v1/players/nfl', {
      next: { revalidate: 86400 }, // 24 hours
    })

    if (!response.ok) {
      throw new Error('Failed to fetch players from Sleeper')
    }

    cachedPlayers = await response.json()
    cacheTimestamp = now

    return NextResponse.json(cachedPlayers, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    // If fetch fails but we have stale cache, return it
    if (cachedPlayers) {
      return NextResponse.json(cachedPlayers, {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
          'X-Cache': 'STALE',
        },
      })
    }

    return NextResponse.json(
      { error: 'Failed to fetch player data' },
      { status: 500 }
    )
  }
}

// POST endpoint for cron job to refresh cache
export async function POST(request: Request) {
  // Verify this is from Vercel Cron (optional security)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch('https://api.sleeper.app/v1/players/nfl')

    if (!response.ok) {
      throw new Error('Failed to fetch players from Sleeper')
    }

    cachedPlayers = await response.json()
    cacheTimestamp = Date.now()

    return NextResponse.json({
      success: true,
      message: 'Player cache refreshed',
      playerCount: Object.keys(cachedPlayers || {}).length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to refresh player cache' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'

const HISTORICAL_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1n5aqip8iFCpltO8deiS7q9m3u_dFvKTZpwzfZXVTpgs/export?format=csv&gid=699541356'

// Cache the parsed data
let cachedData: { headers: string[]; rows: { date: string; values: Record<string, number> }[] } | null = null
let cacheTime: number = 0
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

async function fetchHistoricalData() {
  const now = Date.now()

  if (cachedData && now - cacheTime < CACHE_DURATION) {
    return cachedData
  }

  const response = await fetch(HISTORICAL_SHEET_URL)
  const csv = await response.text()

  const lines = csv.split('\n')
  const headers = lines[0].split(',').map(h => h.trim())

  // Find where player columns start (after draft picks, around column 37)
  const playerStartIndex = headers.findIndex(h => !h.includes('1st') && !h.includes('2nd') && !h.includes('3rd') && !h.includes('4th') && h !== 'Date')

  const rows: { date: string; values: Record<string, number> }[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Parse CSV properly handling commas in quotes
    const values = line.split(',')
    const date = values[0]

    if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) continue

    const playerValues: Record<string, number> = {}

    for (let j = playerStartIndex; j < headers.length && j < values.length; j++) {
      const playerName = headers[j]
      const value = parseFloat(values[j])
      if (playerName && !isNaN(value) && value > 0) {
        playerValues[playerName] = value
      }
    }

    rows.push({ date, values: playerValues })
  }

  cachedData = { headers: headers.slice(playerStartIndex), rows }
  cacheTime = now

  return cachedData
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const playerName = searchParams.get('player')

  if (!playerName) {
    return NextResponse.json({ error: 'Player name required' }, { status: 400 })
  }

  try {
    const data = await fetchHistoricalData()

    // Find exact match or close match for player name
    const normalizedSearch = playerName.toLowerCase().replace(/[^a-z]/g, '')

    let matchedPlayer = data.headers.find(h => h.toLowerCase() === playerName.toLowerCase())

    if (!matchedPlayer) {
      matchedPlayer = data.headers.find(h =>
        h.toLowerCase().replace(/[^a-z]/g, '') === normalizedSearch
      )
    }

    if (!matchedPlayer) {
      // Try partial match
      matchedPlayer = data.headers.find(h =>
        h.toLowerCase().includes(playerName.toLowerCase()) ||
        playerName.toLowerCase().includes(h.toLowerCase())
      )
    }

    if (!matchedPlayer) {
      return NextResponse.json({ error: 'Player not found', available: data.headers.slice(0, 50) }, { status: 404 })
    }

    // Get historical values for this player
    const history = data.rows
      .filter(row => row.values[matchedPlayer!] !== undefined)
      .map(row => ({
        date: row.date,
        value: row.values[matchedPlayer!]
      }))
      .reverse() // Oldest first

    return NextResponse.json({
      player: matchedPlayer,
      history
    })
  } catch (error) {
    console.error('Failed to fetch historical data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

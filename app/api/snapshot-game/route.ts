import { NextResponse } from 'next/server'
import { getAllPlayerValues } from '@/lib/fantasypros'

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

  // Find where player columns start (after draft picks)
  const playerStartIndex = headers.findIndex(h => !h.includes('1st') && !h.includes('2nd') && !h.includes('3rd') && !h.includes('4th') && h !== 'Date')

  const rows: { date: string; values: Record<string, number> }[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

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

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export async function GET() {
  try {
    const data = await fetchHistoricalData()
    const allPlayerValues = getAllPlayerValues()

    // Build a map of normalized player names to their info
    const normalizedPlayerMap = new Map<string, { historyName: string; dbInfo: typeof allPlayerValues[0] }>()

    for (const historyName of data.headers) {
      const normalizedHistory = historyName.toLowerCase().replace(/[^a-z]/g, '')

      // Find matching player in database
      const dbMatch = allPlayerValues.find(p => {
        const normalizedDb = p.name.toLowerCase().replace(/[^a-z]/g, '')
        return normalizedDb === normalizedHistory ||
               historyName.toLowerCase() === p.name.toLowerCase()
      })

      if (dbMatch) {
        // Check if this player has enough history
        const historyCount = data.rows.filter(row => row.values[historyName] !== undefined).length
        if (historyCount >= 20) { // Require at least 20 data points for a good chart
          normalizedPlayerMap.set(normalizedHistory, { historyName, dbInfo: dbMatch })
        }
      }
    }

    const eligiblePlayers = Array.from(normalizedPlayerMap.values())

    if (eligiblePlayers.length < 4) {
      return NextResponse.json({ error: 'Not enough players with history' }, { status: 500 })
    }

    // Pick a random correct answer
    const correctPlayerData = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)]
    const correctHistoryName = correctPlayerData.historyName
    const correctDbInfo = correctPlayerData.dbInfo

    // Get the correct player's history
    const correctHistory = data.rows
      .filter(row => row.values[correctHistoryName] !== undefined)
      .map(row => ({
        date: row.date,
        value: row.values[correctHistoryName]
      }))
      .reverse() // Oldest first

    // Get 3 decoy players - prioritize same position and similar value
    const otherPlayers = eligiblePlayers.filter(p =>
      p.dbInfo.name !== correctDbInfo.name
    )

    // Separate by position
    const samePosition = otherPlayers.filter(p => p.dbInfo.position === correctDbInfo.position)
    const diffPosition = otherPlayers.filter(p => p.dbInfo.position !== correctDbInfo.position)

    // Sort same position by value similarity
    samePosition.sort((a, b) =>
      Math.abs(a.dbInfo.value - correctDbInfo.value) - Math.abs(b.dbInfo.value - correctDbInfo.value)
    )

    // Sort different position by value similarity
    diffPosition.sort((a, b) =>
      Math.abs(a.dbInfo.value - correctDbInfo.value) - Math.abs(b.dbInfo.value - correctDbInfo.value)
    )

    // Select decoys: prefer same position, mix in some from different positions
    let decoyPool: typeof eligiblePlayers = []

    // Take players with similar values (skip the very closest to make it harder)
    if (samePosition.length >= 3) {
      // Skip top 1, take next several from same position
      decoyPool = samePosition.slice(1, 8)
    } else {
      // Mix same position and similar-value different position
      decoyPool = [...samePosition, ...diffPosition.slice(0, 10)]
    }

    // Shuffle and take 3
    const selectedDecoys = shuffleArray(decoyPool).slice(0, 3)

    // Create options array with correct answer and decoys
    const options = shuffleArray([
      { name: correctDbInfo.name, position: correctDbInfo.position, isCorrect: true },
      ...selectedDecoys.map(p => ({ name: p.dbInfo.name, position: p.dbInfo.position, isCorrect: false }))
    ])

    return NextResponse.json({
      history: correctHistory,
      options,
      correctPlayer: correctDbInfo.name,
      position: correctDbInfo.position
    })
  } catch (error) {
    console.error('Failed to generate game:', error)
    return NextResponse.json({ error: 'Failed to generate game' }, { status: 500 })
  }
}

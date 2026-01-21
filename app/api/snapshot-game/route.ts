import { NextResponse } from 'next/server'
import { getAllPlayerValues } from '@/lib/fantasypros'

// Prevent caching to ensure randomization works
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

// Use crypto for better randomization
function getRandomInt(max: number): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] % max
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1)
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

    // Pick a random correct answer using crypto
    const correctPlayerData = eligiblePlayers[getRandomInt(eligiblePlayers.length)]
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

    // Calculate career trajectory info for correct player
    const correctValues = correctHistory.map(h => h.value)
    const correctAvgValue = correctValues.reduce((a, b) => a + b, 0) / correctValues.length
    const correctMaxValue = Math.max(...correctValues)
    const correctCurrentValue = correctValues[correctValues.length - 1] || 0

    // Get other players and calculate their similarity scores
    const otherPlayers = eligiblePlayers
      .filter(p => p.dbInfo.name !== correctDbInfo.name)
      .map(p => {
        // Get this player's history for trajectory comparison
        const playerHistory = data.rows
          .filter(row => row.values[p.historyName] !== undefined)
          .map(row => row.values[p.historyName])

        const avgValue = playerHistory.length > 0
          ? playerHistory.reduce((a, b) => a + b, 0) / playerHistory.length
          : p.dbInfo.value
        const maxValue = playerHistory.length > 0 ? Math.max(...playerHistory) : p.dbInfo.value

        // Calculate similarity score (lower is more similar)
        const positionMatch = p.dbInfo.position === correctDbInfo.position ? 0 : 1000
        const valueDiff = Math.abs(avgValue - correctAvgValue)
        const maxDiff = Math.abs(maxValue - correctMaxValue)
        const currentDiff = Math.abs(p.dbInfo.value - correctCurrentValue)

        const similarityScore = positionMatch + valueDiff * 0.3 + maxDiff * 0.3 + currentDiff * 0.4

        return { ...p, similarityScore, avgValue }
      })

    // Sort by similarity (most similar first)
    otherPlayers.sort((a, b) => a.similarityScore - b.similarityScore)

    // Take top similar players, but add some randomness
    // Pick from top 15 most similar players to add variety
    const candidatePool = otherPlayers.slice(0, Math.min(15, otherPlayers.length))
    const selectedDecoys = shuffleArray(candidatePool).slice(0, 3)

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

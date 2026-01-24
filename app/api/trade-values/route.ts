import { NextResponse } from 'next/server'
import { getSleeperPlayerValue, getDraftPickValue } from '@/lib/fantasypros'

const HISTORICAL_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1n5aqip8iFCpltO8deiS7q9m3u_dFvKTZpwzfZXVTpgs/export?format=csv&gid=699541356'

// Draft pick values depreciate over time as the draft approaches
// This estimates what a pick was worth at a given date
function getPickValueAtDate(
  season: string,
  round: number,
  position: 'early' | 'mid' | 'late',
  tradeDate: Date
): number {
  const currentValue = getDraftPickValue(parseInt(season), round, position)
  const now = new Date()
  const seasonYear = parseInt(season)

  // Draft typically happens in May
  const draftDate = new Date(seasonYear, 4, 1) // May 1st of draft year

  // If trade was after the draft, the pick has been used (value = 0 for retrospective)
  if (tradeDate > draftDate) {
    return currentValue // Pick was already converted to a player
  }

  // Calculate how far out the draft was at trade time vs now
  const msPerDay = 1000 * 60 * 60 * 24
  const daysUntilDraftAtTrade = Math.max(0, (draftDate.getTime() - tradeDate.getTime()) / msPerDay)
  const daysUntilDraftNow = Math.max(0, (draftDate.getTime() - now.getTime()) / msPerDay)

  // Picks gain value as draft approaches (more certainty)
  // A pick 2 years out is worth ~70% of the same pick 1 year out
  const depreciationFactor = 0.85 // Per year
  const yearsOutAtTrade = daysUntilDraftAtTrade / 365
  const yearsOutNow = daysUntilDraftNow / 365

  // If the pick is now in the past (drafted), use current value
  if (yearsOutNow <= 0) {
    const atTradeMultiplier = Math.pow(depreciationFactor, yearsOutAtTrade)
    return Math.round(currentValue * atTradeMultiplier)
  }

  // Both are in future - calculate relative values
  const atTradeMultiplier = Math.pow(depreciationFactor, yearsOutAtTrade)
  const nowMultiplier = Math.pow(depreciationFactor, yearsOutNow)

  // Return what the pick was worth at trade time
  return Math.round((currentValue / nowMultiplier) * atTradeMultiplier)
}

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

// Normalize player name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Find matching player in historical data
function findPlayerMatch(playerName: string, headers: string[]): string | null {
  const normalized = normalizeName(playerName)

  // Exact match
  let match = headers.find(h => normalizeName(h) === normalized)
  if (match) return match

  // Partial match (last name + first initial)
  const parts = normalized.split(' ')
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1]
    match = headers.find(h => {
      const hNorm = normalizeName(h)
      return hNorm.includes(lastName) && hNorm[0] === parts[0][0]
    })
    if (match) return match
  }

  return null
}

// Get value for a player at a specific date
function getValueAtDate(
  playerName: string,
  tradeDate: string,
  data: { headers: string[]; rows: { date: string; values: Record<string, number> }[] }
): number | null {
  const matchedPlayer = findPlayerMatch(playerName, data.headers)
  if (!matchedPlayer) return null

  // Find the closest date on or before the trade date
  const sortedRows = [...data.rows].sort((a, b) => a.date.localeCompare(b.date))

  let closestRow = null
  for (const row of sortedRows) {
    if (row.date <= tradeDate) {
      closestRow = row
    } else {
      break
    }
  }

  if (!closestRow) {
    // If trade is before all data, use earliest available
    closestRow = sortedRows[0]
  }

  return closestRow?.values[matchedPlayer] ?? null
}

interface PlayerInput {
  name: string
  position: string
}

interface PickInput {
  season: string
  round: number
  position: 'early' | 'mid' | 'late'
  label: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { players, picks, tradeDate } = body as {
      players: PlayerInput[]
      picks?: PickInput[]
      tradeDate: string
    }

    const data = await fetchHistoricalData()
    const tradeDateStr = tradeDate ? new Date(parseInt(tradeDate)).toISOString().split('T')[0] : null
    const tradeDateObj = tradeDate ? new Date(parseInt(tradeDate)) : new Date()

    const playerResults: Record<string, { atTrade: number | null; current: number }> = {}
    const pickResults: Record<string, { atTrade: number; current: number }> = {}

    // Process players
    if (players && Array.isArray(players)) {
      for (const player of players) {
        const current = getSleeperPlayerValue(
          player.name.split(' ')[0] || '',
          player.name.split(' ').slice(1).join(' ') || '',
          player.position,
          null
        )

        let atTrade: number | null = null
        if (tradeDateStr) {
          atTrade = getValueAtDate(player.name, tradeDateStr, data)
        }

        // Track if we found historical data (null means no historical data available)
        playerResults[player.name] = { atTrade, current }
      }
    }

    // Process picks
    if (picks && Array.isArray(picks)) {
      for (const pick of picks) {
        const current = getDraftPickValue(parseInt(pick.season), pick.round, pick.position)
        const atTrade = getPickValueAtDate(pick.season, pick.round, pick.position, tradeDateObj)

        pickResults[pick.label] = { atTrade, current }
      }
    }

    return NextResponse.json({
      values: playerResults,
      pickValues: pickResults
    })
  } catch (error) {
    console.error('Failed to fetch trade values:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

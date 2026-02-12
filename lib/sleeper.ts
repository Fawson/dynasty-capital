import {
  SleeperUser,
  SleeperLeague,
  SleeperRoster,
  SleeperMatchup,
  SleeperPlayer,
  LeagueUser,
  TradedPick,
} from './types'

const BASE_URL = 'https://api.sleeper.app/v1'

export async function getUser(username: string): Promise<SleeperUser | null> {
  const res = await fetch(`${BASE_URL}/user/${username}`, {
    next: { revalidate: 300 }, // Revalidate every 5 minutes
  })
  if (!res.ok) return null
  return res.json()
}

// Get the current NFL season year
// NFL season runs Sept-Feb, so Jan-Aug of year X is still the (X-1) season
export function getCurrentSeason(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed (0 = Jan)

  // If we're in Jan-Aug, we're still in the previous year's season
  if (month < 8) {
    return (year - 1).toString()
  }
  return year.toString()
}

export async function getUserLeagues(
  userId: string,
  season?: string
): Promise<SleeperLeague[]> {
  const seasonToFetch = season || getCurrentSeason()
  const res = await fetch(`${BASE_URL}/user/${userId}/leagues/nfl/${seasonToFetch}`, {
    next: { revalidate: 300 }, // Revalidate every 5 minutes
  })
  if (!res.ok) return []
  return res.json()
}

export async function getLeague(leagueId: string): Promise<SleeperLeague | null> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}`, {
    next: { revalidate: 300 }, // Revalidate every 5 minutes
  })
  if (!res.ok) return null
  return res.json()
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/rosters`, {
    cache: 'no-store', // Always fetch fresh roster data
  })
  if (!res.ok) return []
  return res.json()
}

export async function getLeagueUsers(leagueId: string): Promise<LeagueUser[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/users`, {
    next: { revalidate: 300 }, // Revalidate every 5 minutes
  })
  if (!res.ok) return []
  return res.json()
}

export async function getMatchups(
  leagueId: string,
  week: number
): Promise<SleeperMatchup[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/matchups/${week}`, {
    next: { revalidate: 60 }, // Revalidate every 60 seconds during games
  })
  if (!res.ok) return []
  return res.json()
}

export async function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  // Use our cached API endpoint in production, fall back to Sleeper directly
  const isServer = typeof window === 'undefined'

  // On the server during build/SSR, use the Sleeper API directly
  // In the browser or during runtime, use our cached endpoint
  if (isServer && process.env.NODE_ENV === 'production') {
    // During build, fetch from Sleeper directly
    const res = await fetch(`${BASE_URL}/players/nfl`, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    })
    if (!res.ok) return {}
    return res.json()
  }

  // Try our cached API first (works in browser and at runtime)
  try {
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/players`, {
      next: { revalidate: 86400 },
    })
    if (res.ok) {
      return res.json()
    }
  } catch {
    // Fall back to Sleeper API
  }

  // Fallback to Sleeper API directly
  const res = await fetch(`${BASE_URL}/players/nfl`)
  if (!res.ok) return {}
  return res.json()
}

export async function getTradedPicks(leagueId: string): Promise<TradedPick[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/traded_picks`, {
    cache: 'no-store', // Always fetch fresh traded picks data
  })
  if (!res.ok) return []
  return res.json()
}

export interface Transaction {
  type: 'trade' | 'free_agent' | 'waiver'
  transaction_id: string
  status: string
  status_updated: number
  roster_ids: number[]
  adds: Record<string, number> | null  // player_id -> roster_id
  drops: Record<string, number> | null // player_id -> roster_id
  draft_picks: {
    season: string
    round: number
    roster_id: number
    previous_owner_id: number
    owner_id: number
  }[]
  waiver_budget: {
    sender: number
    receiver: number
    amount: number
  }[]
  created: number
  creator: string
  leg: number
}

export async function getTransactions(leagueId: string, week: number): Promise<Transaction[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/transactions/${week}`, {
    cache: 'no-store', // Always fetch fresh transaction data
  })
  if (!res.ok) return []
  return res.json()
}

export async function getAllTransactions(leagueId: string, maxWeek: number = 18): Promise<Transaction[]> {
  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1)
  const allTransactions = await Promise.all(
    weeks.map(week => getTransactions(leagueId, week))
  )
  return allTransactions.flat().sort((a, b) => b.created - a.created)
}

export interface PlayoffMatchup {
  r: number // round
  m: number // matchup id
  t1: number | null // roster_id of team 1
  t2: number | null // roster_id of team 2
  w: number | null // roster_id of winner
  l: number | null // roster_id of loser
  t1_from?: { w?: number; l?: number } // where team 1 came from
  t2_from?: { w?: number; l?: number } // where team 2 came from
}

export async function getWinnersBracket(leagueId: string): Promise<PlayoffMatchup[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/winners_bracket`, {
    next: { revalidate: 300 }, // Revalidate every 5 minutes
  })
  if (!res.ok) return []
  return res.json()
}

export async function getLosersBracket(leagueId: string): Promise<PlayoffMatchup[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/losers_bracket`, {
    next: { revalidate: 300 }, // Revalidate every 5 minutes
  })
  if (!res.ok) return []
  return res.json()
}

// Get the league champion's roster_id from the winners bracket
export function getChampionRosterId(bracket: PlayoffMatchup[]): number | null {
  if (!bracket || bracket.length === 0) return null

  // Find the championship matchup (highest round number)
  const maxRound = Math.max(...bracket.map(m => m.r))
  const championship = bracket.find(m => m.r === maxRound)

  // Return the winner's roster_id
  return championship?.w || null
}

// Helper function to get current NFL week (approximate)
export function getCurrentWeek(): number {
  const season = parseInt(getCurrentSeason())
  // NFL season typically starts first Thursday of September
  // Using Sept 5 as approximate start date
  const seasonStart = new Date(`${season}-09-05`)
  const now = new Date()
  const diffTime = now.getTime() - seasonStart.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const week = Math.floor(diffDays / 7) + 1
  return Math.min(Math.max(week, 1), 18)
}

// Get league history by traversing previous_league_id
export async function getLeagueHistory(leagueId: string): Promise<SleeperLeague[]> {
  const history: SleeperLeague[] = []
  let currentId: string | null = leagueId

  while (currentId) {
    const league = await getLeague(currentId)
    if (!league) break
    history.push(league)
    currentId = league.previous_league_id || null
  }

  return history
}

// Calculate historical stats for a user across league history
export interface HistoricalStats {
  seasons: number
  totalWins: number
  totalLosses: number
  championships: number
  runnerUps: number
  topThreeFinishes: number
  topWeeklyScores: number
  averageFinish: number
  bestFinish: number
  worstFinish: number
  allTimePointsFor: number
  seasonResults: {
    season: string
    wins: number
    losses: number
    finish: number
    pointsFor: number
    isChampion: boolean
    weeklyHighs: number
  }[]
}

export async function getHistoricalStatsForUser(
  leagueId: string,
  userId: string
): Promise<HistoricalStats | null> {
  const history = await getLeagueHistory(leagueId)
  if (history.length === 0) return null

  const stats: HistoricalStats = {
    seasons: 0,
    totalWins: 0,
    totalLosses: 0,
    championships: 0,
    runnerUps: 0,
    topThreeFinishes: 0,
    topWeeklyScores: 0,
    averageFinish: 0,
    bestFinish: 999,
    worstFinish: 0,
    allTimePointsFor: 0,
    seasonResults: [],
  }

  const finishes: number[] = []

  for (const league of history) {
    try {
      const [rosters, users, winnersBracket] = await Promise.all([
        getLeagueRosters(league.league_id),
        getLeagueUsers(league.league_id),
        getWinnersBracket(league.league_id),
      ])

      // Find the user's roster in this season
      const user = users.find(u => u.user_id === userId)
      if (!user) continue

      const roster = rosters.find(r => r.owner_id === userId)
      if (!roster) continue

      stats.seasons++
      stats.totalWins += roster.settings.wins || 0
      stats.totalLosses += roster.settings.losses || 0

      const pointsFor = (roster.settings.fpts || 0) + (roster.settings.fpts_decimal || 0) / 100
      stats.allTimePointsFor += pointsFor

      // Calculate finish position
      const sortedRosters = [...rosters].sort((a, b) => {
        if (b.settings.wins !== a.settings.wins) {
          return b.settings.wins - a.settings.wins
        }
        return (
          (b.settings.fpts + b.settings.fpts_decimal / 100) -
          (a.settings.fpts + a.settings.fpts_decimal / 100)
        )
      })

      const finish = sortedRosters.findIndex(r => r.roster_id === roster.roster_id) + 1
      finishes.push(finish)

      if (finish < stats.bestFinish) stats.bestFinish = finish
      if (finish > stats.worstFinish) stats.worstFinish = finish
      if (finish <= 3) stats.topThreeFinishes++

      // Check for championship/runner-up
      const championRosterId = getChampionRosterId(winnersBracket)
      const isChampion = championRosterId === roster.roster_id
      if (isChampion) stats.championships++

      // Check for runner-up (lost in championship)
      const maxRound = Math.max(...winnersBracket.map(m => m.r), 0)
      const championship = winnersBracket.find(m => m.r === maxRound)
      if (championship?.l === roster.roster_id) stats.runnerUps++

      // Count weekly high scores
      let weeklyHighs = 0
      const totalWeeks = league.settings?.playoff_week_start ? league.settings.playoff_week_start - 1 : 14

      for (let week = 1; week <= totalWeeks; week++) {
        try {
          const matchups = await getMatchups(league.league_id, week)
          if (matchups.length === 0) continue

          const topScore = Math.max(...matchups.map(m => m.points || 0))
          const userMatchup = matchups.find(m => m.roster_id === roster.roster_id)
          if (userMatchup && userMatchup.points === topScore && topScore > 0) {
            weeklyHighs++
          }
        } catch {
          // Skip weeks that fail
        }
      }

      stats.topWeeklyScores += weeklyHighs

      stats.seasonResults.push({
        season: league.season,
        wins: roster.settings.wins || 0,
        losses: roster.settings.losses || 0,
        finish,
        pointsFor,
        isChampion,
        weeklyHighs,
      })
    } catch {
      // Skip seasons that fail to load
    }
  }

  if (finishes.length > 0) {
    stats.averageFinish = finishes.reduce((a, b) => a + b, 0) / finishes.length
  }

  // Sort results by season descending
  stats.seasonResults.sort((a, b) => parseInt(b.season) - parseInt(a.season))

  return stats
}

// Sleeper logo fallback URL
export const SLEEPER_LOGO_URL = 'https://sleepercdn.com/images/v2/icons/league/league_avatar_mint.png'

// Get avatar URL
export function getAvatarUrl(avatarId: string | null | undefined, type: 'user' | 'league' = 'user'): string {
  if (!avatarId) {
    // Use Sleeper logo as fallback
    return SLEEPER_LOGO_URL
  }
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`
}

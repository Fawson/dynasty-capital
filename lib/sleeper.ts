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
  const res = await fetch(`${BASE_URL}/user/${username}`)
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
  const res = await fetch(`${BASE_URL}/user/${userId}/leagues/nfl/${seasonToFetch}`)
  if (!res.ok) return []
  return res.json()
}

export async function getLeague(leagueId: string): Promise<SleeperLeague | null> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}`)
  if (!res.ok) return null
  return res.json()
}

export async function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/rosters`)
  if (!res.ok) return []
  return res.json()
}

export async function getLeagueUsers(leagueId: string): Promise<LeagueUser[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/users`)
  if (!res.ok) return []
  return res.json()
}

export async function getMatchups(
  leagueId: string,
  week: number
): Promise<SleeperMatchup[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/matchups/${week}`)
  if (!res.ok) return []
  return res.json()
}

export async function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  const res = await fetch(`${BASE_URL}/players/nfl`)
  if (!res.ok) return {}
  return res.json()
}

export async function getTradedPicks(leagueId: string): Promise<TradedPick[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/traded_picks`)
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
  const res = await fetch(`${BASE_URL}/league/${leagueId}/transactions/${week}`)
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
  const res = await fetch(`${BASE_URL}/league/${leagueId}/winners_bracket`)
  if (!res.ok) return []
  return res.json()
}

export async function getLosersBracket(leagueId: string): Promise<PlayoffMatchup[]> {
  const res = await fetch(`${BASE_URL}/league/${leagueId}/losers_bracket`)
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

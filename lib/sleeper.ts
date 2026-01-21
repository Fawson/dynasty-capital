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

// Get avatar URL
export function getAvatarUrl(avatarId: string | null | undefined, type: 'user' | 'league' = 'user'): string {
  if (!avatarId) {
    // Use data URI placeholders for missing avatars
    return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%230f3460" width="100" height="100"/%3E%3Ctext x="50" y="60" text-anchor="middle" fill="%23666" font-size="40"%3E?%3C/text%3E%3C/svg%3E'
  }
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`
}

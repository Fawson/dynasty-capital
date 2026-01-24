// Sleeper API Types

export interface SleeperUser {
  user_id: string
  username: string
  display_name: string
  avatar: string | null
}

export interface SleeperLeague {
  league_id: string
  name: string
  season: string
  season_type: string
  sport: string
  status: string
  total_rosters: number
  roster_positions: string[]
  settings: LeagueSettings
  scoring_settings: Record<string, number>
  avatar: string | null
}

export interface LeagueSettings {
  wins_per_week: number
  playoff_teams: number
  playoff_week_start: number
  leg: number
  trade_deadline: number
  waiver_type: number
  waiver_budget: number
  bench_lock: number
  draft_rounds?: number
}

export interface SleeperRoster {
  roster_id: number
  owner_id: string
  league_id: string
  players: string[]
  starters: string[]
  reserve: string[] | null
  taxi: string[] | null
  settings: RosterSettings
  metadata?: Record<string, string>
}

export interface RosterSettings {
  wins: number
  losses: number
  ties: number
  fpts: number
  fpts_decimal: number
  fpts_against: number
  fpts_against_decimal: number
}

export interface SleeperMatchup {
  roster_id: number
  matchup_id: number
  players: string[]
  starters: string[]
  points: number
  starters_points: number[]
  custom_points: number | null
}

export interface SleeperPlayer {
  player_id: string
  first_name: string
  last_name: string
  full_name: string
  position: string
  team: string | null
  age: number | null
  years_exp: number
  status: string
  injury_status: string | null
  fantasy_positions: string[]
  search_full_name: string
  search_first_name: string
  search_last_name: string
  search_rank: number
}

export interface LeagueUser {
  user_id: string
  league_id: string
  display_name: string
  avatar: string | null
  metadata?: {
    team_name?: string
  }
}

export interface TradedPick {
  season: string
  round: number
  roster_id: number  // Original owner
  previous_owner_id: number
  owner_id: number   // Current owner
}

// Extended types for our app

export interface TeamData {
  roster: SleeperRoster
  user: LeagueUser
  players: SleeperPlayer[]
  totalValue: number
}

export interface PlayerWithValue extends SleeperPlayer {
  value: number
  rank: number
}

export interface TradeAnalysis {
  team1Players: PlayerWithValue[]
  team2Players: PlayerWithValue[]
  team1Total: number
  team2Total: number
  difference: number
  fairnessRating: 'fair' | 'slight_advantage' | 'unfair'
}

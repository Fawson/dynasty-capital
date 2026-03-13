// Shared constants used across the app

// Position colors for badges and charts
export const POSITION_COLORS: Record<string, string> = {
  QB: '#DC2626',  // red-600
  RB: '#16A34A',  // green-600
  WR: '#2563EB',  // blue-600
  TE: '#EA580C',  // orange-600
  K: '#9333EA',   // purple-600
  DEF: '#CA8A04', // yellow-600
}

// Position badge CSS classes (Tailwind bg colors)
export const POSITION_BG_CLASSES: Record<string, string> = {
  QB: 'bg-red-600',
  RB: 'bg-green-600',
  WR: 'bg-blue-600',
  TE: 'bg-orange-600',
  K: 'bg-purple-600',
  DEF: 'bg-yellow-600',
}

// Value color thresholds for dynasty values
export function getValueColorClass(value: number): string {
  if (value >= 9000) return 'text-yellow-400'
  if (value >= 8000) return 'text-green-400'
  if (value >= 7000) return 'text-blue-400'
  if (value >= 5000) return 'text-gray-300'
  return 'text-gray-500'
}

// Position-based default values for unranked players
export const POSITION_DEFAULTS: Record<string, number> = {
  QB: 500,
  RB: 500,
  WR: 500,
  TE: 500,
  K: 100,
  DEF: 100,
}

// NFL team colors for charts
export const NFL_TEAM_COLORS: Record<string, string> = {
  ARI: '#97233F', ATL: '#A71930', BAL: '#241773', BUF: '#00338D',
  CAR: '#0085CA', CHI: '#C83803', CIN: '#FB4F14', CLE: '#311D00',
  DAL: '#003594', DEN: '#FB4F14', DET: '#0076B6', GB: '#203731',
  HOU: '#03202F', IND: '#002C5F', JAX: '#006778', KC: '#E31837',
  LAC: '#0080C6', LAR: '#003594', LV: '#000000', MIA: '#008E97',
  MIN: '#4F2683', NE: '#002244', NO: '#D3BC8D', NYG: '#0B2265',
  NYJ: '#125740', PHI: '#004C54', PIT: '#FFB612', SEA: '#002244',
  SF: '#AA0000', TB: '#D50A0A', TEN: '#0C2340', WAS: '#5A1414',
}

// Positions to filter by (used in multiple components)
export const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const
export const ALL_FILTER_POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const

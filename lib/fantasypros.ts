// Dynasty player value rankings
// Data sourced from KeepTradeCut dynasty values
// Last updated: 01/13/26

// Trade values based on dynasty rankings (higher = more valuable)
// Scale: 1-10000 where 10000 is the most valuable player

interface PlayerValue {
  name: string
  position: string
  value: number
  tier: number
}

// Draft pick values for dynasty leagues
export interface DraftPick {
  id: string
  year: number
  round: number
  position: 'early' | 'mid' | 'late'
  value: number
  label: string
}

// Draft pick value chart (dynasty format)
// Values based on typical dynasty trade calculators
const DRAFT_PICK_VALUES: Record<string, Record<string, Record<string, number>>> = {
  '2026': {
    '1': { early: 8500, mid: 7000, late: 5500 },
    '2': { early: 4000, mid: 3000, late: 2000 },
    '3': { early: 1500, mid: 1200, late: 900 },
    '4': { early: 700, mid: 500, late: 300 },
  },
  '2027': {
    '1': { early: 7500, mid: 6000, late: 4500 },
    '2': { early: 3500, mid: 2500, late: 1700 },
    '3': { early: 1300, mid: 1000, late: 700 },
    '4': { early: 500, mid: 400, late: 250 },
  },
  '2028': {
    '1': { early: 6500, mid: 5000, late: 3800 },
    '2': { early: 3000, mid: 2200, late: 1500 },
    '3': { early: 1100, mid: 800, late: 600 },
    '4': { early: 400, mid: 300, late: 200 },
  },
}

// Get all available draft picks for trade calculator
export function getAvailableDraftPicks(): DraftPick[] {
  const picks: DraftPick[] = []
  const years = ['2026', '2027', '2028']
  const rounds = ['1', '2', '3', '4']
  const positions: Array<'early' | 'mid' | 'late'> = ['early', 'mid', 'late']

  years.forEach((year) => {
    rounds.forEach((round) => {
      positions.forEach((position) => {
        const value = DRAFT_PICK_VALUES[year]?.[round]?.[position] || 100
        const posLabel = position.charAt(0).toUpperCase() + position.slice(1)
        picks.push({
          id: `${year}-${round}-${position}`,
          year: parseInt(year),
          round: parseInt(round),
          position,
          value,
          label: `${year} ${posLabel} ${getOrdinal(parseInt(round))}`,
        })
      })
    })
  })

  return picks
}

// Get ordinal suffix for round number
function getOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0])
}

// Get draft pick value
export function getDraftPickValue(
  year: number,
  round: number,
  position: 'early' | 'mid' | 'late'
): number {
  return DRAFT_PICK_VALUES[year.toString()]?.[round.toString()]?.[position] || 100
}

// Determine pick position (early/mid/late) based on standings rank and year
// For upcoming draft (2026): use early (low) or late (high) based on standings
// For future drafts (2027+): always use mid
export function getPickPosition(
  standingsRank: number,
  totalTeams: number,
  year: number = 2026
): 'early' | 'mid' | 'late' {
  // Future drafts are always valued as mid
  if (year > 2026) {
    return 'mid'
  }

  // For 2026: bottom half = early (low), top half = late (high)
  const percentile = standingsRank / totalTeams
  if (percentile > 0.5) return 'early'
  return 'late'
}

// Extended draft pick interface with original owner info
export interface OwnedDraftPick {
  id: string
  season: string
  round: number
  originalOwnerId: number
  currentOwnerId: number
  originalOwnerName: string
  position: 'early' | 'mid' | 'late'
  value: number
  label: string
}

// League Format: 1QB Dynasty
// Values sourced from KeepTradeCut
export const LEAGUE_FORMAT = {
  scoring: '1QB',
  source: 'KeepTradeCut',
  lastUpdated: '2026-01-13',
}

// Helper to determine tier based on value
function getTier(value: number): number {
  if (value >= 9000) return 1
  if (value >= 7000) return 2
  if (value >= 5000) return 3
  if (value >= 3000) return 4
  if (value >= 2000) return 5
  return 6
}

// Player values from KeepTradeCut - 1QB Dynasty Rankings
const PLAYER_VALUES: PlayerValue[] = [
  // Top Tier Players
  { name: 'Bijan Robinson', position: 'RB', value: 9999, tier: 1 },
  { name: 'Jaxon Smith-Njigba', position: 'WR', value: 9999, tier: 1 },
  { name: 'Puka Nacua', position: 'WR', value: 9990, tier: 1 },
  { name: "Ja'Marr Chase", position: 'WR', value: 9988, tier: 1 },
  { name: 'Jahmyr Gibbs', position: 'RB', value: 9867, tier: 1 },
  { name: 'Malik Nabers', position: 'WR', value: 8079, tier: 2 },
  { name: 'Trey McBride', position: 'TE', value: 8048, tier: 2 },
  { name: 'Brock Bowers', position: 'TE', value: 7965, tier: 2 },
  { name: 'Amon-Ra St. Brown', position: 'WR', value: 7956, tier: 2 },
  { name: "De'Von Achane", position: 'RB', value: 7887, tier: 2 },
  { name: 'CeeDee Lamb', position: 'WR', value: 7833, tier: 2 },
  { name: 'Justin Jefferson', position: 'WR', value: 7748, tier: 2 },
  { name: 'Josh Allen', position: 'QB', value: 7690, tier: 2 },
  { name: 'Drake London', position: 'WR', value: 7633, tier: 2 },
  { name: 'Ashton Jeanty', position: 'RB', value: 7577, tier: 2 },
  { name: 'Jonathan Taylor', position: 'RB', value: 7257, tier: 2 },
  { name: 'Omarion Hampton', position: 'RB', value: 7224, tier: 2 },
  { name: 'Tetairoa McMillan', position: 'WR', value: 7089, tier: 2 },
  { name: 'TreVeyon Henderson', position: 'RB', value: 7072, tier: 2 },
  { name: 'James Cook', position: 'RB', value: 6886, tier: 3 },
  { name: 'George Pickens', position: 'WR', value: 6883, tier: 3 },
  { name: 'Rashee Rice', position: 'WR', value: 6867, tier: 3 },
  { name: 'Emeka Egbuka', position: 'WR', value: 6824, tier: 3 },
  { name: 'Nico Collins', position: 'WR', value: 6818, tier: 3 },
  { name: 'Drake Maye', position: 'QB', value: 6804, tier: 3 },
  { name: 'Tyler Warren', position: 'TE', value: 6481, tier: 3 },
  { name: 'Garrett Wilson', position: 'WR', value: 6471, tier: 3 },
  { name: 'Lamar Jackson', position: 'QB', value: 6469, tier: 3 },
  { name: 'Bucky Irving', position: 'RB', value: 6414, tier: 3 },
  { name: 'Quinshon Judkins', position: 'RB', value: 6396, tier: 3 },
  { name: 'Chris Olave', position: 'WR', value: 6334, tier: 3 },
  { name: 'Christian McCaffrey', position: 'RB', value: 6323, tier: 3 },
  { name: 'Jayden Daniels', position: 'QB', value: 6178, tier: 3 },
  { name: 'Breece Hall', position: 'RB', value: 6133, tier: 3 },
  { name: 'Ladd McConkey', position: 'WR', value: 6123, tier: 3 },
  { name: 'Rome Odunze', position: 'WR', value: 6050, tier: 3 },
  { name: 'Marvin Harrison Jr.', position: 'WR', value: 5887, tier: 3 },
  { name: 'Brian Thomas Jr.', position: 'WR', value: 5717, tier: 3 },
  { name: 'Tee Higgins', position: 'WR', value: 5716, tier: 3 },
  { name: 'Chase Brown', position: 'RB', value: 5694, tier: 3 },
  { name: 'Colston Loveland', position: 'TE', value: 5678, tier: 3 },
  { name: 'Saquon Barkley', position: 'RB', value: 5640, tier: 3 },
  { name: 'Kyren Williams', position: 'RB', value: 5623, tier: 3 },
  { name: 'Joe Burrow', position: 'QB', value: 5589, tier: 3 },
  { name: 'Patrick Mahomes', position: 'QB', value: 5579, tier: 3 },
  { name: 'Cam Skattebo', position: 'RB', value: 5559, tier: 3 },
  { name: 'Jalen Hurts', position: 'QB', value: 5557, tier: 3 },
  { name: 'Tucker Kraft', position: 'TE', value: 5556, tier: 3 },
  { name: 'Luther Burden', position: 'WR', value: 5543, tier: 3 },
  { name: 'RJ Harvey', position: 'RB', value: 5527, tier: 3 },
  { name: 'Jameson Williams', position: 'WR', value: 5526, tier: 3 },
  { name: 'Harold Fannin', position: 'TE', value: 5503, tier: 3 },
  { name: 'A.J. Brown', position: 'WR', value: 5457, tier: 3 },
  { name: 'DeVonta Smith', position: 'WR', value: 5454, tier: 3 },
  { name: 'Jaxson Dart', position: 'QB', value: 5399, tier: 3 },
  { name: 'Justin Herbert', position: 'QB', value: 5392, tier: 3 },
  { name: 'Jaylen Waddle', position: 'WR', value: 5387, tier: 3 },
  { name: 'Josh Jacobs', position: 'RB', value: 5358, tier: 3 },
  { name: 'Caleb Williams', position: 'QB', value: 5329, tier: 3 },
  { name: 'Zay Flowers', position: 'WR', value: 5314, tier: 3 },
  { name: 'Travis Hunter', position: 'WR', value: 5308, tier: 3 },
  { name: 'Sam LaPorta', position: 'TE', value: 5226, tier: 3 },
  { name: 'Travis Etienne', position: 'RB', value: 5214, tier: 3 },
  { name: 'Kenneth Walker III', position: 'RB', value: 5162, tier: 3 },
  { name: 'Javonte Williams', position: 'RB', value: 5140, tier: 3 },
  { name: 'Jordan Addison', position: 'WR', value: 5030, tier: 3 },
  { name: 'Bo Nix', position: 'QB', value: 4996, tier: 4 },
  { name: 'Kyle Pitts', position: 'TE', value: 4877, tier: 4 },
  { name: 'Kyle Monangai', position: 'RB', value: 4781, tier: 4 },
  { name: 'Oronde Gadsden', position: 'TE', value: 4743, tier: 4 },
  { name: 'Ricky Pearsall', position: 'WR', value: 4737, tier: 4 },
  { name: 'George Kittle', position: 'TE', value: 4717, tier: 4 },
  { name: 'DK Metcalf', position: 'WR', value: 4700, tier: 4 },
  { name: 'Jordan Love', position: 'QB', value: 4640, tier: 4 },
  { name: 'Jayden Higgins', position: 'WR', value: 4637, tier: 4 },
  { name: 'Zach Charbonnet', position: 'RB', value: 4574, tier: 4 },
  { name: 'Derrick Henry', position: 'RB', value: 4560, tier: 4 },
  { name: 'Michael Pittman', position: 'WR', value: 4548, tier: 4 },
  { name: 'Baker Mayfield', position: 'QB', value: 4523, tier: 4 },
  { name: 'Davante Adams', position: 'WR', value: 4501, tier: 4 },
  { name: 'Christian Watson', position: 'WR', value: 4489, tier: 4 },
  { name: 'Xavier Worthy', position: 'WR', value: 4448, tier: 4 },
  { name: 'Woody Marks', position: 'RB', value: 4422, tier: 4 },
  { name: 'Michael Wilson', position: 'WR', value: 4419, tier: 4 },
  { name: 'Dak Prescott', position: 'QB', value: 4399, tier: 4 },
  { name: "Wan'Dale Robinson", position: 'WR', value: 4394, tier: 4 },
  { name: "D'Andre Swift", position: 'RB', value: 4391, tier: 4 },
  { name: 'Alec Pierce', position: 'WR', value: 4353, tier: 4 },
  { name: 'Brock Purdy', position: 'QB', value: 4346, tier: 4 },
  { name: 'Jake Ferguson', position: 'TE', value: 4331, tier: 4 },
  { name: 'Quentin Johnston', position: 'WR', value: 4253, tier: 4 },
  { name: 'Jaylen Warren', position: 'RB', value: 4241, tier: 4 },
  { name: 'Jakobi Meyers', position: 'WR', value: 4210, tier: 4 },
  { name: 'C.J. Stroud', position: 'QB', value: 4208, tier: 4 },
  { name: 'Blake Corum', position: 'RB', value: 4178, tier: 4 },
  { name: 'Trey Benson', position: 'RB', value: 4169, tier: 4 },
  { name: 'Rico Dowdle', position: 'RB', value: 4158, tier: 4 },
  { name: 'Matthew Golden', position: 'WR', value: 4153, tier: 4 },
  { name: 'Bhayshul Tuten', position: 'RB', value: 4136, tier: 4 },
  { name: 'Courtland Sutton', position: 'WR', value: 4077, tier: 4 },
  { name: 'Dalton Kincaid', position: 'TE', value: 4052, tier: 4 },
  { name: 'Trevor Lawrence', position: 'QB', value: 3994, tier: 4 },
  { name: 'Troy Franklin', position: 'WR', value: 3993, tier: 4 },
  { name: 'D.J. Moore', position: 'WR', value: 3941, tier: 4 },
  { name: 'Jayden Reed', position: 'WR', value: 3910, tier: 4 },
  { name: 'Terry McLaurin', position: 'WR', value: 3897, tier: 4 },
  { name: 'Brenton Strange', position: 'TE', value: 3864, tier: 4 },
  { name: 'Cam Ward', position: 'QB', value: 3852, tier: 4 },
  { name: 'Josh Downs', position: 'WR', value: 3826, tier: 4 },
  { name: 'Khalil Shakir', position: 'WR', value: 3824, tier: 4 },
  { name: 'Jared Goff', position: 'QB', value: 3797, tier: 4 },
  { name: 'Sam Darnold', position: 'QB', value: 3777, tier: 4 },
  { name: 'Tyler Allgeier', position: 'RB', value: 3770, tier: 4 },
  { name: 'Parker Washington', position: 'WR', value: 3742, tier: 4 },
  { name: 'Jauan Jennings', position: 'WR', value: 3684, tier: 4 },
  { name: 'Elic Ayomanor', position: 'WR', value: 3684, tier: 4 },
  { name: 'Kayshon Boutte', position: 'WR', value: 3684, tier: 4 },
  { name: 'Jacory Croskey-Merritt', position: 'RB', value: 3664, tier: 4 },
  { name: 'Mason Taylor', position: 'TE', value: 3653, tier: 4 },
  { name: 'Chuba Hubbard', position: 'RB', value: 3643, tier: 4 },
  { name: 'Chimere Dike', position: 'WR', value: 3610, tier: 4 },
  { name: 'Romeo Doubs', position: 'WR', value: 3575, tier: 4 },
  { name: 'Daniel Jones', position: 'QB', value: 3570, tier: 4 },
  { name: 'David Montgomery', position: 'RB', value: 3555, tier: 4 },
  { name: 'Isaac TeSlaa', position: 'WR', value: 3505, tier: 4 },
  { name: 'Pat Bryant', position: 'WR', value: 3500, tier: 4 },
  { name: 'Tyjae Spears', position: 'RB', value: 3497, tier: 4 },
  { name: 'Jaylin Noel', position: 'WR', value: 3494, tier: 4 },
  { name: 'Isaiah Likely', position: 'TE', value: 3490, tier: 4 },
  { name: 'J.J. McCarthy', position: 'QB', value: 3471, tier: 4 },
  { name: 'Adonai Mitchell', position: 'WR', value: 3460, tier: 4 },
  { name: 'Theo Johnson', position: 'TE', value: 3455, tier: 4 },
  { name: 'Mike Evans', position: 'WR', value: 3450, tier: 4 },
  { name: 'Jalen Coker', position: 'WR', value: 3442, tier: 4 },
  { name: 'Braelon Allen', position: 'RB', value: 3434, tier: 4 },
  { name: 'Dylan Sampson', position: 'RB', value: 3431, tier: 4 },
  { name: 'Kenneth Gainwell', position: 'RB', value: 3410, tier: 4 },
  { name: 'Kyle Williams', position: 'WR', value: 3403, tier: 4 },
  { name: 'Brandon Aiyuk', position: 'WR', value: 3398, tier: 4 },
  { name: 'Tory Horton', position: 'WR', value: 3394, tier: 4 },
  { name: 'Tre Harris', position: 'WR', value: 3391, tier: 4 },
  { name: 'Jalen McMillan', position: 'WR', value: 3389, tier: 4 },
  { name: 'Stefon Diggs', position: 'WR', value: 3389, tier: 4 },
  { name: 'Bryce Young', position: 'QB', value: 3378, tier: 4 },
  { name: 'Tyrone Tracy', position: 'RB', value: 3375, tier: 4 },
  { name: 'Rashid Shaheed', position: 'WR', value: 3375, tier: 4 },
  { name: 'AJ Barner', position: 'TE', value: 3347, tier: 4 },
  { name: 'Terrance Ferguson', position: 'TE', value: 3346, tier: 4 },
  { name: 'Devin Neal', position: 'RB', value: 3307, tier: 4 },
  { name: 'Kaleb Johnson', position: 'RB', value: 3305, tier: 4 },
  { name: 'Rhamondre Stevenson', position: 'RB', value: 3302, tier: 4 },
  { name: 'J.K. Dobbins', position: 'RB', value: 3302, tier: 4 },
  { name: 'Chris Godwin', position: 'WR', value: 3292, tier: 4 },
  { name: 'Michael Penix Jr.', position: 'QB', value: 3288, tier: 4 },
  { name: 'Ollie Gordon', position: 'RB', value: 3264, tier: 4 },
  { name: 'Tony Pollard', position: 'RB', value: 3258, tier: 4 },
  { name: 'Kimani Vidal', position: 'RB', value: 3257, tier: 4 },
  { name: 'Kyler Murray', position: 'QB', value: 3245, tier: 4 },
  { name: 'Matthew Stafford', position: 'QB', value: 3243, tier: 4 },
  { name: 'T.J. Hockenson', position: 'TE', value: 3218, tier: 4 },
  { name: 'Jerry Jeudy', position: 'WR', value: 3181, tier: 4 },
  { name: 'Dallas Goedert', position: 'TE', value: 3145, tier: 4 },
  { name: 'Sean Tucker', position: 'RB', value: 3136, tier: 4 },
  { name: 'Tre Tucker', position: 'WR', value: 3130, tier: 4 },
  { name: 'Deebo Samuel', position: 'WR', value: 3130, tier: 4 },
  { name: 'Jordan Mason', position: 'RB', value: 3121, tier: 4 },
  { name: 'Elijah Arroyo', position: 'TE', value: 3083, tier: 4 },
  { name: 'Tez Johnson', position: 'WR', value: 3048, tier: 4 },
  { name: 'Mark Andrews', position: 'TE', value: 3046, tier: 4 },
  { name: 'Jonathon Brooks', position: 'RB', value: 3003, tier: 4 },
  { name: 'Keon Coleman', position: 'WR', value: 2967, tier: 5 },
  { name: 'Tank Bigsby', position: 'RB', value: 2964, tier: 5 },
  { name: 'Rachaad White', position: 'RB', value: 2956, tier: 5 },
  { name: 'Brashard Smith', position: 'RB', value: 2907, tier: 5 },
  { name: 'Kendre Miller', position: 'RB', value: 2906, tier: 5 },
  { name: 'Keaton Mitchell', position: 'RB', value: 2878, tier: 5 },
  { name: 'Marvin Mims', position: 'WR', value: 2878, tier: 5 },
  { name: 'Jack Bech', position: 'WR', value: 2866, tier: 5 },
  { name: 'Hunter Henry', position: 'TE', value: 2853, tier: 5 },
  { name: 'David Njoku', position: 'TE', value: 2815, tier: 5 },
  { name: 'Xavier Legette', position: 'WR', value: 2814, tier: 5 },
  { name: 'Isaiah Bond', position: 'WR', value: 2811, tier: 5 },
  { name: 'Brian Robinson', position: 'RB', value: 2806, tier: 5 },
  { name: 'Tank Dell', position: 'WR', value: 2786, tier: 5 },
  { name: 'Jaylen Wright', position: 'RB', value: 2786, tier: 5 },
  { name: 'Alvin Kamara', position: 'RB', value: 2773, tier: 5 },
  { name: 'Cade Otton', position: 'TE', value: 2726, tier: 5 },
  { name: 'Isiah Pacheco', position: 'RB', value: 2719, tier: 5 },
  { name: 'Juwan Johnson', position: 'TE', value: 2703, tier: 5 },
  { name: 'Isaiah Davis', position: 'RB', value: 2696, tier: 5 },
  { name: 'Gunnar Helm', position: 'TE', value: 2671, tier: 5 },
  { name: 'Chris Rodriguez', position: 'RB', value: 2668, tier: 5 },
  { name: 'Dalton Schultz', position: 'TE', value: 2664, tier: 5 },
  { name: 'Aaron Jones', position: 'RB', value: 2645, tier: 5 },
  { name: 'Malik Washington', position: 'WR', value: 2633, tier: 5 },
  { name: 'Cedric Tillman', position: 'WR', value: 2626, tier: 5 },
  { name: 'Demario Douglas', position: 'WR', value: 2625, tier: 5 },
  { name: 'Dontayvion Wicks', position: 'WR', value: 2617, tier: 5 },
  { name: 'Emanuel Wilson', position: 'RB', value: 2614, tier: 5 },
  { name: 'Michael Mayer', position: 'TE', value: 2590, tier: 5 },
  { name: 'Tyreek Hill', position: 'WR', value: 2571, tier: 5 },
  { name: "Dont'e Thornton", position: 'WR', value: 2519, tier: 5 },
  { name: 'Chigoziem Okonkwo', position: 'TE', value: 2503, tier: 5 },
  { name: 'Jaydon Blue', position: 'RB', value: 2495, tier: 5 },
  { name: "Ja'Tavion Sanders", position: 'TE', value: 2478, tier: 5 },
  { name: 'Jalen Milroe', position: 'QB', value: 2470, tier: 5 },
  { name: 'Justin Fields', position: 'QB', value: 2465, tier: 5 },
  { name: 'Darnell Mooney', position: 'WR', value: 2461, tier: 5 },
  { name: 'Rashod Bateman', position: 'WR', value: 2424, tier: 5 },
  { name: 'Cole Kmet', position: 'TE', value: 2392, tier: 5 },
  { name: 'Darnell Washington', position: 'TE', value: 2372, tier: 5 },
  { name: 'Trevor Etienne', position: 'RB', value: 2365, tier: 5 },
  { name: 'Pat Freiermuth', position: 'TE', value: 2364, tier: 5 },
  { name: 'Jaylin Lane', position: 'WR', value: 2358, tier: 5 },
  { name: 'John Metchie', position: 'WR', value: 2354, tier: 5 },
  { name: 'DJ Giddens', position: 'RB', value: 2342, tier: 5 },
  { name: 'Travis Kelce', position: 'TE', value: 2339, tier: 5 },
  { name: 'Ray Davis', position: 'RB', value: 2328, tier: 5 },
  { name: 'Tua Tagovailoa', position: 'QB', value: 2308, tier: 5 },
  { name: 'James Conner', position: 'RB', value: 2304, tier: 5 },
  { name: 'Tyler Shough', position: 'QB', value: 2274, tier: 5 },
  { name: 'Luke McCaffrey', position: 'WR', value: 2273, tier: 5 },
  { name: 'Ben Sinnott', position: 'TE', value: 2244, tier: 5 },
  { name: 'Bam Knight', position: 'RB', value: 2244, tier: 5 },
  { name: 'Xavier Hutchinson', position: 'WR', value: 2242, tier: 5 },
  { name: 'Jalen Nailor', position: 'WR', value: 2215, tier: 5 },
  { name: 'Keenan Allen', position: 'WR', value: 2199, tier: 5 },
  { name: 'Ryan Flournoy', position: 'WR', value: 2174, tier: 5 },
  { name: 'Luke Musgrave', position: 'TE', value: 2171, tier: 5 },
  { name: 'Tyquan Thornton', position: 'WR', value: 2167, tier: 5 },
  { name: 'Tahj Brooks', position: 'RB', value: 2150, tier: 5 },
  { name: 'Colby Parkinson', position: 'TE', value: 2146, tier: 5 },
  { name: 'LeQuint Allen', position: 'RB', value: 2133, tier: 5 },
  { name: 'Jake Tonges', position: 'TE', value: 2132, tier: 5 },
  { name: 'Calvin Austin III', position: 'WR', value: 2122, tier: 5 },
  { name: 'Roman Wilson', position: 'WR', value: 2111, tier: 5 },
  { name: 'Shedeur Sanders', position: 'QB', value: 2110, tier: 5 },
  { name: 'Evan Engram', position: 'TE', value: 2110, tier: 5 },
  { name: 'Andrei Iosivas', position: 'WR', value: 2103, tier: 5 },
  { name: 'Najee Harris', position: 'RB', value: 2100, tier: 5 },
  { name: 'Jalen Royals', position: 'WR', value: 2100, tier: 5 },
  { name: 'Darius Slayton', position: 'WR', value: 2073, tier: 5 },
  { name: 'Marquise Brown', position: 'WR', value: 2062, tier: 5 },
  { name: 'Mac Jones', position: 'QB', value: 2054, tier: 5 },
  { name: 'Anthony Richardson', position: 'QB', value: 2037, tier: 5 },
  { name: 'MarShawn Lloyd', position: 'RB', value: 2028, tier: 5 },
  { name: 'Audric Estime', position: 'RB', value: 2024, tier: 5 },
  { name: 'Jarquez Hunter', position: 'RB', value: 2021, tier: 5 },
  { name: 'Will Shipley', position: 'RB', value: 2012, tier: 5 },
  { name: 'Noah Gray', position: 'TE', value: 2009, tier: 5 },
  { name: 'Savion Williams', position: 'WR', value: 1971, tier: 6 },
  { name: 'Jimmy Horn', position: 'WR', value: 1969, tier: 6 },
  { name: 'Calvin Ridley', position: 'WR', value: 1969, tier: 6 },
  { name: 'Christian Kirk', position: 'WR', value: 1948, tier: 6 },
  { name: 'Devaughn Vele', position: 'WR', value: 1941, tier: 6 },
  { name: 'Kareem Hunt', position: 'RB', value: 1927, tier: 6 },
  { name: 'Devin Singletary', position: 'RB', value: 1893, tier: 6 },
  { name: 'Jordan James', position: 'RB', value: 1867, tier: 6 },
  { name: 'Jordan Whittington', position: 'WR', value: 1861, tier: 6 },
  { name: 'Jonnu Smith', position: 'TE', value: 1850, tier: 6 },
  { name: 'KeAndre Lambert-Smith', position: 'WR', value: 1828, tier: 6 },
  { name: 'Dawson Knox', position: 'TE', value: 1827, tier: 6 },
  { name: 'Joe Mixon', position: 'RB', value: 1816, tier: 6 },
  { name: 'Isaac Guerendo', position: 'RB', value: 1813, tier: 6 },
  { name: 'Cooper Kupp', position: 'WR', value: 1811, tier: 6 },
  { name: 'Emari Demercado', position: 'RB', value: 1801, tier: 6 },
  { name: 'Michael Carter', position: 'RB', value: 1776, tier: 6 },
  { name: 'Dillon Gabriel', position: 'QB', value: 1771, tier: 6 },
  { name: 'Jaleel McLaughlin', position: 'RB', value: 1766, tier: 6 },
  { name: 'Joshua Palmer', position: 'WR', value: 1739, tier: 6 },
  { name: 'Ty Johnson', position: 'RB', value: 1722, tier: 6 },
  { name: 'Jalen Tolbert', position: 'WR', value: 1708, tier: 6 },
  { name: 'Jahan Dotson', position: 'WR', value: 1705, tier: 6 },
  { name: 'Tommy Tremble', position: 'TE', value: 1694, tier: 6 },
  { name: 'Kendrick Bourne', position: 'WR', value: 1689, tier: 6 },
  { name: 'Malik Davis', position: 'RB', value: 1677, tier: 6 },
  { name: 'Xavier Restrepo', position: 'WR', value: 1655, tier: 6 },
  { name: 'Noah Fant', position: 'TE', value: 1650, tier: 6 },
  { name: 'Treylon Burks', position: 'WR', value: 1642, tier: 6 },
  { name: 'Jerome Ford', position: 'RB', value: 1642, tier: 6 },
  { name: 'Tutu Atwell', position: 'WR', value: 1613, tier: 6 },
  { name: 'Greg Dortch', position: 'WR', value: 1592, tier: 6 },
  { name: 'Aaron Rodgers', position: 'QB', value: 1589, tier: 6 },
  { name: 'Greg Dulcich', position: 'TE', value: 1575, tier: 6 },
  { name: 'Dyami Brown', position: 'WR', value: 1574, tier: 6 },
  { name: 'Cade Stover', position: 'TE', value: 1566, tier: 6 },
  { name: 'Tyrell Shavers', position: 'WR', value: 1553, tier: 6 },
  { name: 'Roschon Johnson', position: 'RB', value: 1549, tier: 6 },
  { name: 'Mike Gesicki', position: 'TE', value: 1537, tier: 6 },
  { name: 'Efton Chism', position: 'WR', value: 1528, tier: 6 },
  { name: 'Jalin Hyatt', position: 'WR', value: 1528, tier: 6 },
  { name: 'Devontez Walker', position: 'WR', value: 1525, tier: 6 },
  { name: 'Geno Smith', position: 'QB', value: 1504, tier: 6 },
  { name: 'Daniel Bellinger', position: 'TE', value: 1501, tier: 6 },
  { name: 'Darren Waller', position: 'TE', value: 1500, tier: 6 },
  { name: 'Kameron Johnson', position: 'WR', value: 1482, tier: 6 },
  { name: 'Justice Hill', position: 'RB', value: 1480, tier: 6 },
  { name: 'Joe Milton', position: 'QB', value: 1479, tier: 6 },
  { name: 'Olamide Zaccheaus', position: 'WR', value: 1473, tier: 6 },
  { name: 'Trey Palmer', position: 'WR', value: 1465, tier: 6 },
  { name: 'KaVontae Turpin', position: 'WR', value: 1463, tier: 6 },
  { name: 'Konata Mumpfield', position: 'WR', value: 1451, tier: 6 },
  { name: 'Raheim Sanders', position: 'RB', value: 1447, tier: 6 },
  { name: 'Malachi Corley', position: 'WR', value: 1426, tier: 6 },
  { name: "Ja'Lynn Polk", position: 'WR', value: 1416, tier: 6 },
  { name: 'Quinn Ewers', position: 'QB', value: 1405, tier: 6 },
  { name: 'Kalel Mullings', position: 'RB', value: 1393, tier: 6 },
  { name: 'Tyler Badie', position: 'RB', value: 1392, tier: 6 },
  { name: 'Davis Allen', position: 'TE', value: 1389, tier: 6 },
  { name: 'Gabriel Davis', position: 'WR', value: 1378, tier: 6 },
  { name: 'Tai Felton', position: 'WR', value: 1364, tier: 6 },
  { name: 'Will Howard', position: 'QB', value: 1363, tier: 6 },
  { name: 'Phil Mafah', position: 'RB', value: 1361, tier: 6 },
  { name: 'Rasheen Ali', position: 'RB', value: 1358, tier: 6 },
  { name: 'Spencer Rattler', position: 'QB', value: 1350, tier: 6 },
  { name: 'Zach Ertz', position: 'TE', value: 1350, tier: 6 },
  { name: 'Mack Hollins', position: 'WR', value: 1349, tier: 6 },
  { name: 'Tyler Goodson', position: 'RB', value: 1340, tier: 6 },
  { name: 'Damien Martinez', position: 'RB', value: 1332, tier: 6 },
  { name: 'Elijah Higgins', position: 'TE', value: 1328, tier: 6 },
  { name: 'Erick All', position: 'TE', value: 1326, tier: 6 },
  { name: 'Elijah Moore', position: 'WR', value: 1313, tier: 6 },
  { name: 'Tahj Washington', position: 'WR', value: 1298, tier: 6 },
  { name: 'Chris Brooks', position: 'RB', value: 1293, tier: 6 },
  { name: 'Luke Schoonmaker', position: 'TE', value: 1292, tier: 6 },
  { name: 'Tyler Higbee', position: 'TE', value: 1286, tier: 6 },
  { name: 'Nick Chubb', position: 'RB', value: 1280, tier: 6 },
  { name: 'Dameon Pierce', position: 'RB', value: 1265, tier: 6 },
  { name: 'Isaiah Hodgins', position: 'WR', value: 1256, tier: 6 },
  { name: 'Arian Smith', position: 'WR', value: 1247, tier: 6 },
  { name: 'Jordan Watkins', position: 'WR', value: 1245, tier: 6 },
  { name: 'Terrell Jennings', position: 'RB', value: 1243, tier: 6 },
  { name: 'Malik Willis', position: 'QB', value: 1230, tier: 6 },
  { name: 'Javon Baker', position: 'WR', value: 1211, tier: 6 },
  { name: 'Jeremy McNichols', position: 'RB', value: 1196, tier: 6 },
  { name: 'Jacob Cowing', position: 'WR', value: 1186, tier: 6 },
  { name: 'Jonathan Mingo', position: 'WR', value: 1184, tier: 6 },
  { name: 'Mitchell Evans', position: 'TE', value: 1168, tier: 6 },
  { name: 'Donovan Edwards', position: 'RB', value: 1167, tier: 6 },
  { name: 'Hassan Haskins', position: 'RB', value: 1166, tier: 6 },
  { name: "Lil'Jordan Humphrey", position: 'WR', value: 1151, tier: 6 },
  { name: 'Brock Wright', position: 'TE', value: 1150, tier: 6 },
  { name: 'Tyler Johnson', position: 'WR', value: 1143, tier: 6 },
  { name: 'Jacoby Brissett', position: 'QB', value: 1141, tier: 6 },
  { name: 'JuJu Smith-Schuster', position: 'WR', value: 1131, tier: 6 },
  { name: 'Joe Flacco', position: 'QB', value: 1131, tier: 6 },
  { name: 'Jameis Winston', position: 'QB', value: 1129, tier: 6 },
  { name: 'Samaje Perine', position: 'RB', value: 1121, tier: 6 },
  { name: 'Skyy Moore', position: 'WR', value: 1121, tier: 6 },
  { name: 'Mason Tipton', position: 'WR', value: 1114, tier: 6 },
  { name: 'Bo Melton', position: 'WR', value: 1113, tier: 6 },
  { name: 'Brevin Jordan', position: 'TE', value: 1106, tier: 6 },
  { name: 'Rondale Moore', position: 'WR', value: 1101, tier: 6 },
  { name: 'Nick Westbrook-Ikhine', position: 'WR', value: 1081, tier: 6 },
  { name: 'Marcus Mariota', position: 'QB', value: 1079, tier: 6 },
  { name: 'Israel Abanikanda', position: 'RB', value: 1076, tier: 6 },
  { name: 'Zavier Scott', position: 'RB', value: 1064, tier: 6 },
  { name: 'Deuce Vaughn', position: 'RB', value: 1060, tier: 6 },
  { name: 'Curtis Samuel', position: 'WR', value: 1056, tier: 6 },
  { name: 'Ainias Smith', position: 'WR', value: 1055, tier: 6 },
  { name: 'Miles Sanders', position: 'RB', value: 1052, tier: 6 },
  { name: 'Antonio Gibson', position: 'RB', value: 1046, tier: 6 },
  { name: 'Jamari Thrash', position: 'WR', value: 1045, tier: 6 },
  { name: 'Sterling Shepard', position: 'WR', value: 1041, tier: 6 },
  { name: 'Zamir White', position: 'RB', value: 1026, tier: 6 },
  { name: 'DeAndre Hopkins', position: 'WR', value: 1022, tier: 6 },
  { name: 'Jake Bobo', position: 'WR', value: 1020, tier: 6 },
  { name: 'Ty Chandler', position: 'RB', value: 1018, tier: 6 },
  { name: 'Xavier Gipson', position: 'WR', value: 1011, tier: 6 },
  { name: 'Jermaine Burton', position: 'WR', value: 1009, tier: 6 },
  { name: 'Jeremy Ruckert', position: 'TE', value: 1008, tier: 6 },
  { name: 'Jared Wiley', position: 'TE', value: 1007, tier: 6 },
  { name: 'Will Dissly', position: 'TE', value: 1003, tier: 6 },
  { name: 'Tyler Scott', position: 'WR', value: 998, tier: 6 },
  { name: 'Elijah Mitchell', position: 'RB', value: 991, tier: 6 },
  { name: 'Demarcus Robinson', position: 'WR', value: 986, tier: 6 },
  { name: 'Frank Gore Jr.', position: 'RB', value: 981, tier: 6 },
  { name: 'Noah Brown', position: 'WR', value: 975, tier: 6 },
  { name: 'Johnny Wilson', position: 'WR', value: 968, tier: 6 },
  { name: 'Josh Oliver', position: 'TE', value: 963, tier: 6 },
  { name: 'Cam Akers', position: 'RB', value: 963, tier: 6 },
  { name: 'Bub Means', position: 'WR', value: 959, tier: 6 },
  { name: 'Zay Jones', position: 'WR', value: 955, tier: 6 },
  { name: 'Tylan Wallace', position: 'WR', value: 947, tier: 6 },
  { name: 'Riley Leonard', position: 'QB', value: 945, tier: 6 },
  { name: 'Adam Trautman', position: 'TE', value: 941, tier: 6 },
  { name: 'Grant Calcaterra', position: 'TE', value: 930, tier: 6 },
  { name: 'Julius Chestnut', position: 'RB', value: 927, tier: 6 },
  { name: 'George Holani', position: 'RB', value: 915, tier: 6 },
  { name: 'Brenden Rice', position: 'WR', value: 899, tier: 6 },
  { name: 'AJ Dillon', position: 'RB', value: 898, tier: 6 },
  { name: 'Khalil Herbert', position: 'RB', value: 893, tier: 6 },
  { name: 'Kirk Cousins', position: 'QB', value: 889, tier: 6 },
  { name: 'Kendall Milton', position: 'RB', value: 884, tier: 6 },
  { name: 'Derius Davis', position: 'WR', value: 875, tier: 6 },
  { name: 'Dylan Laube', position: 'RB', value: 858, tier: 6 },
  { name: 'Sione Vaki', position: 'RB', value: 857, tier: 6 },
  { name: 'Tyler Lockett', position: 'WR', value: 855, tier: 6 },
  { name: 'Van Jefferson', position: 'WR', value: 854, tier: 6 },
  { name: 'Malik Heath', position: 'WR', value: 850, tier: 6 },
  { name: 'Tyler Conklin', position: 'TE', value: 846, tier: 6 },
  { name: 'Kenny McIntosh', position: 'RB', value: 846, tier: 6 },
  { name: 'Jake Browning', position: 'QB', value: 845, tier: 6 },
  { name: 'Tim Patrick', position: 'WR', value: 843, tier: 6 },
  { name: 'Alexander Mattison', position: 'RB', value: 815, tier: 6 },
  { name: 'Taysom Hill', position: 'TE', value: 814, tier: 6 },
  { name: 'Trey Lance', position: 'QB', value: 810, tier: 6 },
  { name: 'Charlie Kolar', position: 'TE', value: 797, tier: 6 },
  { name: 'LaJohntay Wester', position: 'WR', value: 796, tier: 6 },
  { name: 'Harrison Bryant', position: 'TE', value: 781, tier: 6 },
  { name: 'Ray-Ray McCloud', position: 'WR', value: 780, tier: 6 },
  { name: 'Mecole Hardman', position: 'WR', value: 764, tier: 6 },
  { name: 'Josh Reynolds', position: 'WR', value: 751, tier: 6 },
  { name: 'Hunter Long', position: 'TE', value: 747, tier: 6 },
  { name: 'David Bell', position: 'WR', value: 742, tier: 6 },
  { name: 'Jawhar Jordan', position: 'RB', value: 738, tier: 6 },
  { name: 'Sam Howell', position: 'QB', value: 717, tier: 6 },
  { name: 'Kenny Pickett', position: 'QB', value: 698, tier: 6 },
  { name: 'Thomas Fidone', position: 'TE', value: 663, tier: 6 },
  { name: 'Carson Wentz', position: 'QB', value: 660, tier: 6 },
  { name: 'Foster Moreau', position: 'TE', value: 649, tier: 6 },
  { name: 'Zach Wilson', position: 'QB', value: 640, tier: 6 },
  { name: 'Brandin Cooks', position: 'WR', value: 640, tier: 6 },
  { name: 'Kalif Raymond', position: 'WR', value: 638, tier: 6 },
  { name: 'Tyler Huntley', position: 'QB', value: 589, tier: 6 },
  { name: 'Trayveon Williams', position: 'RB', value: 587, tier: 6 },
  { name: 'Ben Skowronek', position: 'WR', value: 584, tier: 6 },
  { name: 'Eric Gray', position: 'RB', value: 574, tier: 6 },
  { name: 'Devin Duvernay', position: 'WR', value: 561, tier: 6 },
  { name: 'Austin Hooper', position: 'TE', value: 551, tier: 6 },
  { name: 'Trey Sermon', position: 'RB', value: 546, tier: 6 },
  { name: "Aidan O'Connell", position: 'QB', value: 539, tier: 6 },
  { name: 'Rakim Jarrett', position: 'WR', value: 534, tier: 6 },
  { name: 'Sincere McCormick', position: 'RB', value: 514, tier: 6 },
  { name: 'Will Levis', position: 'QB', value: 512, tier: 6 },
  { name: 'Hunter Renfrow', position: 'WR', value: 501, tier: 6 },
  { name: 'Jalen Reagor', position: 'WR', value: 493, tier: 6 },
  { name: 'Ashton Dulin', position: 'WR', value: 485, tier: 6 },
  { name: 'Jelani Woods', position: 'TE', value: 482, tier: 6 },
  { name: 'Justin Shorter', position: 'WR', value: 468, tier: 6 },
  { name: 'Travis Homer', position: 'RB', value: 460, tier: 6 },
  { name: 'Tanner McKee', position: 'QB', value: 446, tier: 6 },
  { name: 'Pierre Strong Jr.', position: 'RB', value: 435, tier: 6 },
  { name: 'Mason Rudolph', position: 'QB', value: 406, tier: 6 },
  { name: 'Jaheim Bell', position: 'TE', value: 403, tier: 6 },
  { name: 'Drew Lock', position: 'QB', value: 395, tier: 6 },
  { name: 'DeeJay Dallas', position: 'RB', value: 384, tier: 6 },
  { name: 'Malik Cunningham', position: 'WR', value: 376, tier: 6 },
  { name: 'Josh Whyle', position: 'TE', value: 369, tier: 6 },
  { name: 'Hendon Hooker', position: 'QB', value: 368, tier: 6 },
  { name: 'Gardner Minshew', position: 'QB', value: 367, tier: 6 },
  { name: 'Hayden Hurst', position: 'TE', value: 365, tier: 6 },
  { name: 'Will Mallory', position: 'TE', value: 358, tier: 6 },
  { name: 'Tyson Bagent', position: 'QB', value: 253, tier: 6 },
  { name: 'Kyle McCord', position: 'QB', value: 248, tier: 6 },
  { name: 'Davis Mills', position: 'QB', value: 235, tier: 6 },
  { name: 'Tyrod Taylor', position: 'QB', value: 234, tier: 6 },
  { name: 'Stetson Bennett', position: 'QB', value: 226, tier: 6 },
  { name: 'Bailey Zappe', position: 'QB', value: 225, tier: 6 },
  { name: 'Mitchell Trubisky', position: 'QB', value: 217, tier: 6 },
  { name: 'Jimmy Garoppolo', position: 'QB', value: 102, tier: 6 },
  { name: 'Philip Rivers', position: 'QB', value: 100, tier: 6 },
  { name: 'Cam Miller', position: 'QB', value: 92, tier: 6 },
]

// Normalize player names for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Remove common name suffixes for flexible matching
function stripSuffix(name: string): string {
  return name
    .replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, '')
    .trim()
}

// Get player value by name
export function getPlayerValue(playerName: string): number {
  const normalized = normalizeName(playerName)

  // Try exact match first
  let match = PLAYER_VALUES.find(
    (p) => normalizeName(p.name) === normalized
  )

  if (match) {
    return match.value
  }

  // Try matching without suffixes (e.g., "Kenneth Walker" matches "Kenneth Walker III")
  const strippedInput = stripSuffix(normalized)
  match = PLAYER_VALUES.find(
    (p) => stripSuffix(normalizeName(p.name)) === strippedInput
  )

  if (match) {
    return match.value
  }

  // For unranked players, return a default low value
  return 500
}

// Get player tier
export function getPlayerTier(playerName: string): number | null {
  const normalized = normalizeName(playerName)

  // Try exact match first
  let match = PLAYER_VALUES.find(
    (p) => normalizeName(p.name) === normalized
  )

  if (!match) {
    // Try matching without suffixes
    const strippedInput = stripSuffix(normalized)
    match = PLAYER_VALUES.find(
      (p) => stripSuffix(normalizeName(p.name)) === strippedInput
    )
  }

  return match?.tier || null
}

// Get all player values (for display purposes)
export function getAllPlayerValues(): PlayerValue[] {
  return [...PLAYER_VALUES].sort((a, b) => b.value - a.value)
}

// Match Sleeper player to value
export function getSleeperPlayerValue(
  firstName: string,
  lastName: string,
  position: string,
  team: string | null
): number {
  // Try full name match first
  const fullName = `${firstName} ${lastName}`
  const value = getPlayerValue(fullName)

  if (value > 500) {
    return value
  }

  // For DEF, try team name
  if (position === 'DEF' && team) {
    const defValue = getPlayerValue(team)
    if (defValue > 500) {
      return defValue
    }
  }

  // Return position-based default for unranked players
  const positionDefaults: Record<string, number> = {
    QB: 500,
    RB: 500,
    WR: 500,
    TE: 500,
    K: 100,
    DEF: 100,
  }

  return positionDefaults[position] || 100
}

// Calculate trade fairness
export function calculateTradeFairness(
  team1Total: number,
  team2Total: number
): 'fair' | 'slight_advantage' | 'unfair' {
  const diff = Math.abs(team1Total - team2Total)
  const avgValue = (team1Total + team2Total) / 2
  const percentDiff = (diff / avgValue) * 100

  if (percentDiff <= 10) return 'fair'
  if (percentDiff <= 25) return 'slight_advantage'
  return 'unfair'
}

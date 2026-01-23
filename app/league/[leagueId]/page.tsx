import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getMatchups,
  getCurrentWeek,
  getWinnersBracket,
  getChampionRosterId,
} from '@/lib/sleeper'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function LeagueOverview({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ userId?: string }>
}) {
  const { leagueId } = await params
  const { userId } = await searchParams
  const currentWeek = getCurrentWeek()

  // Fetch all weeks' matchups for season high score
  const weekNumbers = Array.from({ length: currentWeek }, (_, i) => i + 1)

  const [league, rosters, users, winnersBracket, ...allWeeksMatchups] = await Promise.all([
    getLeague(leagueId),
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
    getWinnersBracket(leagueId),
    ...weekNumbers.map(week => getMatchups(leagueId, week)),
  ])

  const matchups = allWeeksMatchups[currentWeek - 1] || []

  // Get the actual champion's roster_id from the playoff bracket
  const championRosterId = getChampionRosterId(winnersBracket)

  if (!league) {
    notFound()
  }

  // Map users to rosters
  const userMap = new Map(users.map((u) => [u.user_id, u]))
  const rostersWithUsers = rosters.map((roster) => ({
    ...roster,
    user: userMap.get(roster.owner_id),
  }))

  // Sort by wins then points
  const standings = [...rostersWithUsers].sort((a, b) => {
    if (b.settings.wins !== a.settings.wins) {
      return b.settings.wins - a.settings.wins
    }
    return (
      b.settings.fpts + b.settings.fpts_decimal / 100 -
      (a.settings.fpts + a.settings.fpts_decimal / 100)
    )
  })

  // Get top scorer this week
  const topScorer = matchups.reduce(
    (top, m) => (m.points > (top?.points || 0) ? m : top),
    null as (typeof matchups)[0] | null
  )
  const topScorerRoster = topScorer
    ? rostersWithUsers.find((r) => r.roster_id === topScorer.roster_id)
    : null

  // Get season high score across all weeks
  const seasonHigh = allWeeksMatchups.reduce(
    (best, weekMatchups, weekIndex) => {
      const weekTop = weekMatchups.reduce(
        (top, m) => (m.points > (top?.points || 0) ? m : top),
        null as (typeof matchups)[0] | null
      )
      if (weekTop && weekTop.points > (best?.points || 0)) {
        return { ...weekTop, week: weekIndex + 1 }
      }
      return best
    },
    null as ((typeof matchups)[0] & { week: number }) | null
  )
  const seasonHighRoster = seasonHigh
    ? rostersWithUsers.find((r) => r.roster_id === seasonHigh.roster_id)
    : null

  // Calculate league totals
  const totalPoints = rosters.reduce(
    (sum, r) => sum + r.settings.fpts + r.settings.fpts_decimal / 100,
    0
  )
  const avgPointsPerTeam = totalPoints / rosters.length

  // Determine scoring format from scoring_settings
  const scoringSettings = league.scoring_settings || {}
  const recPoints = scoringSettings.rec || 0
  const scoringFormat = recPoints === 1 ? 'PPR' : recPoints === 0.5 ? 'Half PPR' : recPoints === 0 ? 'Standard' : `${recPoints} PPR`

  // Check for superflex (QB in flex spots)
  const rosterPositions = league.roster_positions || []
  const hasSuperFlex = rosterPositions.includes('SUPER_FLEX')
  const hasTE_Premium = (scoringSettings.bonus_rec_te || 0) > 0

  // Build format string
  const formatParts = [scoringFormat]
  if (hasSuperFlex) formatParts.push('SF')
  if (hasTE_Premium) formatParts.push('TEP')

  // Helper to get team name from roster_id
  const getTeamName = (rosterId: number | null) => {
    if (!rosterId) return 'TBD'
    const roster = rostersWithUsers.find(r => r.roster_id === rosterId)
    return roster?.user?.metadata?.team_name || roster?.user?.display_name || 'Unknown'
  }

  // Group bracket by rounds
  const bracketByRound = winnersBracket.reduce((acc, matchup) => {
    if (!acc[matchup.r]) acc[matchup.r] = []
    acc[matchup.r].push(matchup)
    return acc
  }, {} as Record<number, typeof winnersBracket>)

  const rounds = Object.keys(bracketByRound).map(Number).sort((a, b) => a - b)
  const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0

  // Round names based on how many rounds
  const getRoundName = (round: number) => {
    const roundsFromEnd = maxRound - round
    if (roundsFromEnd === 0) return 'Championship'
    if (roundsFromEnd === 1) return 'Semifinals'
    if (roundsFromEnd === 2) return 'Quarterfinals'
    return `Round ${round}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-1">{league.name}</h1>
        <p className="text-gray-400">
          {league.season} Season &bull; {league.total_rosters} Teams &bull; Week{' '}
          {currentWeek} &bull; {formatParts.join(' / ')}
        </p>
      </div>

      {/* Compact Stat Bar */}
      <div className="flex flex-wrap gap-6 py-4 px-5 bg-gray-800 rounded-lg border-l-4 border-l-amber-500">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            {championRosterId ? 'Champion' : 'Leader'}
          </p>
          <p className="font-semibold flex items-center gap-1.5">
            {championRosterId && (
              <svg
                className="w-4 h-4 text-amber-500"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
              </svg>
            )}
            {championRosterId
              ? rostersWithUsers.find(r => r.roster_id === championRosterId)?.user?.display_name || 'Unknown'
              : standings[0]?.user?.display_name || 'Unknown'}
          </p>
        </div>
        <div className="hidden sm:block w-px bg-gray-700"></div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Week {currentWeek} Top</p>
          <p className="font-semibold">
            {topScorerRoster?.user?.display_name || 'N/A'}{' '}
            <span className="text-amber-500">{topScorer?.points.toFixed(1) || '0'}</span>
          </p>
        </div>
        <div className="hidden sm:block w-px bg-gray-700"></div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Season High</p>
          <p className="font-semibold">
            {seasonHighRoster?.user?.display_name || 'N/A'}{' '}
            <span className="text-amber-500">{seasonHigh?.points.toFixed(1) || '0'}</span>
            {seasonHigh && <span className="text-gray-500 text-xs ml-1">(Wk {seasonHigh.week})</span>}
          </p>
        </div>
        <div className="hidden sm:block w-px bg-gray-700"></div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Points</p>
          <p className="font-semibold">{avgPointsPerTeam.toFixed(1)}</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/league/${leagueId}/trade${userId ? `?userId=${userId}` : ''}`}
          className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-amber-500 transition-colors text-center group"
        >
          <p className="text-2xl mb-1 group-hover:text-amber-500 transition-colors">Trade</p>
          <p className="text-gray-500 text-sm">Analyzer</p>
        </Link>

        <Link
          href={`/league/${leagueId}/matchups${userId ? `?userId=${userId}` : ''}`}
          className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-amber-500 transition-colors text-center group"
        >
          <p className="text-2xl mb-1 group-hover:text-amber-500 transition-colors">Wk {currentWeek}</p>
          <p className="text-gray-500 text-sm">Matchups</p>
        </Link>
      </div>

      {/* Standings Table - Open Design */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Standings</h2>
        <div className="overflow-hidden rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800 text-left">
                <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium w-12">#</th>
                <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Team</th>
                <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-center">Record</th>
                <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {standings.map((roster, index) => {
                const isUserTeam = userId && (roster.owner_id === userId || roster.user?.user_id === userId)
                return (
                  <tr
                    key={roster.roster_id}
                    className={`${
                      isUserTeam
                        ? 'bg-amber-500/10 border-l-4 border-l-amber-500'
                        : 'hover:bg-gray-800/50'
                    } transition-colors`}
                  >
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                          index === 0
                            ? 'bg-amber-500 text-gray-900'
                            : index === 1
                            ? 'bg-gray-400 text-gray-900'
                            : index === 2
                            ? 'bg-amber-700 text-white'
                            : 'text-gray-500'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium flex items-center gap-1.5">
                        {roster.user?.metadata?.team_name ||
                          roster.user?.display_name ||
                          'Unknown Team'}
                        {championRosterId === roster.roster_id && (
                          <svg
                            className="w-4 h-4 text-amber-500"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <title>League Champion</title>
                            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                          </svg>
                        )}
                      </p>
                      {roster.user?.metadata?.team_name && roster.user?.display_name && (
                        <p className="text-gray-500 text-sm">{roster.user.display_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center font-semibold">
                      {roster.settings.wins}-{roster.settings.losses}
                      {roster.settings.ties > 0 && `-${roster.settings.ties}`}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-medium text-emerald-500">
                        {(roster.settings.fpts + roster.settings.fpts_decimal / 100).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Playoff Bracket */}
      {winnersBracket.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Playoff Bracket</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-4">
              {rounds.map((round) => (
                <div key={round} className="flex flex-col">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2 text-center">
                    {getRoundName(round)}
                  </p>
                  <div className="flex flex-col gap-3 justify-around flex-1">
                    {bracketByRound[round]
                      .sort((a, b) => a.m - b.m)
                      .map((matchup) => (
                        <div
                          key={matchup.m}
                          className="bg-gray-800 rounded-lg border border-gray-700 w-48 overflow-hidden"
                        >
                          {/* Team 1 */}
                          <div
                            className={`px-3 py-2 flex items-center justify-between ${
                              matchup.w === matchup.t1
                                ? 'bg-emerald-900/30 border-l-2 border-l-emerald-500'
                                : matchup.w && matchup.w !== matchup.t1
                                ? 'opacity-50'
                                : ''
                            }`}
                          >
                            <span className="text-sm font-medium truncate flex items-center gap-1.5">
                              {getTeamName(matchup.t1)}
                              {matchup.w === matchup.t1 && round === maxRound && (
                                <svg
                                  className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                                </svg>
                              )}
                            </span>
                            {matchup.w === matchup.t1 && (
                              <span className="text-xs text-emerald-500 font-semibold">W</span>
                            )}
                          </div>
                          <div className="border-t border-gray-700" />
                          {/* Team 2 */}
                          <div
                            className={`px-3 py-2 flex items-center justify-between ${
                              matchup.w === matchup.t2
                                ? 'bg-emerald-900/30 border-l-2 border-l-emerald-500'
                                : matchup.w && matchup.w !== matchup.t2
                                ? 'opacity-50'
                                : ''
                            }`}
                          >
                            <span className="text-sm font-medium truncate flex items-center gap-1.5">
                              {getTeamName(matchup.t2)}
                              {matchup.w === matchup.t2 && round === maxRound && (
                                <svg
                                  className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                                </svg>
                              )}
                            </span>
                            {matchup.w === matchup.t2 && (
                              <span className="text-xs text-emerald-500 font-semibold">W</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

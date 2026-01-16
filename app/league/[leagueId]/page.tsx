import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getMatchups,
  getCurrentWeek,
} from '@/lib/sleeper'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function LeagueOverview({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const [league, rosters, users, matchups] = await Promise.all([
    getLeague(leagueId),
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
    getMatchups(leagueId, getCurrentWeek()),
  ])

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

  // Calculate league totals
  const totalPoints = rosters.reduce(
    (sum, r) => sum + r.settings.fpts + r.settings.fpts_decimal / 100,
    0
  )
  const avgPointsPerTeam = totalPoints / rosters.length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">{league.name}</h1>
        <p className="text-gray-400">
          {league.season} Season &bull; {league.total_rosters} Teams &bull; Week{' '}
          {getCurrentWeek()}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent">
          <p className="text-gray-400 text-sm mb-1">League Leader</p>
          <p className="text-xl font-bold">
            {standings[0]?.user?.display_name || 'Unknown'}
          </p>
          <p className="text-gray-400 text-sm">
            {standings[0]?.settings.wins}-{standings[0]?.settings.losses}
            {standings[0]?.settings.ties > 0 && `-${standings[0]?.settings.ties}`}
          </p>
        </div>

        <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent">
          <p className="text-gray-400 text-sm mb-1">Top Scorer This Week</p>
          <p className="text-xl font-bold">
            {topScorerRoster?.user?.display_name || 'N/A'}
          </p>
          <p className="text-sleeper-highlight font-semibold">
            {topScorer?.points.toFixed(2) || '0.00'} pts
          </p>
        </div>

        <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent">
          <p className="text-gray-400 text-sm mb-1">League Average</p>
          <p className="text-xl font-bold">{avgPointsPerTeam.toFixed(1)} pts</p>
          <p className="text-gray-400 text-sm">per team total</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href={`/league/${leagueId}/standings`}
          className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent hover:border-sleeper-highlight transition-colors text-center"
        >
          <p className="text-2xl mb-2">1st</p>
          <p className="text-gray-400 text-sm">View Standings</p>
        </Link>

        <Link
          href={`/league/${leagueId}/teams`}
          className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent hover:border-sleeper-highlight transition-colors text-center"
        >
          <p className="text-2xl mb-2">{league.total_rosters}</p>
          <p className="text-gray-400 text-sm">View Teams</p>
        </Link>

        <Link
          href={`/league/${leagueId}/trade`}
          className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent hover:border-sleeper-highlight transition-colors text-center"
        >
          <p className="text-2xl mb-2">Trade</p>
          <p className="text-gray-400 text-sm">Analyzer</p>
        </Link>

        <Link
          href={`/league/${leagueId}/matchups`}
          className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent hover:border-sleeper-highlight transition-colors text-center"
        >
          <p className="text-2xl mb-2">Wk {getCurrentWeek()}</p>
          <p className="text-gray-400 text-sm">Matchups</p>
        </Link>
      </div>

      {/* Standings Preview */}
      <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
        <div className="p-4 border-b border-sleeper-accent flex justify-between items-center">
          <h2 className="font-semibold">Standings</h2>
          <Link
            href={`/league/${leagueId}/standings`}
            className="text-sleeper-highlight text-sm hover:underline"
          >
            View All &rarr;
          </Link>
        </div>
        <div className="divide-y divide-sleeper-accent">
          {standings.slice(0, 5).map((roster, index) => (
            <div
              key={roster.roster_id}
              className="px-4 py-3 flex items-center gap-4"
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0
                    ? 'bg-yellow-500 text-black'
                    : index === 1
                    ? 'bg-gray-400 text-black'
                    : index === 2
                    ? 'bg-amber-700 text-white'
                    : 'bg-sleeper-accent text-gray-400'
                }`}
              >
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium">
                  {roster.user?.metadata?.team_name ||
                    roster.user?.display_name ||
                    'Unknown Team'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {roster.settings.wins}-{roster.settings.losses}
                  {roster.settings.ties > 0 && `-${roster.settings.ties}`}
                </p>
                <p className="text-gray-400 text-sm">
                  {(
                    roster.settings.fpts +
                    roster.settings.fpts_decimal / 100
                  ).toFixed(1)}{' '}
                  pts
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { getLeague, getLeagueRosters, getLeagueUsers } from '@/lib/sleeper'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'

export const dynamic = 'force-dynamic'

export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ userId?: string }>
}) {
  const { leagueId } = await params
  const { userId } = await searchParams
  const [league, rosters, users] = await Promise.all([
    getLeague(leagueId),
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
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

  // Sort by wins, then points for
  const standings = [...rostersWithUsers].sort((a, b) => {
    if (b.settings.wins !== a.settings.wins) {
      return b.settings.wins - a.settings.wins
    }
    return (
      b.settings.fpts + b.settings.fpts_decimal / 100 -
      (a.settings.fpts + a.settings.fpts_decimal / 100)
    )
  })

  const playoffTeams = league.settings?.playoff_teams || 6

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        subtitle={`Top ${playoffTeams} teams make the playoffs`}
        icon="teams"
      />

      <div className="overflow-x-auto rounded-lg">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="bg-gray-800 text-left">
              <th className="px-3 sm:px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                #
              </th>
              <th className="px-3 sm:px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
                Team
              </th>
              <th className="px-3 sm:px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-center">
                Record
              </th>
              <th className="px-3 sm:px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right hidden sm:table-cell">
                Win %
              </th>
              <th className="px-3 sm:px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right">
                PF
              </th>
              <th className="px-3 sm:px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right hidden sm:table-cell">
                PA
              </th>
              <th className="px-3 sm:px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-right hidden sm:table-cell">
                +/-
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {standings.map((roster, index) => {
              const totalGames =
                roster.settings.wins + roster.settings.losses + roster.settings.ties
              const winPct =
                totalGames > 0
                  ? (roster.settings.wins / totalGames) * 100
                  : 0
              const pointsFor =
                roster.settings.fpts + roster.settings.fpts_decimal / 100
              const pointsAgainst =
                roster.settings.fpts_against +
                roster.settings.fpts_against_decimal / 100
              const diff = pointsFor - pointsAgainst
              const inPlayoffs = index < playoffTeams
              const isUserTeam = userId && (roster.owner_id === userId || roster.user?.user_id === userId)

              return (
                <tr
                  key={roster.roster_id}
                  className={`${
                    isUserTeam
                      ? 'bg-amber-500/10 border-l-4 border-l-amber-500'
                      : inPlayoffs
                      ? 'border-l-4 border-l-emerald-500'
                      : 'border-l-4 border-l-transparent'
                  } hover:bg-gray-800/50 transition-colors`}
                >
                  <td className="px-3 sm:px-4 py-4">
                    <span className="text-gray-400 font-medium">
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-4">
                    <Link
                      href={`/league/${leagueId}/team/${roster.roster_id}${userId ? `?userId=${userId}` : ''}`}
                      className="block hover:text-amber-500 transition-colors"
                    >
                      <p className="font-medium text-sm sm:text-base truncate max-w-[140px] sm:max-w-none">
                        {roster.user?.metadata?.team_name ||
                          roster.user?.display_name ||
                          'Unknown Team'}
                      </p>
                      {roster.user?.display_name &&
                        roster.user?.metadata?.team_name && (
                          <p className="text-gray-500 text-xs sm:text-sm truncate max-w-[140px] sm:max-w-none">
                            {roster.user.display_name}
                          </p>
                        )}
                    </Link>
                  </td>
                  <td className="px-3 sm:px-4 py-4 text-center font-semibold">
                    {roster.settings.wins}-{roster.settings.losses}
                    {roster.settings.ties > 0 && `-${roster.settings.ties}`}
                  </td>
                  <td className="px-3 sm:px-4 py-4 text-right text-gray-400 hidden sm:table-cell">
                    {winPct.toFixed(1)}%
                  </td>
                  <td className="px-3 sm:px-4 py-4 text-right font-medium text-emerald-500">
                    {pointsFor.toFixed(1)}
                  </td>
                  <td className="px-3 sm:px-4 py-4 text-right text-gray-400 hidden sm:table-cell">
                    {pointsAgainst.toFixed(1)}
                  </td>
                  <td
                    className={`px-3 sm:px-4 py-4 text-right font-medium hidden sm:table-cell ${
                      diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-gray-400'
                    }`}
                  >
                    {diff > 0 ? '+' : ''}
                    {diff.toFixed(1)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 rounded-sm bg-emerald-500"></span>
          <span>Playoff Position</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 rounded-sm bg-amber-500"></span>
          <span>Your Team</span>
        </div>
      </div>
    </div>
  )
}

import { getLeague, getLeagueRosters, getLeagueUsers } from '@/lib/sleeper'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
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
      <div>
        <h1 className="text-2xl font-bold mb-2">Teams</h1>
        <p className="text-gray-400">
          Top {playoffTeams} teams make the playoffs
        </p>
      </div>

      <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead className="bg-sleeper-accent">
            <tr>
              <th className="px-2 sm:px-4 py-3 text-left text-sm font-semibold text-gray-300">
                Rank
              </th>
              <th className="px-2 sm:px-4 py-3 text-left text-sm font-semibold text-gray-300">
                Team
              </th>
              <th className="px-2 sm:px-4 py-3 text-center text-sm font-semibold text-gray-300">
                Record
              </th>
              <th className="px-2 sm:px-4 py-3 text-right text-sm font-semibold text-gray-300 hidden sm:table-cell">
                Win %
              </th>
              <th className="px-2 sm:px-4 py-3 text-right text-sm font-semibold text-gray-300">
                PF
              </th>
              <th className="px-2 sm:px-4 py-3 text-right text-sm font-semibold text-gray-300 hidden sm:table-cell">
                PA
              </th>
              <th className="px-2 sm:px-4 py-3 text-right text-sm font-semibold text-gray-300 hidden sm:table-cell">
                Diff
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sleeper-accent">
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

              return (
                <tr
                  key={roster.roster_id}
                  className={`${
                    inPlayoffs ? 'bg-green-900/10' : ''
                  } hover:bg-sleeper-accent/50 transition-colors`}
                >
                  <td className="px-2 sm:px-4 py-3 sm:py-4">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-bold ${
                        index === 0
                          ? 'bg-yellow-500 text-black'
                          : index === 1
                          ? 'bg-gray-400 text-black'
                          : index === 2
                          ? 'bg-amber-700 text-white'
                          : inPlayoffs
                          ? 'bg-green-800 text-white'
                          : 'bg-sleeper-accent text-gray-400'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4">
                    <Link
                      href={`/league/${leagueId}/team/${roster.roster_id}`}
                      className="block hover:text-sleeper-highlight transition-colors"
                    >
                      <p className="font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
                        {roster.user?.metadata?.team_name ||
                          roster.user?.display_name ||
                          'Unknown Team'}
                      </p>
                      {roster.user?.display_name &&
                        roster.user?.metadata?.team_name && (
                          <p className="text-gray-500 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                            {roster.user.display_name}
                          </p>
                        )}
                    </Link>
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm sm:text-base">
                    {roster.settings.wins}-{roster.settings.losses}
                    {roster.settings.ties > 0 && `-${roster.settings.ties}`}
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-right text-gray-400 hidden sm:table-cell">
                    {winPct.toFixed(1)}%
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-right font-medium text-green-400 text-sm sm:text-base">
                    {pointsFor.toFixed(1)}
                  </td>
                  <td className="px-2 sm:px-4 py-3 sm:py-4 text-right text-gray-400 hidden sm:table-cell">
                    {pointsAgainst.toFixed(1)}
                  </td>
                  <td
                    className={`px-2 sm:px-4 py-3 sm:py-4 text-right font-medium hidden sm:table-cell ${
                      diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : ''
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

      <div className="flex gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-green-900/30"></span>
          <span>Playoff Position</span>
        </div>
      </div>
    </div>
  )
}

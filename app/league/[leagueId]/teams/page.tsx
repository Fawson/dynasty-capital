import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getAllPlayers,
  getAvatarUrl,
} from '@/lib/sleeper'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const [league, rosters, users, players] = await Promise.all([
    getLeague(leagueId),
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
    getAllPlayers(),
  ])

  if (!league) {
    notFound()
  }

  const userMap = new Map(users.map((u) => [u.user_id, u]))

  const teamsData = rosters.map((roster) => {
    const user = userMap.get(roster.owner_id)
    const rosterPlayers = roster.players
      ?.map((id) => players[id])
      .filter(Boolean) || []

    const positionCounts = rosterPlayers.reduce((acc, p) => {
      const pos = p?.position || 'Unknown'
      acc[pos] = (acc[pos] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      roster,
      user,
      players: rosterPlayers,
      positionCounts,
    }
  })

  // Sort by wins
  const sortedTeams = teamsData.sort(
    (a, b) => b.roster.settings.wins - a.roster.settings.wins
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Teams</h1>
        <p className="text-gray-400">
          {league.total_rosters} teams in the league
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedTeams.map(({ roster, user, players, positionCounts }) => (
          <Link
            key={roster.roster_id}
            href={`/league/${leagueId}/team/${roster.roster_id}`}
            className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent hover:border-sleeper-highlight transition-colors group"
          >
            <div className="flex items-center gap-3 mb-4">
              <img
                src={getAvatarUrl(user?.avatar || null)}
                alt={user?.display_name || 'Team'}
                className="w-12 h-12 rounded-full"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate group-hover:text-sleeper-highlight transition-colors">
                  {user?.metadata?.team_name || user?.display_name || 'Unknown Team'}
                </p>
                <p className="text-gray-500 text-sm truncate">
                  {user?.display_name}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center mb-3">
              <span className="text-2xl font-bold">
                {roster.settings.wins}-{roster.settings.losses}
                {roster.settings.ties > 0 && `-${roster.settings.ties}`}
              </span>
              <span className="text-gray-400">
                {(
                  roster.settings.fpts +
                  roster.settings.fpts_decimal / 100
                ).toFixed(1)}{' '}
                pts
              </span>
            </div>

            <div className="flex gap-2 flex-wrap">
              {['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((pos) => (
                <span
                  key={pos}
                  className="px-2 py-1 bg-sleeper-accent rounded text-xs"
                >
                  {pos}: {positionCounts[pos] || 0}
                </span>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-sleeper-accent">
              <p className="text-gray-500 text-sm">
                {players.length} players rostered
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

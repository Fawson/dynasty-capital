import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getAllPlayers,
  getAvatarUrl,
} from '@/lib/sleeper'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ leagueId: string; rosterId: string }>
}) {
  const { leagueId, rosterId } = await params
  const [league, rosters, users, players] = await Promise.all([
    getLeague(leagueId),
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
    getAllPlayers(),
  ])

  if (!league) {
    notFound()
  }

  const roster = rosters.find((r) => r.roster_id === parseInt(rosterId))
  if (!roster) {
    notFound()
  }

  const user = users.find((u) => u.user_id === roster.owner_id)
  const teamName =
    user?.metadata?.team_name || user?.display_name || 'Unknown Team'

  // Get player details
  const starters = roster.starters
    ?.map((id) => ({ ...players[id], isStarter: true }))
    .filter((p) => p.player_id) || []

  const bench =
    roster.players
      ?.filter((id) => !roster.starters?.includes(id))
      .map((id) => ({ ...players[id], isStarter: false }))
      .filter((p) => p.player_id) || []

  const positionOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
  const sortByPosition = (a: { position: string }, b: { position: string }) => {
    const aIdx = positionOrder.indexOf(a.position)
    const bIdx = positionOrder.indexOf(b.position)
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
  }

  starters.sort(sortByPosition)
  bench.sort(sortByPosition)

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'QB':
        return 'bg-red-600'
      case 'RB':
        return 'bg-green-600'
      case 'WR':
        return 'bg-blue-600'
      case 'TE':
        return 'bg-orange-600'
      case 'K':
        return 'bg-purple-600'
      case 'DEF':
        return 'bg-yellow-600'
      default:
        return 'bg-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/league/${leagueId}/teams`}
          className="text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </Link>
      </div>

      <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={getAvatarUrl(user?.avatar || null)}
            alt={teamName}
            className="w-16 h-16 rounded-full"
          />
          <div>
            <h1 className="text-2xl font-bold">{teamName}</h1>
            <p className="text-gray-400">{user?.display_name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-sleeper-accent p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Record</p>
            <p className="text-2xl font-bold">
              {roster.settings.wins}-{roster.settings.losses}
              {roster.settings.ties > 0 && `-${roster.settings.ties}`}
            </p>
          </div>
          <div className="bg-sleeper-accent p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Points For</p>
            <p className="text-2xl font-bold text-green-400">
              {(
                roster.settings.fpts +
                roster.settings.fpts_decimal / 100
              ).toFixed(1)}
            </p>
          </div>
          <div className="bg-sleeper-accent p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Points Against</p>
            <p className="text-2xl font-bold">
              {(
                roster.settings.fpts_against +
                roster.settings.fpts_against_decimal / 100
              ).toFixed(1)}
            </p>
          </div>
          <div className="bg-sleeper-accent p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Roster Size</p>
            <p className="text-2xl font-bold">{roster.players?.length || 0}</p>
          </div>
        </div>
      </div>

      {/* Starters */}
      <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
        <div className="p-4 border-b border-sleeper-accent">
          <h2 className="font-semibold">Starters ({starters.length})</h2>
        </div>
        <div className="divide-y divide-sleeper-accent">
          {starters.map((player) => (
            <div
              key={player.player_id}
              className="px-4 py-3 flex items-center gap-4"
            >
              <span
                className={`px-2 py-1 rounded text-xs font-bold ${getPositionColor(
                  player.position
                )}`}
              >
                {player.position}
              </span>
              <div className="flex-1">
                <Link
                  href={`/league/${leagueId}/player-analysis?playerId=${player.player_id}`}
                  className="font-medium hover:text-sleeper-highlight transition-colors"
                >
                  {player.full_name || `${player.first_name} ${player.last_name}`}
                </Link>
                <p className="text-gray-500 text-sm">
                  {player.team || 'FA'} &bull; #{player.search_rank || 'N/A'}
                </p>
              </div>
              {player.injury_status && (
                <span className="px-2 py-1 bg-red-900 text-red-200 rounded text-xs">
                  {player.injury_status}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bench */}
      <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
        <div className="p-4 border-b border-sleeper-accent">
          <h2 className="font-semibold">Bench ({bench.length})</h2>
        </div>
        <div className="divide-y divide-sleeper-accent">
          {bench.map((player) => (
            <div
              key={player.player_id}
              className="px-4 py-3 flex items-center gap-4 opacity-75"
            >
              <span
                className={`px-2 py-1 rounded text-xs font-bold ${getPositionColor(
                  player.position
                )}`}
              >
                {player.position}
              </span>
              <div className="flex-1">
                <Link
                  href={`/league/${leagueId}/player-analysis?playerId=${player.player_id}`}
                  className="font-medium hover:text-sleeper-highlight transition-colors"
                >
                  {player.full_name || `${player.first_name} ${player.last_name}`}
                </Link>
                <p className="text-gray-500 text-sm">
                  {player.team || 'FA'} &bull; #{player.search_rank || 'N/A'}
                </p>
              </div>
              {player.injury_status && (
                <span className="px-2 py-1 bg-red-900 text-red-200 rounded text-xs">
                  {player.injury_status}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

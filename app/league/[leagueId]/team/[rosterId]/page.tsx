import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getAllPlayers,
  getAvatarUrl,
  getHistoricalStatsForUser,
} from '@/lib/sleeper'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

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

  // Fetch historical stats for this user
  const historicalStats = user ? await getHistoricalStatsForUser(leagueId, user.user_id) : null

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

      {/* Historical Stats */}
      {historicalStats && historicalStats.seasons > 1 && (
        <div className="bg-sleeper-primary p-6 rounded-lg border border-sleeper-accent">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            All-Time Stats
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {historicalStats.championships > 0 && (
              <div className="bg-sleeper-accent p-4 rounded-lg text-center">
                <div className="flex items-center justify-center mb-1">
                  <svg className="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-amber-500">{historicalStats.championships}</p>
                <p className="text-gray-400 text-xs">Championship{historicalStats.championships !== 1 ? 's' : ''}</p>
              </div>
            )}
            <div className="bg-sleeper-accent p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{historicalStats.topWeeklyScores}</p>
              <p className="text-gray-400 text-xs">Weekly High Scores</p>
            </div>
            <div className="bg-sleeper-accent p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{historicalStats.topThreeFinishes}</p>
              <p className="text-gray-400 text-xs">Top 3 Finishes</p>
            </div>
            <div className="bg-sleeper-accent p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{historicalStats.averageFinish.toFixed(1)}</p>
              <p className="text-gray-400 text-xs">Avg Finish</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-sleeper-accent p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{historicalStats.totalWins}-{historicalStats.totalLosses}</p>
              <p className="text-gray-400 text-xs">All-Time Record</p>
            </div>
            <div className="bg-sleeper-accent p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-emerald-500">{historicalStats.allTimePointsFor.toFixed(1)}</p>
              <p className="text-gray-400 text-xs">All-Time Points</p>
            </div>
            <div className="bg-sleeper-accent p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{historicalStats.bestFinish}{historicalStats.bestFinish === 1 ? 'st' : historicalStats.bestFinish === 2 ? 'nd' : historicalStats.bestFinish === 3 ? 'rd' : 'th'}</p>
              <p className="text-gray-400 text-xs">Best Finish</p>
            </div>
            <div className="bg-sleeper-accent p-4 rounded-lg text-center">
              <p className="text-2xl font-bold">{historicalStats.seasons}</p>
              <p className="text-gray-400 text-xs">Seasons</p>
            </div>
          </div>

          {/* Season History */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-400 hover:text-white flex items-center gap-2 font-medium">
              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Season History
            </summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-700">
                    <th className="pb-2 pr-4">Season</th>
                    <th className="pb-2 pr-4">Record</th>
                    <th className="pb-2 pr-4">Finish</th>
                    <th className="pb-2 pr-4">Points</th>
                    <th className="pb-2">Weekly Highs</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalStats.seasonResults.map((season) => (
                    <tr key={season.season} className="border-b border-gray-800">
                      <td className="py-2 pr-4 font-medium">
                        {season.season}
                        {season.isChampion && (
                          <svg className="w-4 h-4 text-amber-500 inline ml-1" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                          </svg>
                        )}
                      </td>
                      <td className="py-2 pr-4">{season.wins}-{season.losses}</td>
                      <td className="py-2 pr-4">
                        <span className={season.finish <= 3 ? 'text-emerald-500 font-semibold' : ''}>
                          {season.finish}{season.finish === 1 ? 'st' : season.finish === 2 ? 'nd' : season.finish === 3 ? 'rd' : 'th'}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{season.pointsFor.toFixed(1)}</td>
                      <td className="py-2">{season.weeklyHighs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

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

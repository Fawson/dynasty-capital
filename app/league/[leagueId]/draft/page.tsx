import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getTradedPicks,
} from '@/lib/sleeper'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function DraftBoard({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ userId?: string; season?: string }>
}) {
  const { leagueId } = await params
  const { userId, season: selectedSeason } = await searchParams

  const [league, rosters, users, tradedPicks] = await Promise.all([
    getLeague(leagueId),
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
    getTradedPicks(leagueId),
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

  // Create roster lookup by roster_id
  const rosterMap = new Map(rostersWithUsers.map((r) => [r.roster_id, r]))

  // Determine upcoming draft years
  const currentSeason = parseInt(league.season)
  const upcomingSeasons = [currentSeason + 1, currentSeason + 2, currentSeason + 3]
  const activeSeason = selectedSeason ? parseInt(selectedSeason) : upcomingSeasons[0]

  // Get draft rounds (typically 3-5 for dynasty)
  const draftRounds = league.settings?.draft_rounds || 4

  // Sort rosters by standings (worst record picks first - typical draft order)
  const sortedRosters = [...rostersWithUsers].sort((a, b) => {
    if (a.settings.wins !== b.settings.wins) {
      return a.settings.wins - b.settings.wins // Worse record = earlier pick
    }
    return (
      (a.settings.fpts + a.settings.fpts_decimal / 100) -
      (b.settings.fpts + b.settings.fpts_decimal / 100)
    )
  })

  // Get team name helper
  const getTeamName = (rosterId: number) => {
    const roster = rosterMap.get(rosterId)
    return roster?.user?.metadata?.team_name || roster?.user?.display_name || `Team ${rosterId}`
  }

  const getTeamShortName = (rosterId: number) => {
    const name = getTeamName(rosterId)
    if (name.length <= 10) return name
    const firstWord = name.split(' ')[0]
    return firstWord.length <= 10 ? firstWord : name.slice(0, 8) + '..'
  }

  // Build draft board for the selected season
  const buildDraftBoard = (season: number) => {
    const board: { round: number; pick: number; originalRosterId: number; currentOwnerId: number; isTraded: boolean }[] = []

    for (let round = 1; round <= draftRounds; round++) {
      sortedRosters.forEach((roster, pickIndex) => {
        // Check if this pick was traded
        const trade = tradedPicks.find(
          (tp) => tp.season === season.toString() && tp.round === round && tp.roster_id === roster.roster_id
        )

        board.push({
          round,
          pick: pickIndex + 1,
          originalRosterId: roster.roster_id,
          currentOwnerId: trade ? trade.owner_id : roster.roster_id,
          isTraded: !!trade,
        })
      })
    }

    return board
  }

  const board = buildDraftBoard(activeSeason)
  const rounds = Array.from({ length: draftRounds }, (_, i) => i + 1)
  const numTeams = sortedRosters.length

  // Check if user owns a pick
  const isUserPick = (ownerId: number) => {
    const owner = rosterMap.get(ownerId)
    return userId && (owner?.owner_id === userId || owner?.user?.user_id === userId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link href={`/league/${leagueId}${userId ? `?userId=${userId}` : ''}`} className="hover:text-amber-500">
            {league.name}
          </Link>
          <span>/</span>
          <span>Draft Board</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">{activeSeason} Draft Board</h1>
      </div>

      {/* Season Tabs */}
      <div className="flex gap-2">
        {upcomingSeasons.map((season) => (
          <Link
            key={season}
            href={`/league/${leagueId}/draft?season=${season}${userId ? `&userId=${userId}` : ''}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSeason === season
                ? 'bg-amber-500 text-gray-900'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {season}
          </Link>
        ))}
      </div>

      {/* Draft Board Grid */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="min-w-max">
          {/* Header Row - Pick Numbers */}
          <div className="flex mb-1">
            <div className="w-16 sm:w-20 flex-shrink-0" /> {/* Empty corner */}
            {sortedRosters.map((_, idx) => (
              <div
                key={idx}
                className="w-24 sm:w-32 flex-shrink-0 px-1 text-center text-xs text-gray-500 font-medium"
              >
                Pick {idx + 1}
              </div>
            ))}
          </div>

          {/* Rounds */}
          {rounds.map((round) => (
            <div key={round} className="flex mb-2">
              {/* Round Label */}
              <div className="w-16 sm:w-20 flex-shrink-0 flex items-center">
                <span className="text-sm font-semibold text-gray-400">Rd {round}</span>
              </div>

              {/* Picks in this round */}
              {sortedRosters.map((roster, pickIdx) => {
                const pick = board.find(
                  (p) => p.round === round && p.originalRosterId === roster.roster_id
                )
                if (!pick) return null

                const currentOwner = rosterMap.get(pick.currentOwnerId)
                const isOwned = isUserPick(pick.currentOwnerId)
                const isOriginalOwner = pick.currentOwnerId === pick.originalRosterId

                return (
                  <div key={`${round}-${pickIdx}`} className="w-24 sm:w-32 flex-shrink-0 px-0.5 sm:px-1">
                    <div
                      className={`
                        relative rounded-lg p-1.5 sm:p-2 h-full min-h-[60px] sm:min-h-[72px]
                        transition-all flex flex-col
                        ${isOwned
                          ? 'bg-amber-500/20 border-2 border-amber-500 ring-1 ring-amber-500/30'
                          : pick.isTraded
                            ? 'bg-gray-800 border border-emerald-600/50'
                            : 'bg-gray-800 border border-gray-700'
                        }
                      `}
                    >
                      {/* Current Owner */}
                      <p className={`text-xs sm:text-sm font-medium truncate ${isOwned ? 'text-amber-400' : 'text-white'}`}>
                        {getTeamShortName(pick.currentOwnerId)}
                      </p>

                      {/* Original owner if traded */}
                      {pick.isTraded && (
                        <p className="text-[10px] sm:text-xs text-emerald-500 truncate mt-0.5">
                          via {getTeamShortName(pick.originalRosterId)}
                        </p>
                      )}

                      {/* Pick number - absolute bottom left */}
                      <p className="absolute bottom-1 left-1.5 sm:bottom-1.5 sm:left-2 text-[10px] text-gray-500">
                        {round}.{String(pickIdx + 1).padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Team Summary - Collapsible */}
      <details className="group" open>
        <summary className="cursor-pointer text-sm text-gray-400 hover:text-white flex items-center gap-2 font-medium">
          <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Team Summary
        </summary>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedRosters.map((roster, standingIdx) => {
            const teamPicks = board.filter((p) => p.currentOwnerId === roster.roster_id)
            const ownPicks = teamPicks.filter((p) => p.originalRosterId === roster.roster_id)
            const acquiredPicks = teamPicks.filter((p) => p.originalRosterId !== roster.roster_id)
            const tradedAway = board.filter(
              (p) => p.originalRosterId === roster.roster_id && p.currentOwnerId !== roster.roster_id
            )
            const isUserTeam = userId && (roster.owner_id === userId || roster.user?.user_id === userId)

            return (
              <div
                key={roster.roster_id}
                className={`p-3 sm:p-4 bg-gray-800 rounded-lg border ${
                  isUserTeam ? 'border-amber-500' : 'border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold truncate">
                    {roster.user?.metadata?.team_name || roster.user?.display_name || 'Unknown'}
                  </p>
                  <span className="text-xs text-gray-500">#{standingIdx + 1}</span>
                </div>

                <div className="space-y-1.5 text-sm">
                  {/* Own picks */}
                  {ownPicks.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ownPicks
                        .sort((a, b) => a.round - b.round)
                        .map((pick, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-gray-700 rounded text-gray-300 text-xs"
                          >
                            {pick.round}.{String(pick.pick).padStart(2, '0')}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Acquired picks */}
                  {acquiredPicks.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {acquiredPicks
                        .sort((a, b) => a.round - b.round)
                        .map((pick, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-emerald-900/50 border border-emerald-700 rounded text-emerald-400 text-xs"
                            title={`From ${getTeamName(pick.originalRosterId)}`}
                          >
                            {pick.round}.{String(pick.pick).padStart(2, '0')}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Traded away */}
                  {tradedAway.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tradedAway
                        .sort((a, b) => a.round - b.round)
                        .map((pick, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-red-900/30 border border-red-800 rounded text-red-400 text-xs line-through"
                            title={`To ${getTeamName(pick.currentOwnerId)}`}
                          >
                            {pick.round}.{String(pick.pick).padStart(2, '0')}
                          </span>
                        ))}
                    </div>
                  )}

                  {teamPicks.length === 0 && (
                    <span className="text-gray-500 text-xs">No picks</span>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  {teamPicks.length} pick{teamPicks.length !== 1 ? 's' : ''}
                  {acquiredPicks.length > 0 && (
                    <span className="text-emerald-500"> (+{acquiredPicks.length})</span>
                  )}
                  {tradedAway.length > 0 && (
                    <span className="text-red-400"> (-{tradedAway.length})</span>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      </details>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400 pt-4 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 bg-gray-800 border border-gray-700 rounded" />
          <span>Own pick</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 bg-gray-800 border border-emerald-600/50 rounded" />
          <span>Traded pick</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 bg-amber-500/20 border-2 border-amber-500 rounded" />
          <span>Your pick</span>
        </div>
      </div>
    </div>
  )
}

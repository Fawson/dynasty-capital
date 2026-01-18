'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { SleeperMatchup, SleeperRoster, LeagueUser, SleeperLeague } from '@/lib/types'
import { getCurrentWeek, getAvatarUrl } from '@/lib/sleeper'

interface MatchupWithTeams {
  matchupId: number
  team1: {
    roster: SleeperRoster
    user: LeagueUser | undefined
    matchup: SleeperMatchup
  }
  team2: {
    roster: SleeperRoster
    user: LeagueUser | undefined
    matchup: SleeperMatchup
  } | null
}

export default function MatchupsPage() {
  const params = useParams()
  const leagueId = params.leagueId as string

  const [matchups, setMatchups] = useState<MatchupWithTeams[]>([])
  const [league, setLeague] = useState<SleeperLeague | null>(null)
  const [loading, setLoading] = useState(true)
  const [week, setWeek] = useState(getCurrentWeek())

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [leagueRes, rostersRes, usersRes, matchupsRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`),
        ])

        const leagueData: SleeperLeague = await leagueRes.json()
        const rosters: SleeperRoster[] = await rostersRes.json()
        const users: LeagueUser[] = await usersRes.json()
        const weekMatchups: SleeperMatchup[] = await matchupsRes.json()

        setLeague(leagueData)

        const rosterMap = new Map(rosters.map((r) => [r.roster_id, r]))
        const userMap = new Map(users.map((u) => [u.user_id, u]))

        // Group matchups by matchup_id
        const matchupGroups = new Map<number, SleeperMatchup[]>()
        weekMatchups.forEach((m) => {
          const group = matchupGroups.get(m.matchup_id) || []
          group.push(m)
          matchupGroups.set(m.matchup_id, group)
        })

        const matchupsWithTeams: MatchupWithTeams[] = []
        matchupGroups.forEach((group, matchupId) => {
          if (group.length >= 1) {
            const m1 = group[0]
            const m2 = group[1]

            const roster1 = rosterMap.get(m1.roster_id)
            const roster2 = m2 ? rosterMap.get(m2.roster_id) : null

            if (roster1) {
              matchupsWithTeams.push({
                matchupId,
                team1: {
                  roster: roster1,
                  user: userMap.get(roster1.owner_id),
                  matchup: m1,
                },
                team2: roster2 && m2
                  ? {
                      roster: roster2,
                      user: userMap.get(roster2.owner_id),
                      matchup: m2,
                    }
                  : null,
              })
            }
          }
        })

        // Sort by matchup_id
        matchupsWithTeams.sort((a, b) => a.matchupId - b.matchupId)
        setMatchups(matchupsWithTeams)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [leagueId, week])

  const maxWeek = league?.settings?.playoff_week_start
    ? league.settings.playoff_week_start + 2
    : 17

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading matchups...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Matchups</h1>
          <p className="text-gray-400">Week {week} matchups</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeek(Math.max(1, week - 1))}
            disabled={week <= 1}
            className="px-3 py-2 bg-sleeper-accent rounded hover:bg-sleeper-highlight transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &larr;
          </button>
          <select
            value={week}
            onChange={(e) => setWeek(parseInt(e.target.value))}
            className="bg-sleeper-accent text-white px-4 py-2 rounded border border-sleeper-accent focus:outline-none focus:border-sleeper-highlight"
          >
            {Array.from({ length: maxWeek }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
          <button
            onClick={() => setWeek(Math.min(maxWeek, week + 1))}
            disabled={week >= maxWeek}
            className="px-3 py-2 bg-sleeper-accent rounded hover:bg-sleeper-highlight transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &rarr;
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {matchups.map((matchup) => {
          const t1 = matchup.team1
          const t2 = matchup.team2

          const t1Points = t1.matchup.points || 0
          const t2Points = t2?.matchup.points || 0

          const t1Winning = t1Points > t2Points
          const t2Winning = t2Points > t1Points

          return (
            <div
              key={matchup.matchupId}
              className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden"
            >
              <div className="grid grid-cols-3 items-center p-4">
                {/* Team 1 */}
                <div
                  className={`flex items-center gap-3 ${
                    t1Winning ? 'opacity-100' : 'opacity-70'
                  }`}
                >
                  <img
                    src={getAvatarUrl(t1.user?.avatar || null)}
                    alt={t1.user?.display_name || 'Team'}
                    className="w-10 h-10 rounded-full"
                  />
                  <Link
                    href={`/league/${leagueId}/team/${t1.roster.roster_id}`}
                    className="hover:text-sleeper-highlight transition-colors"
                  >
                    <p className="font-medium">
                      {t1.user?.metadata?.team_name ||
                        t1.user?.display_name ||
                        'Unknown'}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {t1.roster.settings.wins}-{t1.roster.settings.losses}
                    </p>
                  </Link>
                </div>

                {/* Score */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-4">
                    <span
                      className={`text-2xl font-bold ${
                        t1Winning ? 'text-green-400' : ''
                      }`}
                    >
                      {t1Points.toFixed(2)}
                    </span>
                    <span className="text-gray-500">-</span>
                    <span
                      className={`text-2xl font-bold ${
                        t2Winning ? 'text-green-400' : ''
                      }`}
                    >
                      {t2Points.toFixed(2)}
                    </span>
                  </div>
                  {t1Points === 0 && t2Points === 0 && (
                    <p className="text-gray-500 text-xs mt-1">Not started</p>
                  )}
                </div>

                {/* Team 2 */}
                {t2 ? (
                  <div
                    className={`flex items-center gap-3 justify-end ${
                      t2Winning ? 'opacity-100' : 'opacity-70'
                    }`}
                  >
                    <Link
                      href={`/league/${leagueId}/team/${t2.roster.roster_id}`}
                      className="text-right hover:text-sleeper-highlight transition-colors"
                    >
                      <p className="font-medium">
                        {t2.user?.metadata?.team_name ||
                          t2.user?.display_name ||
                          'Unknown'}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {t2.roster.settings.wins}-{t2.roster.settings.losses}
                      </p>
                    </Link>
                    <img
                      src={getAvatarUrl(t2.user?.avatar || null)}
                      alt={t2.user?.display_name || 'Team'}
                      className="w-10 h-10 rounded-full"
                    />
                  </div>
                ) : (
                  <div className="text-right text-gray-500">BYE</div>
                )}
              </div>
            </div>
          )
        })}

        {matchups.length === 0 && (
          <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent p-8 text-center">
            <p className="text-gray-400">No matchups found for this week</p>
          </div>
        )}
      </div>
    </div>
  )
}

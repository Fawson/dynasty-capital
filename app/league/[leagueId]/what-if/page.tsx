'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SleeperMatchup, SleeperRoster, LeagueUser, SleeperLeague } from '@/lib/types'
import { getAvatarUrl } from '@/lib/sleeper'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import PageHeader from '@/components/PageHeader'

interface TeamData {
  rosterId: number
  name: string
  avatar: string | null
  weeklyPoints: Record<number, number> // week -> points scored
  weeklyOpponents: Record<number, number> // week -> opponent roster_id
}

interface SimulatedStanding {
  rosterId: number
  name: string
  avatar: string | null
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  originalWins: number
  originalLosses: number
}

interface PlayoffMatchup {
  round: number
  team1: SimulatedStanding | null
  team2: SimulatedStanding | null
  team1Points: number
  team2Points: number
  winner: SimulatedStanding | null
}

export default function WhatIfPage() {
  const params = useParams()
  const leagueId = params.leagueId as string

  const [loading, setLoading] = useState(true)
  const [league, setLeague] = useState<SleeperLeague | null>(null)
  const [teams, setTeams] = useState<TeamData[]>([])
  const [rosters, setRosters] = useState<SleeperRoster[]>([])
  const [allMatchups, setAllMatchups] = useState<Record<number, SleeperMatchup[]>>({})

  const [team1Id, setTeam1Id] = useState<number | null>(null)
  const [team2Id, setTeam2Id] = useState<number | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [leagueRes, rostersRes, usersRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
        ])

        const leagueData: SleeperLeague = await leagueRes.json()
        const rostersData: SleeperRoster[] = await rostersRes.json()
        const users: LeagueUser[] = await usersRes.json()

        setLeague(leagueData)
        setRosters(rostersData)

        const userMap = new Map(users.map(u => [u.user_id, u]))
        const regularSeasonWeeks = leagueData.settings.playoff_week_start - 1

        // Fetch all regular season matchups
        const matchupPromises = []
        for (let week = 1; week <= regularSeasonWeeks + 3; week++) {
          matchupPromises.push(
            fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`)
              .then(res => res.json())
              .then(data => ({ week, matchups: data as SleeperMatchup[] }))
          )
        }

        const matchupResults = await Promise.all(matchupPromises)
        const matchupsByWeek: Record<number, SleeperMatchup[]> = {}
        matchupResults.forEach(({ week, matchups }) => {
          matchupsByWeek[week] = matchups
        })
        setAllMatchups(matchupsByWeek)

        // Build team data
        const teamData: TeamData[] = rostersData.map(roster => {
          const user = userMap.get(roster.owner_id)
          const name = user?.metadata?.team_name || user?.display_name || `Team ${roster.roster_id}`

          const weeklyPoints: Record<number, number> = {}
          const weeklyOpponents: Record<number, number> = {}

          // Process regular season matchups
          for (let week = 1; week <= regularSeasonWeeks; week++) {
            const weekMatchups = matchupsByWeek[week] || []
            const teamMatchup = weekMatchups.find(m => m.roster_id === roster.roster_id)

            if (teamMatchup) {
              weeklyPoints[week] = teamMatchup.points || 0

              // Find opponent
              const opponent = weekMatchups.find(
                m => m.matchup_id === teamMatchup.matchup_id && m.roster_id !== roster.roster_id
              )
              if (opponent) {
                weeklyOpponents[week] = opponent.roster_id
              }
            }
          }

          return {
            rosterId: roster.roster_id,
            name,
            avatar: user?.avatar || null,
            weeklyPoints,
            weeklyOpponents,
          }
        })

        setTeams(teamData.sort((a, b) => a.name.localeCompare(b.name)))
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [leagueId])

  const regularSeasonWeeks = league?.settings.playoff_week_start ? league.settings.playoff_week_start - 1 : 14
  const playoffTeams = league?.settings.playoff_teams || 6

  // Simulate standings with swapped schedules
  const simulatedStandings = useMemo(() => {
    if (teams.length === 0) return []

    const standings: SimulatedStanding[] = teams.map(team => {
      let wins = 0
      let losses = 0
      let pointsFor = 0
      let pointsAgainst = 0

      // Get the schedule to use (swapped if applicable)
      let scheduleTeam = team
      if (team1Id && team2Id) {
        if (team.rosterId === team1Id) {
          scheduleTeam = teams.find(t => t.rosterId === team2Id) || team
        } else if (team.rosterId === team2Id) {
          scheduleTeam = teams.find(t => t.rosterId === team1Id) || team
        }
      }

      // Calculate wins/losses with the (potentially swapped) schedule
      for (let week = 1; week <= regularSeasonWeeks; week++) {
        const myPoints = team.weeklyPoints[week] || 0
        pointsFor += myPoints

        // Get opponent from the schedule team's schedule
        const opponentId = scheduleTeam.weeklyOpponents[week]
        if (opponentId) {
          // Handle the case where opponent is one of the swapped teams
          let actualOpponentId = opponentId
          if (team1Id && team2Id) {
            if (opponentId === team1Id) {
              actualOpponentId = team2Id
            } else if (opponentId === team2Id) {
              actualOpponentId = team1Id
            }
          }

          const opponent = teams.find(t => t.rosterId === actualOpponentId)
          const opponentPoints = opponent?.weeklyPoints[week] || 0
          pointsAgainst += opponentPoints

          if (myPoints > opponentPoints) {
            wins++
          } else if (myPoints < opponentPoints) {
            losses++
          } else {
            // Tie - count as 0.5 win, 0.5 loss for simplicity
            wins += 0.5
            losses += 0.5
          }
        }
      }

      // Get original record from rosters
      const originalRoster = rosters.find(r => r.roster_id === team.rosterId)

      return {
        rosterId: team.rosterId,
        name: team.name,
        avatar: team.avatar,
        wins,
        losses,
        pointsFor,
        pointsAgainst,
        originalWins: originalRoster?.settings.wins || 0,
        originalLosses: originalRoster?.settings.losses || 0,
      }
    })

    // Sort by wins, then points for
    return standings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.pointsFor - a.pointsFor
    })
  }, [teams, team1Id, team2Id, regularSeasonWeeks, rosters])

  // Simulate playoffs
  const playoffResults = useMemo(() => {
    if (simulatedStandings.length === 0 || !league) return { rounds: [], champion: null }

    const playoffWeekStart = league.settings.playoff_week_start
    const playoffSeeds = simulatedStandings.slice(0, playoffTeams)

    // Standard playoff bracket (6 teams: 1&2 get byes, 3v6, 4v5 in round 1)
    const rounds: PlayoffMatchup[][] = []

    // Helper to get points for a team in a specific week
    const getTeamPoints = (rosterId: number, week: number): number => {
      const weekMatchups = allMatchups[week] || []
      const matchup = weekMatchups.find(m => m.roster_id === rosterId)
      return matchup?.points || 0
    }

    // Round 1 (Wild Card) - seeds 3-6
    const round1: PlayoffMatchup[] = []
    if (playoffTeams >= 4) {
      // Match 1: Seed 3 vs Seed 6
      const seed3 = playoffSeeds[2]
      const seed6 = playoffSeeds[5] || null
      const r1m1Points1 = seed3 ? getTeamPoints(seed3.rosterId, playoffWeekStart) : 0
      const r1m1Points2 = seed6 ? getTeamPoints(seed6.rosterId, playoffWeekStart) : 0
      const r1m1Winner = seed6 === null ? seed3 : (r1m1Points1 >= r1m1Points2 ? seed3 : seed6)

      round1.push({
        round: 1,
        team1: seed3,
        team2: seed6,
        team1Points: r1m1Points1,
        team2Points: r1m1Points2,
        winner: r1m1Winner,
      })

      // Match 2: Seed 4 vs Seed 5
      const seed4 = playoffSeeds[3]
      const seed5 = playoffSeeds[4] || null
      const r1m2Points1 = seed4 ? getTeamPoints(seed4.rosterId, playoffWeekStart) : 0
      const r1m2Points2 = seed5 ? getTeamPoints(seed5.rosterId, playoffWeekStart) : 0
      const r1m2Winner = seed5 === null ? seed4 : (r1m2Points1 >= r1m2Points2 ? seed4 : seed5)

      round1.push({
        round: 1,
        team1: seed4,
        team2: seed5,
        team1Points: r1m2Points1,
        team2Points: r1m2Points2,
        winner: r1m2Winner,
      })
    }
    rounds.push(round1)

    // Round 2 (Semifinals)
    const round2: PlayoffMatchup[] = []
    const seed1 = playoffSeeds[0]
    const seed2 = playoffSeeds[1]
    const r1Winner1 = round1[0]?.winner
    const r1Winner2 = round1[1]?.winner

    // Match 1: Seed 1 vs lowest remaining seed
    const r2m1Opponent = r1Winner2 // Winner of 4v5 plays 1 seed
    const r2m1Points1 = seed1 ? getTeamPoints(seed1.rosterId, playoffWeekStart + 1) : 0
    const r2m1Points2 = r2m1Opponent ? getTeamPoints(r2m1Opponent.rosterId, playoffWeekStart + 1) : 0
    const r2m1Winner = r2m1Opponent === null ? seed1 : (r2m1Points1 >= r2m1Points2 ? seed1 : r2m1Opponent)

    round2.push({
      round: 2,
      team1: seed1,
      team2: r2m1Opponent,
      team1Points: r2m1Points1,
      team2Points: r2m1Points2,
      winner: r2m1Winner,
    })

    // Match 2: Seed 2 vs highest remaining seed
    const r2m2Opponent = r1Winner1 // Winner of 3v6 plays 2 seed
    const r2m2Points1 = seed2 ? getTeamPoints(seed2.rosterId, playoffWeekStart + 1) : 0
    const r2m2Points2 = r2m2Opponent ? getTeamPoints(r2m2Opponent.rosterId, playoffWeekStart + 1) : 0
    const r2m2Winner = r2m2Opponent === null ? seed2 : (r2m2Points1 >= r2m2Points2 ? seed2 : r2m2Opponent)

    round2.push({
      round: 2,
      team1: seed2,
      team2: r2m2Opponent,
      team1Points: r2m2Points1,
      team2Points: r2m2Points2,
      winner: r2m2Winner,
    })
    rounds.push(round2)

    // Championship
    const championship: PlayoffMatchup[] = []
    const finalist1 = r2m1Winner
    const finalist2 = r2m2Winner
    const champPoints1 = finalist1 ? getTeamPoints(finalist1.rosterId, playoffWeekStart + 2) : 0
    const champPoints2 = finalist2 ? getTeamPoints(finalist2.rosterId, playoffWeekStart + 2) : 0
    const champion = champPoints1 >= champPoints2 ? finalist1 : finalist2

    championship.push({
      round: 3,
      team1: finalist1,
      team2: finalist2,
      team1Points: champPoints1,
      team2Points: champPoints2,
      winner: champion,
    })
    rounds.push(championship)

    return { rounds, champion }
  }, [simulatedStandings, allMatchups, league, playoffTeams])

  const team1 = teams.find(t => t.rosterId === team1Id)
  const team2 = teams.find(t => t.rosterId === team2Id)

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="What If..."
        subtitle="See what would've happened if two teams swapped their schedules"
        icon="whatif"
      />

      {/* Team Selection */}
      <div className="bg-sleeper-primary p-4 rounded-lg border border-sleeper-accent">
        <p className="text-gray-400 mb-4">Select two teams to swap schedules:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Team 1</label>
            <select
              value={team1Id || ''}
              onChange={(e) => setTeam1Id(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-sleeper-accent text-white px-3 py-2 rounded border border-sleeper-accent focus:outline-none focus:border-sleeper-highlight"
            >
              <option value="">Select a team</option>
              {teams
                .filter(t => t.rosterId !== team2Id)
                .map(team => (
                  <option key={team.rosterId} value={team.rosterId}>
                    {team.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Team 2</label>
            <select
              value={team2Id || ''}
              onChange={(e) => setTeam2Id(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-sleeper-accent text-white px-3 py-2 rounded border border-sleeper-accent focus:outline-none focus:border-sleeper-highlight"
            >
              <option value="">Select a team</option>
              {teams
                .filter(t => t.rosterId !== team1Id)
                .map(team => (
                  <option key={team.rosterId} value={team.rosterId}>
                    {team.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {team1 && team2 && (
          <div className="mt-4 p-3 bg-sleeper-accent/50 rounded text-center">
            <span className="text-sleeper-highlight font-medium">{team1.name}</span>
            <span className="text-gray-400 mx-2">will play</span>
            <span className="text-sleeper-highlight font-medium">{team2.name}&apos;s</span>
            <span className="text-gray-400 ml-2">schedule (and vice versa)</span>
          </div>
        )}
      </div>

      {/* Simulated Standings */}
      <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
        <div className="p-4 border-b border-sleeper-accent">
          <h2 className="font-semibold">
            {team1Id && team2Id ? 'Simulated Standings' : 'Current Standings'}
          </h2>
          {team1Id && team2Id && (
            <p className="text-gray-400 text-sm">Based on swapped schedules</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-sm border-b border-sleeper-accent">
                <th className="text-left p-3">Rank</th>
                <th className="text-left p-3">Team</th>
                <th className="text-center p-3">Record</th>
                <th className="text-center p-3 hidden sm:table-cell">Original</th>
                <th className="text-center p-3 hidden sm:table-cell">Change</th>
                <th className="text-right p-3">PF</th>
              </tr>
            </thead>
            <tbody>
              {simulatedStandings.map((team, index) => {
                const winChange = team.wins - team.originalWins
                const isSwapped = team.rosterId === team1Id || team.rosterId === team2Id
                const makesPlayoffs = index < playoffTeams

                return (
                  <tr
                    key={team.rosterId}
                    className={`border-b border-sleeper-accent ${
                      isSwapped ? 'bg-sleeper-highlight/10' : ''
                    } ${makesPlayoffs ? '' : 'opacity-60'}`}
                  >
                    <td className="p-3">
                      <span className={makesPlayoffs ? 'text-green-400' : ''}>{index + 1}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={getAvatarUrl(team.avatar)}
                          alt={team.name}
                          className="w-8 h-8 rounded-full"
                        />
                        <span className={isSwapped ? 'text-sleeper-highlight' : ''}>{team.name}</span>
                      </div>
                    </td>
                    <td className="text-center p-3 font-medium">
                      {team.wins}-{team.losses}
                    </td>
                    <td className="text-center p-3 text-gray-500 hidden sm:table-cell">
                      {team.originalWins}-{team.originalLosses}
                    </td>
                    <td className="text-center p-3 hidden sm:table-cell">
                      {winChange !== 0 && (
                        <span className={winChange > 0 ? 'text-green-400' : 'text-red-400'}>
                          {winChange > 0 ? '+' : ''}{winChange}
                        </span>
                      )}
                    </td>
                    <td className="text-right p-3 text-gray-400">
                      {team.pointsFor.toFixed(1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Playoff Bracket */}
      {playoffResults.rounds.length > 0 && (
        <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent p-4">
          <h2 className="font-semibold mb-4">
            {team1Id && team2Id ? 'Simulated Playoff Results' : 'Playoff Results (Based on Current Standings)'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Round 1 */}
            <div>
              <h3 className="text-gray-400 text-sm mb-2">Wild Card</h3>
              <div className="space-y-2">
                {playoffResults.rounds[0]?.map((matchup, i) => (
                  <div key={i} className="bg-sleeper-accent rounded p-3">
                    <div className={`flex justify-between items-center mb-1 ${
                      matchup.winner?.rosterId === matchup.team1?.rosterId ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      <span className="text-sm">{matchup.team1?.name || 'TBD'}</span>
                      <span className="text-sm">{matchup.team1Points.toFixed(1)}</span>
                    </div>
                    <div className={`flex justify-between items-center ${
                      matchup.winner?.rosterId === matchup.team2?.rosterId ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      <span className="text-sm">{matchup.team2?.name || 'BYE'}</span>
                      <span className="text-sm">{matchup.team2 ? matchup.team2Points.toFixed(1) : '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Round 2 */}
            <div>
              <h3 className="text-gray-400 text-sm mb-2">Semifinals</h3>
              <div className="space-y-2">
                {playoffResults.rounds[1]?.map((matchup, i) => (
                  <div key={i} className="bg-sleeper-accent rounded p-3">
                    <div className={`flex justify-between items-center mb-1 ${
                      matchup.winner?.rosterId === matchup.team1?.rosterId ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      <span className="text-sm">{matchup.team1?.name || 'TBD'}</span>
                      <span className="text-sm">{matchup.team1Points.toFixed(1)}</span>
                    </div>
                    <div className={`flex justify-between items-center ${
                      matchup.winner?.rosterId === matchup.team2?.rosterId ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      <span className="text-sm">{matchup.team2?.name || 'TBD'}</span>
                      <span className="text-sm">{matchup.team2Points.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Championship */}
            <div>
              <h3 className="text-gray-400 text-sm mb-2">Championship</h3>
              {playoffResults.rounds[2]?.map((matchup, i) => (
                <div key={i} className="bg-sleeper-accent rounded p-3">
                  <div className={`flex justify-between items-center mb-1 ${
                    matchup.winner?.rosterId === matchup.team1?.rosterId ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    <span className="text-sm">{matchup.team1?.name || 'TBD'}</span>
                    <span className="text-sm">{matchup.team1Points.toFixed(1)}</span>
                  </div>
                  <div className={`flex justify-between items-center ${
                    matchup.winner?.rosterId === matchup.team2?.rosterId ? 'text-green-400' : 'text-gray-400'
                  }`}>
                    <span className="text-sm">{matchup.team2?.name || 'TBD'}</span>
                    <span className="text-sm">{matchup.team2Points.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Champion */}
          {playoffResults.champion && (
            <div className="mt-6 text-center p-4 bg-yellow-900/30 rounded-lg border border-yellow-700">
              <p className="text-yellow-400 text-sm mb-1">
                {team1Id && team2Id ? 'Simulated Champion' : 'Champion'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <img
                  src={getAvatarUrl(playoffResults.champion.avatar)}
                  alt={playoffResults.champion.name}
                  className="w-12 h-12 rounded-full"
                />
                <span className="text-2xl font-bold text-yellow-400">
                  {playoffResults.champion.name}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-gray-500 text-sm text-center">
        Simulation uses actual weekly scores. Playoff matchups use real playoff week scores.
      </p>
    </div>
  )
}

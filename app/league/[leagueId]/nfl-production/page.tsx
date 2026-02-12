'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { SleeperPlayer, SleeperLeague } from '@/lib/types'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import PageHeader from '@/components/PageHeader'
import { getCurrentSeason } from '@/lib/sleeper'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

// NFL Team Colors
const NFL_TEAM_COLORS: Record<string, string> = {
  ARI: '#97233F', ATL: '#A71930', BAL: '#241773', BUF: '#00338D',
  CAR: '#0085CA', CHI: '#0B162A', CIN: '#FB4F14', CLE: '#311D00',
  DAL: '#003594', DEN: '#FB4F14', DET: '#0076B6', GB: '#203731',
  HOU: '#03202F', IND: '#002C5F', JAX: '#006778', KC: '#E31837',
  LAC: '#0080C6', LAR: '#003594', LV: '#A5ACAF', MIA: '#008E97',
  MIN: '#4F2683', NE: '#002244', NO: '#D3BC8D', NYG: '#0B2265',
  NYJ: '#125740', PHI: '#004C54', PIT: '#FFB612', SF: '#AA0000',
  SEA: '#002244', TB: '#D50A0A', TEN: '#0C2340', WAS: '#5A1414',
}

const NFL_TEAMS = Object.keys(NFL_TEAM_COLORS)

interface PlayerPoints {
  playerId: string
  name: string
  position: string
  points: number
}

interface WeeklyTeamPoints {
  week: number
  team: string
  points: number
  players: PlayerPoints[]
}

interface SeasonTeamPoints {
  season: string
  team: string
  totalPoints: number
  weeklyPoints: WeeklyTeamPoints[]
}

export default function NFLProductionPage() {
  const params = useParams()
  const leagueId = params.leagueId as string

  const [loading, setLoading] = useState(true)
  const [league, setLeague] = useState<SleeperLeague | null>(null)
  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({})
  const [seasonData, setSeasonData] = useState<SeasonTeamPoints[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('KC')
  const [selectedTeam2, setSelectedTeam2] = useState<string | null>(null)
  const [showTeam2Selector, setShowTeam2Selector] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [viewMode, setViewMode] = useState<'weekly' | 'season'>('weekly')
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [leagueRes, playersRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}`),
          fetch('/api/players'),
        ])

        const leagueData: SleeperLeague = await leagueRes.json()
        const playersData: Record<string, SleeperPlayer> = await playersRes.json()

        setLeague(leagueData)
        setAllPlayers(playersData)

        const currentSeason = getCurrentSeason()
        setSelectedSeason(currentSeason)

        // Fetch stats for multiple seasons
        const seasons = [currentSeason, String(parseInt(currentSeason) - 1), String(parseInt(currentSeason) - 2)]
        const allSeasonData: SeasonTeamPoints[] = []

        for (const season of seasons) {
          const seasonTeamData = await fetchSeasonData(season, playersData)
          allSeasonData.push(...seasonTeamData)
        }

        setSeasonData(allSeasonData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [leagueId])

  async function fetchSeasonData(season: string, players: Record<string, SleeperPlayer>): Promise<SeasonTeamPoints[]> {
    const teamPointsByWeek: Record<string, WeeklyTeamPoints[]> = {}
    NFL_TEAMS.forEach(team => {
      teamPointsByWeek[team] = []
    })

    // Fetch weekly stats for weeks 1-18
    const weekPromises = []
    for (let week = 1; week <= 18; week++) {
      weekPromises.push(
        fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => ({ week, stats: data }))
          .catch(() => ({ week, stats: null }))
      )
    }

    const weekResults = await Promise.all(weekPromises)

    for (const { week, stats } of weekResults) {
      if (!stats) continue

      // Aggregate points by NFL team
      const teamPoints: Record<string, number> = {}
      const teamPlayers: Record<string, PlayerPoints[]> = {}
      NFL_TEAMS.forEach(team => {
        teamPoints[team] = 0
        teamPlayers[team] = []
      })

      for (const [playerId, playerStats] of Object.entries(stats)) {
        const player = players[playerId]
        if (!player) continue

        // Skip defense/special teams
        if (player.position === 'DEF' || player.position === 'K') continue

        const team = player.team
        if (!team || !NFL_TEAMS.includes(team)) continue

        // Use pts_half_ppr for fantasy points
        const pts = (playerStats as Record<string, number>)?.pts_half_ppr || 0
        if (pts > 0) {
          teamPoints[team] += pts
          teamPlayers[team].push({
            playerId,
            name: player.full_name || `${player.first_name} ${player.last_name}`,
            position: player.position || 'N/A',
            points: pts,
          })
        }
      }

      // Add to weekly data
      for (const team of NFL_TEAMS) {
        if (teamPoints[team] > 0) {
          teamPointsByWeek[team].push({
            week,
            team,
            points: teamPoints[team],
            players: teamPlayers[team].sort((a, b) => b.points - a.points),
          })
        }
      }
    }

    // Convert to SeasonTeamPoints
    return NFL_TEAMS.map(team => ({
      season,
      team,
      totalPoints: teamPointsByWeek[team].reduce((sum, w) => sum + w.points, 0),
      weeklyPoints: teamPointsByWeek[team],
    }))
  }

  // Filter data for selected team and season
  const weeklyChartData = useMemo(() => {
    const teamSeasonData = seasonData.find(
      d => d.team === selectedTeam && d.season === selectedSeason
    )
    if (!teamSeasonData) return []

    return teamSeasonData.weeklyPoints
      .filter(w => w.points > 0)
      .map(w => ({
        week: w.week,
        points: Math.round(w.points * 10) / 10,
        players: w.players,
      }))
  }, [seasonData, selectedTeam, selectedSeason])

  // Data for second team (if selected)
  const weeklyChartData2 = useMemo(() => {
    if (!selectedTeam2) return []
    const teamSeasonData = seasonData.find(
      d => d.team === selectedTeam2 && d.season === selectedSeason
    )
    if (!teamSeasonData) return []

    return teamSeasonData.weeklyPoints
      .filter(w => w.points > 0)
      .map(w => ({
        week: w.week,
        points: Math.round(w.points * 10) / 10,
        players: w.players,
      }))
  }, [seasonData, selectedTeam2, selectedSeason])

  // Combined data for the chart (merge both teams by week)
  const combinedChartData = useMemo(() => {
    const allWeeks = new Set([
      ...weeklyChartData.map(w => w.week),
      ...weeklyChartData2.map(w => w.week),
    ])

    return Array.from(allWeeks).sort((a, b) => a - b).map(week => {
      const team1Data = weeklyChartData.find(w => w.week === week)
      const team2Data = weeklyChartData2.find(w => w.week === week)
      return {
        week,
        points: team1Data?.points ?? null,
        points2: team2Data?.points ?? null,
        players: team1Data?.players || [],
        players2: team2Data?.players || [],
      }
    }).filter(w => w.points !== null || w.points2 !== null)
  }, [weeklyChartData, weeklyChartData2])

  // Get selected week's player data
  const selectedWeekData = useMemo(() => {
    if (selectedWeek === null) return null
    return weeklyChartData.find(w => w.week === selectedWeek) || null
  }, [weeklyChartData, selectedWeek])

  // Bar chart data for comparing seasons
  const seasonComparisonData = useMemo(() => {
    const teamData = seasonData.filter(d => d.team === selectedTeam)
    return teamData
      .sort((a, b) => a.season.localeCompare(b.season))
      .map(d => {
        // Only count weeks with significant production (> 10 pts) to exclude bye week data
        const actualGames = d.weeklyPoints.filter(w => w.points > 10).length
        const gamesPlayed = Math.min(actualGames, 17)
        return {
          season: d.season,
          totalPoints: Math.round(d.totalPoints),
          avgPerWeek: gamesPlayed > 0
            ? Math.round(d.totalPoints / gamesPlayed * 10) / 10
            : 0,
        }
      })
  }, [seasonData, selectedTeam])

  // Get unique seasons
  const availableSeasons = useMemo(() => {
    return Array.from(new Set(seasonData.map(d => d.season))).sort().reverse()
  }, [seasonData])

  // Team rankings for current view
  const teamRankings = useMemo(() => {
    const rankings = seasonData
      .filter(d => d.season === selectedSeason)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((d, index) => {
        // NFL teams play max 17 games in regular season (18 weeks with 1 bye)
        // Only count weeks with significant production (> 10 pts) to exclude bye week data anomalies
        const actualGames = d.weeklyPoints.filter(w => w.points > 10).length
        const gamesPlayed = Math.min(actualGames, 17)
        return {
          rank: index + 1,
          team: d.team,
          totalPoints: Math.round(d.totalPoints),
          gamesPlayed,
          avgPerWeek: gamesPlayed > 0
            ? Math.round(d.totalPoints / gamesPlayed * 10) / 10
            : 0,
        }
      })
    return rankings
  }, [seasonData, selectedSeason])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="NFL Team Production"
        subtitle="Fantasy points produced by NFL teams (excludes DEF/K)"
        icon="nfl"
      />

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm text-gray-400 mb-1">NFL Team</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
              style={{ borderColor: NFL_TEAM_COLORS[selectedTeam] }}
            >
              {NFL_TEAMS.sort().map(team => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>

            {!selectedTeam2 && !showTeam2Selector && (
              <button
                onClick={() => setShowTeam2Selector(true)}
                className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 text-sm font-bold"
                title="Add team to compare"
              >
                +
              </button>
            )}

            {showTeam2Selector && !selectedTeam2 && (
              <select
                value=""
                onChange={(e) => {
                  setSelectedTeam2(e.target.value)
                  setShowTeam2Selector(false)
                }}
                className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
              >
                <option value="">Select 2nd team...</option>
                {NFL_TEAMS.sort().filter(t => t !== selectedTeam).map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            )}

            {selectedTeam2 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">vs</span>
                <select
                  value={selectedTeam2}
                  onChange={(e) => setSelectedTeam2(e.target.value)}
                  className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
                  style={{ borderColor: NFL_TEAM_COLORS[selectedTeam2] }}
                >
                  {NFL_TEAMS.sort().filter(t => t !== selectedTeam).map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedTeam2(null)}
                  className="px-2 py-2 bg-gray-700 hover:bg-red-600 rounded text-gray-300 text-sm"
                  title="Remove comparison"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">View</label>
          <div className="flex rounded overflow-hidden border border-gray-700">
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-2 text-sm ${
                viewMode === 'weekly'
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setViewMode('season')}
              className={`px-4 py-2 text-sm ${
                viewMode === 'season'
                  ? 'bg-amber-500 text-gray-900'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              By Season
            </button>
          </div>
        </div>

        {viewMode === 'weekly' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Season</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-amber-500"
            >
              {availableSeasons.map(season => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Charts */}
      {viewMode === 'weekly' ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h2 className="font-semibold mb-4">
            <span style={{ color: NFL_TEAM_COLORS[selectedTeam] }}>{selectedTeam}</span>
            {selectedTeam2 && (
              <>
                {' '}<span className="text-gray-400">vs</span>{' '}
                <span style={{ color: NFL_TEAM_COLORS[selectedTeam2] }}>{selectedTeam2}</span>
              </>
            )}
            {' '}- Weekly Production {selectedSeason}
          </h2>
          {(selectedTeam2 ? combinedChartData : weeklyChartData).length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                  data={selectedTeam2 ? combinedChartData : weeklyChartData}
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  onClick={(e: unknown) => {
                    const event = e as { activePayload?: Array<{ payload: { week: number } }> }
                    if (event?.activePayload?.[0]) {
                      setSelectedWeek(event.activePayload[0].payload.week)
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="week"
                  type="number"
                  domain={[1, 18]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#4B5563' }}
                />
                <YAxis
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#4B5563' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-gray-400 text-sm mb-1">Week {data.week}</p>
                          {data.points !== null && (
                            <p className="font-semibold" style={{ color: NFL_TEAM_COLORS[selectedTeam] }}>
                              {selectedTeam}: {data.points.toFixed(1)} pts
                            </p>
                          )}
                          {selectedTeam2 && data.points2 !== null && data.points2 !== undefined && (
                            <p className="font-semibold" style={{ color: NFL_TEAM_COLORS[selectedTeam2] }}>
                              {selectedTeam2}: {data.points2.toFixed(1)} pts
                            </p>
                          )}
                          <p className="text-gray-500 text-xs mt-1">Click for player breakdown</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Line
                  type="linear"
                  dataKey="points"
                  stroke={NFL_TEAM_COLORS[selectedTeam]}
                  strokeWidth={2}
                  dot={{ fill: NFL_TEAM_COLORS[selectedTeam], strokeWidth: 0, r: 5 }}
                  activeDot={{ r: 7, fill: NFL_TEAM_COLORS[selectedTeam] }}
                  connectNulls={false}
                />
                {selectedTeam2 && (
                  <Line
                    type="linear"
                    dataKey="points2"
                    stroke={NFL_TEAM_COLORS[selectedTeam2]}
                    strokeWidth={2}
                    dot={{ fill: NFL_TEAM_COLORS[selectedTeam2], strokeWidth: 0, r: 5 }}
                    activeDot={{ r: 7, fill: NFL_TEAM_COLORS[selectedTeam2] }}
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500">
              No data available for this selection
            </div>
          )}

          {/* Week Selector */}
          {weeklyChartData.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2">Select a week to see player breakdown:</p>
              <div className="flex flex-wrap gap-2">
                {weeklyChartData.map((w) => (
                  <button
                    key={w.week}
                    onClick={() => setSelectedWeek(w.week)}
                    className={`px-3 py-1 rounded text-sm ${
                      selectedWeek === w.week
                        ? 'bg-amber-500 text-gray-900 font-medium'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Wk {w.week}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Player Breakdown */}
          {selectedWeekData && (
            <div className="mt-4 border-t border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">
                  Week {selectedWeekData.week} Player Breakdown
                  <span className="text-gray-400 font-normal ml-2">
                    ({selectedWeekData.points.toFixed(1)} total pts)
                  </span>
                </h3>
                <button
                  onClick={() => setSelectedWeek(null)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  ✕ Close
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-800">
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="text-left py-2 pr-2">Player</th>
                      <th className="text-center py-2 px-2">Pos</th>
                      <th className="text-right py-2 pl-2">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWeekData.players.map((player) => (
                      <tr key={player.playerId} className="border-b border-gray-700/50">
                        <td className="py-2 pr-2">{player.name}</td>
                        <td className="text-center py-2 px-2 text-gray-400">{player.position}</td>
                        <td className="text-right py-2 pl-2 font-medium text-emerald-500">
                          {player.points.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h2 className="font-semibold mb-4">
            <span style={{ color: NFL_TEAM_COLORS[selectedTeam] }}>{selectedTeam}</span>
            {' '}Season Comparison
          </h2>
          {seasonComparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={seasonComparisonData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="season"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#4B5563' }}
                />
                <YAxis
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#4B5563' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-gray-400 text-sm mb-1">{label} Season</p>
                          <p className="font-semibold" style={{ color: NFL_TEAM_COLORS[selectedTeam] }}>
                            {payload[0]?.value?.toLocaleString()} total pts
                          </p>
                          <p className="text-gray-300 text-sm">
                            {payload[1]?.value} pts/week avg
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
                <Bar dataKey="totalPoints" name="Total Points" fill={NFL_TEAM_COLORS[selectedTeam]} />
                <Bar dataKey="avgPerWeek" name="Avg Per Week" fill={NFL_TEAM_COLORS[selectedTeam]} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500">
              No data available for this selection
            </div>
          )}
        </div>
      )}

      {/* Team Rankings Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="font-semibold">Team Rankings - {selectedSeason}</h2>
          <p className="text-sm text-gray-400">Total fantasy points produced</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-sm border-b border-gray-700">
                <th className="text-left p-3">Rank</th>
                <th className="text-left p-3">Team</th>
                <th className="text-right p-3">Total Pts</th>
                <th className="text-right p-3">Games</th>
                <th className="text-right p-3">Avg/Week</th>
              </tr>
            </thead>
            <tbody>
              {teamRankings.map((team) => (
                <tr
                  key={team.team}
                  onClick={() => setSelectedTeam(team.team)}
                  className={`border-b border-gray-700 cursor-pointer transition-colors ${
                    team.team === selectedTeam
                      ? 'bg-amber-500/10 border-l-4 border-l-amber-500'
                      : 'hover:bg-gray-700/50 border-l-4 border-l-transparent'
                  }`}
                >
                  <td className="p-3">
                    <span className={team.rank <= 10 ? 'text-emerald-500' : 'text-gray-400'}>
                      {team.rank}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: NFL_TEAM_COLORS[team.team] }}
                      />
                      <span className="font-medium">{team.team}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right font-medium text-emerald-500">
                    {team.totalPoints.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-gray-400">
                    {team.gamesPlayed}
                  </td>
                  <td className="p-3 text-right text-gray-400">
                    {team.avgPerWeek}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-gray-500 text-sm text-center">
        Points calculated using half-PPR scoring. Excludes defense and kickers.
      </p>
    </div>
  )
}

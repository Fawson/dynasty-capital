'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Transaction } from '@/lib/sleeper'
import PageHeader from '@/components/PageHeader'
import { SleeperRoster, LeagueUser, SleeperPlayer, SleeperLeague } from '@/lib/types'

interface TradeValues {
  values: { [playerName: string]: { atTrade: number | null; current: number } }
  pickValues: { [pickLabel: string]: { atTrade: number; current: number } }
}

interface TradePartner {
  rosterId1: number
  rosterId2: number
  count: number
}

interface TradeNetworkProps {
  rosters: RosterWithUser[]
  tradePartners: TradePartner[]
  getTeamName: (rosterId: number) => string
}

function TradeNetwork({ rosters, tradePartners, getTeamName }: TradeNetworkProps) {
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; partnerId: number; count: number; color: string } | null>(null)

  // Get teams that have traded
  const tradingTeams = useMemo(() => {
    const teamIds = new Set<number>()
    tradePartners.forEach(p => {
      teamIds.add(p.rosterId1)
      teamIds.add(p.rosterId2)
    })
    return rosters.filter(r => teamIds.has(r.roster_id))
  }, [rosters, tradePartners])

  // Get connections for selected team
  const connections = useMemo(() => {
    if (!selectedTeam) return []
    return tradePartners
      .filter(p => p.rosterId1 === selectedTeam || p.rosterId2 === selectedTeam)
      .map(p => ({
        partnerId: p.rosterId1 === selectedTeam ? p.rosterId2 : p.rosterId1,
        count: p.count
      }))
      .sort((a, b) => b.count - a.count)
  }, [selectedTeam, tradePartners])

  // Get teams with no trades
  const noTradeTeams = useMemo(() => {
    if (!selectedTeam) return []
    const partnerIds = new Set(connections.map(c => c.partnerId))
    return rosters
      .filter(r => r.roster_id !== selectedTeam && !partnerIds.has(r.roster_id))
      .map(r => getTeamName(r.roster_id))
  }, [selectedTeam, connections, rosters, getTeamName])

  const totalTrades = connections.reduce((sum, c) => sum + c.count, 0)

  // Colors for pie segments
  const colors = [
    '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899',
    '#14b8a6', '#f97316', '#06b6d4', '#a855f7', '#ef4444',
    '#84cc16', '#6366f1'
  ]

  // Calculate pie segments
  const segments = useMemo(() => {
    if (totalTrades === 0) return []

    let currentAngle = -90 // Start from top
    return connections.map((conn, idx) => {
      const percentage = conn.count / totalTrades
      const angle = percentage * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle
      currentAngle = endAngle

      // Calculate arc path
      const radius = 80
      const innerRadius = 50
      const centerX = 100
      const centerY = 100

      const startRad = (startAngle * Math.PI) / 180
      const endRad = (endAngle * Math.PI) / 180

      const x1 = centerX + radius * Math.cos(startRad)
      const y1 = centerY + radius * Math.sin(startRad)
      const x2 = centerX + radius * Math.cos(endRad)
      const y2 = centerY + radius * Math.sin(endRad)
      const x3 = centerX + innerRadius * Math.cos(endRad)
      const y3 = centerY + innerRadius * Math.sin(endRad)
      const x4 = centerX + innerRadius * Math.cos(startRad)
      const y4 = centerY + innerRadius * Math.sin(startRad)

      const largeArc = angle > 180 ? 1 : 0

      const path = `
        M ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        L ${x3} ${y3}
        A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
        Z
      `

      return {
        ...conn,
        path,
        color: colors[idx % colors.length],
        percentage
      }
    })
  }, [connections, totalTrades])

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Trade Partners
      </h3>

      {/* Team Selector */}
      <div className="mb-4">
        <select
          value={selectedTeam || ''}
          onChange={(e) => setSelectedTeam(e.target.value ? Number(e.target.value) : null)}
          className="w-full sm:w-auto bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">Select a team...</option>
          {tradingTeams.map(roster => (
            <option key={roster.roster_id} value={roster.roster_id}>
              {getTeamName(roster.roster_id)}
            </option>
          ))}
        </select>
      </div>

      {/* Donut Chart */}
      {selectedTeam ? (
        <div className="space-y-6">
          {/* Chart - Centered */}
          <div className="flex justify-center">
            <div className="relative">
              <svg
                viewBox="0 0 200 200"
                className="w-64 h-64 sm:w-72 sm:h-72 drop-shadow-lg"
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Background circle for empty state or visual depth */}
                <circle
                  cx="100"
                  cy="100"
                  r="75"
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="35"
                />
                {segments.length > 0 ? (
                  segments.map((segment) => (
                    <path
                      key={segment.partnerId}
                      d={segment.path}
                      fill={segment.color}
                      className="hover:brightness-125 transition-all duration-200 cursor-pointer"
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                        if (rect) {
                          setTooltip({
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                            partnerId: segment.partnerId,
                            count: segment.count,
                            color: segment.color
                          })
                        }
                      }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
                        if (rect && tooltip) {
                          setTooltip(prev => prev ? {
                            ...prev,
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top
                          } : null)
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))
                ) : null}
              </svg>

              {/* Custom Tooltip */}
              {tooltip && (
                <div
                  className="absolute pointer-events-none z-10 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg shadow-xl text-sm whitespace-nowrap transform -translate-x-1/2 -translate-y-full"
                  style={{
                    left: tooltip.x,
                    top: tooltip.y - 10,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tooltip.color }}
                    />
                    <span className="text-white font-medium">{getTeamName(tooltip.partnerId)}</span>
                  </div>
                  <div className="text-amber-400 font-semibold mt-1">
                    {tooltip.count} trade{tooltip.count !== 1 ? 's' : ''}
                  </div>
                  {/* Tooltip arrow */}
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-gray-900 border-r border-b border-gray-600 transform rotate-45" />
                </div>
              )}
              {/* Center text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center px-4">
                  <div className="text-white font-bold text-base sm:text-lg leading-tight max-w-[100px] mx-auto">
                    {getTeamName(selectedTeam).length > 15
                      ? getTeamName(selectedTeam).split(' ').slice(0, 2).join(' ')
                      : getTeamName(selectedTeam)
                    }
                  </div>
                  <div className="text-amber-500 font-bold text-3xl sm:text-4xl mt-1">{totalTrades}</div>
                  <div className="text-gray-400 text-sm">total trades</div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend - Centered grid */}
          {segments.length > 0 && (
            <div className="flex justify-center">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                {segments.map((segment) => (
                  <div key={segment.partnerId} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-gray-300 truncate max-w-[120px]">{getTeamName(segment.partnerId)}</span>
                    <span className="text-amber-500 font-semibold">{segment.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No trades with */}
          {noTradeTeams.length > 0 && (
            <div className="pt-4 border-t border-gray-700 text-center">
              <p className="text-gray-500 text-sm">
                <span className="text-gray-400 font-medium">No trades with:</span>{' '}
                <span className="text-gray-500">{noTradeTeams.join(', ')}</span>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          Select a team to view their trade partners
        </div>
      )}
    </div>
  )
}

interface TeamStats {
  tradesCompleted: number
  playersGiven: number
  picksGiven: number
  playersReceived: number
  picksReceived: number
  trades: Transaction[]
}

interface RosterWithUser extends SleeperRoster {
  user?: LeagueUser
}

interface TradeWithSeason extends Transaction {
  season: string
}

export default function TradeHistory() {
  const params = useParams()
  const searchParams = useSearchParams()
  const leagueId = params.leagueId as string
  const userId = searchParams.get('userId')

  const [league, setLeague] = useState<SleeperLeague | null>(null)
  const [allTrades, setAllTrades] = useState<TradeWithSeason[]>([])
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string>('current')
  const [rostersWithUsers, setRostersWithUsers] = useState<RosterWithUser[]>([])
  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({})
  const [tradeValues, setTradeValues] = useState<Record<string, TradeValues>>({})
  const [loading, setLoading] = useState(true)
  const [loadingValues, setLoadingValues] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function fetchData() {
      try {
        const [leagueRes, rostersRes, usersRes, playersRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
          fetch('/api/players'),
        ])

        const leagueData: SleeperLeague = await leagueRes.json()
        const rosters: SleeperRoster[] = await rostersRes.json()
        const users: LeagueUser[] = await usersRes.json()
        const players: Record<string, SleeperPlayer> = await playersRes.json()

        setLeague(leagueData)
        setAllPlayers(players)

        // Map users to rosters
        const userMap = new Map(users.map((u) => [u.user_id, u]))
        const rostersWithUsersData = rosters.map((roster) => ({
          ...roster,
          user: userMap.get(roster.owner_id),
        }))
        setRostersWithUsers(rostersWithUsersData)

        // Fetch league history to get all seasons
        const leagueHistory: SleeperLeague[] = [leagueData]
        let currentLeagueId = leagueData.previous_league_id
        while (currentLeagueId) {
          try {
            const prevLeagueRes = await fetch(`https://api.sleeper.app/v1/league/${currentLeagueId}`)
            const prevLeague: SleeperLeague = await prevLeagueRes.json()
            leagueHistory.push(prevLeague)
            currentLeagueId = prevLeague.previous_league_id
          } catch {
            break
          }
        }

        // Fetch trades from all seasons
        const allTradesWithSeason: TradeWithSeason[] = []
        const seasons: string[] = []

        for (const historicalLeague of leagueHistory) {
          seasons.push(historicalLeague.season)
          const weeks = Array.from({ length: 18 }, (_, i) => i + 1)
          const seasonTransactions = await Promise.all(
            weeks.map(week =>
              fetch(`https://api.sleeper.app/v1/league/${historicalLeague.league_id}/transactions/${week}`)
                .then(res => res.json())
                .catch(() => [])
            )
          )

          const trades = seasonTransactions
            .flat()
            .filter((t: Transaction) => t.type === 'trade' && t.status === 'complete')
            .map((t: Transaction) => ({ ...t, season: historicalLeague.season }))

          allTradesWithSeason.push(...trades)
        }

        // Sort all trades by date descending
        allTradesWithSeason.sort((a, b) => b.created - a.created)

        setAvailableSeasons(seasons)
        setAllTrades(allTradesWithSeason)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [leagueId])

  // Fetch trade values for a specific trade
  const fetchTradeValues = async (trade: Transaction) => {
    if (tradeValues[trade.transaction_id] || loadingValues[trade.transaction_id]) return

    setLoadingValues(prev => ({ ...prev, [trade.transaction_id]: true }))

    try {
      // Get all players involved in the trade
      const playerIds = [
        ...Object.keys(trade.adds || {}),
        ...Object.keys(trade.drops || {}),
      ]

      const players = playerIds.map(id => {
        const player = allPlayers[id]
        return {
          name: player?.full_name || id,
          position: player?.position || 'Unknown',
        }
      }).filter(p => p.name)

      // Get all picks involved in the trade
      const picks = (trade.draft_picks || []).map(pick => {
        // Estimate position based on roster - use 'mid' as default
        const position: 'early' | 'mid' | 'late' = 'mid'
        return {
          season: pick.season,
          round: pick.round,
          position,
          label: `${pick.season} Rd ${pick.round}`,
        }
      })

      const response = await fetch('/api/trade-values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          players,
          picks,
          tradeDate: trade.created.toString(),
        }),
      })

      const data = await response.json()
      setTradeValues(prev => ({
        ...prev,
        [trade.transaction_id]: {
          values: data.values || {},
          pickValues: data.pickValues || {}
        }
      }))
    } catch (error) {
      console.error('Failed to fetch trade values:', error)
      setTradeValues(prev => ({
        ...prev,
        [trade.transaction_id]: { values: {}, pickValues: {} }
      }))
    } finally {
      setLoadingValues(prev => ({ ...prev, [trade.transaction_id]: false }))
    }
  }

  const rosterMap = new Map(rostersWithUsers.map((r) => [r.roster_id, r]))

  const getTeamName = (rosterId: number) => {
    const roster = rosterMap.get(rosterId)
    return roster?.user?.metadata?.team_name || roster?.user?.display_name || `Team ${rosterId}`
  }

  const getPlayerName = (playerId: string) => {
    const player = allPlayers[playerId]
    return player?.full_name || playerId
  }

  const getPlayerPosition = (playerId: string) => {
    const player = allPlayers[playerId]
    return player?.position || ''
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  // Filter trades based on selected season
  const filteredTrades = useMemo(() => {
    if (selectedSeason === 'all') {
      return allTrades
    }
    if (selectedSeason === 'current') {
      return allTrades.filter(t => t.season === league?.season)
    }
    return allTrades.filter(t => t.season === selectedSeason)
  }, [allTrades, selectedSeason, league?.season])

  // Determine if a trade is during in-season (Sept - Feb) or offseason (Mar - Aug)
  const isInSeason = (timestamp: number) => {
    const date = new Date(timestamp)
    const month = date.getMonth() // 0-indexed: 0=Jan, 8=Sept
    // In-season: September (8) through February (1)
    return month >= 8 || month <= 1
  }

  // Calculate trade stats per team
  const teamStats = new Map<number, TeamStats>()

  rostersWithUsers.forEach((roster) => {
    teamStats.set(roster.roster_id, {
      tradesCompleted: 0,
      playersGiven: 0,
      picksGiven: 0,
      playersReceived: 0,
      picksReceived: 0,
      trades: [],
    })
  })

  filteredTrades.forEach((trade) => {
    trade.roster_ids.forEach((rosterId) => {
      const stats = teamStats.get(rosterId)
      if (!stats) return

      stats.tradesCompleted++
      stats.trades.push(trade)

      if (trade.drops) {
        Object.entries(trade.drops).forEach(([, fromRosterId]) => {
          if (fromRosterId === rosterId) stats.playersGiven++
        })
      }

      if (trade.adds) {
        Object.entries(trade.adds).forEach(([, toRosterId]) => {
          if (toRosterId === rosterId) stats.playersReceived++
        })
      }

      trade.draft_picks?.forEach((pick) => {
        if (pick.previous_owner_id === rosterId && pick.owner_id !== rosterId) {
          stats.picksGiven++
        }
        if (pick.owner_id === rosterId && pick.previous_owner_id !== rosterId) {
          stats.picksReceived++
        }
      })
    })
  })

  const sortedTeams = [...rostersWithUsers].sort((a, b) => {
    const statsA = teamStats.get(a.roster_id)
    const statsB = teamStats.get(b.roster_id)
    return (statsB?.tradesCompleted || 0) - (statsA?.tradesCompleted || 0)
  })

  // Calculate trade partnerships
  const tradePartners = useMemo(() => {
    const partnerships = new Map<string, number>()

    filteredTrades.forEach(trade => {
      if (trade.roster_ids.length === 2) {
        const [a, b] = trade.roster_ids.sort((x, y) => x - y)
        const key = `${a}-${b}`
        partnerships.set(key, (partnerships.get(key) || 0) + 1)
      }
    })

    return Array.from(partnerships.entries())
      .map(([key, count]) => {
        const [a, b] = key.split('-').map(Number)
        return { rosterId1: a, rosterId2: b, count }
      })
      .sort((a, b) => b.count - a.count)
  }, [filteredTrades])

  // Parse trade with value calculations
  const parseTrade = (trade: Transaction) => {
    const tradeData = tradeValues[trade.transaction_id] || { values: {}, pickValues: {} }
    const playerValues = tradeData.values || {}
    const pickValuesData = tradeData.pickValues || {}

    type TradeItem = { type: 'player' | 'pick' | 'faab' | 'dropped'; value: string; detail?: string; playerId?: string; pickLabel?: string }

    // Build set of player IDs that were actually traded (appear in adds)
    const tradedPlayerIds = new Set(Object.keys(trade.adds || {}))

    const sides: {
      rosterId: number
      receives: TradeItem[]
      gives: TradeItem[]
      rosterDrops: TradeItem[]
      totalAtTrade: number
      totalNow: number
    }[] = []

    trade.roster_ids.forEach((rosterId) => {
      const receives: TradeItem[] = []
      const gives: TradeItem[] = []
      const rosterDrops: TradeItem[] = []
      let totalAtTrade = 0
      let totalNow = 0

      // Players received
      if (trade.adds) {
        Object.entries(trade.adds).forEach(([playerId, toRosterId]) => {
          if (toRosterId === rosterId) {
            const playerName = getPlayerName(playerId)
            const pValues = playerValues[playerName]
            if (pValues) {
              // If historical value is N/A, treat as static (use current for both)
              const atTradeValue = pValues.atTrade !== null ? pValues.atTrade : pValues.current
              totalAtTrade += atTradeValue
              totalNow += pValues.current
            }
            receives.push({
              type: 'player',
              value: playerName,
              detail: getPlayerPosition(playerId),
              playerId,
            })
          }
        })
      }

      // Players given away vs dropped for roster space
      if (trade.drops) {
        Object.entries(trade.drops).forEach(([playerId, fromRosterId]) => {
          if (fromRosterId === rosterId) {
            const playerName = getPlayerName(playerId)
            // Check if this player was traded (appears in adds) or just dropped for space
            if (tradedPlayerIds.has(playerId)) {
              // Player was traded to someone
              gives.push({
                type: 'player',
                value: playerName,
                detail: getPlayerPosition(playerId),
                playerId,
              })
            } else {
              // Player was dropped to make roster space
              rosterDrops.push({
                type: 'dropped',
                value: playerName,
                detail: getPlayerPosition(playerId),
                playerId,
              })
            }
          }
        })
      }

      // Picks received
      trade.draft_picks?.forEach((pick) => {
        if (pick.owner_id === rosterId && pick.previous_owner_id !== rosterId) {
          const pickLabel = `${pick.season} Rd ${pick.round}`
          const pValues = pickValuesData[pickLabel]
          if (pValues) {
            totalAtTrade += pValues.atTrade
            totalNow += pValues.current
          }
          receives.push({
            type: 'pick',
            value: pickLabel,
            detail: pick.roster_id !== pick.previous_owner_id
              ? `(${getTeamName(pick.roster_id)}'s)`
              : undefined,
            pickLabel,
          })
        }
        // Picks given away
        if (pick.previous_owner_id === rosterId && pick.owner_id !== rosterId) {
          const pickLabel = `${pick.season} Rd ${pick.round}`
          gives.push({
            type: 'pick',
            value: pickLabel,
            detail: pick.roster_id !== pick.previous_owner_id
              ? `(${getTeamName(pick.roster_id)}'s)`
              : undefined,
            pickLabel,
          })
        }
      })

      // FAAB received
      trade.waiver_budget?.forEach((budget) => {
        if (budget.receiver === rosterId) {
          receives.push({
            type: 'faab',
            value: `$${budget.amount}`,
          })
        }
        // FAAB given
        if (budget.sender === rosterId) {
          gives.push({
            type: 'faab',
            value: `$${budget.amount}`,
          })
        }
      })

      sides.push({ rosterId, receives, gives, rosterDrops, totalAtTrade, totalNow })
    })

    return sides
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-700 rounded mb-2" />
          <div className="h-4 w-32 bg-gray-700 rounded" />
        </div>
        <div className="h-64 bg-gray-800 rounded-lg animate-pulse" />
      </div>
    )
  }

  // Get subtitle based on selection
  const getSubtitle = () => {
    const count = filteredTrades.length
    const tradeWord = count === 1 ? 'trade' : 'trades'
    if (selectedSeason === 'all') {
      return `${count} ${tradeWord} across all seasons`
    }
    const season = selectedSeason === 'current' ? league?.season : selectedSeason
    return `${count} ${tradeWord} in ${season}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          title="Trade History"
          subtitle={getSubtitle()}
          icon="trades"
        />

        {/* Season Selector */}
        <div className="flex-shrink-0">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
          >
            <option value="current">{league?.season} Season</option>
            <option value="all">All Seasons</option>
            {availableSeasons.length > 1 && (
              <optgroup label="By Season">
                {availableSeasons.map(season => (
                  <option key={season} value={season}>{season}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Trade Network Visualization */}
      {filteredTrades.length > 0 && (
        <TradeNetwork
          rosters={rostersWithUsers}
          tradePartners={tradePartners}
          getTeamName={getTeamName}
        />
      )}

      {/* Trade Stats Table */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-gray-800 text-left">
              <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Team</th>
              <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-center w-20">Trades</th>
              <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-center w-24">
                <span className="hidden sm:inline">Players Given</span>
                <span className="sm:hidden">P Given</span>
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-center w-24">
                <span className="hidden sm:inline">Picks Given</span>
                <span className="sm:hidden">Pk Given</span>
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-center w-24">
                <span className="hidden sm:inline">Players Rec'd</span>
                <span className="sm:hidden">P Rec'd</span>
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium text-center w-24">
                <span className="hidden sm:inline">Picks Rec'd</span>
                <span className="sm:hidden">Pk Rec'd</span>
              </th>
              <th className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sortedTeams.map((roster) => {
              const stats = teamStats.get(roster.roster_id)
              if (!stats) return null

              const isUserTeam = userId && (roster.owner_id === userId || roster.user?.user_id === userId)
              const uniqueTrades = Array.from(new Map(stats.trades.map(t => [t.transaction_id, t])).values())

              return (
                <tr key={roster.roster_id} className="group">
                  <td colSpan={7} className="p-0">
                    <details
                      className="group/details"
                      onToggle={(e) => {
                        if ((e.target as HTMLDetailsElement).open) {
                          uniqueTrades.forEach(trade => fetchTradeValues(trade))
                        }
                      }}
                    >
                      <summary className={`cursor-pointer list-none ${
                        isUserTeam ? 'bg-amber-500/10 border-l-4 border-l-amber-500' : 'hover:bg-gray-800/50'
                      }`}>
                        <div className="flex items-center">
                          <div className="px-4 py-4 flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {roster.user?.metadata?.team_name || roster.user?.display_name || 'Unknown'}
                            </p>
                          </div>
                          <div className="px-4 py-4 w-20 text-center font-semibold">
                            {stats.tradesCompleted}
                          </div>
                          <div className="px-4 py-4 w-24 text-center">
                            <span className={stats.playersGiven > 0 ? 'text-red-400' : 'text-gray-500'}>
                              {stats.playersGiven}
                            </span>
                          </div>
                          <div className="px-4 py-4 w-24 text-center">
                            <span className={stats.picksGiven > 0 ? 'text-red-400' : 'text-gray-500'}>
                              {stats.picksGiven}
                            </span>
                          </div>
                          <div className="px-4 py-4 w-24 text-center">
                            <span className={stats.playersReceived > 0 ? 'text-emerald-400' : 'text-gray-500'}>
                              {stats.playersReceived}
                            </span>
                          </div>
                          <div className="px-4 py-4 w-24 text-center">
                            <span className={stats.picksReceived > 0 ? 'text-emerald-400' : 'text-gray-500'}>
                              {stats.picksReceived}
                            </span>
                          </div>
                          <div className="px-4 py-4 w-20">
                            {stats.tradesCompleted > 0 && (
                              <span className="text-xs text-gray-400 group-open/details:hidden">
                                Details ▶
                              </span>
                            )}
                            {stats.tradesCompleted > 0 && (
                              <span className="text-xs text-amber-400 hidden group-open/details:inline">
                                Hide ▼
                              </span>
                            )}
                          </div>
                        </div>
                      </summary>

                      {/* Trade Details */}
                      {uniqueTrades.length > 0 && (
                        <div className="bg-gray-800/30 border-t border-gray-700 px-4 py-4">
                          <div className="space-y-4">
                            {uniqueTrades.map((trade, idx) => {
                              const sides = parseTrade(trade)
                              const isLoadingValues = loadingValues[trade.transaction_id]
                              const tradeInSeason = isInSeason(trade.created)
                              const prevTrade = uniqueTrades[idx - 1]
                              const showSeasonDivider = idx > 0 && prevTrade && isInSeason(prevTrade.created) !== tradeInSeason

                              return (
                                <div key={trade.transaction_id}>
                                  {/* Season divider */}
                                  {showSeasonDivider && (
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className="flex-1 h-px bg-gray-600"></div>
                                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        {tradeInSeason ? 'In-Season' : 'Offseason'}
                                      </span>
                                      <div className="flex-1 h-px bg-gray-600"></div>
                                    </div>
                                  )}
                                  {/* First trade section header */}
                                  {idx === 0 && (
                                    <div className="flex items-center gap-3 mb-4">
                                      <div className="flex-1 h-px bg-gray-600"></div>
                                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        {tradeInSeason ? 'In-Season' : 'Offseason'}
                                      </span>
                                      <div className="flex-1 h-px bg-gray-600"></div>
                                    </div>
                                  )}
                                  <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                                  <div className="px-3 py-1.5 bg-gray-800/50 border-b border-gray-700 text-xs text-gray-400">
                                    Week {trade.leg} • {formatDate(trade.created)}
                                  </div>
                                  <div className="p-3 grid gap-4 sm:grid-cols-2">
                                    {sides.map((side) => {
                                      const valueChange = side.totalNow - side.totalAtTrade
                                      const tradeData = tradeValues[trade.transaction_id] || { values: {}, pickValues: {} }
                                      // Consider having values if we have any player/pick data (N/A treated as static)
                                      const hasValues = side.receives.some(r =>
                                        (r.type === 'player' && tradeData.values?.[r.value]) ||
                                        (r.type === 'pick' && r.pickLabel && tradeData.pickValues?.[r.pickLabel])
                                      )

                                      const renderItem = (item: typeof side.receives[0], i: number, showValues: boolean = true) => {
                                        const pValues = item.type === 'player' ? tradeData.values?.[item.value] : null
                                        const pickVals = item.type === 'pick' && item.pickLabel ? tradeData.pickValues?.[item.pickLabel] : null

                                        return (
                                          <div key={i} className="flex items-center justify-between gap-2 text-sm">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              {item.type === 'player' && (
                                                <>
                                                  <span className={`text-[10px] px-1 py-0.5 rounded font-medium flex-shrink-0 ${
                                                    item.detail === 'QB' ? 'bg-red-600' :
                                                    item.detail === 'RB' ? 'bg-green-600' :
                                                    item.detail === 'WR' ? 'bg-blue-600' :
                                                    item.detail === 'TE' ? 'bg-orange-600' :
                                                    'bg-gray-600'
                                                  }`}>
                                                    {item.detail}
                                                  </span>
                                                  <span className="truncate">{item.value}</span>
                                                </>
                                              )}
                                              {item.type === 'pick' && (
                                                <>
                                                  <span className="text-[10px] px-1 py-0.5 rounded font-medium bg-purple-600 flex-shrink-0">
                                                    PICK
                                                  </span>
                                                  <span>{item.value}</span>
                                                  {item.detail && (
                                                    <span className="text-[10px] text-gray-500">{item.detail}</span>
                                                  )}
                                                </>
                                              )}
                                              {item.type === 'faab' && (
                                                <>
                                                  <span className="text-[10px] px-1 py-0.5 rounded font-medium bg-yellow-600 flex-shrink-0">
                                                    FAAB
                                                  </span>
                                                  <span>{item.value}</span>
                                                </>
                                              )}
                                            </div>

                                            {/* Player value comparison */}
                                            {showValues && item.type === 'player' && pValues && (
                                              <div className="flex items-center gap-1 text-[10px] flex-shrink-0">
                                                {pValues.atTrade !== null ? (
                                                  <>
                                                    <span className="text-gray-500">{pValues.atTrade.toLocaleString()}</span>
                                                    <span className="text-gray-600">→</span>
                                                    <span className={pValues.current > pValues.atTrade ? 'text-emerald-400' : pValues.current < pValues.atTrade ? 'text-red-400' : 'text-gray-400'}>
                                                      {pValues.current.toLocaleString()}
                                                    </span>
                                                    {pValues.current !== pValues.atTrade && (
                                                      <span className={pValues.current > pValues.atTrade ? 'text-emerald-400' : 'text-red-400'}>
                                                        ({pValues.current > pValues.atTrade ? '+' : ''}{(pValues.current - pValues.atTrade).toLocaleString()})
                                                      </span>
                                                    )}
                                                  </>
                                                ) : (
                                                  // N/A historical value - show as static (current value only)
                                                  <span className="text-gray-400">{pValues.current.toLocaleString()}</span>
                                                )}
                                              </div>
                                            )}

                                            {/* Pick value comparison */}
                                            {showValues && item.type === 'pick' && pickVals && (
                                              <div className="flex items-center gap-1 text-[10px] flex-shrink-0">
                                                <span className="text-gray-500">{pickVals.atTrade.toLocaleString()}</span>
                                                <span className="text-gray-600">→</span>
                                                <span className={pickVals.current > pickVals.atTrade ? 'text-emerald-400' : pickVals.current < pickVals.atTrade ? 'text-red-400' : 'text-gray-400'}>
                                                  {pickVals.current.toLocaleString()}
                                                </span>
                                                {pickVals.current !== pickVals.atTrade && (
                                                  <span className={pickVals.current > pickVals.atTrade ? 'text-emerald-400' : 'text-red-400'}>
                                                    ({pickVals.current > pickVals.atTrade ? '+' : ''}{(pickVals.current - pickVals.atTrade).toLocaleString()})
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      }

                                      return (
                                        <div key={side.rosterId}>
                                          <p className="text-xs text-gray-500 mb-1.5">
                                            {getTeamName(side.rosterId)} receives:
                                          </p>
                                          <div className="space-y-1.5">
                                            {side.receives.map((item, i) => renderItem(item, i, true))}
                                            {side.receives.length === 0 && (
                                              <span className="text-gray-500 text-xs">Nothing</span>
                                            )}
                                          </div>

                                          {/* Roster drops section - only show if there are drops */}
                                          {side.rosterDrops.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                              <p className="text-[10px] text-gray-500 mb-1">Dropped for space:</p>
                                              <div className="space-y-1">
                                                {side.rosterDrops.map((item, i) => (
                                                  <div key={i} className="flex items-center gap-1.5 text-sm text-gray-500">
                                                    <span className={`text-[10px] px-1 py-0.5 rounded font-medium flex-shrink-0 opacity-60 ${
                                                      item.detail === 'QB' ? 'bg-red-600' :
                                                      item.detail === 'RB' ? 'bg-green-600' :
                                                      item.detail === 'WR' ? 'bg-blue-600' :
                                                      item.detail === 'TE' ? 'bg-orange-600' :
                                                      'bg-gray-600'
                                                    }`}>
                                                      {item.detail}
                                                    </span>
                                                    <span className="truncate">{item.value}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {/* Side total */}
                                          {hasValues && (
                                            <div className="mt-2 pt-2 border-t border-gray-700 flex items-center justify-between text-xs">
                                              <span className="text-gray-500">Value change:</span>
                                              <span className={
                                                valueChange > 0 ? 'text-emerald-400 font-semibold' :
                                                valueChange < 0 ? 'text-red-400 font-semibold' :
                                                'text-gray-400'
                                              }>
                                                {valueChange > 0 ? '+' : ''}{valueChange.toLocaleString()}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Trade verdict */}
                                  {tradeValues[trade.transaction_id] && sides.length === 2 && sides.every(s => s.totalAtTrade > 0) && (
                                    <div className="px-3 py-2 bg-gray-900/50 border-t border-gray-700">
                                      {(() => {
                                        // At trade time comparison
                                        const atTradeDiff = sides[0].totalAtTrade - sides[1].totalAtTrade
                                        const atTradeWinner = Math.abs(atTradeDiff) < 500 ? null : atTradeDiff > 0 ? 0 : 1
                                        const atTradeLoser = atTradeWinner === 0 ? 1 : 0

                                        // Current value comparison
                                        const nowDiff = sides[0].totalNow - sides[1].totalNow
                                        const nowWinner = Math.abs(nowDiff) < 500 ? null : nowDiff > 0 ? 0 : 1
                                        const nowLoser = nowWinner === 0 ? 1 : 0

                                        // Build verdict
                                        const atTradeVerdict = atTradeWinner === null
                                          ? 'Even at trade time'
                                          : `${getTeamName(sides[atTradeWinner].rosterId)} won at trade (+${Math.abs(atTradeDiff).toLocaleString()})`

                                        const nowVerdict = nowWinner === null
                                          ? 'Still even now'
                                          : `${getTeamName(sides[nowWinner].rosterId)} ahead now (+${Math.abs(nowDiff).toLocaleString()})`

                                        // Determine if outcome changed
                                        const outcomeChanged = atTradeWinner !== nowWinner && atTradeWinner !== null && nowWinner !== null

                                        return (
                                          <div className="text-xs text-center space-y-1">
                                            <p>
                                              {atTradeWinner === null ? (
                                                <span className="text-gray-400">⚖️ {atTradeVerdict}</span>
                                              ) : (
                                                <>
                                                  <span className="text-amber-400 font-medium">{getTeamName(sides[atTradeWinner].rosterId)}</span>
                                                  <span className="text-gray-400"> won at trade </span>
                                                  <span className="text-gray-500">(+{Math.abs(atTradeDiff).toLocaleString()})</span>
                                                </>
                                              )}
                                            </p>
                                            <p>
                                              {nowWinner === null ? (
                                                <span className="text-gray-400">⚖️ Still even now</span>
                                              ) : nowWinner === atTradeWinner ? (
                                                <>
                                                  <span className="text-gray-400">Still ahead </span>
                                                  <span className="text-emerald-400">(+{Math.abs(nowDiff).toLocaleString()} now)</span>
                                                </>
                                              ) : (
                                                <>
                                                  <span className="text-emerald-400 font-medium">{getTeamName(sides[nowWinner].rosterId)}</span>
                                                  <span className="text-gray-400"> won over time </span>
                                                  <span className="text-emerald-400">(+{Math.abs(nowDiff).toLocaleString()})</span>
                                                </>
                                              )}
                                            </p>
                                          </div>
                                        )
                                      })()}
                                    </div>
                                  )}

                                  {isLoadingValues && (
                                    <div className="px-3 py-2 bg-gray-900/50 border-t border-gray-700 text-xs text-gray-500 text-center">
                                      Loading values...
                                    </div>
                                  )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </details>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filteredTrades.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No trades have been made this season yet.
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Values from KeepTradeCut dynasty rankings. Historical values may not be available for all players.
      </p>
    </div>
  )
}

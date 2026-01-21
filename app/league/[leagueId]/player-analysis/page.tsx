'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { SleeperPlayer, SleeperRoster, LeagueUser } from '@/lib/types'
import { Skeleton, SkeletonPlayerList } from '@/components/Skeleton'
import AllPlayersTab from '@/components/players/AllPlayersTab'
import DeepDiveTab from '@/components/players/DeepDiveTab'
import CompareTab from '@/components/players/CompareTab'
import AgeCurveTab from '@/components/players/AgeCurveTab'
import NewsTab from '@/components/players/NewsTab'

type TabType = 'all-players' | 'deep-dive' | 'compare' | 'age-curve' | 'news'

const TABS: { id: TabType; label: string; description: string }[] = [
  { id: 'all-players', label: 'All Players', description: 'Browse all rostered players' },
  { id: 'deep-dive', label: 'Deep Dive', description: 'Detailed player analysis' },
  { id: 'compare', label: 'Compare', description: 'Compare multiple players' },
  { id: 'age-curve', label: 'Age Curves', description: 'Dynasty value by age' },
  { id: 'news', label: 'News', description: 'Latest player news and updates' },
]

export default function PlayerAnalysisPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const leagueId = params.leagueId as string
  const initialPlayerId = searchParams.get('playerId')
  const initialTab = searchParams.get('tab') as TabType | null

  const [allPlayers, setAllPlayers] = useState<Record<string, SleeperPlayer>>({})
  const [rosters, setRosters] = useState<SleeperRoster[]>([])
  const [users, setUsers] = useState<LeagueUser[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || (initialPlayerId ? 'deep-dive' : 'all-players'))
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(initialPlayerId)

  useEffect(() => {
    async function fetchData() {
      try {
        const [rostersRes, usersRes, playersRes] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`),
          fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`),
          fetch('https://api.sleeper.app/v1/players/nfl'),
        ])

        const rostersData: SleeperRoster[] = await rostersRes.json()
        const usersData: LeagueUser[] = await usersRes.json()
        const playersData: Record<string, SleeperPlayer> = await playersRes.json()

        setRosters(rostersData)
        setUsers(usersData)
        setAllPlayers(playersData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [leagueId])

  const handleSelectPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId)
    setActiveTab('deep-dive')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2 border-b border-sleeper-accent pb-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-10 w-32" />
          ))}
        </div>
        <SkeletonPlayerList rows={12} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Player Analysis</h1>
        <p className="text-gray-400">
          {TABS.find(t => t.id === activeTab)?.description}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-sleeper-accent pb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-sleeper-highlight text-white'
                : 'bg-sleeper-primary text-gray-400 hover:text-white hover:bg-sleeper-accent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'all-players' && (
        <AllPlayersTab
          leagueId={leagueId}
          allPlayers={allPlayers}
          rosters={rosters}
          users={users}
          onSelectPlayer={handleSelectPlayer}
        />
      )}

      {activeTab === 'deep-dive' && (
        <DeepDiveTab
          leagueId={leagueId}
          allPlayers={allPlayers}
          rosters={rosters}
          users={users}
          initialPlayerId={selectedPlayerId}
        />
      )}

      {activeTab === 'compare' && (
        <CompareTab
          leagueId={leagueId}
          allPlayers={allPlayers}
          rosters={rosters}
          users={users}
        />
      )}

      {activeTab === 'age-curve' && (
        <AgeCurveTab
          allPlayers={allPlayers}
        />
      )}

      {activeTab === 'news' && (
        <NewsTab
          allPlayers={allPlayers}
          rosters={rosters}
          users={users}
        />
      )}
    </div>
  )
}

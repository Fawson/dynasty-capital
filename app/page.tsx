'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SleeperUser, SleeperLeague } from '@/lib/types'
import { getUser, getUserLeagues, getAvatarUrl, getCurrentSeason, SLEEPER_LOGO_URL } from '@/lib/sleeper'

export default function Home() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<SleeperUser | null>(null)
  const [leagues, setLeagues] = useState<SleeperLeague[]>([])
  const [season, setSeason] = useState<string>('')

  // Available seasons to choose from
  const currentSeason = getCurrentSeason()
  const availableSeasons = [
    currentSeason,
    (parseInt(currentSeason) - 1).toString(),
    (parseInt(currentSeason) - 2).toString(),
  ]

  useEffect(() => {
    setSeason(currentSeason)
  }, [currentSeason])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return

    setLoading(true)
    setError('')
    setUser(null)
    setLeagues([])

    try {
      const userData = await getUser(username.trim())
      if (!userData) {
        setError('User not found. Please check the username and try again.')
        setLoading(false)
        return
      }

      setUser(userData)
      const userLeagues = await getUserLeagues(userData.user_id, season)
      setLeagues(userLeagues)

      if (userLeagues.length === 0) {
        setError(`No NFL leagues found for this user in the ${season} season.`)
      }
    } catch {
      setError('Failed to fetch user data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const changeSeason = async (newSeason: string) => {
    setSeason(newSeason)
    if (user) {
      setLoading(true)
      setError('')
      try {
        const userLeagues = await getUserLeagues(user.user_id, newSeason)
        setLeagues(userLeagues)
        if (userLeagues.length === 0) {
          setError(`No NFL leagues found for this user in the ${newSeason} season.`)
        }
      } catch {
        setError('Failed to fetch leagues. Please try again.')
      } finally {
        setLoading(false)
      }
    }
  }

  const selectLeague = (leagueId: string) => {
    router.push(`/league/${leagueId}?userId=${user?.user_id}`)
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">
              <span className="font-serif">Dynasty</span>{' '}
              <span className="font-serif text-[#1B6B5A]">Capital</span>
            </h1>
          <p className="text-gray-400">
            Analyze your Sleeper fantasy football league with advanced stats and trade tools
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your Sleeper username"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-amber-500 text-gray-900 rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading...' : 'Find Leagues'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">Season:</span>
            <div className="flex gap-2">
              {availableSeasons.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeSeason(s)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    season === s
                      ? 'bg-amber-500 text-gray-900'
                      : 'bg-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </form>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {user && leagues.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-800 rounded-lg border-l-4 border-l-amber-500">
              <img
                src={getAvatarUrl(user.avatar)}
                alt={user.display_name}
                className="w-12 h-12 rounded-full bg-gray-700"
                onError={(e) => { e.currentTarget.src = SLEEPER_LOGO_URL }}
              />
              <div>
                <p className="font-semibold">{user.display_name}</p>
                <p className="text-gray-500 text-sm">@{user.username}</p>
              </div>
            </div>

            <h2 className="text-xl font-semibold mb-4">
              Select a League
              <span className="text-gray-500 text-base font-normal ml-2">
                ({season} Season)
              </span>
            </h2>
            <div className="space-y-3">
              {leagues.map((league) => (
                <button
                  key={league.league_id}
                  onClick={() => selectLeague(league.league_id)}
                  className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg text-left hover:border-amber-500 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={getAvatarUrl(league.avatar, 'league')}
                      alt={league.name}
                      className="w-10 h-10 rounded-lg bg-gray-700"
                      onError={(e) => { e.currentTarget.src = SLEEPER_LOGO_URL }}
                    />
                    <div className="flex-1">
                      <p className="font-semibold group-hover:text-amber-500 transition-colors">
                        {league.name}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {league.total_rosters} teams &bull; {league.season} Season
                      </p>
                    </div>
                    <span className="text-gray-500 group-hover:text-amber-500 transition-colors">
                      &rarr;
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Games Section */}
        <div className="mt-12 pt-8 border-t border-gray-700">
          <h3 className="text-gray-500 text-sm uppercase tracking-wider mb-4 text-center">Games</h3>
          <Link
            href="/snapshot"
            className="block p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-amber-500 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold group-hover:text-amber-500 transition-colors">
                  Snapshot
                </p>
                <p className="text-gray-500 text-sm">
                  Guess the player from their dynasty value chart
                </p>
              </div>
              <span className="text-gray-500 group-hover:text-amber-500 transition-colors">
                Play →
              </span>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect } from 'react'

interface NewsItem {
  id: string
  title: string
  description: string
  source: string
  date: string
  url?: string
}

interface PlayerNewsProps {
  playerId: string
  playerName: string
}

export default function PlayerNews({ playerId, playerName }: PlayerNewsProps) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchNews() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(
          `/api/player-news?playerId=${encodeURIComponent(playerId)}&playerName=${encodeURIComponent(playerName)}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch news')
        }

        const data = await response.json()
        setNews(data.news || [])
      } catch (err) {
        console.error('Error fetching player news:', err)
        setError('Unable to load news')
      } finally {
        setLoading(false)
      }
    }

    if (playerId && playerName) {
      fetchNews()
    }
  }, [playerId, playerName])

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Latest News
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-full mb-1"></div>
              <div className="h-3 bg-gray-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || news.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Latest News
        </h3>
        <div className="text-center py-6 text-gray-500">
          <svg
            className="w-10 h-10 mx-auto mb-3 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          <p className="text-sm">No recent news for this player</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Latest News
      </h3>
      <div className="space-y-4">
        {news.map((item) => (
          <article key={item.id} className="border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <h4 className="font-medium text-sm text-white group-hover:text-amber-500 transition-colors leading-snug mb-1">
                  {item.title}
                </h4>
              </a>
            ) : (
              <h4 className="font-medium text-sm text-white leading-snug mb-1">
                {item.title}
              </h4>
            )}
            <p className="text-xs text-gray-500 leading-relaxed mb-2">
              {item.description}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="text-amber-500/70">{item.source}</span>
              <span>•</span>
              <span>{item.date}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

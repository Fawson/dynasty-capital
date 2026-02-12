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

export default function NewsTab() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchNews() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/player-news')

        if (!response.ok) {
          throw new Error('Failed to fetch news')
        }

        const data = await response.json()
        setNews(data.news || [])
      } catch (err) {
        console.error('Error fetching news:', err)
        setError('Unable to load news')
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-gray-800 rounded-lg border border-gray-700 p-4 animate-pulse">
            <div className="h-5 bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-700 rounded w-2/3 mb-3"></div>
            <div className="h-3 bg-gray-700 rounded w-24"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (news.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <svg
          className="w-12 h-12 mx-auto mb-4 text-gray-600"
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
        <p className="text-gray-500">No recent news available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-200">
        More news sources coming soon.
      </div>

      <p className="text-gray-500 text-sm">Latest NFL news from the past 14 days</p>

      {news.map((item) => (
        <article
          key={item.id}
          className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors"
        >
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <h3 className="font-semibold text-white group-hover:text-amber-500 transition-colors mb-2">
                {item.title}
              </h3>
            </a>
          ) : (
            <h3 className="font-semibold text-white mb-2">{item.title}</h3>
          )}

          <p className="text-gray-400 text-sm mb-3 leading-relaxed">
            {item.description}
          </p>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-amber-500">{item.source}</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-500">{item.date}</span>
          </div>
        </article>
      ))}
    </div>
  )
}

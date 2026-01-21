import { NextResponse } from 'next/server'

interface NewsItem {
  id: string
  title: string
  description: string
  source: string
  date: string
  url?: string
}

// Simple in-memory cache
let newsCache: { [playerId: string]: { news: NewsItem[]; timestamp: number } } = {}
const CACHE_DURATION = 1000 * 60 * 15 // 15 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const playerId = searchParams.get('playerId')
  const playerName = searchParams.get('playerName')

  if (!playerId || !playerName) {
    return NextResponse.json({ error: 'Missing playerId or playerName' }, { status: 400 })
  }

  // Check cache
  const cached = newsCache[playerId]
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({ news: cached.news })
  }

  try {
    // Try to fetch from Rotowire RSS feed (free, publicly accessible)
    const news = await fetchPlayerNews(playerName)

    // Cache the results
    newsCache[playerId] = { news, timestamp: Date.now() }

    return NextResponse.json({ news })
  } catch (error) {
    console.error('Failed to fetch player news:', error)
    return NextResponse.json({ news: [] })
  }
}

async function fetchPlayerNews(playerName: string): Promise<NewsItem[]> {
  // Normalize the player name for searching
  const searchName = playerName.toLowerCase().replace(/[^a-z\s]/g, '')
  const nameParts = searchName.split(' ')

  try {
    // Fetch from ESPN's player news RSS (publicly accessible)
    const response = await fetch(
      `https://www.espn.com/espn/rss/nfl/news`,
      {
        next: { revalidate: 900 }, // Cache for 15 minutes
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FantasyApp/1.0)'
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch news')
    }

    const xmlText = await response.text()

    // Parse RSS XML manually (simple approach)
    const items: NewsItem[] = []
    const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || []

    for (const item of itemMatches.slice(0, 20)) { // Check first 20 items
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/)
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/)
      const linkMatch = item.match(/<link>(.*?)<\/link>/)
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/)

      const title = titleMatch?.[1] || ''
      const description = descMatch?.[1] || ''
      const content = (title + ' ' + description).toLowerCase()

      // Check if this news item mentions the player
      const mentionsPlayer = nameParts.length >= 2 &&
        nameParts.every(part => part.length > 2 && content.includes(part))

      if (mentionsPlayer) {
        items.push({
          id: `espn-${Date.now()}-${items.length}`,
          title: cleanHtml(title),
          description: cleanHtml(description).slice(0, 200) + '...',
          source: 'ESPN',
          date: dateMatch?.[1] ? formatDate(dateMatch[1]) : 'Recent',
          url: linkMatch?.[1]
        })
      }

      if (items.length >= 3) break // Limit to 3 items
    }

    return items
  } catch (error) {
    console.error('Error fetching news:', error)
    return []
  }
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Recent'
  }
}

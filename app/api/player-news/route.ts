import { NextResponse } from 'next/server'

interface NewsItem {
  id: string
  title: string
  description: string
  source: string
  date: string
  url?: string
  timestamp: number
}

// Simple in-memory cache
let newsCache: { news: NewsItem[]; timestamp: number } | null = null
const CACHE_DURATION = 1000 * 60 * 15 // 15 minutes

export async function GET() {
  // Check cache
  if (newsCache && Date.now() - newsCache.timestamp < CACHE_DURATION) {
    return NextResponse.json({ news: newsCache.news })
  }

  try {
    const news = await fetchNFLNews()

    // Cache the results
    newsCache = { news, timestamp: Date.now() }

    return NextResponse.json({ news })
  } catch (error) {
    console.error('Failed to fetch NFL news:', error)
    return NextResponse.json({ news: [] })
  }
}

async function fetchNFLNews(): Promise<NewsItem[]> {
  const items: NewsItem[] = []
  const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000)

  // Fetch from ESPN NFL news RSS
  try {
    const response = await fetch(
      `https://www.espn.com/espn/rss/nfl/news`,
      {
        next: { revalidate: 900 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FantasyApp/1.0)'
        }
      }
    )

    if (response.ok) {
      const xmlText = await response.text()
      const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || []

      for (const item of itemMatches) {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/)
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/)
        const linkMatch = item.match(/<link>(.*?)<\/link>/)
        const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/)

        const title = cleanHtml(titleMatch?.[1] || '')
        const description = cleanHtml(descMatch?.[1] || '')
        const url = linkMatch?.[1]
        const pubDate = dateMatch?.[1] ? new Date(dateMatch[1]) : new Date()
        const timestamp = pubDate.getTime()

        // Only include items from the last 14 days
        if (timestamp >= fourteenDaysAgo && title) {
          items.push({
            id: `espn-${timestamp}-${items.length}`,
            title,
            description: description.slice(0, 250) + (description.length > 250 ? '...' : ''),
            source: 'ESPN',
            date: formatDate(pubDate.toISOString()),
            url,
            timestamp
          })
        }
      }
    }
  } catch (error) {
    console.error('Error fetching ESPN news:', error)
  }

  // Fetch from NFL.com RSS as additional source
  try {
    const response = await fetch(
      `https://www.nfl.com/rss/rsslanding?cat=nfl`,
      {
        next: { revalidate: 900 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FantasyApp/1.0)'
        }
      }
    )

    if (response.ok) {
      const xmlText = await response.text()
      const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/g) || []

      for (const item of itemMatches) {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/)
        const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/)
        const linkMatch = item.match(/<link>(.*?)<\/link>/)
        const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/)

        const title = cleanHtml(titleMatch?.[1] || '')
        const description = cleanHtml(descMatch?.[1] || '')
        const url = linkMatch?.[1]
        const pubDate = dateMatch?.[1] ? new Date(dateMatch[1]) : new Date()
        const timestamp = pubDate.getTime()

        // Only include items from the last 14 days, and avoid duplicates by title
        if (timestamp >= fourteenDaysAgo && title && !items.some(i => i.title === title)) {
          items.push({
            id: `nfl-${timestamp}-${items.length}`,
            title,
            description: description.slice(0, 250) + (description.length > 250 ? '...' : ''),
            source: 'NFL.com',
            date: formatDate(pubDate.toISOString()),
            url,
            timestamp
          })
        }
      }
    }
  } catch (error) {
    console.error('Error fetching NFL.com news:', error)
  }

  // Sort by timestamp (newest first) and limit to 20
  return items
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
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

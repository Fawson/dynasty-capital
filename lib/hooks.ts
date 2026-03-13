'use client'

import useSWR from 'swr'

// Generic JSON fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return res.json()
})

// Fetch player news with SWR (auto-deduplication, caching, revalidation)
export function usePlayerNews() {
  const { data, error, isLoading } = useSWR('/api/player-news', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // Don't re-fetch within 1 minute
  })
  return {
    news: data?.news ?? [],
    isLoading,
    error,
  }
}

// Fetch historical values for a player
export function useHistoricalValues(playerName: string | null) {
  const { data, error, isLoading } = useSWR(
    playerName ? `/api/historical-values?player=${encodeURIComponent(playerName)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000, // 5 min dedup
    }
  )
  return {
    history: data?.history ?? [],
    matchedPlayer: data?.player ?? null,
    isLoading,
    error,
  }
}

// Fetch player team history by ESPN ID
export function usePlayerTeamHistory(espnId: string | null) {
  const { data, error, isLoading } = useSWR(
    espnId ? `/api/player-team-history?espnId=${espnId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000,
    }
  )
  return {
    teamHistory: data?.teamHistory ?? {},
    isLoading,
    error,
  }
}

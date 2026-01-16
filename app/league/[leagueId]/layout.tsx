import { getLeague } from '@/lib/sleeper'
import Navigation from '@/components/Navigation'
import { notFound } from 'next/navigation'

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ leagueId: string }>
}) {
  const { leagueId } = await params
  const league = await getLeague(leagueId)

  if (!league) {
    notFound()
  }

  return (
    <div className="min-h-screen">
      <Navigation leagueId={leagueId} leagueName={league.name} />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

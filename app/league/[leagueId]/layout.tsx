import { Suspense } from 'react'
import { getLeague } from '@/lib/sleeper'
import Navigation from '@/components/Navigation'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

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
      <Suspense fallback={<div className="hidden lg:block w-56 bg-gray-800 border-r border-gray-700 min-h-screen fixed left-0 top-0" />}>
        <Navigation leagueId={leagueId} leagueName={league.name} />
      </Suspense>
      {/* Main content - offset for sidebar on desktop, offset for header on mobile */}
      <main className="lg:ml-56 pt-14 lg:pt-0">
        <div className="px-6 lg:px-8 py-8">{children}</div>
        <footer className="px-6 lg:px-8 pb-8 pt-4 border-t border-gray-800">
          <div className="flex justify-center">
            <a
              href={`/league/${leagueId}/about`}
              className="text-gray-500 hover:text-amber-500 transition-colors text-sm"
            >
              About
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}

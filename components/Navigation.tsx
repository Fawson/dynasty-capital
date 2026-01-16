'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavigationProps {
  leagueId: string
  leagueName: string
}

export default function Navigation({ leagueId, leagueName }: NavigationProps) {
  const pathname = usePathname()
  const basePath = `/league/${leagueId}`

  const links = [
    { href: basePath, label: 'Overview' },
    { href: `${basePath}/standings`, label: 'Standings' },
    { href: `${basePath}/teams`, label: 'Teams' },
    { href: `${basePath}/players`, label: 'Players' },
    { href: `${basePath}/player-analysis`, label: 'Player Analysis' },
    { href: `${basePath}/value`, label: 'Value Analyzer' },
    { href: `${basePath}/trade`, label: 'Trade Analyzer' },
    { href: `${basePath}/matchups`, label: 'Matchups' },
  ]

  return (
    <nav className="bg-sleeper-primary border-b border-sleeper-accent">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-gray-400 hover:text-white transition-colors"
            >
              &larr;
            </Link>
            <span className="font-semibold text-lg">{leagueName}</span>
          </div>
          <div className="flex gap-1">
            {links.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sleeper-highlight text-white'
                      : 'text-gray-400 hover:text-white hover:bg-sleeper-accent'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}

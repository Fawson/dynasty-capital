'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavigationProps {
  leagueId: string
  leagueName: string
}

export default function Navigation({ leagueId, leagueName }: NavigationProps) {
  const pathname = usePathname()
  const basePath = `/league/${leagueId}`
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const links = [
    { href: basePath, label: 'Overview' },
    { href: `${basePath}/teams`, label: 'Teams' },
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
            <span className="font-semibold text-lg truncate max-w-[150px] sm:max-w-none">{leagueName}</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex gap-1">
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

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-sleeper-accent transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden pb-4">
            <div className="flex flex-col gap-1">
              {links.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
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
        )}
      </div>
    </nav>
  )
}

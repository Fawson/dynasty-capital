'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

interface NavigationProps {
  leagueId: string
  leagueName: string
}

interface NavSection {
  title: string
  icon: React.ReactNode
  items: { href: string; label: string }[]
}

export default function Navigation({ leagueId, leagueName }: NavigationProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId')
  const basePath = `/league/${leagueId}`
  const userQuery = userId ? `?userId=${userId}` : ''
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(['League', 'Trades', 'Analysis'])

  const navSections: NavSection[] = [
    {
      title: 'League',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      items: [
        { href: `${basePath}${userQuery}`, label: 'Overview' },
        { href: `${basePath}/teams${userQuery}`, label: 'Teams' },
        { href: `${basePath}/matchups${userQuery}`, label: 'Matchups' },
        { href: `${basePath}/draft${userQuery}`, label: 'Draft Board' },
      ],
    },
    {
      title: 'Trades',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      items: [
        { href: `${basePath}/trade${userQuery}`, label: 'Trade Analyzer' },
        { href: `${basePath}/trades${userQuery}`, label: 'Trade History' },
      ],
    },
    {
      title: 'Analysis',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      items: [
        { href: `${basePath}/player-analysis${userQuery}`, label: 'Player Deep Dive' },
        { href: `${basePath}/value${userQuery}`, label: 'Value Analyzer' },
        { href: `${basePath}/what-if${userQuery}`, label: 'What If' },
      ],
    },
    {
      title: 'Games',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      items: [
        { href: '/snapshot', label: 'Snapshot' },
      ],
    },
  ]

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(s => s !== title)
        : [...prev, title]
    )
  }

  const isLinkActive = (href: string) => {
    const linkPath = href.split('?')[0]
    return pathname === linkPath
  }

  // Check if any item in a section is active
  const isSectionActive = (section: NavSection) => {
    return section.items.some(item => isLinkActive(item.href))
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-gray-800 border-r border-gray-700 min-h-screen fixed left-0 top-0">
        {/* Logo/Header */}
        <div className="p-4 border-b border-gray-700">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-amber-500 transition-colors mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">All Leagues</span>
          </Link>
          <h2 className="font-semibold text-white truncate">{leagueName}</h2>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navSections.map((section) => {
            const isExpanded = expandedSections.includes(section.title)
            const hasActiveItem = isSectionActive(section)

            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    hasActiveItem
                      ? 'text-amber-500'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <span>{section.title}</span>
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {section.items.map((item) => {
                      const isActive = isLinkActive(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? 'bg-amber-500 text-gray-900 font-medium'
                              : 'text-gray-400 hover:text-white hover:bg-gray-700'
                          }`}
                        >
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-amber-500 transition-colors"
          >
            <span className="font-serif text-emerald-600 font-bold">DC</span>
            <span>Dynasty Capital</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-amber-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="font-semibold truncate max-w-[200px]">{leagueName}</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="bg-gray-800 border-t border-gray-700 max-h-[calc(100vh-56px)] overflow-y-auto">
            <nav className="p-3 space-y-1">
              {navSections.map((section) => (
                <div key={section.title}>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {section.title}
                  </div>
                  {section.items.map((item) => {
                    const isActive = isLinkActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-3 py-3 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-amber-500 text-gray-900 font-medium'
                            : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </nav>
          </div>
        )}
      </header>
    </>
  )
}

import PageHeader from '@/components/PageHeader'

interface Resource {
  name: string
  url: string
  description: string
  category: 'values' | 'news' | 'tools' | 'podcasts' | 'data'
  logo: string
  logoType: 'image' | 'text'
  logoBg?: string
  logoColor?: string
}

const resources: Resource[] = [
  // Values & Rankings
  {
    name: 'KeepTradeCut',
    url: 'https://keeptradecut.com',
    description: 'Crowdsourced dynasty player values and trade calculator',
    category: 'values',
    logo: '/logos/ktc.png',
    logoType: 'image',
  },
  {
    name: 'FantasyPros',
    url: 'https://www.fantasypros.com/nfl/rankings/dynasty-overall.php',
    description: 'Dynasty startup and rookie draft boards',
    category: 'values',
    logo: '/logos/fantasypros.png',
    logoType: 'image',
  },
  {
    name: 'Dynasty Process',
    url: 'https://dynastyprocess.com',
    description: 'Dynasty rankings, tools, and analytics',
    category: 'values',
    logo: '/logos/dynastyprocess.png',
    logoType: 'image',
  },
  // News
  {
    name: 'r/DynastyFF',
    url: 'https://www.reddit.com/r/DynastyFF',
    description: 'Dynasty fantasy football discussion and news',
    category: 'news',
    logo: '/logos/reddit.png',
    logoType: 'image',
  },
  {
    name: 'Rotoworld',
    url: 'https://www.rotoworld.com/football/nfl/player-news',
    description: 'Breaking NFL player news and updates',
    category: 'news',
    logo: '/logos/rotoworld.png',
    logoType: 'image',
  },
  {
    name: 'Fantasy Life',
    url: 'https://www.fantasylife.com',
    description: 'Real-time fantasy news and alerts',
    category: 'news',
    logo: '/logos/fantasylife.png',
    logoType: 'image',
  },
  // Tools
  {
    name: 'Sleeper',
    url: 'https://sleeper.com',
    description: 'Fantasy football platform with great mobile app',
    category: 'tools',
    logo: '/logos/sleeper.png',
    logoType: 'image',
  },
  {
    name: 'Dynasty Nerds',
    url: 'https://dynastynerds.com',
    description: 'Dynasty content, rankings, and tools',
    category: 'tools',
    logo: '/logos/dynastynerds.png',
    logoType: 'image',
  },
  // Data & Analytics
  {
    name: 'Player Profiler',
    url: 'https://www.playerprofiler.com',
    description: 'Advanced metrics and analytics for NFL players',
    category: 'data',
    logo: '/logos/playerprofiler.png',
    logoType: 'image',
  },
  {
    name: 'Fantasy Data',
    url: 'https://fantasydata.com',
    description: 'Comprehensive NFL stats and projections',
    category: 'data',
    logo: '/logos/fantasydata.png',
    logoType: 'image',
  },
]

const categoryLabels: Record<Resource['category'], string> = {
  values: 'Rankings & Values',
  news: 'News & Updates',
  tools: 'Tools & Platforms',
  podcasts: 'Podcasts',
  data: 'Data & Analytics',
}

const categoryColors: Record<Resource['category'], string> = {
  values: 'bg-emerald-600',
  news: 'bg-blue-600',
  tools: 'bg-purple-600',
  podcasts: 'bg-orange-600',
  data: 'bg-amber-600',
}

export default function ResourcesPage() {
  const groupedResources = resources.reduce((acc, resource) => {
    if (!acc[resource.category]) {
      acc[resource.category] = []
    }
    acc[resource.category].push(resource)
    return acc
  }, {} as Record<Resource['category'], Resource[]>)

  const categories = Object.keys(groupedResources) as Resource['category'][]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Other Resources"
        subtitle="Great fantasy football tools from around the web"
        icon="resources"
      />

      <p className="text-gray-400 text-sm">
        These are some of my favorite tools and resources for dynasty fantasy football.
        I&apos;m not affiliated with any of these sites.
      </p>

      {categories.map((category) => (
        <div key={category}>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${categoryColors[category]}`} />
            {categoryLabels[category]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupedResources[category].map((resource) => (
              <a
                key={resource.name}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-amber-500 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  {/* Logo */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-gray-900">
                    {resource.logoType === 'image' ? (
                      <img
                        src={resource.logo}
                        alt={resource.name}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <div className={`w-full h-full ${resource.logoBg || 'bg-gray-700'} flex items-center justify-center`}>
                        <span className="text-white font-bold text-xs">{resource.logo}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold group-hover:text-amber-500 transition-colors">
                        {resource.name}
                      </h3>
                      <svg
                        className="w-4 h-4 text-gray-500 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">{resource.description}</p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-4 border-t border-gray-800">
        <p className="text-gray-500 text-sm text-center">
          Know a great resource I should add?{' '}
          <a
            href="mailto:dynastycapital@gmail.com"
            className="text-amber-500 hover:text-amber-400"
          >
            Let me know!
          </a>
        </p>
      </div>
    </div>
  )
}

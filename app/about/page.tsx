'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/Dynasty_logo.png"
            alt="Dynasty Logo"
            width={140}
            height={140}
            className="rounded-xl"
          />
        </div>

        {/* Intro Section */}
        <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent p-6 mb-8">
          <h1 className="text-3xl font-bold mb-4">About</h1>
          <div className="text-gray-300 space-y-4">
            <p>
              [Your intro text goes here. Edit this section to add your introduction.]
            </p>
            <p>
              [Add more paragraphs as needed to describe your project, its goals, and what makes it unique.]
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Features</h2>
          <ul className="text-gray-300 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-sleeper-highlight">-</span>
              <span>Player Analysis with dynasty values and age curves</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sleeper-highlight">-</span>
              <span>Trade Analyzer with draft pick valuations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sleeper-highlight">-</span>
              <span>Team Value Rankings across your league</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sleeper-highlight">-</span>
              <span>&quot;What If&quot; schedule swap simulator</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-sleeper-highlight">-</span>
              <span>Weekly matchup tracking</span>
            </li>
          </ul>
        </div>

        {/* Socials Section */}
        <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Connect With Us</h2>
          <div className="flex gap-6 justify-center">
            {/* Discord */}
            <a
              href="https://discord.gg/placeholder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 bg-sleeper-accent rounded-lg hover:bg-sleeper-highlight/20 transition-colors group"
            >
              <div className="w-12 h-12 bg-[#5865F2] rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
              <span className="text-gray-300 group-hover:text-white transition-colors">Discord</span>
            </a>

            {/* Twitter/X */}
            <a
              href="https://twitter.com/placeholder"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 bg-sleeper-accent rounded-lg hover:bg-sleeper-highlight/20 transition-colors group"
            >
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <span className="text-gray-300 group-hover:text-white transition-colors">Twitter</span>
            </a>
          </div>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Link
            href="/"
            className="text-sleeper-highlight hover:underline"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface HistoryPoint {
  date: string
  value: number
}

interface PlayerOption {
  name: string
  position: string
  isCorrect: boolean
}

interface GameData {
  history: HistoryPoint[]
  options: PlayerOption[]
  correctPlayer: string
  position: string
}

type GameState = 'loading' | 'playing' | 'revealed' | 'error'

export default function SnapshotGame() {
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [gameState, setGameState] = useState<GameState>('loading')
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [totalPlayed, setTotalPlayed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const fetchNewGame = useCallback(async () => {
    setGameState('loading')
    setSelectedAnswer(null)
    setError(null)

    try {
      const response = await fetch('/api/snapshot-game')
      if (!response.ok) {
        throw new Error('Failed to fetch game data')
      }
      const data = await response.json()
      setGameData(data)
      setGameState('playing')
    } catch (err) {
      setError('Failed to load game. Please try again.')
      setGameState('error')
    }
  }, [])

  useEffect(() => {
    fetchNewGame()
  }, [fetchNewGame])

  const handleAnswer = (playerName: string) => {
    if (gameState !== 'playing' || !gameData) return

    setSelectedAnswer(playerName)
    setGameState('revealed')
    setTotalPlayed(prev => prev + 1)

    const isCorrect = gameData.options.find(o => o.name === playerName)?.isCorrect

    if (isCorrect) {
      setScore(prev => prev + 1)
      setStreak(prev => {
        const newStreak = prev + 1
        setBestStreak(best => Math.max(best, newStreak))
        return newStreak
      })
    } else {
      setStreak(0)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  // Prepare chart data
  const chartData = gameData?.history.map(h => ({
    date: formatDate(h.date),
    value: h.value,
    fullDate: h.date,
  })) || []

  const maxValue = Math.max(...(gameData?.history.map(h => h.value) || [10000]))
  const minValue = Math.min(...(gameData?.history.map(h => h.value) || [0]))

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Snapshot</h1>
            <p className="text-gray-500">Guess the player from their dynasty value chart</p>
          </div>
          <Link
            href="/"
            className="text-gray-400 hover:text-amber-500 transition-colors"
          >
            &larr; Back Home
          </Link>
        </div>

        {/* Score Bar */}
        <div className="bg-gray-800 rounded-lg border-l-4 border-l-amber-500 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-6">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider">Score</p>
                <p className="text-2xl font-bold text-amber-500">{score}/{totalPlayed}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider">Streak</p>
                <p className="text-2xl font-bold text-emerald-500">{streak}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider">Best</p>
                <p className="text-2xl font-bold text-amber-400">{bestStreak}</p>
              </div>
            </div>
            {totalPlayed > 0 && (
              <div className="text-right">
                <p className="text-gray-500 text-xs uppercase tracking-wider">Accuracy</p>
                <p className="text-2xl font-bold text-white">
                  {Math.round((score / totalPlayed) * 100)}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Game Area */}
        {gameState === 'loading' && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <div className="animate-pulse">
              <div className="h-64 bg-gray-700 rounded mb-4"></div>
              <p className="text-gray-500">Loading next player...</p>
            </div>
          </div>
        )}

        {gameState === 'error' && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchNewGame}
              className="px-6 py-3 bg-amber-500 text-gray-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {(gameState === 'playing' || gameState === 'revealed') && gameData && (
          <div className="space-y-6">
            {/* Chart */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {gameState === 'revealed' ? (
                    <span>
                      <span className="text-amber-500">{gameData.correctPlayer}</span>
                      <span className="text-gray-500 ml-2 text-sm">({gameData.position})</span>
                    </span>
                  ) : (
                    <span className="text-gray-500">??? Mystery Player ???</span>
                  )}
                </h2>
                {gameState === 'revealed' && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedAnswer === gameData.correctPlayer
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-red-900/50 text-red-400'
                  }`}>
                    {selectedAnswer === gameData.correctPlayer ? 'Correct!' : 'Wrong!'}
                  </span>
                )}
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      tickLine={{ stroke: '#374151' }}
                      axisLine={{ stroke: '#374151' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[Math.max(0, minValue - 500), maxValue + 500]}
                      tick={{ fill: '#9ca3af', fontSize: 11 }}
                      tickLine={{ stroke: '#374151' }}
                      axisLine={{ stroke: '#374151' }}
                      tickFormatter={(v) => v.toLocaleString()}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#9ca3af' }}
                      formatter={(value: number) => [value.toLocaleString(), 'Value']}
                    />
                    <ReferenceLine y={5000} stroke="#374151" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#F59E0B"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: '#F59E0B' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{chartData[0]?.fullDate}</span>
                <span>{chartData[chartData.length - 1]?.fullDate}</span>
              </div>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-2 gap-4">
              {gameData.options.map((option) => {
                let buttonStyle = 'bg-gray-800 border-gray-700 hover:border-amber-500'

                if (gameState === 'revealed') {
                  if (option.isCorrect) {
                    buttonStyle = 'bg-emerald-900/30 border-emerald-500'
                  } else if (selectedAnswer === option.name) {
                    buttonStyle = 'bg-red-900/30 border-red-500'
                  } else {
                    buttonStyle = 'bg-gray-800 border-gray-700 opacity-50'
                  }
                }

                return (
                  <button
                    key={option.name}
                    onClick={() => handleAnswer(option.name)}
                    disabled={gameState !== 'playing'}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${buttonStyle} ${
                      gameState === 'playing' ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <p className="font-semibold text-white">{option.name}</p>
                    <p className="text-gray-500 text-sm">{option.position}</p>
                  </button>
                )
              })}
            </div>

            {/* Next Button */}
            {gameState === 'revealed' && (
              <div className="text-center">
                <button
                  onClick={fetchNewGame}
                  className="px-8 py-3 bg-amber-500 text-gray-900 rounded-lg font-semibold hover:bg-amber-400 transition-colors"
                >
                  Next Player →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Look at the dynasty value chart and guess which player it belongs to.</p>
          <p>Build your streak by getting consecutive correct answers!</p>
        </div>
      </div>
    </main>
  )
}

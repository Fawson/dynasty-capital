'use client'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-sleeper-accent rounded ${className}`}
      style={style}
    />
  )
}

export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} />
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-sleeper-primary rounded-lg border border-sleeper-accent p-4 ${className}`}>
      <Skeleton className="h-6 w-1/3 mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
      <div className="border-b border-sleeper-accent p-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-sleeper-accent">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-3 flex gap-4">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonPlayerRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="h-6 w-10" />
      <Skeleton className="h-4 flex-1 max-w-[200px]" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

export function SkeletonPlayerList({ rows = 10 }: { rows?: number }) {
  return (
    <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent divide-y divide-sleeper-accent">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonPlayerRow key={i} />
      ))}
    </div>
  )
}

export function SkeletonChart({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-sleeper-primary rounded-lg border border-sleeper-accent p-4 ${className}`}>
      <Skeleton className="h-6 w-1/4 mb-4" />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function SkeletonMatchup() {
  return (
    <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-6 w-8 mx-4" />
        <div className="flex-1 text-right">
          <Skeleton className="h-5 w-32 mb-2 ml-auto" />
          <Skeleton className="h-8 w-16 ml-auto" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonTradeTeam() {
  return (
    <div className="bg-sleeper-primary rounded-lg border border-sleeper-accent overflow-hidden">
      <div className="p-4 border-b border-sleeper-accent">
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="flex border-b border-sleeper-accent">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
      <div className="divide-y divide-sleeper-accent">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3 flex items-center gap-3">
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

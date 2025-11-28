'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  FileText,
  Users,
  FolderKanban,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'

interface Stats {
  proposals: { count: number; trend: number }
  contacts: { count: number; trend: number }
  projects: { count: number; trend: number }
  tasks: { completed: number; total: number }
}

interface QuickStatsProps {
  workspaceId: string
}

export function QuickStats({ workspaceId }: QuickStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch(`/api/dashboard/stats?workspaceId=${workspaceId}`)
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [workspaceId])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-zinc-900 border-zinc-800 animate-pulse">
            <CardContent className="p-4">
              <div className="h-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const statCards = [
    {
      label: 'Active Proposals',
      value: stats?.proposals.count || 0,
      trend: stats?.proposals.trend || 0,
      icon: FileText,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Contacts',
      value: stats?.contacts.count || 0,
      trend: stats?.contacts.trend || 0,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Active Projects',
      value: stats?.projects.count || 0,
      trend: stats?.projects.trend || 0,
      icon: FolderKanban,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Tasks Done',
      value: `${stats?.tasks.completed || 0}/${stats?.tasks.total || 0}`,
      progress: stats?.tasks.total ? Math.round((stats.tasks.completed / stats.tasks.total) * 100) : 0,
      icon: CheckSquare,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.label} className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              {'trend' in stat && stat.trend !== undefined && (
                <div className={`flex items-center text-xs ${
                  stat.trend > 0 ? 'text-green-400' :
                  stat.trend < 0 ? 'text-red-400' :
                  'text-zinc-400'
                }`}>
                  {stat.trend > 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : stat.trend < 0 ? (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  ) : (
                    <Minus className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(stat.trend)}%
                </div>
              )}
              {'progress' in stat && (
                <span className={`text-xs ${stat.color}`}>{stat.progress}%</span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-zinc-100">{stat.value}</p>
              <p className="text-xs text-zinc-500">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

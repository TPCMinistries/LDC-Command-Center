'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Activity,
  FileText,
  Users,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Upload,
  Edit,
  Plus,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ActivityItem {
  id: string
  type: 'proposal' | 'contact' | 'project' | 'task' | 'note' | 'rfp'
  action: 'created' | 'updated' | 'completed' | 'uploaded'
  title: string
  timestamp: string
  metadata?: Record<string, string>
}

interface RecentActivityProps {
  workspaceId: string
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  proposal: FileText,
  contact: Users,
  project: FolderKanban,
  task: CheckSquare,
  note: MessageSquare,
  rfp: Upload,
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  created: Plus,
  updated: Edit,
  completed: CheckSquare,
  uploaded: Upload,
}

const TYPE_COLORS: Record<string, string> = {
  proposal: 'text-amber-400 bg-amber-500/10',
  contact: 'text-blue-400 bg-blue-500/10',
  project: 'text-purple-400 bg-purple-500/10',
  task: 'text-green-400 bg-green-500/10',
  note: 'text-rose-400 bg-rose-500/10',
  rfp: 'text-cyan-400 bg-cyan-500/10',
}

export function RecentActivity({ workspaceId }: RecentActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`/api/dashboard/activity?workspaceId=${workspaceId}`)
        if (res.ok) {
          const data = await res.json()
          setActivities(data.activities || [])
        }
      } catch (error) {
        console.error('Failed to fetch activity:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()
  }, [workspaceId])

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Activity className="h-5 w-5 text-cyan-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-zinc-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Activity className="h-5 w-5 text-cyan-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px] pr-2">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => {
                const TypeIcon = ACTIVITY_ICONS[activity.type] || FileText
                const ActionIcon = ACTION_ICONS[activity.action] || Edit
                const colorClass = TYPE_COLORS[activity.type] || 'text-zinc-400 bg-zinc-500/10'

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${colorClass.split(' ')[1]}`}>
                      <TypeIcon className={`h-4 w-4 ${colorClass.split(' ')[0]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <ActionIcon className="h-3 w-3 text-zinc-500" />
                        <span className="text-xs text-zinc-500 capitalize">{activity.action}</span>
                      </div>
                      <p className="text-sm text-zinc-200 truncate">{activity.title}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

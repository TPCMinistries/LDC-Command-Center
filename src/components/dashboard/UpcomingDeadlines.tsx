'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar, Clock, AlertTriangle, ChevronRight, Building2, Loader2 } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'

interface Deadline {
  id: string
  title: string
  agency?: string
  deadline: string
  status: string
  daysUntil: number
}

interface UpcomingDeadlinesProps {
  workspaceId: string
}

export function UpcomingDeadlines({ workspaceId }: UpcomingDeadlinesProps) {
  const router = useRouter()
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDeadlines()
  }, [workspaceId])

  const fetchDeadlines = async () => {
    try {
      const res = await fetch(`/api/notifications?workspaceId=${workspaceId}`)
      const data = await res.json()

      if (data.notifications) {
        // Filter and map deadline notifications
        const deadlineItems = data.notifications
          .filter((n: { type: string }) => n.type === 'deadline')
          .map((n: { id: string; message: string; metadata?: { rfpId?: string; agency?: string; deadline?: string; daysUntil?: number } }) => ({
            id: n.metadata?.rfpId || n.id,
            title: n.message,
            agency: n.metadata?.agency as string | undefined,
            deadline: n.metadata?.deadline as string || '',
            status: 'active',
            daysUntil: n.metadata?.daysUntil as number || 0,
          }))

        setDeadlines(deadlineItems)
      }
    } catch (error) {
      console.error('Failed to fetch deadlines:', error)
    }
    setIsLoading(false)
  }

  const getUrgencyStyle = (daysUntil: number) => {
    if (daysUntil <= 1) return 'bg-red-500/20 text-red-400 border-red-500/50'
    if (daysUntil <= 3) return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
    if (daysUntil <= 7) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
    return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50'
  }

  const getTimeText = (daysUntil: number) => {
    if (daysUntil === 0) return 'Today'
    if (daysUntil === 1) return 'Tomorrow'
    return `${daysUntil} days`
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-500" />
            Upcoming Deadlines
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/workspace/${workspaceId}/rfp-radar`)}
            className="text-xs text-zinc-400 hover:text-zinc-100"
          >
            View all
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
          </div>
        ) : deadlines.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No upcoming deadlines</p>
            <p className="text-zinc-500 text-xs mt-1">
              Start tracking RFPs to see deadlines here
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-2">
            <div className="space-y-2">
              {deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  onClick={() => router.push(`/workspace/${workspaceId}/rfp-radar`)}
                  className="p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer transition-colors border border-transparent hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Urgency badge */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge className={`${getUrgencyStyle(deadline.daysUntil)} text-xs`}>
                          {deadline.daysUntil <= 1 && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {getTimeText(deadline.daysUntil)}
                        </Badge>
                        {deadline.deadline && (
                          <span className="text-xs text-zinc-500">
                            {format(parseISO(deadline.deadline), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-sm text-zinc-200 font-medium line-clamp-2">
                        {deadline.title}
                      </h4>

                      {/* Agency */}
                      {deadline.agency && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{deadline.agency}</span>
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 text-zinc-600 flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Summary footer */}
        {deadlines.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">{deadlines.length} deadline{deadlines.length !== 1 ? 's' : ''} in next 14 days</span>
              <div className="flex items-center gap-2">
                {deadlines.filter(d => d.daysUntil <= 3).length > 0 && (
                  <span className="text-orange-400">
                    {deadlines.filter(d => d.daysUntil <= 3).length} urgent
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

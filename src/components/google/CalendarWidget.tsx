'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Users, Video, ExternalLink, RefreshCw, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format, isToday, isTomorrow, parseISO, differenceInMinutes } from 'date-fns'

interface CalendarEvent {
  id: string
  title: string
  description?: string
  location?: string
  start: string
  end: string
  allDay: boolean
  attendees?: Array<{
    email: string
    name?: string
    responseStatus: string
  }>
  hangoutLink?: string
  htmlLink?: string
  status: string
}

interface CalendarWidgetProps {
  workspaceId: string
  compact?: boolean
}

export function CalendarWidget({ workspaceId, compact = false }: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [workspaceId])

  const fetchEvents = async () => {
    try {
      const timeMin = new Date().toISOString()
      const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const response = await fetch(
        `/api/google/calendar?workspaceId=${workspaceId}&timeMin=${timeMin}&timeMax=${timeMax}&maxResults=10`
      )
      const data = await response.json()

      if (data.connected === false) {
        setConnected(false)
      } else if (data.events) {
        setConnected(true)
        setEvents(data.events)
      }
    } catch (error) {
      console.error('Failed to fetch calendar:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchEvents()
  }

  const formatEventTime = (event: CalendarEvent) => {
    const start = parseISO(event.start)

    if (event.allDay) {
      if (isToday(start)) return 'Today (All day)'
      if (isTomorrow(start)) return 'Tomorrow (All day)'
      return format(start, 'MMM d') + ' (All day)'
    }

    const end = parseISO(event.end)
    const duration = differenceInMinutes(end, start)
    const timeStr = format(start, 'h:mm a')

    if (isToday(start)) {
      return `Today, ${timeStr} (${duration}m)`
    }
    if (isTomorrow(start)) {
      return `Tomorrow, ${timeStr} (${duration}m)`
    }
    return `${format(start, 'MMM d')}, ${timeStr}`
  }

  const getEventStatus = (event: CalendarEvent) => {
    const start = parseISO(event.start)
    const end = parseISO(event.end)
    const now = new Date()

    if (now >= start && now <= end) {
      return { label: 'Now', color: 'bg-green-500' }
    }

    const minutesUntil = differenceInMinutes(start, now)
    if (minutesUntil > 0 && minutesUntil <= 30) {
      return { label: 'Soon', color: 'bg-amber-500' }
    }

    return null
  }

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    )
  }

  if (!connected) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-zinc-400 mb-3">
              Connect Google to see your calendar
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `/workspace/${workspaceId}/settings`}
              className="border-zinc-700"
            >
              Connect Google
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Calendar
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-zinc-400">No upcoming events</p>
          </div>
        ) : (
          <ScrollArea className={compact ? 'h-[200px]' : 'h-[300px]'}>
            <div className="space-y-2">
              {events.map((event) => {
                const status = getEventStatus(event)

                return (
                  <div
                    key={event.id}
                    className="p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">
                            {event.title}
                          </p>
                          {status && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${status.color} text-white`}>
                              {status.label}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-400">
                          <Clock className="w-3 h-3" />
                          {formatEventTime(event)}
                        </div>

                        {event.location && !compact && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}

                        {event.attendees && event.attendees.length > 0 && !compact && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500">
                            <Users className="w-3 h-3" />
                            {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {event.hangoutLink && (
                          <a
                            href={event.hangoutLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
                            title="Join video call"
                          >
                            <Video className="w-4 h-4 text-green-400" />
                          </a>
                        )}
                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
                            title="Open in Google Calendar"
                          >
                            <ExternalLink className="w-4 h-4 text-zinc-400" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

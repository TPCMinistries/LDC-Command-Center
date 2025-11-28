'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText,
  Target,
  CheckSquare,
  Loader2,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns'

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'rfp_deadline' | 'proposal_deadline' | 'task' | 'meeting'
  status?: string
  color: string
  link?: string
  metadata?: Record<string, unknown>
}

interface CalendarViewProps {
  workspaceId: string
}

const EVENT_ICONS = {
  rfp_deadline: Target,
  proposal_deadline: FileText,
  task: CheckSquare,
  meeting: Calendar,
}

const EVENT_LABELS = {
  rfp_deadline: 'RFP Deadline',
  proposal_deadline: 'Proposal Due',
  task: 'Task',
  meeting: 'Meeting',
}

export function CalendarView({ workspaceId }: CalendarViewProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsByDate, setEventsByDate] = useState<Record<string, CalendarEvent[]>>({})
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch events for current month
  useEffect(() => {
    fetchEvents()
  }, [currentDate, workspaceId])

  const fetchEvents = async () => {
    setIsLoading(true)
    try {
      const month = currentDate.getMonth() + 1
      const year = currentDate.getFullYear()
      const res = await fetch(
        `/api/calendar?workspaceId=${workspaceId}&month=${month}&year=${year}`
      )
      const data = await res.json()

      if (data.events) {
        setEvents(data.events)
        setEventsByDate(data.eventsByDate || {})
      }
    } catch (error) {
      console.error('Failed to fetch calendar events:', error)
    }
    setIsLoading(false)
  }

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const days: Date[] = []
  let day = calendarStart
  while (day <= calendarEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateKey = format(date, 'yyyy-MM-dd')
    return eventsByDate[dateKey] || []
  }

  // Get selected date events
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : []

  const handleEventClick = (event: CalendarEvent) => {
    if (event.link) {
      router.push(event.link)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid */}
      <div className="lg:col-span-2">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-500" />
                {format(currentDate, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="border-zinc-700 text-zinc-300"
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={prevMonth}
                  className="text-zinc-400 hover:text-zinc-100"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextMonth}
                  className="text-zinc-400 hover:text-zinc-100"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-zinc-500 py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((date, idx) => {
                    const dayEvents = getEventsForDate(date)
                    const isCurrentMonth = isSameMonth(date, currentDate)
                    const isSelected = selectedDate && isSameDay(date, selectedDate)
                    const isTodayDate = isToday(date)

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDate(date)}
                        className={`
                          min-h-24 p-1 rounded-lg cursor-pointer transition-colors border
                          ${isCurrentMonth ? 'bg-zinc-800/50' : 'bg-zinc-900/50'}
                          ${isSelected ? 'border-amber-500' : 'border-transparent'}
                          ${isCurrentMonth ? 'hover:bg-zinc-800' : 'hover:bg-zinc-900'}
                        `}
                      >
                        <div
                          className={`
                            text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full
                            ${isTodayDate ? 'bg-amber-500 text-white' : ''}
                            ${!isTodayDate && isCurrentMonth ? 'text-zinc-200' : 'text-zinc-600'}
                          `}
                        >
                          {format(date, 'd')}
                        </div>

                        {/* Event dots/preview */}
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className="text-xs truncate px-1 py-0.5 rounded"
                              style={{ backgroundColor: `${event.color}30`, color: event.color }}
                            >
                              {event.title.slice(0, 15)}
                              {event.title.length > 15 ? '...' : ''}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-zinc-500 px-1">
                              +{dayEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-zinc-400">RFP Deadline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-zinc-400">Proposal Due</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span className="text-zinc-400">Task</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-zinc-400">Won/Approved</span>
          </div>
        </div>
      </div>

      {/* Selected Date Details */}
      <div className="lg:col-span-1">
        <Card className="bg-zinc-900 border-zinc-800 sticky top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-zinc-100 text-base">
              {selectedDate
                ? format(selectedDate, 'EEEE, MMMM d')
                : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDate ? (
              selectedDateEvents.length > 0 ? (
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-3">
                    {selectedDateEvents.map((event) => {
                      const Icon = EVENT_ICONS[event.type]
                      return (
                        <div
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className="p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700/80 cursor-pointer transition-colors"
                          style={{ borderLeft: `3px solid ${event.color}` }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="p-2 rounded-lg"
                              style={{ backgroundColor: `${event.color}20` }}
                            >
                              <Icon className="h-4 w-4" style={{ color: event.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Badge
                                variant="secondary"
                                className="text-xs mb-1"
                                style={{
                                  backgroundColor: `${event.color}20`,
                                  color: event.color,
                                }}
                              >
                                {EVENT_LABELS[event.type]}
                              </Badge>
                              <h4 className="text-sm font-medium text-zinc-200 line-clamp-2">
                                {event.title}
                              </h4>
                              {event.metadata?.agency && (
                                <p className="text-xs text-zinc-500 mt-1">
                                  {String(event.metadata.agency)}
                                </p>
                              )}
                              {event.metadata?.funder && (
                                <p className="text-xs text-zinc-500 mt-1">
                                  {String(event.metadata.funder)}
                                </p>
                              )}
                              {event.status && (
                                <p className="text-xs text-zinc-500 mt-1 capitalize">
                                  Status: {event.status.replace('_', ' ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 text-sm">No events on this day</p>
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">
                  Click on a date to see events
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming events summary */}
        <Card className="bg-zinc-900 border-zinc-800 mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-zinc-100 text-base">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">RFP Deadlines</span>
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                  {events.filter((e) => e.type === 'rfp_deadline').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Proposal Deadlines</span>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                  {events.filter((e) => e.type === 'proposal_deadline').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Tasks Due</span>
                <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-400">
                  {events.filter((e) => e.type === 'task').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-zinc-300 font-medium">Total Events</span>
                <span className="text-zinc-200 font-medium">{events.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

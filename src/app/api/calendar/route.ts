import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, parseISO, format } from 'date-fns'

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

// GET - Fetch calendar events for a month
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const month = searchParams.get('month') // Format: YYYY-MM
    const year = searchParams.get('year')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Calculate date range
    const targetDate = month && year
      ? new Date(parseInt(year), parseInt(month) - 1, 1)
      : new Date()

    const monthStart = format(startOfMonth(targetDate), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(targetDate), 'yyyy-MM-dd')

    const events: CalendarEvent[] = []

    // Fetch RFP deadlines
    const { data: rfps } = await supabase
      .from('rfps')
      .select('id, title, response_deadline, status, agency')
      .eq('workspace_id', workspaceId)
      .not('response_deadline', 'is', null)
      .gte('response_deadline', monthStart)
      .lte('response_deadline', monthEnd)
      .order('response_deadline', { ascending: true })

    if (rfps) {
      for (const rfp of rfps) {
        if (rfp.response_deadline) {
          let color = '#f59e0b' // amber for active
          if (rfp.status === 'submitted') color = '#8b5cf6' // purple
          else if (rfp.status === 'won') color = '#22c55e' // green
          else if (rfp.status === 'lost' || rfp.status === 'archived') color = '#6b7280' // gray

          events.push({
            id: `rfp-${rfp.id}`,
            title: rfp.title || 'Untitled RFP',
            date: rfp.response_deadline,
            type: 'rfp_deadline',
            status: rfp.status,
            color,
            link: `/workspace/${workspaceId}/rfp-radar`,
            metadata: {
              rfpId: rfp.id,
              agency: rfp.agency,
            },
          })
        }
      }
    }

    // Fetch proposal deadlines
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, title, submission_deadline, status, funder_name')
      .eq('workspace_id', workspaceId)
      .not('submission_deadline', 'is', null)
      .gte('submission_deadline', monthStart)
      .lte('submission_deadline', monthEnd)
      .order('submission_deadline', { ascending: true })

    if (proposals) {
      for (const proposal of proposals) {
        if (proposal.submission_deadline) {
          let color = '#3b82f6' // blue for proposals
          if (proposal.status === 'submitted') color = '#8b5cf6'
          else if (proposal.status === 'approved') color = '#22c55e'
          else if (proposal.status === 'rejected') color = '#ef4444'

          events.push({
            id: `proposal-${proposal.id}`,
            title: proposal.title || 'Untitled Proposal',
            date: proposal.submission_deadline,
            type: 'proposal_deadline',
            status: proposal.status,
            color,
            link: `/workspace/${workspaceId}/proposals`,
            metadata: {
              proposalId: proposal.id,
              funder: proposal.funder_name,
            },
          })
        }
      }
    }

    // Fetch tasks with due dates
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, status, priority')
      .eq('workspace_id', workspaceId)
      .not('due_date', 'is', null)
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd)
      .in('status', ['todo', 'in_progress'])
      .order('due_date', { ascending: true })

    if (tasks) {
      for (const task of tasks) {
        if (task.due_date) {
          let color = '#6366f1' // indigo for tasks
          if (task.priority === 'high') color = '#ef4444'
          else if (task.priority === 'low') color = '#6b7280'

          events.push({
            id: `task-${task.id}`,
            title: task.title || 'Untitled Task',
            date: task.due_date,
            type: 'task',
            status: task.status,
            color,
            metadata: {
              taskId: task.id,
              priority: task.priority,
            },
          })
        }
      }
    }

    // Sort all events by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Group events by date for easy rendering
    const eventsByDate: Record<string, CalendarEvent[]> = {}
    for (const event of events) {
      const dateKey = event.date.split('T')[0]
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = []
      }
      eventsByDate[dateKey].push(event)
    }

    return NextResponse.json({
      events,
      eventsByDate,
      month: format(targetDate, 'MMMM yyyy'),
      monthStart,
      monthEnd,
    })
  } catch (error) {
    console.error('Calendar error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    )
  }
}

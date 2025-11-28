import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addDays, isWithinInterval, parseISO, differenceInDays } from 'date-fns'

interface Notification {
  id: string
  type: 'deadline' | 'status_change' | 'reminder' | 'system'
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, unknown>
}

// GET - Fetch notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

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

    const notifications: Notification[] = []
    const now = new Date()

    // Fetch RFPs with upcoming deadlines
    const { data: rfps } = await supabase
      .from('rfps')
      .select('id, title, response_deadline, status, agency')
      .eq('workspace_id', workspaceId)
      .in('status', ['new', 'reviewing', 'pursuing'])
      .not('response_deadline', 'is', null)
      .order('response_deadline', { ascending: true })

    if (rfps) {
      for (const rfp of rfps) {
        if (!rfp.response_deadline) continue

        const deadline = parseISO(rfp.response_deadline)
        const daysUntil = differenceInDays(deadline, now)

        // Skip past deadlines
        if (daysUntil < 0) continue

        // Generate notifications based on urgency
        let urgency: Notification['urgency'] = 'low'
        let shouldNotify = false

        if (daysUntil <= 1) {
          urgency = 'critical'
          shouldNotify = true
        } else if (daysUntil <= 3) {
          urgency = 'high'
          shouldNotify = true
        } else if (daysUntil <= 7) {
          urgency = 'medium'
          shouldNotify = true
        } else if (daysUntil <= 14) {
          urgency = 'low'
          shouldNotify = true
        }

        if (shouldNotify) {
          const daysText = daysUntil === 0 ? 'Today' :
            daysUntil === 1 ? 'Tomorrow' :
            `${daysUntil} days`

          notifications.push({
            id: `deadline-${rfp.id}`,
            type: 'deadline',
            title: `Deadline ${daysText}`,
            message: rfp.title?.slice(0, 100) || 'Untitled RFP',
            link: `/workspace/${workspaceId}/rfp-radar`,
            read: false, // In a full implementation, track read status in DB
            createdAt: now.toISOString(),
            urgency,
            metadata: {
              rfpId: rfp.id,
              deadline: rfp.response_deadline,
              agency: rfp.agency,
              daysUntil,
            },
          })
        }
      }
    }

    // Fetch proposals with pending items (optional enhancement)
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, title, status, rfp_id, created_at')
      .eq('workspace_id', workspaceId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(5)

    if (proposals) {
      for (const proposal of proposals) {
        const createdDate = parseISO(proposal.created_at)
        const daysSinceCreated = differenceInDays(now, createdDate)

        // Remind about stale drafts (older than 3 days)
        if (daysSinceCreated >= 3) {
          notifications.push({
            id: `draft-${proposal.id}`,
            type: 'reminder',
            title: 'Draft Proposal',
            message: `"${proposal.title?.slice(0, 80) || 'Untitled'}" has been in draft for ${daysSinceCreated} days`,
            link: `/workspace/${workspaceId}/proposals`,
            read: false,
            createdAt: now.toISOString(),
            urgency: daysSinceCreated >= 7 ? 'medium' : 'low',
            metadata: {
              proposalId: proposal.id,
              daysSinceCreated,
            },
          })
        }
      }
    }

    // Sort by urgency (critical first) then by date
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    notifications.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
      if (urgencyDiff !== 0) return urgencyDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Count unread by urgency
    const summary = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      critical: notifications.filter(n => n.urgency === 'critical').length,
      high: notifications.filter(n => n.urgency === 'high').length,
    }

    return NextResponse.json({
      notifications: notifications.slice(0, 20), // Limit to 20
      summary,
    })
  } catch (error) {
    console.error('Notifications error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// POST - Mark notifications as read
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationIds, workspaceId } = body

    if (!workspaceId || !notificationIds) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // In a full implementation, we would update a notifications table
    // For now, we return success since notifications are generated dynamically

    return NextResponse.json({
      success: true,
      markedRead: notificationIds.length,
    })
  } catch (error) {
    console.error('Mark notifications error:', error)
    return NextResponse.json({ error: 'Failed to mark notifications' }, { status: 500 })
  }
}

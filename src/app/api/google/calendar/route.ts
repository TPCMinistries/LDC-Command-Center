import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendarClient } from '@/lib/google/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const timeMin = searchParams.get('timeMin') || new Date().toISOString()
    const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const maxResults = parseInt(searchParams.get('maxResults') || '50')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Calendar client
    const calendar = await getCalendarClient(user.id, workspaceId)

    if (!calendar) {
      return NextResponse.json({ error: 'Google not connected', connected: false }, { status: 400 })
    }

    // Fetch events from primary calendar
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items?.map((event) => ({
      id: event.id,
      title: event.summary || 'No title',
      description: event.description,
      location: event.location,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      allDay: !event.start?.dateTime,
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus,
      })),
      hangoutLink: event.hangoutLink,
      htmlLink: event.htmlLink,
      status: event.status,
      organizer: event.organizer,
    })) || []

    return NextResponse.json({ events, connected: true })
  } catch (error) {
    console.error('Calendar fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, summary, description, location, start, end, attendees } = body

    if (!workspaceId || !summary || !start || !end) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const calendar = await getCalendarClient(user.id, workspaceId)

    if (!calendar) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 400 })
    }

    // Create event
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary,
        description,
        location,
        start: {
          dateTime: start,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: end,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        attendees: attendees?.map((email: string) => ({ email })),
      },
    })

    return NextResponse.json({
      event: {
        id: response.data.id,
        title: response.data.summary,
        htmlLink: response.data.htmlLink,
      },
    })
  } catch (error) {
    console.error('Calendar create error:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

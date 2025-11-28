import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ActivityItem {
  id: string
  type: 'proposal' | 'contact' | 'project' | 'task' | 'note' | 'rfp'
  action: 'created' | 'updated' | 'completed' | 'uploaded'
  title: string
  timestamp: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const workspaceId = searchParams.get('workspaceId')
  const limit = parseInt(searchParams.get('limit') || '10')

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch recent items from multiple tables
  const [
    { data: proposals },
    { data: contacts },
    { data: projects },
    { data: tasks },
    { data: notes },
    { data: rfps },
  ] = await Promise.all([
    supabase
      .from('proposals')
      .select('id, title, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('contacts')
      .select('id, name, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('projects')
      .select('id, title, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('tasks')
      .select('id, title, status, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('prophetic_notes')
      .select('id, title, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('rfps')
      .select('id, title, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  // Transform to activity items
  const activities: ActivityItem[] = []

  proposals?.forEach(p => {
    const isNew = new Date(p.created_at).getTime() === new Date(p.updated_at).getTime()
    activities.push({
      id: `proposal-${p.id}`,
      type: 'proposal',
      action: isNew ? 'created' : 'updated',
      title: p.title,
      timestamp: p.updated_at,
    })
  })

  contacts?.forEach(c => {
    const isNew = new Date(c.created_at).getTime() === new Date(c.updated_at).getTime()
    activities.push({
      id: `contact-${c.id}`,
      type: 'contact',
      action: isNew ? 'created' : 'updated',
      title: c.name,
      timestamp: c.updated_at,
    })
  })

  projects?.forEach(p => {
    const isNew = new Date(p.created_at).getTime() === new Date(p.updated_at).getTime()
    activities.push({
      id: `project-${p.id}`,
      type: 'project',
      action: isNew ? 'created' : 'updated',
      title: p.title,
      timestamp: p.updated_at,
    })
  })

  tasks?.forEach(t => {
    const isCompleted = t.status === 'done'
    const isNew = new Date(t.created_at).getTime() === new Date(t.updated_at).getTime()
    activities.push({
      id: `task-${t.id}`,
      type: 'task',
      action: isCompleted ? 'completed' : (isNew ? 'created' : 'updated'),
      title: t.title,
      timestamp: t.updated_at,
    })
  })

  notes?.forEach(n => {
    activities.push({
      id: `note-${n.id}`,
      type: 'note',
      action: 'created',
      title: n.title || 'Untitled Note',
      timestamp: n.created_at,
    })
  })

  rfps?.forEach(r => {
    const isNew = new Date(r.created_at).getTime() === new Date(r.updated_at).getTime()
    activities.push({
      id: `rfp-${r.id}`,
      type: 'rfp',
      action: isNew ? 'uploaded' : 'updated',
      title: r.title,
      timestamp: r.updated_at,
    })
  })

  // Sort by timestamp and limit
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({
    activities: activities.slice(0, limit),
  })
}

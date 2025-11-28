import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const workspaceId = searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Get current counts
  const [
    { count: proposalCount },
    { count: contactCount },
    { count: projectCount },
    { data: tasks },
  ] = await Promise.all([
    supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('status', ['draft', 'in_progress', 'review']),
    supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
    supabase
      .from('tasks')
      .select('status')
      .eq('workspace_id', workspaceId),
  ])

  // Calculate task stats
  const totalTasks = tasks?.length || 0
  const completedTasks = tasks?.filter(t => t.status === 'done').length || 0

  // Get counts from 7 days ago for trend calculation
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString()

  const [
    { count: proposalCountOld },
    { count: contactCountOld },
    { count: projectCountOld },
  ] = await Promise.all([
    supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('status', ['draft', 'in_progress', 'review'])
      .lt('created_at', weekAgoStr),
    supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .lt('created_at', weekAgoStr),
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .lt('created_at', weekAgoStr),
  ])

  // Calculate trends (percentage change)
  const calcTrend = (current: number, old: number) => {
    if (old === 0) return current > 0 ? 100 : 0
    return Math.round(((current - old) / old) * 100)
  }

  return NextResponse.json({
    proposals: {
      count: proposalCount || 0,
      trend: calcTrend(proposalCount || 0, proposalCountOld || 0),
    },
    contacts: {
      count: contactCount || 0,
      trend: calcTrend(contactCount || 0, contactCountOld || 0),
    },
    projects: {
      count: projectCount || 0,
      trend: calcTrend(projectCount || 0, projectCountOld || 0),
    },
    tasks: {
      completed: completedTasks,
      total: totalTasks,
    },
  })
}

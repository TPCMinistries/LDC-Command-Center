import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Projects API
 *
 * Full project management with task aggregation and progress tracking
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from('projects')
      .select(`
        *,
        rfp:rfp_items(id, title, status)
      `)
      .eq('workspace_id', workspaceId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      if (status === 'active') {
        query = query.in('status', ['planning', 'active'])
      } else {
        query = query.eq('status', status)
      }
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: projects, error } = await query

    if (error) {
      console.error('Error fetching projects:', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    // Fetch task counts for each project
    const projectIds = projects?.map(p => p.id) || []
    let taskStats: Record<string, { total: number; completed: number; inProgress: number }> = {}

    if (projectIds.length > 0) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('project_id, status')
        .in('project_id', projectIds)

      if (tasks) {
        taskStats = tasks.reduce((acc, t) => {
          if (!acc[t.project_id]) {
            acc[t.project_id] = { total: 0, completed: 0, inProgress: 0 }
          }
          acc[t.project_id].total++
          if (t.status === 'done') acc[t.project_id].completed++
          if (t.status === 'in_progress') acc[t.project_id].inProgress++
          return acc
        }, {} as Record<string, { total: number; completed: number; inProgress: number }>)
      }
    }

    const projectsWithStats = projects?.map(p => ({
      ...p,
      taskStats: taskStats[p.id] || { total: 0, completed: 0, inProgress: 0 },
      progress: taskStats[p.id]?.total > 0
        ? Math.round((taskStats[p.id].completed / taskStats[p.id].total) * 100)
        : 0,
    }))

    return NextResponse.json({ projects: projectsWithStats })
  } catch (error) {
    console.error('Projects GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, project } = body

    if (!workspaceId || !project?.title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        title: project.title,
        description: project.description || null,
        status: project.status || 'planning',
        priority: project.priority ?? 2,
        owner_id: project.ownerId || null,
        team_member_ids: project.teamMemberIds || [],
        start_date: project.startDate || null,
        target_end_date: project.targetEndDate || null,
        category: project.category || null,
        tags: project.tags || [],
        budget_amount: project.budgetAmount || null,
        budget_currency: project.budgetCurrency || 'USD',
        rfp_id: project.rfpId || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating project:', error)
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }

    return NextResponse.json({ success: true, project: data })
  } catch (error) {
    console.error('Projects POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, updates } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.status !== undefined) {
      updateData.status = updates.status
      if (updates.status === 'completed') {
        updateData.actual_end_date = new Date().toISOString().split('T')[0]
      }
    }
    if (updates.priority !== undefined) updateData.priority = updates.priority
    if (updates.ownerId !== undefined) updateData.owner_id = updates.ownerId
    if (updates.teamMemberIds !== undefined) updateData.team_member_ids = updates.teamMemberIds
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate
    if (updates.targetEndDate !== undefined) updateData.target_end_date = updates.targetEndDate
    if (updates.category !== undefined) updateData.category = updates.category
    if (updates.tags !== undefined) updateData.tags = updates.tags
    if (updates.budgetAmount !== undefined) updateData.budget_amount = updates.budgetAmount
    if (updates.budgetCurrency !== undefined) updateData.budget_currency = updates.budgetCurrency
    if (updates.rfpId !== undefined) updateData.rfp_id = updates.rfpId

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single()

    if (error) {
      console.error('Error updating project:', error)
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    return NextResponse.json({ success: true, project: data })
  } catch (error) {
    console.error('Projects PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // First, unlink any tasks from this project
    await supabase
      .from('tasks')
      .update({ project_id: null })
      .eq('project_id', projectId)

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) {
      console.error('Error deleting project:', error)
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Projects DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

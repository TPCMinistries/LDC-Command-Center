import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Tasks API
 *
 * Full CRUD for task management with filtering, sorting, and bulk operations
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')
    const assignedTo = searchParams.get('assignedTo')
    const priority = searchParams.get('priority')
    const dueBefore = searchParams.get('dueBefore')
    const dueAfter = searchParams.get('dueAfter')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from('tasks')
      .select(`
        *,
        project:projects(id, title)
      `)
      .eq('workspace_id', workspaceId)
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(limit)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (status) {
      if (status === 'active') {
        query = query.in('status', ['todo', 'in_progress'])
      } else {
        query = query.eq('status', status)
      }
    }

    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo)
    }

    if (priority) {
      query = query.eq('priority', parseInt(priority, 10))
    }

    if (dueBefore) {
      query = query.lte('due_date', dueBefore)
    }

    if (dueAfter) {
      query = query.gte('due_date', dueAfter)
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('Error fetching tasks:', error)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Tasks GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, task } = body

    if (!workspaceId || !task?.title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        workspace_id: workspaceId,
        title: task.title,
        description: task.description || null,
        project_id: task.projectId || null,
        status: task.status || 'todo',
        priority: task.priority ?? 2,
        assigned_to: task.assignedTo || null,
        assigned_agent: task.assignedAgent || null,
        due_date: task.dueDate || null,
        is_recurring: task.isRecurring || false,
        recurrence_rule: task.recurrenceRule || null,
        notes: task.notes || null,
        checklist: task.checklist || [],
        attachments: task.attachments || [],
        created_by: task.createdBy || null,
        source: task.source || 'user',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    return NextResponse.json({ success: true, task: data })
  } catch (error) {
    console.error('Tasks POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, updates } = body

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Build update object with snake_case keys
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.projectId !== undefined) updateData.project_id = updates.projectId
    if (updates.status !== undefined) {
      updateData.status = updates.status
      if (updates.status === 'done') {
        updateData.completed_at = new Date().toISOString()
      }
    }
    if (updates.priority !== undefined) updateData.priority = updates.priority
    if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo
    if (updates.assignedAgent !== undefined) updateData.assigned_agent = updates.assignedAgent
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate
    if (updates.notes !== undefined) updateData.notes = updates.notes
    if (updates.checklist !== undefined) updateData.checklist = updates.checklist
    if (updates.isRecurring !== undefined) updateData.is_recurring = updates.isRecurring
    if (updates.recurrenceRule !== undefined) updateData.recurrence_rule = updates.recurrenceRule

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single()

    if (error) {
      console.error('Error updating task:', error)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    return NextResponse.json({ success: true, task: data })
  } catch (error) {
    console.error('Tasks PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      console.error('Error deleting task:', error)
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tasks DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

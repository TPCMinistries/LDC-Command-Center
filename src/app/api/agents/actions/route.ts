import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { format, addDays, addHours } from 'date-fns'

/**
 * Agent Actions API
 *
 * This endpoint allows AI agents to TAKE ACTIONS, not just give advice.
 * Actions include: creating tasks, updating priorities, sending notifications,
 * drafting emails, scheduling follow-ups, etc.
 */

interface AgentAction {
  type: string
  params: Record<string, unknown>
  reason: string // Why the agent is taking this action
}

interface ActionResult {
  success: boolean
  action: string
  result?: unknown
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, agentType, actions } = await request.json() as {
      workspaceId: string
      agentType: string
      actions: AgentAction[]
    }

    if (!workspaceId || !actions || !Array.isArray(actions)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const results: ActionResult[] = []

    for (const action of actions) {
      try {
        const result = await executeAction(supabase, workspaceId, action)
        results.push({
          success: true,
          action: action.type,
          result,
        })

        // Log the action
        await supabase.from('agent_logs').insert({
          workspace_id: workspaceId,
          agent_type: agentType,
          action: `action_${action.type}`,
          input_summary: action.reason,
          output_summary: `Executed ${action.type} action`,
          status: 'success',
          metadata: { action_params: action.params },
        })
      } catch (error) {
        results.push({
          success: false,
          action: action.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      executed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    })
  } catch (error) {
    console.error('Agent actions error:', error)
    return NextResponse.json(
      { error: 'Failed to execute actions' },
      { status: 500 }
    )
  }
}

async function executeAction(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  action: AgentAction
): Promise<unknown> {
  const { type, params } = action

  switch (type) {
    // ============ TASK ACTIONS ============
    case 'create_task': {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          workspace_id: workspaceId,
          title: params.title as string,
          description: params.description as string || null,
          priority: params.priority as string || 'medium',
          status: 'todo',
          due_date: params.due_date as string || null,
          tags: params.tags as string[] || [],
          source: 'agent', // Mark as created by agent
          metadata: {
            created_by_agent: true,
            agent_reason: action.reason,
          },
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to create task: ${error.message}`)
      return data
    }

    case 'update_task_priority': {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          priority: params.priority as string,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.task_id)
        .eq('workspace_id', workspaceId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update task: ${error.message}`)
      return data
    }

    case 'reschedule_task': {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          due_date: params.new_due_date as string,
          updated_at: new Date().toISOString(),
          metadata: {
            rescheduled_by_agent: true,
            original_due_date: params.original_due_date,
            reschedule_reason: action.reason,
          },
        })
        .eq('id', params.task_id)
        .eq('workspace_id', workspaceId)
        .select()
        .single()

      if (error) throw new Error(`Failed to reschedule task: ${error.message}`)
      return data
    }

    case 'complete_task': {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.task_id)
        .eq('workspace_id', workspaceId)
        .select()
        .single()

      if (error) throw new Error(`Failed to complete task: ${error.message}`)
      return data
    }

    // ============ NOTIFICATION ACTIONS ============
    case 'create_notification': {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          workspace_id: workspaceId,
          user_id: params.user_id as string || null, // null = workspace-wide
          title: params.title as string,
          message: params.message as string,
          type: params.type as string || 'agent_alert',
          priority: params.priority as string || 'medium',
          action_url: params.action_url as string || null,
          metadata: {
            created_by_agent: true,
            agent_type: params.agent_type,
          },
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to create notification: ${error.message}`)
      return data
    }

    // ============ FOLLOW-UP ACTIONS ============
    case 'create_follow_up': {
      // Create a task + reminder for follow-up
      const followUpDate = params.follow_up_date as string ||
        format(addDays(new Date(), params.days_from_now as number || 3), 'yyyy-MM-dd')

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          workspace_id: workspaceId,
          title: `Follow up: ${params.subject as string}`,
          description: params.context as string || null,
          priority: 'medium',
          status: 'todo',
          due_date: followUpDate,
          tags: ['follow-up', ...(params.tags as string[] || [])],
          source: 'agent',
          metadata: {
            follow_up_type: params.type || 'general',
            related_to: params.related_to,
            contact_name: params.contact_name,
            contact_email: params.contact_email,
          },
        })
        .select()
        .single()

      if (taskError) throw new Error(`Failed to create follow-up: ${taskError.message}`)
      return task
    }

    // ============ RFP ACTIONS ============
    case 'update_rfp_status': {
      const { data, error } = await supabase
        .from('rfps')
        .update({
          status: params.status as string,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.rfp_id)
        .eq('workspace_id', workspaceId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update RFP status: ${error.message}`)
      return data
    }

    case 'flag_rfp_opportunity': {
      // Create a notification about a promising RFP
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          workspace_id: workspaceId,
          title: `High-potential RFP: ${params.rfp_title}`,
          message: params.reason as string,
          type: 'opportunity',
          priority: 'high',
          action_url: `/workspace/${workspaceId}/rfp-radar`,
          metadata: {
            rfp_id: params.rfp_id,
            alignment_score: params.alignment_score,
          },
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to flag RFP: ${error.message}`)
      return data
    }

    // ============ PROPOSAL ACTIONS ============
    case 'create_proposal_task': {
      // Create tasks for proposal milestones
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          workspace_id: workspaceId,
          title: params.title as string,
          description: params.description as string || null,
          priority: params.priority as string || 'high',
          status: 'todo',
          due_date: params.due_date as string,
          tags: ['proposal', params.proposal_id as string],
          source: 'agent',
          metadata: {
            proposal_id: params.proposal_id,
            milestone_type: params.milestone_type,
          },
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to create proposal task: ${error.message}`)
      return data
    }

    // ============ DRAFT ACTIONS ============
    case 'save_draft': {
      // Save a draft (email, content, etc.) for user review
      const { data, error } = await supabase
        .from('agent_drafts')
        .insert({
          workspace_id: workspaceId,
          draft_type: params.type as string, // email, social_post, proposal_section, etc.
          title: params.title as string,
          content: params.content as string,
          metadata: params.metadata || {},
          status: 'pending_review',
          agent_type: params.agent_type as string,
          context: {
            reason: action.reason,
            related_to: params.related_to,
          },
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to save draft: ${error.message}`)
      return data
    }

    // ============ CALENDAR ACTIONS ============
    case 'suggest_time_block': {
      // Create a suggestion for time blocking (stored as a draft calendar event)
      const { data, error } = await supabase
        .from('agent_drafts')
        .insert({
          workspace_id: workspaceId,
          draft_type: 'calendar_block',
          title: params.title as string,
          content: params.description as string || '',
          metadata: {
            suggested_start: params.start_time,
            suggested_end: params.end_time,
            suggested_date: params.date,
            duration_minutes: params.duration_minutes,
            block_type: params.block_type, // deep_work, meeting_prep, admin, etc.
          },
          status: 'pending_review',
          agent_type: 'chief_of_staff',
          context: {
            reason: action.reason,
          },
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to suggest time block: ${error.message}`)
      return data
    }

    // ============ RESEARCH ACTIONS ============
    case 'save_research_finding': {
      const { data, error } = await supabase
        .from('agent_research')
        .insert({
          workspace_id: workspaceId,
          topic: params.topic as string,
          finding_type: params.type as string, // grant_opportunity, funder_intel, market_insight
          title: params.title as string,
          summary: params.summary as string,
          source_url: params.source_url as string || null,
          relevance_score: params.relevance_score as number || null,
          data: params.data || {},
          status: 'new',
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to save research: ${error.message}`)
      return data
    }

    // ============ RELATIONSHIP ACTIONS ============
    case 'log_interaction': {
      const { data, error } = await supabase
        .from('contact_interactions')
        .insert({
          workspace_id: workspaceId,
          contact_id: params.contact_id as string,
          interaction_type: params.type as string, // email, call, meeting, note
          summary: params.summary as string,
          sentiment: params.sentiment as string || 'neutral',
          follow_up_needed: params.follow_up_needed as boolean || false,
          follow_up_date: params.follow_up_date as string || null,
          logged_by: 'agent',
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to log interaction: ${error.message}`)
      return data
    }

    case 'update_contact_health': {
      const { data, error } = await supabase
        .from('contacts')
        .update({
          relationship_health: params.health as string, // hot, warm, cold, at_risk
          last_health_check: new Date().toISOString(),
          health_notes: params.notes as string || null,
        })
        .eq('id', params.contact_id)
        .eq('workspace_id', workspaceId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update contact health: ${error.message}`)
      return data
    }

    default:
      throw new Error(`Unknown action type: ${type}`)
  }
}

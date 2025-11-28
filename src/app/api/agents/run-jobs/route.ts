import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { format, addDays, subDays, isAfter, isBefore } from 'date-fns'

/**
 * Autonomous Agent Job Runner
 *
 * This endpoint is called by a scheduler (Vercel Cron, external cron, etc.)
 * to run autonomous agent jobs that have been configured.
 *
 * Jobs include:
 * - morning_briefing: Send daily briefing notification
 * - deadline_monitor: Check for approaching deadlines and create alerts
 * - relationship_check: Identify contacts that need attention
 * - grant_scan: Search for new grant opportunities
 * - weekly_review: Generate weekly summary
 */

const CHIEF_OF_STAFF_AUTONOMOUS = `You are Lorenzo's autonomous Chief of Staff agent. Unlike a chatbot that waits for questions, you PROACTIVELY take actions to help manage his work and life.

Your job is to:
1. Analyze the current state of tasks, deadlines, and opportunities
2. Identify things that need attention
3. TAKE ACTIONS to help - create tasks, send alerts, draft communications
4. Be like an excellent executive assistant who anticipates needs

Available actions you can take:
- create_task: Create a new task with title, description, priority, due_date
- create_notification: Send an alert with title, message, priority (low/medium/high/critical)
- create_follow_up: Schedule a follow-up task for a specific date
- flag_rfp_opportunity: Highlight a promising RFP opportunity
- update_task_priority: Change priority of an existing task
- save_draft: Save a draft email/content for user review
- suggest_time_block: Suggest a calendar block for focused work

When you identify something that needs action, respond with a JSON array of actions:
{
  "analysis": "Brief analysis of the situation",
  "actions": [
    {
      "type": "action_type",
      "params": { ... action-specific parameters ... },
      "reason": "Why you're taking this action"
    }
  ],
  "summary": "Human-readable summary of what you did"
}

Be decisive but thoughtful. Only take actions that truly help. Don't spam with notifications.`

export async function POST(request: NextRequest) {
  try {
    // Verify this is an authorized cron call (in production, add proper auth)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Allow without auth in development
    if (process.env.NODE_ENV === 'production' && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Get all active jobs that are due to run
    const now = new Date()
    const { data: dueJobs, error: jobsError } = await supabase
      .from('agent_jobs')
      .select('*')
      .eq('is_active', true)
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`)

    if (jobsError) {
      console.error('Failed to fetch jobs:', jobsError)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    if (!dueJobs || dueJobs.length === 0) {
      return NextResponse.json({ message: 'No jobs due to run', jobs_run: 0 })
    }

    const results = []

    for (const job of dueJobs) {
      try {
        const result = await runJob(supabase, job)
        results.push({ job_id: job.id, job_type: job.job_type, ...result })
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error)
        results.push({
          job_id: job.id,
          job_type: job.job_type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      jobs_run: results.length,
      results,
    })
  } catch (error) {
    console.error('Job runner error:', error)
    return NextResponse.json(
      { error: 'Job runner failed' },
      { status: 500 }
    )
  }
}

// Also support GET for easy testing/triggering
export async function GET(request: NextRequest) {
  // Forward to POST handler
  return POST(request)
}

async function runJob(
  supabase: ReturnType<typeof createAdminClient>,
  job: { id: string; workspace_id: string; job_type: string; agent_type: string; config: Record<string, unknown>; schedule: string }
): Promise<{ success: boolean; actions_taken: number; summary: string }> {
  const startTime = Date.now()

  // Create job run record
  const { data: jobRun, error: runError } = await supabase
    .from('agent_job_runs')
    .insert({
      job_id: job.id,
      workspace_id: job.workspace_id,
      status: 'running',
    })
    .select()
    .single()

  if (runError) {
    throw new Error(`Failed to create job run: ${runError.message}`)
  }

  try {
    let result: { actions: unknown[]; summary: string }

    switch (job.job_type) {
      case 'morning_briefing':
        result = await runMorningBriefing(supabase, job.workspace_id)
        break
      case 'deadline_monitor':
        result = await runDeadlineMonitor(supabase, job.workspace_id)
        break
      case 'relationship_check':
        result = await runRelationshipCheck(supabase, job.workspace_id)
        break
      case 'weekly_review':
        result = await runWeeklyReview(supabase, job.workspace_id)
        break
      default:
        throw new Error(`Unknown job type: ${job.job_type}`)
    }

    // Update job run as successful
    await supabase
      .from('agent_job_runs')
      .update({
        status: 'success',
        completed_at: new Date().toISOString(),
        actions_taken: result.actions,
        summary: result.summary,
      })
      .eq('id', jobRun.id)

    // Update job's last run info and schedule next run
    const nextRunAt = calculateNextRun(job.schedule)
    await supabase
      .from('agent_jobs')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'success',
        next_run_at: nextRunAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    return {
      success: true,
      actions_taken: result.actions.length,
      summary: result.summary,
    }
  } catch (error) {
    // Update job run as failed
    await supabase
      .from('agent_job_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', jobRun.id)

    // Update job's last run status
    await supabase
      .from('agent_jobs')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    throw error
  }
}

function calculateNextRun(schedule: string): string {
  const now = new Date()

  switch (schedule) {
    case 'daily':
      // Tomorrow at 6 AM
      const tomorrow = addDays(now, 1)
      tomorrow.setHours(6, 0, 0, 0)
      return tomorrow.toISOString()
    case 'weekly':
      // Next Monday at 6 AM
      const nextMonday = addDays(now, (8 - now.getDay()) % 7 || 7)
      nextMonday.setHours(6, 0, 0, 0)
      return nextMonday.toISOString()
    case 'hourly':
      const nextHour = new Date(now)
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
      return nextHour.toISOString()
    default:
      // Assume it's a cron expression - for now just do daily
      return addDays(now, 1).toISOString()
  }
}

// ============ JOB IMPLEMENTATIONS ============

async function runMorningBriefing(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<{ actions: unknown[]; summary: string }> {
  const context = await gatherBriefingContext(supabase, workspaceId)

  // Use Claude to generate briefing and determine actions
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: CHIEF_OF_STAFF_AUTONOMOUS,
    messages: [{
      role: 'user',
      content: `It's ${format(new Date(), 'EEEE, MMMM d')} morning. Generate a morning briefing and take appropriate actions.

Current Context:
${context}

Based on this context:
1. Identify the 2-3 most important things to focus on today
2. Check for any urgent deadlines or issues
3. Create a notification with the morning briefing
4. If there are overdue tasks, create alerts
5. If there's a promising opportunity, flag it

Respond with your analysis and actions in JSON format.`,
    }],
  })

  const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

  // Parse response and execute actions
  let parsed: { analysis: string; actions: Array<{ type: string; params: Record<string, unknown>; reason: string }>; summary: string }
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      // Create a default briefing notification
      parsed = {
        analysis: 'Generated morning briefing',
        actions: [{
          type: 'create_notification',
          params: {
            title: 'Good Morning! Here\'s your briefing',
            message: responseText.slice(0, 500),
            priority: 'medium',
            type: 'briefing',
          },
          reason: 'Daily morning briefing',
        }],
        summary: 'Morning briefing sent',
      }
    }
  } catch {
    parsed = {
      analysis: 'Generated morning briefing',
      actions: [{
        type: 'create_notification',
        params: {
          title: 'Good Morning! Here\'s your briefing',
          message: responseText.slice(0, 500),
          priority: 'medium',
          type: 'briefing',
        },
        reason: 'Daily morning briefing',
      }],
      summary: 'Morning briefing sent',
    }
  }

  // Execute the actions
  await executeActions(supabase, workspaceId, 'chief_of_staff', parsed.actions)

  return {
    actions: parsed.actions,
    summary: parsed.summary,
  }
}

async function runDeadlineMonitor(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<{ actions: unknown[]; summary: string }> {
  const today = new Date()
  const tomorrow = addDays(today, 1)
  const in3Days = addDays(today, 3)

  const actions: Array<{ type: string; params: Record<string, unknown>; reason: string }> = []

  // Check for overdue tasks
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date')
    .eq('workspace_id', workspaceId)
    .in('status', ['todo', 'in_progress'])
    .lt('due_date', format(today, 'yyyy-MM-dd'))
    .limit(10)

  if (overdueTasks && overdueTasks.length > 0) {
    actions.push({
      type: 'create_notification',
      params: {
        title: `${overdueTasks.length} Overdue Tasks!`,
        message: `You have ${overdueTasks.length} overdue tasks: ${overdueTasks.map(t => t.title).join(', ')}`,
        priority: 'high',
        type: 'deadline_alert',
      },
      reason: 'Alerting about overdue tasks',
    })
  }

  // Check for tasks due tomorrow
  const { data: tomorrowTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date')
    .eq('workspace_id', workspaceId)
    .in('status', ['todo', 'in_progress'])
    .eq('due_date', format(tomorrow, 'yyyy-MM-dd'))
    .limit(10)

  if (tomorrowTasks && tomorrowTasks.length > 0) {
    actions.push({
      type: 'create_notification',
      params: {
        title: `${tomorrowTasks.length} Tasks Due Tomorrow`,
        message: `Due tomorrow: ${tomorrowTasks.map(t => t.title).join(', ')}`,
        priority: 'medium',
        type: 'deadline_alert',
      },
      reason: 'Reminder about upcoming deadlines',
    })
  }

  // Check for RFP deadlines
  const { data: upcomingRfps } = await supabase
    .from('rfps')
    .select('id, title, response_deadline')
    .eq('workspace_id', workspaceId)
    .in('status', ['new', 'reviewing', 'pursuing'])
    .lte('response_deadline', format(in3Days, 'yyyy-MM-dd'))
    .gte('response_deadline', format(today, 'yyyy-MM-dd'))
    .limit(5)

  if (upcomingRfps && upcomingRfps.length > 0) {
    actions.push({
      type: 'create_notification',
      params: {
        title: `RFP Deadlines Approaching!`,
        message: `${upcomingRfps.length} RFP(s) due in the next 3 days: ${upcomingRfps.map(r => r.title).join(', ')}`,
        priority: 'high',
        type: 'deadline_alert',
      },
      reason: 'RFP deadline warning',
    })
  }

  // Execute actions
  await executeActions(supabase, workspaceId, 'chief_of_staff', actions)

  return {
    actions,
    summary: `Checked deadlines: ${overdueTasks?.length || 0} overdue, ${tomorrowTasks?.length || 0} due tomorrow, ${upcomingRfps?.length || 0} RFPs approaching`,
  }
}

async function runRelationshipCheck(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<{ actions: unknown[]; summary: string }> {
  const thirtyDaysAgo = subDays(new Date(), 30)
  const actions: Array<{ type: string; params: Record<string, unknown>; reason: string }> = []

  // Find contacts we haven't interacted with recently
  const { data: neglectedContacts } = await supabase
    .from('contacts')
    .select(`
      id,
      name,
      email,
      relationship_health,
      last_contact_date
    `)
    .eq('workspace_id', workspaceId)
    .or(`last_contact_date.lt.${format(thirtyDaysAgo, 'yyyy-MM-dd')},last_contact_date.is.null`)
    .limit(10)

  if (neglectedContacts && neglectedContacts.length > 0) {
    // Create follow-up tasks for neglected contacts
    for (const contact of neglectedContacts.slice(0, 3)) {
      actions.push({
        type: 'create_follow_up',
        params: {
          subject: contact.name,
          context: `It's been over 30 days since your last interaction with ${contact.name}. Consider reaching out to maintain the relationship.`,
          contact_name: contact.name,
          contact_email: contact.email,
          days_from_now: 2,
          type: 'relationship_maintenance',
        },
        reason: `No interaction with ${contact.name} in 30+ days`,
      })

      // Update relationship health
      actions.push({
        type: 'update_contact_health',
        params: {
          contact_id: contact.id,
          health: 'cold',
          notes: 'Flagged by agent: No interaction in 30+ days',
        },
        reason: 'Marking contact as cold due to inactivity',
      })
    }

    // Summary notification
    actions.push({
      type: 'create_notification',
      params: {
        title: 'Relationship Check',
        message: `${neglectedContacts.length} contact(s) may need attention. Follow-up tasks created for top priorities.`,
        priority: 'low',
        type: 'relationship_alert',
      },
      reason: 'Summary of relationship check',
    })
  }

  await executeActions(supabase, workspaceId, 'outreach', actions)

  return {
    actions,
    summary: `Checked relationships: ${neglectedContacts?.length || 0} contacts need attention`,
  }
}

async function runWeeklyReview(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<{ actions: unknown[]; summary: string }> {
  const context = await gatherBriefingContext(supabase, workspaceId)

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: CHIEF_OF_STAFF_AUTONOMOUS,
    messages: [{
      role: 'user',
      content: `It's Sunday evening. Generate a weekly review and planning session.

Current Context:
${context}

Provide:
1. A summary of the week (wins, challenges, incomplete items)
2. Top 3 priorities for next week
3. Any strategic concerns or opportunities

Then take these actions:
1. Create a notification with the weekly review summary
2. Create a task for the #1 priority if it doesn't exist
3. Save a draft email summarizing the week (optional)

Respond with your analysis and actions in JSON format.`,
    }],
  })

  const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

  let parsed: { analysis: string; actions: Array<{ type: string; params: Record<string, unknown>; reason: string }>; summary: string }
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      parsed = {
        analysis: responseText,
        actions: [{
          type: 'create_notification',
          params: {
            title: 'Weekly Review Ready',
            message: responseText.slice(0, 500),
            priority: 'medium',
            type: 'weekly_review',
          },
          reason: 'Weekly review summary',
        }],
        summary: 'Weekly review generated',
      }
    }
  } catch {
    parsed = {
      analysis: responseText,
      actions: [],
      summary: 'Weekly review generated (no actions)',
    }
  }

  await executeActions(supabase, workspaceId, 'chief_of_staff', parsed.actions)

  return {
    actions: parsed.actions,
    summary: parsed.summary,
  }
}

// ============ HELPERS ============

async function gatherBriefingContext(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<string> {
  const today = new Date()
  const nextWeek = addDays(today, 7)
  const todayStr = format(today, 'yyyy-MM-dd')
  const nextWeekStr = format(nextWeek, 'yyyy-MM-dd')

  let context = ''

  // Get workspace info
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single()

  if (workspace) {
    context += `Workspace: ${workspace.name}\n`
  }

  // Get urgent tasks
  const { data: urgentTasks } = await supabase
    .from('tasks')
    .select('title, due_date, priority, status')
    .eq('workspace_id', workspaceId)
    .in('status', ['todo', 'in_progress'])
    .lte('due_date', nextWeekStr)
    .order('due_date', { ascending: true })
    .limit(15)

  if (urgentTasks && urgentTasks.length > 0) {
    context += `\nUpcoming Tasks (next 7 days):\n`
    for (const task of urgentTasks) {
      context += `- [${task.priority || 'normal'}] ${task.title} (Due: ${task.due_date})\n`
    }
  }

  // Get overdue tasks
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('title, due_date')
    .eq('workspace_id', workspaceId)
    .in('status', ['todo', 'in_progress'])
    .lt('due_date', todayStr)
    .limit(10)

  if (overdueTasks && overdueTasks.length > 0) {
    context += `\nOVERDUE Tasks:\n`
    for (const task of overdueTasks) {
      context += `- ${task.title} (Was due: ${task.due_date})\n`
    }
  }

  // Get RFP deadlines
  const { data: rfps } = await supabase
    .from('rfps')
    .select('title, agency, response_deadline, status, alignment_score')
    .eq('workspace_id', workspaceId)
    .in('status', ['new', 'reviewing', 'pursuing'])
    .lte('response_deadline', nextWeekStr)
    .order('response_deadline', { ascending: true })
    .limit(10)

  if (rfps && rfps.length > 0) {
    context += `\nRFP Opportunities:\n`
    for (const rfp of rfps) {
      context += `- ${rfp.title} (${rfp.agency || 'Unknown'}) - Due: ${rfp.response_deadline}${rfp.alignment_score ? ` [Score: ${rfp.alignment_score}]` : ''}\n`
    }
  }

  // Get active proposals
  const { data: proposals } = await supabase
    .from('proposals')
    .select('title, funder_name, submission_deadline, status')
    .eq('workspace_id', workspaceId)
    .in('status', ['draft', 'in_progress', 'review'])
    .order('submission_deadline', { ascending: true })
    .limit(10)

  if (proposals && proposals.length > 0) {
    context += `\nActive Proposals:\n`
    for (const p of proposals) {
      context += `- ${p.title} (${p.funder_name || 'Unknown'}) - Due: ${p.submission_deadline || 'No deadline'} [${p.status}]\n`
    }
  }

  return context
}

async function executeActions(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  agentType: string,
  actions: Array<{ type: string; params: Record<string, unknown>; reason: string }>
): Promise<void> {
  // Call the actions API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const response = await fetch(`${baseUrl}/api/agents/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId,
      agentType,
      actions,
    }),
  })

  if (!response.ok) {
    console.error('Failed to execute actions:', await response.text())
  }
}

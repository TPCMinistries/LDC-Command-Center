import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSuggestion, getSuggestions, updateSuggestionStatus } from '@/lib/agents/memory'
import { format, differenceInDays, addDays } from 'date-fns'

/**
 * Proactive Suggestions API
 *
 * Generates and manages AI suggestions based on:
 * - User activity patterns
 * - Upcoming deadlines
 * - Relationship health
 * - Grant opportunities
 * - Task patterns
 */

const SUGGESTION_GENERATOR_SYSTEM = `You are a proactive AI assistant that analyzes user activity and context to generate helpful suggestions. Your goal is to surface opportunities, prevent problems, and help the user be more effective.

Types of suggestions you can make:
- opportunity: A chance to pursue something valuable
- reminder: Something the user might have forgotten
- insight: A pattern or observation worth noting
- warning: A potential problem to address
- recommendation: A suggested action or approach

When generating suggestions:
1. Be specific and actionable
2. Explain why this matters
3. Reference concrete data when possible
4. Prioritize appropriately (low, medium, high, urgent)
5. Don't overwhelm - focus on the most impactful suggestions

Respond in JSON format:
{
  "suggestions": [
    {
      "type": "opportunity|reminder|insight|warning|recommendation",
      "title": "Brief title",
      "content": "Detailed suggestion (2-3 sentences)",
      "priority": "low|medium|high|urgent",
      "trigger_reason": "What data triggered this",
      "related_entity_type": "task|rfp|proposal|contact|null",
      "related_entity_id": "uuid or null",
      "action_type": "create_task|send_email|update_status|review|null",
      "action_params": {}
    }
  ]
}`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, action } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    if (action === 'generate') {
      // Generate new suggestions based on current context
      return await generateSuggestions(workspaceId)
    } else if (action === 'update_status') {
      const { suggestionId, status } = body
      await updateSuggestionStatus(suggestionId, status)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Suggestions error:', error)
    return NextResponse.json(
      { error: 'Failed to process suggestions' },
      { status: 500 }
    )
  }
}

async function generateSuggestions(workspaceId: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const supabase = createAdminClient()
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const nextWeek = addDays(today, 7)
  const nextWeekStr = format(nextWeek, 'yyyy-MM-dd')

  // Gather context for suggestion generation
  let context = ''

  // 1. Get overdue tasks
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, priority')
    .eq('workspace_id', workspaceId)
    .in('status', ['todo', 'in_progress'])
    .lt('due_date', todayStr)
    .limit(10)

  if (overdueTasks && overdueTasks.length > 0) {
    context += `**Overdue Tasks (${overdueTasks.length}):**\n`
    overdueTasks.forEach(t => {
      context += `- "${t.title}" was due ${t.due_date} [${t.priority}] (id: ${t.id})\n`
    })
    context += '\n'
  }

  // 2. Get upcoming deadlines
  const { data: upcomingTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, priority')
    .eq('workspace_id', workspaceId)
    .in('status', ['todo', 'in_progress'])
    .gte('due_date', todayStr)
    .lte('due_date', nextWeekStr)
    .order('due_date', { ascending: true })
    .limit(10)

  if (upcomingTasks && upcomingTasks.length > 0) {
    context += `**Tasks Due This Week (${upcomingTasks.length}):**\n`
    upcomingTasks.forEach(t => {
      const daysUntil = differenceInDays(new Date(t.due_date), today)
      context += `- "${t.title}" due in ${daysUntil} days (${t.due_date}) [${t.priority}] (id: ${t.id})\n`
    })
    context += '\n'
  }

  // 3. Get RFP deadlines
  const { data: rfps } = await supabase
    .from('rfps')
    .select('id, title, response_deadline, status, alignment_score')
    .eq('workspace_id', workspaceId)
    .in('status', ['new', 'reviewing', 'pursuing'])
    .lte('response_deadline', nextWeekStr)
    .order('response_deadline', { ascending: true })
    .limit(10)

  if (rfps && rfps.length > 0) {
    context += `**RFP Deadlines:**\n`
    rfps.forEach(r => {
      const daysUntil = differenceInDays(new Date(r.response_deadline), today)
      context += `- "${r.title}" deadline in ${daysUntil} days [${r.status}]${r.alignment_score ? ` Score: ${r.alignment_score}` : ''} (id: ${r.id})\n`
    })
    context += '\n'
  }

  // 4. Get proposals in progress
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, submission_deadline, status, completion_percentage')
    .eq('workspace_id', workspaceId)
    .in('status', ['draft', 'in_progress', 'review'])
    .order('submission_deadline', { ascending: true })
    .limit(10)

  if (proposals && proposals.length > 0) {
    context += `**Active Proposals:**\n`
    proposals.forEach(p => {
      const daysUntil = p.submission_deadline
        ? differenceInDays(new Date(p.submission_deadline), today)
        : null
      context += `- "${p.title}" [${p.status}]${p.completion_percentage ? ` ${p.completion_percentage}% complete` : ''}${daysUntil !== null ? ` Due in ${daysUntil} days` : ''} (id: ${p.id})\n`
    })
    context += '\n'
  }

  // 5. Get contacts that might need attention
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, relationship_health, last_health_check, type')
    .eq('workspace_id', workspaceId)
    .in('relationship_health', ['cold', 'at_risk'])
    .limit(10)

  if (contacts && contacts.length > 0) {
    context += `**Contacts Needing Attention:**\n`
    contacts.forEach(c => {
      context += `- ${c.name} (${c.type || 'contact'}) - ${c.relationship_health} (id: ${c.id})\n`
    })
    context += '\n'
  }

  // 6. Get recent activity patterns
  const { data: recentActivity } = await supabase
    .from('user_activity_log')
    .select('activity_type, entity_type, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (recentActivity && recentActivity.length > 0) {
    const activitySummary: Record<string, number> = {}
    recentActivity.forEach(a => {
      const key = `${a.activity_type}${a.entity_type ? `_${a.entity_type}` : ''}`
      activitySummary[key] = (activitySummary[key] || 0) + 1
    })
    context += `**Recent Activity Pattern:**\n`
    Object.entries(activitySummary).forEach(([key, count]) => {
      context += `- ${key}: ${count} times\n`
    })
    context += '\n'
  }

  // 7. Get workspace info
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, type')
    .eq('id', workspaceId)
    .single()

  if (workspace) {
    context = `**Workspace:** ${workspace.name} (${workspace.type || 'general'})\n**Today:** ${format(today, 'EEEE, MMMM d, yyyy')}\n\n` + context
  }

  if (!context || context.length < 50) {
    return NextResponse.json({
      success: true,
      suggestions: [],
      message: 'Not enough context to generate suggestions'
    })
  }

  // Generate suggestions using AI
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SUGGESTION_GENERATOR_SYSTEM,
    messages: [{
      role: 'user',
      content: `Based on this workspace context, generate 3-5 proactive suggestions to help the user be more effective.

${context}

Focus on:
1. Urgent items that need immediate attention
2. Opportunities that might be missed
3. Patterns that suggest problems
4. Quick wins that could build momentum

Generate suggestions in JSON format.`,
    }],
  })

  const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

  let suggestions: Array<{
    type: string
    title: string
    content: string
    priority: string
    trigger_reason: string
    related_entity_type?: string
    related_entity_id?: string
    action_type?: string
    action_params?: Record<string, unknown>
  }> = []

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      suggestions = parsed.suggestions || []
    }
  } catch {
    // Fall through
  }

  // Save suggestions to database
  for (const suggestion of suggestions) {
    await createSuggestion(workspaceId, {
      agentType: 'system',
      suggestionType: suggestion.type as 'opportunity' | 'reminder' | 'insight' | 'warning' | 'recommendation',
      title: suggestion.title,
      content: suggestion.content,
      priority: suggestion.priority as 'low' | 'medium' | 'high' | 'urgent',
      triggerReason: suggestion.trigger_reason,
      relatedEntityType: suggestion.related_entity_type,
      relatedEntityId: suggestion.related_entity_id,
      actionType: suggestion.action_type,
      actionParams: suggestion.action_params,
    })
  }

  return NextResponse.json({
    success: true,
    suggestions,
    count: suggestions.length,
  })
}

// GET endpoint to fetch suggestions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status') as 'new' | 'seen' | 'acted' | 'dismissed' || 'new'
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const suggestions = await getSuggestions(workspaceId, { status, limit })

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

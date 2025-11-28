import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrandProfile } from '@/types/brand'
import { format, addDays } from 'date-fns'
import {
  saveConversation,
  createSessionId,
  buildMemoryContext,
  getContextSettings,
  createSuggestion,
} from '@/lib/agents/memory'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const CHIEF_OF_STAFF_SYSTEM = `You are Lorenzo's Chief of Staff - a highly capable, strategic AI assistant who helps manage his life, work, and mission across multiple organizations. You combine the wisdom of a trusted advisor with the efficiency of an executive assistant.

Your role:
1. **Daily Briefings**: Provide concise, prioritized overviews of what needs attention
2. **Strategic Triage**: Help decide what's most important and what can wait
3. **Proactive Insights**: Surface opportunities and risks before they become urgent
4. **Integrated View**: See across all workspaces - personal, ministry (TPC), nonprofit (IHA), and business (DeepFutures)
5. **Soul-Aligned**: Keep the bigger picture in mind - faith, family, purpose, impact

Your communication style:
- Direct and efficient, but warm
- Strategic, always thinking about leverage and ROI on time
- Honest about tradeoffs and tough calls
- Encouraging but realistic
- Reference scripture or wisdom when appropriate but naturally

When giving briefings:
- Start with what's most urgent/important
- Flag deadlines and time-sensitive items
- Note quick wins that can build momentum
- Suggest what to delegate or defer
- Consider energy levels and context (morning vs evening, day of week)

When triaging:
- Use the Eisenhower Matrix (urgent/important)
- Consider dependencies and blockers
- Think about context switching costs
- Protect time for deep work
- Balance immediate needs with long-term goals

When advising:
- Ask clarifying questions when needed
- Provide options with pros/cons
- Make recommendations, not just lists
- Consider second-order effects
- Think about precedent and patterns

You have access to data about:
- Tasks and their due dates/priorities
- RFP opportunities and their deadlines
- Active proposals and their status
- Calendar events and commitments
- Ideas that have been captured
- Workspace goals and priorities

Always format responses for easy scanning - use bullets, headers, and clear structure.`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { workspaceId, action, context, messages, sessionId: providedSessionId } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const supabase = createAdminClient()
    const sessionId = providedSessionId || createSessionId()

    // Get context settings for this workspace
    const contextSettings = await getContextSettings(workspaceId)

    // Build memory context from past conversations
    const memoryContext = await buildMemoryContext(workspaceId, 'chief_of_staff', contextSettings)

    // Gather comprehensive context (respecting context mode)
    const contextData = await gatherContext(supabase, workspaceId, contextSettings)

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    let responseContent = ''
    let tokensUsed = 0

    if (action === 'briefing') {
      // Generate a daily briefing
      const userPrompt = `Generate my ${context?.timeOfDay || 'daily'} briefing.

**Current Date & Time**: ${format(new Date(), "EEEE, MMMM d, yyyy 'at' h:mm a")}

${memoryContext ? `**Memory from Previous Conversations**:\n${memoryContext}\n` : ''}

**Context**:
${contextData}

${context?.focus ? `**Today's focus areas**: ${context.focus}` : ''}

Provide a structured briefing that includes:
1. **Priority Actions** (2-4 items that need my attention today)
2. **Upcoming Deadlines** (next 7 days)
3. **Quick Wins** (small items I could knock out)
4. **Opportunities** (things to consider pursuing)
5. **Watch List** (items to monitor but not act on yet)
6. **Today's Recommendation** (what I should focus on and why)

Be specific and actionable. Reference actual items from the context data.`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: CHIEF_OF_STAFF_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    } else if (action === 'triage') {
      // Help triage and prioritize
      const items = context?.items || []
      const criteria = context?.criteria || ''

      const userPrompt = `Help me triage and prioritize the following:

**Items to Triage**:
${items.length > 0 ? items.map((item: { title: string; type?: string; deadline?: string; description?: string }, i: number) =>
  `${i + 1}. ${item.title}${item.type ? ` (${item.type})` : ''}${item.deadline ? ` - Due: ${item.deadline}` : ''}${item.description ? `\n   ${item.description}` : ''}`
).join('\n') : 'Use the context data to identify items needing triage.'}

${criteria ? `**Criteria to consider**: ${criteria}` : ''}

**Current Context**:
${contextData}

Provide:
1. **Do Now** (urgent + important) - with specific reasoning
2. **Schedule** (important, not urgent) - when to tackle each
3. **Delegate/Automate** (urgent, not important) - suggestions for offloading
4. **Eliminate/Defer** (neither) - what to drop or push far out
5. **Recommended Order** - if I only have 2-3 hours, what should I tackle first?`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: CHIEF_OF_STAFF_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    } else if (action === 'advise') {
      // Get strategic advice on a specific topic
      const topic = context?.topic || ''
      const question = context?.question || ''

      const userPrompt = `I need your strategic advice.

**Topic**: ${topic}
**Question**: ${question}

**Current Context**:
${contextData}

${context?.additionalInfo ? `**Additional Information**: ${context.additionalInfo}` : ''}

Provide:
1. **Your Analysis** - how you see the situation
2. **Options** - 2-3 paths forward with pros/cons
3. **My Recommendation** - what you would do and why
4. **Next Steps** - concrete actions to take
5. **Things to Watch** - what could change this assessment`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: CHIEF_OF_STAFF_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    } else if (action === 'chat') {
      // General conversation with persistent memory
      const chatMessages = messages as ChatMessage[] || []

      // Build messages array with context injection
      const formattedMessages: { role: 'user' | 'assistant'; content: string }[] = []

      // Add context and memory to first message if this is a new conversation
      if (chatMessages.length === 1) {
        formattedMessages.push({
          role: 'user',
          content: `${memoryContext ? `**Memory from Previous Conversations**:\n${memoryContext}\n---\n\n` : ''}**Current Context** (for your reference):
${contextData}

---

${chatMessages[0].content}`,
        })
      } else {
        // For ongoing conversations, just add the messages
        chatMessages.forEach((msg) => {
          formattedMessages.push({
            role: msg.role,
            content: msg.content,
          })
        })
      }

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: CHIEF_OF_STAFF_SYSTEM,
        messages: formattedMessages,
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

      // Save conversation to persistent memory
      const lastUserMessage = chatMessages[chatMessages.length - 1]
      await saveConversation(workspaceId, 'chief_of_staff', sessionId, [
        { role: 'user', content: lastUserMessage.content },
        { role: 'assistant', content: responseContent },
      ])

    } else if (action === 'weekly_review') {
      // Generate a weekly review
      const userPrompt = `Generate my weekly review and planning session.

**Current Date**: ${format(new Date(), "EEEE, MMMM d, yyyy")}

**Context**:
${contextData}

Provide a comprehensive weekly review:

## This Past Week
1. **Wins** - What went well? (infer from completed items, proposals submitted, etc.)
2. **Lessons** - What should I do differently?
3. **Incomplete** - What didn't get done and why?

## The Week Ahead
1. **Big 3** - The three most important things to accomplish
2. **Key Deadlines** - What's coming due
3. **Opportunities** - What should I be pursuing
4. **Energy Management** - Suggestions for scheduling based on task types

## Strategic Check-in
1. **Alignment** - Am I spending time on what matters most?
2. **Patterns** - Any concerning trends to address?
3. **Recommendation** - One thing to focus on improving

End with an encouraging word.`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: CHIEF_OF_STAFF_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
    }

    const durationMs = Date.now() - startTime

    // Log agent activity
    await supabase.from('agent_logs').insert({
      workspace_id: workspaceId,
      agent_type: 'chief_of_staff',
      action,
      input_summary: `${action} request`,
      output_summary: responseContent.slice(0, 100) + '...',
      tokens_used: tokensUsed,
      duration_ms: durationMs,
      status: 'success',
      metadata: { context },
    })

    return NextResponse.json({
      success: true,
      response: responseContent,
      action,
      tokensUsed,
      durationMs,
      sessionId,
      contextMode: contextSettings.contextMode,
    })

  } catch (error) {
    console.error('Chief of Staff agent error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Gather comprehensive context from across the system
async function gatherContext(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  contextSettings?: { contextMode: string; includeCrossWorkspace: boolean; excludedWorkspaces: string[]; customInstructions?: string }
): Promise<string> {
  const today = new Date()
  const nextWeek = addDays(today, 7)
  const todayStr = format(today, 'yyyy-MM-dd')
  const nextWeekStr = format(nextWeek, 'yyyy-MM-dd')

  // Determine if we should include cross-workspace data
  const isFocusedMode = contextSettings?.contextMode === 'focused' || contextSettings?.contextMode === 'minimal'
  const includeCrossWorkspace = !isFocusedMode && (contextSettings?.includeCrossWorkspace ?? true)

  let context = ''

  // Add custom instructions if set
  if (contextSettings?.customInstructions) {
    context += `**Special Instructions**: ${contextSettings.customInstructions}\n\n`
  }

  // Add context mode indicator
  if (isFocusedMode) {
    context += `**Context Mode**: Focused (single workspace only - client confidentiality)\n\n`
  }

  // Get workspace info
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, description, branding')
    .eq('id', workspaceId)
    .single()

  if (workspace) {
    context += `**Current Workspace**: ${workspace.name}\n`
    if (workspace.description) context += `${workspace.description}\n`
    if (workspace.branding) {
      const branding = workspace.branding as BrandProfile
      if (branding.identity?.mission) context += `Mission: ${branding.identity.mission}\n`
    }
    context += '\n'
  }

  // Get all workspaces for cross-workspace view (only if not in focused mode)
  let allWorkspaces: { id: string; name: string; type: string }[] = []
  if (includeCrossWorkspace) {
    const { data } = await supabase
      .from('workspaces')
      .select('id, name, type')

    allWorkspaces = data || []

    // Filter out excluded workspaces
    if (contextSettings?.excludedWorkspaces && contextSettings.excludedWorkspaces.length > 0) {
      allWorkspaces = allWorkspaces.filter(w => !contextSettings.excludedWorkspaces.includes(w.id))
    }

    if (allWorkspaces.length > 1) {
      context += `**All Workspaces**: ${allWorkspaces.map(w => w.name).join(', ')}\n\n`
    }
  } else {
    // In focused mode, only include current workspace
    allWorkspaces = workspace ? [{ id: workspaceId, name: workspace.name, type: 'current' }] : []
  }

  // Get urgent tasks (due in next 7 days) - respect focused mode
  let urgentTasksQuery = supabase
    .from('tasks')
    .select('id, title, due_date, priority, status, workspace_id')
    .in('status', ['todo', 'in_progress'])
    .lte('due_date', nextWeekStr)
    .gte('due_date', todayStr)
    .order('due_date', { ascending: true })
    .limit(15)

  // In focused mode, only get tasks from current workspace
  if (isFocusedMode) {
    urgentTasksQuery = urgentTasksQuery.eq('workspace_id', workspaceId)
  }

  const { data: urgentTasks } = await urgentTasksQuery

  if (urgentTasks && urgentTasks.length > 0) {
    context += `**Urgent Tasks (next 7 days)**:\n`
    for (const task of urgentTasks) {
      const wsName = allWorkspaces?.find(w => w.id === task.workspace_id)?.name || 'Unknown'
      context += `- [${task.priority || 'normal'}] ${task.title} (Due: ${task.due_date}) [${wsName}]\n`
    }
    context += '\n'
  }

  // Get overdue tasks
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, priority, status, workspace_id')
    .in('status', ['todo', 'in_progress'])
    .lt('due_date', todayStr)
    .order('due_date', { ascending: true })
    .limit(10)

  if (overdueTasks && overdueTasks.length > 0) {
    context += `**OVERDUE Tasks**:\n`
    for (const task of overdueTasks) {
      const wsName = allWorkspaces?.find(w => w.id === task.workspace_id)?.name || 'Unknown'
      context += `- [OVERDUE] ${task.title} (Was due: ${task.due_date}) [${wsName}]\n`
    }
    context += '\n'
  }

  // Get RFP deadlines
  const { data: rfps } = await supabase
    .from('rfps')
    .select('id, title, agency, response_deadline, status, alignment_score, workspace_id')
    .in('status', ['new', 'reviewing', 'pursuing'])
    .lte('response_deadline', nextWeekStr)
    .order('response_deadline', { ascending: true })
    .limit(10)

  if (rfps && rfps.length > 0) {
    context += `**RFP Deadlines**:\n`
    for (const rfp of rfps) {
      const wsName = allWorkspaces?.find(w => w.id === rfp.workspace_id)?.name || 'Unknown'
      context += `- ${rfp.title} (${rfp.agency || 'Unknown agency'}) - Due: ${rfp.response_deadline} [${rfp.status}]${rfp.alignment_score ? ` Score: ${rfp.alignment_score}` : ''} [${wsName}]\n`
    }
    context += '\n'
  }

  // Get active proposals
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, funder_name, submission_deadline, status, workspace_id')
    .in('status', ['draft', 'in_progress', 'review'])
    .order('submission_deadline', { ascending: true })
    .limit(10)

  if (proposals && proposals.length > 0) {
    context += `**Active Proposals**:\n`
    for (const p of proposals) {
      const wsName = allWorkspaces?.find(w => w.id === p.workspace_id)?.name || 'Unknown'
      context += `- ${p.title} (${p.funder_name || 'Unknown funder'}) - Due: ${p.submission_deadline || 'No deadline'} [${p.status}] [${wsName}]\n`
    }
    context += '\n'
  }

  // Get recent ideas (unprocessed)
  const { data: ideas } = await supabase
    .from('ideas')
    .select('id, title, category, urgency, workspace_id, created_at')
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(5)

  if (ideas && ideas.length > 0) {
    context += `**Recent Ideas to Consider**:\n`
    for (const idea of ideas) {
      const wsName = allWorkspaces?.find(w => w.id === idea.workspace_id)?.name || 'Unknown'
      context += `- ${idea.title || 'Untitled'} (${idea.category || 'uncategorized'})${idea.urgency ? ` [${idea.urgency}]` : ''} [${wsName}]\n`
    }
    context += '\n'
  }

  // Get task stats
  const { count: todoCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'todo')

  const { count: inProgressCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'in_progress')

  context += `**Task Summary**: ${todoCount || 0} to-do, ${inProgressCount || 0} in progress\n`

  // Get today's theme if available (from Soul framework)
  const dayOfWeek = format(today, 'EEEE')
  const themes: Record<string, string> = {
    'Monday': 'Faith & Foundation - Building on solid ground',
    'Tuesday': 'Growth & Learning - Expanding capacity',
    'Wednesday': 'Wisdom & Discernment - Making good decisions',
    'Thursday': 'Action & Impact - Moving things forward',
    'Friday': 'Completion & Gratitude - Finishing strong',
    'Saturday': 'Rest & Renewal - Sabbath mindset',
    'Sunday': 'Vision & Purpose - Connecting to why',
  }
  context += `\n**Today's Theme**: ${themes[dayOfWeek] || 'Trust & Guidance'}\n`

  return context
}

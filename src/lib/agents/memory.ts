import { createAdminClient } from '@/lib/supabase/admin'
import { v4 as uuidv4 } from 'uuid'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Agent Memory Service
 *
 * Provides persistent memory capabilities for all agents:
 * - Conversation history storage and retrieval
 * - Memory summarization for efficient context injection
 * - Context mode management (full vs focused)
 * - Proactive suggestion generation
 */

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, unknown>
}

export interface MemorySummary {
  summary: string
  keyTopics: string[]
  keyDecisions: string[]
  actionItems: string[]
}

export interface ContextSettings {
  contextMode: 'full' | 'focused' | 'minimal'
  includeCrossWorkspace: boolean
  includeConversationHistory: boolean
  includeSuggestions: boolean
  maxHistoryMessages: number
  maxHistoryDays: number
  excludedWorkspaces: string[]
  customInstructions?: string
}

export interface AgentSuggestion {
  id: string
  suggestionType: string
  title: string
  content: string
  priority: string
  triggerReason?: string
  relatedEntityType?: string
  relatedEntityId?: string
  actionType?: string
  actionParams?: Record<string, unknown>
  createdAt: string
}

const DEFAULT_CONTEXT_SETTINGS: ContextSettings = {
  contextMode: 'full',
  includeCrossWorkspace: true,
  includeConversationHistory: true,
  includeSuggestions: true,
  maxHistoryMessages: 50,
  maxHistoryDays: 30,
  excludedWorkspaces: [],
}

/**
 * Get or create a session ID for a conversation
 */
export function createSessionId(): string {
  return uuidv4()
}

/**
 * Save a conversation message to persistent storage
 */
export async function saveConversationMessage(
  workspaceId: string,
  agentType: string,
  sessionId: string,
  message: ConversationMessage,
  userId?: string
): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('conversation_history').insert({
    workspace_id: workspaceId,
    user_id: userId || null,
    agent_type: agentType,
    session_id: sessionId,
    role: message.role,
    content: message.content,
    metadata: message.metadata || {},
  })
}

/**
 * Save multiple conversation messages at once
 */
export async function saveConversation(
  workspaceId: string,
  agentType: string,
  sessionId: string,
  messages: ConversationMessage[],
  userId?: string
): Promise<void> {
  const supabase = createAdminClient()

  const records = messages.map(msg => ({
    workspace_id: workspaceId,
    user_id: userId || null,
    agent_type: agentType,
    session_id: sessionId,
    role: msg.role,
    content: msg.content,
    metadata: msg.metadata || {},
  }))

  await supabase.from('conversation_history').insert(records)
}

/**
 * Get recent conversation history for an agent
 */
export async function getConversationHistory(
  workspaceId: string,
  agentType: string,
  options: {
    limit?: number
    daysBack?: number
    sessionId?: string
  } = {}
): Promise<ConversationMessage[]> {
  const supabase = createAdminClient()
  const { limit = 50, daysBack = 30, sessionId } = options

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysBack)

  let query = supabase
    .from('conversation_history')
    .select('role, content, metadata, created_at')
    .eq('workspace_id', workspaceId)
    .eq('agent_type', agentType)
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)

  if (sessionId) {
    query = query.eq('session_id', sessionId)
  }

  const { data, error } = await query

  if (error || !data) return []

  return data.map(row => ({
    role: row.role as 'user' | 'assistant',
    content: row.content,
    metadata: row.metadata as Record<string, unknown>,
  }))
}

/**
 * Get the most recent memory summary for an agent
 */
export async function getMemorySummary(
  workspaceId: string,
  agentType: string
): Promise<MemorySummary | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('memory_summaries')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('agent_type', agentType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null

  return {
    summary: data.summary,
    keyTopics: data.key_topics || [],
    keyDecisions: data.key_decisions || [],
    actionItems: data.action_items || [],
  }
}

/**
 * Generate and save a memory summary from recent conversations
 */
export async function generateMemorySummary(
  workspaceId: string,
  agentType: string
): Promise<MemorySummary | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  const supabase = createAdminClient()

  // Get recent conversations that haven't been summarized
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)

  const { data: messages } = await supabase
    .from('conversation_history')
    .select('role, content, created_at')
    .eq('workspace_id', workspaceId)
    .eq('agent_type', agentType)
    .gte('created_at', lastWeek.toISOString())
    .order('created_at', { ascending: true })
    .limit(100)

  if (!messages || messages.length < 5) return null

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Summarize these recent conversations with the user. Extract key information for future reference.

CONVERSATIONS:
${conversationText}

Respond in JSON format:
{
  "summary": "2-3 paragraph summary of what was discussed and any patterns",
  "key_topics": ["topic1", "topic2", ...],
  "key_decisions": ["decision1", "decision2", ...],
  "action_items": ["item1", "item2", ...]
}`,
    }],
  })

  try {
    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    // Save the summary
    await supabase.from('memory_summaries').insert({
      workspace_id: workspaceId,
      agent_type: agentType,
      summary: parsed.summary,
      key_topics: parsed.key_topics,
      key_decisions: parsed.key_decisions,
      action_items: parsed.action_items,
      time_period_start: lastWeek.toISOString(),
      time_period_end: new Date().toISOString(),
      message_count: messages.length,
    })

    return parsed as MemorySummary
  } catch {
    return null
  }
}

/**
 * Get context settings for a workspace
 */
export async function getContextSettings(workspaceId: string): Promise<ContextSettings> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('agent_context_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !data) return DEFAULT_CONTEXT_SETTINGS

  return {
    contextMode: data.context_mode as 'full' | 'focused' | 'minimal',
    includeCrossWorkspace: data.include_cross_workspace,
    includeConversationHistory: data.include_conversation_history,
    includeSuggestions: data.include_suggestions,
    maxHistoryMessages: data.max_history_messages,
    maxHistoryDays: data.max_history_days,
    excludedWorkspaces: data.excluded_workspaces || [],
    customInstructions: data.custom_instructions,
  }
}

/**
 * Update context settings for a workspace
 */
export async function updateContextSettings(
  workspaceId: string,
  settings: Partial<ContextSettings>
): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('agent_context_settings').upsert({
    workspace_id: workspaceId,
    context_mode: settings.contextMode,
    include_cross_workspace: settings.includeCrossWorkspace,
    include_conversation_history: settings.includeConversationHistory,
    include_suggestions: settings.includeSuggestions,
    max_history_messages: settings.maxHistoryMessages,
    max_history_days: settings.maxHistoryDays,
    excluded_workspaces: settings.excludedWorkspaces,
    custom_instructions: settings.customInstructions,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'workspace_id',
  })
}

/**
 * Create a proactive suggestion
 */
export async function createSuggestion(
  workspaceId: string,
  suggestion: {
    agentType: string
    suggestionType: 'opportunity' | 'reminder' | 'insight' | 'warning' | 'recommendation'
    title: string
    content: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    triggerReason?: string
    relatedEntityType?: string
    relatedEntityId?: string
    actionType?: string
    actionParams?: Record<string, unknown>
    expiresAt?: Date
  }
): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('agent_suggestions').insert({
    workspace_id: workspaceId,
    agent_type: suggestion.agentType,
    suggestion_type: suggestion.suggestionType,
    title: suggestion.title,
    content: suggestion.content,
    priority: suggestion.priority || 'medium',
    trigger_reason: suggestion.triggerReason,
    related_entity_type: suggestion.relatedEntityType,
    related_entity_id: suggestion.relatedEntityId,
    action_type: suggestion.actionType,
    action_params: suggestion.actionParams || {},
    expires_at: suggestion.expiresAt?.toISOString(),
  })
}

/**
 * Get active suggestions for a workspace
 */
export async function getSuggestions(
  workspaceId: string,
  options: {
    status?: 'new' | 'seen' | 'acted' | 'dismissed'
    limit?: number
    agentType?: string
  } = {}
): Promise<AgentSuggestion[]> {
  const supabase = createAdminClient()
  const { status = 'new', limit = 10, agentType } = options

  let query = supabase
    .from('agent_suggestions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (agentType) {
    query = query.eq('agent_type', agentType)
  }

  // Filter out expired suggestions
  query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

  const { data, error } = await query

  if (error || !data) return []

  return data.map(row => ({
    id: row.id,
    suggestionType: row.suggestion_type,
    title: row.title,
    content: row.content,
    priority: row.priority,
    triggerReason: row.trigger_reason,
    relatedEntityType: row.related_entity_type,
    relatedEntityId: row.related_entity_id,
    actionType: row.action_type,
    actionParams: row.action_params as Record<string, unknown>,
    createdAt: row.created_at,
  }))
}

/**
 * Mark a suggestion as seen, acted upon, or dismissed
 */
export async function updateSuggestionStatus(
  suggestionId: string,
  status: 'seen' | 'acted' | 'dismissed'
): Promise<void> {
  const supabase = createAdminClient()

  const updates: Record<string, unknown> = { status }

  if (status === 'seen') updates.seen_at = new Date().toISOString()
  if (status === 'acted') updates.acted_at = new Date().toISOString()
  if (status === 'dismissed') updates.dismissed_at = new Date().toISOString()

  await supabase
    .from('agent_suggestions')
    .update(updates)
    .eq('id', suggestionId)
}

/**
 * Log user activity for suggestion generation
 */
export async function logActivity(
  workspaceId: string,
  activity: {
    activityType: string
    entityType?: string
    entityId?: string
    metadata?: Record<string, unknown>
    userId?: string
  }
): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('user_activity_log').insert({
    workspace_id: workspaceId,
    user_id: activity.userId || null,
    activity_type: activity.activityType,
    entity_type: activity.entityType,
    entity_id: activity.entityId,
    metadata: activity.metadata || {},
  })
}

/**
 * Build memory context string for injection into agent prompts
 */
export async function buildMemoryContext(
  workspaceId: string,
  agentType: string,
  settings?: ContextSettings
): Promise<string> {
  const contextSettings = settings || await getContextSettings(workspaceId)

  if (!contextSettings.includeConversationHistory) {
    return ''
  }

  let memoryContext = ''

  // Get memory summary
  const summary = await getMemorySummary(workspaceId, agentType)
  if (summary) {
    memoryContext += `**Memory Summary from Previous Conversations:**\n`
    memoryContext += `${summary.summary}\n\n`

    if (summary.keyTopics.length > 0) {
      memoryContext += `Key topics we've discussed: ${summary.keyTopics.join(', ')}\n`
    }
    if (summary.keyDecisions.length > 0) {
      memoryContext += `Important decisions made: ${summary.keyDecisions.join('; ')}\n`
    }
    if (summary.actionItems.length > 0) {
      memoryContext += `Outstanding action items: ${summary.actionItems.join('; ')}\n`
    }
    memoryContext += '\n'
  }

  // Get recent conversation snippets
  const recentMessages = await getConversationHistory(workspaceId, agentType, {
    limit: 10,
    daysBack: 7,
  })

  if (recentMessages.length > 0) {
    memoryContext += `**Recent Conversation Context:**\n`
    for (const msg of recentMessages.slice(-6)) {
      const prefix = msg.role === 'user' ? 'User' : 'You'
      memoryContext += `${prefix}: ${msg.content.slice(0, 200)}${msg.content.length > 200 ? '...' : ''}\n`
    }
    memoryContext += '\n'
  }

  return memoryContext
}

/**
 * Build full context string for an agent, respecting context mode
 */
export async function buildAgentContext(
  workspaceId: string,
  agentType: string,
  additionalContext?: string
): Promise<{ context: string; settings: ContextSettings }> {
  const settings = await getContextSettings(workspaceId)
  const supabase = createAdminClient()

  let context = ''

  // Add custom instructions if set
  if (settings.customInstructions) {
    context += `**Special Instructions for this Workspace:**\n${settings.customInstructions}\n\n`
  }

  // Context mode affects what data we include
  if (settings.contextMode === 'minimal') {
    // Minimal: Just the current workspace name
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    if (workspace) {
      context += `**Current Workspace:** ${workspace.name}\n\n`
    }
  } else if (settings.contextMode === 'focused') {
    // Focused: Current workspace only, no cross-workspace data
    context += `**Context Mode:** Focused (single workspace only)\n\n`
  } else {
    // Full: Include cross-workspace context
    if (settings.includeCrossWorkspace) {
      context += `**Context Mode:** Full (cross-workspace enabled)\n\n`
    }
  }

  // Add memory context
  if (settings.includeConversationHistory) {
    const memoryContext = await buildMemoryContext(workspaceId, agentType, settings)
    if (memoryContext) {
      context += memoryContext
    }
  }

  // Add active suggestions context
  if (settings.includeSuggestions) {
    const suggestions = await getSuggestions(workspaceId, { status: 'new', limit: 5 })
    if (suggestions.length > 0) {
      context += `**Pending Suggestions to Consider:**\n`
      for (const s of suggestions) {
        context += `- [${s.priority}] ${s.title}: ${s.content.slice(0, 100)}...\n`
      }
      context += '\n'
    }
  }

  // Add any additional context passed in
  if (additionalContext) {
    context += additionalContext
  }

  return { context, settings }
}

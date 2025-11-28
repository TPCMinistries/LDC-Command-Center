import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch conversations
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const workspaceId = searchParams.get('workspaceId')
  const includeArchived = searchParams.get('includeArchived') === 'true'

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let query = supabase
    .from('ai_conversations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('is_pinned', { ascending: false })
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (!includeArchived) {
    query = query.eq('is_archived', false)
  }

  const { data: conversations, error } = await query

  if (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }

  return NextResponse.json({ conversations })
}

// POST - Create new conversation
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { workspaceId, title, model, systemPrompt, contextType, contextId } = body

  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: conversation, error } = await supabase
    .from('ai_conversations')
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      title: title || 'New Conversation',
      model: model || 'claude',
      system_prompt: systemPrompt,
      context_type: contextType,
      context_id: contextId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }

  return NextResponse.json({ conversation })
}

// PATCH - Update conversation
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  // Support both camelCase and snake_case
  const {
    conversationId,
    title,
    model,
    isPinned, is_pinned,
    isArchived, is_archived,
    systemPrompt, system_prompt
  } = body

  if (!conversationId) {
    return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title !== undefined) updates.title = title
  if (model !== undefined) updates.model = model
  if (isPinned !== undefined || is_pinned !== undefined) updates.is_pinned = isPinned ?? is_pinned
  if (isArchived !== undefined || is_archived !== undefined) updates.is_archived = isArchived ?? is_archived
  if (systemPrompt !== undefined || system_prompt !== undefined) updates.system_prompt = systemPrompt ?? system_prompt

  const { data: conversation, error } = await supabase
    .from('ai_conversations')
    .update(updates)
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }

  return NextResponse.json({ conversation })
}

// DELETE - Delete conversation
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting conversation:', error)
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

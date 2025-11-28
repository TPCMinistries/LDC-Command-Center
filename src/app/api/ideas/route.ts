import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List ideas for a workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const category = searchParams.get('category')
    const showArchived = searchParams.get('archived') === 'true'
    const favoritesOnly = searchParams.get('favorites') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('ideas')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (!showArchived) {
      query = query.eq('is_archived', false)
    }

    if (favoritesOnly) {
      query = query.eq('is_favorite', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: ideas, error } = await query

    if (error) {
      console.error('Error fetching ideas:', error)
      return NextResponse.json({ error: 'Failed to fetch ideas' }, { status: 500 })
    }

    return NextResponse.json({ ideas })
  } catch (error) {
    console.error('Ideas GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new idea
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, textContent, audioUrl, audioDuration, title, category } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    if (!textContent && !audioUrl) {
      return NextResponse.json({ error: 'Either textContent or audioUrl is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const ideaData = {
      workspace_id: workspaceId,
      user_id: user.id,
      text_content: textContent || null,
      audio_url: audioUrl || null,
      audio_duration_seconds: audioDuration || null,
      title: title || null,
      category: category || 'other',
      status: audioUrl ? 'pending' : (textContent ? 'processing' : 'pending'),
    }

    const { data: idea, error } = await supabase
      .from('ideas')
      .insert(ideaData)
      .select()
      .single()

    if (error) {
      console.error('Error creating idea:', error)
      return NextResponse.json({ error: 'Failed to create idea' }, { status: 500 })
    }

    return NextResponse.json({ idea })
  } catch (error) {
    console.error('Ideas POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update an idea
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { ideaId, workspaceId, ...updates } = body

    if (!ideaId || !workspaceId) {
      return NextResponse.json({ error: 'Missing ideaId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow certain fields to be updated
    const allowedFields = [
      'title', 'summary', 'category', 'tags', 'key_points',
      'action_items', 'is_favorite', 'is_archived', 'status'
    ]
    const filteredUpdates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: idea, error } = await supabase
      .from('ideas')
      .update(filteredUpdates)
      .eq('id', ideaId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating idea:', error)
      return NextResponse.json({ error: 'Failed to update idea' }, { status: 500 })
    }

    return NextResponse.json({ idea })
  } catch (error) {
    console.error('Ideas PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete an idea
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ideaId = searchParams.get('ideaId')
    const workspaceId = searchParams.get('workspaceId')

    if (!ideaId || !workspaceId) {
      return NextResponse.json({ error: 'Missing ideaId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('ideas')
      .delete()
      .eq('id', ideaId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error deleting idea:', error)
      return NextResponse.json({ error: 'Failed to delete idea' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ideas DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

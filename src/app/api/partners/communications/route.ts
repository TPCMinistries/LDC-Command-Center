import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List communications for a partner
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')
    const workspaceId = searchParams.get('workspaceId')
    const rfpId = searchParams.get('rfpId')
    const communicationType = searchParams.get('type')
    const pendingFollowUps = searchParams.get('pendingFollowUps') === 'true'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('partner_communications')
      .select(`
        *,
        partner:partners(id, name),
        rfp:rfp_items(id, title)
      `)
      .eq('workspace_id', workspaceId)
      .order('communication_date', { ascending: false })

    if (partnerId) {
      query = query.eq('partner_id', partnerId)
    }

    if (rfpId) {
      query = query.eq('rfp_id', rfpId)
    }

    if (communicationType && communicationType !== 'all') {
      query = query.eq('communication_type', communicationType)
    }

    if (pendingFollowUps) {
      query = query
        .not('follow_up_date', 'is', null)
        .eq('is_follow_up_complete', false)
    }

    const { data: communications, error } = await query

    if (error) {
      console.error('Error fetching communications:', error)
      return NextResponse.json({ error: 'Failed to fetch communications' }, { status: 500 })
    }

    return NextResponse.json({ communications })
  } catch (error) {
    console.error('Communications GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Log a new communication
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partnerId, workspaceId, ...communicationData } = body

    if (!partnerId || !workspaceId || !communicationData.communication_type) {
      return NextResponse.json(
        { error: 'Missing partnerId, workspaceId, or communication_type' },
        { status: 400 }
      )
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

    const { data: communication, error } = await supabase
      .from('partner_communications')
      .insert({
        partner_id: partnerId,
        workspace_id: workspaceId,
        logged_by: user.id,
        ...communicationData,
      })
      .select(`
        *,
        partner:partners(id, name),
        rfp:rfp_items(id, title)
      `)
      .single()

    if (error) {
      console.error('Error creating communication:', error)
      return NextResponse.json({ error: 'Failed to log communication' }, { status: 500 })
    }

    return NextResponse.json({ communication })
  } catch (error) {
    console.error('Communications POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update a communication (e.g., mark follow-up complete)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { communicationId, workspaceId, ...updates } = body

    if (!communicationId || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing communicationId or workspaceId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Remove fields that shouldn't be directly updated
    delete updates.id
    delete updates.partner_id
    delete updates.workspace_id
    delete updates.created_at
    delete updates.logged_by

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: communication, error } = await supabase
      .from('partner_communications')
      .update(updates)
      .eq('id', communicationId)
      .eq('workspace_id', workspaceId)
      .select(`
        *,
        partner:partners(id, name),
        rfp:rfp_items(id, title)
      `)
      .single()

    if (error) {
      console.error('Error updating communication:', error)
      return NextResponse.json({ error: 'Failed to update communication' }, { status: 500 })
    }

    return NextResponse.json({ communication })
  } catch (error) {
    console.error('Communications PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a communication log
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const communicationId = searchParams.get('communicationId')
    const workspaceId = searchParams.get('workspaceId')

    if (!communicationId || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing communicationId or workspaceId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('partner_communications')
      .delete()
      .eq('id', communicationId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error deleting communication:', error)
      return NextResponse.json({ error: 'Failed to delete communication' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Communications DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

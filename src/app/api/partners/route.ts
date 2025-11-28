import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List partners for a workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status')
    const sector = searchParams.get('sector')
    const fundableOnly = searchParams.get('fundable') === 'true'
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('partners')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (sector && sector !== 'all') {
      query = query.eq('sector', sector)
    }

    if (fundableOnly) {
      query = query.eq('is_fundable', true)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: partners, error } = await query

    if (error) {
      console.error('Error fetching partners:', error)
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    return NextResponse.json({ partners })
  } catch (error) {
    console.error('Partners GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new partner
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, ...partnerData } = body

    if (!workspaceId || !partnerData.name) {
      return NextResponse.json({ error: 'Missing workspaceId or name' }, { status: 400 })
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

    const { data: partner, error } = await supabase
      .from('partners')
      .insert({
        workspace_id: workspaceId,
        added_by: user.id,
        ...partnerData,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating partner:', error)
      return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 })
    }

    return NextResponse.json({ partner })
  } catch (error) {
    console.error('Partners POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update a partner
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { partnerId, workspaceId, ...updates } = body

    if (!partnerId || !workspaceId) {
      return NextResponse.json({ error: 'Missing partnerId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Remove fields that shouldn't be directly updated
    delete updates.id
    delete updates.workspace_id
    delete updates.created_at
    delete updates.added_by

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: partner, error } = await supabase
      .from('partners')
      .update(updates)
      .eq('id', partnerId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating partner:', error)
      return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 })
    }

    return NextResponse.json({ partner })
  } catch (error) {
    console.error('Partners PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a partner
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')
    const workspaceId = searchParams.get('workspaceId')

    if (!partnerId || !workspaceId) {
      return NextResponse.json({ error: 'Missing partnerId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', partnerId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error deleting partner:', error)
      return NextResponse.json({ error: 'Failed to delete partner' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Partners DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

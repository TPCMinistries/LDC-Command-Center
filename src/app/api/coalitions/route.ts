import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List coalition memberships
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const rfpId = searchParams.get('rfpId')
    const partnerId = searchParams.get('partnerId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('coalition_memberships')
      .select(`
        *,
        partner:partners(id, name, sector, status, is_fundable, capacity_overall),
        rfp:rfp_items(id, title, agency, response_deadline, grant_phase)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (rfpId) {
      query = query.eq('rfp_id', rfpId)
    }

    if (partnerId) {
      query = query.eq('partner_id', partnerId)
    }

    const { data: memberships, error } = await query

    if (error) {
      console.error('Error fetching coalitions:', error)
      return NextResponse.json({ error: 'Failed to fetch coalitions' }, { status: 500 })
    }

    return NextResponse.json({ memberships })
  } catch (error) {
    console.error('Coalitions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add partner to coalition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, rfpId, partnerId, ...membershipData } = body

    if (!workspaceId || !partnerId) {
      return NextResponse.json({ error: 'Missing workspaceId or partnerId' }, { status: 400 })
    }

    if (!rfpId && !membershipData.grant_name) {
      return NextResponse.json({ error: 'Must provide rfpId or grant_name' }, { status: 400 })
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

    // Check if this partner is already in this coalition
    if (rfpId) {
      const { data: existing } = await supabase
        .from('coalition_memberships')
        .select('id')
        .eq('rfp_id', rfpId)
        .eq('partner_id', partnerId)
        .single()

      if (existing) {
        return NextResponse.json({ error: 'Partner already in this coalition' }, { status: 409 })
      }
    }

    const { data: coalitionMembership, error } = await supabase
      .from('coalition_memberships')
      .insert({
        workspace_id: workspaceId,
        rfp_id: rfpId,
        partner_id: partnerId,
        ...membershipData,
      })
      .select(`
        *,
        partner:partners(id, name, sector, status, is_fundable, capacity_overall),
        rfp:rfp_items(id, title, agency, response_deadline, grant_phase)
      `)
      .single()

    if (error) {
      console.error('Error creating coalition membership:', error)
      return NextResponse.json({ error: 'Failed to add partner to coalition' }, { status: 500 })
    }

    return NextResponse.json({ membership: coalitionMembership })
  } catch (error) {
    console.error('Coalitions POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update coalition membership
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { membershipId, workspaceId, ...updates } = body

    if (!membershipId || !workspaceId) {
      return NextResponse.json({ error: 'Missing membershipId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Remove fields that shouldn't be directly updated
    delete updates.id
    delete updates.workspace_id
    delete updates.created_at
    delete updates.rfp_id
    delete updates.partner_id

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: membership, error } = await supabase
      .from('coalition_memberships')
      .update(updates)
      .eq('id', membershipId)
      .eq('workspace_id', workspaceId)
      .select(`
        *,
        partner:partners(id, name, sector, status, is_fundable, capacity_overall),
        rfp:rfp_items(id, title, agency, response_deadline, grant_phase)
      `)
      .single()

    if (error) {
      console.error('Error updating coalition membership:', error)
      return NextResponse.json({ error: 'Failed to update coalition membership' }, { status: 500 })
    }

    return NextResponse.json({ membership })
  } catch (error) {
    console.error('Coalitions PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove partner from coalition
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const membershipId = searchParams.get('membershipId')
    const workspaceId = searchParams.get('workspaceId')

    if (!membershipId || !workspaceId) {
      return NextResponse.json({ error: 'Missing membershipId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('coalition_memberships')
      .delete()
      .eq('id', membershipId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error removing from coalition:', error)
      return NextResponse.json({ error: 'Failed to remove from coalition' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Coalitions DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List assessments for a partner
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('partner_assessments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('assessment_date', { ascending: false })

    if (partnerId) {
      query = query.eq('partner_id', partnerId)
    }

    const { data: assessments, error } = await query

    if (error) {
      console.error('Error fetching assessments:', error)
      return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 })
    }

    return NextResponse.json({ assessments })
  } catch (error) {
    console.error('Assessments GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new assessment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partnerId, workspaceId, ...assessmentData } = body

    if (!partnerId || !workspaceId) {
      return NextResponse.json({ error: 'Missing partnerId or workspaceId' }, { status: 400 })
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

    // Verify partner exists in this workspace
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('id', partnerId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const { data: assessment, error } = await supabase
      .from('partner_assessments')
      .insert({
        partner_id: partnerId,
        workspace_id: workspaceId,
        assessor_id: user.id,
        ...assessmentData,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating assessment:', error)
      return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 })
    }

    // The trigger will automatically update the partner's capacity scores

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Assessments POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update an assessment
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { assessmentId, workspaceId, ...updates } = body

    if (!assessmentId || !workspaceId) {
      return NextResponse.json({ error: 'Missing assessmentId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Remove fields that shouldn't be directly updated
    delete updates.id
    delete updates.partner_id
    delete updates.workspace_id
    delete updates.created_at
    delete updates.assessor_id

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: assessment, error } = await supabase
      .from('partner_assessments')
      .update(updates)
      .eq('id', assessmentId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating assessment:', error)
      return NextResponse.json({ error: 'Failed to update assessment' }, { status: 500 })
    }

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Assessments PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove an assessment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assessmentId = searchParams.get('assessmentId')
    const workspaceId = searchParams.get('workspaceId')

    if (!assessmentId || !workspaceId) {
      return NextResponse.json({ error: 'Missing assessmentId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('partner_assessments')
      .delete()
      .eq('id', assessmentId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error deleting assessment:', error)
      return NextResponse.json({ error: 'Failed to delete assessment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Assessments DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

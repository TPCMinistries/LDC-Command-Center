import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST - Create a new RFP (manual entry or from document upload)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      title,
      agency,
      description,
      response_deadline,
      source_type,
      source_url,
      document_url,
      requirements,
      eligibility,
      extracted_requirements,
      custom_sections,
      ...otherFields
    } = body

    if (!workspaceId || !title) {
      return NextResponse.json({ error: 'Missing workspaceId or title' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify workspace access
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: rfp, error } = await adminClient
      .from('rfp_items')
      .insert({
        workspace_id: workspaceId,
        title,
        agency: agency || null,
        description: description || null,
        response_deadline: response_deadline || null,
        source_type: source_type || 'other',
        source_url: source_url || null,
        document_url: document_url || null,
        requirements: requirements || null,
        eligibility: eligibility || null,
        extracted_requirements: extracted_requirements || null,
        custom_sections: custom_sections || null,
        status: 'new',
        ...otherFields,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating RFP:', error)
      return NextResponse.json({ error: 'Failed to create RFP' }, { status: 500 })
    }

    return NextResponse.json({ rfp })
  } catch (error) {
    console.error('RFP POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - List tracked RFPs for a workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('rfp_items')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: rfps, error } = await query

    if (error) {
      console.error('Error fetching RFPs:', error)
      return NextResponse.json({ error: 'Failed to fetch RFPs' }, { status: 500 })
    }

    return NextResponse.json({ rfps })
  } catch (error) {
    console.error('RFP GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update an RFP
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { rfpId, workspaceId, ...updates } = body

    if (!rfpId || !workspaceId) {
      return NextResponse.json({ error: 'Missing rfpId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Only allow certain fields to be updated
    const allowedFields = [
      'status', 'assigned_to', 'notes', 'internal_deadline',
      'alignment_score', 'alignment_reasons', 'requirements', 'eligibility'
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

    const { data: rfp, error } = await supabase
      .from('rfp_items')
      .update(filteredUpdates)
      .eq('id', rfpId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating RFP:', error)
      return NextResponse.json({ error: 'Failed to update RFP' }, { status: 500 })
    }

    return NextResponse.json({ rfp })
  } catch (error) {
    console.error('RFP PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove an RFP from tracking
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rfpId = searchParams.get('rfpId')
    const workspaceId = searchParams.get('workspaceId')

    if (!rfpId || !workspaceId) {
      return NextResponse.json({ error: 'Missing rfpId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('rfp_items')
      .delete()
      .eq('id', rfpId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error deleting RFP:', error)
      return NextResponse.json({ error: 'Failed to delete RFP' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('RFP DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Helper to verify proposal access
async function verifyProposalAccess(supabase: Awaited<ReturnType<typeof createClient>>, proposalId: string, userId: string) {
  // Get the proposal to find workspace_id
  const adminClient = createAdminClient()
  const { data: proposal } = await adminClient
    .from('proposals')
    .select('workspace_id')
    .eq('id', proposalId)
    .single()

  if (!proposal) return false

  // Check workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', proposal.workspace_id)
    .eq('user_id', userId)
    .single()

  return !!membership
}

// GET - Get sections for a proposal
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const proposalId = searchParams.get('proposalId')

    if (!proposalId) {
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyProposalAccess(supabase, proposalId, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: sections, error } = await adminClient
      .from('proposal_sections')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching sections:', error)
      return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 })
    }

    return NextResponse.json({ sections })
  } catch (error) {
    console.error('Sections GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add a new section to a proposal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { proposalId, ...sectionData } = body

    if (!proposalId || !sectionData.section_type || !sectionData.title) {
      return NextResponse.json(
        { error: 'Missing proposalId, section_type, or title' },
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

    const hasAccess = await verifyProposalAccess(supabase, proposalId, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Get max sort_order
    const { data: maxSection } = await adminClient
      .from('proposal_sections')
      .select('sort_order')
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const { data: section, error } = await adminClient
      .from('proposal_sections')
      .insert({
        proposal_id: proposalId,
        sort_order: (maxSection?.sort_order || 0) + 1,
        last_edited_by: user.id,
        ...sectionData,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating section:', error)
      return NextResponse.json({ error: 'Failed to create section' }, { status: 500 })
    }

    return NextResponse.json({ section })
  } catch (error) {
    console.error('Sections POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update a section
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { sectionId, proposalId, ...updates } = body

    if (!sectionId) {
      return NextResponse.json({ error: 'Missing sectionId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get the section to find its proposal
    const { data: existingSection } = await adminClient
      .from('proposal_sections')
      .select('proposal_id')
      .eq('id', sectionId)
      .single()

    if (!existingSection) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    const hasAccess = await verifyProposalAccess(supabase, existingSection.proposal_id, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Remove fields that shouldn't be directly updated
    delete updates.id
    delete updates.proposal_id
    delete updates.created_at

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.last_edited_by = user.id

    const { data: section, error } = await adminClient
      .from('proposal_sections')
      .update(updates)
      .eq('id', sectionId)
      .select()
      .single()

    if (error) {
      console.error('Error updating section:', error)
      return NextResponse.json({ error: 'Failed to update section' }, { status: 500 })
    }

    // Also update the parent proposal's updated_at
    if (section) {
      await adminClient
        .from('proposals')
        .update({ last_edited_by: user.id })
        .eq('id', section.proposal_id)
    }

    return NextResponse.json({ section })
  } catch (error) {
    console.error('Sections PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a section
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')

    if (!sectionId) {
      return NextResponse.json({ error: 'Missing sectionId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get the section to verify access
    const { data: existingSection } = await adminClient
      .from('proposal_sections')
      .select('proposal_id')
      .eq('id', sectionId)
      .single()

    if (!existingSection) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    const hasAccess = await verifyProposalAccess(supabase, existingSection.proposal_id, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { error } = await adminClient
      .from('proposal_sections')
      .delete()
      .eq('id', sectionId)

    if (error) {
      console.error('Error deleting section:', error)
      return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sections DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

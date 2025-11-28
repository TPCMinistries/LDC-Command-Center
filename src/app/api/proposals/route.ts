import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Default template sections (must match templates route)
const DEFAULT_TEMPLATES: Record<string, {
  name: string
  category: string
  sections: Array<{
    section_type: string
    title: string
    word_limit?: number
    required?: boolean
  }>
}> = {
  federal: {
    name: 'Federal Grant Template',
    category: 'federal',
    sections: [
      { section_type: 'cover_letter', title: 'Cover Letter', word_limit: 500, required: true },
      { section_type: 'executive_summary', title: 'Executive Summary', word_limit: 1000, required: true },
      { section_type: 'organizational_background', title: 'Organizational Capability', word_limit: 1500, required: true },
      { section_type: 'statement_of_need', title: 'Statement of Need', word_limit: 2000, required: true },
      { section_type: 'program_design', title: 'Project Design & Implementation', word_limit: 3000, required: true },
      { section_type: 'theory_of_change', title: 'Theory of Change', word_limit: 1000, required: false },
      { section_type: 'logic_model', title: 'Logic Model', required: true },
      { section_type: 'staffing_plan', title: 'Staffing Plan', word_limit: 1500, required: true },
      { section_type: 'evaluation_plan', title: 'Evaluation Plan', word_limit: 2000, required: true },
      { section_type: 'sustainability_plan', title: 'Sustainability Plan', word_limit: 1000, required: true },
      { section_type: 'budget_narrative', title: 'Budget Narrative', word_limit: 2000, required: true },
      { section_type: 'budget', title: 'Budget', required: true },
      { section_type: 'timeline', title: 'Project Timeline', required: true },
    ],
  },
  city: {
    name: 'NYC City Agency Template (DYCD/DOE/HHS)',
    category: 'city',
    sections: [
      { section_type: 'executive_summary', title: 'Executive Summary', word_limit: 750, required: true },
      { section_type: 'organizational_background', title: 'Organizational Background & Experience', word_limit: 1500, required: true },
      { section_type: 'statement_of_need', title: 'Need Statement', word_limit: 1000, required: true },
      { section_type: 'program_design', title: 'Program Description', word_limit: 2500, required: true },
      { section_type: 'implementation_plan', title: 'Implementation Plan', word_limit: 1500, required: true },
      { section_type: 'staffing_plan', title: 'Staffing & Management', word_limit: 1000, required: true },
      { section_type: 'evaluation_plan', title: 'Outcomes & Evaluation', word_limit: 1000, required: true },
      { section_type: 'budget_narrative', title: 'Budget Justification', word_limit: 1500, required: true },
      { section_type: 'budget', title: 'Line Item Budget', required: true },
    ],
  },
  foundation: {
    name: 'Foundation Grant Template',
    category: 'foundation',
    sections: [
      { section_type: 'cover_letter', title: 'Cover Letter', word_limit: 500, required: true },
      { section_type: 'executive_summary', title: 'Project Summary', word_limit: 500, required: true },
      { section_type: 'organizational_background', title: 'About Our Organization', word_limit: 1000, required: true },
      { section_type: 'statement_of_need', title: 'The Challenge We Address', word_limit: 1000, required: true },
      { section_type: 'program_design', title: 'Our Approach', word_limit: 1500, required: true },
      { section_type: 'evaluation_plan', title: 'How We Measure Success', word_limit: 750, required: true },
      { section_type: 'budget_narrative', title: 'Use of Funds', word_limit: 500, required: true },
      { section_type: 'sustainability_plan', title: 'Sustainability', word_limit: 500, required: false },
    ],
  },
  general: {
    name: 'General Proposal Template',
    category: 'general',
    sections: [
      { section_type: 'executive_summary', title: 'Executive Summary', word_limit: 1000, required: true },
      { section_type: 'organizational_background', title: 'Organizational Background', word_limit: 1500, required: true },
      { section_type: 'statement_of_need', title: 'Statement of Need', word_limit: 1500, required: true },
      { section_type: 'program_design', title: 'Program Design', word_limit: 2000, required: true },
      { section_type: 'implementation_plan', title: 'Implementation Plan', word_limit: 1500, required: true },
      { section_type: 'evaluation_plan', title: 'Evaluation Plan', word_limit: 1000, required: true },
      { section_type: 'budget_narrative', title: 'Budget Narrative', word_limit: 1000, required: true },
    ],
  },
}

// GET - List proposals for a workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const rfpId = searchParams.get('rfpId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('proposals')
      .select(`
        *,
        rfp:rfp_items(id, title, agency, response_deadline),
        template:proposal_templates(id, name, category),
        sections:proposal_sections(id, section_type, title, is_complete, word_count, word_limit)
      `)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (rfpId) {
      query = query.eq('rfp_id', rfpId)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: proposals, error } = await query

    if (error) {
      console.error('Error fetching proposals:', error)
      return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 })
    }

    return NextResponse.json({ proposals })
  } catch (error) {
    console.error('Proposals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new proposal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workspaceId,
      templateId,
      rfpId,
      title,
      funder_name,
      grant_program,
      requested_amount,
      target_deadline,
      target_population,
      service_area,
      status,
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

    // Use admin client for all database operations after auth
    const adminClient = createAdminClient()

    // Verify user has access to workspace - check if workspace exists and user can see it
    // This matches how the page component checks access
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      console.error('Workspace not found or access denied:', wsError)
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 })
    }

    // Build insert data with only valid fields
    const insertData: Record<string, unknown> = {
      workspace_id: workspaceId,
      rfp_id: rfpId || null,
      template_id: templateId?.startsWith('default-') ? null : (templateId || null),
      created_by: user.id,
      last_edited_by: user.id,
      title,
    }

    // Add optional fields if provided
    if (funder_name) insertData.funder_name = funder_name
    if (grant_program) insertData.grant_program = grant_program
    if (requested_amount) insertData.requested_amount = requested_amount
    if (target_deadline) insertData.target_deadline = target_deadline
    if (target_population) insertData.target_population = target_population
    if (service_area) insertData.service_area = service_area
    if (status) insertData.status = status

    // Create the proposal
    const { data: proposal, error } = await adminClient
      .from('proposals')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('=== PROPOSAL CREATION ERROR ===')
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      console.error('Full error:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: error.message || 'Failed to create proposal' }, { status: 500 })
    }

    // Create sections based on template type
    let sectionsToInsert: Array<{
      proposal_id: string
      section_type: string
      title: string
      sort_order: number
      word_limit?: number | null
      content?: string
    }> = []

    // Check if using a default template (e.g., "default-city")
    if (templateId && templateId.startsWith('default-')) {
      const templateType = templateId.replace('default-', '') as keyof typeof DEFAULT_TEMPLATES
      const defaultTemplate = DEFAULT_TEMPLATES[templateType]

      if (defaultTemplate?.sections) {
        sectionsToInsert = defaultTemplate.sections.map((section, index) => ({
          proposal_id: proposal.id,
          section_type: section.section_type,
          title: section.title,
          sort_order: index,
          word_limit: section.word_limit || null,
          content: '',
        }))
      }
    }
    // Check if using a custom template from the database
    else if (templateId) {
      const { data: template } = await adminClient
        .from('proposal_templates')
        .select('sections, boilerplate')
        .eq('id', templateId)
        .single()

      if (template?.sections && Array.isArray(template.sections)) {
        sectionsToInsert = template.sections.map((section: {
          section_type: string
          title: string
          word_limit?: number
          guidance?: string
        }, index: number) => ({
          proposal_id: proposal.id,
          section_type: section.section_type,
          title: section.title,
          sort_order: index,
          word_limit: section.word_limit || null,
          content: template.boilerplate?.[section.section_type] || '',
        }))
      }
    }

    // Fallback to general template if no sections created
    if (sectionsToInsert.length === 0) {
      const generalTemplate = DEFAULT_TEMPLATES.general
      sectionsToInsert = generalTemplate.sections.map((section, index) => ({
        proposal_id: proposal.id,
        section_type: section.section_type,
        title: section.title,
        sort_order: index,
        word_limit: section.word_limit || null,
        content: '',
      }))
    }

    // Insert all sections
    const { error: sectionsError } = await adminClient.from('proposal_sections').insert(sectionsToInsert)
    if (sectionsError) {
      console.error('Error creating sections:', sectionsError)
    }

    // Fetch the complete proposal with sections
    const { data: completeProposal } = await adminClient
      .from('proposals')
      .select(`
        *,
        sections:proposal_sections(*)
      `)
      .eq('id', proposal.id)
      .single()

    return NextResponse.json({ proposal: completeProposal })
  } catch (error) {
    console.error('Proposals POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update a proposal
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { proposalId, workspaceId, ...updates } = body

    if (!proposalId || !workspaceId) {
      return NextResponse.json({ error: 'Missing proposalId or workspaceId' }, { status: 400 })
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

    // Verify user has access to workspace
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 })
    }

    // Remove fields that shouldn't be directly updated
    delete updates.id
    delete updates.workspace_id
    delete updates.created_at
    delete updates.created_by

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.last_edited_by = user.id

    const { data: proposal, error } = await adminClient
      .from('proposals')
      .update(updates)
      .eq('id', proposalId)
      .eq('workspace_id', workspaceId)
      .select(`
        *,
        sections:proposal_sections(*)
      `)
      .single()

    if (error) {
      console.error('Error updating proposal:', error)
      return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
    }

    return NextResponse.json({ proposal })
  } catch (error) {
    console.error('Proposals PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a proposal
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const proposalId = searchParams.get('proposalId')
    const workspaceId = searchParams.get('workspaceId')

    if (!proposalId || !workspaceId) {
      return NextResponse.json({ error: 'Missing proposalId or workspaceId' }, { status: 400 })
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

    // Verify user has access to workspace
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 })
    }

    // Sections will cascade delete
    const { error } = await adminClient
      .from('proposals')
      .delete()
      .eq('id', proposalId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error deleting proposal:', error)
      return NextResponse.json({ error: 'Failed to delete proposal' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Proposals DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

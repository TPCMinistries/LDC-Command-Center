import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Default template sections for different grant types
const DEFAULT_TEMPLATES = {
  federal: {
    name: 'Federal Grant Template',
    category: 'federal',
    description: 'Standard template for federal grant applications',
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
    description: 'Template for NYC agency RFPs (DYCD, DOE, HHS, etc.)',
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
    description: 'Template for private foundation grant applications',
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
    description: 'Flexible template for various grant types',
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

// GET - List templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const category = searchParams.get('category')
    const includeDefaults = searchParams.get('includeDefaults') !== 'false'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    let query = adminClient
      .from('proposal_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const { data: templates, error } = await query

    if (error) {
      console.error('Error fetching templates:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    // Add default templates if requested and none exist
    let result = templates || []
    if (includeDefaults && result.length === 0) {
      result = Object.values(DEFAULT_TEMPLATES).map((t) => ({
        id: `default-${t.category}`,
        ...t,
        is_default: true,
        workspace_id: workspaceId,
      }))
    }

    return NextResponse.json({ templates: result, defaults: DEFAULT_TEMPLATES })
  } catch (error) {
    console.error('Templates GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a custom template or clone a default
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, cloneDefault, ...templateData } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    let insertData = {
      workspace_id: workspaceId,
      created_by: user.id,
      ...templateData,
    }

    // If cloning a default template
    if (cloneDefault && DEFAULT_TEMPLATES[cloneDefault as keyof typeof DEFAULT_TEMPLATES]) {
      const defaultTemplate = DEFAULT_TEMPLATES[cloneDefault as keyof typeof DEFAULT_TEMPLATES]
      insertData = {
        ...insertData,
        name: templateData.name || `${defaultTemplate.name} (Custom)`,
        category: defaultTemplate.category,
        description: defaultTemplate.description,
        sections: defaultTemplate.sections,
      }
    }

    const { data: template, error } = await adminClient
      .from('proposal_templates')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating template:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Templates POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update a template
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateId, workspaceId, ...updates } = body

    if (!templateId || !workspaceId) {
      return NextResponse.json({ error: 'Missing templateId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    delete updates.id
    delete updates.workspace_id
    delete updates.created_at
    delete updates.created_by

    const { data: template, error } = await adminClient
      .from('proposal_templates')
      .update(updates)
      .eq('id', templateId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Templates PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')
    const workspaceId = searchParams.get('workspaceId')

    if (!templateId || !workspaceId) {
      return NextResponse.json({ error: 'Missing templateId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('proposal_templates')
      .delete()
      .eq('id', templateId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Templates DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

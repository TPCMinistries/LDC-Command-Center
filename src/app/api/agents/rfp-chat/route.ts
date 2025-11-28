import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// POST - Chat about an RFP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rfpId, workspaceId, message, conversationHistory = [] } = body

    if (!workspaceId || !rfpId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Verify workspace access
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name, branding')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Get RFP data
    const { data: rfp, error: rfpError } = await adminClient
      .from('rfp_items')
      .select('*')
      .eq('id', rfpId)
      .single()

    if (rfpError || !rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
    }

    // Build comprehensive RFP context
    const rfpContext = `
## RFP Details
Title: ${rfp.title}
Agency: ${rfp.agency || 'Not specified'}
Source Type: ${rfp.source_type || 'Not specified'}
Response Deadline: ${rfp.response_deadline || 'Not specified'}

## Description
${rfp.description || 'No description available'}

## Requirements
${rfp.requirements ? JSON.stringify(rfp.requirements, null, 2) : 'None specified'}

## Eligibility
${rfp.eligibility ? JSON.stringify(rfp.eligibility, null, 2) : 'None specified'}

## AI-Extracted Analysis
${rfp.extracted_requirements ? JSON.stringify(rfp.extracted_requirements, null, 2) : 'Not yet analyzed'}
    `.trim()

    // Build organization context
    const orgContext = workspace.branding
      ? `
## Your Organization
Name: ${workspace.name}
Mission: ${(workspace.branding as Record<string, unknown>)?.mission || 'Not specified'}
Services: ${JSON.stringify((workspace.branding as Record<string, unknown>)?.services || [])}
Target Population: ${(workspace.branding as Record<string, unknown>)?.target_population || 'Not specified'}
Geographic Focus: ${(workspace.branding as Record<string, unknown>)?.geographic_focus || 'Not specified'}
      `.trim()
      : `## Your Organization\nName: ${workspace.name}`

    // Build conversation messages
    const messages: Anthropic.Messages.MessageParam[] = [
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ]

    // AI Chat
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are an expert grant writing consultant helping a nonprofit understand and respond to an RFP.

${rfpContext}

${orgContext}

Your role is to:
1. Answer specific questions about this RFP
2. Help identify what's required for a successful proposal
3. Point out potential challenges and opportunities
4. Provide strategic advice based on the org's fit
5. Be specific and reference the actual RFP content when possible

When answering:
- Be concise but thorough
- Quote specific requirements when relevant
- Suggest how the organization could address requirements
- Flag any concerns or gaps honestly
- Provide actionable recommendations`,
      messages,
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    return NextResponse.json({
      response: content.text,
      rfpId,
    })
  } catch (error) {
    console.error('RFP chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface ExtractedRequirements {
  summary: string
  fundingAmount?: {
    min?: number
    max?: number
    description: string
  }
  eligibility: Array<{
    requirement: string
    isMet?: boolean
    notes?: string
  }>
  evaluationCriteria: Array<{
    criterion: string
    weight?: number
    description: string
  }>
  requiredSections: Array<{
    name: string
    wordLimit?: number
    pageLimit?: number
    description?: string
  }>
  keyDates: Array<{
    event: string
    date: string
    isDeadline?: boolean
  }>
  complianceChecklist: Array<{
    item: string
    category: 'eligibility' | 'content' | 'format' | 'submission'
    required: boolean
  }>
  specialRequirements: string[]
  fitAssessment?: {
    score: number
    strengths: string[]
    gaps: string[]
    recommendations: string[]
  }
}

// POST - Analyze an RFP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rfpId, workspaceId, rfpContent } = body

    if (!workspaceId || (!rfpId && !rfpContent)) {
      return NextResponse.json(
        { error: 'Missing workspaceId or RFP data' },
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

    // Get RFP data if rfpId provided
    let rfpData = null
    if (rfpId) {
      const { data } = await adminClient
        .from('rfp_items')
        .select('*')
        .eq('id', rfpId)
        .single()
      rfpData = data
    }

    // Build the RFP content for analysis
    const contentToAnalyze = rfpContent || `
Title: ${rfpData?.title || 'Unknown'}
Agency: ${rfpData?.agency || 'Unknown'}
Description: ${rfpData?.description || 'No description'}
Response Deadline: ${rfpData?.response_deadline || 'Not specified'}
Requirements: ${JSON.stringify(rfpData?.requirements || [])}
Eligibility: ${JSON.stringify(rfpData?.eligibility || {})}
    `.trim()

    // Get workspace context for fit assessment
    const workspaceContext = workspace.branding
      ? `
Organization: ${workspace.name}
Mission: ${(workspace.branding as Record<string, unknown>)?.mission || 'Not specified'}
Services: ${JSON.stringify((workspace.branding as Record<string, unknown>)?.services || [])}
Experience: ${(workspace.branding as Record<string, unknown>)?.years_established || 'Not specified'} years
      `.trim()
      : `Organization: ${workspace.name}`

    // AI Analysis
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `You are an expert grant writing consultant. Analyze this RFP (Request for Proposal) and extract structured information to help a nonprofit prepare their proposal.

## RFP Content
${contentToAnalyze}

## Organization Context (for fit assessment)
${workspaceContext}

Provide a comprehensive analysis in the following JSON format:

{
  "summary": "A 2-3 sentence summary of what this RFP is seeking",
  "fundingAmount": {
    "min": null or number,
    "max": null or number,
    "description": "Description of funding (e.g., 'Up to $500,000 over 3 years')"
  },
  "eligibility": [
    {
      "requirement": "Specific eligibility requirement",
      "isMet": true/false/null based on org context,
      "notes": "How the org meets or could meet this"
    }
  ],
  "evaluationCriteria": [
    {
      "criterion": "Name of criterion",
      "weight": number or null (percentage if specified),
      "description": "What reviewers are looking for"
    }
  ],
  "requiredSections": [
    {
      "name": "Section name",
      "wordLimit": number or null,
      "pageLimit": number or null,
      "description": "What should be included"
    }
  ],
  "keyDates": [
    {
      "event": "Event description",
      "date": "Date string",
      "isDeadline": true/false
    }
  ],
  "complianceChecklist": [
    {
      "item": "Checklist item",
      "category": "eligibility" | "content" | "format" | "submission",
      "required": true/false
    }
  ],
  "specialRequirements": ["Any special requirements or notes"],
  "fitAssessment": {
    "score": 0-100,
    "strengths": ["Organizational strengths for this RFP"],
    "gaps": ["Areas where org may need to address gaps"],
    "recommendations": ["Specific recommendations for proposal strategy"]
  }
}

Only output valid JSON. Be thorough and specific.`,
        },
      ],
    })

    // Parse the response
    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    let analysis: ExtractedRequirements
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found')
      }
    } catch (parseError) {
      console.error('Parse error:', parseError)
      // Return basic structure on parse error
      analysis = {
        summary: 'Analysis could not be completed. Please review the RFP manually.',
        eligibility: [],
        evaluationCriteria: [],
        requiredSections: [],
        keyDates: [],
        complianceChecklist: [],
        specialRequirements: [],
      }
    }

    // Save analysis to RFP if rfpId provided
    if (rfpId && rfpData) {
      await adminClient
        .from('rfp_items')
        .update({
          extracted_requirements: analysis,
          alignment_score: analysis.fitAssessment?.score || null,
          alignment_reasons: analysis.fitAssessment?.strengths || [],
        })
        .eq('id', rfpId)
    }

    return NextResponse.json({
      analysis,
      rfpId,
    })
  } catch (error) {
    console.error('RFP analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze RFP' },
      { status: 500 }
    )
  }
}

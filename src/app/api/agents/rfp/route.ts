import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrandProfile, generateBrandContext } from '@/types/brand'

const RFP_ANALYSIS_PROMPT = `You are an expert RFP (Request for Proposal) analyst helping organizations evaluate government contracting opportunities. Analyze the provided RFP information and extract key details.

Given an RFP title, description, and metadata, provide:

1. **Summary**: A 2-3 sentence executive summary of what this opportunity is about
2. **Requirements**: List the key requirements/qualifications needed
3. **Eligibility**: Who can apply (small business set-asides, certifications needed, etc.)
4. **Scope of Work**: What work needs to be performed
5. **Key Dates**: Important deadlines to note
6. **Estimated Level of Effort**: Small (<$100K), Medium ($100K-$500K), Large (>$500K) based on scope
7. **Skills/Capabilities Needed**: What expertise is required
8. **Potential Risks**: Red flags or concerns to consider
9. **Recommendation**: Should this org pursue this? Why/why not?

Format your response as JSON:
{
  "summary": "...",
  "requirements": ["..."],
  "eligibility": {
    "business_size": "...",
    "certifications_required": ["..."],
    "other_requirements": ["..."]
  },
  "scope_of_work": ["..."],
  "key_dates": [{"event": "...", "date": "..."}],
  "estimated_value": "small|medium|large",
  "skills_needed": ["..."],
  "potential_risks": ["..."],
  "alignment_score": 1-100,
  "alignment_reasons": ["..."],
  "recommendation": "pursue|consider|skip",
  "recommendation_reasoning": "..."
}`

const PROPOSAL_OUTLINE_PROMPT = `You are an expert proposal writer helping create winning government proposals. Based on the RFP analysis and organization context, create a proposal outline.

Include:
1. **Executive Summary** outline
2. **Technical Approach** structure
3. **Management Approach** structure
4. **Past Performance** suggestions
5. **Key Personnel** roles needed
6. **Compliance Matrix** - how to address each requirement

Format as structured JSON.`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { rfpId, workspaceId, action, rfpData } = await request.json()

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const supabase = createAdminClient()

    // Get workspace branding/capabilities for context
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('branding, name, description')
      .eq('id', workspaceId)
      .single()

    let orgContext = ''
    if (workspace) {
      orgContext = `Organization: ${workspace.name}\n`
      if (workspace.description) {
        orgContext += `Description: ${workspace.description}\n`
      }
      if (workspace.branding) {
        orgContext += generateBrandContext(workspace.branding as BrandProfile)
      }
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    if (action === 'analyze') {
      // Analyze an RFP
      let rfp = rfpData

      // If rfpId provided, fetch from database
      if (rfpId) {
        const { data: dbRfp, error: rfpError } = await supabase
          .from('rfp_items')
          .select('*')
          .eq('id', rfpId)
          .eq('workspace_id', workspaceId)
          .single()

        if (rfpError || !dbRfp) {
          return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
        }
        rfp = dbRfp
      }

      if (!rfp) {
        return NextResponse.json({ error: 'No RFP data provided' }, { status: 400 })
      }

      const systemPrompt = RFP_ANALYSIS_PROMPT + (orgContext ? `\n\n**Organization Context** (use this to assess alignment):\n${orgContext}` : '')

      const rfpContent = `
RFP Title: ${rfp.title}
Agency: ${rfp.agency || 'Not specified'}
Description: ${rfp.description || 'No description available'}
Notice Type: ${rfp.notice_type || rfp.type || 'Not specified'}
Set-Aside: ${rfp.set_aside || rfp.setAside || 'None'}
NAICS Code: ${rfp.naics_code || rfp.naicsCode || 'Not specified'}
Posted Date: ${rfp.posted_date || rfp.postedDate || 'Not specified'}
Due Date: ${rfp.response_deadline || rfp.dueDate || 'Not specified'}
Source URL: ${rfp.source_url || rfp.sourceUrl || 'Not available'}
`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Analyze this RFP opportunity:\n${rfpContent}`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

      // Parse JSON response
      let analysis
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch {
        return NextResponse.json({ error: 'Failed to parse analysis', raw: responseText }, { status: 500 })
      }

      const durationMs = Date.now() - startTime

      // If we have an rfpId, update the database
      if (rfpId) {
        await supabase
          .from('rfp_items')
          .update({
            requirements: analysis.requirements,
            eligibility: analysis.eligibility,
            alignment_score: analysis.alignment_score,
            alignment_reasons: analysis.alignment_reasons,
          })
          .eq('id', rfpId)
      }

      // Log agent activity
      await supabase.from('agent_logs').insert({
        workspace_id: workspaceId,
        agent_type: 'rfp',
        action: 'analyze',
        input_summary: `Analyzed RFP: ${rfp.title?.slice(0, 50)}`,
        output_summary: `Score: ${analysis.alignment_score}, Recommendation: ${analysis.recommendation}`,
        tokens_used: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
        duration_ms: durationMs,
        status: 'success',
        metadata: { rfp_id: rfpId },
      })

      return NextResponse.json({
        success: true,
        analysis,
        rfpId,
      })

    } else if (action === 'outline') {
      // Generate proposal outline
      if (!rfpId) {
        return NextResponse.json({ error: 'rfpId required for outline generation' }, { status: 400 })
      }

      const { data: rfp, error: rfpError } = await supabase
        .from('rfp_items')
        .select('*')
        .eq('id', rfpId)
        .eq('workspace_id', workspaceId)
        .single()

      if (rfpError || !rfp) {
        return NextResponse.json({ error: 'RFP not found' }, { status: 404 })
      }

      const systemPrompt = PROPOSAL_OUTLINE_PROMPT + (orgContext ? `\n\n**Organization Context**:\n${orgContext}` : '')

      const rfpContent = `
RFP Title: ${rfp.title}
Agency: ${rfp.agency || 'Not specified'}
Description: ${rfp.description || 'No description'}
Requirements: ${JSON.stringify(rfp.requirements || [])}
Eligibility: ${JSON.stringify(rfp.eligibility || {})}
`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Create a proposal outline for this RFP:\n${rfpContent}`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

      let outline
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          outline = JSON.parse(jsonMatch[0])
        } else {
          outline = { raw: responseText }
        }
      } catch {
        outline = { raw: responseText }
      }

      const durationMs = Date.now() - startTime

      // Log agent activity
      await supabase.from('agent_logs').insert({
        workspace_id: workspaceId,
        agent_type: 'rfp',
        action: 'outline',
        input_summary: `Generated outline for: ${rfp.title?.slice(0, 50)}`,
        output_summary: 'Proposal outline created',
        tokens_used: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
        duration_ms: durationMs,
        status: 'success',
        metadata: { rfp_id: rfpId },
      })

      return NextResponse.json({
        success: true,
        outline,
        rfpId,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('RFP agent error:', error)
    return NextResponse.json(
      { error: 'Failed to process RFP', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

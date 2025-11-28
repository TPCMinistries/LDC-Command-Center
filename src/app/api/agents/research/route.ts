import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrandProfile } from '@/types/brand'
import { format } from 'date-fns'

/**
 * Research Agent
 *
 * An autonomous agent that proactively:
 * - Searches for grant opportunities matching organization profile
 * - Monitors funding news and trends
 * - Identifies potential funders and partners
 * - Gathers competitive intelligence
 * - Saves findings for user review
 */

const RESEARCH_AGENT_SYSTEM = `You are an autonomous research agent specializing in nonprofit funding opportunities. Your job is to:

1. Analyze grant opportunities for fit with the organization
2. Identify promising funders based on mission alignment
3. Gather competitive intelligence about similar organizations
4. Surface funding trends and opportunities
5. Provide actionable research summaries

When analyzing opportunities, consider:
- Mission alignment
- Funding amount vs. effort required
- Eligibility requirements
- Track record with similar grants
- Geographic and programmatic fit
- Deadline feasibility

Your output should be practical and actionable. Don't just report information - provide analysis and recommendations.

Respond in JSON format with:
{
  "findings": [
    {
      "type": "grant_opportunity|funder_intel|competitive|trend",
      "title": "Clear title",
      "summary": "2-3 sentence summary",
      "relevance_score": 0.0-1.0,
      "recommendation": "pursue|monitor|skip",
      "data": { ... additional structured data ... }
    }
  ],
  "actions": [
    {
      "type": "action_type",
      "params": { ... },
      "reason": "Why take this action"
    }
  ],
  "summary": "Overall research summary"
}`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { workspaceId, action, query, sources } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const supabase = createAdminClient()

    // Get workspace context
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, description, branding')
      .eq('id', workspaceId)
      .single()

    let orgContext = ''
    if (workspace) {
      orgContext = `Organization: ${workspace.name}\n`
      if (workspace.description) orgContext += `Description: ${workspace.description}\n`
      if (workspace.branding) {
        const branding = workspace.branding as BrandProfile
        if (branding.identity?.mission) orgContext += `Mission: ${branding.identity.mission}\n`
        if (branding.audience?.primary) orgContext += `Target Audience: ${branding.audience.primary}\n`
        if (branding.messaging?.key_themes) orgContext += `Focus Areas: ${branding.messaging.key_themes.join(', ')}\n`
      }
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    let responseContent: {
      findings: Array<{
        type: string
        title: string
        summary: string
        relevance_score: number
        recommendation: string
        data: Record<string, unknown>
      }>
      actions: Array<{
        type: string
        params: Record<string, unknown>
        reason: string
      }>
      summary: string
    }

    if (action === 'scan_opportunities') {
      // Scan for new grant opportunities (would integrate with real APIs)
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: RESEARCH_AGENT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Research grant opportunities for this organization:

${orgContext}

Search Focus: ${query || 'General funding opportunities aligned with mission'}

Note: In a production system, I would search real grant databases. For now, provide analysis of what types of opportunities to look for, potential funders to research, and how to approach the search.

Provide findings with relevance scores and recommendations.`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      responseContent = parseResearchResponse(responseText)

    } else if (action === 'analyze_funder') {
      // Analyze a specific funder
      const { funderName, funderUrl } = body

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: RESEARCH_AGENT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Analyze this funder for potential fit:

Funder: ${funderName}
${funderUrl ? `Website: ${funderUrl}` : ''}

Organization Context:
${orgContext}

Provide:
1. Funder profile (typical grants, focus areas, giving patterns)
2. Fit assessment with our organization
3. Best approach for cultivation
4. Similar funders to consider
5. Recommended next steps`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      responseContent = parseResearchResponse(responseText)

    } else if (action === 'competitive_analysis') {
      // Analyze similar organizations
      const { competitors } = body

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: RESEARCH_AGENT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Conduct competitive intelligence analysis:

Our Organization:
${orgContext}

${competitors ? `Organizations to analyze: ${competitors.join(', ')}` : 'Identify and analyze similar organizations in our space.'}

Provide:
1. Key competitors/peers and their positioning
2. Funding sources they use that we should consider
3. Program models worth studying
4. Differentiation opportunities for us
5. Partnership possibilities`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      responseContent = parseResearchResponse(responseText)

    } else if (action === 'trend_analysis') {
      // Analyze funding trends
      const { sector } = body

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: RESEARCH_AGENT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Analyze funding trends relevant to this organization:

${orgContext}

${sector ? `Sector focus: ${sector}` : ''}

Provide:
1. Current funding trends in our sector
2. Emerging opportunities
3. Declining funding areas to avoid
4. Government funding outlook
5. Foundation giving patterns
6. Corporate philanthropy trends
7. Strategic recommendations for positioning`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      responseContent = parseResearchResponse(responseText)

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const durationMs = Date.now() - startTime

    // Save findings to database
    for (const finding of responseContent.findings) {
      await supabase.from('agent_research').insert({
        workspace_id: workspaceId,
        topic: query || action,
        finding_type: finding.type,
        title: finding.title,
        summary: finding.summary,
        relevance_score: finding.relevance_score,
        data: finding.data,
        status: finding.recommendation === 'pursue' ? 'actionable' : 'new',
      })
    }

    // Execute any recommended actions
    if (responseContent.actions && responseContent.actions.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      await fetch(`${baseUrl}/api/agents/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          agentType: 'research',
          actions: responseContent.actions,
        }),
      })
    }

    // Log agent activity
    await supabase.from('agent_logs').insert({
      workspace_id: workspaceId,
      agent_type: 'research',
      action,
      input_summary: query || action,
      output_summary: `Found ${responseContent.findings.length} findings`,
      duration_ms: durationMs,
      status: 'success',
      metadata: { findings_count: responseContent.findings.length },
    })

    return NextResponse.json({
      success: true,
      findings: responseContent.findings,
      actions: responseContent.actions,
      summary: responseContent.summary,
      durationMs,
    })

  } catch (error) {
    console.error('Research agent error:', error)
    return NextResponse.json(
      { error: 'Research failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function parseResearchResponse(text: string): {
  findings: Array<{
    type: string
    title: string
    summary: string
    relevance_score: number
    recommendation: string
    data: Record<string, unknown>
  }>
  actions: Array<{
    type: string
    params: Record<string, unknown>
    reason: string
  }>
  summary: string
} {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch {
    // Fall through to default
  }

  // Default response if parsing fails
  return {
    findings: [{
      type: 'general',
      title: 'Research Analysis',
      summary: text.slice(0, 500),
      relevance_score: 0.5,
      recommendation: 'monitor',
      data: { raw_response: text },
    }],
    actions: [],
    summary: 'Research completed - review findings',
  }
}

// GET endpoint to fetch saved research
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from('agent_research')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (type) {
      query = query.eq('finding_type', type)
    }

    const { data, error } = await query.limit(50)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch research' }, { status: 500 })
    }

    return NextResponse.json({ research: data })
  } catch (error) {
    console.error('Error fetching research:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

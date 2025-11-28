import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrandProfile } from '@/types/brand'
import { format, differenceInDays } from 'date-fns'

/**
 * Outreach Agent
 *
 * An autonomous agent that manages relationship health and communication:
 * - Monitors contact engagement and flags cooling relationships
 * - Drafts personalized outreach emails
 * - Prepares meeting briefs
 * - Suggests optimal timing for follow-ups
 * - Tracks communication patterns
 * - Manages donor/funder cultivation
 */

const OUTREACH_AGENT_SYSTEM = `You are an expert relationship manager and communication strategist for nonprofit organizations. Your job is to help maintain and deepen relationships with funders, partners, and stakeholders.

Your capabilities:
1. **Relationship Health Monitoring**: Analyze contact engagement patterns and flag relationships that need attention
2. **Personalized Outreach**: Draft emails and messages that feel genuine and strategic
3. **Meeting Preparation**: Create briefs for upcoming meetings with contacts
4. **Follow-up Strategy**: Recommend optimal timing and approach for follow-ups
5. **Cultivation Planning**: Develop long-term relationship cultivation strategies

When drafting communications:
- Match the appropriate tone (formal for new funders, warm for established relationships)
- Reference past interactions and shared interests
- Be genuine - avoid clichés and generic language
- Include specific, actionable asks when appropriate
- Keep emails concise but meaningful

When analyzing relationships:
- Consider frequency and recency of communication
- Note sentiment of past interactions
- Factor in the contact's giving history or partnership status
- Identify opportunities for deeper engagement
- Flag risks of relationship deterioration

Respond in JSON format:
{
  "analysis": {
    "summary": "Overall assessment",
    "health_distribution": { "hot": N, "warm": N, "cooling": N, "cold": N },
    "at_risk_relationships": [{ "contact_id": "...", "name": "...", "reason": "...", "urgency": "high|medium|low" }],
    "opportunities": [{ "contact_id": "...", "name": "...", "opportunity": "...", "suggested_action": "..." }]
  },
  "drafts": [
    {
      "type": "email|message|talking_points",
      "contact_id": "...",
      "contact_name": "...",
      "subject": "...",
      "content": "...",
      "notes": "Context for the user"
    }
  ],
  "actions": [
    {
      "type": "action_type",
      "params": { ... },
      "reason": "Why take this action"
    }
  ],
  "recommendations": [
    {
      "priority": "high|medium|low",
      "recommendation": "...",
      "rationale": "..."
    }
  ]
}`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { workspaceId, action, contactId, context } = body

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
        if (branding.voice?.tone) orgContext += `Communication Tone: ${branding.voice.tone}\n`
        if (branding.voice?.personality) orgContext += `Voice Personality: ${branding.voice.personality.join(', ')}\n`
      }
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    let responseContent: {
      analysis?: {
        summary: string
        health_distribution: Record<string, number>
        at_risk_relationships: Array<{
          contact_id: string
          name: string
          reason: string
          urgency: string
        }>
        opportunities: Array<{
          contact_id: string
          name: string
          opportunity: string
          suggested_action: string
        }>
      }
      drafts: Array<{
        type: string
        contact_id: string
        contact_name: string
        subject?: string
        content: string
        notes?: string
      }>
      actions: Array<{
        type: string
        params: Record<string, unknown>
        reason: string
      }>
      recommendations: Array<{
        priority: string
        recommendation: string
        rationale: string
      }>
    }

    if (action === 'health_check') {
      // Analyze relationship health across all contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*, contact_interactions(*)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(100)

      const { data: recentInteractions } = await supabase
        .from('contact_interactions')
        .select('*, contacts(name, email, organization)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(50)

      const contactsContext = contacts?.map(c => {
        const lastInteraction = c.contact_interactions?.[0]
        const daysSinceContact = lastInteraction
          ? differenceInDays(new Date(), new Date(lastInteraction.created_at))
          : 999
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          organization: c.organization,
          type: c.type,
          tags: c.tags,
          relationship_health: c.relationship_health || 'unknown',
          days_since_contact: daysSinceContact,
          last_interaction: lastInteraction?.summary || 'No recorded interactions',
          interaction_count: c.contact_interactions?.length || 0,
        }
      }) || []

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: OUTREACH_AGENT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Perform a relationship health check for this organization:

${orgContext}

**Contacts Database** (${contactsContext.length} contacts):
${JSON.stringify(contactsContext, null, 2)}

**Recent Interactions**:
${JSON.stringify(recentInteractions?.slice(0, 20) || [], null, 2)}

Analyze:
1. Overall relationship health distribution
2. Which relationships are at risk (no contact in 30+ days, negative sentiment, etc.)
3. Opportunities for deeper engagement
4. Suggested immediate actions

Be specific about which contacts need attention and why.`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      responseContent = parseOutreachResponse(responseText)

    } else if (action === 'draft_outreach') {
      // Draft outreach for a specific contact or purpose
      const { contactIds, purpose, tone } = body

      let contactsData = []
      if (contactIds && contactIds.length > 0) {
        const { data } = await supabase
          .from('contacts')
          .select('*, contact_interactions(*)')
          .in('id', contactIds)

        contactsData = data || []
      }

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: OUTREACH_AGENT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Draft outreach communications for the following contacts:

${orgContext}

**Purpose**: ${purpose || 'General check-in and relationship maintenance'}
**Desired Tone**: ${tone || 'Professional but warm'}

**Contacts**:
${JSON.stringify(contactsData.map(c => ({
  id: c.id,
  name: c.name,
  email: c.email,
  organization: c.organization,
  type: c.type,
  notes: c.notes,
  recent_interactions: c.contact_interactions?.slice(0, 3).map((i: { summary: string; created_at: string }) => ({
    summary: i.summary,
    date: i.created_at
  }))
})), null, 2)}

${context ? `**Additional Context**: ${context}` : ''}

Create personalized drafts for each contact. Make them genuine and specific - reference past interactions where possible.`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      responseContent = parseOutreachResponse(responseText)

    } else if (action === 'meeting_prep') {
      // Prepare for an upcoming meeting
      const { meetingDetails } = body

      // Get contact info if provided
      let contactData = null
      if (contactId) {
        const { data } = await supabase
          .from('contacts')
          .select('*, contact_interactions(*)')
          .eq('id', contactId)
          .single()

        contactData = data
      }

      // Get related proposals or RFPs
      const { data: relatedProposals } = await supabase
        .from('proposals')
        .select('*')
        .eq('workspace_id', workspaceId)
        .limit(5)

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: OUTREACH_AGENT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Prepare a meeting brief for an upcoming meeting:

${orgContext}

**Meeting Details**:
${JSON.stringify(meetingDetails, null, 2)}

${contactData ? `**Contact Information**:
${JSON.stringify({
  name: contactData.name,
  organization: contactData.organization,
  type: contactData.type,
  notes: contactData.notes,
  relationship_health: contactData.relationship_health,
  recent_interactions: contactData.contact_interactions?.slice(0, 5)
}, null, 2)}` : ''}

${relatedProposals && relatedProposals.length > 0 ? `**Related Proposals**:
${JSON.stringify(relatedProposals.map(p => ({
  title: p.title,
  funder: p.funder_name,
  status: p.status,
  amount: p.requested_amount
})), null, 2)}` : ''}

Create a comprehensive meeting brief including:
1. Key talking points
2. Questions to ask
3. Points to avoid
4. Potential asks/outcomes
5. Follow-up items to track`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      responseContent = parseOutreachResponse(responseText)

    } else if (action === 'cultivation_plan') {
      // Create a cultivation plan for a contact or donor
      const { targetAmount, timeline } = body

      let contactData = null
      if (contactId) {
        const { data } = await supabase
          .from('contacts')
          .select('*, contact_interactions(*)')
          .eq('id', contactId)
          .single()

        contactData = data
      }

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: OUTREACH_AGENT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Create a cultivation plan for this contact/donor:

${orgContext}

**Contact Information**:
${contactData ? JSON.stringify({
  name: contactData.name,
  organization: contactData.organization,
  type: contactData.type,
  notes: contactData.notes,
  tags: contactData.tags,
  giving_history: contactData.giving_history,
  relationship_health: contactData.relationship_health,
  interaction_history: contactData.contact_interactions?.slice(0, 10)
}, null, 2) : 'No specific contact selected - provide general cultivation strategy'}

${targetAmount ? `**Target Gift/Partnership**: $${targetAmount}` : ''}
${timeline ? `**Timeline**: ${timeline}` : ''}

Create a detailed cultivation plan including:
1. Relationship assessment
2. Cultivation milestones
3. Specific touchpoints and timing
4. Key messages at each stage
5. Ask strategy and timing
6. Stewardship plan post-gift`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      responseContent = parseOutreachResponse(responseText)

    } else if (action === 'follow_up_suggestions') {
      // Get AI suggestions for who needs follow-up
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*, contact_interactions(*)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(50)

      const contactsNeedingFollowUp = contacts?.filter(c => {
        const lastInteraction = c.contact_interactions?.[0]
        if (!lastInteraction) return true
        const daysSince = differenceInDays(new Date(), new Date(lastInteraction.created_at))
        return daysSince > 14 || lastInteraction.follow_up_needed
      }).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        organization: c.organization,
        type: c.type,
        last_interaction: c.contact_interactions?.[0],
        days_since_contact: c.contact_interactions?.[0]
          ? differenceInDays(new Date(), new Date(c.contact_interactions[0].created_at))
          : 999
      })) || []

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: OUTREACH_AGENT_SYSTEM,
        messages: [{
          role: 'user',
          content: `Prioritize follow-ups for these contacts:

${orgContext}

**Contacts Needing Follow-up** (${contactsNeedingFollowUp.length}):
${JSON.stringify(contactsNeedingFollowUp, null, 2)}

For each contact, recommend:
1. Priority level (high/medium/low)
2. Best follow-up approach (email, call, meeting request)
3. Suggested message or talking points
4. Optimal timing

Create draft follow-ups for the top 3 priority contacts.`,
        }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      responseContent = parseOutreachResponse(responseText)

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const durationMs = Date.now() - startTime

    // Save drafts for user review
    if (responseContent.drafts && responseContent.drafts.length > 0) {
      for (const draft of responseContent.drafts) {
        await supabase.from('agent_drafts').insert({
          workspace_id: workspaceId,
          draft_type: draft.type === 'email' ? 'email' : 'outreach',
          title: draft.subject || `Outreach to ${draft.contact_name}`,
          content: draft.content,
          metadata: {
            contact_id: draft.contact_id,
            contact_name: draft.contact_name,
            notes: draft.notes,
          },
          status: 'pending_review',
          agent_type: 'outreach',
          context: { action, purpose: body.purpose },
        })
      }
    }

    // Execute recommended actions
    if (responseContent.actions && responseContent.actions.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      await fetch(`${baseUrl}/api/agents/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          agentType: 'outreach',
          actions: responseContent.actions,
        }),
      })
    }

    // Log agent activity
    await supabase.from('agent_logs').insert({
      workspace_id: workspaceId,
      agent_type: 'outreach',
      action,
      input_summary: `${action}${contactId ? ` for contact ${contactId}` : ''}`,
      output_summary: `Generated ${responseContent.drafts?.length || 0} drafts, ${responseContent.recommendations?.length || 0} recommendations`,
      duration_ms: durationMs,
      status: 'success',
      metadata: {
        drafts_count: responseContent.drafts?.length || 0,
        actions_count: responseContent.actions?.length || 0,
      },
    })

    return NextResponse.json({
      success: true,
      analysis: responseContent.analysis,
      drafts: responseContent.drafts,
      actions: responseContent.actions,
      recommendations: responseContent.recommendations,
      durationMs,
    })

  } catch (error) {
    console.error('Outreach agent error:', error)
    return NextResponse.json(
      { error: 'Outreach operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function parseOutreachResponse(text: string): {
  analysis?: {
    summary: string
    health_distribution: Record<string, number>
    at_risk_relationships: Array<{
      contact_id: string
      name: string
      reason: string
      urgency: string
    }>
    opportunities: Array<{
      contact_id: string
      name: string
      opportunity: string
      suggested_action: string
    }>
  }
  drafts: Array<{
    type: string
    contact_id: string
    contact_name: string
    subject?: string
    content: string
    notes?: string
  }>
  actions: Array<{
    type: string
    params: Record<string, unknown>
    reason: string
  }>
  recommendations: Array<{
    priority: string
    recommendation: string
    rationale: string
  }>
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
    drafts: [],
    actions: [],
    recommendations: [{
      priority: 'medium',
      recommendation: 'Review the raw analysis',
      rationale: text.slice(0, 500),
    }],
  }
}

// GET endpoint to fetch relationship insights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get relationship health summary
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, relationship_health, last_health_check')
      .eq('workspace_id', workspaceId)

    const healthSummary = {
      hot: 0,
      warm: 0,
      cooling: 0,
      cold: 0,
      unknown: 0,
    }

    contacts?.forEach(c => {
      const health = c.relationship_health || 'unknown'
      if (health in healthSummary) {
        healthSummary[health as keyof typeof healthSummary]++
      }
    })

    // Get recent interactions
    const { data: recentInteractions } = await supabase
      .from('contact_interactions')
      .select('*, contacts(name)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Get pending outreach drafts
    const { data: pendingDrafts } = await supabase
      .from('agent_drafts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('agent_type', 'outreach')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      healthSummary,
      totalContacts: contacts?.length || 0,
      recentInteractions,
      pendingDrafts,
    })
  } catch (error) {
    console.error('Error fetching outreach insights:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

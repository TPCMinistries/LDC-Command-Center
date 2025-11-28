import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrandProfile, generateBrandContext } from '@/types/brand'

// Section-specific writing prompts
const SECTION_PROMPTS: Record<string, string> = {
  executive_summary: `Write a compelling executive summary that:
- Opens with a hook that captures the funder's attention
- Clearly states the problem and your solution
- Highlights your organization's unique qualifications
- Summarizes key outcomes and impact
- Ends with a clear ask (funding amount and purpose)
Keep it concise but impactful. This is often the only section funders read fully.`,

  organizational_background: `Write an organizational background section that:
- Establishes credibility and track record
- Highlights relevant experience and past success
- Demonstrates organizational capacity
- Shows alignment between your mission and this opportunity
- Includes specific metrics and achievements
- Mentions key partnerships and coalitions
Focus on relevance to this specific opportunity, not a generic org description.`,

  statement_of_need: `Write a statement of need that:
- Uses current, credible data to establish the problem
- Focuses on the specific community/population to be served
- Creates urgency without being alarmist
- Shows you understand root causes, not just symptoms
- Connects the need directly to your proposed solution
- Avoids jargon and speaks to human impact
Make the funder feel the urgency and see the opportunity for impact.`,

  program_design: `Write a program design section that:
- Clearly describes what you will do and how
- Shows logical flow from activities to outcomes
- Demonstrates evidence-based or promising practices
- Explains why this approach will work for this population
- Details key program components and activities
- Addresses potential challenges and solutions
- Shows innovation while being realistic
Be specific about implementation details.`,

  theory_of_change: `Write a theory of change narrative that:
- Explains the causal logic of your intervention
- Shows how activities lead to outputs, outputs to outcomes
- Identifies key assumptions and conditions for success
- References research or evidence supporting your theory
- Connects short-term changes to long-term impact
Make the logic clear and compelling.`,

  implementation_plan: `Write an implementation plan that:
- Provides a clear timeline with milestones
- Details staffing and responsibilities
- Addresses logistics and operations
- Shows you've thought through challenges
- Demonstrates readiness to start
- Includes partner roles if applicable
Be realistic and specific about execution.`,

  staffing_plan: `Write a staffing plan that:
- Identifies key positions and qualifications
- Shows relevant experience of proposed staff
- Explains the management structure
- Demonstrates adequate capacity
- Addresses training and development
- Includes partner staff if coalition-based
Highlight the people who will make this work.`,

  evaluation_plan: `Write an evaluation plan that:
- Defines clear, measurable outcomes
- Specifies indicators and data sources
- Describes data collection methods and frequency
- Shows how data will inform program improvement
- Demonstrates commitment to learning
- Is realistic given budget and capacity
Balance rigor with practicality.`,

  sustainability_plan: `Write a sustainability plan that:
- Shows how the program will continue after grant ends
- Identifies diverse funding sources
- Demonstrates organizational commitment
- Addresses capacity building for sustainability
- Shows community ownership or support
- Is realistic and credible
Don't overpromise - funders see through that.`,

  budget_narrative: `Write a budget narrative that:
- Justifies each major expense category
- Shows costs are reasonable and necessary
- Explains the basis for calculations
- Addresses any unusual or high costs
- Demonstrates cost-effectiveness
- Aligns with program activities described
Make funders feel confident their money is well-spent.`,
}

// Writing tones
const WRITING_TONES: Record<string, string> = {
  professional: 'Write in a professional, confident tone that demonstrates expertise and credibility.',
  conversational: 'Write in a warm, conversational tone that feels approachable while remaining professional.',
  inspiring: 'Write in an inspiring, passionate tone that conveys deep commitment to the mission.',
  formal: 'Write in a formal, academic tone appropriate for government grants and institutional funders.',
  storytelling: 'Write with rich storytelling elements that bring the human impact to life.',
}

const SYSTEM_PROMPT = `You are an expert grant writer with decades of experience helping nonprofits and community organizations win funding. You write in a clear, compelling, professional style that balances warmth with credibility.

Your writing principles:
1. SPECIFICITY: Use concrete details, numbers, and examples - never vague generalizations
2. EVIDENCE: Support claims with data, research, and track record
3. VOICE: Write in active voice, with confidence but not arrogance
4. STRUCTURE: Use clear organization with topic sentences and transitions
5. FUNDER FOCUS: Always show alignment with what the funder cares about
6. IMPACT: Paint a picture of the change that will result
7. AUTHENTICITY: Capture the organization's unique voice and personality

When writing:
- Use the organization's brand voice if provided
- Incorporate coalition partner information naturally
- Reference specific RFP requirements when relevant
- Be concise but complete - every sentence should add value
- Avoid nonprofit clichés and buzzwords
- Write for a smart reader who needs to be convinced`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const {
      workspaceId,
      proposalId,
      sectionId,
      sectionType,
      sectionTitle,
      action,
      content,
      prompt,
      rfpContext,
      wordLimit,
      writingTone = 'professional',
    } = body

    // Get tone instruction
    const toneInstruction = WRITING_TONES[writingTone] || WRITING_TONES.professional

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const supabase = createAdminClient()

    // Gather context
    let orgContext = ''
    let coalitionContext = ''
    let rfpInfo = ''
    let proposalContext = ''

    // Get workspace branding
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('branding, name, description')
      .eq('id', workspaceId)
      .single()

    if (workspace) {
      orgContext = `Organization: ${workspace.name}\n`
      if (workspace.description) {
        orgContext += `Description: ${workspace.description}\n`
      }
      if (workspace.branding) {
        orgContext += generateBrandContext(workspace.branding as BrandProfile)
      }
    }

    // Get proposal details if proposalId provided
    if (proposalId) {
      const { data: proposal } = await supabase
        .from('proposals')
        .select(`
          *,
          rfp:rfp_items(
            id,
            title,
            agency,
            description,
            response_deadline,
            requirements,
            eligibility,
            extracted_requirements
          )
        `)
        .eq('id', proposalId)
        .single()

      if (proposal) {
        proposalContext = `
Proposal: ${proposal.title}
Funder: ${proposal.funder_name || 'Not specified'}
Program: ${proposal.program_name || 'Not specified'}
Requested Amount: ${proposal.requested_amount ? `$${proposal.requested_amount.toLocaleString()}` : 'Not specified'}
Target Population: ${proposal.target_population || 'Not specified'}
Service Area: ${proposal.service_area || 'Not specified'}
`
        if (proposal.outcomes && Array.isArray(proposal.outcomes)) {
          proposalContext += `\nProposed Outcomes:\n`
          proposal.outcomes.forEach((o: { outcome: string; indicator?: string; target?: string }, i: number) => {
            proposalContext += `${i + 1}. ${o.outcome}${o.indicator ? ` (Indicator: ${o.indicator})` : ''}${o.target ? ` Target: ${o.target}` : ''}\n`
          })
        }

        // RFP context from linked RFP
        if (proposal.rfp) {
          const rfp = proposal.rfp as {
            title: string
            agency?: string
            response_deadline?: string
            description?: string
            requirements?: string[]
            eligibility?: Record<string, unknown>
            extracted_requirements?: {
              summary?: string
              fundingAmount?: { min?: number; max?: number; description: string }
              eligibility?: Array<{ requirement: string; isMet?: boolean; notes?: string }>
              evaluationCriteria?: Array<{ criterion: string; weight?: number; description: string }>
              requiredSections?: Array<{ name: string; wordLimit?: number; pageLimit?: number; description?: string }>
              keyDates?: Array<{ event: string; date: string; isDeadline?: boolean }>
              complianceChecklist?: Array<{ item: string; category: string; required: boolean }>
              fitAssessment?: { score: number; strengths: string[]; gaps: string[]; recommendations: string[] }
            }
          }

          rfpInfo = `
## RFP Information
- **Title:** ${rfp.title}
- **Agency:** ${rfp.agency || 'Not specified'}
- **Due Date:** ${rfp.response_deadline || 'Not specified'}
- **Description:** ${rfp.description || 'Not provided'}
`
          // Include extracted requirements if available (from AI analysis)
          if (rfp.extracted_requirements) {
            const er = rfp.extracted_requirements

            if (er.summary) {
              rfpInfo += `\n### RFP Summary\n${er.summary}\n`
            }

            if (er.fundingAmount) {
              rfpInfo += `\n### Funding\n${er.fundingAmount.description}\n`
            }

            if (er.evaluationCriteria && er.evaluationCriteria.length > 0) {
              rfpInfo += `\n### Evaluation Criteria (How Proposals Will Be Scored)\n`
              er.evaluationCriteria.forEach((c) => {
                rfpInfo += `- **${c.criterion}**${c.weight ? ` (${c.weight}%)` : ''}: ${c.description}\n`
              })
            }

            if (er.eligibility && er.eligibility.length > 0) {
              rfpInfo += `\n### Eligibility Requirements\n`
              er.eligibility.forEach((e) => {
                const status = e.isMet === true ? '✓' : e.isMet === false ? '✗' : '?'
                rfpInfo += `- [${status}] ${e.requirement}${e.notes ? ` - ${e.notes}` : ''}\n`
              })
            }

            if (er.requiredSections && er.requiredSections.length > 0) {
              rfpInfo += `\n### Required Proposal Sections\n`
              er.requiredSections.forEach((s) => {
                let limits = ''
                if (s.wordLimit) limits += ` (${s.wordLimit} words)`
                if (s.pageLimit) limits += ` (${s.pageLimit} pages)`
                rfpInfo += `- **${s.name}**${limits}${s.description ? `: ${s.description}` : ''}\n`
              })
            }

            if (er.complianceChecklist && er.complianceChecklist.length > 0) {
              rfpInfo += `\n### Compliance Checklist\n`
              er.complianceChecklist.forEach((c) => {
                rfpInfo += `- [${c.required ? 'Required' : 'Optional'}] ${c.item} (${c.category})\n`
              })
            }

            if (er.fitAssessment) {
              rfpInfo += `\n### Fit Assessment\n`
              rfpInfo += `- **Alignment Score:** ${er.fitAssessment.score}%\n`
              if (er.fitAssessment.strengths && er.fitAssessment.strengths.length > 0) {
                rfpInfo += `- **Strengths to Highlight:**\n`
                er.fitAssessment.strengths.forEach((s) => {
                  rfpInfo += `  - ${s}\n`
                })
              }
              if (er.fitAssessment.gaps && er.fitAssessment.gaps.length > 0) {
                rfpInfo += `- **Gaps to Address:**\n`
                er.fitAssessment.gaps.forEach((g) => {
                  rfpInfo += `  - ${g}\n`
                })
              }
              if (er.fitAssessment.recommendations && er.fitAssessment.recommendations.length > 0) {
                rfpInfo += `- **Strategic Recommendations:**\n`
                er.fitAssessment.recommendations.forEach((r) => {
                  rfpInfo += `  - ${r}\n`
                })
              }
            }
          } else {
            // Fallback to raw data if no extracted requirements
            if (rfp.requirements) rfpInfo += `- Requirements: ${JSON.stringify(rfp.requirements)}\n`
            if (rfp.eligibility) rfpInfo += `- Eligibility: ${JSON.stringify(rfp.eligibility)}\n`
          }
        }
      }

      // Get coalition partners for this proposal
      const { data: coalition } = await supabase
        .from('coalition_memberships')
        .select(`
          role,
          scope_of_work,
          budget_allocated,
          partner:partners(name, sector, description, capacity_overall, is_fundable)
        `)
        .eq('workspace_id', workspaceId)
        .or(`rfp_id.eq.${proposalId}`)

      if (coalition && coalition.length > 0) {
        coalitionContext = '\nCoalition Partners:\n'
        coalition.forEach((m) => {
          if (m.partner) {
            const p = m.partner as { name: string; sector: string; description?: string; capacity_overall?: number }
            coalitionContext += `- ${p.name} (${m.role}): ${p.description || p.sector}`
            if (m.scope_of_work) coalitionContext += ` - Scope: ${m.scope_of_work}`
            coalitionContext += '\n'
          }
        })
      }
    }

    // Add any additional RFP context passed directly
    if (rfpContext) {
      rfpInfo += `\nAdditional RFP Context:\n${rfpContext}\n`
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    let responseContent = ''
    let tokensUsed = 0

    if (action === 'write') {
      // Write a full section
      const sectionPrompt = SECTION_PROMPTS[sectionType] || 'Write this section professionally and compellingly.'

      const userPrompt = `${sectionPrompt}

**Writing Tone:** ${toneInstruction}

**Context:**
${orgContext}
${proposalContext}
${rfpInfo}
${coalitionContext}

${prompt ? `**Additional Instructions:** ${prompt}` : ''}
${wordLimit ? `**Word Limit:** Approximately ${wordLimit} words` : ''}

Write the section now. Be specific, use real details from the context provided, and write in a compelling grant-winning style that matches the requested tone.`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

      // Save to section if sectionId provided
      if (sectionId) {
        await supabase
          .from('proposal_sections')
          .update({
            content: responseContent,
            last_ai_assist: new Date().toISOString(),
            ai_suggestions: [],
          })
          .eq('id', sectionId)
      }

    } else if (action === 'improve') {
      // Improve existing content
      const userPrompt = `Improve and strengthen this grant proposal section. Make it more compelling, specific, and likely to win funding.

**Section Type:** ${sectionType}

**Current Content:**
${content}

**Context:**
${orgContext}
${proposalContext}
${rfpInfo}

${prompt ? `**Specific Improvement Request:** ${prompt}` : ''}
${wordLimit ? `**Word Limit:** Keep it around ${wordLimit} words` : ''}

Provide the improved version. Keep what works, enhance what doesn't. Make every sentence count.`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    } else if (action === 'suggest') {
      // Get suggestions for improvement without rewriting
      const userPrompt = `Review this grant proposal section and provide specific, actionable suggestions for improvement.

**Section Type:** ${sectionType}

**Current Content:**
${content}

**Context:**
${orgContext}
${rfpInfo}

Provide 3-5 specific suggestions. For each:
1. Quote the problematic text
2. Explain the issue
3. Provide a concrete alternative

Format as JSON:
{
  "suggestions": [
    {
      "original": "quoted text",
      "issue": "what's wrong",
      "suggestion": "specific improvement",
      "priority": "high|medium|low"
    }
  ],
  "overall_assessment": "brief overall feedback",
  "strength_score": 1-10
}`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0])
          responseContent = suggestions

          // Save suggestions to section
          if (sectionId) {
            await supabase
              .from('proposal_sections')
              .update({
                ai_suggestions: suggestions.suggestions,
                last_ai_assist: new Date().toISOString(),
              })
              .eq('id', sectionId)
          }
        } else {
          responseContent = { raw: responseText }
        }
      } catch {
        responseContent = { raw: responseText }
      }

    } else if (action === 'expand') {
      // Expand a bullet point or brief into full prose
      const userPrompt = `Expand these notes/bullets into polished grant proposal prose for the ${sectionType} section.

**Notes to expand:**
${content}

**Context:**
${orgContext}
${proposalContext}
${rfpInfo}

${prompt ? `**Additional Instructions:** ${prompt}` : ''}
${wordLimit ? `**Target Length:** Approximately ${wordLimit} words` : ''}

Write flowing, professional prose that incorporates all the key points. Add appropriate transitions and supporting details.`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    } else if (action === 'guided_draft') {
      // Generate draft from guided questions/answers
      const { answers, rfpContext: guidedRfpContext } = body

      const sectionPrompt = SECTION_PROMPTS[sectionType] || 'Write this section professionally and compellingly.'

      let rfpGuidance = ''
      if (guidedRfpContext) {
        if (guidedRfpContext.requirements) {
          rfpGuidance += `\n**RFP Requirements for this section:**\n${guidedRfpContext.requirements}\n`
        }
        if (guidedRfpContext.evaluationCriteria) {
          rfpGuidance += `\n**Evaluation Criteria:**\n${guidedRfpContext.evaluationCriteria}\n`
        }
        if (guidedRfpContext.guidance) {
          rfpGuidance += `\n**RFP Guidance:**\n${guidedRfpContext.guidance}\n`
        }
      }

      const userPrompt = `Write a complete ${sectionTitle || sectionType} section for a grant proposal based on the following answers to guided questions.

**Section Guidelines:**
${sectionPrompt}

**User's Answers to Guided Questions:**
${answers}
${rfpGuidance}
${wordLimit ? `**Target Word Count:** Approximately ${wordLimit} words` : ''}

Based on these answers, write a polished, professional section that:
1. Incorporates all the information provided
2. Flows naturally as cohesive prose (not a Q&A format)
3. Uses compelling language appropriate for grant proposals
4. Adds appropriate transitions and supporting details
5. Follows grant writing best practices

Write only the section content, no headers or commentary.`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    } else if (action === 'chat') {
      // Conversational help with writing
      const userPrompt = prompt || 'How can I help you with this proposal section?'

      const messages: { role: 'user' | 'assistant'; content: string }[] = [
        {
          role: 'user',
          content: `I'm working on a grant proposal. Here's the context:

${orgContext}
${proposalContext}
${rfpInfo}

${sectionType ? `I'm currently working on the ${sectionType} section.` : ''}
${content ? `Current draft:\n${content}\n` : ''}

My question: ${userPrompt}`,
        },
      ]

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT + '\n\nYou are now in conversational mode, helping the user with their grant proposal. Be helpful, specific, and encouraging.',
        messages,
      })

      responseContent = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

    } else if (action === 'write_all') {
      // Write all sections in one go (for full proposal generation)
      const { sections } = body // Array of { id, section_type, title, word_limit }

      if (!sections || sections.length === 0) {
        return NextResponse.json({ error: 'No sections provided' }, { status: 400 })
      }

      const sectionsToWrite = sections.map((s: { section_type: string; title: string; word_limit?: number }) => {
        const sectionPrompt = SECTION_PROMPTS[s.section_type] || 'Write this section professionally.'
        return `### ${s.title} (${s.section_type})${s.word_limit ? ` [~${s.word_limit} words]` : ''}
Guidelines: ${sectionPrompt}`
      }).join('\n\n')

      const userPrompt = `Write a complete grant proposal with the following sections. Each section should be clearly labeled and follow the specific guidelines.

**Writing Tone:** ${toneInstruction}

**Context:**
${orgContext}
${proposalContext}
${rfpInfo}
${coalitionContext}

**Sections to Write:**
${sectionsToWrite}

${prompt ? `**Additional Instructions:** ${prompt}` : ''}

Write each section now, clearly labeled with the section title. Make each section compelling, specific, and aligned with the funder's priorities. Ensure consistency and flow between sections.`

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const fullProposal = message.content[0].type === 'text' ? message.content[0].text : ''
      tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)

      // Parse and save individual sections
      const savedSections: Record<string, string> = {}
      for (const section of sections as Array<{ id: string; section_type: string; title: string }>) {
        // Try to extract this section from the full proposal
        const titleRegex = new RegExp(`###?\\s*${section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=###|$)`, 'i')
        const match = fullProposal.match(titleRegex)

        if (match) {
          const sectionContent = match[0]
            .replace(/###?\s*[^\n]+\n/, '') // Remove the header
            .trim()

          savedSections[section.id] = sectionContent

          // Save to database
          await supabase
            .from('proposal_sections')
            .update({
              content: sectionContent,
              last_ai_assist: new Date().toISOString(),
            })
            .eq('id', section.id)
        }
      }

      responseContent = {
        fullProposal,
        savedSections,
        sectionsWritten: Object.keys(savedSections).length,
      }
    }

    const durationMs = Date.now() - startTime

    // Log agent activity
    await supabase.from('agent_logs').insert({
      workspace_id: workspaceId,
      agent_type: 'proposal',
      action,
      input_summary: `${action} for ${sectionType || 'proposal'}`,
      output_summary: typeof responseContent === 'string'
        ? responseContent.slice(0, 100) + '...'
        : 'Suggestions generated',
      tokens_used: tokensUsed,
      duration_ms: durationMs,
      status: 'success',
      metadata: { proposal_id: proposalId, section_id: sectionId, section_type: sectionType },
    })

    return NextResponse.json({
      success: true,
      content: responseContent,
      action,
      tokensUsed,
      durationMs,
    })

  } catch (error) {
    console.error('Proposal agent error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrandProfile, generateBrandContext } from '@/types/brand'

const IDEA_ANALYSIS_PROMPT = `You are an idea analyst helping process and categorize ideas for organizations. Analyze the provided idea content and extract structured insights.

Given an idea (either typed text or a voice transcript), provide:

1. **Title**: A clear, concise title (max 10 words)
2. **Summary**: A 2-3 sentence summary of the core idea
3. **Category**: One of: content, product, strategy, process, partnership, innovation, marketing, other
4. **Tags**: 3-7 relevant tags (lowercase, single words or short phrases)
5. **Key Points**: 3-5 main takeaways or insights
6. **Action Items**: 2-4 concrete next steps to explore or implement this idea
7. **Content Potential**: What types of content could be created from this idea? (blog, linkedin, twitter, email, video, podcast)
8. **Target Audiences**: Who would find this idea most relevant?
9. **Urgency**: Is this time-sensitive? (immediate, short-term, long-term)

Format your response as JSON:
{
  "title": "...",
  "summary": "...",
  "category": "...",
  "tags": ["..."],
  "key_points": ["..."],
  "action_items": ["..."],
  "content_types_suggested": ["..."],
  "target_audiences": ["..."],
  "urgency": "..."
}`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { ideaId, workspaceId, action } = await request.json()

    if (!ideaId || !workspaceId) {
      return NextResponse.json({ error: 'Missing ideaId or workspaceId' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const supabase = createAdminClient()

    // Fetch the idea
    const { data: idea, error: ideaError } = await supabase
      .from('ideas')
      .select('*')
      .eq('id', ideaId)
      .eq('workspace_id', workspaceId)
      .single()

    if (ideaError || !idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
    }

    // Get workspace branding for context
    let brandContext = ''
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('branding, name')
      .eq('id', workspaceId)
      .single()

    if (workspace?.branding) {
      brandContext = generateBrandContext(workspace.branding as BrandProfile)
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    if (action === 'analyze') {
      // Update status to processing
      await supabase
        .from('ideas')
        .update({ status: 'processing' })
        .eq('id', ideaId)

      const ideaContent = idea.transcript || idea.text_content || ''

      if (!ideaContent.trim()) {
        await supabase
          .from('ideas')
          .update({ status: 'failed', error_message: 'No content to analyze' })
          .eq('id', ideaId)
        return NextResponse.json({ error: 'No content to analyze' }, { status: 400 })
      }

      const systemPrompt = IDEA_ANALYSIS_PROMPT + (brandContext ? `\n\n**Organization Context**:\n${brandContext}\n\nConsider this organizational context when categorizing and suggesting content types.` : '')

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Analyze this idea:\n\n${ideaContent}`,
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
        await supabase
          .from('ideas')
          .update({ status: 'failed', error_message: 'Failed to parse AI response' })
          .eq('id', ideaId)
        return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
      }

      const durationMs = Date.now() - startTime

      // Update the idea with analysis
      const { data: updatedIdea, error: updateError } = await supabase
        .from('ideas')
        .update({
          title: analysis.title,
          summary: analysis.summary,
          category: analysis.category,
          tags: analysis.tags,
          key_points: analysis.key_points,
          action_items: analysis.action_items,
          content_types_suggested: analysis.content_types_suggested,
          target_audiences: analysis.target_audiences,
          urgency: analysis.urgency,
          status: 'complete',
          processing_stats: {
            tokens_used: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
            duration_ms: durationMs,
            model: 'claude-sonnet-4-20250514',
          },
        })
        .eq('id', ideaId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating idea:', updateError)
        return NextResponse.json({ error: 'Failed to update idea' }, { status: 500 })
      }

      // Log agent activity
      await supabase.from('agent_logs').insert({
        workspace_id: workspaceId,
        agent_type: 'ideas',
        action: 'analyze',
        input_summary: `Analyzed idea: ${analysis.title || 'Untitled'}`,
        output_summary: `Extracted ${analysis.key_points?.length || 0} key points, ${analysis.action_items?.length || 0} action items`,
        tokens_used: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
        duration_ms: durationMs,
        status: 'success',
        metadata: { idea_id: ideaId },
      })

      return NextResponse.json({
        success: true,
        idea: updatedIdea,
        analysis,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Ideas agent error:', error)
    return NextResponse.json(
      { error: 'Failed to process idea', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

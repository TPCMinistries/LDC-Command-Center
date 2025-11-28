import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

const MINISTRY_AGENT_PROMPT = `You are the Ministry Agent for Lorenzo Daughtry-Chambers' Command System. You process audio transcripts to extract spiritual insights.

Your task is to analyze the provided transcript and extract:

1. **Title**: A concise, meaningful title for this note (max 10 words)

2. **Summary**: A 2-3 sentence summary of the main message or insight

3. **Category**: Classify as ONE of:
   - "prophetic" - Directional words, future-oriented revelation, specific guidance
   - "sermon_seed" - Teaching material, biblical exposition, message ideas
   - "reflection" - Personal processing, devotional thoughts, journaling
   - "prayer" - Intercession, prayer points, spiritual warfare
   - "general" - Notes that don't fit other categories

4. **Themes**: 3-5 key themes or topics (single words or short phrases)

5. **Scriptures**: Any Bible references mentioned or strongly implied (use standard format like "John 3:16")

6. **Key Insights**: 2-4 bullet points of actionable insights or memorable quotes

Respond ONLY with valid JSON in this exact format:
{
  "title": "string",
  "summary": "string",
  "category": "prophetic" | "sermon_seed" | "reflection" | "prayer" | "general",
  "themes": ["string", "string", ...],
  "scriptures": ["string", ...],
  "key_insights": ["string", "string", ...]
}

Honor the sacredness of the content while making it actionable. Be accurate with scripture references. If no scriptures are explicitly mentioned, return an empty array.`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { noteId } = await request.json()

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get the note with transcript
    const { data: note, error: noteError } = await supabase
      .from('prophetic_notes')
      .select('*')
      .eq('id', noteId)
      .single()

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    if (!note.transcript) {
      return NextResponse.json({ error: 'No transcript available' }, { status: 400 })
    }

    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      await supabase
        .from('prophetic_notes')
        .update({
          status: 'failed',
          error_message: 'Anthropic API key not configured',
        })
        .eq('id', noteId)

      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    try {
      // Call Claude to process the transcript
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Please analyze this transcript and extract insights:\n\n---\n${note.transcript}\n---`,
          },
        ],
        system: MINISTRY_AGENT_PROMPT,
      })

      // Extract the text response
      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : ''

      // Parse the JSON response
      let analysis
      try {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        console.error('Failed to parse Ministry Agent response:', responseText)
        throw new Error('Failed to parse agent response')
      }

      const durationMs = Date.now() - startTime

      // Update the note with extracted insights
      const { error: updateError } = await supabase
        .from('prophetic_notes')
        .update({
          title: analysis.title || note.title,
          summary: analysis.summary,
          category: analysis.category,
          themes: analysis.themes || [],
          scriptures: analysis.scriptures || [],
          key_insights: analysis.key_insights || [],
          status: 'complete',
          processing_stats: {
            ...((note.processing_stats as Record<string, unknown>) || {}),
            ministry_agent_model: 'claude-sonnet-4-20250514',
            ministry_agent_duration_ms: durationMs,
            ministry_agent_tokens: message.usage?.input_tokens + message.usage?.output_tokens,
            processed_at: new Date().toISOString(),
          },
        })
        .eq('id', noteId)

      if (updateError) {
        console.error('Failed to update note:', updateError)
        throw new Error('Failed to save analysis')
      }

      // Log agent activity
      await supabase.from('agent_logs').insert({
        workspace_id: note.workspace_id,
        agent_type: 'ministry',
        action: 'process_transcript',
        input_summary: `Processed transcript (${note.transcript.length} chars)`,
        output_summary: `Extracted: ${analysis.themes?.length || 0} themes, ${analysis.scriptures?.length || 0} scriptures`,
        tokens_used: message.usage?.input_tokens + message.usage?.output_tokens,
        duration_ms: durationMs,
        status: 'success',
        metadata: { note_id: noteId },
      })

      return NextResponse.json({
        success: true,
        analysis,
        duration_ms: durationMs,
      })
    } catch (aiError) {
      console.error('Ministry Agent error:', aiError)

      await supabase
        .from('prophetic_notes')
        .update({
          status: 'failed',
          error_message: aiError instanceof Error ? aiError.message : 'Processing failed',
        })
        .eq('id', noteId)

      // Log failed attempt
      await supabase.from('agent_logs').insert({
        workspace_id: note.workspace_id,
        agent_type: 'ministry',
        action: 'process_transcript',
        input_summary: `Attempted to process transcript (${note.transcript.length} chars)`,
        duration_ms: Date.now() - startTime,
        status: 'failed',
        error: aiError instanceof Error ? aiError.message : 'Unknown error',
        metadata: { note_id: noteId },
      })

      return NextResponse.json({
        error: 'Processing failed',
        details: aiError instanceof Error ? aiError.message : 'Unknown error',
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Ministry agent route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

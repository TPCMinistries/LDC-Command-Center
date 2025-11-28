import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrandProfile } from '@/types/brand'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const QUESTIONNAIRE_SYSTEM_PROMPT = `You are a brand voice coach helping organizations discover and define their unique voice. You're warm, insightful, and great at drawing out what makes each brand special.

Your goal is to have a natural conversation that uncovers:
1. **Core Identity**: Mission, values, what they stand for
2. **Audience**: Who they're speaking to, what those people need
3. **Personality**: How they want to come across (warm, authoritative, playful, etc.)
4. **Tone**: Formal vs casual, serious vs lighthearted
5. **Communication Style**: Direct, storytelling, educational, motivational
6. **Language Preferences**: Words they love, words they avoid, jargon level

Ask ONE question at a time. Be conversational, not robotic. Build on their answers.

Start by introducing yourself briefly and asking about their organization's core purpose/mission.

After gathering enough information (usually 5-8 exchanges), offer to summarize what you've learned and generate their brand voice profile.

When the user confirms they're ready for the summary, output a JSON block with the brand profile:
<brand_profile>
{
  "identity": {
    "mission": "...",
    "vision": "...",
    "tagline": "..."
  },
  "audience": {
    "primary": "...",
    "pain_points": ["..."],
    "aspirations": ["..."]
  },
  "voice": {
    "tone": "formal|professional|conversational|casual|inspirational",
    "personality": ["trait1", "trait2", "trait3"],
    "communication_style": "direct|storytelling|educational|motivational"
  },
  "language": {
    "words_to_use": ["..."],
    "words_to_avoid": ["..."],
    "jargon_level": "none|minimal|industry-standard|technical"
  },
  "messaging": {
    "key_themes": ["..."],
    "differentiators": ["..."]
  },
  "content_preferences": {
    "call_to_action_style": "soft|medium|urgent"
  }
}
</brand_profile>

Only include fields you have enough information to populate confidently.`

const SAMPLE_ANALYSIS_PROMPT = `You are a brand voice analyst. Analyze the provided content samples to extract voice and style patterns.

For each sample, identify:
1. **Tone**: Is it formal, professional, conversational, casual, or inspirational?
2. **Personality traits**: What personality comes through? (e.g., warm, authoritative, playful, empathetic)
3. **Communication style**: Is it direct, storytelling-based, educational, or motivational?
4. **Language patterns**:
   - Common words/phrases used
   - Sentence structure (short and punchy vs. flowing)
   - Use of questions, calls-to-action
   - Jargon level
5. **Emotional appeal**: What emotions does it evoke?

After analyzing all samples, synthesize a unified voice profile that captures what's consistent across them.

Output your analysis followed by a JSON block:
<voice_analysis>
{
  "tone": "...",
  "personality": ["..."],
  "communication_style": "...",
  "language_patterns": {
    "common_phrases": ["..."],
    "sentence_style": "...",
    "jargon_level": "..."
  },
  "words_to_use": ["..."],
  "words_to_avoid": ["..."],
  "emotional_tone": "...",
  "key_themes": ["..."],
  "recommendations": ["..."]
}
</voice_analysis>`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, workspaceId, messages, samples, currentProfile } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    if (action === 'questionnaire') {
      // Handle conversational questionnaire
      const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = messages || []

      // If no messages, start the conversation
      if (claudeMessages.length === 0) {
        claudeMessages.push({
          role: 'user',
          content: 'Hi, I\'d like help defining my brand voice.',
        })
      }

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: QUESTIONNAIRE_SYSTEM_PROMPT,
        messages: claudeMessages,
      })

      const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

      // Check if there's a brand profile to extract
      let extractedProfile: Partial<BrandProfile> | null = null
      const profileMatch = responseText.match(/<brand_profile>([\s\S]*?)<\/brand_profile>/)
      if (profileMatch) {
        try {
          extractedProfile = JSON.parse(profileMatch[1].trim())
        } catch {
          // Profile parsing failed, continue without it
        }
      }

      return NextResponse.json({
        success: true,
        message: responseText.replace(/<brand_profile>[\s\S]*?<\/brand_profile>/, '').trim(),
        extractedProfile,
        tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      })

    } else if (action === 'analyze_samples') {
      // Handle sample content analysis
      if (!samples || samples.length === 0) {
        return NextResponse.json({ error: 'No samples provided' }, { status: 400 })
      }

      const samplesText = samples.map((s: string, i: number) => `
--- Sample ${i + 1} ---
${s}
`).join('\n')

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SAMPLE_ANALYSIS_PROMPT,
        messages: [{
          role: 'user',
          content: `Please analyze these ${samples.length} content sample(s) and extract the voice/style patterns:\n\n${samplesText}`,
        }],
      })

      const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

      // Extract voice analysis
      let voiceAnalysis = null
      const analysisMatch = responseText.match(/<voice_analysis>([\s\S]*?)<\/voice_analysis>/)
      if (analysisMatch) {
        try {
          voiceAnalysis = JSON.parse(analysisMatch[1].trim())
        } catch {
          // Analysis parsing failed
        }
      }

      return NextResponse.json({
        success: true,
        analysis: responseText.replace(/<voice_analysis>[\s\S]*?<\/voice_analysis>/, '').trim(),
        voiceAnalysis,
        tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      })

    } else if (action === 'refine') {
      // Handle ongoing voice refinement chat
      const contextPrompt = currentProfile
        ? `Current brand profile:\n${JSON.stringify(currentProfile, null, 2)}\n\nThe user wants to refine their brand voice. Help them make adjustments.`
        : 'Help the user refine their brand voice.'

      const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = [
        { role: 'user', content: contextPrompt },
        { role: 'assistant', content: "I can see your current brand profile. What aspect of your voice would you like to refine?" },
        ...(messages || []),
      ]

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You are a brand voice coach helping refine an existing brand profile. Suggest specific changes and output updates in this format when appropriate:
<profile_update>
{
  "field.path": "new_value"
}
</profile_update>

For example: { "voice.tone": "conversational", "language.words_to_use": ["inspire", "empower"] }`,
        messages: claudeMessages,
      })

      const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

      // Extract profile updates
      let profileUpdates = null
      const updateMatch = responseText.match(/<profile_update>([\s\S]*?)<\/profile_update>/)
      if (updateMatch) {
        try {
          profileUpdates = JSON.parse(updateMatch[1].trim())
        } catch {
          // Update parsing failed
        }
      }

      return NextResponse.json({
        success: true,
        message: responseText.replace(/<profile_update>[\s\S]*?<\/profile_update>/, '').trim(),
        profileUpdates,
        tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      })

    } else if (action === 'save_profile') {
      // Save the extracted/updated profile to the workspace
      const { profile } = body
      if (!profile) {
        return NextResponse.json({ error: 'No profile to save' }, { status: 400 })
      }

      const supabase = createAdminClient()

      // Get current branding
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('branding')
        .eq('id', workspaceId)
        .single()

      const currentBranding = (workspace?.branding as BrandProfile) || {}

      // Merge the new profile with existing
      const updatedBranding: BrandProfile = {
        ...currentBranding,
        ...profile,
        identity: { ...currentBranding.identity, ...profile.identity },
        audience: { ...currentBranding.audience, ...profile.audience },
        voice: { ...currentBranding.voice, ...profile.voice },
        language: { ...currentBranding.language, ...profile.language },
        messaging: { ...currentBranding.messaging, ...profile.messaging },
        content_preferences: { ...currentBranding.content_preferences, ...profile.content_preferences },
        profile_complete: true,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('workspaces')
        .update({ branding: updatedBranding })
        .eq('id', workspaceId)

      if (error) {
        return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        branding: updatedBranding,
      })

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Voice coach error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrandProfile, generateBrandContext } from '@/types/brand'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `You are a content refinement assistant helping users improve their AI-generated content. You can help with:

1. **Editing & Refining**: Adjusting tone, length, style, or emphasis
2. **Expanding**: Adding more detail, examples, or depth
3. **Condensing**: Making content shorter and more punchy
4. **Reformatting**: Changing structure, adding/removing sections
5. **Personalizing**: Adding personal touches, stories, or voice
6. **Platform Optimization**: Adjusting for specific platform best practices

When the user asks for changes, provide the COMPLETE revised content - not just suggestions. Format your response clearly.

If revising a full piece of content, wrap it in a special tag so the system can extract it:
<revised_content>
[The complete revised content here]
</revised_content>

Be helpful, specific, and maintain the original message's intent while making requested improvements.`

const COACHING_PROMPTS: Record<string, string[]> = {
  sermon_outline: [
    "Make the introduction more engaging",
    "Add a personal illustration to point 2",
    "Make the call to action more compelling",
    "Add more scripture references",
    "Simplify the language for a younger audience",
    "Make it more applicable to daily life",
  ],
  email: [
    "Make the subject line more compelling",
    "Add more urgency to the call-to-action",
    "Make it shorter and more scannable",
    "Add a more personal opening",
    "Make the P.S. more engaging",
    "Adjust tone to be warmer/more professional",
  ],
  blog: [
    "Improve SEO for a specific keyword",
    "Add a more compelling hook",
    "Break up long paragraphs",
    "Add more subheadings",
    "Include a story or example",
    "Strengthen the conclusion",
  ],
  facebook: [
    "Make it more conversational",
    "Add a thought-provoking question",
    "Make it more shareable",
    "Add emotional appeal",
    "Shorten for better engagement",
  ],
  instagram: [
    "Improve the first line hook",
    "Optimize hashtags for reach",
    "Add emoji strategically",
    "Make it more personal",
    "Add a clear call-to-action",
  ],
  linkedin: [
    "Add a professional insight",
    "Make it more thought-leadership focused",
    "Add data or statistics",
    "Strengthen the opening statement",
    "Make it more discussion-worthy",
  ],
  twitter: [
    "Make it more quotable",
    "Create a thread version",
    "Add more punch to the first line",
    "Make it controversial (in a good way)",
    "Optimize for retweets",
  ],
  tiktok: [
    "Strengthen the hook (first 3 seconds)",
    "Add more energy to the script",
    "Include trend-friendly elements",
    "Make the payoff more satisfying",
    "Add visual/transition suggestions",
  ],
}

export async function POST(request: NextRequest) {
  try {
    const {
      contentId,
      contentType,
      currentContent,
      messages,
      workspaceId,
    } = await request.json()

    if (!contentType || !currentContent || !messages || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      )
    }

    // Fetch workspace branding for brand context
    const supabase = createAdminClient()
    let brandContext = ''
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('branding')
      .eq('id', workspaceId)
      .single()

    if (workspace?.branding) {
      const branding = workspace.branding as BrandProfile
      brandContext = generateBrandContext(branding)
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Build the system prompt with brand context
    const systemPromptWithBrand = SYSTEM_PROMPT + (brandContext ? `\n\n**Brand/Voice Guidelines for this organization**:\n${brandContext}\n\nEnsure all content refinements maintain these brand guidelines.` : '')

    // Build the conversation context
    const contextPrompt = `Current content being edited (${contentType}):

${typeof currentContent === 'string' ? currentContent : JSON.stringify(currentContent, null, 2)}

---

Help the user refine this content based on their requests.`

    // Build messages array for Claude
    const claudeMessages: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: contextPrompt },
      { role: 'assistant', content: "I've reviewed your content. What would you like me to help you improve or change?" },
      ...messages.map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPromptWithBrand,
      messages: claudeMessages,
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Check if there's revised content to extract
    let revisedContent: string | null = null
    const revisedMatch = responseText.match(/<revised_content>([\s\S]*?)<\/revised_content>/)
    if (revisedMatch) {
      revisedContent = revisedMatch[1].trim()
    }

    // If we have a contentId and revised content, update the database
    if (contentId && revisedContent) {
      await supabase
        .from('generated_content')
        .update({
          raw_text: revisedContent,
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', contentId)
        .eq('workspace_id', workspaceId)
    }

    // Get coaching prompts for this content type
    const suggestions = COACHING_PROMPTS[contentType] || COACHING_PROMPTS.facebook

    return NextResponse.json({
      success: true,
      message: responseText,
      revisedContent,
      suggestions,
      tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    })
  } catch (error) {
    console.error('Content chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch coaching suggestions for a content type
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const contentType = searchParams.get('contentType') || 'facebook'

  return NextResponse.json({
    suggestions: COACHING_PROMPTS[contentType] || COACHING_PROMPTS.facebook,
  })
}

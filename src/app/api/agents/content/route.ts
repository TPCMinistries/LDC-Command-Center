import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrandProfile, generateBrandContext } from '@/types/brand'

// Platform-specific prompts
const PLATFORM_PROMPTS: Record<string, string> = {
  email: `Create an email that can be sent to a community/newsletter list or to an individual.
- Subject line: Compelling and clear (under 50 chars)
- Preview text: First line that shows in inbox (under 100 chars)
- Opening: Personal, warm greeting
- Body: 200-400 words, conversational but purposeful
- Structure: Hook → Main message → Story/illustration → Call-to-action
- Closing: Warm sign-off with clear next step
- Include a P.S. line for additional engagement
- Tone: Personal, like writing to a friend who shares your values`,

  blog: `Create a blog post that is SEO-optimized and provides genuine value.
- Title: Compelling, includes keywords (under 60 chars)
- Meta description: For search results (under 160 chars)
- Introduction: Hook the reader, preview what they'll learn
- Body: 800-1200 words, well-structured with headers (H2, H3)
- Include 3-5 subheadings that could stand alone as insights
- Practical takeaways or action items
- Conclusion: Summarize key points, call-to-action
- Suggest 5-8 SEO keywords/tags
- Internal linking suggestions (topics to link to)`,

  facebook: `Create a Facebook post that is engaging, conversational, and encourages interaction.
- Length: 100-300 words (can be longer for meaningful content)
- Include a hook in the first line
- Use line breaks for readability
- End with a question or call-to-action to encourage comments
- Can include relevant emojis sparingly
- Suggest relevant hashtags (3-5)`,

  instagram: `Create an Instagram caption that is visually-minded and engaging.
- Length: 125-200 words for the main caption
- Start with a strong hook (first line shows in feed)
- Use line breaks and spacing for readability
- Include a clear call-to-action
- Provide 20-30 relevant hashtags (mix of popular and niche)
- Suggest what kind of image/graphic would pair well`,

  linkedin: `Create a LinkedIn post that is professional yet personable, establishing thought leadership.
- Length: 150-300 words
- Start with a bold statement or insight
- Use short paragraphs (1-2 sentences each)
- Include a professional insight or lesson learned
- End with a question to spark discussion
- Minimal hashtags (3-5 professional ones)
- Tone: Authoritative but approachable`,

  twitter: `Create a Twitter/X post or thread that is punchy and shareable.
- If single tweet: Max 280 characters, impactful and complete
- If thread: Create 3-5 connected tweets, each under 280 chars
- Start with the most compelling point
- Use clear, direct language
- Include 1-2 relevant hashtags
- Make it quotable/retweetable`,

  tiktok: `Create a TikTok script that is hook-driven and trend-aware.
- Length: 30-60 seconds when spoken
- Start with a STRONG hook in first 3 seconds ("Here's something most people don't know...")
- Use conversational, energetic language
- Structure: Hook → Story/Content → Payoff/CTA
- Include suggestions for visual elements or transitions
- End with engagement prompt (comment, follow, share)`,
}

const SERMON_PROMPT = `You are helping develop a sermon outline from prophetic/spiritual content. Create a comprehensive sermon outline that includes:

1. **Title**: A compelling sermon title
2. **Theme**: The central message/theme
3. **Scripture Foundation**: Primary scripture passage(s) with brief context
4. **Introduction**:
   - Opening hook/illustration
   - Bridge to the main topic
   - Preview of main points

5. **Main Points** (3-4 points):
   For each point include:
   - Point title
   - Supporting scripture
   - Explanation
   - Illustration or example
   - Application

6. **Transitions**: How to move between points

7. **Conclusion**:
   - Summary of key takeaways
   - Call to action
   - Closing prayer points

8. **Additional Resources**:
   - Related scriptures for deeper study
   - Discussion questions for small groups

Format the response as structured JSON.`

const SOCIAL_SYSTEM_PROMPT = `You are a social media content strategist for faith-based and purpose-driven organizations. Your role is to transform spiritual insights, business wisdom, and meaningful content into engaging social media posts.

Guidelines:
- Maintain authenticity and the original message's essence
- Adapt tone and style for each platform while keeping the core message
- Be inspiring without being preachy
- Make content shareable and relatable
- Consider the audience on each platform`

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const {
      sourceType,
      sourceId,
      contentType,
      workspaceId,
      customContext
    } = await request.json()

    if (!sourceId || !contentType || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: sourceId, contentType, workspaceId' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Fetch the source content based on type
    let sourceContent: {
      title?: string
      summary?: string
      transcript?: string
      themes?: string[]
      scriptures?: string[]
      key_insights?: string[]
      category?: string
      content?: string
    } | null = null
    let userId: string | null = null

    if (sourceType === 'prophetic_note') {
      const { data: note, error } = await supabase
        .from('prophetic_notes')
        .select('*')
        .eq('id', sourceId)
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !note) {
        return NextResponse.json({ error: 'Source content not found' }, { status: 404 })
      }

      sourceContent = {
        title: note.title,
        summary: note.summary,
        transcript: note.transcript,
        themes: note.themes as string[],
        scriptures: note.scriptures as string[],
        key_insights: note.key_insights as string[],
        category: note.category,
      }
      userId = note.user_id
    } else {
      // Add support for other source types here (ideas, documents, etc.)
      return NextResponse.json({ error: 'Unsupported source type' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    // Fetch workspace branding for brand context
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

    let systemPrompt: string
    let userPrompt: string
    let responseFormat: 'json' | 'text' = 'json'

    if (contentType === 'sermon_outline') {
      systemPrompt = SERMON_PROMPT + (brandContext ? `\n\n**Brand/Voice Guidelines**:\n${brandContext}` : '')
      userPrompt = `Create a sermon outline from this prophetic note:

**Title**: ${sourceContent.title || 'Untitled'}
**Category**: ${sourceContent.category || 'General'}
**Summary**: ${sourceContent.summary || 'No summary'}

**Key Insights**:
${(sourceContent.key_insights || []).map(i => `- ${i}`).join('\n')}

**Themes**: ${(sourceContent.themes || []).join(', ')}
**Scriptures Referenced**: ${(sourceContent.scriptures || []).join(', ')}

**Full Transcript**:
${sourceContent.transcript || 'No transcript available'}

${customContext ? `\n**Additional Context**: ${customContext}` : ''}

Please create a comprehensive sermon outline in JSON format.`
    } else if (PLATFORM_PROMPTS[contentType]) {
      systemPrompt = SOCIAL_SYSTEM_PROMPT + (brandContext ? `\n\n**Brand/Voice Guidelines for this organization**:\n${brandContext}\n\nEnsure all content aligns with these brand guidelines while maintaining platform best practices.` : '')
      userPrompt = `${PLATFORM_PROMPTS[contentType]}

---

**Source Content**:
Title: ${sourceContent.title || 'Untitled'}
Summary: ${sourceContent.summary || 'No summary'}

Key Insights:
${(sourceContent.key_insights || []).map(i => `- ${i}`).join('\n')}

Themes: ${(sourceContent.themes || []).join(', ')}
${(sourceContent.scriptures || []).length > 0 ? `Scriptures: ${sourceContent.scriptures?.join(', ')}` : ''}

${customContext ? `Additional Context/Instructions: ${customContext}` : ''}

---

${contentType === 'email' ? `Generate the email content. Return as JSON with these fields:
- "subject": Email subject line
- "previewText": Preview text for inbox
- "body": Full email body with greeting and sign-off
- "ps": P.S. line for additional engagement
- "callToAction": What you want the reader to do` :
contentType === 'blog' ? `Generate the blog post. Return as JSON with these fields:
- "title": Blog post title
- "metaDescription": SEO meta description
- "body": Full blog post content with markdown headers (## for H2, ### for H3)
- "keywords": Array of SEO keywords
- "callToAction": Closing call-to-action` :
`Generate the ${contentType} content. Return as JSON with these fields:
- "post": The main post content
- "hashtags": Array of hashtags
- "imageIdea": Suggestion for accompanying visual (if applicable)
- "bestTimeToPost": Suggested posting time
- "engagementTip": Tip for maximizing engagement`}`
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON response
    let parsedContent
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0])
      } else {
        parsedContent = { raw: responseText }
      }
    } catch {
      parsedContent = { raw: responseText }
    }

    const durationMs = Date.now() - startTime

    // Create a plain text version
    let rawText = ''
    let contentTitle = ''

    if (contentType === 'sermon_outline') {
      rawText = responseText
      contentTitle = parsedContent.title || `Sermon: ${sourceContent.title}`
    } else if (contentType === 'email') {
      rawText = `Subject: ${parsedContent.subject || 'No subject'}\n\n${parsedContent.body || ''}`
      if (parsedContent.ps) {
        rawText += `\n\nP.S. ${parsedContent.ps}`
      }
      contentTitle = parsedContent.subject || 'Email'
    } else if (contentType === 'blog') {
      rawText = `# ${parsedContent.title || 'Blog Post'}\n\n${parsedContent.body || ''}`
      contentTitle = parsedContent.title || 'Blog Post'
    } else if (parsedContent.post) {
      rawText = parsedContent.post
      if (parsedContent.hashtags?.length) {
        rawText += '\n\n' + parsedContent.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ')
      }
      contentTitle = `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} Post`
    }

    // Save to database
    const { data: saved, error: saveError } = await supabase
      .from('generated_content')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        source_type: sourceType,
        source_id: sourceId,
        content_type: contentType,
        title: contentTitle,
        content: parsedContent,
        raw_text: rawText,
        model_used: 'claude-sonnet-4-20250514',
        tokens_used: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
        generation_time_ms: durationMs,
        status: 'draft',
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('Failed to save generated content:', saveError)
      // Still return the content even if save fails
    }

    // Log agent activity
    await supabase.from('agent_logs').insert({
      workspace_id: workspaceId,
      agent_type: 'content',
      action: `generate_${contentType}`,
      input_summary: `Generated ${contentType} from ${sourceType}`,
      output_summary: `Created ${contentType} content`,
      tokens_used: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
      duration_ms: durationMs,
      status: 'success',
      metadata: { source_id: sourceId, content_type: contentType },
    })

    return NextResponse.json({
      success: true,
      contentId: saved?.id,
      contentType,
      content: parsedContent,
      rawText,
      duration_ms: durationMs,
    })
  } catch (error) {
    console.error('Content agent error:', error)
    return NextResponse.json(
      { error: 'Failed to generate content', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch generated content for a source
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('sourceId')
    const workspaceId = searchParams.get('workspaceId')

    if (!sourceId || !workspaceId) {
      return NextResponse.json({ error: 'Missing sourceId or workspaceId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('generated_content')
      .select('*')
      .eq('source_id', sourceId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
    }

    return NextResponse.json({ content: data })
  } catch (error) {
    console.error('Error fetching generated content:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

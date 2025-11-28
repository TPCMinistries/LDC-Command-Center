import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface ParsedGrant {
  title: string
  agency: string
  description: string
  deadline: string | null
  fundingAmount: string | null
  eligibility: string[]
  requirements: string[]
  contactInfo: string | null
  sourceUrl: string | null
  category: string
}

// POST - Parse and import a grant from pasted text or URL
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, content, sourceUrl, sourceType } = body

    if (!workspaceId || !content) {
      return NextResponse.json({ error: 'Missing workspaceId or content' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use Claude to parse the grant information
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `You are a grant/RFP parsing specialist. Analyze the following content and extract structured grant information.

SOURCE TYPE: ${sourceType || 'Unknown'}
SOURCE URL: ${sourceUrl || 'Not provided'}

CONTENT TO PARSE:
${content}

---

Extract and return a JSON object with the following fields:
- title: The official title of the grant/RFP opportunity
- agency: The funding agency or organization
- description: A comprehensive summary of the opportunity (2-4 sentences)
- deadline: The application deadline (format: YYYY-MM-DD, or null if not found)
- fundingAmount: The funding amount or range (e.g., "$500,000", "$100,000-$250,000", or null)
- eligibility: Array of eligibility requirements (who can apply)
- requirements: Array of key requirements or deliverables
- contactInfo: Contact information for questions (email, phone, or name)
- sourceUrl: The URL where this grant was found (use provided URL or extract from content)
- category: One of: "federal", "state", "city", "foundation", "corporate", "other"

Be thorough in extracting all relevant information. If a field cannot be determined, use null for strings or empty array for arrays.

Only output valid JSON, no other text or explanation.`,
        },
      ],
    })

    // Parse the response
    const responseContent = message.content[0]
    if (responseContent.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    let parsed: ParsedGrant
    try {
      const jsonMatch = responseContent.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Parse error:', parseError)
      return NextResponse.json({ error: 'Failed to parse grant information' }, { status: 500 })
    }

    // Generate a unique ID for this imported grant
    const importId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Save to database
    const { data: rfp, error } = await supabase
      .from('rfps')
      .insert({
        workspace_id: workspaceId,
        external_id: importId,
        title: parsed.title,
        description: parsed.description,
        agency: parsed.agency,
        notice_type: 'Grant',
        response_deadline: parsed.deadline,
        funding_amount: parsed.fundingAmount,
        eligibility_summary: parsed.eligibility?.join('; '),
        requirements: parsed.requirements,
        source_url: parsed.sourceUrl || sourceUrl,
        source_type: sourceType || parsed.category || 'manual',
        status: 'new',
        metadata: {
          imported_at: new Date().toISOString(),
          imported_by: user.id,
          contact_info: parsed.contactInfo,
          raw_content_length: content.length,
        },
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving imported grant:', error)
      return NextResponse.json({ error: 'Failed to save grant' }, { status: 500 })
    }

    // Log the import
    await supabase.from('agent_logs').insert({
      workspace_id: workspaceId,
      agent_type: 'rfp',
      action: 'import_grant',
      input_summary: `Imported grant: ${parsed.title?.slice(0, 50)}...`,
      output_summary: `Successfully parsed and saved grant`,
      status: 'success',
      metadata: { sourceType, sourceUrl, parsedTitle: parsed.title },
    })

    return NextResponse.json({
      rfp,
      parsed,
      message: 'Grant successfully imported and parsed',
    })
  } catch (error) {
    console.error('Grant import error:', error)
    return NextResponse.json(
      { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

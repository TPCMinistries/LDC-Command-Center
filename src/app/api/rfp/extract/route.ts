import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { PDFParse } from 'pdf-parse'

const anthropic = new Anthropic()

// Helper to extract text from PDF buffer
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    await parser.destroy()
    return result.text
  } catch (error) {
    console.error('PDF parsing error:', error)
    throw new Error('Failed to parse PDF document')
  }
}

// Helper to extract text from DOCX (basic approach)
async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  // DOCX files are ZIP archives containing XML
  // For a more robust solution, consider using mammoth.js
  // For now, we'll extract raw text from the XML
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer)
    const documentXml = await zip.file('word/document.xml')?.async('string')

    if (!documentXml) {
      throw new Error('Could not find document.xml in DOCX')
    }

    // Extract text content from XML tags
    const textContent = documentXml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return textContent
  } catch (error) {
    console.error('DOCX parsing error:', error)
    throw new Error('Failed to parse DOCX document')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fileUrl, fileName, workspaceId } = body

    if (!fileUrl || !workspaceId) {
      return NextResponse.json({ error: 'Missing fileUrl or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Download the file from Supabase Storage
    let documentText = ''
    const fileExtension = fileName?.toLowerCase().split('.').pop() || ''

    try {
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Extract text based on file type
      if (fileExtension === 'pdf') {
        documentText = await extractTextFromPDF(buffer)
      } else if (fileExtension === 'docx') {
        documentText = await extractTextFromDOCX(buffer)
      } else if (fileExtension === 'doc') {
        // .doc files are harder to parse - fall back to filename-based extraction
        documentText = ''
      } else {
        // For other file types, try to read as text
        documentText = buffer.toString('utf-8')
      }
    } catch (downloadError) {
      console.error('File download/parse error:', downloadError)
      // Fall back to filename-based extraction if file parsing fails
      documentText = ''
    }

    // Truncate document text if too long (Claude has context limits)
    const maxTextLength = 100000 // ~100k characters
    if (documentText.length > maxTextLength) {
      documentText = documentText.substring(0, maxTextLength) + '\n...[Document truncated]...'
    }

    // Use Claude to extract structured data from the document
    const hasDocumentContent = documentText.trim().length > 100

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: hasDocumentContent
            ? `You are an RFP/Grant extraction specialist. Analyze the following document and extract key information.

DOCUMENT FILENAME: ${fileName}

DOCUMENT CONTENT:
${documentText}

---

Extract and return a JSON object with the following fields:
- title: The official title of the RFP/Grant opportunity
- agency: The issuing agency or organization
- description: A comprehensive summary of what this opportunity is about (2-4 sentences)
- deadline: The submission deadline (format: YYYY-MM-DD, or null if not found)
- fundingAmount: The funding amount or range (e.g., "$500,000", "$100,000-$250,000", or null)
- requirements: Array of 5-10 key requirements or deliverables
- eligibilityCriteria: Array of eligibility requirements (who can apply)
- keyDates: Array of objects with {label: string, date: string} for important dates
- evaluationCriteria: Array of how proposals will be evaluated (if mentioned)
- contactInfo: Contact information for questions (email, phone, or name)
- naicsCode: NAICS code if mentioned (federal contracts)
- setAside: Set-aside type if mentioned (e.g., "Small Business", "8(a)", "HUBZone")

Only output valid JSON, no other text or explanation.`
            : `You are an RFP extraction assistant. Based on the filename "${fileName}", generate realistic placeholder extracted data for an RFP document.

Note: The actual document content could not be parsed, so provide best-guess information based on the filename.

Return a JSON object with these fields:
- title: A realistic RFP title based on the filename
- agency: The likely issuing agency (if detectable from filename)
- description: A brief description of what the RFP might be about
- deadline: A realistic deadline date (format: YYYY-MM-DD, make it 30-60 days from now)
- fundingAmount: null (unknown)
- requirements: Array of 3-5 generic requirements to fill in
- eligibilityCriteria: Array of 2-3 common eligibility criteria to review
- keyDates: Empty array
- evaluationCriteria: Empty array
- contactInfo: null
- naicsCode: null
- setAside: null

Only output valid JSON, no other text.`,
        },
      ],
    })

    // Parse the response
    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    let extracted
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Parse error:', parseError)
      // Return placeholder data if parsing fails
      extracted = {
        title: fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        agency: 'Unknown Agency',
        description: 'RFP document uploaded for review',
        deadline: null,
        fundingAmount: null,
        requirements: ['Review document for specific requirements'],
        eligibilityCriteria: ['Review document for eligibility criteria'],
        keyDates: [],
        evaluationCriteria: [],
        contactInfo: null,
        naicsCode: null,
        setAside: null,
      }
    }

    return NextResponse.json({
      extracted,
      documentParsed: hasDocumentContent,
      characterCount: documentText.length
    })
  } catch (error) {
    console.error('RFP extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract RFP data' }, { status: 500 })
  }
}

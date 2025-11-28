import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  TableOfContents,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx'

interface Section {
  id: string
  section_type: string
  title: string
  content: string
  word_count: number
  sort_order: number
}

interface Proposal {
  id: string
  title: string
  funder_name?: string
  program_name?: string
  requested_amount?: number
  submission_deadline?: string
  target_population?: string
  service_area?: string
  rfp?: {
    title: string
    agency?: string
  }
}

// Helper to convert markdown-like content to DOCX paragraphs
function contentToParagraphs(content: string): Paragraph[] {
  if (!content) return [new Paragraph({ text: '' })]

  const paragraphs: Paragraph[] = []
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Skip empty lines but add spacing
    if (!trimmedLine) {
      paragraphs.push(new Paragraph({ text: '' }))
      continue
    }

    // Headers
    if (trimmedLine.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmedLine.replace('### ', ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      )
    } else if (trimmedLine.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmedLine.replace('## ', ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      )
    } else if (trimmedLine.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmedLine.replace('# ', ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 140 },
        })
      )
    }
    // Bullet points
    else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      paragraphs.push(
        new Paragraph({
          text: trimmedLine.substring(2),
          bullet: { level: 0 },
          spacing: { before: 60, after: 60 },
        })
      )
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmedLine)) {
      paragraphs.push(
        new Paragraph({
          text: trimmedLine.replace(/^\d+\.\s/, ''),
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: { before: 60, after: 60 },
        })
      )
    }
    // Regular paragraphs with bold/italic handling
    else {
      const children: TextRun[] = []

      // Simple bold/italic parsing
      let text = trimmedLine
      const boldRegex = /\*\*(.*?)\*\*/g
      const italicRegex = /\*(.*?)\*/g

      // Replace bold
      text = text.replace(boldRegex, '<<BOLD>>$1<<ENDBOLD>>')
      // Replace italic (but not the ones we just marked as bold)
      text = text.replace(italicRegex, '<<ITALIC>>$1<<ENDITALIC>>')

      // Split and create text runs
      const parts = text.split(/(<<BOLD>>|<<ENDBOLD>>|<<ITALIC>>|<<ENDITALIC>>)/)
      let isBold = false
      let isItalic = false

      for (const part of parts) {
        if (part === '<<BOLD>>') {
          isBold = true
        } else if (part === '<<ENDBOLD>>') {
          isBold = false
        } else if (part === '<<ITALIC>>') {
          isItalic = true
        } else if (part === '<<ENDITALIC>>') {
          isItalic = false
        } else if (part) {
          children.push(
            new TextRun({
              text: part,
              bold: isBold,
              italics: isItalic,
            })
          )
        }
      }

      paragraphs.push(
        new Paragraph({
          children: children.length > 0 ? children : [new TextRun(trimmedLine)],
          spacing: { before: 120, after: 120 },
        })
      )
    }
  }

  return paragraphs
}

// GET - Export proposal to DOCX
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const proposalId = searchParams.get('proposalId')
    const workspaceId = searchParams.get('workspaceId')
    const format = searchParams.get('format') || 'docx'
    const includeToc = searchParams.get('toc') === 'true'
    const includeCoverPage = searchParams.get('cover') !== 'false'

    if (!proposalId || !workspaceId) {
      return NextResponse.json({ error: 'Missing proposalId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch proposal
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select(`
        *,
        rfp:rfp_id (
          title,
          agency
        )
      `)
      .eq('id', proposalId)
      .eq('workspace_id', workspaceId)
      .single()

    if (proposalError || !proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Fetch sections
    const { data: sections, error: sectionsError } = await supabase
      .from('proposal_sections')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true })

    if (sectionsError) {
      return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 })
    }

    // Build document sections
    const documentSections: Paragraph[] = []

    // Cover page
    if (includeCoverPage) {
      documentSections.push(
        new Paragraph({ text: '', spacing: { before: 2000 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: proposal.title || 'Untitled Proposal',
              bold: true,
              size: 56,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: '', spacing: { before: 400 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: proposal.program_name ? `Program: ${proposal.program_name}` : '',
              size: 28,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: '', spacing: { before: 200 } }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Submitted to: ${proposal.funder_name || proposal.rfp?.agency || 'Funder'}`,
              size: 28,
            }),
          ],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: '', spacing: { before: 200 } }),
        proposal.requested_amount
          ? new Paragraph({
              children: [
                new TextRun({
                  text: `Requested Amount: $${proposal.requested_amount.toLocaleString()}`,
                  size: 24,
                }),
              ],
              alignment: AlignmentType.CENTER,
            })
          : new Paragraph({ text: '' }),
        new Paragraph({ text: '', spacing: { before: 200 } }),
        proposal.submission_deadline
          ? new Paragraph({
              children: [
                new TextRun({
                  text: `Submission Date: ${new Date(proposal.submission_deadline).toLocaleDateString()}`,
                  size: 24,
                }),
              ],
              alignment: AlignmentType.CENTER,
            })
          : new Paragraph({ text: '' }),
        new Paragraph({
          children: [new PageBreak()],
        })
      )
    }

    // Table of contents placeholder
    if (includeToc && sections && sections.length > 0) {
      documentSections.push(
        new Paragraph({
          text: 'Table of Contents',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ text: '', spacing: { before: 200 } })
      )

      // Simple TOC (actual TOC requires more complex setup)
      for (const section of sections) {
        documentSections.push(
          new Paragraph({
            text: `${section.title}`,
            spacing: { before: 60, after: 60 },
          })
        )
      }

      documentSections.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      )
    }

    // Content sections
    if (sections && sections.length > 0) {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]

        // Section heading
        documentSections.push(
          new Paragraph({
            text: section.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        )

        // Section content
        if (section.content) {
          documentSections.push(...contentToParagraphs(section.content))
        } else {
          documentSections.push(
            new Paragraph({
              text: '[Section content not yet written]',
              spacing: { before: 120, after: 120 },
            })
          )
        }

        // Page break between sections (except last)
        if (i < sections.length - 1) {
          documentSections.push(
            new Paragraph({
              children: [new PageBreak()],
            })
          )
        }
      }
    } else {
      documentSections.push(
        new Paragraph({
          text: 'No sections have been created for this proposal yet.',
          spacing: { before: 200 },
        })
      )
    }

    // Create document
    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: NumberFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.LEFT,
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: proposal.title || 'Proposal',
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: documentSections,
        },
      ],
    })

    // Generate buffer
    const buffer = await Packer.toBuffer(doc)

    // Create filename
    const filename = `${(proposal.title || 'proposal').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}_${new Date().toISOString().split('T')[0]}.docx`

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

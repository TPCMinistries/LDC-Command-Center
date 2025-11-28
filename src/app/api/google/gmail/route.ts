import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailClient } from '@/lib/google/client'

// Helper to decode base64 URL
function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

// Helper to encode base64 URL
function encodeBase64Url(str: string): string {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const query = searchParams.get('q') || ''
    const maxResults = parseInt(searchParams.get('maxResults') || '20')
    const pageToken = searchParams.get('pageToken')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gmail = await getGmailClient(user.id, workspaceId)

    if (!gmail) {
      return NextResponse.json({ error: 'Google not connected', connected: false }, { status: 400 })
    }

    // List messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query || 'in:inbox',
      maxResults,
      pageToken: pageToken || undefined,
    })

    const messages = listResponse.data.messages || []

    // Get details for each message
    const emails = await Promise.all(
      messages.slice(0, maxResults).map(async (msg) => {
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          })

          const headers = detail.data.payload?.headers || []
          const getHeader = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

          return {
            id: msg.id,
            threadId: msg.threadId,
            snippet: detail.data.snippet,
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject'),
            date: getHeader('Date'),
            labelIds: detail.data.labelIds,
            isUnread: detail.data.labelIds?.includes('UNREAD'),
          }
        } catch {
          return null
        }
      })
    )

    return NextResponse.json({
      emails: emails.filter(Boolean),
      nextPageToken: listResponse.data.nextPageToken,
      connected: true,
    })
  } catch (error) {
    console.error('Gmail fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, to, subject, body: emailBody, threadId } = body

    if (!workspaceId || !to || !subject || !emailBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gmail = await getGmailClient(user.id, workspaceId)

    if (!gmail) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 400 })
    }

    // Get user's email
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const fromEmail = profile.data.emailAddress

    // Construct email
    const email = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      emailBody,
    ].join('\r\n')

    const encodedEmail = encodeBase64Url(email)

    // Send email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
        threadId: threadId || undefined,
      },
    })

    return NextResponse.json({
      messageId: response.data.id,
      threadId: response.data.threadId,
    })
  } catch (error) {
    console.error('Gmail send error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}

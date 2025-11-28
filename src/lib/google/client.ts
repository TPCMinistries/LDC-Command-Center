import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'

// Google OAuth2 client configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
  : 'http://localhost:3002/api/google/callback'

// Scopes for Google APIs
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

// Create OAuth2 client
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  )
}

// Generate auth URL for user to connect their Google account
export function getAuthUrl(state: string) {
  const oauth2Client = createOAuth2Client()

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent', // Force consent to get refresh token
    state,
  })
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

// Get authenticated OAuth2 client for a user
export async function getAuthenticatedClient(userId: string, workspaceId: string) {
  const supabase = await createClient()

  // Get stored tokens
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('provider', 'google')
    .single()

  if (error || !integration) {
    return null
  }

  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.expires_at ? new Date(integration.expires_at).getTime() : undefined,
  })

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await supabase
        .from('integrations')
        .update({
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id)
    }
  })

  return oauth2Client
}

// Get Calendar API client
export async function getCalendarClient(userId: string, workspaceId: string) {
  const auth = await getAuthenticatedClient(userId, workspaceId)
  if (!auth) return null

  return google.calendar({ version: 'v3', auth })
}

// Get Gmail API client
export async function getGmailClient(userId: string, workspaceId: string) {
  const auth = await getAuthenticatedClient(userId, workspaceId)
  if (!auth) return null

  return google.gmail({ version: 'v1', auth })
}

// Get user info
export async function getGoogleUserInfo(accessToken: string) {
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data } = await oauth2.userinfo.get()

  return data
}

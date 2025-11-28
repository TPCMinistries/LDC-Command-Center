import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, getGoogleUserInfo, GOOGLE_SCOPES } from '@/lib/google/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle error from Google
    if (error) {
      console.error('Google OAuth error:', error)
      return NextResponse.redirect(
        new URL('/workspace/default/settings?error=google_auth_failed', request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/workspace/default/settings?error=missing_params', request.url)
      )
    }

    // Decode state
    let stateData: { userId: string; workspaceId: string }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch {
      return NextResponse.redirect(
        new URL('/workspace/default/settings?error=invalid_state', request.url)
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || user.id !== stateData.userId) {
      return NextResponse.redirect(
        new URL('/workspace/default/settings?error=unauthorized', request.url)
      )
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL('/workspace/default/settings?error=token_exchange_failed', request.url)
      )
    }

    // Get Google user info
    const googleUser = await getGoogleUserInfo(tokens.access_token)

    // Store or update integration
    const { error: upsertError } = await supabase
      .from('integrations')
      .upsert(
        {
          user_id: user.id,
          workspace_id: stateData.workspaceId,
          provider: 'google',
          provider_user_id: googleUser.id,
          provider_email: googleUser.email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          scopes: GOOGLE_SCOPES,
          metadata: {
            name: googleUser.name,
            picture: googleUser.picture,
          },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,workspace_id,provider',
        }
      )

    if (upsertError) {
      console.error('Failed to store integration:', upsertError)
      return NextResponse.redirect(
        new URL('/workspace/default/settings?error=storage_failed', request.url)
      )
    }

    // Redirect to settings with success message
    return NextResponse.redirect(
      new URL(`/workspace/${stateData.workspaceId}/settings?google=connected`, request.url)
    )
  } catch (error) {
    console.error('Google callback error:', error)
    return NextResponse.redirect(
      new URL('/workspace/default/settings?error=callback_failed', request.url)
    )
  }
}

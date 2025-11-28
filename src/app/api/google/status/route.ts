import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for existing integration
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('id, provider_email, metadata, created_at, scopes')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('provider', 'google')
      .single()

    if (error || !integration) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      email: integration.provider_email,
      name: (integration.metadata as { name?: string })?.name,
      picture: (integration.metadata as { picture?: string })?.picture,
      connectedAt: integration.created_at,
      scopes: integration.scopes,
    })
  } catch (error) {
    console.error('Google status error:', error)
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
  }
}

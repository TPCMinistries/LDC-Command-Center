import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await request.json()

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete the integration
    const { error: deleteError } = await supabase
      .from('integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('provider', 'google')

    if (deleteError) {
      console.error('Failed to disconnect:', deleteError)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    // Also clean up cached data
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('provider', 'google')
      .single()

    if (integration) {
      // Delete cached calendar events
      await supabase
        .from('calendar_events_cache')
        .delete()
        .eq('integration_id', integration.id)

      // Delete cached email threads
      await supabase
        .from('email_threads_cache')
        .delete()
        .eq('integration_id', integration.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Google disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}

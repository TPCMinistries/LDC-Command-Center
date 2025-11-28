import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl } from '@/lib/google/client'

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

    // Create state with user and workspace info
    const state = Buffer.from(
      JSON.stringify({ userId: user.id, workspaceId })
    ).toString('base64')

    // Generate Google OAuth URL
    const authUrl = getAuthUrl(state)

    return NextResponse.json({ url: authUrl })
  } catch (error) {
    console.error('Google connect error:', error)
    return NextResponse.json({ error: 'Failed to initiate connection' }, { status: 500 })
  }
}

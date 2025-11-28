import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Agent Logs API
 *
 * Fetches activity logs from all AI agents for display in the Agents Hub
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const agentType = searchParams.get('agentType')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from('agent_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (agentType) {
      query = query.eq('agent_type', agentType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching agent logs:', error)
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
    }

    return NextResponse.json({ logs: data || [] })
  } catch (error) {
    console.error('Agent logs error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

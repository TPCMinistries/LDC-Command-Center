import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const workspaceId = searchParams.get('workspaceId')
    const type = searchParams.get('type') // 'all', 'proposals', 'rfps', 'partners'

    if (!query || !workspaceId) {
      return NextResponse.json({ error: 'Missing query or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchTerm = `%${query.toLowerCase()}%`
    const results: {
      proposals: unknown[]
      rfps: unknown[]
      partners: unknown[]
    } = {
      proposals: [],
      rfps: [],
      partners: [],
    }

    // Search proposals
    if (type === 'all' || type === 'proposals') {
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id, title, status, created_at, rfp_id')
        .eq('workspace_id', workspaceId)
        .or(`title.ilike.${searchTerm}`)
        .order('updated_at', { ascending: false })
        .limit(10)

      results.proposals = (proposals || []).map(p => ({
        ...p,
        type: 'proposal',
        icon: 'FileText',
        href: `/proposals/${p.id}`,
      }))
    }

    // Search RFPs
    if (type === 'all' || type === 'rfps') {
      const { data: rfps } = await supabase
        .from('rfps')
        .select('id, title, agency, status, response_deadline, alignment_score')
        .eq('workspace_id', workspaceId)
        .or(`title.ilike.${searchTerm},agency.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(10)

      results.rfps = (rfps || []).map(r => ({
        ...r,
        type: 'rfp',
        icon: 'Radar',
        href: `/rfp`,
      }))
    }

    // Search partners
    if (type === 'all' || type === 'partners') {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, name, organization_type, capabilities, status')
        .eq('workspace_id', workspaceId)
        .or(`name.ilike.${searchTerm},organization_type.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(10)

      results.partners = (partners || []).map(p => ({
        ...p,
        type: 'partner',
        icon: 'Handshake',
        href: `/partners`,
      }))
    }

    // Flatten and sort by relevance (simple scoring)
    const allResults = [
      ...results.proposals,
      ...results.rfps,
      ...results.partners,
    ]

    return NextResponse.json({
      results: allResults,
      counts: {
        proposals: results.proposals.length,
        rfps: results.rfps.length,
        partners: results.partners.length,
        total: allResults.length,
      },
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

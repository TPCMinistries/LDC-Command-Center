import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SamGovOpportunity {
  noticeId: string
  title: string
  description?: string
  department?: string
  agency?: string
  office?: string
  postedDate?: string
  responseDeadLine?: string
  type?: string
  setAside?: string
  naicsCode?: string
  placeOfPerformance?: {
    city?: string
    state?: string
    country?: string
  }
  pointOfContact?: {
    email?: string
    phone?: string
    fullName?: string
  }
  links?: Array<{
    rel: string
    href: string
  }>
}

interface SamGovResponse {
  totalRecords: number
  opportunitiesData: SamGovOpportunity[]
}

interface GrantsGovOpportunity {
  opportunityId: string
  opportunityNumber: string
  opportunityTitle: string
  agencyName: string
  description?: string
  postDate?: string
  closeDate?: string
  awardCeiling?: number
  awardFloor?: number
  category?: string
  eligibility?: string
}

interface GrantsGovResponse {
  totalCount: number
  opportunities: GrantsGovOpportunity[]
}

// USAspending.gov types
interface USAspendingAward {
  Award_ID: string
  Recipient_Name: string
  Award_Amount: number
  Description: string
  Start_Date: string
  End_Date: string
  Awarding_Agency: string
  Awarding_Sub_Agency: string
  Award_Type: string
  CFDA_Number: string
  CFDA_Title: string
  Place_of_Performance_City: string
  Place_of_Performance_State: string
}

interface USAspendingResponse {
  results: USAspendingAward[]
  page_metadata: {
    total: number
    page: number
    hasNext: boolean
  }
}

// ProPublica Nonprofit types
interface ProPublicaOrg {
  ein: string
  name: string
  city: string
  state: string
  ntee_code: string
  income_amount: number
  revenue_amount: number
  asset_amount: number
  organization_type: string
}

interface ProPublicaResponse {
  total_results: number
  organizations: ProPublicaOrg[]
}

// Standard opportunity format
interface StandardOpportunity {
  id: string
  title: string
  agency: string
  description: string
  postedDate: string
  dueDate: string
  type: string
  setAside: string
  naicsCode: string
  fundingAmount?: string
  eligibility?: string
  sourceUrl: string
  source: string
}

// Search SAM.gov API (Federal Contracts)
async function searchSamGov(params: {
  keywords?: string
  naicsCode?: string
  setAside?: string
  postedFrom?: string
  postedTo?: string
  limit?: number
}): Promise<{ opportunities: StandardOpportunity[]; total: number; error?: string }> {
  const SAM_API_KEY = process.env.SAM_GOV_API_KEY

  if (!SAM_API_KEY) {
    return {
      opportunities: [],
      total: 0,
      error: 'SAM.gov API key not configured',
    }
  }

  try {
    const baseUrl = 'https://api.sam.gov/opportunities/v2/search'
    const queryParams = new URLSearchParams()
    queryParams.set('api_key', SAM_API_KEY)
    queryParams.set('limit', String(params.limit || 25))

    if (params.keywords) queryParams.set('keywords', params.keywords)
    if (params.naicsCode) queryParams.set('naics', params.naicsCode)
    if (params.setAside) queryParams.set('setAside', params.setAside)
    if (params.postedFrom) queryParams.set('postedFrom', params.postedFrom)
    if (params.postedTo) queryParams.set('postedTo', params.postedTo)

    queryParams.set('ptype', 'o,p,k')
    queryParams.set('active', 'true')

    const response = await fetch(`${baseUrl}?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    })

    if (!response.ok) {
      return { opportunities: [], total: 0, error: `SAM.gov API error: ${response.status}` }
    }

    const data: SamGovResponse = await response.json()

    return {
      opportunities: (data.opportunitiesData || []).map(opp => ({
        id: opp.noticeId,
        title: opp.title,
        agency: [opp.department, opp.agency, opp.office].filter(Boolean).join(' > '),
        description: opp.description || '',
        postedDate: opp.postedDate || '',
        dueDate: opp.responseDeadLine || '',
        type: opp.type || 'Contract',
        setAside: opp.setAside || '',
        naicsCode: opp.naicsCode || '',
        sourceUrl: opp.links?.find(l => l.rel === 'self')?.href || `https://sam.gov/opp/${opp.noticeId}`,
        source: 'SAM.gov',
      })),
      total: data.totalRecords || 0,
    }
  } catch (error) {
    console.error('SAM.gov search error:', error)
    return { opportunities: [], total: 0, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Search Grants.gov API (Federal Grants)
async function searchGrantsGov(params: {
  keywords?: string
  category?: string
  eligibility?: string
  limit?: number
}): Promise<{ opportunities: StandardOpportunity[]; total: number; error?: string }> {
  const GRANTS_GOV_API_KEY = process.env.GRANTS_GOV_API_KEY

  // Grants.gov requires API key registration
  if (!GRANTS_GOV_API_KEY) {
    // Return mock/example data for demo purposes
    return {
      opportunities: [],
      total: 0,
      error: 'Grants.gov API key not configured. Register at grants.gov/web/grants/applicants/apply-for-grants.html',
    }
  }

  try {
    const baseUrl = 'https://www.grants.gov/grantsws/rest/opportunities/search'

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GRANTS_GOV_API_KEY}`,
      },
      body: JSON.stringify({
        keyword: params.keywords || '',
        oppStatus: 'posted',
        rows: params.limit || 25,
      }),
    })

    if (!response.ok) {
      return { opportunities: [], total: 0, error: `Grants.gov API error: ${response.status}` }
    }

    const data: GrantsGovResponse = await response.json()

    return {
      opportunities: (data.opportunities || []).map(opp => ({
        id: opp.opportunityId,
        title: opp.opportunityTitle,
        agency: opp.agencyName,
        description: opp.description || '',
        postedDate: opp.postDate || '',
        dueDate: opp.closeDate || '',
        type: 'Grant',
        setAside: '',
        naicsCode: '',
        fundingAmount: opp.awardCeiling ? `$${opp.awardFloor?.toLocaleString()} - $${opp.awardCeiling?.toLocaleString()}` : undefined,
        eligibility: opp.eligibility,
        sourceUrl: `https://www.grants.gov/search-results-detail/${opp.opportunityId}`,
        source: 'Grants.gov',
      })),
      total: data.totalCount || 0,
    }
  } catch (error) {
    console.error('Grants.gov search error:', error)
    return { opportunities: [], total: 0, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Search USAspending.gov API (Federal Awards/Spending Data) - FREE, NO API KEY
async function searchUSAspending(params: {
  keywords?: string
  awardType?: string
  limit?: number
}): Promise<{ opportunities: StandardOpportunity[]; total: number; error?: string }> {
  try {
    const baseUrl = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'

    // USAspending uses a POST request with filters
    const filters: Record<string, unknown> = {
      time_period: [
        {
          start_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
        },
      ],
      award_type_codes: ['02', '03', '04', '05'], // Grants: Block Grant, Formula Grant, Project Grant, Cooperative Agreement
    }

    if (params.keywords) {
      filters.keywords = [params.keywords]
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filters,
        fields: [
          'Award ID',
          'Recipient Name',
          'Award Amount',
          'Description',
          'Start Date',
          'End Date',
          'Awarding Agency',
          'Awarding Sub Agency',
          'Award Type',
          'CFDA Number',
          'Place of Performance City',
          'Place of Performance State Code',
        ],
        page: 1,
        limit: params.limit || 25,
        sort: 'Award Amount',
        order: 'desc',
      }),
    })

    if (!response.ok) {
      return { opportunities: [], total: 0, error: `USAspending.gov API error: ${response.status}` }
    }

    const data = await response.json()

    return {
      opportunities: (data.results || []).map((award: Record<string, unknown>) => ({
        id: `usa-${award['Award ID'] || Math.random().toString(36).substr(2, 9)}`,
        title: (award['Description'] as string)?.slice(0, 200) || `Award to ${award['Recipient Name']}`,
        agency: [award['Awarding Agency'], award['Awarding Sub Agency']].filter(Boolean).join(' > '),
        description: (award['Description'] as string) || '',
        postedDate: (award['Start Date'] as string) || '',
        dueDate: '', // USAspending shows past awards, not open opportunities
        type: (award['Award Type'] as string) || 'Grant',
        setAside: '',
        naicsCode: '',
        fundingAmount: award['Award Amount'] ? `$${Number(award['Award Amount']).toLocaleString()}` : undefined,
        sourceUrl: `https://www.usaspending.gov/award/${award['Award ID']}`,
        source: 'USAspending.gov',
      })),
      total: data.page_metadata?.total || 0,
    }
  } catch (error) {
    console.error('USAspending.gov search error:', error)
    return { opportunities: [], total: 0, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Search ProPublica Nonprofit Explorer API - FREE, NO API KEY
// Note: This searches nonprofits, useful for finding potential funders/partners
async function searchProPublicaNonprofits(params: {
  keywords?: string
  state?: string
  limit?: number
}): Promise<{ opportunities: StandardOpportunity[]; total: number; error?: string }> {
  try {
    // ProPublica Nonprofit Explorer API
    const queryParams = new URLSearchParams()
    if (params.keywords) queryParams.set('q', params.keywords)
    if (params.state) queryParams.set('state[id]', params.state)

    const baseUrl = `https://projects.propublica.org/nonprofits/api/v2/search.json?${queryParams.toString()}`

    const response = await fetch(baseUrl, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      return { opportunities: [], total: 0, error: `ProPublica API error: ${response.status}` }
    }

    const data: ProPublicaResponse = await response.json()

    // Convert nonprofits to opportunity format (these are potential funders, not grants)
    return {
      opportunities: (data.organizations || []).slice(0, params.limit || 25).map(org => ({
        id: `propublica-${org.ein}`,
        title: org.name,
        agency: org.organization_type || 'Nonprofit Organization',
        description: `${org.name} - ${org.city}, ${org.state}. NTEE Code: ${org.ntee_code || 'N/A'}. A potential funder or partner organization.`,
        postedDate: '',
        dueDate: '',
        type: 'Foundation/Nonprofit',
        setAside: '',
        naicsCode: '',
        fundingAmount: org.revenue_amount ? `Revenue: $${org.revenue_amount.toLocaleString()}` : undefined,
        eligibility: `Assets: $${org.asset_amount?.toLocaleString() || 'N/A'}`,
        sourceUrl: `https://projects.propublica.org/nonprofits/organizations/${org.ein}`,
        source: 'ProPublica',
      })),
      total: data.total_results || 0,
    }
  } catch (error) {
    console.error('ProPublica search error:', error)
    return { opportunities: [], total: 0, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Aggregate sources list for the UI
export const GRANT_SOURCES = [
  {
    id: 'sam.gov',
    name: 'SAM.gov',
    description: 'Federal contracts and procurement opportunities',
    type: 'federal',
    requiresApiKey: true,
    apiKeyEnvVar: 'SAM_GOV_API_KEY',
    enabled: true,
  },
  {
    id: 'grants.gov',
    name: 'Grants.gov',
    description: 'Federal grant opportunities across all agencies',
    type: 'federal',
    requiresApiKey: true,
    apiKeyEnvVar: 'GRANTS_GOV_API_KEY',
    enabled: true,
  },
  {
    id: 'usaspending',
    name: 'USAspending.gov',
    description: 'Federal spending data - past awards and grants for research',
    type: 'federal',
    requiresApiKey: false,
    enabled: true,
  },
  {
    id: 'propublica',
    name: 'ProPublica Nonprofits',
    description: 'Search nonprofits/foundations as potential funders',
    type: 'foundation',
    requiresApiKey: false,
    enabled: true,
  },
  {
    id: 'nyc',
    name: 'NYC Agency Grants',
    description: 'New York City department funding opportunities',
    type: 'city',
    requiresApiKey: false,
    enabled: false, // Placeholder - needs specific implementation
  },
  {
    id: 'nys',
    name: 'NY State Grants',
    description: 'New York State grant programs',
    type: 'state',
    requiresApiKey: false,
    enabled: false, // Placeholder - needs specific implementation
  },
  {
    id: 'foundation',
    name: 'Foundation Directory',
    description: 'Private foundation and philanthropy grants',
    type: 'foundation',
    requiresApiKey: false,
    enabled: false, // Placeholder - Candid/Foundation Directory requires subscription
  },
  {
    id: 'manual',
    name: 'Manual Entry',
    description: 'Paste or enter grants from any source',
    type: 'manual',
    requiresApiKey: false,
    enabled: true,
  },
]

// GET - Search for grants/RFPs across multiple sources
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const sources = searchParams.get('sources')?.split(',') || ['sam.gov']
    const keywords = searchParams.get('keywords') || ''
    const naicsCode = searchParams.get('naics') || ''
    const setAside = searchParams.get('setAside') || ''
    const category = searchParams.get('category') || ''
    const limit = parseInt(searchParams.get('limit') || '25')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allOpportunities: StandardOpportunity[] = []
    const errors: Record<string, string> = {}
    let totalCount = 0

    // Search each requested source in parallel
    const searchPromises = sources.map(async (source) => {
      switch (source) {
        case 'sam.gov':
          return { source, result: await searchSamGov({ keywords, naicsCode, setAside, limit }) }
        case 'grants.gov':
          return { source, result: await searchGrantsGov({ keywords, category, limit }) }
        case 'usaspending':
          return { source, result: await searchUSAspending({ keywords, limit }) }
        case 'propublica':
          return { source, result: await searchProPublicaNonprofits({ keywords, limit }) }
        case 'nyc':
        case 'nys':
        case 'foundation':
          return { source, result: { opportunities: [], total: 0, error: `${source} integration coming soon` } }
        default:
          return { source, result: { opportunities: [], total: 0, error: `Source "${source}" not yet implemented` } }
      }
    })

    const results = await Promise.all(searchPromises)

    for (const { source, result } of results) {
      if (result.error) {
        errors[source] = result.error
      }
      allOpportunities.push(...result.opportunities)
      totalCount += result.total
    }

    // Sort by due date (soonest first)
    allOpportunities.sort((a, b) => {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

    // Log the search
    await supabase.from('agent_logs').insert({
      workspace_id: workspaceId,
      agent_type: 'rfp',
      action: 'multi_source_search',
      input_summary: `Search [${sources.join(', ')}]: "${keywords}"`,
      output_summary: `Found ${allOpportunities.length} opportunities`,
      status: Object.keys(errors).length > 0 ? 'partial' : 'success',
      metadata: { sources, keywords, naicsCode, setAside, category, errors },
    })

    return NextResponse.json({
      opportunities: allOpportunities,
      total: totalCount,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      sources: GRANT_SOURCES,
    })
  } catch (error) {
    console.error('Multi-source search error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST - Save an opportunity to track
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, opportunity, sourceId } = body

    if (!workspaceId || !opportunity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if already tracked
    const { data: existing } = await supabase
      .from('rfps')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('external_id', opportunity.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Opportunity already tracked', rfpId: existing.id }, { status: 409 })
    }

    // Insert the RFP
    const { data: rfp, error } = await supabase
      .from('rfps')
      .insert({
        workspace_id: workspaceId,
        source_id: sourceId || null,
        external_id: opportunity.id,
        title: opportunity.title,
        description: opportunity.description,
        agency: opportunity.agency,
        notice_type: opportunity.type,
        posted_date: opportunity.postedDate || null,
        response_deadline: opportunity.dueDate || null,
        set_aside: opportunity.setAside,
        naics_code: opportunity.naicsCode,
        funding_amount: opportunity.fundingAmount,
        eligibility_summary: opportunity.eligibility,
        source_url: opportunity.sourceUrl,
        source_type: opportunity.source,
        status: 'new',
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving RFP:', error)
      return NextResponse.json({ error: 'Failed to save opportunity' }, { status: 500 })
    }

    return NextResponse.json({ rfp })
  } catch (error) {
    console.error('RFP save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

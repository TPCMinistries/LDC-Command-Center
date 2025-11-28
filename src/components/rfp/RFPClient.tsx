'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  FileText,
  Plus,
  Loader2,
  ExternalLink,
  Calendar,
  Building2,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
  RefreshCw,
  Handshake,
  Upload,
  Clipboard,
  Eye,
} from 'lucide-react'
import { CoalitionBuilder } from '@/components/coalitions/CoalitionBuilder'
import { RFPUploader } from './RFPUploader'
import { RFPAnalysisPanel } from './RFPAnalysisPanel'
import { GrantImporter } from './GrantImporter'
import { GrantPipeline } from './GrantPipeline'
import { formatDistanceToNow, format } from 'date-fns'

interface RFPItem {
  id: string
  workspace_id: string
  external_id?: string
  title: string
  description?: string
  agency?: string
  notice_type?: string
  posted_date?: string
  response_deadline?: string
  set_aside?: string
  naics_code?: string
  source_url?: string
  status: string
  alignment_score?: number
  alignment_reasons?: string[]
  requirements?: string[]
  eligibility?: Record<string, unknown>
  notes?: string
  created_at: string
}

interface SearchResult {
  id: string
  title: string
  agency: string
  description: string
  postedDate: string
  dueDate: string
  type: string
  setAside: string
  naicsCode: string
  sourceUrl: string
  source: string
}

interface RFPClientProps {
  workspaceId: string
  workspaceName: string
  initialRfps: RFPItem[]
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  reviewing: 'bg-yellow-500/20 text-yellow-400',
  pursuing: 'bg-green-500/20 text-green-400',
  submitted: 'bg-purple-500/20 text-purple-400',
  won: 'bg-emerald-500/20 text-emerald-400',
  lost: 'bg-red-500/20 text-red-400',
  archived: 'bg-zinc-500/20 text-zinc-400',
}

const STATUS_OPTIONS = ['new', 'reviewing', 'pursuing', 'submitted', 'won', 'lost', 'archived']

export function RFPClient({ workspaceId, initialRfps }: RFPClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('search')
  const [trackedRfps, setTrackedRfps] = useState<RFPItem[]>(initialRfps)
  const [selectedRfp, setSelectedRfp] = useState<RFPItem | null>(null)

  // Search state
  const [searchKeywords, setSearchKeywords] = useState('')
  const [searchNaics, setSearchNaics] = useState('')
  const [searchSetAside, setSearchSetAside] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>(['sam.gov', 'usaspending'])
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchErrors, setSearchErrors] = useState<Record<string, string>>({})

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)

  // Pipeline filter
  const [pipelineFilter, setPipelineFilter] = useState<string>('all')

  // Upload modal
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  // Grant importer modal
  const [isImporterOpen, setIsImporterOpen] = useState(false)

  const handleRfpCreated = (rfp: RFPItem) => {
    setTrackedRfps(prev => [rfp, ...prev])
    setActiveTab('pipeline')
  }

  // Available data sources
  const SOURCES = [
    { id: 'sam.gov', name: 'SAM.gov', desc: 'Federal contracts', type: 'federal' },
    { id: 'usaspending', name: 'USAspending', desc: 'Federal awards data', type: 'federal' },
    { id: 'propublica', name: 'ProPublica', desc: 'Nonprofit funders', type: 'foundation' },
    { id: 'grants.gov', name: 'Grants.gov', desc: 'Federal grants (API key required)', type: 'federal' },
  ]

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(s => s !== sourceId)
        : [...prev, sourceId]
    )
  }

  // Search multiple sources
  const searchOpportunities = async () => {
    if (!searchKeywords.trim() || selectedSources.length === 0) return

    setIsSearching(true)
    setSearchError(null)
    setSearchErrors({})
    setSearchResults([])

    try {
      const params = new URLSearchParams({
        workspaceId,
        keywords: searchKeywords,
        sources: selectedSources.join(','),
      })
      if (searchNaics) params.set('naics', searchNaics)
      if (searchSetAside) params.set('setAside', searchSetAside)

      const res = await fetch(`/api/rfp/search?${params.toString()}`)
      const data = await res.json()

      if (data.error) {
        setSearchError(data.error)
      } else {
        setSearchResults(data.opportunities || [])
        if (data.errors) {
          setSearchErrors(data.errors)
        }
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchError('Search failed. Please try again.')
    }

    setIsSearching(false)
  }

  // Track an opportunity
  const trackOpportunity = async (opp: SearchResult) => {
    try {
      const res = await fetch('/api/rfp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          opportunity: opp,
        }),
      })

      const data = await res.json()
      if (data.rfp) {
        setTrackedRfps(prev => [data.rfp, ...prev])
        setActiveTab('pipeline')
      } else if (data.error === 'Opportunity already tracked') {
        alert('This opportunity is already being tracked.')
      }
    } catch (error) {
      console.error('Failed to track opportunity:', error)
    }
  }

  // Analyze an RFP
  const analyzeRfp = async (rfp: RFPItem | SearchResult, isTracked: boolean) => {
    setIsAnalyzing(true)
    setAnalysis(null)

    try {
      const res = await fetch('/api/agents/rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action: 'analyze',
          rfpId: isTracked ? rfp.id : undefined,
          rfpData: isTracked ? undefined : rfp,
        }),
      })

      const data = await res.json()
      if (data.analysis) {
        setAnalysis(data.analysis)

        // Update tracked RFP with analysis
        if (isTracked && data.rfpId) {
          setTrackedRfps(prev => prev.map(r =>
            r.id === data.rfpId
              ? { ...r, alignment_score: data.analysis.alignment_score, alignment_reasons: data.analysis.alignment_reasons }
              : r
          ))
        }
      }
    } catch (error) {
      console.error('Analysis error:', error)
    }

    setIsAnalyzing(false)
  }

  // Update RFP status
  const updateRfpStatus = async (rfpId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/rfp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfpId,
          workspaceId,
          status: newStatus,
        }),
      })

      const data = await res.json()
      if (data.rfp) {
        setTrackedRfps(prev => prev.map(r => r.id === rfpId ? data.rfp : r))
        if (selectedRfp?.id === rfpId) {
          setSelectedRfp(data.rfp)
        }
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  const filteredRfps = pipelineFilter === 'all'
    ? trackedRfps
    : trackedRfps.filter(r => r.status === pipelineFilter)

  return (
    <>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList className="bg-zinc-800">
          <TabsTrigger value="search" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
            <Search className="h-4 w-4 mr-2" />
            Search Grants
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
            <FileText className="h-4 w-4 mr-2" />
            Pipeline ({trackedRfps.length})
          </TabsTrigger>
          <TabsTrigger value="visual" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400">
            <Sparkles className="h-4 w-4 mr-2" />
            Visual Pipeline
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsImporterOpen(true)}
            variant="outline"
            className="border-zinc-700 hover:bg-zinc-800"
          >
            <Clipboard className="h-4 w-4 mr-2" />
            Import Grant
          </Button>
          <Button
            onClick={() => setIsUploadOpen(true)}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload RFP
          </Button>
        </div>
      </div>

      {/* Search Tab */}
      <TabsContent value="search" className="space-y-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
              <Search className="h-5 w-5 text-amber-500" />
              Multi-Source Grant Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source Selection */}
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Data Sources</label>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map(source => (
                  <button
                    key={source.id}
                    onClick={() => toggleSource(source.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                      selectedSources.includes(source.id)
                        ? 'bg-amber-600/20 text-amber-400 border border-amber-500/50'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      selectedSources.includes(source.id) ? 'bg-amber-500' : 'bg-zinc-600'
                    }`} />
                    {source.name}
                    <span className="text-xs opacity-60">({source.desc})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">Keywords</label>
                <input
                  type="text"
                  value={searchKeywords}
                  onChange={e => setSearchKeywords(e.target.value)}
                  placeholder="e.g., workforce development, consulting, training"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  onKeyDown={e => e.key === 'Enter' && searchOpportunities()}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">NAICS Code (optional)</label>
                <input
                  type="text"
                  value={searchNaics}
                  onChange={e => setSearchNaics(e.target.value)}
                  placeholder="e.g., 541611"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Set-Aside (SAM.gov)</label>
                <select
                  value={searchSetAside}
                  onChange={e => setSearchSetAside(e.target.value)}
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">All</option>
                  <option value="SBA">Small Business (SBA)</option>
                  <option value="8A">8(a)</option>
                  <option value="HUBZone">HUBZone</option>
                  <option value="SDVOSB">Service-Disabled Veteran</option>
                  <option value="WOSB">Women-Owned</option>
                </select>
              </div>
              <div className="flex-1" />
              <Button
                onClick={searchOpportunities}
                disabled={isSearching || !searchKeywords.trim() || selectedSources.length === 0}
                className="bg-amber-600 hover:bg-amber-700 mt-auto"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching {selectedSources.length} source{selectedSources.length !== 1 ? 's' : ''}...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search {selectedSources.length} Source{selectedSources.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {searchError && (
          <Card className="bg-red-900/20 border-red-800">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-5 w-5" />
                <p>{searchError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Partial errors from sources */}
        {Object.keys(searchErrors).length > 0 && (
          <Card className="bg-yellow-900/20 border-yellow-800">
            <CardContent className="py-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Some sources returned errors:
                </div>
                {Object.entries(searchErrors).map(([source, error]) => (
                  <p key={source} className="text-yellow-400/80 text-xs pl-6">
                    {source}: {error}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {searchResults.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-zinc-100 text-base">
                Found {searchResults.length} Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-2">
                <div className="space-y-3">
                  {searchResults.map(opp => (
                    <div
                      key={opp.id}
                      className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-zinc-200 font-medium line-clamp-2">{opp.title}</h4>
                          <p className="text-zinc-400 text-sm mt-1 line-clamp-2">{opp.description}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-500">
                            <Badge variant="secondary" className="bg-zinc-700 text-zinc-300">
                              {opp.source}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {opp.agency || 'Unknown Agency'}
                            </span>
                            {opp.dueDate && (
                              <span className="flex items-center gap-1 text-amber-400">
                                <Calendar className="h-3 w-3" />
                                Due: {format(new Date(opp.dueDate), 'MMM d, yyyy')}
                              </span>
                            )}
                            {opp.setAside && (
                              <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                                {opp.setAside}
                              </Badge>
                            )}
                            {opp.naicsCode && (
                              <span>NAICS: {opp.naicsCode}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => trackOpportunity(opp)}
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Track
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => analyzeRfp(opp, false)}
                            disabled={isAnalyzing}
                            className="border-zinc-700"
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            Analyze
                          </Button>
                          {opp.sourceUrl && (
                            <a
                              href={opp.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Analysis Panel */}
        {(isAnalyzing || analysis) && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                  <span className="ml-3 text-zinc-400">Analyzing opportunity...</span>
                </div>
              ) : analysis && (
                <div className="space-y-4">
                  {/* Score */}
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-bold ${
                      (analysis.alignment_score as number) >= 70 ? 'text-green-400' :
                      (analysis.alignment_score as number) >= 40 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {analysis.alignment_score as number}%
                    </div>
                    <div>
                      <div className="text-zinc-200 font-medium">Alignment Score</div>
                      <Badge className={
                        analysis.recommendation === 'pursue' ? 'bg-green-500/20 text-green-400' :
                        analysis.recommendation === 'consider' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }>
                        {analysis.recommendation as string}
                      </Badge>
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-1">Summary</h4>
                    <p className="text-zinc-300 text-sm">{analysis.summary as string}</p>
                  </div>

                  {/* Alignment Reasons */}
                  {(analysis.alignment_reasons as string[])?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">Why This Score</h4>
                      <ul className="space-y-1">
                        {(analysis.alignment_reasons as string[]).map((reason, i) => (
                          <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Skills Needed */}
                  {(analysis.skills_needed as string[])?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">Skills/Capabilities Needed</h4>
                      <div className="flex flex-wrap gap-1">
                        {(analysis.skills_needed as string[]).map(skill => (
                          <Badge key={skill} variant="secondary" className="bg-zinc-700 text-zinc-300">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risks */}
                  {(analysis.potential_risks as string[])?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">Potential Risks</h4>
                      <ul className="space-y-1">
                        {(analysis.potential_risks as string[]).map((risk, i) => (
                          <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Pipeline Tab */}
      <TabsContent value="pipeline" className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left - RFP List */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-zinc-100 text-base">Tracked Opportunities</CardTitle>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-zinc-400" />
                    <select
                      value={pipelineFilter}
                      onChange={e => setPipelineFilter(e.target.value)}
                      className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300"
                    >
                      <option value="all">All Status</option>
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-2">
                  {filteredRfps.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                      <p className="text-zinc-400">No opportunities tracked yet</p>
                      <p className="text-zinc-500 text-sm mt-1">
                        Search for opportunities and click Track to add them here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredRfps.map(rfp => (
                        <div
                          key={rfp.id}
                          onClick={() => setSelectedRfp(rfp)}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedRfp?.id === rfp.id
                              ? 'bg-amber-600/20 border border-amber-500/50'
                              : 'bg-zinc-800 hover:bg-zinc-700/50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={STATUS_COLORS[rfp.status] || STATUS_COLORS.new}>
                                  {rfp.status}
                                </Badge>
                                {rfp.alignment_score && (
                                  <span className={`text-xs font-medium ${
                                    rfp.alignment_score >= 70 ? 'text-green-400' :
                                    rfp.alignment_score >= 40 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {rfp.alignment_score}% match
                                  </span>
                                )}
                              </div>
                              <h4 className="text-zinc-200 font-medium line-clamp-2">{rfp.title}</h4>
                              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                                <span>{rfp.agency || 'Unknown Agency'}</span>
                                {rfp.response_deadline && (
                                  <span className="flex items-center gap-1 text-amber-400">
                                    <Clock className="h-3 w-3" />
                                    Due {formatDistanceToNow(new Date(rfp.response_deadline), { addSuffix: true })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-zinc-400 hover:text-amber-400"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/workspace/${workspaceId}/rfp/${rfp.id}`)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <ChevronRight className="h-5 w-5 text-zinc-500" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right - Detail View */}
          <div className="lg:col-span-1">
            {selectedRfp ? (
              <Card className="bg-zinc-900 border-zinc-800 sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-zinc-100 text-base">Opportunity Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px] pr-2">
                    <div className="space-y-4">
                      {/* Title & Status */}
                      <div>
                        <h3 className="text-lg font-medium text-zinc-100">{selectedRfp.title}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <select
                            value={selectedRfp.status}
                            onChange={e => updateRfpStatus(selectedRfp.id, e.target.value)}
                            className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300"
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                          {selectedRfp.alignment_score && (
                            <Badge className={
                              selectedRfp.alignment_score >= 70 ? 'bg-green-500/20 text-green-400' :
                              selectedRfp.alignment_score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }>
                              {selectedRfp.alignment_score}% match
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Key Info */}
                      <div className="space-y-2 text-sm">
                        {selectedRfp.agency && (
                          <div className="flex items-start gap-2">
                            <Building2 className="h-4 w-4 text-zinc-500 mt-0.5" />
                            <span className="text-zinc-300">{selectedRfp.agency}</span>
                          </div>
                        )}
                        {selectedRfp.response_deadline && (
                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-amber-500 mt-0.5" />
                            <span className="text-amber-400">
                              Due: {format(new Date(selectedRfp.response_deadline), 'MMMM d, yyyy')}
                            </span>
                          </div>
                        )}
                        {selectedRfp.set_aside && (
                          <div className="flex items-start gap-2">
                            <DollarSign className="h-4 w-4 text-zinc-500 mt-0.5" />
                            <span className="text-zinc-300">Set-Aside: {selectedRfp.set_aside}</span>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      {selectedRfp.description && (
                        <div>
                          <h4 className="text-sm font-medium text-zinc-400 mb-1">Description</h4>
                          <p className="text-zinc-300 text-sm">{selectedRfp.description}</p>
                        </div>
                      )}

                      {/* Alignment Reasons */}
                      {selectedRfp.alignment_reasons && selectedRfp.alignment_reasons.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-zinc-400 mb-2">Why This Score</h4>
                          <ul className="space-y-1">
                            {selectedRfp.alignment_reasons.map((reason, i) => (
                              <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2 space-y-2">
                        <Button
                          className="w-full bg-amber-600 hover:bg-amber-700"
                          onClick={() => analyzeRfp(selectedRfp, true)}
                          disabled={isAnalyzing}
                        >
                          {isAnalyzing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          {selectedRfp.alignment_score ? 'Re-analyze' : 'Analyze'}
                        </Button>
                        {selectedRfp.source_url && (
                          <a
                            href={selectedRfp.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <Button variant="outline" className="w-full border-zinc-700">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Source
                            </Button>
                          </a>
                        )}
                      </div>

                      {/* Coalition Builder */}
                      <div className="pt-4 border-t border-zinc-700 mt-4">
                        <CoalitionBuilder
                          workspaceId={workspaceId}
                          rfp={{
                            id: selectedRfp.id,
                            title: selectedRfp.title,
                            agency: selectedRfp.agency,
                            response_deadline: selectedRfp.response_deadline,
                          }}
                        />
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="py-12">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-400">Select an opportunity to view details</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* AI Analysis Panel - Full Width when RFP selected */}
        {selectedRfp && (
          <RFPAnalysisPanel
            rfpId={selectedRfp.id}
            workspaceId={workspaceId}
            rfpContext={{
              title: selectedRfp.title,
              agency: selectedRfp.agency,
              deadline: selectedRfp.response_deadline,
              description: selectedRfp.description,
            }}
          />
        )}
      </TabsContent>

      {/* Visual Pipeline Tab */}
      <TabsContent value="visual" className="space-y-4">
        <GrantPipeline
          workspaceId={workspaceId}
          rfps={trackedRfps.map(rfp => ({
            id: rfp.id,
            title: rfp.title,
            organization: rfp.agency || 'Unknown',
            status: (rfp.status === 'archived' ? 'lost' : rfp.status) as 'new' | 'reviewing' | 'pursuing' | 'submitted' | 'won' | 'lost',
            response_deadline: rfp.response_deadline || null,
            award_amount_min: null,
            award_amount_max: null,
            alignment_score: rfp.alignment_score ?? null,
            source_type: null,
            created_at: rfp.created_at,
          }))}
          proposals={[]}
          onSelectRFP={(rfp) => {
            const tracked = trackedRfps.find(r => r.id === rfp.id)
            if (tracked) {
              setSelectedRfp(tracked)
              setActiveTab('pipeline')
            }
          }}
        />
      </TabsContent>
    </Tabs>

    <RFPUploader
      workspaceId={workspaceId}
      isOpen={isUploadOpen}
      onClose={() => setIsUploadOpen(false)}
      onRfpCreated={handleRfpCreated}
    />

    <GrantImporter
      workspaceId={workspaceId}
      isOpen={isImporterOpen}
      onClose={() => setIsImporterOpen(false)}
      onGrantImported={(rfp) => handleRfpCreated(rfp as RFPItem)}
    />
    </>
  )
}

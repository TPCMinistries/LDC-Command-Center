'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
  Download,
  Share2,
} from 'lucide-react'
import { format, formatDistanceToNow, isPast } from 'date-fns'
import { RFPAnalysisPanel } from './RFPAnalysisPanel'
import { CoalitionBuilder } from '@/components/coalitions/CoalitionBuilder'

interface RFP {
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
  updated_at?: string
}

interface Proposal {
  id: string
  title: string
  status: string
  submission_deadline?: string
  completion_percentage?: number
}

interface RFPDetailClientProps {
  rfp: RFP
  proposals: Proposal[]
  workspaceId: string
  workspaceName: string
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  reviewing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  pursuing: 'bg-green-500/20 text-green-400 border-green-500/50',
  submitted: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  won: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
  lost: 'bg-red-500/20 text-red-400 border-red-500/50',
  archived: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50',
}

const STATUS_OPTIONS = ['new', 'reviewing', 'pursuing', 'submitted', 'won', 'lost', 'archived']

export function RFPDetailClient({ rfp, proposals, workspaceId, workspaceName }: RFPDetailClientProps) {
  const router = useRouter()
  const [currentRfp, setCurrentRfp] = useState<RFP>(rfp)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null)

  const deadline = currentRfp.response_deadline ? new Date(currentRfp.response_deadline) : null
  const isOverdue = deadline && isPast(deadline) && !['won', 'lost', 'submitted'].includes(currentRfp.status)
  const daysUntilDeadline = deadline ? Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null

  const updateStatus = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      const res = await fetch('/api/rfp', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfpId: currentRfp.id,
          workspaceId,
          status: newStatus,
        }),
      })
      const data = await res.json()
      if (data.rfp) {
        setCurrentRfp(data.rfp)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
    setIsUpdating(false)
  }

  const analyzeRfp = async () => {
    setIsAnalyzing(true)
    setAnalysis(null)
    try {
      const res = await fetch('/api/agents/rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action: 'analyze',
          rfpId: currentRfp.id,
        }),
      })
      const data = await res.json()
      if (data.analysis) {
        setAnalysis(data.analysis)
        // Update local state with new scores
        if (data.analysis.alignment_score) {
          setCurrentRfp(prev => ({
            ...prev,
            alignment_score: data.analysis.alignment_score,
            alignment_reasons: data.analysis.alignment_reasons,
          }))
        }
      }
    } catch (error) {
      console.error('Analysis error:', error)
    }
    setIsAnalyzing(false)
  }

  const deleteRfp = async () => {
    if (!confirm('Are you sure you want to delete this opportunity?')) return

    try {
      const res = await fetch(`/api/rfp?rfpId=${currentRfp.id}&workspaceId=${workspaceId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        router.push(`/workspace/${workspaceId}/rfp`)
      }
    } catch (error) {
      console.error('Failed to delete RFP:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href={`/workspace/${workspaceId}/rfp`}>
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge className={STATUS_COLORS[currentRfp.status] || STATUS_COLORS.new}>
                {currentRfp.status}
              </Badge>
              {currentRfp.alignment_score && (
                <Badge className={`${
                  currentRfp.alignment_score >= 70 ? 'bg-green-500/20 text-green-400' :
                  currentRfp.alignment_score >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {currentRfp.alignment_score}% match
                </Badge>
              )}
              {isOverdue && (
                <Badge className="bg-red-500/20 text-red-400">
                  Overdue
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-zinc-100">{currentRfp.title}</h1>
            {currentRfp.agency && (
              <p className="text-zinc-400 mt-1 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {currentRfp.agency}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentRfp.source_url && (
            <a href={currentRfp.source_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-zinc-700">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Source
              </Button>
            </a>
          )}
          <Button variant="outline" className="border-zinc-700 text-red-400 hover:text-red-300" onClick={deleteRfp}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Info Card */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Opportunity Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Deadline */}
              {deadline && (
                <div className={`p-4 rounded-lg ${
                  isOverdue ? 'bg-red-500/10 border border-red-500/30' :
                  daysUntilDeadline !== null && daysUntilDeadline <= 7 ? 'bg-amber-500/10 border border-amber-500/30' :
                  'bg-zinc-800'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className={`h-5 w-5 ${
                      isOverdue ? 'text-red-400' :
                      daysUntilDeadline !== null && daysUntilDeadline <= 7 ? 'text-amber-400' : 'text-zinc-400'
                    }`} />
                    <span className="text-sm text-zinc-400">Response Deadline</span>
                  </div>
                  <div className={`text-xl font-semibold ${
                    isOverdue ? 'text-red-400' :
                    daysUntilDeadline !== null && daysUntilDeadline <= 7 ? 'text-amber-400' : 'text-zinc-100'
                  }`}>
                    {format(deadline, 'MMMM d, yyyy')}
                  </div>
                  <div className="text-sm text-zinc-500 mt-1">
                    {isOverdue ? 'Deadline has passed' : formatDistanceToNow(deadline, { addSuffix: true })}
                  </div>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                {currentRfp.notice_type && (
                  <div>
                    <span className="text-sm text-zinc-500">Notice Type</span>
                    <p className="text-zinc-200">{currentRfp.notice_type}</p>
                  </div>
                )}
                {currentRfp.naics_code && (
                  <div>
                    <span className="text-sm text-zinc-500">NAICS Code</span>
                    <p className="text-zinc-200">{currentRfp.naics_code}</p>
                  </div>
                )}
                {currentRfp.set_aside && (
                  <div>
                    <span className="text-sm text-zinc-500">Set-Aside</span>
                    <Badge className="bg-green-500/20 text-green-400 mt-1">{currentRfp.set_aside}</Badge>
                  </div>
                )}
                {currentRfp.posted_date && (
                  <div>
                    <span className="text-sm text-zinc-500">Posted Date</span>
                    <p className="text-zinc-200">{format(new Date(currentRfp.posted_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {currentRfp.description && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Description</h4>
                  <p className="text-zinc-300 whitespace-pre-wrap">{currentRfp.description}</p>
                </div>
              )}

              {/* Requirements */}
              {currentRfp.requirements && currentRfp.requirements.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Requirements</h4>
                  <ul className="space-y-1">
                    {currentRfp.requirements.map((req, i) => (
                      <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Alignment Reasons */}
              {currentRfp.alignment_reasons && currentRfp.alignment_reasons.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Why This Matches</h4>
                  <ul className="space-y-1">
                    {currentRfp.alignment_reasons.map((reason, i) => (
                      <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {currentRfp.notes && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Notes</h4>
                  <p className="text-zinc-300 whitespace-pre-wrap">{currentRfp.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Analysis Panel */}
          <RFPAnalysisPanel
            rfpId={currentRfp.id}
            workspaceId={workspaceId}
            rfpContext={{
              title: currentRfp.title,
              agency: currentRfp.agency,
              deadline: currentRfp.response_deadline,
              description: currentRfp.description,
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Actions */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Status & Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Selector */}
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Pipeline Status</label>
                <select
                  value={currentRfp.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  disabled={isUpdating}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  onClick={analyzeRfp}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {currentRfp.alignment_score ? 'Re-analyze Fit' : 'Analyze Fit'}
                </Button>

                <Link href={`/workspace/${workspaceId}/proposals?rfpId=${currentRfp.id}`} className="block">
                  <Button variant="outline" className="w-full border-zinc-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Proposal
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Linked Proposals */}
          {proposals.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-100 text-base">Linked Proposals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {proposals.map(proposal => (
                    <Link
                      key={proposal.id}
                      href={`/workspace/${workspaceId}/proposals/${proposal.id}`}
                      className="block p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-zinc-200 font-medium text-sm">{proposal.title}</p>
                          <Badge className="mt-1" variant="secondary">{proposal.status}</Badge>
                        </div>
                        {proposal.completion_percentage !== undefined && (
                          <div className="text-right">
                            <span className="text-lg font-bold text-amber-400">
                              {proposal.completion_percentage}%
                            </span>
                            <p className="text-xs text-zinc-500">Complete</p>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Coalition Builder */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Team & Partners</CardTitle>
            </CardHeader>
            <CardContent>
              <CoalitionBuilder
                workspaceId={workspaceId}
                rfp={{
                  id: currentRfp.id,
                  title: currentRfp.title,
                  agency: currentRfp.agency,
                  response_deadline: currentRfp.response_deadline,
                }}
              />
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Added</span>
                  <span className="text-zinc-400">{format(new Date(currentRfp.created_at), 'MMM d, yyyy')}</span>
                </div>
                {currentRfp.updated_at && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Updated</span>
                    <span className="text-zinc-400">{formatDistanceToNow(new Date(currentRfp.updated_at), { addSuffix: true })}</span>
                  </div>
                )}
                {currentRfp.external_id && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">External ID</span>
                    <span className="text-zinc-400 font-mono text-xs">{currentRfp.external_id}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analysis Results Modal/Section */}
      {analysis && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              AI Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Score */}
              <div className="text-center">
                <div className={`text-5xl font-bold ${
                  (analysis.alignment_score as number) >= 70 ? 'text-green-400' :
                  (analysis.alignment_score as number) >= 40 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {analysis.alignment_score as number}%
                </div>
                <p className="text-zinc-400 mt-1">Alignment Score</p>
                <Badge className={`mt-2 ${
                  analysis.recommendation === 'pursue' ? 'bg-green-500/20 text-green-400' :
                  analysis.recommendation === 'consider' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {(analysis.recommendation as string)?.toUpperCase()}
                </Badge>
              </div>

              {/* Summary */}
              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Summary</h4>
                <p className="text-zinc-300">{analysis.summary as string}</p>

                {(analysis.skills_needed as string[])?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">Required Capabilities</h4>
                    <div className="flex flex-wrap gap-1">
                      {(analysis.skills_needed as string[]).map(skill => (
                        <Badge key={skill} variant="secondary" className="bg-zinc-700 text-zinc-300">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

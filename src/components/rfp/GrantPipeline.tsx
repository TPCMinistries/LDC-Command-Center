'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Target,
  DollarSign,
  Calendar,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  BarChart3,
  AlertCircle,
  ChevronRight,
  Eye,
} from 'lucide-react'
import { format, differenceInDays, isPast } from 'date-fns'

interface RFPItem {
  id: string
  title: string
  organization: string
  status: 'new' | 'reviewing' | 'pursuing' | 'submitted' | 'won' | 'lost' | 'archived'
  response_deadline: string | null
  award_amount_min: number | null
  award_amount_max: number | null
  alignment_score: number | null
  source_type: string | null
  created_at: string
}

interface Proposal {
  id: string
  title: string
  rfp_id: string | null
  status: string
  submission_deadline: string | null
  requested_amount: number | null
  completion_percentage: number | null
}

interface GrantPipelineProps {
  workspaceId: string
  rfps: RFPItem[]
  proposals: Proposal[]
  onSelectRFP?: (rfp: RFPItem) => void
  onSelectProposal?: (proposal: Proposal) => void
}

const PIPELINE_STAGES = [
  { key: 'new', label: 'New', color: 'border-zinc-500', bgColor: 'bg-zinc-500/10' },
  { key: 'reviewing', label: 'Reviewing', color: 'border-blue-500', bgColor: 'bg-blue-500/10' },
  { key: 'pursuing', label: 'Pursuing', color: 'border-amber-500', bgColor: 'bg-amber-500/10' },
  { key: 'submitted', label: 'Submitted', color: 'border-purple-500', bgColor: 'bg-purple-500/10' },
  { key: 'won', label: 'Won', color: 'border-green-500', bgColor: 'bg-green-500/10' },
  { key: 'lost', label: 'Lost', color: 'border-red-500', bgColor: 'bg-red-500/10' },
]

export function GrantPipeline({ workspaceId, rfps, proposals, onSelectRFP, onSelectProposal }: GrantPipelineProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'kanban' | 'funnel'>('kanban')
  const [timeFilter, setTimeFilter] = useState<'all' | '30' | '60' | '90'>('all')

  // Filter RFPs by time
  const filteredRfps = useMemo(() => {
    if (timeFilter === 'all') return rfps
    const days = parseInt(timeFilter)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return rfps.filter(r => new Date(r.created_at) >= cutoff)
  }, [rfps, timeFilter])

  // Group RFPs by stage
  const rfpsByStage = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage.key] = filteredRfps.filter(r => r.status === stage.key)
      return acc
    }, {} as Record<string, RFPItem[]>)
  }, [filteredRfps])

  // Calculate pipeline metrics
  const metrics = useMemo(() => {
    const active = filteredRfps.filter(r => !['won', 'lost', 'archived'].includes(r.status))
    const won = filteredRfps.filter(r => r.status === 'won')
    const lost = filteredRfps.filter(r => r.status === 'lost')

    const totalPotentialValue = active.reduce((sum, r) => {
      return sum + (r.award_amount_max || r.award_amount_min || 0)
    }, 0)

    const wonValue = won.reduce((sum, r) => {
      return sum + (r.award_amount_max || r.award_amount_min || 0)
    }, 0)

    const winRate = won.length + lost.length > 0
      ? (won.length / (won.length + lost.length)) * 100
      : 0

    const avgAlignmentScore = active.length > 0
      ? active.reduce((sum, r) => sum + (r.alignment_score || 0), 0) / active.length
      : 0

    const urgentDeadlines = active.filter(r => {
      if (!r.response_deadline) return false
      const days = differenceInDays(new Date(r.response_deadline), new Date())
      return days >= 0 && days <= 14
    }).length

    return {
      total: filteredRfps.length,
      active: active.length,
      won: won.length,
      lost: lost.length,
      totalPotentialValue,
      wonValue,
      winRate,
      avgAlignmentScore,
      urgentDeadlines,
    }
  }, [filteredRfps])

  // Funnel data
  const funnelData = useMemo(() => {
    const stages = ['new', 'reviewing', 'pursuing', 'submitted', 'won']
    return stages.map((stage, idx) => {
      const count = rfpsByStage[stage]?.length || 0
      const value = (rfpsByStage[stage] || []).reduce((sum, r) => {
        return sum + (r.award_amount_max || r.award_amount_min || 0)
      }, 0)
      const prevCount = idx === 0 ? count : (rfpsByStage[stages[idx - 1]]?.length || 1)
      const conversionRate = prevCount > 0 ? (count / prevCount) * 100 : 0

      return { stage, count, value, conversionRate }
    })
  }, [rfpsByStage])

  const RFPCard = ({ rfp }: { rfp: RFPItem }) => {
    const deadline = rfp.response_deadline ? new Date(rfp.response_deadline) : null
    const daysUntilDeadline = deadline ? differenceInDays(deadline, new Date()) : null
    const isUrgent = daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 7
    const isOverdue = deadline && isPast(deadline) && !['won', 'lost', 'submitted'].includes(rfp.status)
    const linkedProposal = proposals.find(p => p.rfp_id === rfp.id)

    const handleClick = () => {
      router.push(`/workspace/${workspaceId}/rfp/${rfp.id}`)
    }

    return (
      <Card
        className="bg-zinc-800/50 border-zinc-700 cursor-pointer hover:bg-zinc-800 transition-colors mb-2"
        onClick={handleClick}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-zinc-200 text-sm line-clamp-2 mb-1 flex-1">{rfp.title}</h4>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-zinc-400 hover:text-amber-400"
              onClick={(e) => {
                e.stopPropagation()
                handleClick()
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-zinc-500 mb-2">{rfp.organization}</p>

          <div className="flex flex-wrap items-center gap-2">
            {rfp.award_amount_max && (
              <Badge variant="outline" className="text-xs">
                <DollarSign className="h-3 w-3 mr-1" />
                {(rfp.award_amount_max / 1000).toFixed(0)}k
              </Badge>
            )}

            {deadline && (
              <Badge className={`text-xs ${
                isOverdue ? 'bg-red-500/20 text-red-400' :
                isUrgent ? 'bg-amber-500/20 text-amber-400' :
                'bg-zinc-500/20 text-zinc-400'
              }`}>
                <Calendar className="h-3 w-3 mr-1" />
                {isOverdue ? 'Overdue' :
                 daysUntilDeadline === 0 ? 'Today' :
                 daysUntilDeadline === 1 ? 'Tomorrow' :
                 `${daysUntilDeadline}d`}
              </Badge>
            )}

            {rfp.alignment_score && (
              <Badge className={`text-xs ${
                rfp.alignment_score >= 80 ? 'bg-green-500/20 text-green-400' :
                rfp.alignment_score >= 60 ? 'bg-amber-500/20 text-amber-400' :
                'bg-zinc-500/20 text-zinc-400'
              }`}>
                {rfp.alignment_score}% fit
              </Badge>
            )}
          </div>

          {linkedProposal && (
            <div className="mt-2 pt-2 border-t border-zinc-700">
              <div className="flex items-center gap-1 text-xs text-blue-400">
                <FileText className="h-3 w-3" />
                Proposal: {linkedProposal.completion_percentage || 0}% complete
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-zinc-500">Active Pipeline</span>
            </div>
            <div className="text-2xl font-bold text-zinc-100">{metrics.active}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-xs text-zinc-500">Pipeline Value</span>
            </div>
            <div className="text-2xl font-bold text-zinc-100">
              ${(metrics.totalPotentialValue / 1000000).toFixed(1)}M
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-zinc-500">Win Rate</span>
            </div>
            <div className="text-2xl font-bold text-zinc-100">{metrics.winRate.toFixed(0)}%</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-xs text-zinc-500">Won Value</span>
            </div>
            <div className="text-2xl font-bold text-zinc-100">
              ${(metrics.wonValue / 1000).toFixed(0)}k
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-zinc-500">Urgent</span>
            </div>
            <div className="text-2xl font-bold text-zinc-100">{metrics.urgentDeadlines}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            className={viewMode === 'kanban' ? 'bg-blue-600' : 'border-zinc-700'}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'funnel' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('funnel')}
            className={viewMode === 'funnel' ? 'bg-blue-600' : 'border-zinc-700'}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Funnel
          </Button>
        </div>

        <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as typeof timeFilter)}>
          <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="60">Last 60 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {PIPELINE_STAGES.map(stage => (
            <div key={stage.key} className={`rounded-lg border-t-2 ${stage.color} ${stage.bgColor} p-3`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-zinc-300 text-sm">{stage.label}</h3>
                <Badge variant="outline" className="text-xs">
                  {rfpsByStage[stage.key]?.length || 0}
                </Badge>
              </div>
              <ScrollArea className="h-[400px]">
                {(rfpsByStage[stage.key] || []).map(rfp => (
                  <RFPCard key={rfp.id} rfp={rfp} />
                ))}
                {(rfpsByStage[stage.key]?.length || 0) === 0 && (
                  <div className="text-center py-8 text-zinc-600 text-xs">
                    No items
                  </div>
                )}
              </ScrollArea>
            </div>
          ))}
        </div>
      )}

      {/* Funnel View */}
      {viewMode === 'funnel' && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Grant Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelData.map((stage, idx) => {
                const maxCount = Math.max(...funnelData.map(s => s.count), 1)
                const widthPercentage = (stage.count / maxCount) * 100

                return (
                  <div key={stage.stage} className="relative">
                    <div className="flex items-center gap-4">
                      <div className="w-24 text-right">
                        <span className="text-sm text-zinc-400 capitalize">{stage.stage}</span>
                      </div>
                      <div className="flex-1">
                        <div
                          className={`h-10 rounded flex items-center px-3 transition-all ${
                            PIPELINE_STAGES.find(s => s.key === stage.stage)?.bgColor || 'bg-zinc-800'
                          }`}
                          style={{ width: `${Math.max(widthPercentage, 10)}%` }}
                        >
                          <span className="text-sm font-medium text-zinc-200">{stage.count}</span>
                          {stage.value > 0 && (
                            <span className="ml-2 text-xs text-zinc-400">
                              ${(stage.value / 1000).toFixed(0)}k
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-20 text-right">
                        {idx > 0 && (
                          <span className={`text-xs ${
                            stage.conversionRate >= 50 ? 'text-green-400' :
                            stage.conversionRate >= 25 ? 'text-amber-400' :
                            'text-red-400'
                          }`}>
                            {stage.conversionRate.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    {idx < funnelData.length - 1 && (
                      <div className="flex items-center justify-center py-1">
                        <ChevronRight className="h-4 w-4 text-zinc-600 rotate-90" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Funnel Summary */}
            <div className="mt-6 pt-6 border-t border-zinc-800 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-100">{metrics.active}</div>
                <div className="text-xs text-zinc-500">Active Opportunities</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{metrics.won}</div>
                <div className="text-xs text-zinc-500">Won</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{metrics.lost}</div>
                <div className="text-xs text-zinc-500">Lost</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import {
  FileText,
  Radar,
  Handshake,
  TrendingUp,
  Calendar,
  Clock,
  Trophy,
  AlertCircle,
  Loader2,
  Target,
  DollarSign,
  Bot,
  CheckSquare,
  Zap,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface AnalyticsClientProps {
  workspaceId: string
}

interface AnalyticsData {
  proposals: {
    total: number
    byStatus: Record<string, number>
  }
  rfps: {
    total: number
    byStatus: Record<string, number>
    upcomingDeadlines: number
    avgAlignmentScore: number
  }
  partners: {
    total: number
    byStatus: Record<string, number>
  }
  winRate: number
  monthlyActivity: Array<{ month: string; proposals: number; rfps: number }>
  upcomingDeadlines: Array<{
    id: string
    title: string
    deadline: string
    daysUntil: number
  }>
  pipelineValue: number
  wonValue: number
  lostValue: number
  aiUsage: {
    totalTokens: number
    totalCalls: number
    byAction: Record<string, number>
  }
  taskStats: {
    total: number
    completed: number
    inProgress: number
    pending: number
  }
}

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  draft: '#71717a',
  'in-progress': '#3b82f6',
  review: '#eab308',
  submitted: '#a855f7',
  won: '#22c55e',
  lost: '#ef4444',
}

const RFP_STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  reviewing: '#eab308',
  pursuing: '#22c55e',
  submitted: '#a855f7',
  won: '#10b981',
  lost: '#ef4444',
  archived: '#71717a',
}

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#71717a']

export function AnalyticsClient({ workspaceId }: AnalyticsClientProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`/api/analytics?workspaceId=${workspaceId}`)
        const analyticsData = await res.json()
        setData(analyticsData)
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [workspaceId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
        <p className="text-zinc-400">Failed to load analytics</p>
      </div>
    )
  }

  // Prepare chart data
  const proposalStatusData = Object.entries(data.proposals.byStatus)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' '),
      value,
      fill: PROPOSAL_STATUS_COLORS[name] || '#71717a',
    }))

  const rfpStatusData = Object.entries(data.rfps.byStatus)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: RFP_STATUS_COLORS[name] || '#71717a',
    }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Analytics & Insights</h1>
        <p className="text-zinc-400 text-sm mt-1">Track your pipeline performance and metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Total Proposals</p>
                <p className="text-3xl font-bold text-zinc-100">{data.proposals.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/20">
                <FileText className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Tracked RFPs</p>
                <p className="text-3xl font-bold text-zinc-100">{data.rfps.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/20">
                <Radar className="h-6 w-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Win Rate</p>
                <p className="text-3xl font-bold text-zinc-100">{data.winRate}%</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/20">
                <Trophy className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Partners</p>
                <p className="text-3xl font-bold text-zinc-100">{data.partners.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Handshake className="h-6 w-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Pipeline Value</p>
                <p className="text-2xl font-bold text-zinc-100">
                  ${data.pipelineValue ? (data.pipelineValue / 1000000).toFixed(2) : '0'}M
                </p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/20">
                <DollarSign className="h-6 w-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Grants Won</p>
                <p className="text-2xl font-bold text-green-400">
                  ${data.wonValue ? (data.wonValue / 1000).toFixed(0) : '0'}k
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/20">
                <Trophy className="h-6 w-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">AI Assists (30d)</p>
                <p className="text-2xl font-bold text-zinc-100">{data.aiUsage?.totalCalls || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Bot className="h-6 w-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Tasks Done</p>
                <p className="text-2xl font-bold text-zinc-100">
                  {data.taskStats?.completed || 0}/{data.taskStats?.total || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/20">
                <CheckSquare className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Activity */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              Monthly Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#fafafa' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="proposals"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rfps"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Proposal Status Distribution */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Proposal Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {proposalStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={proposalStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {proposalStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#27272a',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  No proposals yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RFP Status Bar Chart */}
        <Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Radar className="h-5 w-5 text-amber-500" />
              RFP Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {rfpStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rfpStatusData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis type="number" stroke="#71717a" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={12} width={80} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#27272a',
                        border: '1px solid #3f3f46',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {rfpStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-500">
                  No RFPs tracked yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Avg Alignment & Deadlines */}
        <div className="space-y-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                Avg Alignment Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-5xl font-bold text-zinc-100">
                  {data.rfps.avgAlignmentScore}%
                </p>
                <p className="text-sm text-zinc-400 mt-2">across analyzed RFPs</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <p className="text-5xl font-bold text-amber-400">
                  {data.rfps.upcomingDeadlines}
                </p>
                <p className="text-sm text-zinc-400 mt-2">in the next 30 days</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upcoming Deadlines List */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-red-500" />
            Deadline Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcomingDeadlines.length > 0 ? (
            <div className="space-y-3">
              {data.upcomingDeadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-100 font-medium truncate">{deadline.title}</p>
                    <p className="text-sm text-zinc-500">
                      {format(new Date(deadline.deadline), 'MMMM d, yyyy')}
                    </p>
                  </div>
                  <Badge
                    className={
                      deadline.daysUntil <= 3
                        ? 'bg-red-500/20 text-red-400'
                        : deadline.daysUntil <= 7
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }
                  >
                    {deadline.daysUntil === 1
                      ? 'Tomorrow'
                      : `${deadline.daysUntil} days`}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No upcoming deadlines</p>
              <p className="text-sm text-zinc-500 mt-1">Track RFPs to see deadlines here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

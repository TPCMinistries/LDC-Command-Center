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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch proposals with amounts
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id, title, status, created_at, updated_at, requested_amount')
      .eq('workspace_id', workspaceId)

    // Fetch RFPs with award amounts
    const { data: rfps } = await supabase
      .from('rfps')
      .select('id, title, status, response_deadline, alignment_score, created_at, award_amount_min, award_amount_max')
      .eq('workspace_id', workspaceId)

    // Fetch AI usage (agent logs)
    const { data: aiLogs } = await supabase
      .from('agent_logs')
      .select('tokens_used, action, created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    // Fetch tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, status, created_at')
      .eq('workspace_id', workspaceId)

    // Fetch partners
    const { data: partners } = await supabase
      .from('partners')
      .select('id, name, status, created_at')
      .eq('workspace_id', workspaceId)

    // Calculate proposal stats
    const proposalStats = {
      total: proposals?.length || 0,
      byStatus: {
        draft: proposals?.filter(p => p.status === 'draft').length || 0,
        'in-progress': proposals?.filter(p => p.status === 'in-progress').length || 0,
        review: proposals?.filter(p => p.status === 'review').length || 0,
        submitted: proposals?.filter(p => p.status === 'submitted').length || 0,
        won: proposals?.filter(p => p.status === 'won').length || 0,
        lost: proposals?.filter(p => p.status === 'lost').length || 0,
      },
    }

    // Calculate RFP stats
    const now = new Date()
    const upcomingDeadlines = rfps?.filter(r => {
      if (!r.response_deadline) return false
      const deadline = new Date(r.response_deadline)
      const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntil > 0 && daysUntil <= 30
    }) || []

    const rfpStats = {
      total: rfps?.length || 0,
      byStatus: {
        new: rfps?.filter(r => r.status === 'new').length || 0,
        reviewing: rfps?.filter(r => r.status === 'reviewing').length || 0,
        pursuing: rfps?.filter(r => r.status === 'pursuing').length || 0,
        submitted: rfps?.filter(r => r.status === 'submitted').length || 0,
        won: rfps?.filter(r => r.status === 'won').length || 0,
        lost: rfps?.filter(r => r.status === 'lost').length || 0,
        archived: rfps?.filter(r => r.status === 'archived').length || 0,
      },
      upcomingDeadlines: upcomingDeadlines.length,
      avgAlignmentScore: rfps?.length
        ? Math.round(
            (rfps.filter(r => r.alignment_score).reduce((acc, r) => acc + (r.alignment_score || 0), 0) /
              rfps.filter(r => r.alignment_score).length) || 0
          )
        : 0,
    }

    // Calculate partner stats
    const partnerStats = {
      total: partners?.length || 0,
      byStatus: {
        active: partners?.filter(p => p.status === 'active').length || 0,
        inactive: partners?.filter(p => p.status === 'inactive').length || 0,
        potential: partners?.filter(p => p.status === 'potential').length || 0,
      },
    }

    // Calculate win rate
    const totalDecided = proposalStats.byStatus.won + proposalStats.byStatus.lost
    const winRate = totalDecided > 0 ? Math.round((proposalStats.byStatus.won / totalDecided) * 100) : 0

    // Monthly activity (last 6 months)
    const monthlyActivity = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

      const monthProposals = proposals?.filter(p => {
        const created = new Date(p.created_at)
        return created >= monthStart && created <= monthEnd
      }).length || 0

      const monthRfps = rfps?.filter(r => {
        const created = new Date(r.created_at)
        return created >= monthStart && created <= monthEnd
      }).length || 0

      monthlyActivity.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        proposals: monthProposals,
        rfps: monthRfps,
      })
    }

    // Upcoming deadlines list
    const deadlinesList = upcomingDeadlines
      .sort((a, b) => new Date(a.response_deadline!).getTime() - new Date(b.response_deadline!).getTime())
      .slice(0, 5)
      .map(r => ({
        id: r.id,
        title: r.title,
        deadline: r.response_deadline,
        daysUntil: Math.ceil(
          (new Date(r.response_deadline!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      }))

    // Calculate pipeline value
    const activePipeline = (rfps || []).filter(r => ['new', 'reviewing', 'pursuing'].includes(r.status))
    const pipelineValue = activePipeline.reduce((sum, r) => {
      return sum + ((r as unknown as { award_amount_max?: number }).award_amount_max ||
                   (r as unknown as { award_amount_min?: number }).award_amount_min || 0)
    }, 0)

    // Calculate won/lost values
    const wonRfps = (rfps || []).filter(r => r.status === 'won')
    const lostRfps = (rfps || []).filter(r => r.status === 'lost')
    const wonValue = wonRfps.reduce((sum, r) => {
      return sum + ((r as unknown as { award_amount_max?: number }).award_amount_max ||
                   (r as unknown as { award_amount_min?: number }).award_amount_min || 0)
    }, 0)
    const lostValue = lostRfps.reduce((sum, r) => {
      return sum + ((r as unknown as { award_amount_max?: number }).award_amount_max ||
                   (r as unknown as { award_amount_min?: number }).award_amount_min || 0)
    }, 0)

    // AI usage stats (last 30 days)
    const aiUsage = {
      totalTokens: (aiLogs || []).reduce((sum, log) => sum + ((log as { tokens_used?: number }).tokens_used || 0), 0),
      totalCalls: (aiLogs || []).length,
      byAction: (aiLogs || []).reduce((acc, log) => {
        const action = (log as { action?: string }).action || 'other'
        acc[action] = (acc[action] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }

    // Task stats
    const taskStats = {
      total: (tasks || []).length,
      completed: (tasks || []).filter(t => t.status === 'done' || t.status === 'completed').length,
      inProgress: (tasks || []).filter(t => t.status === 'in_progress' || t.status === 'in-progress').length,
      pending: (tasks || []).filter(t => t.status === 'todo' || t.status === 'pending').length,
    }

    return NextResponse.json({
      proposals: proposalStats,
      rfps: rfpStats,
      partners: partnerStats,
      winRate,
      monthlyActivity,
      upcomingDeadlines: deadlinesList,
      pipelineValue,
      wonValue,
      lostValue,
      aiUsage,
      taskStats,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Mail,
  FolderKanban,
  FileText,
  Users,
  Mic,
  Sparkles,
} from 'lucide-react'
import { format } from 'date-fns'
import { UpcomingDeadlines } from '@/components/dashboard/UpcomingDeadlines'
import { QuickStats } from '@/components/dashboard/QuickStats'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { CalendarWidget } from '@/components/google/CalendarWidget'
import { EmailWidget } from '@/components/google/EmailWidget'

interface TodayPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function TodayPage({ params }: TodayPageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  // Fetch today's briefing
  const { data: briefing } = await supabase
    .from('daily_briefings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('date', today)
    .single()

  // Fetch a scripture for the day (from soul_scriptures)
  const { data: scripture } = await supabase
    .from('soul_scriptures')
    .select('*')
    .limit(1)
    .single()

  // Fetch upcoming tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['todo', 'in_progress'])
    .order('due_date', { ascending: true })
    .limit(5)

  // Fetch active projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .limit(3)

  // Fetch recent prophetic notes
  const { data: notes } = await supabase
    .from('prophetic_notes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">
          Good {getGreeting()}, Lorenzo
        </h1>
        <p className="text-zinc-400 mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Quick Stats */}
      <QuickStats workspaceId={workspaceId} />

      {/* Quick Actions */}
      <QuickActions workspaceId={workspaceId} />

      {/* Scripture of the Day */}
      <Card className="bg-gradient-to-br from-amber-900/20 to-zinc-900 border-amber-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-amber-500">
            <BookOpen className="h-5 w-5" />
            Scripture of the Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <blockquote className="text-lg text-zinc-200 italic">
            &ldquo;{scripture?.text || 'Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.'}&rdquo;
          </blockquote>
          <p className="text-amber-500 mt-2 font-medium">
            — {scripture?.reference || 'Proverbs 3:5-6'}
          </p>
          {briefing?.prophetic_word && (
            <div className="mt-4 pt-4 border-t border-amber-800/30">
              <p className="text-sm text-zinc-400 mb-1">Prophetic Focus:</p>
              <p className="text-zinc-300">{briefing.prophetic_word}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priorities */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Today&apos;s Priorities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(briefing?.priorities as Array<{ title: string; reason: string; type: string }> || [
              { title: 'Review RFP deadlines', reason: 'Two opportunities closing this week', type: 'rfp' },
              { title: 'Prepare sermon outline', reason: 'Sunday message draft needed', type: 'ministry' },
              { title: 'Team sync with Achumboro', reason: 'Weekly check-in scheduled', type: 'meeting' },
            ]).map((priority, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <div className="mt-0.5">
                  <CheckCircle2 className="h-5 w-5 text-zinc-500" />
                </div>
                <div className="flex-1">
                  <p className="text-zinc-100 font-medium">{priority.title}</p>
                  <p className="text-sm text-zinc-500">{priority.reason}</p>
                </div>
                <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                  {priority.type}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Google Calendar Widget */}
        <CalendarWidget workspaceId={workspaceId} compact />

        {/* Google Email Widget */}
        <EmailWidget workspaceId={workspaceId} compact />

        {/* Project Pulse */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <FolderKanban className="h-5 w-5 text-purple-500" />
              Project Pulse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(projects || [
              { title: 'DYCD Summer Youth Program', status: 'active', category: 'workforce' },
              { title: 'AI Strategy Playbook', status: 'active', category: 'content' },
              { title: 'Partner Portal MVP', status: 'active', category: 'tech' },
            ]).map((project, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50"
              >
                <div>
                  <p className="text-zinc-100 font-medium">{project.title}</p>
                  <p className="text-xs text-zinc-500">{project.category || 'Project'}</p>
                </div>
                <Badge
                  variant="outline"
                  className="border-purple-600 text-purple-400"
                >
                  {project.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* RFP Alerts - Dynamic Deadlines */}
        <UpcomingDeadlines workspaceId={workspaceId} />

        {/* Recent Activity */}
        <RecentActivity workspaceId={workspaceId} />

        {/* Ministry Corner */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Mic className="h-5 w-5 text-rose-500" />
              Ministry Corner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(notes || []).length > 0 ? (
                notes?.slice(0, 2).map((note) => (
                  <div key={note.id} className="p-3 rounded-lg bg-zinc-800/50">
                    <p className="text-zinc-100 font-medium">{note.title || 'Untitled Note'}</p>
                    <p className="text-sm text-zinc-500 mt-1">{note.summary?.slice(0, 100) || 'Processing...'}</p>
                    <div className="flex gap-2 mt-2">
                      {((note.themes as string[]) || []).slice(0, 2).map((theme, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-rose-800 text-rose-400">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-zinc-500">
                  <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent prophetic notes</p>
                  <p className="text-sm">Record your first audio note</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Closing Reflection */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6">
          <p className="text-center text-zinc-400 italic">
            {briefing?.closing_reflection ||
              '"The intersection of calling and competence is where kingdom impact happens. Stay grounded, stay focused, stay faithful."'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TasksClient } from '@/components/tasks/TasksClient'

interface TasksPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function TasksPage({ params }: TasksPageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()

  if (error || !workspace) {
    notFound()
  }

  // Fetch tasks with project info
  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      *,
      project:projects(id, title)
    `)
    .eq('workspace_id', workspaceId)
    .order('priority', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(100)

  // Fetch projects for task assignment
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, status')
    .eq('workspace_id', workspaceId)
    .in('status', ['planning', 'active'])
    .order('title', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Tasks</h1>
        <p className="text-zinc-400 mt-1">
          Manage your tasks, track progress, and stay organized
        </p>
      </div>

      <TasksClient
        workspaceId={workspaceId}
        initialTasks={tasks || []}
        projects={projects || []}
      />
    </div>
  )
}

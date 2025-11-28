import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProjectsClient } from '@/components/projects/ProjectsClient'

interface ProjectsPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function ProjectsPage({ params }: ProjectsPageProps) {
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

  // Fetch projects with RFP info
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      rfp:rfp_items(id, title, status)
    `)
    .eq('workspace_id', workspaceId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch task counts for each project
  const projectIds = projects?.map(p => p.id) || []
  let taskStats: Record<string, { total: number; completed: number }> = {}

  if (projectIds.length > 0) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('project_id, status')
      .in('project_id', projectIds)

    if (tasks) {
      taskStats = tasks.reduce((acc, t) => {
        if (!acc[t.project_id]) {
          acc[t.project_id] = { total: 0, completed: 0 }
        }
        acc[t.project_id].total++
        if (t.status === 'done') acc[t.project_id].completed++
        return acc
      }, {} as Record<string, { total: number; completed: number }>)
    }
  }

  const projectsWithStats = projects?.map(p => ({
    ...p,
    taskStats: taskStats[p.id] || { total: 0, completed: 0 },
    progress: taskStats[p.id]?.total > 0
      ? Math.round((taskStats[p.id].completed / taskStats[p.id].total) * 100)
      : 0,
  }))

  // Fetch RFPs for linking
  const { data: rfps } = await supabase
    .from('rfp_items')
    .select('id, title, status')
    .eq('workspace_id', workspaceId)
    .in('status', ['new', 'reviewing', 'pursuing'])
    .order('title', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Projects</h1>
        <p className="text-zinc-400 mt-1">
          Track initiatives, manage timelines, and monitor progress
        </p>
      </div>

      <ProjectsClient
        workspaceId={workspaceId}
        initialProjects={projectsWithStats || []}
        rfps={rfps || []}
      />
    </div>
  )
}

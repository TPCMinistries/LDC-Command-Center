import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { IdeasClient } from '@/components/ideas/IdeasClient'

interface IdeasPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function IdeasPage({ params }: IdeasPageProps) {
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

  // Fetch recent ideas
  const { data: ideas } = await supabase
    .from('ideas')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Ideas Hub</h1>
        <p className="text-zinc-400 mt-1">
          Capture, analyze, and transform your ideas into content
        </p>
      </div>

      <IdeasClient
        workspaceId={workspaceId}
        workspaceName={(workspace as { name: string }).name}
        initialIdeas={ideas || []}
      />
    </div>
  )
}

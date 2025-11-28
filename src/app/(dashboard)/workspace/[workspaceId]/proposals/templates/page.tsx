import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TemplatesClient } from './TemplatesClient'

interface TemplatesPageProps {
  params: Promise<{
    workspaceId: string
  }>
}

interface Workspace {
  id: string
  name: string
  slug: string
}

async function getWorkspace(workspaceId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, slug')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    redirect('/')
  }

  return { workspace: workspace as Workspace, userId: user.id }
}

export default async function TemplatesPage({ params }: TemplatesPageProps) {
  const { workspaceId } = await params
  const { workspace, userId } = await getWorkspace(workspaceId)

  return (
    <div className="min-h-screen bg-zinc-950">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        }
      >
        <TemplatesClient
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          userId={userId}
        />
      </Suspense>
    </div>
  )
}

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'

interface AnalyticsPageProps {
  params: Promise<{
    workspaceId: string
  }>
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

  return { workspaceId: workspace.id as string }
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { workspaceId } = await params
  const { workspaceId: validWorkspaceId } = await getWorkspace(workspaceId)

  return (
    <div className="min-h-screen">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
          </div>
        }
      >
        <AnalyticsClient workspaceId={validWorkspaceId} />
      </Suspense>
    </div>
  )
}

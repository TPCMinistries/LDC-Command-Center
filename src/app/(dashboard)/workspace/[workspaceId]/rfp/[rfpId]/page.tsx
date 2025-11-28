import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RFPDetailClient } from '@/components/rfp/RFPDetailClient'

interface PageProps {
  params: Promise<{
    workspaceId: string
    rfpId: string
  }>
}

export default async function RFPDetailPage({ params }: PageProps) {
  const { workspaceId, rfpId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch the RFP
  const { data: rfp, error } = await supabase
    .from('rfps')
    .select('*')
    .eq('id', rfpId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !rfp) {
    redirect(`/workspace/${workspaceId}/rfp`)
  }

  // Fetch related proposals
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, status, submission_deadline, completion_percentage')
    .eq('rfp_id', rfpId)
    .order('created_at', { ascending: false })

  // Fetch workspace for context
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, settings')
    .eq('id', workspaceId)
    .single()

  return (
    <div className="max-w-6xl mx-auto">
      <RFPDetailClient
        rfp={rfp}
        proposals={proposals || []}
        workspaceId={workspaceId}
        workspaceName={workspace?.name || 'Workspace'}
      />
    </div>
  )
}

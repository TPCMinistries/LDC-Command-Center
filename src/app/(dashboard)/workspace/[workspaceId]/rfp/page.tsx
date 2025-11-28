import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RFPClient } from '@/components/rfp/RFPClient'

interface RFPPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function RFPPage({ params }: RFPPageProps) {
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

  // Fetch tracked RFPs
  const { data: trackedRfps } = await supabase
    .from('rfp_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">RFP Radar</h1>
        <p className="text-zinc-400 mt-1">
          Search, analyze, and track government contracting opportunities
        </p>
      </div>

      <RFPClient
        workspaceId={workspaceId}
        workspaceName={(workspace as { name: string }).name}
        initialRfps={trackedRfps || []}
      />
    </div>
  )
}

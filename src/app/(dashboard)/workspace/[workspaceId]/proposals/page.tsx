import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ProposalsClient } from '@/components/proposals/ProposalsClient'

interface ProposalsPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function ProposalsPage({ params }: ProposalsPageProps) {
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

  // Fetch proposals
  const { data: proposals } = await supabase
    .from('proposals')
    .select(`
      *,
      rfp:rfp_items(id, title, agency, response_deadline),
      template:proposal_templates(id, name, category)
    `)
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(50)

  // Fetch templates
  const { data: templates } = await supabase
    .from('proposal_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)

  // Fetch RFPs that could be linked to proposals
  const { data: rfps } = await supabase
    .from('rfp_items')
    .select('id, title, agency, response_deadline, status')
    .eq('workspace_id', workspaceId)
    .in('status', ['new', 'reviewing', 'pursuing'])
    .order('response_deadline', { ascending: true })
    .limit(20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Grant Proposals</h1>
        <p className="text-zinc-400 mt-1">
          Write winning proposals with AI-powered assistance
        </p>
      </div>

      <ProposalsClient
        workspaceId={workspaceId}
        initialProposals={proposals || []}
        templates={templates || []}
        rfps={rfps || []}
      />
    </div>
  )
}

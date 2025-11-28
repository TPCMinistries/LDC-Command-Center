import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PartnersClient } from '@/components/partners/PartnersClient'

interface PartnersPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function PartnersPage({ params }: PartnersPageProps) {
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

  // Fetch partners
  const { data: partners } = await supabase
    .from('partners')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Coalition Partners</h1>
        <p className="text-zinc-400 mt-1">
          Manage partner organizations, assess capacity, and build grant coalitions
        </p>
      </div>

      <PartnersClient
        workspaceId={workspaceId}
        initialPartners={partners || []}
      />
    </div>
  )
}

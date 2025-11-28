import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SettingsClient } from '@/components/settings/SettingsClient'

interface SettingsPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function SettingsPage({ params }: SettingsPageProps) {
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-400 mt-1">Manage your workspace settings and brand voice</p>
      </div>

      <SettingsClient
        workspaceId={workspaceId}
        workspaceName={(workspace as { name: string }).name}
        initialBranding={(workspace as { branding?: Record<string, unknown> }).branding || {}}
      />
    </div>
  )
}

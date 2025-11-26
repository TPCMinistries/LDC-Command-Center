import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface WorkspaceLayoutProps {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  // Verify workspace exists and user has access
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('id, name, slug, type')
    .eq('id', workspaceId)
    .single()

  if (error || !workspace) {
    notFound()
  }

  return <>{children}</>
}

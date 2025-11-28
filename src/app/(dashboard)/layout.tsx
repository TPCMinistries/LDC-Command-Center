import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || ''

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's workspaces with settings
  const { data: workspacesData } = await supabase
    .from('workspaces')
    .select('id, name, slug, type, settings')
    .order('type', { ascending: true }) // personal first
    .order('created_at', { ascending: true })

  // Type the workspaces properly
  const workspaces = (workspacesData || []) as Array<{
    id: string
    name: string
    slug: string
    type: 'personal' | 'organization'
    settings?: { modules?: string[] }
  }>

  // Try to extract current workspace ID from URL
  const workspaceMatch = pathname.match(/\/workspace\/([^\/]+)/)
  const currentWorkspaceId = workspaceMatch ? workspaceMatch[1] : null

  // Find current workspace or default to first
  const currentWorkspace = currentWorkspaceId
    ? workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0] || null
    : workspaces[0] || null

  // Fetch user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

  const userInfo = {
    id: user.id,
    email: user.email,
    full_name: profile?.full_name || user.user_metadata?.full_name,
    avatar_url: profile?.avatar_url,
  }

  return (
    <DashboardShell
      workspaces={workspaces}
      currentWorkspace={currentWorkspace}
      user={userInfo}
    >
      {children}
    </DashboardShell>
  )
}

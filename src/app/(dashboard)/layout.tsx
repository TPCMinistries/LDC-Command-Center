import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, slug, type')
    .order('created_at', { ascending: true })

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
    <div className="min-h-screen bg-zinc-950">
      <Sidebar
        workspaces={workspaces || []}
        currentWorkspace={workspaces?.[0] || null}
      />
      <div className="pl-64">
        <Header user={userInfo} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}

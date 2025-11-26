import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's first workspace or create a personal one
  let { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)

  if (!workspaces || workspaces.length === 0) {
    // Create personal workspace for new user
    const { data: newWorkspace, error } = await supabase
      .from('workspaces')
      .insert({
        name: 'Personal',
        slug: `personal-${user.id.slice(0, 8)}`,
        type: 'personal',
        owner_id: user.id,
        description: 'Your personal command center',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create workspace:', error)
      // Show error or redirect to onboarding
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-zinc-100">Setting up your workspace...</h2>
            <p className="text-zinc-500 mt-2">Please refresh the page</p>
          </div>
        </div>
      )
    }

    // Also create user profile if it doesn't exist
    await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || null,
        timezone: 'America/New_York',
      })

    redirect(`/workspace/${newWorkspace.id}/today`)
  }

  redirect(`/workspace/${workspaces[0].id}/today`)
}

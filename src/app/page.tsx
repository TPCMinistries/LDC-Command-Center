import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's first workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)

  if (workspaces && workspaces.length > 0) {
    redirect(`/workspace/${workspaces[0].id}/today`)
  }

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
    redirect('/login')
  }

  // Create user profile
  await supabase.from('user_profiles').upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name || null,
    timezone: 'America/New_York',
  })

  redirect(`/workspace/${newWorkspace.id}/today`)
}

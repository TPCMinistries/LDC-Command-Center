import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Create new workspace
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, type, branding, settings } = await request.json()

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Workspace name must be at least 2 characters' },
        { status: 400 }
      )
    }

    // Generate slug from name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check if slug exists and make unique if needed
    const { data: existingSlugs } = await supabase
      .from('workspaces')
      .select('slug')
      .ilike('slug', `${baseSlug}%`)

    let slug = baseSlug
    if (existingSlugs && existingSlugs.length > 0) {
      const existingSet = new Set(existingSlugs.map((w) => w.slug))
      let counter = 1
      while (existingSet.has(slug)) {
        slug = `${baseSlug}-${counter}`
        counter++
      }
    }

    // Create workspace
    const { data: workspace, error: createError } = await supabase
      .from('workspaces')
      .insert({
        name: name.trim(),
        slug,
        type: type || 'organization',
        owner_id: user.id,
        description: description || null,
        branding: branding || {},
        settings: settings || { modules: ['all'] },
      } as Record<string, unknown>)
      .select()
      .single()

    if (createError) {
      console.error('Failed to create workspace:', createError)
      return NextResponse.json(
        { error: 'Failed to create workspace' },
        { status: 500 }
      )
    }

    // Add owner as workspace member
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner',
        joined_at: new Date().toISOString(),
      } as Record<string, unknown>)

    if (memberError) {
      console.error('Failed to add workspace member:', memberError)
      // Cleanup: delete the workspace if member creation fails
      await supabase.from('workspaces').delete().eq('id', workspace.id)
      return NextResponse.json(
        { error: 'Failed to setup workspace membership' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        type: workspace.type,
      },
    })
  } catch (error) {
    console.error('Workspace creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - List user's workspaces
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspaces where user is a member
    const { data: memberships, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)

    if (memberError) {
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: 500 }
      )
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ workspaces: [] })
    }

    const workspaceIds = memberships.map((m) => m.workspace_id)

    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name, slug, type, description, branding, settings, created_at')
      .in('id', workspaceIds)
      .order('created_at', { ascending: true })

    if (wsError) {
      return NextResponse.json(
        { error: 'Failed to fetch workspace details' },
        { status: 500 }
      )
    }

    // Merge role into workspace data
    const workspacesWithRoles = workspaces?.map((ws) => ({
      ...ws,
      role: memberships.find((m) => m.workspace_id === ws.id)?.role,
    }))

    return NextResponse.json({ workspaces: workspacesWithRoles || [] })
  } catch (error) {
    console.error('Workspace list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

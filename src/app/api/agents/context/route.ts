import { NextRequest, NextResponse } from 'next/server'
import { getContextSettings, updateContextSettings, type ContextSettings } from '@/lib/agents/memory'

/**
 * Context Settings API
 *
 * Manages agent context modes:
 * - full: Cross-workspace context, full history
 * - focused: Single workspace only (for client confidentiality)
 * - minimal: Just current workspace name
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const settings = await getContextSettings(workspaceId)

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching context settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, settings } = body as {
      workspaceId: string
      settings: Partial<ContextSettings>
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    await updateContextSettings(workspaceId, settings)

    const updatedSettings = await getContextSettings(workspaceId)

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    })
  } catch (error) {
    console.error('Error updating context settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

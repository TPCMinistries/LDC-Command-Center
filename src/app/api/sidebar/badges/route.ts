import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ tasks: 0, messages: 0 })
    }

    // Get pending tasks count
    const { count: tasksCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assignee_id', user.id)
      .eq('status', 'pending')

    // Get unread messages count (if communications table exists)
    let messagesCount = 0
    try {
      const { count } = await supabase
        .from('communications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false)
      messagesCount = count || 0
    } catch {
      // Table might not exist yet
    }

    return NextResponse.json({
      tasks: tasksCount || 0,
      messages: messagesCount,
    })
  } catch (error) {
    console.error('Error fetching badges:', error)
    return NextResponse.json({ tasks: 0, messages: 0 })
  }
}

import { createClient } from '@/lib/supabase/server'
import { ChatClient } from '@/components/chat/ChatClient'

interface ChatPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  // Fetch user
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch conversations
  const { data: conversations } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('is_pinned', { ascending: false })
    .order('last_message_at', { ascending: false, nullsFirst: false })

  return (
    <ChatClient
      workspaceId={workspaceId}
      userId={user?.id || ''}
      initialConversations={conversations || []}
    />
  )
}

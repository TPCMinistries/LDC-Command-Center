'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MessageSquare,
  Plus,
  Send,
  Loader2,
  MoreVertical,
  Pin,
  Archive,
  Trash2,
  Edit2,
  Bot,
  User,
  Sparkles,
  Check,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import ReactMarkdown from 'react-markdown'

interface Conversation {
  id: string
  title: string
  model: string
  is_pinned: boolean
  is_archived: boolean
  message_count: number
  last_message_at: string | null
  created_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  tokens_used?: number
  created_at: string
}

interface ChatClientProps {
  workspaceId: string
  userId: string
  initialConversations: Conversation[]
}

const MODELS = [
  // OpenAI GPT-5.1 (newest - Nov 2025)
  { id: 'gpt-5.1', name: 'GPT-5.1 Instant', provider: 'OpenAI', icon: '🟢' },
  { id: 'gpt-5.1-thinking', name: 'GPT-5.1 Thinking', provider: 'OpenAI', icon: '🔵' },
  // Anthropic Claude
  { id: 'claude', name: 'Claude 4 Sonnet', provider: 'Anthropic', icon: '🟣' },
  { id: 'claude-opus', name: 'Claude 4 Opus', provider: 'Anthropic', icon: '🟣' },
  { id: 'claude-3.5', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', icon: '🟣' },
  // OpenAI GPT-4 series
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', icon: '🟢' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', icon: '🟢' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', icon: '🟢' },
  { id: 'o1', name: 'o1 (Reasoning)', provider: 'OpenAI', icon: '🔵' },
  { id: 'o1-mini', name: 'o1-mini', provider: 'OpenAI', icon: '🔵' },
]

export function ChatClient({ workspaceId, userId, initialConversations }: ChatClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState('claude')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id)
      setSelectedModel(activeConversation.model)
    } else {
      setMessages([])
    }
  }, [activeConversation])

  const loadMessages = async (conversationId: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/chat/messages?conversationId=${conversationId}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
    setIsLoading(false)
  }

  const createConversation = async () => {
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          model: selectedModel,
        }),
      })
      const data = await res.json()
      if (data.conversation) {
        setConversations([data.conversation, ...conversations])
        setActiveConversation(data.conversation)
        setMessages([])
        inputRef.current?.focus()
      }
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !activeConversation || isSending) return

    const userMessage = input.trim()
    setInput('')
    setIsSending(true)

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    }
    setMessages([...messages, tempUserMessage])

    try {
      const res = await fetch('/api/chat/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          message: userMessage,
          model: selectedModel,
        }),
      })
      const data = await res.json()

      if (data.error) {
        // Remove temp message and show error
        setMessages(msgs => msgs.filter(m => m.id !== tempUserMessage.id))
        alert(data.error)
      } else if (data.message) {
        // Replace temp message with real one and add assistant response
        setMessages(msgs => [
          ...msgs.filter(m => m.id !== tempUserMessage.id),
          { ...tempUserMessage, id: `user-${Date.now()}` },
          data.message,
        ])

        // Update conversation in list
        setConversations(convs =>
          convs.map(c =>
            c.id === activeConversation.id
              ? { ...c, message_count: c.message_count + 2, last_message_at: new Date().toISOString() }
              : c
          )
        )
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(msgs => msgs.filter(m => m.id !== tempUserMessage.id))
    }

    setIsSending(false)
  }

  const updateConversation = async (conversationId: string, updates: Partial<Conversation>) => {
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, ...updates }),
      })
      const data = await res.json()
      if (data.conversation) {
        setConversations(convs =>
          convs.map(c => c.id === conversationId ? data.conversation : c)
        )
        if (activeConversation?.id === conversationId) {
          setActiveConversation(data.conversation)
        }
      }
    } catch (error) {
      console.error('Failed to update conversation:', error)
    }
  }

  const deleteConversation = async (conversationId: string) => {
    if (!confirm('Delete this conversation?')) return

    try {
      await fetch(`/api/chat/conversations?conversationId=${conversationId}`, {
        method: 'DELETE',
      })
      setConversations(convs => convs.filter(c => c.id !== conversationId))
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null)
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar - Conversations */}
      <Card className="w-80 bg-zinc-900 border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <Button
            onClick={createConversation}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Start a new chat above</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                    activeConversation?.id === conv.id
                      ? 'bg-amber-600/20 border border-amber-500/50'
                      : 'hover:bg-zinc-800 border border-transparent'
                  }`}
                  onClick={() => setActiveConversation(conv)}
                >
                  <div className="flex items-start gap-2">
                    {conv.is_pinned && (
                      <Pin className="h-3 w-3 text-amber-400 mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {editingTitle === conv.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100"
                            autoFocus
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateConversation(conv.id, { title: newTitle })
                              setEditingTitle(null)
                            }}
                            className="p-1 text-green-400 hover:text-green-300"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingTitle(null)
                            }}
                            className="p-1 text-zinc-400 hover:text-zinc-300"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {conv.title}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-500">
                          {MODELS.find(m => m.id === conv.model)?.icon} {conv.model}
                        </Badge>
                        {conv.last_message_at && (
                          <span className="text-xs text-zinc-600">
                            {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingTitle(conv.id)
                            setNewTitle(conv.title)
                          }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            updateConversation(conv.id, { is_pinned: !conv.is_pinned } as Partial<Conversation>)
                          }}
                        >
                          <Pin className="h-4 w-4 mr-2" />
                          {conv.is_pinned ? 'Unpin' : 'Pin'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            updateConversation(conv.id, { is_archived: true } as Partial<Conversation>)
                          }}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-zinc-700" />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteConversation(conv.id)
                          }}
                          className="text-red-400 focus:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 bg-zinc-900 border-zinc-800 flex flex-col">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="font-medium text-zinc-100">{activeConversation.title}</h2>
                <p className="text-xs text-zinc-500">
                  {activeConversation.message_count} messages
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Model:</span>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-44 bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <span>{model.icon}</span>
                          <span>{model.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <Sparkles className="h-12 w-12 mb-4 opacity-50" />
                  <p>Start a conversation</p>
                  <p className="text-sm mt-1">
                    Using {MODELS.find(m => m.id === selectedModel)?.name}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : ''
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] rounded-lg p-4 ${
                          message.role === 'user'
                            ? 'bg-amber-600/20 text-zinc-100'
                            : 'bg-zinc-800 text-zinc-200'
                        }`}
                      >
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                        {message.role === 'assistant' && message.model && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                            <span>{message.model}</span>
                            {message.tokens_used && (
                              <span>• {message.tokens_used} tokens</span>
                            )}
                          </div>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-4">
                        <Loader2 className="h-5 w-5 text-zinc-400 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-zinc-800">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={1}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                  style={{ minHeight: '48px', maxHeight: '200px' }}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isSending}
                  className="bg-amber-600 hover:bg-amber-700 px-4"
                >
                  {isSending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-zinc-500 mt-2 text-center">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-zinc-300 mb-2">AI Chat Hub</h3>
              <p className="text-zinc-500 mb-6">
                Chat with Claude or GPT-4. Your conversations are saved forever.
              </p>
              <Button onClick={createConversation} className="bg-amber-600 hover:bg-amber-700">
                <Plus className="h-4 w-4 mr-2" />
                Start New Conversation
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

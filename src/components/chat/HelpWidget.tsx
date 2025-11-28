'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  HelpCircle,
  X,
  Send,
  Loader2,
  Minimize2,
  Maximize2,
  Bot,
  User,
  Sparkles,
  Eye,
  EyeOff,
  MessageSquare,
  RefreshCw,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface HelpWidgetProps {
  workspaceId: string
}

// Help system prompt for general assistance
const GENERAL_HELP_PROMPT = `You are a helpful assistant for the LDC Command Center application. This is an AI-powered workspace for nonprofit organizations to manage:

- Grant proposals and RFP tracking
- Contact CRM and relationship management
- Project and task management
- Ministry/prophetic notes (audio transcription)
- AI agents for research and outreach

Be concise, friendly, and helpful. Guide users through features and answer questions about how to use the app. If they're stuck, suggest next steps.`

// Context-aware system prompt
const CONTEXT_AWARE_PROMPT = `You are an intelligent assistant for the LDC Command Center application. You have access to context about what the user is currently viewing. Use this context to provide relevant, specific help.

Be proactive - if you see they're on a particular page, offer tips specific to that feature. Be concise but thorough.`

// Page context descriptions
const PAGE_CONTEXTS: Record<string, string> = {
  '/today': 'User is viewing Today\'s dashboard with their daily briefing, priorities, calendar, and quick actions.',
  '/agents': 'User is in the AI Agents Hub where they can interact with the Chief of Staff agent for suggestions and research.',
  '/rfp': 'User is in the RFP/Grant search and tracking section. They can search for opportunities, track them in a pipeline, and analyze fit.',
  '/proposals': 'User is in the Proposal Editor where they can write and manage grant proposals with AI assistance.',
  '/contacts': 'User is in the Contact CRM to manage relationships with donors, partners, vendors, and other contacts.',
  '/projects': 'User is viewing their Projects dashboard to track active projects, tasks, and progress.',
  '/tasks': 'User is in the Tasks section to manage their to-do items, deadlines, and priorities.',
  '/chat': 'User is in the AI Chat Hub where they can have persistent conversations with Claude or GPT models.',
  '/ministry': 'User is in the Ministry section for recording and managing prophetic notes and audio transcriptions.',
  '/analytics': 'User is viewing Analytics to see workspace metrics, trends, and insights.',
}

export function HelpWidget({ workspaceId }: HelpWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isContextAware, setIsContextAware] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const pathname = usePathname()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Get context based on current page
  const getPageContext = () => {
    if (!isContextAware) return null

    // Find matching context
    for (const [path, context] of Object.entries(PAGE_CONTEXTS)) {
      if (pathname.includes(path)) {
        return {
          page: path,
          description: context,
          fullPath: pathname,
        }
      }
    }
    return { page: 'unknown', description: 'User is navigating the application.', fullPath: pathname }
  }

  // Initialize or get conversation
  const ensureConversation = async () => {
    if (conversationId) return conversationId

    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          title: 'Help Assistant',
          model: 'claude',
          contextType: 'help',
        }),
      })
      const data = await res.json()
      if (data.conversation) {
        setConversationId(data.conversation.id)
        return data.conversation.id
      }
    } catch (error) {
      console.error('Failed to create help conversation:', error)
    }
    return null
  }

  const sendMessage = async () => {
    if (!input.trim() || isSending) return

    const userMessage = input.trim()
    setInput('')
    setIsSending(true)

    // Add user message
    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
    }
    setMessages([...messages, newUserMessage])

    try {
      const convId = await ensureConversation()
      if (!convId) throw new Error('No conversation')

      const contextData = getPageContext()
      const systemPrompt = isContextAware ? CONTEXT_AWARE_PROMPT : GENERAL_HELP_PROMPT

      const res = await fetch('/api/chat/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          message: userMessage,
          model: 'claude',
          systemPrompt,
          contextData: contextData ? {
            currentPage: contextData.page,
            pageDescription: contextData.description,
            fullPath: contextData.fullPath,
          } : undefined,
        }),
      })

      const data = await res.json()

      if (data.error) {
        setMessages(msgs => [
          ...msgs,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Sorry, I encountered an error: ${data.error}`,
          },
        ])
      } else if (data.message) {
        setMessages(msgs => [
          ...msgs,
          {
            id: data.message.id || `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.message.content,
          },
        ])
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setMessages(msgs => [
        ...msgs,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I couldn\'t process your request. Please try again.',
        },
      ])
    }

    setIsSending(false)
  }

  const clearChat = () => {
    setMessages([])
    setConversationId(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-amber-600 hover:bg-amber-700 shadow-lg flex items-center justify-center transition-all hover:scale-105"
      >
        <HelpCircle className="h-6 w-6 text-white" />
      </button>
    )
  }

  return (
    <Card
      className={`fixed bottom-6 right-6 z-50 bg-zinc-900 border-zinc-700 shadow-2xl flex flex-col transition-all ${
        isExpanded ? 'w-[500px] h-[600px]' : 'w-96 h-[480px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-zinc-100 text-sm">Help Assistant</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsContextAware(!isContextAware)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  isContextAware ? 'text-green-400' : 'text-zinc-500'
                }`}
              >
                {isContextAware ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
                {isContextAware ? 'Context-aware' : 'General mode'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={clearChat}
            className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
            title="Clear chat"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Context Badge */}
      {isContextAware && (
        <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-800/50">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
              <Eye className="h-3 w-3 mr-1" />
              Viewing: {getPageContext()?.page || 'app'}
            </Badge>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <MessageSquare className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm text-center">How can I help you today?</p>
            <p className="text-xs text-center mt-1 text-zinc-600">
              {isContextAware
                ? 'I can see you\'re on this page and will give relevant help.'
                : 'Ask me anything about the app!'}
            </p>
            <div className="mt-4 space-y-2">
              {[
                'How do I track a new RFP?',
                'Help me write a proposal',
                'What are the keyboard shortcuts?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full text-left px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-amber-600/20 text-zinc-100'
                      : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
                    <User className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isSending && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Bot className="h-3 w-3 text-white" />
                </div>
                <div className="bg-zinc-800 rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-zinc-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            rows={1}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
            style={{ minHeight: '40px', maxHeight: '100px' }}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            size="icon"
            className="bg-amber-600 hover:bg-amber-700 h-10 w-10"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}

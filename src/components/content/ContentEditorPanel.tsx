'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  X,
  Send,
  Loader2,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Lightbulb,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  revisedContent?: string | null
}

interface ContentEditorPanelProps {
  isOpen: boolean
  onClose: () => void
  contentId?: string
  contentType: string
  currentContent: string
  workspaceId: string
  onContentUpdate?: (newContent: string) => void
}

const COACHING_PROMPTS: Record<string, string[]> = {
  sermon_outline: [
    "Make the introduction more engaging",
    "Add a personal illustration to point 2",
    "Make the call to action more compelling",
    "Add more scripture references",
    "Simplify the language for a younger audience",
  ],
  email: [
    "Make the subject line more compelling",
    "Add more urgency to the call-to-action",
    "Make it shorter and more scannable",
    "Add a more personal opening",
    "Make the P.S. more engaging",
  ],
  blog: [
    "Improve SEO for my target keyword",
    "Add a more compelling hook",
    "Break up long paragraphs",
    "Add more subheadings",
    "Strengthen the conclusion",
  ],
  facebook: [
    "Make it more conversational",
    "Add a thought-provoking question",
    "Make it more shareable",
    "Shorten for better engagement",
  ],
  instagram: [
    "Improve the first line hook",
    "Optimize hashtags for reach",
    "Make it more personal",
    "Add a clear call-to-action",
  ],
  linkedin: [
    "Add a professional insight",
    "Make it more thought-leadership focused",
    "Strengthen the opening statement",
    "Make it more discussion-worthy",
  ],
  twitter: [
    "Make it more quotable",
    "Create a thread version",
    "Add more punch to the first line",
    "Optimize for retweets",
  ],
  tiktok: [
    "Strengthen the hook (first 3 seconds)",
    "Add more energy to the script",
    "Make the payoff more satisfying",
    "Add visual/transition suggestions",
  ],
}

export function ContentEditorPanel({
  isOpen,
  onClose,
  contentId,
  contentType,
  currentContent,
  workspaceId,
  onContentUpdate,
}: ContentEditorPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const suggestions = COACHING_PROMPTS[contentType] || COACHING_PROMPTS.facebook

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset messages when panel closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([])
      setInputValue('')
    }
  }, [isOpen])

  const handleSend = async (messageText?: string) => {
    const text = messageText || inputValue.trim()
    if (!text || isLoading) return

    const userMessage: ChatMessage = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/agents/content/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          contentType,
          currentContent,
          messages: [...messages, userMessage],
          workspaceId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        revisedContent: data.revisedContent,
      }

      setMessages(prev => [...prev, assistantMessage])

      // If there's revised content, notify parent
      if (data.revisedContent && onContentUpdate) {
        onContentUpdate(data.revisedContent)
      }
    } catch (error) {
      toast.error('Failed to get response', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const copyRevisedContent = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIndex(index)
      toast.success('Copied revised content!')
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const applyRevisedContent = (content: string) => {
    if (onContentUpdate) {
      onContentUpdate(content)
      toast.success('Content updated!', {
        description: 'The revised content has been applied.',
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-amber-500" />
          <h2 className="font-semibold text-zinc-100">Content Editor</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-100"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Coaching Suggestions */}
      {messages.length === 0 && (
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-zinc-300">Try these prompts:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSend(suggestion)}
                className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full transition-colors border border-zinc-700"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-amber-500/50 mx-auto mb-4" />
            <p className="text-zinc-400 text-sm">
              Ask me to refine, edit, or improve your content.
              <br />
              Click a suggestion above or type your request below.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-amber-600 text-white'
                    : 'bg-zinc-800 text-zinc-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {/* Revised Content Actions */}
                {message.revisedContent && (
                  <div className="mt-3 pt-3 border-t border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="h-3 w-3 text-green-400" />
                      <span className="text-xs text-green-400 font-medium">
                        Revised content available
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-zinc-600"
                        onClick={() => copyRevisedContent(message.revisedContent!, index)}
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-green-600 hover:bg-green-700"
                        onClick={() => applyRevisedContent(message.revisedContent!)}
                      >
                        Apply Changes
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-lg p-3">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions (when conversation has started) */}
      {messages.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {suggestions.slice(0, 3).map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSend(suggestion)}
                disabled={isLoading}
                className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-full whitespace-nowrap transition-colors disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        <Card className="bg-zinc-900 border-zinc-700">
          <div className="flex items-end gap-2 p-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to refine your content..."
              className="flex-1 bg-transparent border-none text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none text-sm min-h-[40px] max-h-[120px]"
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
              className="bg-amber-600 hover:bg-amber-700 h-8 w-8 shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Card>
        <p className="text-xs text-zinc-500 mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

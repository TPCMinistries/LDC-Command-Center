'use client'

import { useState, useEffect } from 'react'
import { Mail, RefreshCw, Send, Loader2, Circle, ExternalLink, Search, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { format, parseISO, isToday, isYesterday } from 'date-fns'

interface Email {
  id: string
  threadId: string
  snippet: string
  from: string
  to: string
  subject: string
  date: string
  labelIds: string[]
  isUnread: boolean
}

interface EmailWidgetProps {
  workspaceId: string
  compact?: boolean
}

export function EmailWidget({ workspaceId, compact = false }: EmailWidgetProps) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchEmails()
  }, [workspaceId])

  const fetchEmails = async (query?: string) => {
    try {
      const q = query ? `&q=${encodeURIComponent(query)}` : ''
      const response = await fetch(
        `/api/google/gmail?workspaceId=${workspaceId}&maxResults=20${q}`
      )
      const data = await response.json()

      if (data.connected === false) {
        setConnected(false)
      } else if (data.emails) {
        setConnected(true)
        setEmails(data.emails)
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchEmails(searchQuery)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    fetchEmails(searchQuery)
  }

  const parseFromEmail = (from: string) => {
    const match = from.match(/^(.+?)\s*<(.+)>$/)
    if (match) {
      return { name: match[1].replace(/"/g, ''), email: match[2] }
    }
    return { name: from, email: from }
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      if (isToday(date)) {
        return format(date, 'h:mm a')
      }
      if (isYesterday(date)) {
        return 'Yesterday'
      }
      return format(date, 'MMM d')
    } catch {
      return ''
    }
  }

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    )
  }

  if (!connected) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-red-400" />
            Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-zinc-400 mb-3">
              Connect Google to see your emails
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `/workspace/${workspaceId}/settings`}
              className="border-zinc-700"
            >
              Connect Google
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-red-400" />
            Inbox
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {!compact && (
          <form onSubmit={handleSearch} className="mt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search emails..."
                className="pl-9 bg-zinc-800 border-zinc-700 h-8 text-sm"
              />
            </div>
          </form>
        )}
      </CardHeader>

      <CardContent>
        {emails.length === 0 ? (
          <div className="text-center py-4">
            <Inbox className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">No emails found</p>
          </div>
        ) : (
          <ScrollArea className={compact ? 'h-[200px]' : 'h-[350px]'}>
            <div className="space-y-1">
              {emails.map((email) => {
                const sender = parseFromEmail(email.from)

                return (
                  <a
                    key={email.id}
                    href={`https://mail.google.com/mail/u/0/#inbox/${email.threadId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg hover:bg-zinc-800 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="pt-1.5">
                        {email.isUnread ? (
                          <Circle className="w-2 h-2 fill-blue-500 text-blue-500" />
                        ) : (
                          <Circle className="w-2 h-2 text-zinc-700" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-sm truncate ${email.isUnread ? 'font-semibold text-white' : 'text-zinc-300'}`}>
                            {sender.name}
                          </p>
                          <span className="text-xs text-zinc-500 flex-shrink-0">
                            {formatDate(email.date)}
                          </span>
                        </div>

                        <p className={`text-sm truncate ${email.isUnread ? 'font-medium text-zinc-200' : 'text-zinc-400'}`}>
                          {email.subject || '(no subject)'}
                        </p>

                        {!compact && (
                          <p className="text-xs text-zinc-500 truncate mt-0.5">
                            {email.snippet}
                          </p>
                        )}
                      </div>

                      <ExternalLink className="w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </a>
                )
              })}
            </div>
          </ScrollArea>
        )}

        {!compact && (
          <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-center">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-amber-500 transition-colors"
            >
              Open Gmail in new tab
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

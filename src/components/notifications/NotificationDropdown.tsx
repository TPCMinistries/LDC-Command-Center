'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Clock, FileText, AlertTriangle, Check, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: 'deadline' | 'status_change' | 'reminder' | 'system'
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, unknown>
}

interface NotificationSummary {
  total: number
  unread: number
  critical: number
  high: number
}

interface NotificationDropdownProps {
  workspaceId: string
}

const URGENCY_COLORS = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/50',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50',
}

const URGENCY_DOT_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-zinc-500',
}

const TYPE_ICONS = {
  deadline: Clock,
  status_change: FileText,
  reminder: AlertTriangle,
  system: Bell,
}

export function NotificationDropdown({ workspaceId }: NotificationDropdownProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [summary, setSummary] = useState<NotificationSummary>({ total: 0, unread: 0, critical: 0, high: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const fetchNotifications = async () => {
    if (!workspaceId) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/notifications?workspaceId=${workspaceId}`)
      const data = await res.json()

      if (data.notifications) {
        setNotifications(data.notifications)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    }
    setIsLoading(false)
  }

  // Fetch on mount and when dropdown opens
  useEffect(() => {
    fetchNotifications()
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [workspaceId])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      router.push(notification.link)
      setIsOpen(false)
    }
  }

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return

    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          notificationIds: unreadIds,
        }),
      })

      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setSummary(prev => ({ ...prev, unread: 0 }))
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const badgeCount = summary.critical > 0 ? summary.critical : summary.unread

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        >
          <Bell className="h-5 w-5" />
          {badgeCount > 0 && (
            <span className={`absolute -top-1 -right-1 h-5 w-5 rounded-full text-xs font-medium flex items-center justify-center ${
              summary.critical > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
            }`}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-80 md:w-96 bg-zinc-900 border-zinc-700 p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-zinc-100">Notifications</h3>
            {summary.unread > 0 && (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                {summary.unread} new
              </Badge>
            )}
          </div>
          {summary.unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Bell className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No notifications</p>
              <p className="text-xs mt-1">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {notifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type]
                const daysUntil = notification.metadata?.daysUntil as number | undefined

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 hover:bg-zinc-800/50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-zinc-800/30' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Urgency indicator */}
                      <div className={`mt-1 w-2 h-2 rounded-full ${URGENCY_DOT_COLORS[notification.urgency]}`} />

                      {/* Icon */}
                      <div className={`p-2 rounded-lg ${URGENCY_COLORS[notification.urgency]}`}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            notification.urgency === 'critical' ? 'text-red-400' :
                            notification.urgency === 'high' ? 'text-orange-400' :
                            'text-zinc-200'
                          }`}>
                            {notification.title}
                          </span>
                          {daysUntil !== undefined && daysUntil <= 3 && (
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                daysUntil <= 1 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                              }`}
                            >
                              {daysUntil === 0 ? 'TODAY!' : daysUntil === 1 ? 'TOMORROW' : `${daysUntil}d`}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        {notification.metadata?.agency ? (
                          <p className="text-xs text-zinc-500 mt-1">
                            {String(notification.metadata.agency)}
                          </p>
                        ) : null}
                      </div>

                      {/* Link indicator */}
                      {notification.link && (
                        <ExternalLink className="h-3 w-3 text-zinc-600 mt-1" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {summary.total > 0 && (
          <div className="p-2 border-t border-zinc-800 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                router.push(`/workspace/${workspaceId}/rfp-radar`)
                setIsOpen(false)
              }}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              View all deadlines
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

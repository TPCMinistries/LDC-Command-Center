'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  FolderKanban,
  CheckSquare,
  FileBox,
  Lightbulb,
  Mic,
  FileText,
  Handshake,
  PenTool,
  Briefcase,
  Users,
  MessageSquare,
  Sparkles,
  Bot,
  Settings,
  Search,
  ArrowRight,
} from 'lucide-react'

interface CommandItem {
  id: string
  name: string
  href: string
  icon: typeof LayoutDashboard
  keywords: string[]
  group: string
}

const allCommands: CommandItem[] = [
  // Core
  { id: 'today', name: 'Today', href: '/today', icon: LayoutDashboard, keywords: ['dashboard', 'home', 'overview'], group: 'Core' },
  { id: 'calendar', name: 'Calendar', href: '/calendar', icon: CalendarDays, keywords: ['schedule', 'events', 'meetings'], group: 'Core' },
  { id: 'analytics', name: 'Analytics', href: '/analytics', icon: BarChart3, keywords: ['stats', 'metrics', 'reports'], group: 'Core' },
  // Work
  { id: 'projects', name: 'Projects', href: '/projects', icon: FolderKanban, keywords: ['work', 'kanban', 'boards'], group: 'Work' },
  { id: 'tasks', name: 'Tasks', href: '/tasks', icon: CheckSquare, keywords: ['todos', 'checklist', 'action items'], group: 'Work' },
  { id: 'documents', name: 'Documents', href: '/documents', icon: FileBox, keywords: ['files', 'docs', 'storage'], group: 'Work' },
  { id: 'ideas', name: 'Ideas', href: '/ideas', icon: Lightbulb, keywords: ['brainstorm', 'notes', 'concepts'], group: 'Work' },
  // Business
  { id: 'ministry', name: 'Ministry', href: '/ministry', icon: Mic, keywords: ['church', 'preaching', 'sermons'], group: 'Business' },
  { id: 'rfp', name: 'RFP Radar', href: '/rfp', icon: FileText, keywords: ['grants', 'opportunities', 'bids'], group: 'Business' },
  { id: 'partners', name: 'Partners', href: '/partners', icon: Handshake, keywords: ['vendors', 'collaborators'], group: 'Business' },
  { id: 'proposals', name: 'Proposals', href: '/proposals', icon: PenTool, keywords: ['bids', 'submissions'], group: 'Business' },
  { id: 'workforce', name: 'Workforce', href: '/workforce', icon: Briefcase, keywords: ['employees', 'team', 'hr'], group: 'Business' },
  // People
  { id: 'contacts', name: 'Contacts', href: '/contacts', icon: Users, keywords: ['people', 'crm', 'connections'], group: 'People' },
  { id: 'communications', name: 'Communications', href: '/communications', icon: MessageSquare, keywords: ['email', 'messages', 'inbox'], group: 'People' },
  // AI
  { id: 'chat', name: 'AI Chat', href: '/chat', icon: Sparkles, keywords: ['ai', 'assistant', 'claude', 'gpt'], group: 'AI' },
  { id: 'agents', name: 'Agents', href: '/agents', icon: Bot, keywords: ['automation', 'bots', 'workflows'], group: 'AI' },
  // System
  { id: 'settings', name: 'Settings', href: '/settings', icon: Settings, keywords: ['preferences', 'config', 'account'], group: 'System' },
]

interface CommandPaletteProps {
  workspaceId: string
}

export function CommandPalette({ workspaceId }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Listen for custom event to open
  useEffect(() => {
    const handleOpen = () => {
      setOpen(true)
      setSearch('')
      setSelectedIndex(0)
    }
    window.addEventListener('open-command-palette', handleOpen)
    return () => window.removeEventListener('open-command-palette', handleOpen)
  }, [])

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Filter commands based on search
  const filteredCommands = search
    ? allCommands.filter(cmd => {
        const searchLower = search.toLowerCase()
        return (
          cmd.name.toLowerCase().includes(searchLower) ||
          cmd.keywords.some(k => k.includes(searchLower))
        )
      })
    : allCommands

  // Group filtered commands
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = []
    acc[cmd.group].push(cmd)
    return acc
  }, {} as Record<string, CommandItem[]>)

  const flatCommands = Object.values(groupedCommands).flat()

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flatCommands[selectedIndex]) {
      e.preventDefault()
      navigateTo(flatCommands[selectedIndex].href)
    }
  }, [flatCommands, selectedIndex])

  const navigateTo = (href: string) => {
    setOpen(false)
    router.push(`/workspace/${workspaceId}${href}`)
  }

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0 bg-zinc-900 border-zinc-800 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="h-5 w-5 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search for pages, actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-500 outline-none text-sm"
          />
          <kbd className="px-2 py-1 rounded bg-zinc-800 text-xs text-zinc-500">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {Object.entries(groupedCommands).length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-sm">
              No results found for &quot;{search}&quot;
            </div>
          ) : (
            Object.entries(groupedCommands).map(([group, commands]) => (
              <div key={group} className="mb-2">
                <p className="px-3 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {group}
                </p>
                {commands.map((cmd) => {
                  const globalIndex = flatCommands.findIndex(c => c.id === cmd.id)
                  const isSelected = globalIndex === selectedIndex
                  const Icon = cmd.icon

                  return (
                    <button
                      key={cmd.id}
                      onClick={() => navigateTo(cmd.href)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                        isSelected
                          ? 'bg-amber-600/20 text-amber-500'
                          : 'text-zinc-400 hover:bg-zinc-800'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{cmd.name}</span>
                      {isSelected && (
                        <ArrowRight className="h-4 w-4 text-amber-500" />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800">↵</kbd>
            to select
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

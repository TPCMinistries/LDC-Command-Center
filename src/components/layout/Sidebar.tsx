'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Mic,
  FolderKanban,
  CheckSquare,
  FileText,
  Users,
  Bot,
  Settings,
  Building2,
  User,
  TrendingUp,
  Heart,
  Briefcase,
  MessageSquare,
  FileBox,
  Lightbulb,
  Plus,
  Church,
  Rocket,
  GraduationCap,
  Handshake,
  PenTool,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Search,
  Command,
  Sparkles,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AddWorkspaceModal } from '@/components/workspace/AddWorkspaceModal'

interface Workspace {
  id: string
  name: string
  slug: string
  type: 'personal' | 'organization'
  settings?: {
    modules?: string[]
  }
}

interface SidebarProps {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
}

interface NavItem {
  name: string
  href: string
  icon: typeof LayoutDashboard
  modules: string[]
  group: string
  badgeKey?: string
}

// Icons for each workspace
const workspaceIcons: Record<string, typeof Building2> = {
  personal: User,
  iha: Heart,
  deepfutures: TrendingUp,
  tpc: Church,
  uplift: GraduationCap,
  nonprofit: Heart,
  fund: TrendingUp,
  consulting: Briefcase,
  ministry: Church,
  agency: Building2,
  startup: Rocket,
  enterprise: Building2,
  organization: Building2,
}

// Short names for display
const workspaceShortNames: Record<string, string> = {
  'Personal': 'Personal',
  'Institute for Human Advancement': 'IHA',
  'DeepFutures Capital': 'DeepFutures',
  'TPC Ministries': 'TPC',
  'Uplift Communities': 'Uplift',
}

// Nav groups configuration
const navGroups = [
  { id: 'core', label: 'Core', defaultOpen: true },
  { id: 'work', label: 'Work', defaultOpen: true },
  { id: 'business', label: 'Business', defaultOpen: false },
  { id: 'people', label: 'People', defaultOpen: true },
  { id: 'ai', label: 'AI', defaultOpen: true },
  { id: 'system', label: 'System', defaultOpen: false },
]

// All possible nav items with groups
const allNavItems: NavItem[] = [
  // Core
  { name: 'Today', href: '/today', icon: LayoutDashboard, modules: ['all'], group: 'core' },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays, modules: ['all'], group: 'core' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, modules: ['all'], group: 'core' },
  // Work
  { name: 'Projects', href: '/projects', icon: FolderKanban, modules: ['projects', 'all'], group: 'work' },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, modules: ['tasks', 'all'], group: 'work', badgeKey: 'tasks' },
  { name: 'Documents', href: '/documents', icon: FileBox, modules: ['documents', 'all'], group: 'work' },
  { name: 'Ideas', href: '/ideas', icon: Lightbulb, modules: ['ideas', 'all'], group: 'work' },
  // Business
  { name: 'Ministry', href: '/ministry', icon: Mic, modules: ['ministry'], group: 'business' },
  { name: 'RFP Radar', href: '/rfp', icon: FileText, modules: ['rfp'], group: 'business' },
  { name: 'Partners', href: '/partners', icon: Handshake, modules: ['rfp', 'partners'], group: 'business' },
  { name: 'Proposals', href: '/proposals', icon: PenTool, modules: ['rfp', 'proposals'], group: 'business' },
  { name: 'Workforce', href: '/workforce', icon: Briefcase, modules: ['workforce'], group: 'business' },
  // People
  { name: 'Contacts', href: '/contacts', icon: Users, modules: ['contacts', 'all'], group: 'people' },
  { name: 'Communications', href: '/communications', icon: MessageSquare, modules: ['communications', 'all'], group: 'people', badgeKey: 'messages' },
  // AI
  { name: 'AI Chat', href: '/chat', icon: Sparkles, modules: ['all'], group: 'ai' },
  { name: 'Agents', href: '/agents', icon: Bot, modules: ['agents', 'all'], group: 'ai' },
  // System
  { name: 'Settings', href: '/settings', icon: Settings, modules: ['all'], group: 'system' },
]

// Get nav items for a workspace based on its modules
function getNavItemsForWorkspace(workspace: Workspace | null) {
  if (!workspace) return allNavItems.filter(item => item.modules.includes('all'))

  const workspaceModules = workspace.settings?.modules || []

  // Personal workspace gets everything
  if (workspace.type === 'personal') {
    return allNavItems
  }

  // Filter based on workspace modules
  return allNavItems.filter(item => {
    if (item.modules.includes('all')) return true
    return item.modules.some(m => workspaceModules.includes(m))
  })
}

// Group nav items by their group
function groupNavItems(items: NavItem[]) {
  const grouped: Record<string, NavItem[]> = {}
  items.forEach(item => {
    if (!grouped[item.group]) {
      grouped[item.group] = []
    }
    grouped[item.group].push(item)
  })
  return grouped
}

export function Sidebar({ workspaces, currentWorkspace: initialWorkspace }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showAddWorkspace, setShowAddWorkspace] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    // Initialize from localStorage or defaults
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed-groups')
      if (saved) {
        return new Set(JSON.parse(saved))
      }
    }
    // Default: collapse groups that have defaultOpen: false
    return new Set(navGroups.filter(g => !g.defaultOpen).map(g => g.id))
  })
  const [badges, setBadges] = useState<Record<string, number>>({})

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed-groups', JSON.stringify([...collapsedGroups]))
  }, [collapsedGroups])

  // Fetch badge counts
  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch('/api/sidebar/badges')
        if (res.ok) {
          const data = await res.json()
          setBadges(data)
        }
      } catch {
        // Silently fail - badges are not critical
      }
    }
    fetchBadges()
    // Refresh badges every 30 seconds
    const interval = setInterval(fetchBadges, 30000)
    return () => clearInterval(interval)
  }, [])

  // Extract workspace ID from URL path
  const workspaceMatch = pathname.match(/\/workspace\/([^\/]+)/)
  const currentWorkspaceId = workspaceMatch ? workspaceMatch[1] : initialWorkspace?.id

  // Find the actual current workspace
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || initialWorkspace
  const workspaceId = currentWorkspace?.id || ''

  const navItems = getNavItemsForWorkspace(currentWorkspace)
  const groupedItems = groupNavItems(navItems)

  // Get icon for workspace
  const getWorkspaceIcon = (ws: Workspace) => {
    const orgType = (ws as unknown as { branding?: { organization_type?: string } }).branding?.organization_type
    if (orgType && workspaceIcons[orgType]) {
      return workspaceIcons[orgType]
    }
    return workspaceIcons[ws.slug] || workspaceIcons[ws.type] || Building2
  }

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  const handleWorkspaceCreated = (newWorkspaceId: string) => {
    router.push(`/workspace/${newWorkspaceId}/today`)
    router.refresh()
  }

  // Keyboard shortcut for Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // Dispatch custom event that CommandPalette listens to
        window.dispatchEvent(new CustomEvent('open-command-palette'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-amber-500">LDC Command</h1>
      </div>

      {/* Quick Search Trigger */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
        className="mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors text-sm"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Quick search...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-700/50 text-xs text-zinc-400">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      {/* Workspaces */}
      <div className="p-2 border-b border-zinc-800">
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Workspaces
          </p>
          <button
            onClick={() => setShowAddWorkspace(true)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-amber-500 transition-colors"
            title="Add Workspace"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1 space-y-0.5">
          {workspaces.map((ws) => {
            const isActive = ws.id === currentWorkspace?.id
            const Icon = getWorkspaceIcon(ws)
            const shortName = workspaceShortNames[ws.name] || ws.name

            return (
              <Link
                key={ws.id}
                href={`/workspace/${ws.id}/today`}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-amber-600/20 text-amber-500'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{shortName}</span>
                {ws.type === 'personal' && (
                  <span className="ml-auto text-xs text-zinc-600">•</span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Navigation with Groups */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="p-2 pb-4">
          {navGroups.map((group) => {
            const items = groupedItems[group.id]
            if (!items || items.length === 0) return null

            const isCollapsed = collapsedGroups.has(group.id)

            return (
              <div key={group.id} className="mb-2">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider hover:text-zinc-400 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {group.label}
                </button>

                {/* Group Items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 mt-1">
                    {items.map((item) => {
                      const href = `/workspace/${workspaceId}${item.href}`
                      const isActive = pathname === href || pathname.startsWith(`${href}/`)
                      const Icon = item.icon
                      const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined

                      return (
                        <Link
                          key={item.name}
                          href={href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-zinc-800 text-zinc-100'
                              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="flex-1">{item.name}</span>
                          {badgeCount !== undefined && badgeCount > 0 && (
                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-amber-600/20 text-amber-500 font-medium">
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Soul Framework indicator */}
      <div className="p-3 border-t border-zinc-800">
        <div className="px-3 py-2 rounded-lg bg-zinc-800/50">
          <p className="text-xs text-zinc-500">Today&apos;s Theme</p>
          <p className="text-sm text-amber-500 font-medium">Trust & Guidance</p>
          <p className="text-xs text-zinc-600 mt-1">Proverbs 3:5-6</p>
        </div>
      </div>

      {/* Add Workspace Modal */}
      <AddWorkspaceModal
        isOpen={showAddWorkspace}
        onClose={() => setShowAddWorkspace(false)}
        onSuccess={handleWorkspaceCreated}
      />
    </aside>
  )
}

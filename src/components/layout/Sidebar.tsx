'use client'

import { useState } from 'react'
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

// Icons for each workspace (by slug or type)
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

// All possible nav items
const allNavItems = [
  { name: 'Today', href: '/today', icon: LayoutDashboard, modules: ['all'] },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays, modules: ['all'] },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, modules: ['all'] },
  { name: 'Ministry', href: '/ministry', icon: Mic, modules: ['ministry'] },
  { name: 'Projects', href: '/projects', icon: FolderKanban, modules: ['projects', 'all'] },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, modules: ['tasks', 'all'] },
  { name: 'RFP Radar', href: '/rfp', icon: FileText, modules: ['rfp'] },
  { name: 'Partners', href: '/partners', icon: Handshake, modules: ['rfp', 'partners'] },
  { name: 'Proposals', href: '/proposals', icon: PenTool, modules: ['rfp', 'proposals'] },
  { name: 'Workforce', href: '/workforce', icon: Briefcase, modules: ['workforce'] },
  { name: 'Contacts', href: '/contacts', icon: Users, modules: ['contacts', 'all'] },
  { name: 'Ideas', href: '/ideas', icon: Lightbulb, modules: ['ideas', 'all'] },
  { name: 'Documents', href: '/documents', icon: FileBox, modules: ['documents', 'all'] },
  { name: 'Communications', href: '/communications', icon: MessageSquare, modules: ['communications', 'all'] },
  { name: 'AI Chat', href: '/chat', icon: MessageSquare, modules: ['all'] },
  { name: 'Agents', href: '/agents', icon: Bot, modules: ['agents', 'all'] },
  { name: 'Settings', href: '/settings', icon: Settings, modules: ['all'] },
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

export function Sidebar({ workspaces, currentWorkspace: initialWorkspace }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [showAddWorkspace, setShowAddWorkspace] = useState(false)

  // Extract workspace ID from URL path (more reliable than props for client-side nav)
  const workspaceMatch = pathname.match(/\/workspace\/([^\/]+)/)
  const currentWorkspaceId = workspaceMatch ? workspaceMatch[1] : initialWorkspace?.id

  // Find the actual current workspace
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || initialWorkspace
  const workspaceId = currentWorkspace?.id || ''

  const navItems = getNavItemsForWorkspace(currentWorkspace)

  // Get icon for workspace based on branding or type
  const getWorkspaceIcon = (ws: Workspace) => {
    // Check branding for organization type
    const orgType = (ws as unknown as { branding?: { organization_type?: string } }).branding?.organization_type
    if (orgType && workspaceIcons[orgType]) {
      return workspaceIcons[orgType]
    }
    // Fall back to slug or type
    return workspaceIcons[ws.slug] || workspaceIcons[ws.type] || Building2
  }

  const handleWorkspaceCreated = (newWorkspaceId: string) => {
    // Navigate to the new workspace
    router.push(`/workspace/${newWorkspaceId}/today`)
    // Refresh to get updated workspace list
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-amber-500">LDC Command</h1>
      </div>

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

      {/* Current Workspace Label */}
      {currentWorkspace && (
        <div className="px-4 py-2 bg-zinc-800/50">
          <p className="text-xs text-zinc-500">
            {currentWorkspace.type === 'personal' ? 'Personal Space' : 'Organization'}
          </p>
          <p className="text-sm font-medium text-zinc-200 truncate">
            {currentWorkspace.name}
          </p>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="p-2 space-y-0.5 pb-4">
          {navItems.map((item) => {
            const href = `/workspace/${workspaceId}${item.href}`
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            const Icon = item.icon

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
                {item.name}
              </Link>
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

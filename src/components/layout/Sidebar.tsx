'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  ChevronDown,
  Building2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface Workspace {
  id: string
  name: string
  slug: string
  type: 'personal' | 'organization'
}

interface SidebarProps {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
}

const navItems = [
  { name: 'Today', href: '/today', icon: LayoutDashboard },
  { name: 'Ministry', href: '/ministry', icon: Mic },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'RFP Radar', href: '/rfp', icon: FileText },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar({ workspaces, currentWorkspace }: SidebarProps) {
  const pathname = usePathname()
  const workspaceId = currentWorkspace?.id || ''

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo & Workspace Switcher */}
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-amber-500 mb-4">LDC Command</h1>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700"
            >
              <span className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 text-zinc-400" />
                <span className="truncate">
                  {currentWorkspace?.name || 'Select Workspace'}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-zinc-800 border-zinc-700">
            {workspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} asChild>
                <Link
                  href={`/workspace/${ws.id}/today`}
                  className={cn(
                    'cursor-pointer',
                    ws.id === currentWorkspace?.id && 'bg-zinc-700'
                  )}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  {ws.name}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
                  ? 'bg-amber-600/20 text-amber-500'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Soul Framework indicator */}
      <div className="p-4 border-t border-zinc-800">
        <div className="px-3 py-2 rounded-lg bg-zinc-800/50 text-center">
          <p className="text-xs text-zinc-500">Today&apos;s Theme</p>
          <p className="text-sm text-amber-500 font-medium">Trust & Guidance</p>
        </div>
      </div>
    </aside>
  )
}

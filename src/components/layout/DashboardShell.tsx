'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { CommandPalette } from './CommandPalette'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { HelpWidget } from '@/components/chat/HelpWidget'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'

interface Workspace {
  id: string
  name: string
  slug: string
  type: 'personal' | 'organization'
  settings?: {
    modules?: string[]
  }
}

interface DashboardShellProps {
  children: React.ReactNode
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  user: {
    id: string
    email?: string
    full_name?: string
    avatar_url?: string
  } | null
}

export function DashboardShell({
  children,
  workspaces,
  currentWorkspace,
  user,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar workspaces={workspaces} currentWorkspace={currentWorkspace} />
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-zinc-900 border-zinc-800">
          <Sidebar
            workspaces={workspaces}
            currentWorkspace={currentWorkspace}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="md:pl-64">
        <Header
          user={user}
          workspaceId={currentWorkspace?.id}
          onMobileMenuToggle={() => setMobileMenuOpen(true)}
        />
        <main className="p-4 md:p-6">{children}</main>
      </div>

      {/* Help Widget */}
      {currentWorkspace && (
        <HelpWidget workspaceId={currentWorkspace.id} />
      )}

      {/* Command Palette */}
      {currentWorkspace && (
        <CommandPalette workspaceId={currentWorkspace.id} />
      )}

      {/* PWA Install Prompt */}
      <InstallPrompt />
    </div>
  )
}

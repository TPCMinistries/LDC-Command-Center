'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Zap,
  FileText,
  Users,
  FolderKanban,
  CheckSquare,
  Search,
  Mic,
  MessageSquare,
  Plus,
} from 'lucide-react'

interface QuickActionsProps {
  workspaceId: string
}

export function QuickActions({ workspaceId }: QuickActionsProps) {
  const actions = [
    {
      label: 'New Proposal',
      icon: FileText,
      href: `/workspace/${workspaceId}/proposals`,
      color: 'text-amber-500 hover:bg-amber-500/10',
    },
    {
      label: 'Add Contact',
      icon: Users,
      href: `/workspace/${workspaceId}/contacts`,
      color: 'text-blue-500 hover:bg-blue-500/10',
    },
    {
      label: 'Create Task',
      icon: CheckSquare,
      href: `/workspace/${workspaceId}/tasks`,
      color: 'text-green-500 hover:bg-green-500/10',
    },
    {
      label: 'Search RFPs',
      icon: Search,
      href: `/workspace/${workspaceId}/rfp`,
      color: 'text-cyan-500 hover:bg-cyan-500/10',
    },
    {
      label: 'Record Note',
      icon: Mic,
      href: `/workspace/${workspaceId}/ministry`,
      color: 'text-rose-500 hover:bg-rose-500/10',
    },
    {
      label: 'Ask Chief of Staff',
      icon: MessageSquare,
      href: `/workspace/${workspaceId}/agents`,
      color: 'text-purple-500 hover:bg-purple-500/10',
    },
  ]

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Zap className="h-5 w-5 text-yellow-500" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {actions.map((action) => (
            <Link key={action.label} href={action.href}>
              <Button
                variant="outline"
                className={`w-full justify-start border-zinc-800 ${action.color}`}
              >
                <action.icon className="h-4 w-4 mr-2" />
                {action.label}
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

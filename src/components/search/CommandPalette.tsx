'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  FileText,
  Radar,
  Handshake,
  Loader2,
  ArrowRight,
  Calendar,
  BarChart3,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface SearchResult {
  id: string
  title?: string
  name?: string
  type: 'proposal' | 'rfp' | 'partner'
  status?: string
  agency?: string
  alignment_score?: number
  response_deadline?: string
  organization_type?: string
  href: string
}

interface CommandPaletteProps {
  workspaceId: string
}

const TYPE_ICONS = {
  proposal: FileText,
  rfp: Radar,
  partner: Handshake,
}

const TYPE_COLORS = {
  proposal: 'bg-blue-500/20 text-blue-400',
  rfp: 'bg-amber-500/20 text-amber-400',
  partner: 'bg-green-500/20 text-green-400',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/20 text-zinc-400',
  'in-progress': 'bg-blue-500/20 text-blue-400',
  review: 'bg-yellow-500/20 text-yellow-400',
  submitted: 'bg-purple-500/20 text-purple-400',
  won: 'bg-green-500/20 text-green-400',
  lost: 'bg-red-500/20 text-red-400',
  new: 'bg-blue-500/20 text-blue-400',
  reviewing: 'bg-yellow-500/20 text-yellow-400',
  pursuing: 'bg-green-500/20 text-green-400',
  active: 'bg-green-500/20 text-green-400',
  inactive: 'bg-zinc-500/20 text-zinc-400',
}

export function CommandPalette({ workspaceId }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [counts, setCounts] = useState({ proposals: 0, rfps: 0, partners: 0, total: 0 })

  // Toggle with Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Search when query changes
  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([])
        setCounts({ proposals: 0, rfps: 0, partners: 0, total: 0 })
        return
      }

      setIsLoading(true)
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&workspaceId=${workspaceId}&type=all`
        )
        const data = await res.json()
        setResults(data.results || [])
        setCounts(data.counts || { proposals: 0, rfps: 0, partners: 0, total: 0 })
        setSelectedIndex(0)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const debounce = setTimeout(search, 300)
    return () => clearTimeout(debounce)
  }, [query, workspaceId])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : i))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i > 0 ? i - 1 : i))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        navigateToResult(results[selectedIndex])
      }
    },
    [results, selectedIndex]
  )

  const navigateToResult = (result: SearchResult) => {
    const basePath = `/workspace/${workspaceId}`
    router.push(`${basePath}${result.href}`)
    setOpen(false)
    setQuery('')
  }

  const getDisplayName = (result: SearchResult) => {
    return result.title || result.name || 'Untitled'
  }

  const getSubtitle = (result: SearchResult) => {
    if (result.type === 'rfp' && result.agency) {
      return result.agency
    }
    if (result.type === 'partner' && result.organization_type) {
      return result.organization_type
    }
    return null
  }

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700/50 hover:text-zinc-300 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search everything...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-zinc-700 rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command palette dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-2xl bg-zinc-900 border-zinc-700 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700">
            <Search className="h-5 w-5 text-zinc-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search proposals, RFPs, partners..."
              className="flex-1 border-0 bg-transparent text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0 text-base"
              autoFocus
            />
            {isLoading && <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />}
          </div>

          {/* Results */}
          <ScrollArea className="max-h-[60vh]">
            {query.trim() && !isLoading && results.length === 0 && (
              <div className="py-12 text-center">
                <Search className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No results found for &ldquo;{query}&rdquo;</p>
                <p className="text-zinc-500 text-sm mt-1">Try searching for something else</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="p-2">
                {/* Result counts */}
                <div className="flex items-center gap-2 px-2 py-1 mb-2">
                  <span className="text-xs text-zinc-500">
                    {counts.total} results
                  </span>
                  {counts.proposals > 0 && (
                    <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                      {counts.proposals} proposals
                    </Badge>
                  )}
                  {counts.rfps > 0 && (
                    <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                      {counts.rfps} RFPs
                    </Badge>
                  )}
                  {counts.partners > 0 && (
                    <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                      {counts.partners} partners
                    </Badge>
                  )}
                </div>

                {/* Results list */}
                <div className="space-y-1">
                  {results.map((result, index) => {
                    const Icon = TYPE_ICONS[result.type]
                    const isSelected = index === selectedIndex

                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => navigateToResult(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-amber-600/20 border border-amber-500/50'
                            : 'hover:bg-zinc-800 border border-transparent'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${TYPE_COLORS[result.type]}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-100 font-medium truncate">
                              {getDisplayName(result)}
                            </span>
                            {result.status && (
                              <Badge className={`text-xs ${STATUS_COLORS[result.status] || 'bg-zinc-500/20 text-zinc-400'}`}>
                                {result.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                            <span className="capitalize">{result.type}</span>
                            {getSubtitle(result) && (
                              <>
                                <span>•</span>
                                <span>{getSubtitle(result)}</span>
                              </>
                            )}
                            {result.alignment_score && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <BarChart3 className="h-3 w-3" />
                                  {result.alignment_score}% match
                                </span>
                              </>
                            )}
                            {result.response_deadline && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-amber-400">
                                  <Clock className="h-3 w-3" />
                                  Due {formatDistanceToNow(new Date(result.response_deadline), { addSuffix: true })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <ArrowRight className={`h-4 w-4 ${isSelected ? 'text-amber-400' : 'text-zinc-600'}`} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick actions when no query */}
            {!query.trim() && (
              <div className="p-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Quick Actions</p>
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      router.push(`/workspace/${workspaceId}/proposals`)
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-zinc-800 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="text-zinc-300">View all proposals</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push(`/workspace/${workspaceId}/rfp`)
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-zinc-800 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                      <Radar className="h-4 w-4" />
                    </div>
                    <span className="text-zinc-300">View RFP Radar</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push(`/workspace/${workspaceId}/analytics`)
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-zinc-800 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <span className="text-zinc-300">View Analytics</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push(`/workspace/${workspaceId}/partners`)
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-zinc-800 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
                      <Handshake className="h-4 w-4" />
                    </div>
                    <span className="text-zinc-300">View Partners</span>
                  </button>
                </div>
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-700 text-xs text-zinc-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↵</kbd>
                Select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">esc</kbd>
              Close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

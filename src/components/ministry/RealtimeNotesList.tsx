'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Clock, ChevronRight, Mic, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Note {
  id: string
  title: string | null
  summary: string | null
  status: string
  category: string | null
  themes: string[] | null
  audio_duration_seconds: number | null
  created_at: string
}

interface RealtimeNotesListProps {
  workspaceId: string
  initialNotes: Note[]
}

const statusColors: Record<string, string> = {
  pending: 'bg-zinc-600',
  transcribing: 'bg-blue-600',
  processing: 'bg-amber-600',
  complete: 'bg-green-600',
  failed: 'bg-red-600',
}

const categoryColors: Record<string, string> = {
  prophetic: 'border-purple-600 text-purple-400',
  sermon_seed: 'border-amber-600 text-amber-400',
  reflection: 'border-blue-600 text-blue-400',
  prayer: 'border-rose-600 text-rose-400',
  general: 'border-zinc-600 text-zinc-400',
}

const categoryLabels: Record<string, string> = {
  prophetic: 'Prophetic',
  sermon_seed: 'Sermon Seed',
  reflection: 'Reflection',
  prayer: 'Prayer',
  general: 'General',
}

export function RealtimeNotesList({ workspaceId, initialNotes }: RealtimeNotesListProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to changes on prophetic_notes table for this workspace
    const channel = supabase
      .channel(`notes-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prophetic_notes',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNote = payload.new as Note
            setNotes((prev) => [newNote, ...prev])
            toast.info('New note added', {
              description: 'A new recording is being processed.',
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedNote = payload.new as Note
            setNotes((prev) =>
              prev.map((note) =>
                note.id === updatedNote.id ? updatedNote : note
              )
            )

            // Show toast when status changes to complete
            if (updatedNote.status === 'complete') {
              toast.success('Processing complete', {
                description: updatedNote.title || 'Your note has been processed.',
              })
            } else if (updatedNote.status === 'failed') {
              toast.error('Processing failed', {
                description: 'There was an error processing your note.',
              })
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id
            setNotes((prev) => prev.filter((note) => note.id !== deletedId))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, supabase])

  if (notes.length === 0) {
    return (
      <div className="text-center py-12">
        <Mic className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
        <h3 className="text-lg font-medium text-zinc-300 mb-2">
          No prophetic notes yet
        </h3>
        <p className="text-zinc-500 max-w-sm mx-auto">
          Record your first audio note to capture prophetic words, sermon seeds, and reflections.
          The AI will automatically extract themes and scriptures.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <Link
          key={note.id}
          href={`/workspace/${workspaceId}/ministry/${note.id}`}
          className="block p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-medium text-zinc-100 truncate">
                  {note.title || 'Untitled Note'}
                </h3>
                <Badge className={`${statusColors[note.status] || 'bg-zinc-600'} text-xs`}>
                  {['pending', 'transcribing', 'processing'].includes(note.status) && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  {note.status}
                </Badge>
              </div>
              {note.summary && (
                <p className="text-zinc-400 text-sm line-clamp-2 mb-2">{note.summary}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                {note.category && (
                  <Badge variant="outline" className={`${categoryColors[note.category]} text-xs`}>
                    {categoryLabels[note.category] || note.category}
                  </Badge>
                )}
                {note.audio_duration_seconds && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.floor(note.audio_duration_seconds / 60)}:{String(note.audio_duration_seconds % 60).padStart(2, '0')}
                  </span>
                )}
                <span>
                  {new Date(note.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {(note.themes || []).length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(note.themes || []).slice(0, 4).map((theme, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                      {theme}
                    </span>
                  ))}
                  {(note.themes || []).length > 4 && (
                    <span className="text-xs text-zinc-500">
                      +{(note.themes || []).length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-600 flex-shrink-0 ml-2" />
          </div>
        </Link>
      ))}
    </div>
  )
}

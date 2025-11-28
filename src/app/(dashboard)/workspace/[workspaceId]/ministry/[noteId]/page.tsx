import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Clock,
  Calendar,
  BookOpen,
  Sparkles,
  Quote,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { ContentGenerator } from '@/components/content/ContentGenerator'

interface NoteDetailPageProps {
  params: Promise<{ workspaceId: string; noteId: string }>
}

export default async function NoteDetailPage({ params }: NoteDetailPageProps) {
  const { workspaceId, noteId } = await params
  const supabase = await createClient()

  // Fetch the note
  const { data: note, error } = await supabase
    .from('prophetic_notes')
    .select('*')
    .eq('id', noteId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !note) {
    notFound()
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-zinc-600',
    transcribing: 'bg-blue-600',
    processing: 'bg-amber-600',
    complete: 'bg-green-600',
    failed: 'bg-red-600',
  }

  const categoryColors: Record<string, string> = {
    prophetic: 'border-purple-600 text-purple-400 bg-purple-600/10',
    sermon_seed: 'border-amber-600 text-amber-400 bg-amber-600/10',
    reflection: 'border-blue-600 text-blue-400 bg-blue-600/10',
    prayer: 'border-rose-600 text-rose-400 bg-rose-600/10',
    general: 'border-zinc-600 text-zinc-400 bg-zinc-600/10',
  }

  const categoryLabels: Record<string, string> = {
    prophetic: 'Prophetic Word',
    sermon_seed: 'Sermon Seed',
    reflection: 'Reflection',
    prayer: 'Prayer',
    general: 'General Note',
  }

  const themes = (note.themes as string[]) || []
  const scriptures = (note.scriptures as string[]) || []
  const keyInsights = (note.key_insights as string[]) || []

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back Button */}
      <Link
        href={`/workspace/${workspaceId}/ministry`}
        className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Ministry
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-zinc-100">
              {note.title || 'Untitled Note'}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-zinc-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(note.created_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              {note.audio_duration_seconds && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {Math.floor(note.audio_duration_seconds / 60)}:{String(note.audio_duration_seconds % 60).padStart(2, '0')}
                </span>
              )}
            </div>
          </div>
          <Badge className={`${statusColors[note.status] || 'bg-zinc-600'}`}>
            {note.status}
          </Badge>
        </div>

        {note.category && (
          <Badge
            variant="outline"
            className={`${categoryColors[note.category]} text-sm px-3 py-1`}
          >
            {categoryLabels[note.category] || note.category}
          </Badge>
        )}
      </div>

      {/* Audio Player */}
      {note.audio_url && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <AudioPlayer src={note.audio_url} />
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {note.summary && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-100 text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300 leading-relaxed">{note.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Insights */}
      {keyInsights.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-100 text-lg flex items-center gap-2">
              <Quote className="h-5 w-5 text-purple-500" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {keyInsights.map((insight, i) => (
                <li key={i} className="flex gap-3 text-zinc-300">
                  <span className="text-purple-500 mt-1">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Themes & Scriptures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Themes */}
        {themes.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-100 text-base">Themes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {themes.map((theme, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-zinc-800 text-zinc-300 text-sm"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scriptures */}
        {scriptures.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                Scriptures
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {scriptures.map((scripture, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-amber-600/20 text-amber-400 text-sm border border-amber-600/30"
                  >
                    {scripture}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Full Transcript */}
      {note.transcript && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-zinc-100 text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Full Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-zinc max-w-none">
              <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {note.transcript}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Generation */}
      {note.status === 'complete' && (
        <ContentGenerator
          sourceType="prophetic_note"
          sourceId={noteId}
          workspaceId={workspaceId}
          sourceTitle={note.title}
          showSermon={true}
        />
      )}

      {/* Error State */}
      {note.status === 'failed' && note.error_message && (
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="pt-6">
            <p className="text-red-400">
              <strong>Error:</strong> {note.error_message}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

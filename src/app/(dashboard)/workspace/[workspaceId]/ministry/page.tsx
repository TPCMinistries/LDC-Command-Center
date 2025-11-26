import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mic, Upload, Clock, BookOpen, Sparkles } from 'lucide-react'

interface MinistryPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function MinistryPage({ params }: MinistryPageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  // Fetch prophetic notes
  const { data: notes } = await supabase
    .from('prophetic_notes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch sermons
  const { data: sermons } = await supabase
    .from('sermons')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10)

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Ministry</h1>
          <p className="text-zinc-400 mt-1">
            Audio notes, prophetic words, and sermon content
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <Upload className="h-4 w-4 mr-2" />
            Upload Audio
          </Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white">
            <Mic className="h-4 w-4 mr-2" />
            Record Note
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-600/20">
                <Mic className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{notes?.length || 0}</p>
                <p className="text-sm text-zinc-500">Prophetic Notes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-600/20">
                <BookOpen className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{sermons?.length || 0}</p>
                <p className="text-sm text-zinc-500">Sermons</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-600/20">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">
                  {notes?.filter((n) => n.status === 'processing').length || 0}
                </p>
                <p className="text-sm text-zinc-500">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-600/20">
                <Sparkles className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">
                  {notes?.reduce((acc, n) => acc + ((n.themes as string[])?.length || 0), 0) || 0}
                </p>
                <p className="text-sm text-zinc-500">Themes Found</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes List */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Recent Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {notes && notes.length > 0 ? (
            <div className="space-y-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-medium text-zinc-100">
                          {note.title || 'Untitled Note'}
                        </h3>
                        <Badge className={statusColors[note.status] || 'bg-zinc-600'}>
                          {note.status}
                        </Badge>
                        {note.category && (
                          <Badge variant="outline" className={categoryColors[note.category]}>
                            {note.category.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      {note.summary && (
                        <p className="text-zinc-400 text-sm mb-3">{note.summary}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
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
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {((note.themes as string[]) || []).length > 0 && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-700">
                      {((note.themes as string[]) || []).map((theme, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {((note.scriptures as string[]) || []).length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {((note.scriptures as string[]) || []).map((scripture, i) => (
                        <span key={i} className="text-xs text-amber-500">
                          {scripture}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Mic className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
              <h3 className="text-lg font-medium text-zinc-300 mb-2">
                No prophetic notes yet
              </h3>
              <p className="text-zinc-500 mb-4">
                Record your first audio note to capture prophetic words, sermon seeds, and reflections.
              </p>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                <Mic className="h-4 w-4 mr-2" />
                Record Your First Note
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

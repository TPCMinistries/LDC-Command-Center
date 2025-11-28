import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, BookOpen, Sparkles, Clock } from 'lucide-react'
import { AudioUpload } from '@/components/audio/AudioUpload'
import { RealtimeNotesList } from '@/components/ministry/RealtimeNotesList'

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

  // Fetch sermons count
  const { count: sermonsCount } = await supabase
    .from('sermons')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  // Calculate stats
  const totalNotes = notes?.length || 0
  const processingNotes = notes?.filter(n => ['pending', 'transcribing', 'processing'].includes(n.status)).length || 0
  const totalThemes = notes?.reduce((acc, n) => acc + ((n.themes as string[])?.length || 0), 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Ministry</h1>
        <p className="text-zinc-400 mt-1">
          Audio notes, prophetic words, and sermon content
        </p>
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
                <p className="text-2xl font-bold text-zinc-100">{totalNotes}</p>
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
                <p className="text-2xl font-bold text-zinc-100">{sermonsCount || 0}</p>
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
                <p className="text-2xl font-bold text-zinc-100">{processingNotes}</p>
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
                <p className="text-2xl font-bold text-zinc-100">{totalThemes}</p>
                <p className="text-sm text-zinc-500">Themes Found</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audio Upload */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-3">Record or Upload</h2>
        <AudioUpload workspaceId={workspaceId} />
      </div>

      {/* Notes List with Real-time Updates */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Recent Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <RealtimeNotesList
            workspaceId={workspaceId}
            initialNotes={(notes || []).map(note => ({
              id: note.id,
              title: note.title,
              summary: note.summary,
              status: note.status,
              category: note.category,
              themes: note.themes as string[] | null,
              audio_duration_seconds: note.audio_duration_seconds,
              created_at: note.created_at,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}

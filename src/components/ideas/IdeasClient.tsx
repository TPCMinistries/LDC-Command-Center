'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Lightbulb,
  Mic,
  MicOff,
  Send,
  Loader2,
  Sparkles,
  Star,
  Archive,
  Clock,
  Tag,
  ChevronRight,
  FileText,
  Trash2,
  MoreVertical,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Idea {
  id: string
  workspace_id: string
  user_id: string
  audio_url?: string
  transcript?: string
  text_content?: string
  title?: string
  summary?: string
  category?: string
  tags?: string[]
  key_points?: string[]
  action_items?: string[]
  content_types_suggested?: string[]
  status: string
  is_favorite: boolean
  is_archived: boolean
  created_at: string
}

interface IdeasClientProps {
  workspaceId: string
  workspaceName: string
  initialIdeas: Idea[]
}

const CATEGORY_COLORS: Record<string, string> = {
  content: 'bg-blue-500/20 text-blue-400',
  product: 'bg-purple-500/20 text-purple-400',
  strategy: 'bg-green-500/20 text-green-400',
  process: 'bg-yellow-500/20 text-yellow-400',
  partnership: 'bg-pink-500/20 text-pink-400',
  innovation: 'bg-orange-500/20 text-orange-400',
  marketing: 'bg-cyan-500/20 text-cyan-400',
  other: 'bg-zinc-500/20 text-zinc-400',
}

export function IdeasClient({ workspaceId, workspaceName, initialIdeas }: IdeasClientProps) {
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas)
  const [textInput, setTextInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [filter, setFilter] = useState<'all' | 'favorites'>('all')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Submit text idea
  const submitTextIdea = async () => {
    if (!textInput.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      // Create the idea
      const createRes = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          textContent: textInput,
        }),
      })

      const createData = await createRes.json()
      if (!createData.idea) throw new Error('Failed to create idea')

      // Add to list immediately
      setIdeas(prev => [createData.idea, ...prev])
      setTextInput('')

      // Analyze the idea
      const analyzeRes = await fetch('/api/agents/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId: createData.idea.id,
          workspaceId,
          action: 'analyze',
        }),
      })

      const analyzeData = await analyzeRes.json()
      if (analyzeData.idea) {
        setIdeas(prev => prev.map(i => i.id === analyzeData.idea.id ? analyzeData.idea : i))
      }
    } catch (error) {
      console.error('Failed to submit idea:', error)
    }
    setIsSubmitting(false)
  }

  // Toggle recording
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data)
        }

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          stream.getTracks().forEach(track => track.stop())

          // For now, we'll show a message that voice recording needs transcription
          // In a full implementation, you'd upload to storage and transcribe
          console.log('Audio recorded:', audioBlob.size, 'bytes')
          alert('Voice recording captured. Transcription integration coming soon.')
        }

        mediaRecorder.start()
        setIsRecording(true)
      } catch (error) {
        console.error('Failed to start recording:', error)
        alert('Could not access microphone. Please check permissions.')
      }
    }
  }

  // Toggle favorite
  const toggleFavorite = async (idea: Idea) => {
    try {
      const res = await fetch('/api/ideas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId: idea.id,
          workspaceId,
          is_favorite: !idea.is_favorite,
        }),
      })

      const data = await res.json()
      if (data.idea) {
        setIdeas(prev => prev.map(i => i.id === idea.id ? data.idea : i))
        if (selectedIdea?.id === idea.id) {
          setSelectedIdea(data.idea)
        }
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }

  // Archive idea
  const archiveIdea = async (idea: Idea) => {
    try {
      const res = await fetch('/api/ideas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaId: idea.id,
          workspaceId,
          is_archived: true,
        }),
      })

      if (res.ok) {
        setIdeas(prev => prev.filter(i => i.id !== idea.id))
        if (selectedIdea?.id === idea.id) {
          setSelectedIdea(null)
        }
      }
    } catch (error) {
      console.error('Failed to archive idea:', error)
    }
  }

  // Delete idea
  const deleteIdea = async (idea: Idea) => {
    if (!confirm('Are you sure you want to delete this idea?')) return

    try {
      const res = await fetch(`/api/ideas?ideaId=${idea.id}&workspaceId=${workspaceId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setIdeas(prev => prev.filter(i => i.id !== idea.id))
        if (selectedIdea?.id === idea.id) {
          setSelectedIdea(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete idea:', error)
    }
  }

  const filteredIdeas = filter === 'favorites'
    ? ideas.filter(i => i.is_favorite)
    : ideas

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Input & List */}
      <div className="lg:col-span-2 space-y-4">
        {/* Idea Input */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Capture an Idea
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={textInput}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTextInput(e.target.value)}
              placeholder={`What's on your mind for ${workspaceName}? Type your idea or use voice...`}
              className="bg-zinc-800 border-zinc-700 min-h-[100px] resize-none"
            />
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleRecording}
                className={isRecording ? 'border-red-500 text-red-400' : 'border-zinc-700'}
              >
                {isRecording ? (
                  <>
                    <MicOff className="h-4 w-4 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Voice Note
                  </>
                )}
              </Button>
              <Button
                onClick={submitTextIdea}
                disabled={!textInput.trim() || isSubmitting}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Capture Idea
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ideas List */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-zinc-100 text-base">Your Ideas</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className={filter === 'all' ? 'bg-zinc-700' : ''}
                >
                  All ({ideas.length})
                </Button>
                <Button
                  variant={filter === 'favorites' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('favorites')}
                  className={filter === 'favorites' ? 'bg-zinc-700' : ''}
                >
                  <Star className="h-4 w-4 mr-1" />
                  Favorites
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-2">
              {filteredIdeas.length === 0 ? (
                <div className="text-center py-12">
                  <Lightbulb className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">
                    {filter === 'favorites' ? 'No favorite ideas yet' : 'No ideas captured yet'}
                  </p>
                  <p className="text-zinc-500 text-sm mt-1">
                    Start by typing or recording an idea above
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredIdeas.map(idea => (
                    <div
                      key={idea.id}
                      onClick={() => setSelectedIdea(idea)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedIdea?.id === idea.id
                          ? 'bg-amber-600/20 border border-amber-500/50'
                          : 'bg-zinc-800 hover:bg-zinc-700/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {idea.status === 'processing' && (
                              <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                            )}
                            {idea.status === 'complete' && idea.category && (
                              <Badge className={CATEGORY_COLORS[idea.category] || CATEGORY_COLORS.other}>
                                {idea.category}
                              </Badge>
                            )}
                            {idea.is_favorite && (
                              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                            )}
                          </div>
                          <h4 className="text-zinc-200 font-medium truncate">
                            {idea.title || idea.text_content?.slice(0, 50) || 'Processing...'}
                          </h4>
                          {idea.summary && (
                            <p className="text-zinc-400 text-sm line-clamp-2 mt-1">
                              {idea.summary}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })}
                            </span>
                            {idea.tags && idea.tags.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {idea.tags.length} tags
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-zinc-500 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Detail View */}
      <div className="lg:col-span-1">
        {selectedIdea ? (
          <Card className="bg-zinc-900 border-zinc-800 sticky top-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-zinc-100 text-base">Idea Details</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFavorite(selectedIdea)}
                    className={selectedIdea.is_favorite ? 'text-amber-400' : 'text-zinc-400'}
                  >
                    <Star className={`h-4 w-4 ${selectedIdea.is_favorite ? 'fill-amber-400' : ''}`} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-800 border-zinc-700">
                      <DropdownMenuItem
                        onClick={() => archiveIdea(selectedIdea)}
                        className="text-zinc-300 hover:bg-zinc-700"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteIdea(selectedIdea)}
                        className="text-red-400 hover:bg-zinc-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-2">
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <h3 className="text-lg font-medium text-zinc-100">
                      {selectedIdea.title || 'Untitled Idea'}
                    </h3>
                    {selectedIdea.category && (
                      <Badge className={`mt-2 ${CATEGORY_COLORS[selectedIdea.category] || CATEGORY_COLORS.other}`}>
                        {selectedIdea.category}
                      </Badge>
                    )}
                  </div>

                  {/* Summary */}
                  {selectedIdea.summary && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-400 mb-1">Summary</h4>
                      <p className="text-zinc-300 text-sm">{selectedIdea.summary}</p>
                    </div>
                  )}

                  {/* Original Content */}
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-1">Original</h4>
                    <p className="text-zinc-400 text-sm bg-zinc-800 p-3 rounded-lg">
                      {selectedIdea.text_content || selectedIdea.transcript || 'No content'}
                    </p>
                  </div>

                  {/* Key Points */}
                  {selectedIdea.key_points && selectedIdea.key_points.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">Key Points</h4>
                      <ul className="space-y-1">
                        {selectedIdea.key_points.map((point, i) => (
                          <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                            <span className="text-amber-500">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Items */}
                  {selectedIdea.action_items && selectedIdea.action_items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">Action Items</h4>
                      <ul className="space-y-1">
                        {selectedIdea.action_items.map((item, i) => (
                          <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                            <span className="text-green-500">→</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tags */}
                  {selectedIdea.tags && selectedIdea.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedIdea.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="bg-zinc-700 text-zinc-300">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Content Suggestions */}
                  {selectedIdea.content_types_suggested && selectedIdea.content_types_suggested.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">Generate Content</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedIdea.content_types_suggested.map(type => (
                          <Button
                            key={type}
                            variant="outline"
                            size="sm"
                            className="border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                            onClick={() => {
                              // TODO: Navigate to content generator with this idea
                              alert(`Generate ${type} content from this idea - Coming soon!`)
                            }}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {type}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generate All Content Button */}
                  {selectedIdea.status === 'complete' && (
                    <Button
                      className="w-full bg-amber-600 hover:bg-amber-700 mt-4"
                      onClick={() => {
                        // TODO: Open content generator modal
                        alert('Full content generation - Coming soon!')
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Content from This Idea
                    </Button>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="py-12">
              <div className="text-center">
                <Lightbulb className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">Select an idea to view details</p>
                <p className="text-zinc-500 text-sm mt-1">
                  Or capture a new idea above
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

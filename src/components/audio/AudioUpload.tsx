'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Mic, Square, Loader2, X, FileAudio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface AudioUploadProps {
  workspaceId: string
  onUploadComplete?: (noteId: string) => void
}

export function AudioUpload({ workspaceId, onUploadComplete }: AudioUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const supportedFormats = ['audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg']

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)

    const file = e.dataTransfer.files[0]
    if (file && supportedFormats.some(f => file.type.includes(f.split('/')[1]))) {
      setSelectedFile(file)
    } else {
      setError('Please upload an audio file (MP3, M4A, WAV, WebM, OGG)')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })
        setSelectedFile(file)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } catch (err) {
      setError('Could not access microphone. Please allow microphone access.')
      console.error('Recording error:', err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadFile = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('audio', selectedFile)
      formData.append('workspaceId', workspaceId)

      const response = await fetch('/api/audio/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const { noteId } = await response.json()
      setSelectedFile(null)

      // Show success toast with processing status
      toast.success('Audio uploaded successfully', {
        description: 'Transcription in progress. The note will appear below shortly.',
        duration: 5000,
      })

      onUploadComplete?.(noteId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      toast.error('Upload failed', {
        description: errorMessage,
      })
    } finally {
      setIsUploading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-6">
        {!selectedFile ? (
          <>
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                isDragging
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-zinc-700 hover:border-zinc-600'
              )}
            >
              {isRecording ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                    <Mic className="h-8 w-8 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-mono text-red-500">{formatTime(recordingTime)}</p>
                    <p className="text-sm text-zinc-500 mt-1">Recording...</p>
                  </div>
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Recording
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center">
                    <Upload className="h-8 w-8 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-zinc-300">Drag and drop an audio file here</p>
                    <p className="text-sm text-zinc-500 mt-1">MP3, M4A, WAV, WebM, OGG up to 50MB</p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Browse Files
                    </Button>
                    <span className="text-zinc-600">or</span>
                    <Button
                      onClick={startRecording}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Record Audio
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </>
        ) : (
          /* Selected File */
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-zinc-800">
              <div className="w-12 h-12 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <FileAudio className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-100 font-medium truncate">{selectedFile.name}</p>
                <p className="text-sm text-zinc-500">{formatFileSize(selectedFile.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearFile}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={clearFile}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={uploadFile}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Process
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

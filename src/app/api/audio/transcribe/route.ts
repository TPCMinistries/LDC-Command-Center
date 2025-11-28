import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { noteId } = await request.json()

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID required' }, { status: 400 })
    }

    // Use admin client for background processing
    const supabase = createAdminClient()

    // Get the note
    const { data: note, error: noteError } = await supabase
      .from('prophetic_notes')
      .select('*')
      .eq('id', noteId)
      .single()

    if (noteError || !note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    if (!note.audio_url) {
      return NextResponse.json({ error: 'No audio URL' }, { status: 400 })
    }

    // Update status to transcribing
    await supabase
      .from('prophetic_notes')
      .update({ status: 'transcribing' })
      .eq('id', noteId)

    // Check if OpenAI key is configured
    if (!process.env.OPENAI_API_KEY) {
      // Mark as failed if no API key
      await supabase
        .from('prophetic_notes')
        .update({
          status: 'failed',
          error_message: 'OpenAI API key not configured',
        })
        .eq('id', noteId)

      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    try {
      // Fetch the audio file
      const audioResponse = await fetch(note.audio_url)
      if (!audioResponse.ok) {
        throw new Error('Failed to fetch audio file')
      }

      const audioBlob = await audioResponse.blob()

      // Prepare form data for Whisper API
      const formData = new FormData()
      formData.append('file', audioBlob, 'audio.webm')
      formData.append('model', 'whisper-1')
      formData.append('response_format', 'verbose_json')
      formData.append('language', 'en')

      // Call Whisper API
      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      })

      if (!whisperResponse.ok) {
        const error = await whisperResponse.text()
        throw new Error(`Whisper API error: ${error}`)
      }

      const transcription = await whisperResponse.json()

      // Calculate duration from segments or estimate
      const duration = transcription.duration
        ? Math.round(transcription.duration)
        : note.audio_file_size_bytes
          ? Math.round(note.audio_file_size_bytes / 16000) // rough estimate
          : null

      // Update note with transcription
      await supabase
        .from('prophetic_notes')
        .update({
          transcript: transcription.text,
          transcript_segments: transcription.segments || null,
          audio_duration_seconds: duration,
          status: 'processing', // Ready for AI processing
          processing_stats: {
            transcription_model: 'whisper-1',
            transcription_language: transcription.language || 'en',
            transcribed_at: new Date().toISOString(),
          },
        })
        .eq('id', noteId)

      // Trigger Ministry Agent processing
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agents/ministry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId }),
      }).catch(err => console.error('Ministry agent trigger failed:', err))

      return NextResponse.json({
        success: true,
        transcript: transcription.text,
        duration,
      })
    } catch (transcriptionError) {
      console.error('Transcription error:', transcriptionError)

      // Update note with error
      await supabase
        .from('prophetic_notes')
        .update({
          status: 'failed',
          error_message: transcriptionError instanceof Error
            ? transcriptionError.message
            : 'Transcription failed',
        })
        .eq('id', noteId)

      return NextResponse.json({
        error: 'Transcription failed',
        details: transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error',
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Transcribe route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const workspaceId = formData.get('workspaceId') as string

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace ID provided' }, { status: 400 })
    }

    // Verify workspace access
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found or access denied' }, { status: 403 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const ext = audioFile.name.split('.').pop() || 'webm'
    const filename = `${workspaceId}/${user.id}/${timestamp}.${ext}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filename, audioFile, {
        contentType: audioFile.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload audio file' }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(filename)

    // Get signed URL for private access
    const { data: signedUrlData } = await supabase.storage
      .from('audio')
      .createSignedUrl(filename, 60 * 60 * 24 * 7) // 7 days

    // Create prophetic note record
    const { data: note, error: noteError } = await supabase
      .from('prophetic_notes')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        audio_url: signedUrlData?.signedUrl || publicUrl,
        audio_file_size_bytes: audioFile.size,
        status: 'pending',
        title: `Recording ${new Date().toLocaleDateString()}`,
      })
      .select('id')
      .single()

    if (noteError) {
      console.error('Note creation error:', noteError)
      // Try to clean up uploaded file
      await supabase.storage.from('audio').remove([filename])
      return NextResponse.json({ error: 'Failed to create note record' }, { status: 500 })
    }

    // Trigger transcription (async - don't wait)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/audio/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId: note.id }),
    }).catch(err => console.error('Transcription trigger failed:', err))

    return NextResponse.json({
      success: true,
      noteId: note.id,
      message: 'Audio uploaded, transcription starting...',
    })
  } catch (error) {
    console.error('Audio upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List documents for a partner
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')
    const workspaceId = searchParams.get('workspaceId')
    const rfpId = searchParams.get('rfpId')
    const documentType = searchParams.get('documentType')
    const currentOnly = searchParams.get('current') === 'true'

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('partner_documents')
      .select(`
        *,
        partner:partners(id, name),
        rfp:rfp_items(id, title)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (partnerId) {
      query = query.eq('partner_id', partnerId)
    }

    if (rfpId) {
      query = query.eq('rfp_id', rfpId)
    }

    if (documentType && documentType !== 'all') {
      query = query.eq('document_type', documentType)
    }

    if (currentOnly) {
      query = query.eq('is_current', true)
    }

    const { data: documents, error } = await query

    if (error) {
      console.error('Error fetching documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Documents GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new document record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partnerId, workspaceId, ...documentData } = body

    if (!partnerId || !workspaceId || !documentData.name) {
      return NextResponse.json(
        { error: 'Missing partnerId, workspaceId, or document name' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // If this is a new "current" document, mark previous docs of same type as not current
    if (documentData.is_current && documentData.document_type) {
      await supabase
        .from('partner_documents')
        .update({ is_current: false })
        .eq('partner_id', partnerId)
        .eq('document_type', documentData.document_type)
        .eq('is_current', true)
    }

    const { data: document, error } = await supabase
      .from('partner_documents')
      .insert({
        partner_id: partnerId,
        workspace_id: workspaceId,
        uploaded_by: user.id,
        ...documentData,
      })
      .select(`
        *,
        partner:partners(id, name),
        rfp:rfp_items(id, title)
      `)
      .single()

    if (error) {
      console.error('Error creating document:', error)
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Documents POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update a document
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId, workspaceId, ...updates } = body

    if (!documentId || !workspaceId) {
      return NextResponse.json({ error: 'Missing documentId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Remove fields that shouldn't be directly updated
    delete updates.id
    delete updates.partner_id
    delete updates.workspace_id
    delete updates.created_at
    delete updates.uploaded_by

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Get current document to check document type for is_current logic
    if (updates.is_current === true) {
      const { data: currentDoc } = await supabase
        .from('partner_documents')
        .select('partner_id, document_type')
        .eq('id', documentId)
        .single()

      if (currentDoc) {
        // Mark other docs of same type as not current
        await supabase
          .from('partner_documents')
          .update({ is_current: false })
          .eq('partner_id', currentDoc.partner_id)
          .eq('document_type', currentDoc.document_type)
          .eq('is_current', true)
          .neq('id', documentId)
      }
    }

    const { data: document, error } = await supabase
      .from('partner_documents')
      .update(updates)
      .eq('id', documentId)
      .eq('workspace_id', workspaceId)
      .select(`
        *,
        partner:partners(id, name),
        rfp:rfp_items(id, title)
      `)
      .single()

    if (error) {
      console.error('Error updating document:', error)
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Documents PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a document
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')
    const workspaceId = searchParams.get('workspaceId')

    if (!documentId || !workspaceId) {
      return NextResponse.json({ error: 'Missing documentId or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('partner_documents')
      .delete()
      .eq('id', documentId)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error deleting document:', error)
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Documents DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Contacts API
 *
 * Full CRM functionality with relationship tracking and interaction history
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const contactType = searchParams.get('type')
    const search = searchParams.get('search')
    const relationshipHealth = searchParams.get('health')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    let query = supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('last_contact_date', { ascending: false, nullsFirst: false })
      .order('full_name', { ascending: true })
      .limit(limit)

    if (contactType) {
      query = query.eq('contact_type', contactType)
    }

    if (relationshipHealth) {
      query = query.eq('relationship_health', relationshipHealth)
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,organization.ilike.%${search}%`)
    }

    const { data: contacts, error } = await query

    if (error) {
      console.error('Error fetching contacts:', error)
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
    }

    // Also fetch interaction counts
    const contactIds = contacts?.map(c => c.id) || []
    let interactionCounts: Record<string, number> = {}

    if (contactIds.length > 0) {
      const { data: interactions } = await supabase
        .from('contact_interactions')
        .select('contact_id')
        .in('contact_id', contactIds)

      if (interactions) {
        interactionCounts = interactions.reduce((acc, i) => {
          acc[i.contact_id] = (acc[i.contact_id] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
    }

    const contactsWithCounts = contacts?.map(c => ({
      ...c,
      interactionCount: interactionCounts[c.id] || 0,
    }))

    return NextResponse.json({ contacts: contactsWithCounts })
  } catch (error) {
    console.error('Contacts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, contact } = body

    if (!workspaceId || !contact?.fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        workspace_id: workspaceId,
        full_name: contact.fullName,
        email: contact.email || null,
        phone: contact.phone || null,
        organization: contact.organization || null,
        title: contact.title || null,
        contact_type: contact.contactType || 'other',
        tags: contact.tags || [],
        relationship_strength: contact.relationshipStrength || null,
        last_contact_date: contact.lastContactDate || null,
        preferred_contact_method: contact.preferredContactMethod || null,
        notes: contact.notes || null,
        linkedin_url: contact.linkedinUrl || null,
        twitter_handle: contact.twitterHandle || null,
        source: contact.source || null,
        relationship_health: 'warm',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating contact:', error)
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    }

    return NextResponse.json({ success: true, contact: data })
  } catch (error) {
    console.error('Contacts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactId, updates } = body

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contactId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.fullName !== undefined) updateData.full_name = updates.fullName
    if (updates.email !== undefined) updateData.email = updates.email
    if (updates.phone !== undefined) updateData.phone = updates.phone
    if (updates.organization !== undefined) updateData.organization = updates.organization
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.contactType !== undefined) updateData.contact_type = updates.contactType
    if (updates.tags !== undefined) updateData.tags = updates.tags
    if (updates.relationshipStrength !== undefined) updateData.relationship_strength = updates.relationshipStrength
    if (updates.lastContactDate !== undefined) updateData.last_contact_date = updates.lastContactDate
    if (updates.preferredContactMethod !== undefined) updateData.preferred_contact_method = updates.preferredContactMethod
    if (updates.notes !== undefined) updateData.notes = updates.notes
    if (updates.linkedinUrl !== undefined) updateData.linkedin_url = updates.linkedinUrl
    if (updates.twitterHandle !== undefined) updateData.twitter_handle = updates.twitterHandle
    if (updates.relationshipHealth !== undefined) updateData.relationship_health = updates.relationshipHealth
    if (updates.healthNotes !== undefined) updateData.health_notes = updates.healthNotes

    const { data, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contactId)
      .select()
      .single()

    if (error) {
      console.error('Error updating contact:', error)
      return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
    }

    return NextResponse.json({ success: true, contact: data })
  } catch (error) {
    console.error('Contacts PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contactId' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)

    if (error) {
      console.error('Error deleting contact:', error)
      return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contacts DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

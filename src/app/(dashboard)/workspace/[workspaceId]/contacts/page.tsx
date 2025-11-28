import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ContactsClient } from '@/components/contacts/ContactsClient'

interface ContactsPageProps {
  params: Promise<{ workspaceId: string }>
}

export default async function ContactsPage({ params }: ContactsPageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()

  if (error || !workspace) {
    notFound()
  }

  // Fetch contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('last_contact_date', { ascending: false, nullsFirst: false })
    .order('full_name', { ascending: true })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Contacts</h1>
        <p className="text-zinc-400 mt-1">
          Manage relationships with funders, partners, and key stakeholders
        </p>
      </div>

      <ContactsClient
        workspaceId={workspaceId}
        initialContacts={contacts || []}
      />
    </div>
  )
}

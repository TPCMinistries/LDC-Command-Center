'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Search,
  Mail,
  Phone,
  Building2,
  User,
  Heart,
  MoreHorizontal,
  Trash2,
  Edit,
  ExternalLink,
  Linkedin,
  Twitter,
  Calendar,
  MessageSquare,
  Users,
  Briefcase,
  Gift,
  Globe,
  Newspaper,
} from 'lucide-react'
import { format } from 'date-fns'

interface Contact {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  organization: string | null
  title: string | null
  contact_type: string
  tags: string[]
  relationship_strength: number | null
  relationship_health: string | null
  last_contact_date: string | null
  preferred_contact_method: string | null
  notes: string | null
  linkedin_url: string | null
  twitter_handle: string | null
  source: string | null
  interactionCount?: number
  created_at: string
}

interface ContactsClientProps {
  workspaceId: string
  initialContacts: Contact[]
}

const CONTACT_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof User }> = {
  partner: { label: 'Partner', color: 'bg-blue-500/20 text-blue-400', icon: Users },
  donor: { label: 'Donor', color: 'bg-green-500/20 text-green-400', icon: Gift },
  vendor: { label: 'Vendor', color: 'bg-purple-500/20 text-purple-400', icon: Briefcase },
  ministry_contact: { label: 'Ministry', color: 'bg-amber-500/20 text-amber-400', icon: Heart },
  government: { label: 'Government', color: 'bg-red-500/20 text-red-400', icon: Building2 },
  media: { label: 'Media', color: 'bg-pink-500/20 text-pink-400', icon: Newspaper },
  other: { label: 'Other', color: 'bg-zinc-500/20 text-zinc-400', icon: User },
}

const HEALTH_CONFIG: Record<string, { label: string; color: string }> = {
  hot: { label: 'Hot', color: 'bg-red-500' },
  warm: { label: 'Warm', color: 'bg-orange-500' },
  cooling: { label: 'Cooling', color: 'bg-blue-400' },
  cold: { label: 'Cold', color: 'bg-blue-700' },
  at_risk: { label: 'At Risk', color: 'bg-red-700' },
}

export function ContactsClient({ workspaceId, initialContacts }: ContactsClientProps) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [healthFilter, setHealthFilter] = useState<string>('all')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newContact, setNewContact] = useState({
    fullName: '',
    email: '',
    phone: '',
    organization: '',
    title: '',
    contactType: 'other',
    notes: '',
    linkedinUrl: '',
    twitterHandle: '',
  })

  const filteredContacts = contacts.filter(contact => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!contact.full_name.toLowerCase().includes(query) &&
          !contact.email?.toLowerCase().includes(query) &&
          !contact.organization?.toLowerCase().includes(query)) {
        return false
      }
    }
    if (typeFilter !== 'all' && contact.contact_type !== typeFilter) return false
    if (healthFilter !== 'all' && contact.relationship_health !== healthFilter) return false
    return true
  })

  const createContact = async () => {
    if (!newContact.fullName.trim()) return

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, contact: newContact }),
      })

      const data = await res.json()
      if (data.success) {
        setContacts(prev => [data.contact, ...prev])
        setNewContact({
          fullName: '',
          email: '',
          phone: '',
          organization: '',
          title: '',
          contactType: 'other',
          notes: '',
          linkedinUrl: '',
          twitterHandle: '',
        })
        setIsCreateOpen(false)
      }
    } catch (error) {
      console.error('Failed to create contact:', error)
    }
  }

  const updateContact = async (contactId: string, updates: Partial<Contact>) => {
    try {
      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, updates }),
      })

      const data = await res.json()
      if (data.success) {
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...data.contact } : c))
        if (selectedContact?.id === contactId) {
          setSelectedContact({ ...selectedContact, ...data.contact })
        }
      }
    } catch (error) {
      console.error('Failed to update contact:', error)
    }
  }

  const deleteContact = async (contactId: string) => {
    try {
      const res = await fetch(`/api/contacts?contactId=${contactId}`, { method: 'DELETE' })
      if (res.ok) {
        setContacts(prev => prev.filter(c => c.id !== contactId))
        if (selectedContact?.id === contactId) {
          setSelectedContact(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete contact:', error)
    }
  }

  const stats = {
    total: contacts.length,
    byType: Object.entries(CONTACT_TYPE_CONFIG).reduce((acc, [key]) => {
      acc[key] = contacts.filter(c => c.contact_type === key).length
      return acc
    }, {} as Record<string, number>),
    needsAttention: contacts.filter(c => c.relationship_health === 'cold' || c.relationship_health === 'at_risk').length,
  }

  const ContactCard = ({ contact }: { contact: Contact }) => {
    const typeConfig = CONTACT_TYPE_CONFIG[contact.contact_type] || CONTACT_TYPE_CONFIG.other
    const TypeIcon = typeConfig.icon
    const healthConfig = HEALTH_CONFIG[contact.relationship_health || 'warm']

    return (
      <Card
        className={`bg-zinc-800/50 border-zinc-700 cursor-pointer hover:bg-zinc-800 transition-colors ${
          selectedContact?.id === contact.id ? 'ring-1 ring-blue-500' : ''
        }`}
        onClick={() => setSelectedContact(contact)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${typeConfig.color}`}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-zinc-200 truncate">{contact.full_name}</h3>
                {healthConfig && (
                  <div className={`w-2 h-2 rounded-full ${healthConfig.color}`} title={healthConfig.label} />
                )}
              </div>
              {contact.title && contact.organization && (
                <p className="text-xs text-zinc-500 truncate">{contact.title} at {contact.organization}</p>
              )}
              {!contact.title && contact.organization && (
                <p className="text-xs text-zinc-500 truncate">{contact.organization}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {contact.email && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {contact.email}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={`${typeConfig.color} text-xs`}>{typeConfig.label}</Badge>
                {contact.last_contact_date && (
                  <span className="text-xs text-zinc-500">
                    Last: {format(new Date(contact.last_contact_date), 'MMM d')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-zinc-100">{stats.total}</div>
            <div className="text-xs text-zinc-500">Total Contacts</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{stats.byType.donor || 0}</div>
            <div className="text-xs text-zinc-500">Donors</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.byType.partner || 0}</div>
            <div className="text-xs text-zinc-500">Partners</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{stats.needsAttention}</div>
            <div className="text-xs text-zinc-500">Needs Attention</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center gap-4">
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">Add Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input
                placeholder="Full name *"
                value={newContact.fullName}
                onChange={(e) => setNewContact(prev => ({ ...prev, fullName: e.target.value }))}
                className="bg-zinc-800 border-zinc-700"
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Email"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
                <Input
                  placeholder="Phone"
                  value={newContact.phone}
                  onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Organization"
                  value={newContact.organization}
                  onChange={(e) => setNewContact(prev => ({ ...prev, organization: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
                <Input
                  placeholder="Title"
                  value={newContact.title}
                  onChange={(e) => setNewContact(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              <Select
                value={newContact.contactType}
                onValueChange={(v) => setNewContact(prev => ({ ...prev, contactType: v }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Contact Type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTACT_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="LinkedIn URL"
                  value={newContact.linkedinUrl}
                  onChange={(e) => setNewContact(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
                <Input
                  placeholder="Twitter handle"
                  value={newContact.twitterHandle}
                  onChange={(e) => setNewContact(prev => ({ ...prev, twitterHandle: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              <Textarea
                placeholder="Notes"
                value={newContact.notes}
                onChange={(e) => setNewContact(prev => ({ ...prev, notes: e.target.value }))}
                className="bg-zinc-800 border-zinc-700"
              />
              <Button onClick={createContact} className="w-full bg-blue-600 hover:bg-blue-700">
                Add Contact
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-800 border-zinc-700"
            />
          </div>
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(CONTACT_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger className="w-[150px] bg-zinc-800 border-zinc-700">
            <SelectValue placeholder="All Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            {Object.entries(HEALTH_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contact List and Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ScrollArea className="h-[600px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
              {filteredContacts.map(contact => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
              {filteredContacts.length === 0 && (
                <div className="col-span-2 text-center py-12">
                  <Users className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-400">No contacts found</p>
                  <p className="text-sm text-zinc-500 mt-1">Add your first contact to get started</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedContact ? (
            <Card className="bg-zinc-900 border-zinc-800 sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-zinc-100">{selectedContact.full_name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-400"
                      onClick={() => deleteContact(selectedContact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {selectedContact.title && selectedContact.organization && (
                  <p className="text-sm text-zinc-400">{selectedContact.title} at {selectedContact.organization}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Contact Info */}
                <div className="space-y-2">
                  {selectedContact.email && (
                    <a href={`mailto:${selectedContact.email}`} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
                      <Mail className="h-4 w-4" />
                      {selectedContact.email}
                    </a>
                  )}
                  {selectedContact.phone && (
                    <a href={`tel:${selectedContact.phone}`} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
                      <Phone className="h-4 w-4" />
                      {selectedContact.phone}
                    </a>
                  )}
                  {selectedContact.organization && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Building2 className="h-4 w-4" />
                      {selectedContact.organization}
                    </div>
                  )}
                </div>

                {/* Social Links */}
                {(selectedContact.linkedin_url || selectedContact.twitter_handle) && (
                  <div className="flex items-center gap-3">
                    {selectedContact.linkedin_url && (
                      <a href={selectedContact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-blue-400">
                        <Linkedin className="h-5 w-5" />
                      </a>
                    )}
                    {selectedContact.twitter_handle && (
                      <a href={`https://twitter.com/${selectedContact.twitter_handle}`} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-blue-400">
                        <Twitter className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                )}

                {/* Relationship Health */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">Relationship Health</label>
                  <Select
                    value={selectedContact.relationship_health || 'warm'}
                    onValueChange={(v) => updateContact(selectedContact.id, { relationship_health: v } as Partial<Contact>)}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(HEALTH_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${config.color}`} />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact Type */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">Contact Type</label>
                  <Select
                    value={selectedContact.contact_type}
                    onValueChange={(v) => updateContact(selectedContact.id, { contact_type: v } as Partial<Contact>)}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTACT_TYPE_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                {selectedContact.notes && (
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-500">Notes</label>
                    <p className="text-sm text-zinc-400">{selectedContact.notes}</p>
                  </div>
                )}

                {/* Last Contact */}
                {selectedContact.last_contact_date && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Calendar className="h-4 w-4" />
                    Last contact: {format(new Date(selectedContact.last_contact_date), 'MMM d, yyyy')}
                  </div>
                )}

                {/* Interactions */}
                {selectedContact.interactionCount !== undefined && selectedContact.interactionCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <MessageSquare className="h-4 w-4" />
                    {selectedContact.interactionCount} interactions logged
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-8 text-center">
                <User className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400">Select a contact</p>
                <p className="text-sm text-zinc-500 mt-1">Click on a contact to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

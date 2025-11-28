'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  Search,
  Building2,
  Users,
  CheckCircle,
  AlertCircle,
  XCircle,
  ChevronRight,
  Star,
  Phone,
  Mail,
  Globe,
  ClipboardCheck,
  Loader2,
  Edit2,
  Trash2,
  X,
} from 'lucide-react'

interface Partner {
  id: string
  name: string
  legal_name?: string
  ein?: string
  duns_number?: string
  sam_uei?: string
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
  primary_contact_title?: string
  sector: string
  sectors?: string[]
  description?: string
  mission?: string
  website?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
  }
  annual_budget?: number
  staff_count?: number
  year_founded?: number
  service_area?: string[]
  populations_served?: string[]
  status: string
  status_notes?: string
  capacity_governance?: number
  capacity_compliance?: number
  capacity_hr?: number
  capacity_fiscal?: number
  capacity_program_quality?: number
  capacity_data_literacy?: number
  capacity_overall?: number
  last_assessment_date?: string
  is_fundable: boolean
  is_compliant: boolean
  needs_capacity_building: boolean
  notes?: string
  tags?: string[]
  created_at: string
}

interface PartnersClientProps {
  workspaceId: string
  initialPartners: Partner[]
}

const SECTORS = [
  { value: 'education', label: 'Education' },
  { value: 'workforce', label: 'Workforce Development' },
  { value: 'health', label: 'Health & Wellness' },
  { value: 'community', label: 'Community Development' },
  { value: 'civic', label: 'Civic Engagement' },
  { value: 'capital', label: 'Capital & Finance' },
  { value: 'tech', label: 'Technology' },
  { value: 'culinary', label: 'Culinary & Food' },
  { value: 'faith', label: 'Faith-Based' },
  { value: 'housing', label: 'Housing' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'arts', label: 'Arts & Culture' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'other', label: 'Other' },
]

const STATUSES = [
  { value: 'prospect', label: 'Prospect', color: 'text-zinc-400' },
  { value: 'contacted', label: 'Contacted', color: 'text-blue-400' },
  { value: 'assessing', label: 'Assessing', color: 'text-yellow-400' },
  { value: 'onboarding', label: 'Onboarding', color: 'text-purple-400' },
  { value: 'active', label: 'Active', color: 'text-green-400' },
  { value: 'inactive', label: 'Inactive', color: 'text-zinc-500' },
  { value: 'declined', label: 'Declined', color: 'text-red-400' },
]

export function PartnersClient({ workspaceId, initialPartners }: PartnersClientProps) {
  const [partners, setPartners] = useState<Partner[]>(initialPartners)
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>(initialPartners)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [fundableFilter, setFundableFilter] = useState(false)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // New partner form state
  const [newPartner, setNewPartner] = useState({
    name: '',
    legal_name: '',
    ein: '',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    primary_contact_title: '',
    sector: 'other',
    description: '',
    mission: '',
    website: '',
    annual_budget: '',
    staff_count: '',
    year_founded: '',
    notes: '',
  })

  // Filter partners when filters change
  useEffect(() => {
    let filtered = partners

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.primary_contact_name?.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }

    if (sectorFilter !== 'all') {
      filtered = filtered.filter((p) => p.sector === sectorFilter)
    }

    if (fundableFilter) {
      filtered = filtered.filter((p) => p.is_fundable)
    }

    setFilteredPartners(filtered)
  }, [partners, searchQuery, statusFilter, sectorFilter, fundableFilter])

  const handleAddPartner = async () => {
    if (!newPartner.name.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          name: newPartner.name,
          legal_name: newPartner.legal_name || null,
          ein: newPartner.ein || null,
          primary_contact_name: newPartner.primary_contact_name || null,
          primary_contact_email: newPartner.primary_contact_email || null,
          primary_contact_phone: newPartner.primary_contact_phone || null,
          primary_contact_title: newPartner.primary_contact_title || null,
          sector: newPartner.sector,
          description: newPartner.description || null,
          mission: newPartner.mission || null,
          website: newPartner.website || null,
          annual_budget: newPartner.annual_budget ? parseFloat(newPartner.annual_budget) : null,
          staff_count: newPartner.staff_count ? parseInt(newPartner.staff_count) : null,
          year_founded: newPartner.year_founded ? parseInt(newPartner.year_founded) : null,
          notes: newPartner.notes || null,
        }),
      })

      if (response.ok) {
        const { partner } = await response.json()
        setPartners([partner, ...partners])
        setNewPartner({
          name: '',
          legal_name: '',
          ein: '',
          primary_contact_name: '',
          primary_contact_email: '',
          primary_contact_phone: '',
          primary_contact_title: '',
          sector: 'other',
          description: '',
          mission: '',
          website: '',
          annual_budget: '',
          staff_count: '',
          year_founded: '',
          notes: '',
        })
        setIsAddModalOpen(false)
      }
    } catch (error) {
      console.error('Error adding partner:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdatePartner = async (partnerId: string, updates: Partial<Partner>) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          workspaceId,
          ...updates,
        }),
      })

      if (response.ok) {
        const { partner } = await response.json()
        setPartners(partners.map((p) => (p.id === partnerId ? partner : p)))
        if (selectedPartner?.id === partnerId) {
          setSelectedPartner(partner)
        }
        setIsEditMode(false)
      }
    } catch (error) {
      console.error('Error updating partner:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePartner = async (partnerId: string) => {
    if (!confirm('Are you sure you want to remove this partner?')) return

    try {
      const response = await fetch(
        `/api/partners?partnerId=${partnerId}&workspaceId=${workspaceId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setPartners(partners.filter((p) => p.id !== partnerId))
        setIsDetailOpen(false)
        setSelectedPartner(null)
      }
    } catch (error) {
      console.error('Error deleting partner:', error)
    }
  }

  const getStatusInfo = (status: string) => {
    return STATUSES.find((s) => s.value === status) || STATUSES[0]
  }

  const getSectorLabel = (sector: string) => {
    return SECTORS.find((s) => s.value === sector)?.label || sector
  }

  const getCapacityColor = (score: number | undefined) => {
    if (!score) return 'bg-zinc-700'
    if (score >= 4) return 'bg-green-500'
    if (score >= 3) return 'bg-yellow-500'
    if (score >= 2) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const renderCapacityBar = (score: number | undefined, label: string) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 w-24">{label}</span>
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${getCapacityColor(score)} transition-all`}
          style={{ width: score ? `${score * 20}%` : '0%' }}
        />
      </div>
      <span className="text-xs text-zinc-300 w-8">{score || '-'}/5</span>
    </div>
  )

  // Stats
  const stats = {
    total: partners.length,
    active: partners.filter((p) => p.status === 'active').length,
    fundable: partners.filter((p) => p.is_fundable).length,
    needsCapacity: partners.filter((p) => p.needs_capacity_building).length,
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.total}</p>
              <p className="text-xs text-zinc-400">Total Partners</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.active}</p>
              <p className="text-xs text-zinc-400">Active Partners</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Star className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.fundable}</p>
              <p className="text-xs text-zinc-400">Grant Ready</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-purple-400" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.needsCapacity}</p>
              <p className="text-xs text-zinc-400">Need Capacity Building</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex flex-1 gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Search partners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-700"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-300"
          >
            <option value="all">All Statuses</option>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-300"
          >
            <option value="all">All Sectors</option>
            {SECTORS.map((sector) => (
              <option key={sector.value} value={sector.value}>
                {sector.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={fundableFilter}
              onChange={(e) => setFundableFilter(e.target.checked)}
              className="rounded border-zinc-700"
            />
            Grant Ready Only
          </label>
        </div>

        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle>Add New Partner</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Organization Name *
                  </label>
                  <Input
                    value={newPartner.name}
                    onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                    placeholder="Enter organization name"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Legal Name
                  </label>
                  <Input
                    value={newPartner.legal_name}
                    onChange={(e) => setNewPartner({ ...newPartner, legal_name: e.target.value })}
                    placeholder="Legal entity name"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Sector
                  </label>
                  <select
                    value={newPartner.sector}
                    onChange={(e) => setNewPartner({ ...newPartner, sector: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-300"
                  >
                    {SECTORS.map((sector) => (
                      <option key={sector.value} value={sector.value}>
                        {sector.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    EIN (Tax ID)
                  </label>
                  <Input
                    value={newPartner.ein}
                    onChange={(e) => setNewPartner({ ...newPartner, ein: e.target.value })}
                    placeholder="XX-XXXXXXX"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Description
                </label>
                <Textarea
                  value={newPartner.description}
                  onChange={(e) => setNewPartner({ ...newPartner, description: e.target.value })}
                  placeholder="Brief description of the organization"
                  className="bg-zinc-800 border-zinc-700"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Mission Statement
                </label>
                <Textarea
                  value={newPartner.mission}
                  onChange={(e) => setNewPartner({ ...newPartner, mission: e.target.value })}
                  placeholder="Organization's mission"
                  className="bg-zinc-800 border-zinc-700"
                  rows={2}
                />
              </div>

              <div className="border-t border-zinc-700 pt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Primary Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Name</label>
                    <Input
                      value={newPartner.primary_contact_name}
                      onChange={(e) =>
                        setNewPartner({ ...newPartner, primary_contact_name: e.target.value })
                      }
                      placeholder="Contact name"
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Title</label>
                    <Input
                      value={newPartner.primary_contact_title}
                      onChange={(e) =>
                        setNewPartner({ ...newPartner, primary_contact_title: e.target.value })
                      }
                      placeholder="Job title"
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Email</label>
                    <Input
                      type="email"
                      value={newPartner.primary_contact_email}
                      onChange={(e) =>
                        setNewPartner({ ...newPartner, primary_contact_email: e.target.value })
                      }
                      placeholder="email@example.com"
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Phone</label>
                    <Input
                      value={newPartner.primary_contact_phone}
                      onChange={(e) =>
                        setNewPartner({ ...newPartner, primary_contact_phone: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-700 pt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Organization Details</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Annual Budget</label>
                    <Input
                      type="number"
                      value={newPartner.annual_budget}
                      onChange={(e) =>
                        setNewPartner({ ...newPartner, annual_budget: e.target.value })
                      }
                      placeholder="500000"
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Staff Count</label>
                    <Input
                      type="number"
                      value={newPartner.staff_count}
                      onChange={(e) =>
                        setNewPartner({ ...newPartner, staff_count: e.target.value })
                      }
                      placeholder="25"
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Year Founded</label>
                    <Input
                      type="number"
                      value={newPartner.year_founded}
                      onChange={(e) =>
                        setNewPartner({ ...newPartner, year_founded: e.target.value })
                      }
                      placeholder="2010"
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Website</label>
                <Input
                  type="url"
                  value={newPartner.website}
                  onChange={(e) => setNewPartner({ ...newPartner, website: e.target.value })}
                  placeholder="https://example.org"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Notes</label>
                <Textarea
                  value={newPartner.notes}
                  onChange={(e) => setNewPartner({ ...newPartner, notes: e.target.value })}
                  placeholder="Additional notes about this partner"
                  className="bg-zinc-800 border-zinc-700"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddPartner} disabled={!newPartner.name.trim() || isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Add Partner'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Partners List */}
      <div className="space-y-3">
        {filteredPartners.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            {partners.length === 0 ? (
              <div>
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No partners yet</p>
                <p className="text-sm">Add your first coalition partner to get started</p>
              </div>
            ) : (
              <p>No partners match your filters</p>
            )}
          </div>
        ) : (
          filteredPartners.map((partner) => {
            const statusInfo = getStatusInfo(partner.status)
            return (
              <div
                key={partner.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedPartner(partner)
                  setIsDetailOpen(true)
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-zinc-100">{partner.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color} bg-zinc-800`}
                      >
                        {statusInfo.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400">
                        {getSectorLabel(partner.sector)}
                      </span>
                      {partner.is_fundable && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-900/50 text-green-400">
                          Grant Ready
                        </span>
                      )}
                    </div>
                    {partner.description && (
                      <p className="text-sm text-zinc-400 mb-2 line-clamp-1">
                        {partner.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      {partner.primary_contact_name && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {partner.primary_contact_name}
                        </span>
                      )}
                      {partner.primary_contact_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {partner.primary_contact_email}
                        </span>
                      )}
                      {partner.capacity_overall && (
                        <span className="flex items-center gap-1">
                          <ClipboardCheck className="w-3 h-3" />
                          Capacity: {partner.capacity_overall}/5
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-600" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Partner Detail Slide-over */}
      {isDetailOpen && selectedPartner && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setIsDetailOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-full max-w-2xl bg-zinc-900 border-l border-zinc-700 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-medium text-zinc-100">{selectedPartner.name}</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  {isEditMode ? 'Cancel' : 'Edit'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => handleDeletePartner(selectedPartner.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1 hover:bg-zinc-800 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Flags */}
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={selectedPartner.status}
                  onChange={(e) =>
                    handleUpdatePartner(selectedPartner.id, { status: e.target.value })
                  }
                  className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm"
                >
                  {STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <span className="px-2 py-1 rounded-full text-xs bg-zinc-800 text-zinc-400">
                  {getSectorLabel(selectedPartner.sector)}
                </span>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPartner.is_fundable}
                    onChange={(e) =>
                      handleUpdatePartner(selectedPartner.id, { is_fundable: e.target.checked })
                    }
                    className="rounded border-zinc-700"
                  />
                  <span className="text-green-400">Grant Ready</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPartner.is_compliant}
                    onChange={(e) =>
                      handleUpdatePartner(selectedPartner.id, { is_compliant: e.target.checked })
                    }
                    className="rounded border-zinc-700"
                  />
                  <span className="text-blue-400">Compliant</span>
                </label>
              </div>

              {/* Description */}
              {selectedPartner.description && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-1">Description</h4>
                  <p className="text-zinc-200">{selectedPartner.description}</p>
                </div>
              )}

              {/* Mission */}
              {selectedPartner.mission && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-1">Mission</h4>
                  <p className="text-zinc-200">{selectedPartner.mission}</p>
                </div>
              )}

              {/* Contact Info */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Primary Contact</h4>
                <div className="space-y-2">
                  {selectedPartner.primary_contact_name && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-zinc-500" />
                      <span className="text-zinc-200">{selectedPartner.primary_contact_name}</span>
                      {selectedPartner.primary_contact_title && (
                        <span className="text-zinc-500">
                          ({selectedPartner.primary_contact_title})
                        </span>
                      )}
                    </div>
                  )}
                  {selectedPartner.primary_contact_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-zinc-500" />
                      <a
                        href={`mailto:${selectedPartner.primary_contact_email}`}
                        className="text-blue-400 hover:underline"
                      >
                        {selectedPartner.primary_contact_email}
                      </a>
                    </div>
                  )}
                  {selectedPartner.primary_contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-zinc-500" />
                      <a
                        href={`tel:${selectedPartner.primary_contact_phone}`}
                        className="text-zinc-200"
                      >
                        {selectedPartner.primary_contact_phone}
                      </a>
                    </div>
                  )}
                  {selectedPartner.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-zinc-500" />
                      <a
                        href={selectedPartner.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {selectedPartner.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Organization Details */}
              <div className="grid grid-cols-3 gap-4">
                {selectedPartner.annual_budget && (
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-400">Annual Budget</p>
                    <p className="text-lg font-medium text-zinc-100">
                      ${selectedPartner.annual_budget.toLocaleString()}
                    </p>
                  </div>
                )}
                {selectedPartner.staff_count && (
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-400">Staff Size</p>
                    <p className="text-lg font-medium text-zinc-100">
                      {selectedPartner.staff_count}
                    </p>
                  </div>
                )}
                {selectedPartner.year_founded && (
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-xs text-zinc-400">Founded</p>
                    <p className="text-lg font-medium text-zinc-100">
                      {selectedPartner.year_founded}
                    </p>
                  </div>
                )}
              </div>

              {/* Compliance IDs */}
              {(selectedPartner.ein || selectedPartner.duns_number || selectedPartner.sam_uei) && (
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">Compliance IDs</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {selectedPartner.ein && (
                      <div>
                        <p className="text-xs text-zinc-500">EIN</p>
                        <p className="text-zinc-200 font-mono">{selectedPartner.ein}</p>
                      </div>
                    )}
                    {selectedPartner.duns_number && (
                      <div>
                        <p className="text-xs text-zinc-500">DUNS</p>
                        <p className="text-zinc-200 font-mono">{selectedPartner.duns_number}</p>
                      </div>
                    )}
                    {selectedPartner.sam_uei && (
                      <div>
                        <p className="text-xs text-zinc-500">SAM UEI</p>
                        <p className="text-zinc-200 font-mono">{selectedPartner.sam_uei}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Capacity Scores */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-zinc-300">Capacity Assessment</h4>
                  {selectedPartner.last_assessment_date && (
                    <span className="text-xs text-zinc-500">
                      Last assessed: {new Date(selectedPartner.last_assessment_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {renderCapacityBar(selectedPartner.capacity_governance, 'Governance')}
                  {renderCapacityBar(selectedPartner.capacity_compliance, 'Compliance')}
                  {renderCapacityBar(selectedPartner.capacity_hr, 'HR')}
                  {renderCapacityBar(selectedPartner.capacity_fiscal, 'Fiscal')}
                  {renderCapacityBar(selectedPartner.capacity_program_quality, 'Program Quality')}
                  {renderCapacityBar(selectedPartner.capacity_data_literacy, 'Data Literacy')}
                  <div className="pt-2 border-t border-zinc-700 mt-3">
                    {renderCapacityBar(selectedPartner.capacity_overall, 'Overall')}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-4 w-full">
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  New Assessment
                </Button>
              </div>

              {/* Notes */}
              {selectedPartner.notes && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-1">Notes</h4>
                  <p className="text-zinc-300 text-sm">{selectedPartner.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

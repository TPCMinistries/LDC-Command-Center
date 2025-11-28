'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  Search,
  Users,
  Building2,
  DollarSign,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  ChevronDown,
  X,
  Handshake,
} from 'lucide-react'

interface Partner {
  id: string
  name: string
  sector: string
  status: string
  is_fundable: boolean
  capacity_overall?: number
}

interface CoalitionMembership {
  id: string
  partner_id: string
  rfp_id?: string
  grant_name?: string
  role: string
  deliverables: string[]
  scope_of_work?: string
  budget_allocated?: number
  budget_percentage?: number
  mou_status: string
  mou_signed_date?: string
  is_confirmed: boolean
  notes?: string
  partner?: Partner
}

interface RFP {
  id: string
  title: string
  agency?: string
  response_deadline?: string
  grant_phase?: string
  total_budget?: number
}

interface CoalitionBuilderProps {
  workspaceId: string
  rfp?: RFP
  grantName?: string
  onUpdate?: () => void
}

const COALITION_ROLES = [
  { value: 'lead', label: 'Lead Organization' },
  { value: 'co_lead', label: 'Co-Lead' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'partner', label: 'Partner' },
  { value: 'evaluator', label: 'External Evaluator' },
  { value: 'fiscal_agent', label: 'Fiscal Agent' },
  { value: 'technical_assistance', label: 'Technical Assistance' },
  { value: 'community_liaison', label: 'Community Liaison' },
]

const MOU_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'text-zinc-400' },
  { value: 'sent', label: 'Sent', color: 'text-blue-400' },
  { value: 'signed', label: 'Signed', color: 'text-green-400' },
  { value: 'expired', label: 'Expired', color: 'text-red-400' },
]

export function CoalitionBuilder({ workspaceId, rfp, grantName, onUpdate }: CoalitionBuilderProps) {
  const [memberships, setMemberships] = useState<CoalitionMembership[]>([])
  const [availablePartners, setAvailablePartners] = useState<Partner[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingPartner, setIsAddingPartner] = useState(false)
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // New membership form state
  const [newMembership, setNewMembership] = useState({
    role: 'partner',
    deliverables: '',
    scope_of_work: '',
    budget_allocated: '',
    budget_percentage: '',
    notes: '',
  })

  // Fetch coalition memberships
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({ workspaceId })
        if (rfp?.id) params.append('rfpId', rfp.id)

        const [membershipsRes, partnersRes] = await Promise.all([
          fetch(`/api/coalitions?${params}`),
          fetch(`/api/partners?workspaceId=${workspaceId}`),
        ])

        if (membershipsRes.ok) {
          const { memberships: data } = await membershipsRes.json()
          setMemberships(data || [])
        }

        if (partnersRes.ok) {
          const { partners } = await partnersRes.json()
          setAvailablePartners(partners || [])
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [workspaceId, rfp?.id])

  // Filter partners not already in coalition
  const eligiblePartners = availablePartners.filter(
    (p) =>
      !memberships.some((m) => m.partner_id === p.id) &&
      (searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleAddPartner = async () => {
    if (!selectedPartner) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/coalitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          rfpId: rfp?.id,
          grant_name: grantName,
          partnerId: selectedPartner.id,
          role: newMembership.role,
          deliverables: newMembership.deliverables
            ? newMembership.deliverables.split('\n').filter((d) => d.trim())
            : [],
          scope_of_work: newMembership.scope_of_work || null,
          budget_allocated: newMembership.budget_allocated
            ? parseFloat(newMembership.budget_allocated)
            : null,
          budget_percentage: newMembership.budget_percentage
            ? parseFloat(newMembership.budget_percentage)
            : null,
          notes: newMembership.notes || null,
        }),
      })

      if (response.ok) {
        const { membership } = await response.json()
        setMemberships([...memberships, membership])
        setShowAddModal(false)
        setSelectedPartner(null)
        setNewMembership({
          role: 'partner',
          deliverables: '',
          scope_of_work: '',
          budget_allocated: '',
          budget_percentage: '',
          notes: '',
        })
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error adding partner:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateMembership = async (membershipId: string, updates: Partial<CoalitionMembership>) => {
    try {
      const response = await fetch('/api/coalitions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipId,
          workspaceId,
          ...updates,
        }),
      })

      if (response.ok) {
        const { membership } = await response.json()
        setMemberships(memberships.map((m) => (m.id === membershipId ? membership : m)))
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error updating membership:', error)
    }
  }

  const handleRemoveMember = async (membershipId: string) => {
    if (!confirm('Remove this partner from the coalition?')) return

    try {
      const response = await fetch(
        `/api/coalitions?membershipId=${membershipId}&workspaceId=${workspaceId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setMemberships(memberships.filter((m) => m.id !== membershipId))
        onUpdate?.()
      }
    } catch (error) {
      console.error('Error removing member:', error)
    }
  }

  const getRoleLabel = (role: string) => {
    return COALITION_ROLES.find((r) => r.value === role)?.label || role
  }

  const getMouStatusInfo = (status: string) => {
    return MOU_STATUSES.find((s) => s.value === status) || MOU_STATUSES[0]
  }

  // Calculate totals
  const totalAllocated = memberships.reduce((sum, m) => sum + (m.budget_allocated || 0), 0)
  const totalPercentage = memberships.reduce((sum, m) => sum + (m.budget_percentage || 0), 0)
  const signedCount = memberships.filter((m) => m.mou_status === 'signed').length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-zinc-100 flex items-center gap-2">
            <Handshake className="w-5 h-5 text-amber-500" />
            Coalition Members
          </h3>
          <p className="text-sm text-zinc-400">
            {memberships.length} partner{memberships.length !== 1 ? 's' : ''} •{' '}
            {signedCount} MOU{signedCount !== 1 ? 's' : ''} signed
          </p>
        </div>

        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle>Add Partner to Coalition</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Partner Search */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Select Partner
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    placeholder="Search partners..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-zinc-800 border-zinc-700"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-zinc-700 rounded-md divide-y divide-zinc-700">
                  {eligiblePartners.length === 0 ? (
                    <div className="p-3 text-sm text-zinc-500 text-center">
                      No eligible partners found
                    </div>
                  ) : (
                    eligiblePartners.slice(0, 10).map((partner) => (
                      <div
                        key={partner.id}
                        className={`p-3 cursor-pointer transition-colors ${
                          selectedPartner?.id === partner.id
                            ? 'bg-amber-600/20'
                            : 'hover:bg-zinc-800'
                        }`}
                        onClick={() => setSelectedPartner(partner)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{partner.name}</p>
                            <p className="text-xs text-zinc-500">{partner.sector}</p>
                          </div>
                          {partner.is_fundable && (
                            <span className="text-xs text-green-400">Grant Ready</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedPartner && (
                <>
                  <div className="p-3 bg-zinc-800/50 rounded-lg">
                    <p className="text-sm text-zinc-300">
                      <span className="text-amber-500 font-medium">Selected:</span>{' '}
                      {selectedPartner.name}
                    </p>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                      Coalition Role
                    </label>
                    <select
                      value={newMembership.role}
                      onChange={(e) =>
                        setNewMembership({ ...newMembership, role: e.target.value })
                      }
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm"
                    >
                      {COALITION_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Budget */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Budget Allocation ($)
                      </label>
                      <Input
                        type="number"
                        value={newMembership.budget_allocated}
                        onChange={(e) =>
                          setNewMembership({ ...newMembership, budget_allocated: e.target.value })
                        }
                        placeholder="0.00"
                        className="bg-zinc-800 border-zinc-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Budget Percentage (%)
                      </label>
                      <Input
                        type="number"
                        value={newMembership.budget_percentage}
                        onChange={(e) =>
                          setNewMembership({ ...newMembership, budget_percentage: e.target.value })
                        }
                        placeholder="0"
                        className="bg-zinc-800 border-zinc-700"
                      />
                    </div>
                  </div>

                  {/* Deliverables */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                      Deliverables (one per line)
                    </label>
                    <Textarea
                      value={newMembership.deliverables}
                      onChange={(e) =>
                        setNewMembership({ ...newMembership, deliverables: e.target.value })
                      }
                      placeholder="Provide training services&#10;Submit quarterly reports&#10;..."
                      className="bg-zinc-800 border-zinc-700"
                      rows={3}
                    />
                  </div>

                  {/* Scope of Work */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                      Scope of Work
                    </label>
                    <Textarea
                      value={newMembership.scope_of_work}
                      onChange={(e) =>
                        setNewMembership({ ...newMembership, scope_of_work: e.target.value })
                      }
                      placeholder="Describe the partner's responsibilities..."
                      className="bg-zinc-800 border-zinc-700"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setShowAddModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddPartner} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Adding...
                        </>
                      ) : (
                        'Add to Coalition'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      {memberships.length > 0 && rfp?.total_budget && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-400">Total Allocated</p>
            <p className="text-lg font-medium text-zinc-100">
              ${totalAllocated.toLocaleString()}
            </p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-400">% of Budget</p>
            <p className="text-lg font-medium text-zinc-100">{totalPercentage.toFixed(1)}%</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-400">Remaining</p>
            <p className="text-lg font-medium text-zinc-100">
              ${(rfp.total_budget - totalAllocated).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Coalition Members List */}
      {memberships.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-700 rounded-lg">
          <Users className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
          <p className="text-zinc-400">No coalition partners yet</p>
          <p className="text-sm text-zinc-500 mt-1">Add partners to build your coalition</p>
        </div>
      ) : (
        <div className="space-y-2">
          {memberships.map((membership) => {
            const mouStatus = getMouStatusInfo(membership.mou_status)
            const partner = membership.partner

            return (
              <div
                key={membership.id}
                className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-zinc-100">
                        {partner?.name || 'Unknown Partner'}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-700 text-zinc-300">
                        {getRoleLabel(membership.role)}
                      </span>
                      <span className={`text-xs ${mouStatus.color}`}>
                        MOU: {mouStatus.label}
                      </span>
                    </div>

                    {membership.scope_of_work && (
                      <p className="text-sm text-zinc-400 mb-2 line-clamp-2">
                        {membership.scope_of_work}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      {membership.budget_allocated && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />$
                          {membership.budget_allocated.toLocaleString()}
                        </span>
                      )}
                      {membership.budget_percentage && (
                        <span>{membership.budget_percentage}% of budget</span>
                      )}
                      {membership.deliverables && membership.deliverables.length > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {membership.deliverables.length} deliverable
                          {membership.deliverables.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={membership.mou_status}
                      onChange={(e) =>
                        handleUpdateMembership(membership.id, { mou_status: e.target.value })
                      }
                      className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs"
                    >
                      {MOU_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveMember(membership.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Calendar,
  Building2,
  DollarSign,
  Edit,
  Trash2,
  Sparkles,
  Wand2,
  Zap,
  FileStack,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { ProposalEditor } from './ProposalEditor'
import { ProposalWizard } from './ProposalWizard'

interface Proposal {
  id: string
  title: string
  funder_name?: string
  grant_program?: string
  status: string
  requested_amount?: number
  submission_deadline?: string
  program_name?: string
  created_at: string
  updated_at: string
  rfp?: {
    id: string
    title: string
    agency: string
    response_deadline?: string
  }
  template?: {
    id: string
    name: string
    category: string
  }
}

interface Template {
  id: string
  name: string
  category: string
  description?: string
}

interface RFP {
  id: string
  title: string
  agency?: string
  response_deadline?: string
  status: string
}

interface ProposalsClientProps {
  workspaceId: string
  initialProposals: Proposal[]
  templates: Template[]
  rfps: RFP[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', color: 'text-zinc-400 bg-zinc-800', icon: Edit },
  in_progress: { label: 'In Progress', color: 'text-blue-400 bg-blue-500/20', icon: Clock },
  internal_review: { label: 'Internal Review', color: 'text-yellow-400 bg-yellow-500/20', icon: AlertCircle },
  final_review: { label: 'Final Review', color: 'text-orange-400 bg-orange-500/20', icon: AlertCircle },
  submitted: { label: 'Submitted', color: 'text-purple-400 bg-purple-500/20', icon: CheckCircle },
  approved: { label: 'Approved', color: 'text-green-400 bg-green-500/20', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-400 bg-red-500/20', icon: AlertCircle },
}

const DEFAULT_TEMPLATES = [
  { id: 'default-federal', name: 'Federal Grant Template', category: 'federal', description: 'Standard template for federal grant applications' },
  { id: 'default-city', name: 'NYC City Agency Template', category: 'city', description: 'Template for DYCD, DOE, HHS, etc.' },
  { id: 'default-foundation', name: 'Foundation Grant Template', category: 'foundation', description: 'Template for private foundation applications' },
  { id: 'default-general', name: 'General Proposal Template', category: 'general', description: 'Flexible template for various grant types' },
]

export function ProposalsClient({ workspaceId, initialProposals, templates, rfps }: ProposalsClientProps) {
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals)
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')

  // Handler for wizard-created proposals
  const handleWizardProposalCreated = (proposal: Proposal) => {
    setProposals([proposal, ...proposals])
    setSelectedProposal(proposal)
    setIsEditorOpen(true)
  }

  // New proposal form
  const [newProposal, setNewProposal] = useState({
    title: '',
    funder_name: '',
    grant_program: '',
    requested_amount: '',
    templateId: '',
    rfpId: '',
  })

  const allTemplates = templates.length > 0 ? templates : DEFAULT_TEMPLATES

  const handleCreateProposal = async () => {
    if (!newProposal.title.trim()) return

    setIsCreating(true)
    try {
      // Pass templateId as-is - backend handles both "default-*" and custom templates
      const templateId = newProposal.templateId || null

      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          title: newProposal.title,
          funder_name: newProposal.funder_name || null,
          grant_program: newProposal.grant_program || null,
          requested_amount: newProposal.requested_amount
            ? parseFloat(newProposal.requested_amount)
            : null,
          templateId,
          rfpId: newProposal.rfpId || null,
        }),
      })

      if (response.ok) {
        const { proposal } = await response.json()
        setProposals([proposal, ...proposals])
        setNewProposal({
          title: '',
          funder_name: '',
          grant_program: '',
          requested_amount: '',
          templateId: '',
          rfpId: '',
        })
        setIsCreateOpen(false)
        // Open editor for new proposal
        setSelectedProposal(proposal)
        setIsEditorOpen(true)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', response.status, errorData)
        alert(`Failed to create proposal: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating proposal:', error)
      alert(`Failed to create proposal: ${error instanceof Error ? error.message : 'Network error'}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteProposal = async (proposalId: string) => {
    if (!confirm('Are you sure you want to delete this proposal?')) return

    try {
      const response = await fetch(
        `/api/proposals?proposalId=${proposalId}&workspaceId=${workspaceId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        setProposals(proposals.filter((p) => p.id !== proposalId))
        if (selectedProposal?.id === proposalId) {
          setSelectedProposal(null)
          setIsEditorOpen(false)
        }
      }
    } catch (error) {
      console.error('Error deleting proposal:', error)
    }
  }

  const handleProposalUpdate = (updatedProposal: Proposal) => {
    setProposals(proposals.map((p) => (p.id === updatedProposal.id ? updatedProposal : p)))
    setSelectedProposal(updatedProposal)
  }

  const filteredProposals = statusFilter === 'all'
    ? proposals
    : proposals.filter((p) => p.status === statusFilter)

  // Stats
  const stats = {
    total: proposals.length,
    inProgress: proposals.filter((p) => ['draft', 'in_progress'].includes(p.status)).length,
    inReview: proposals.filter((p) => ['internal_review', 'final_review'].includes(p.status)).length,
    submitted: proposals.filter((p) => p.status === 'submitted').length,
  }

  if (isEditorOpen && selectedProposal) {
    return (
      <ProposalEditor
        workspaceId={workspaceId}
        proposal={selectedProposal}
        onClose={() => {
          setIsEditorOpen(false)
          setSelectedProposal(null)
        }}
        onUpdate={handleProposalUpdate}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.total}</p>
              <p className="text-xs text-zinc-400">Total Proposals</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Edit className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.inProgress}</p>
              <p className="text-xs text-zinc-400">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.inReview}</p>
              <p className="text-xs text-zinc-400">In Review</p>
            </div>
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-zinc-100">{stats.submitted}</p>
              <p className="text-xs text-zinc-400">Submitted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-300"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          <Link href={`/workspace/${workspaceId}/proposals/templates`}>
            <Button variant="outline" className="gap-2 border-zinc-700 hover:bg-zinc-800">
              <FileStack className="w-4 h-4" />
              Templates
            </Button>
          </Link>
        </div>

        {/* Two creation options: Quick Create and Guided Wizard */}
        <div className="flex gap-2">
          <Button
            onClick={() => setIsWizardOpen(true)}
            className="gap-2 bg-amber-600 hover:bg-amber-700"
          >
            <Wand2 className="w-4 h-4" />
            Guided Setup
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-zinc-700 hover:bg-zinc-800">
                <Zap className="w-4 h-4" />
                Quick Create
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Create New Proposal
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Proposal Title *
                </label>
                <Input
                  value={newProposal.title}
                  onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
                  placeholder="e.g., DYCD Summer Youth Employment Program 2025"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Funder Name
                  </label>
                  <Input
                    value={newProposal.funder_name}
                    onChange={(e) => setNewProposal({ ...newProposal, funder_name: e.target.value })}
                    placeholder="e.g., DYCD, DOE, Ford Foundation"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Requested Amount
                  </label>
                  <Input
                    type="number"
                    value={newProposal.requested_amount}
                    onChange={(e) => setNewProposal({ ...newProposal, requested_amount: e.target.value })}
                    placeholder="500000"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>

              {rfps.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">
                    Link to RFP (optional)
                  </label>
                  <select
                    value={newProposal.rfpId}
                    onChange={(e) => setNewProposal({ ...newProposal, rfpId: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-300"
                  >
                    <option value="">No linked RFP</option>
                    {rfps.map((rfp) => (
                      <option key={rfp.id} value={rfp.id}>
                        {rfp.title} ({rfp.agency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">
                  Start from Template
                </label>
                <select
                  value={newProposal.templateId}
                  onChange={(e) => setNewProposal({ ...newProposal, templateId: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-300"
                >
                  <option value="">Select a template...</option>
                  {allTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                {newProposal.templateId && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {allTemplates.find((t) => t.id === newProposal.templateId)?.description}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProposal}
                  disabled={!newProposal.title.trim() || isCreating}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Create & Start Writing
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Proposal Creation Wizard */}
      <ProposalWizard
        workspaceId={workspaceId}
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onProposalCreated={handleWizardProposalCreated}
        rfps={rfps}
        templates={allTemplates}
      />

      {/* Proposals List */}
      {filteredProposals.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-700 rounded-lg">
          <FileText className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400 text-lg mb-2">No proposals yet</p>
          <p className="text-zinc-500 text-sm mb-4">
            Create your first proposal to start winning grants with AI
          </p>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-amber-600 hover:bg-amber-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Proposal
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProposals.map((proposal) => {
            const statusConfig = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.draft
            const StatusIcon = statusConfig.icon

            return (
              <div
                key={proposal.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedProposal(proposal)
                  setIsEditorOpen(true)
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-zinc-100 truncate">
                        {proposal.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      {proposal.funder_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {proposal.funder_name}
                        </span>
                      )}
                      {proposal.requested_amount && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${proposal.requested_amount.toLocaleString()}
                        </span>
                      )}
                      {proposal.submission_deadline && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Calendar className="w-3 h-3" />
                          Due {format(new Date(proposal.submission_deadline), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-500 mt-2">
                      Updated {formatDistanceToNow(new Date(proposal.updated_at), { addSuffix: true })}
                      {proposal.template && ` • ${proposal.template.name}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700"
                      onClick={() => {
                        setSelectedProposal(proposal)
                        setIsEditorOpen(true)
                      }}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <button
                      onClick={() => handleDeleteProposal(proposal.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
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

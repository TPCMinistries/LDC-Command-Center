'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Users,
  Settings,
  Check,
  Loader2,
  Sparkles,
  Calendar,
  Building2,
  Target,
  Handshake,
} from 'lucide-react'
import { format } from 'date-fns'

interface RFPItem {
  id: string
  title: string
  agency?: string
  response_deadline?: string
  source_type?: string
}

interface Template {
  id: string
  name: string
  category: string
  description?: string
}

interface Partner {
  id: string
  organization_name: string
  primary_contact_name?: string
}

interface ProposalWizardProps {
  workspaceId: string
  isOpen: boolean
  onClose: () => void
  onProposalCreated: (proposal: unknown) => void
  rfps: RFPItem[]
  templates: Template[]
  partners?: Partner[]
}

const STEPS = [
  { id: 'rfp', title: 'Select RFP', icon: FileText },
  { id: 'template', title: 'Choose Template', icon: Settings },
  { id: 'details', title: 'Basic Details', icon: Target },
  { id: 'partners', title: 'Partners', icon: Handshake },
  { id: 'review', title: 'Review & Create', icon: Check },
]

const DEFAULT_TEMPLATES = [
  { id: 'default-federal', name: 'Federal Grant Template', category: 'federal', description: 'Standard template for federal grant applications' },
  { id: 'default-city', name: 'NYC City Agency Template', category: 'city', description: 'Template for DYCD, DOE, HHS, etc.' },
  { id: 'default-foundation', name: 'Foundation Grant Template', category: 'foundation', description: 'Template for private foundation applications' },
  { id: 'default-general', name: 'General Proposal Template', category: 'general', description: 'Flexible template for various grant types' },
]

export function ProposalWizard({
  workspaceId,
  isOpen,
  onClose,
  onProposalCreated,
  rfps,
  templates,
  partners = [],
}: ProposalWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isCreating, setIsCreating] = useState(false)

  // Wizard state
  const [selectedRfpId, setSelectedRfpId] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default-general')
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    title: '',
    funderName: '',
    grantProgram: '',
    requestedAmount: '',
    targetDeadline: '',
    targetPopulation: '',
    serviceArea: '',
    notes: '',
  })

  const allTemplates = templates.length > 0 ? templates : DEFAULT_TEMPLATES
  const selectedRfp = rfps.find(r => r.id === selectedRfpId)
  const selectedTemplate = allTemplates.find(t => t.id === selectedTemplateId)

  // Pre-fill form when RFP is selected
  useEffect(() => {
    if (selectedRfp) {
      setFormData(prev => ({
        ...prev,
        title: prev.title || `${selectedRfp.title} Proposal`,
        funderName: prev.funderName || selectedRfp.agency || '',
        targetDeadline: prev.targetDeadline || selectedRfp.response_deadline || '',
      }))

      // Auto-suggest template based on RFP source type
      if (selectedRfp.source_type === 'sam_gov') {
        setSelectedTemplateId('default-federal')
      } else if (selectedRfp.source_type === 'city_state') {
        setSelectedTemplateId('default-city')
      } else if (selectedRfp.source_type === 'foundation') {
        setSelectedTemplateId('default-foundation')
      }
    }
  }, [selectedRfp])

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a proposal title')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          title: formData.title,
          funder_name: formData.funderName || null,
          grant_program: formData.grantProgram || null,
          requested_amount: formData.requestedAmount ? parseFloat(formData.requestedAmount) : null,
          target_deadline: formData.targetDeadline || null,
          target_population: formData.targetPopulation || null,
          service_area: formData.serviceArea || null,
          notes: formData.notes || null,
          templateId: selectedTemplateId,
          rfpId: selectedRfpId,
        }),
      })

      if (response.ok) {
        const { proposal } = await response.json()
        onProposalCreated(proposal)
        handleClose()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create proposal')
      }
    } catch (error) {
      console.error('Error creating proposal:', error)
      alert('Failed to create proposal')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setCurrentStep(0)
    setSelectedRfpId(null)
    setSelectedTemplateId('default-general')
    setSelectedPartnerIds([])
    setFormData({
      title: '',
      funderName: '',
      grantProgram: '',
      requestedAmount: '',
      targetDeadline: '',
      targetPopulation: '',
      serviceArea: '',
      notes: '',
    })
    onClose()
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: // RFP - optional
        return true
      case 1: // Template - required
        return !!selectedTemplateId
      case 2: // Details - title required
        return !!formData.title.trim()
      case 3: // Partners - optional
        return true
      case 4: // Review
        return true
      default:
        return false
    }
  }

  const togglePartner = (partnerId: string) => {
    setSelectedPartnerIds(prev =>
      prev.includes(partnerId)
        ? prev.filter(id => id !== partnerId)
        : [...prev, partnerId]
    )
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0: // RFP Selection
        return (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Link your proposal to an existing RFP opportunity, or skip to create a standalone proposal.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => setSelectedRfpId(null)}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  selectedRfpId === null
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <p className="font-medium text-zinc-200">No RFP (Standalone Proposal)</p>
                <p className="text-sm text-zinc-400">Create a proposal without linking to an RFP</p>
              </button>

              {rfps.map(rfp => (
                <button
                  key={rfp.id}
                  onClick={() => setSelectedRfpId(rfp.id)}
                  className={`w-full p-4 rounded-lg border text-left transition-colors ${
                    selectedRfpId === rfp.id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-zinc-200">{rfp.title}</p>
                      {rfp.agency && (
                        <p className="text-sm text-zinc-400">{rfp.agency}</p>
                      )}
                    </div>
                    {rfp.response_deadline && (
                      <span className="text-xs text-zinc-500">
                        Due: {format(new Date(rfp.response_deadline), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )

      case 1: // Template Selection
        return (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Choose a template to structure your proposal. Templates include pre-defined sections and word limits.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {allTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    selectedTemplateId === template.id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <p className="font-medium text-zinc-200">{template.name}</p>
                  {template.description && (
                    <p className="text-xs text-zinc-400 mt-1">{template.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )

      case 2: // Basic Details
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Proposal Title *</Label>
              <Input
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Youth Workforce Development Program 2024"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Funder Name</Label>
                <Input
                  value={formData.funderName}
                  onChange={e => setFormData({ ...formData, funderName: e.target.value })}
                  placeholder="e.g., DYCD, DOE, Ford Foundation"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Grant Program</Label>
                <Input
                  value={formData.grantProgram}
                  onChange={e => setFormData({ ...formData, grantProgram: e.target.value })}
                  placeholder="e.g., Summer Youth Employment"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Requested Amount</Label>
                <Input
                  type="number"
                  value={formData.requestedAmount}
                  onChange={e => setFormData({ ...formData, requestedAmount: e.target.value })}
                  placeholder="250000"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Target Deadline</Label>
                <Input
                  type="date"
                  value={formData.targetDeadline}
                  onChange={e => setFormData({ ...formData, targetDeadline: e.target.value })}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">Target Population</Label>
                <Input
                  value={formData.targetPopulation}
                  onChange={e => setFormData({ ...formData, targetPopulation: e.target.value })}
                  placeholder="e.g., Youth ages 14-24"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Service Area</Label>
                <Input
                  value={formData.serviceArea}
                  onChange={e => setFormData({ ...formData, serviceArea: e.target.value })}
                  placeholder="e.g., South Bronx, NYC"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
            </div>
          </div>
        )

      case 3: // Partners
        return (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Select coalition partners to include in this proposal. Partner information will be available when writing.
            </p>

            {partners.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No partners found in your workspace.</p>
                <p className="text-xs text-zinc-500 mt-1">You can add partners later or skip this step.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {partners.map(partner => (
                  <button
                    key={partner.id}
                    onClick={() => togglePartner(partner.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedPartnerIds.includes(partner.id)
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        selectedPartnerIds.includes(partner.id)
                          ? 'bg-amber-500 border-amber-500'
                          : 'border-zinc-600'
                      }`}>
                        {selectedPartnerIds.includes(partner.id) && (
                          <Check className="h-3 w-3 text-zinc-900" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-200">{partner.organization_name}</p>
                        {partner.primary_contact_name && (
                          <p className="text-xs text-zinc-400">{partner.primary_contact_name}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )

      case 4: // Review
        return (
          <div className="space-y-4">
            <Card className="bg-zinc-800/50 border-zinc-700">
              <CardContent className="pt-4 space-y-3">
                <div>
                  <p className="text-xs text-zinc-500">Title</p>
                  <p className="text-zinc-200">{formData.title || 'Untitled Proposal'}</p>
                </div>

                {selectedRfp && (
                  <div>
                    <p className="text-xs text-zinc-500">Linked RFP</p>
                    <p className="text-zinc-200">{selectedRfp.title}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-zinc-500">Template</p>
                  <p className="text-zinc-200">{selectedTemplate?.name || 'General'}</p>
                </div>

                {formData.funderName && (
                  <div>
                    <p className="text-xs text-zinc-500">Funder</p>
                    <p className="text-zinc-200">{formData.funderName}</p>
                  </div>
                )}

                {formData.requestedAmount && (
                  <div>
                    <p className="text-xs text-zinc-500">Requested Amount</p>
                    <p className="text-zinc-200">${parseInt(formData.requestedAmount).toLocaleString()}</p>
                  </div>
                )}

                {formData.targetDeadline && (
                  <div>
                    <p className="text-xs text-zinc-500">Target Deadline</p>
                    <p className="text-zinc-200">{format(new Date(formData.targetDeadline), 'MMMM d, yyyy')}</p>
                  </div>
                )}

                {selectedPartnerIds.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500">Partners ({selectedPartnerIds.length})</p>
                    <p className="text-zinc-200">
                      {selectedPartnerIds.map(id => partners.find(p => p.id === id)?.organization_name).join(', ')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Ready to Create</span>
              </div>
              <p className="text-xs text-zinc-400">
                Your proposal will be created with {selectedTemplate?.name || 'default'} sections.
                You can edit sections and use AI assistance after creation.
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Create New Proposal</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Follow the steps to set up your proposal with the right template and context.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isComplete = index < currentStep

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isComplete
                        ? 'bg-amber-500 text-zinc-900'
                        : isActive
                          ? 'bg-amber-500/20 text-amber-500 border-2 border-amber-500'
                          : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'text-amber-500' : 'text-zinc-500'}`}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${isComplete ? 'bg-amber-500' : 'bg-zinc-700'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {renderStep()}
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-6 pt-4 border-t border-zinc-800">
          <Button
            variant="ghost"
            onClick={currentStep === 0 ? handleClose : handleBack}
            className="text-zinc-400"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep === STEPS.length - 1 ? (
            <Button
              onClick={handleCreate}
              disabled={isCreating || !canProceed()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Proposal
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

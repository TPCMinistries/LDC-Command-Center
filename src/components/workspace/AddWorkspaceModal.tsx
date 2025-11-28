'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Building2,
  Briefcase,
  Heart,
  TrendingUp,
  GraduationCap,
  Church,
  User,
  Rocket,
  Building,
  MoreHorizontal,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  OrganizationType,
  BrandProfile,
  ORGANIZATION_PRESETS,
} from '@/types/brand'

interface AddWorkspaceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (workspaceId: string) => void
}

const ORG_TYPES: {
  type: OrganizationType
  label: string
  description: string
  icon: typeof Building2
}[] = [
  {
    type: 'nonprofit',
    label: 'Nonprofit',
    description: 'Mission-driven organization serving communities',
    icon: Heart,
  },
  {
    type: 'fund',
    label: 'Investment Fund',
    description: 'Capital fund, VC, or financial entity',
    icon: TrendingUp,
  },
  {
    type: 'consulting',
    label: 'Consulting',
    description: 'Professional services or advisory firm',
    icon: Briefcase,
  },
  {
    type: 'ministry',
    label: 'Ministry',
    description: 'Church, faith-based organization',
    icon: Church,
  },
  {
    type: 'agency',
    label: 'Agency',
    description: 'Creative, marketing, or service agency',
    icon: Building2,
  },
  {
    type: 'startup',
    label: 'Startup',
    description: 'Early-stage company or venture',
    icon: Rocket,
  },
  {
    type: 'enterprise',
    label: 'Enterprise',
    description: 'Established corporation or large business',
    icon: Building,
  },
  {
    type: 'personal',
    label: 'Personal Brand',
    description: 'Individual thought leader or creator',
    icon: User,
  },
  {
    type: 'other',
    label: 'Other',
    description: "Custom organization that doesn't fit above",
    icon: MoreHorizontal,
  },
]

type Step = 'basics' | 'type' | 'identity' | 'voice'

export function AddWorkspaceModal({
  isOpen,
  onClose,
  onSuccess,
}: AddWorkspaceModalProps) {
  const [step, setStep] = useState<Step>('basics')
  const [isCreating, setIsCreating] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [orgType, setOrgType] = useState<OrganizationType | null>(null)
  const [mission, setMission] = useState('')
  const [tagline, setTagline] = useState('')
  const [primaryAudience, setPrimaryAudience] = useState('')
  const [keyThemes, setKeyThemes] = useState('')

  const resetForm = () => {
    setStep('basics')
    setName('')
    setDescription('')
    setOrgType(null)
    setMission('')
    setTagline('')
    setPrimaryAudience('')
    setKeyThemes('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const canProceed = () => {
    switch (step) {
      case 'basics':
        return name.trim().length >= 2
      case 'type':
        return orgType !== null
      case 'identity':
        return true // Optional step
      case 'voice':
        return true // Optional step
      default:
        return false
    }
  }

  const nextStep = () => {
    switch (step) {
      case 'basics':
        setStep('type')
        break
      case 'type':
        setStep('identity')
        break
      case 'identity':
        setStep('voice')
        break
    }
  }

  const prevStep = () => {
    switch (step) {
      case 'type':
        setStep('basics')
        break
      case 'identity':
        setStep('type')
        break
      case 'voice':
        setStep('identity')
        break
    }
  }

  const createWorkspace = async () => {
    if (!name.trim() || !orgType) return

    setIsCreating(true)

    try {
      // Build brand profile
      const preset = ORGANIZATION_PRESETS[orgType]
      const brandProfile: BrandProfile = {
        profile_complete: Boolean(mission || tagline || primaryAudience),
        organization_type: orgType,
        identity: {
          mission: mission || undefined,
          tagline: tagline || undefined,
        },
        audience: {
          primary: primaryAudience || undefined,
        },
        messaging: {
          key_themes: keyThemes
            ? keyThemes.split(',').map((t) => t.trim()).filter(Boolean)
            : undefined,
        },
        voice: preset.voice,
        language: preset.language,
        content_preferences: preset.content_preferences,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          type: orgType === 'personal' ? 'personal' : 'organization',
          branding: brandProfile,
          settings: {
            modules: ['all'], // Enable all modules by default
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create workspace')
      }

      const data = await response.json()

      toast.success('Workspace created!', {
        description: `${name} is ready to use.`,
      })

      handleClose()
      onSuccess(data.workspace.id)
    } catch (error) {
      toast.error('Failed to create workspace', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {step === 'basics' && 'Create New Workspace'}
            {step === 'type' && 'What type of organization?'}
            {step === 'identity' && 'Define Your Identity'}
            {step === 'voice' && 'Review & Create'}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mb-6">
            {['basics', 'type', 'identity', 'voice'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === s
                      ? 'bg-amber-600 text-white'
                      : ['basics', 'type', 'identity', 'voice'].indexOf(step) > i
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {['basics', 'type', 'identity', 'voice'].indexOf(step) > i ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && (
                  <div
                    className={`w-12 h-0.5 ${
                      ['basics', 'type', 'identity', 'voice'].indexOf(step) > i
                        ? 'bg-green-600'
                        : 'bg-zinc-800'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step: Basics */}
          {step === 'basics' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., IHA Foundation, DeepFutures Capital"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this workspace"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step: Organization Type */}
          {step === 'type' && (
            <div className="grid grid-cols-3 gap-3">
              {ORG_TYPES.map((org) => {
                const Icon = org.icon
                const isSelected = orgType === org.type

                return (
                  <Card
                    key={org.type}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-600/20 border-amber-500'
                        : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                    }`}
                    onClick={() => setOrgType(org.type)}
                  >
                    <CardContent className="p-4 text-center">
                      <Icon
                        className={`h-8 w-8 mx-auto mb-2 ${
                          isSelected ? 'text-amber-400' : 'text-zinc-400'
                        }`}
                      />
                      <p
                        className={`font-medium text-sm ${
                          isSelected ? 'text-amber-400' : 'text-zinc-200'
                        }`}
                      >
                        {org.label}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {org.description}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Step: Identity */}
          {step === 'identity' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400 mb-4">
                These help the AI understand your brand voice. You can skip and
                fill these in later.
              </p>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Mission Statement
                </label>
                <textarea
                  value={mission}
                  onChange={(e) => setMission(e.target.value)}
                  placeholder="What is your organization's mission?"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Tagline
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="A memorable phrase that captures your essence"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Primary Audience
                </label>
                <input
                  type="text"
                  value={primaryAudience}
                  onChange={(e) => setPrimaryAudience(e.target.value)}
                  placeholder="Who do you primarily serve or communicate with?"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Key Themes (comma-separated)
                </label>
                <input
                  type="text"
                  value={keyThemes}
                  onChange={(e) => setKeyThemes(e.target.value)}
                  placeholder="e.g., innovation, community, empowerment"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === 'voice' && orgType && (
            <div className="space-y-4">
              <div className="bg-zinc-800 rounded-lg p-4">
                <h3 className="font-medium text-zinc-100 mb-3">
                  Workspace Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Name:</span>
                    <span className="text-zinc-200">{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Type:</span>
                    <span className="text-zinc-200">
                      {ORG_TYPES.find((o) => o.type === orgType)?.label}
                    </span>
                  </div>
                  {mission && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Mission:</span>
                      <span className="text-zinc-200 text-right max-w-[60%]">
                        {mission}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4">
                <h3 className="font-medium text-amber-400 mb-3">
                  AI Voice Settings (based on {orgType})
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Tone:</span>
                    <span className="text-zinc-200">
                      {ORGANIZATION_PRESETS[orgType].voice?.tone}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Personality:</span>
                    <span className="text-zinc-200">
                      {ORGANIZATION_PRESETS[orgType].voice?.personality?.join(
                        ', '
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Style:</span>
                    <span className="text-zinc-200">
                      {ORGANIZATION_PRESETS[orgType].voice?.communication_style}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-3">
                  You can customize these settings later in workspace settings.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={step === 'basics' ? handleClose : prevStep}
            className="border-zinc-700"
          >
            {step === 'basics' ? (
              'Cancel'
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {step === 'voice' ? (
            <Button
              onClick={createWorkspace}
              disabled={isCreating}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Workspace
                  <Check className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

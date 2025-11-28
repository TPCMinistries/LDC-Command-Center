'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Building2,
  Heart,
  TrendingUp,
  Briefcase,
  Church,
  User,
  Rocket,
  Loader2,
  Save,
  Sparkles,
  Users,
  MessageSquare,
  BookOpen,
  Palette,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BrandProfile,
  OrganizationType,
  VoiceTone,
  CommunicationStyle,
  JargonLevel,
  CTAStyle,
  ORGANIZATION_PRESETS,
} from '@/types/brand'

interface BrandProfileEditorProps {
  workspaceId: string
  workspaceName: string
  initialBranding: Partial<BrandProfile>
  onBrandingChange?: (branding: Partial<BrandProfile>) => void
}

const ORG_TYPES: { type: OrganizationType; label: string; icon: typeof Building2 }[] = [
  { type: 'nonprofit', label: 'Nonprofit', icon: Heart },
  { type: 'fund', label: 'Investment Fund', icon: TrendingUp },
  { type: 'consulting', label: 'Consulting', icon: Briefcase },
  { type: 'ministry', label: 'Ministry', icon: Church },
  { type: 'personal', label: 'Personal Brand', icon: User },
  { type: 'agency', label: 'Agency', icon: Building2 },
  { type: 'startup', label: 'Startup', icon: Rocket },
  { type: 'enterprise', label: 'Enterprise', icon: Building2 },
]

const VOICE_TONES: { value: VoiceTone; label: string }[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'professional', label: 'Professional' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'casual', label: 'Casual' },
  { value: 'inspirational', label: 'Inspirational' },
]

const COMMUNICATION_STYLES: { value: CommunicationStyle; label: string }[] = [
  { value: 'direct', label: 'Direct & Clear' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'educational', label: 'Educational' },
  { value: 'motivational', label: 'Motivational' },
]

const JARGON_LEVELS: { value: JargonLevel; label: string }[] = [
  { value: 'none', label: 'No jargon - Plain language only' },
  { value: 'minimal', label: 'Minimal - Explain when used' },
  { value: 'industry-standard', label: 'Industry Standard' },
  { value: 'technical', label: 'Technical - Assume expertise' },
]

const CTA_STYLES: { value: CTAStyle; label: string }[] = [
  { value: 'soft', label: 'Soft - Gentle suggestions' },
  { value: 'medium', label: 'Medium - Clear invitations' },
  { value: 'urgent', label: 'Urgent - Strong calls to action' },
]

const PERSONALITY_OPTIONS = [
  'Authoritative', 'Friendly', 'Bold', 'Compassionate', 'Innovative',
  'Trustworthy', 'Energetic', 'Thoughtful', 'Warm', 'Expert',
  'Approachable', 'Inspiring', 'Data-driven', 'Creative', 'Authentic',
  'Community-focused', 'Action-oriented', 'Hopeful', 'Strategic', 'Empowering',
]

type TabId = 'identity' | 'audience' | 'voice' | 'language' | 'content'

export function BrandProfileEditor({
  workspaceId,
  workspaceName,
  initialBranding,
  onBrandingChange,
}: BrandProfileEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('identity')
  const [isSaving, setIsSaving] = useState(false)
  const [branding, setBranding] = useState<Partial<BrandProfile>>(initialBranding)

  // Sync state when initialBranding changes from parent (e.g., Voice Coach updates)
  useEffect(() => {
    setBranding(initialBranding)
  }, [initialBranding])

  const updateNestedBranding = <
    K extends keyof BrandProfile
  >(
    key: K,
    nestedKey: string,
    value: unknown
  ) => {
    setBranding(prev => ({
      ...prev,
      [key]: {
        ...((prev[key] as Record<string, unknown>) || {}),
        [nestedKey]: value,
      },
    }))
  }

  const applyPreset = (orgType: OrganizationType) => {
    const preset = ORGANIZATION_PRESETS[orgType]
    setBranding(prev => ({
      ...prev,
      organization_type: orgType,
      voice: { ...(prev.voice || {}), ...preset.voice },
      language: { ...(prev.language || {}), ...preset.language },
      content_preferences: { ...(prev.content_preferences || {}), ...preset.content_preferences },
    }))
    toast.success('Applied ' + orgType + ' preset', {
      description: 'Voice settings updated based on organization type',
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/workspaces/' + workspaceId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branding: {
            ...branding,
            profile_complete: true,
            updated_at: new Date().toISOString(),
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      const updatedBranding = {
        ...branding,
        profile_complete: true,
        updated_at: new Date().toISOString(),
      }

      // Notify parent of the update
      if (onBrandingChange) {
        onBrandingChange(updatedBranding)
      }

      toast.success('Brand profile saved!', {
        description: 'Your brand voice settings have been updated.',
      })
    } catch {
      toast.error('Failed to save', {
        description: 'Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const tabs: { id: TabId; label: string; icon: typeof Sparkles }[] = [
    { id: 'identity', label: 'Identity', icon: Sparkles },
    { id: 'audience', label: 'Audience', icon: Users },
    { id: 'voice', label: 'Voice & Tone', icon: MessageSquare },
    { id: 'language', label: 'Language', icon: BookOpen },
    { id: 'content', label: 'Content', icon: Palette },
  ]

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Brand Voice for {workspaceName}
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Configure how AI generates content for this workspace
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </CardHeader>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ' + (
                activeTab === tab.id
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Identity Tab */}
      {activeTab === 'identity' && (
        <div className="space-y-6">
          {/* Organization Type */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Organization Type</CardTitle>
              <CardDescription>Select your organization type to apply voice presets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {ORG_TYPES.map(org => {
                  const Icon = org.icon
                  const isSelected = branding.organization_type === org.type
                  return (
                    <button
                      key={org.type}
                      onClick={() => applyPreset(org.type)}
                      className={'p-3 rounded-lg border text-center transition-all ' + (
                        isSelected
                          ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      )}
                    >
                      <Icon className="h-6 w-6 mx-auto mb-1" />
                      <span className="text-xs">{org.label}</span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Mission & Vision */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Mission & Vision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Mission Statement
                </label>
                <textarea
                  value={(branding.identity as Record<string, string>)?.mission || ''}
                  onChange={e => updateNestedBranding('identity', 'mission', e.target.value)}
                  placeholder="What is your organization's core purpose?"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Vision Statement
                </label>
                <textarea
                  value={(branding.identity as Record<string, string>)?.vision || ''}
                  onChange={e => updateNestedBranding('identity', 'vision', e.target.value)}
                  placeholder="What future are you working toward?"
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
                  value={(branding.identity as Record<string, string>)?.tagline || ''}
                  onChange={e => updateNestedBranding('identity', 'tagline', e.target.value)}
                  placeholder="A memorable phrase that captures your essence"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Elevator Pitch
                </label>
                <textarea
                  value={(branding.identity as Record<string, string>)?.elevator_pitch || ''}
                  onChange={e => updateNestedBranding('identity', 'elevator_pitch', e.target.value)}
                  placeholder="30-second description of what you do"
                  rows={3}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audience Tab */}
      {activeTab === 'audience' && (
        <div className="space-y-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Target Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Primary Audience
                </label>
                <input
                  type="text"
                  value={(branding.audience as Record<string, unknown>)?.primary as string || ''}
                  onChange={e => updateNestedBranding('audience', 'primary', e.target.value)}
                  placeholder="Who do you primarily serve or communicate with?"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Secondary Audiences (comma-separated)
                </label>
                <input
                  type="text"
                  value={((branding.audience as Record<string, unknown>)?.secondary as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('audience', 'secondary', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Other groups you communicate with"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Their Pain Points (comma-separated)
                </label>
                <textarea
                  value={((branding.audience as Record<string, unknown>)?.pain_points as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('audience', 'pain_points', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="What problems or challenges do they face?"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Their Aspirations (comma-separated)
                </label>
                <textarea
                  value={((branding.audience as Record<string, unknown>)?.aspirations as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('audience', 'aspirations', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="What do they want to achieve?"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Voice Tab */}
      {activeTab === 'voice' && (
        <div className="space-y-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Voice & Tone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Primary Tone
                </label>
                <div className="flex flex-wrap gap-2">
                  {VOICE_TONES.map(tone => (
                    <button
                      key={tone.value}
                      onClick={() => updateNestedBranding('voice', 'tone', tone.value)}
                      className={'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' + (
                        (branding.voice as Record<string, unknown>)?.tone === tone.value
                          ? 'bg-amber-600 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      )}
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Communication Style
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMUNICATION_STYLES.map(style => (
                    <button
                      key={style.value}
                      onClick={() => updateNestedBranding('voice', 'communication_style', style.value)}
                      className={'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' + (
                        (branding.voice as Record<string, unknown>)?.communication_style === style.value
                          ? 'bg-amber-600 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      )}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Brand Personality (select all that apply)
                </label>
                <div className="flex flex-wrap gap-2">
                  {PERSONALITY_OPTIONS.map(trait => {
                    const personality = ((branding.voice as Record<string, unknown>)?.personality as string[]) || []
                    const isSelected = personality.includes(trait)
                    return (
                      <button
                        key={trait}
                        onClick={() => {
                          const updated = isSelected
                            ? personality.filter(t => t !== trait)
                            : [...personality, trait]
                          updateNestedBranding('voice', 'personality', updated)
                        }}
                        className={'px-3 py-1.5 rounded-full text-sm transition-colors ' + (
                          isSelected
                            ? 'bg-amber-600/20 text-amber-400 border border-amber-500'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                        )}
                      >
                        {trait}
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Language Tab */}
      {activeTab === 'language' && (
        <div className="space-y-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Language Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Jargon Level
                </label>
                <div className="space-y-2">
                  {JARGON_LEVELS.map(level => (
                    <button
                      key={level.value}
                      onClick={() => updateNestedBranding('language', 'jargon_level', level.value)}
                      className={'w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ' + (
                        (branding.language as Record<string, unknown>)?.jargon_level === level.value
                          ? 'bg-amber-600/20 text-amber-400 border border-amber-500'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600'
                      )}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Words/Phrases to USE (comma-separated)
                </label>
                <textarea
                  value={((branding.language as Record<string, unknown>)?.words_to_use as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('language', 'words_to_use', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Terms you want the AI to use, e.g., community, impact, transformation"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Words/Phrases to AVOID (comma-separated)
                </label>
                <textarea
                  value={((branding.language as Record<string, unknown>)?.words_to_avoid as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('language', 'words_to_avoid', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Terms to never use, e.g., synergy, leverage, pivot"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Signature Phrases (comma-separated)
                </label>
                <textarea
                  value={((branding.language as Record<string, unknown>)?.example_phrases as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('language', 'example_phrases', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Phrases unique to your brand voice"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Content Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-3">
                  Call-to-Action Style
                </label>
                <div className="space-y-2">
                  {CTA_STYLES.map(style => (
                    <button
                      key={style.value}
                      onClick={() => updateNestedBranding('content_preferences', 'call_to_action_style', style.value)}
                      className={'w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ' + (
                        (branding.content_preferences as Record<string, unknown>)?.call_to_action_style === style.value
                          ? 'bg-amber-600/20 text-amber-400 border border-amber-500'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600'
                      )}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Key Themes (comma-separated)
                </label>
                <textarea
                  value={((branding.messaging as Record<string, unknown>)?.key_themes as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('messaging', 'key_themes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Recurring themes in your content, e.g., innovation, empowerment, sustainability"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Value Propositions (comma-separated)
                </label>
                <textarea
                  value={((branding.messaging as Record<string, unknown>)?.value_propositions as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('messaging', 'value_propositions', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="What you offer or promise to your audience"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Differentiators (comma-separated)
                </label>
                <textarea
                  value={((branding.messaging as Record<string, unknown>)?.differentiators as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('messaging', 'differentiators', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="What makes you unique or different"
                  rows={2}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Preferred Hashtags (comma-separated)
                </label>
                <input
                  type="text"
                  value={((branding.content_preferences as Record<string, unknown>)?.hashtag_strategy as string[] || []).join(', ')}
                  onChange={e => updateNestedBranding('content_preferences', 'hashtag_strategy', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="#YourBrand, #YourCause, #YourIndustry"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

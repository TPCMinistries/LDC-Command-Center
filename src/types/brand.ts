// Brand Profile Types

export type OrganizationType =
  | 'nonprofit'
  | 'fund'
  | 'consulting'
  | 'ministry'
  | 'personal'
  | 'agency'
  | 'startup'
  | 'enterprise'
  | 'other'

export type VoiceTone =
  | 'formal'
  | 'professional'
  | 'conversational'
  | 'casual'
  | 'inspirational'

export type CommunicationStyle =
  | 'direct'
  | 'storytelling'
  | 'educational'
  | 'motivational'

export type JargonLevel =
  | 'none'
  | 'minimal'
  | 'industry-standard'
  | 'technical'

export type CTAStyle =
  | 'soft'
  | 'medium'
  | 'urgent'

export interface BrandIdentity {
  mission?: string
  vision?: string
  tagline?: string
  elevator_pitch?: string
}

export interface BrandAudience {
  primary?: string
  secondary?: string[]
  pain_points?: string[]
  aspirations?: string[]
}

export interface BrandVoice {
  tone?: VoiceTone
  personality?: string[]
  communication_style?: CommunicationStyle
}

export interface BrandMessaging {
  key_themes?: string[]
  value_propositions?: string[]
  differentiators?: string[]
  proof_points?: string[]
}

export interface BrandLanguage {
  words_to_use?: string[]
  words_to_avoid?: string[]
  jargon_level?: JargonLevel
  example_phrases?: string[]
}

export interface BrandContentPreferences {
  preferred_formats?: string[]
  content_pillars?: string[]
  call_to_action_style?: CTAStyle
  hashtag_strategy?: string[]
}

export interface BrandVisualIdentity {
  primary_color?: string
  secondary_color?: string
  logo_url?: string
  font_preference?: string
}

export interface BrandExamples {
  content_we_love?: string[]
  competitors?: string[]
  inspiration_brands?: string[]
}

export interface BrandProfile {
  profile_complete: boolean
  organization_type?: OrganizationType
  identity?: BrandIdentity
  audience?: BrandAudience
  voice?: BrandVoice
  messaging?: BrandMessaging
  language?: BrandLanguage
  content_preferences?: BrandContentPreferences
  visual_identity?: BrandVisualIdentity
  examples?: BrandExamples
  created_at?: string
  updated_at?: string
}

// Questionnaire step configuration
export interface QuestionnaireStep {
  id: string
  title: string
  description: string
  fields: QuestionnaireField[]
}

export interface QuestionnaireField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'multi-select' | 'chips' | 'color'
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
  help?: string
}

// Organization type presets with suggested defaults
export const ORGANIZATION_PRESETS: Record<OrganizationType, Partial<BrandProfile>> = {
  nonprofit: {
    voice: {
      tone: 'inspirational',
      personality: ['compassionate', 'hopeful', 'community-focused'],
      communication_style: 'storytelling',
    },
    language: {
      jargon_level: 'minimal',
    },
    content_preferences: {
      call_to_action_style: 'medium',
    },
  },
  fund: {
    voice: {
      tone: 'professional',
      personality: ['authoritative', 'data-driven', 'strategic'],
      communication_style: 'direct',
    },
    language: {
      jargon_level: 'industry-standard',
    },
    content_preferences: {
      call_to_action_style: 'soft',
    },
  },
  consulting: {
    voice: {
      tone: 'professional',
      personality: ['expert', 'helpful', 'insightful'],
      communication_style: 'educational',
    },
    language: {
      jargon_level: 'industry-standard',
    },
    content_preferences: {
      call_to_action_style: 'medium',
    },
  },
  ministry: {
    voice: {
      tone: 'inspirational',
      personality: ['warm', 'authentic', 'faith-driven'],
      communication_style: 'storytelling',
    },
    language: {
      jargon_level: 'minimal',
    },
    content_preferences: {
      call_to_action_style: 'soft',
    },
  },
  personal: {
    voice: {
      tone: 'conversational',
      personality: ['authentic', 'relatable', 'genuine'],
      communication_style: 'storytelling',
    },
    language: {
      jargon_level: 'none',
    },
    content_preferences: {
      call_to_action_style: 'soft',
    },
  },
  agency: {
    voice: {
      tone: 'professional',
      personality: ['creative', 'innovative', 'results-driven'],
      communication_style: 'direct',
    },
    language: {
      jargon_level: 'industry-standard',
    },
    content_preferences: {
      call_to_action_style: 'urgent',
    },
  },
  startup: {
    voice: {
      tone: 'conversational',
      personality: ['innovative', 'bold', 'disruptive'],
      communication_style: 'direct',
    },
    language: {
      jargon_level: 'minimal',
    },
    content_preferences: {
      call_to_action_style: 'urgent',
    },
  },
  enterprise: {
    voice: {
      tone: 'formal',
      personality: ['authoritative', 'trustworthy', 'established'],
      communication_style: 'direct',
    },
    language: {
      jargon_level: 'industry-standard',
    },
    content_preferences: {
      call_to_action_style: 'medium',
    },
  },
  other: {
    voice: {
      tone: 'professional',
      personality: ['authentic'],
      communication_style: 'direct',
    },
    language: {
      jargon_level: 'minimal',
    },
    content_preferences: {
      call_to_action_style: 'medium',
    },
  },
}

// Helper to generate AI prompt context from brand profile
export function generateBrandContext(brand: BrandProfile): string {
  const parts: string[] = []

  if (brand.organization_type) {
    parts.push(`Organization Type: ${brand.organization_type}`)
  }

  if (brand.identity?.mission) {
    parts.push(`Mission: ${brand.identity.mission}`)
  }

  if (brand.identity?.tagline) {
    parts.push(`Tagline: ${brand.identity.tagline}`)
  }

  if (brand.audience?.primary) {
    parts.push(`Primary Audience: ${brand.audience.primary}`)
  }

  if (brand.voice) {
    const voiceParts: string[] = []
    if (brand.voice.tone) voiceParts.push(`Tone: ${brand.voice.tone}`)
    if (brand.voice.personality?.length) {
      voiceParts.push(`Personality: ${brand.voice.personality.join(', ')}`)
    }
    if (brand.voice.communication_style) {
      voiceParts.push(`Style: ${brand.voice.communication_style}`)
    }
    if (voiceParts.length) {
      parts.push(`Voice & Tone: ${voiceParts.join('; ')}`)
    }
  }

  if (brand.messaging?.key_themes?.length) {
    parts.push(`Key Themes: ${brand.messaging.key_themes.join(', ')}`)
  }

  if (brand.messaging?.differentiators?.length) {
    parts.push(`Differentiators: ${brand.messaging.differentiators.join(', ')}`)
  }

  if (brand.language?.words_to_use?.length) {
    parts.push(`Preferred Terms: ${brand.language.words_to_use.join(', ')}`)
  }

  if (brand.language?.words_to_avoid?.length) {
    parts.push(`Terms to Avoid: ${brand.language.words_to_avoid.join(', ')}`)
  }

  if (brand.content_preferences?.call_to_action_style) {
    parts.push(`CTA Style: ${brand.content_preferences.call_to_action_style}`)
  }

  return parts.join('\n')
}

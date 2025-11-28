'use client'

import { useState } from 'react'
import { BrandProfileEditor } from './BrandProfileEditor'
import { BrandVoiceCoach } from './BrandVoiceCoach'
import { GoogleIntegration } from '@/components/google/GoogleIntegration'
import { BrandProfile } from '@/types/brand'

interface SettingsClientProps {
  workspaceId: string
  workspaceName: string
  initialBranding: Partial<BrandProfile>
}

export function SettingsClient({
  workspaceId,
  workspaceName,
  initialBranding,
}: SettingsClientProps) {
  const [branding, setBranding] = useState<Partial<BrandProfile>>(initialBranding)

  const handleProfileUpdate = (updated: Partial<BrandProfile>) => {
    setBranding(updated)
  }

  return (
    <div className="space-y-6">
      {/* Integrations Section */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Integrations</h2>
        <GoogleIntegration workspaceId={workspaceId} />
      </div>

      {/* Brand Voice Coach - AI-assisted discovery and refinement */}
      <BrandVoiceCoach
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        currentBranding={branding}
        onProfileUpdate={handleProfileUpdate}
      />

      {/* Manual Brand Profile Editor */}
      <BrandProfileEditor
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        initialBranding={branding}
        onBrandingChange={handleProfileUpdate}
      />
    </div>
  )
}

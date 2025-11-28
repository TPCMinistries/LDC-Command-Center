'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  ClipboardCheck,
  Target,
  Calendar,
  DollarSign,
} from 'lucide-react'

interface ExtractedRequirements {
  summary?: string
  fundingAmount?: {
    min?: number
    max?: number
    description: string
  }
  eligibility?: Array<{
    requirement: string
    isMet?: boolean
    notes?: string
  }>
  evaluationCriteria?: Array<{
    criterion: string
    weight?: number
    description: string
  }>
  requiredSections?: Array<{
    name: string
    wordLimit?: number
    pageLimit?: number
    description?: string
  }>
  keyDates?: Array<{
    event: string
    date: string
    isDeadline?: boolean
  }>
  complianceChecklist?: Array<{
    item: string
    category: 'eligibility' | 'content' | 'format' | 'submission'
    required: boolean
  }>
  fitAssessment?: {
    score: number
    strengths: string[]
    gaps: string[]
    recommendations: string[]
  }
}

interface ProposalSection {
  id: string
  section_type: string
  title: string
  content?: string
  word_count?: number
  word_limit?: number
  is_complete?: boolean
}

interface ComplianceTrackerProps {
  extractedRequirements?: ExtractedRequirements
  proposalSections?: ProposalSection[]
  onSectionClick?: (sectionType: string) => void
}

const CATEGORY_ICONS = {
  eligibility: Target,
  content: FileText,
  format: ClipboardCheck,
  submission: Calendar,
}

const CATEGORY_COLORS = {
  eligibility: 'text-blue-400',
  content: 'text-green-400',
  format: 'text-purple-400',
  submission: 'text-amber-400',
}

export function ComplianceTracker({
  extractedRequirements,
  proposalSections = [],
  onSectionClick,
}: ComplianceTrackerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    eligibility: true,
    content: true,
    format: false,
    submission: false,
  })

  // Calculate completion status for checklist items
  const checklistWithStatus = useMemo(() => {
    if (!extractedRequirements?.complianceChecklist) return []

    return extractedRequirements.complianceChecklist.map((item) => {
      // Simple heuristic: check if any section mentions this item
      const addressed = proposalSections.some((section) => {
        if (!section.content) return false
        const contentLower = section.content.toLowerCase()
        const itemKeywords = item.item.toLowerCase().split(' ').filter((w) => w.length > 4)
        return itemKeywords.some((keyword) => contentLower.includes(keyword))
      })

      return { ...item, addressed }
    })
  }, [extractedRequirements, proposalSections])

  // Group checklist by category
  const groupedChecklist = useMemo(() => {
    const groups: Record<string, typeof checklistWithStatus> = {
      eligibility: [],
      content: [],
      format: [],
      submission: [],
    }

    checklistWithStatus.forEach((item) => {
      if (groups[item.category]) {
        groups[item.category].push(item)
      }
    })

    return groups
  }, [checklistWithStatus])

  // Calculate section completion
  const sectionCompletion = useMemo(() => {
    if (!extractedRequirements?.requiredSections) return { complete: 0, total: 0 }

    const requiredSectionNames = extractedRequirements.requiredSections.map((s) =>
      s.name.toLowerCase().replace(/[^a-z]/g, '')
    )

    const addressedSections = proposalSections.filter((section) => {
      const sectionName = section.title.toLowerCase().replace(/[^a-z]/g, '')
      return (
        requiredSectionNames.some((req) => sectionName.includes(req) || req.includes(sectionName)) &&
        section.content &&
        section.content.length > 100
      )
    })

    return {
      complete: addressedSections.length,
      total: extractedRequirements.requiredSections.length,
    }
  }, [extractedRequirements, proposalSections])

  // Calculate overall compliance score
  const complianceScore = useMemo(() => {
    const requiredItems = checklistWithStatus.filter((item) => item.required)
    const addressedRequired = requiredItems.filter((item) => item.addressed)
    if (requiredItems.length === 0) return 100
    return Math.round((addressedRequired.length / requiredItems.length) * 100)
  }, [checklistWithStatus])

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  if (!extractedRequirements) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="py-8 text-center">
          <ClipboardCheck className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No RFP requirements available</p>
          <p className="text-zinc-500 text-sm mt-1">
            Link an RFP and analyze it to track compliance
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-amber-500" />
            Compliance Tracker
          </CardTitle>
          <Badge
            className={
              complianceScore >= 80
                ? 'bg-green-500/20 text-green-400'
                : complianceScore >= 50
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
            }
          >
            {complianceScore}% Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Required Items</span>
            <span className="text-zinc-300">
              {checklistWithStatus.filter((i) => i.required && i.addressed).length}/
              {checklistWithStatus.filter((i) => i.required).length}
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                complianceScore >= 80
                  ? 'bg-green-500'
                  : complianceScore >= 50
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${complianceScore}%` }}
            />
          </div>
        </div>

        {/* Required Sections Status */}
        {extractedRequirements.requiredSections && extractedRequirements.requiredSections.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Required Sections ({sectionCompletion.complete}/{sectionCompletion.total})
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {extractedRequirements.requiredSections.map((reqSection, i) => {
                const matchingSection = proposalSections.find((s) => {
                  const reqName = reqSection.name.toLowerCase().replace(/[^a-z]/g, '')
                  const secName = s.title.toLowerCase().replace(/[^a-z]/g, '')
                  return secName.includes(reqName) || reqName.includes(secName)
                })
                const hasContent = matchingSection?.content && matchingSection.content.length > 100

                return (
                  <div
                    key={i}
                    onClick={() => onSectionClick?.(matchingSection?.section_type || reqSection.name)}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      hasContent
                        ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                        : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {hasContent ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-zinc-500 shrink-0" />
                      )}
                      <span className="text-xs text-zinc-300 truncate">{reqSection.name}</span>
                    </div>
                    {reqSection.wordLimit && (
                      <div className="text-xs text-zinc-500 mt-1 ml-6">
                        {matchingSection?.word_count || 0}/{reqSection.wordLimit} words
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Compliance Checklist by Category */}
        <ScrollArea className="h-[300px] pr-2">
          <div className="space-y-3">
            {Object.entries(groupedChecklist).map(([category, items]) => {
              if (items.length === 0) return null

              const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]
              const colorClass = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]
              const isExpanded = expandedCategories[category]
              const completedCount = items.filter((i) => i.addressed).length
              const requiredCount = items.filter((i) => i.required).length

              return (
                <div key={category} className="space-y-2">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between text-sm font-medium text-zinc-300 hover:text-zinc-100"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Icon className={`h-4 w-4 ${colorClass}`} />
                      <span className="capitalize">{category}</span>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {completedCount}/{items.length}
                      {requiredCount > 0 && ` (${requiredCount} required)`}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="space-y-1 ml-6">
                      {items.map((item, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-2 p-2 rounded text-sm ${
                            item.addressed
                              ? 'bg-green-500/10 text-zinc-300'
                              : item.required
                                ? 'bg-red-500/10 text-zinc-300'
                                : 'bg-zinc-800/50 text-zinc-400'
                          }`}
                        >
                          {item.addressed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                          ) : item.required ? (
                            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                          )}
                          <span className="flex-1">{item.item}</span>
                          {item.required && !item.addressed && (
                            <Badge className="bg-red-500/20 text-red-400 text-xs">Required</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {/* Key Dates */}
        {extractedRequirements.keyDates && extractedRequirements.keyDates.length > 0 && (
          <div className="pt-3 border-t border-zinc-800">
            <h4 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              Key Dates
            </h4>
            <div className="space-y-1">
              {extractedRequirements.keyDates.slice(0, 4).map((date, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between text-xs ${
                    date.isDeadline ? 'text-amber-400' : 'text-zinc-400'
                  }`}
                >
                  <span>{date.event}</span>
                  <span className="font-mono">{date.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Funding Info */}
        {extractedRequirements.fundingAmount && (
          <div className="pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-zinc-300">{extractedRequirements.fundingAmount.description}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

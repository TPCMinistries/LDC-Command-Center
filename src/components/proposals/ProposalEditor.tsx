'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Save,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Wand2,
  MessageSquare,
  RotateCcw,
  FileText,
  Clock,
  Send,
  Lightbulb,
  HelpCircle,
  ClipboardCheck,
  PanelRightClose,
  PanelRight,
  Download,
} from 'lucide-react'
import { ExportModal } from './ExportModal'
import { getSectionQuestions, type SectionQuestions } from '@/lib/proposal-questions'
import { ComplianceTracker } from './ComplianceTracker'
import { BudgetBuilder } from './BudgetBuilder'

interface ExtractedRequirements {
  summary?: string
  fundingAmount?: { min?: number; max?: number; description: string }
  eligibility?: Array<{ requirement: string; isMet?: boolean; notes?: string }>
  evaluationCriteria?: Array<{ criterion: string; weight?: number; description: string }>
  requiredSections?: Array<{ name: string; wordLimit?: number; pageLimit?: number; description?: string }>
  keyDates?: Array<{ event: string; date: string; isDeadline?: boolean }>
  complianceChecklist?: Array<{ item: string; category: 'eligibility' | 'content' | 'format' | 'submission'; required: boolean }>
  fitAssessment?: { score: number; strengths: string[]; gaps: string[]; recommendations: string[] }
}

interface Section {
  id: string
  section_type: string
  title: string
  content: string
  word_count: number
  word_limit?: number
  is_complete: boolean
  needs_review: boolean
  ai_suggestions?: Array<{
    original: string
    issue: string
    suggestion: string
    priority: string
  }>
  sort_order: number
}

interface Proposal {
  id: string
  title: string
  funder_name?: string
  status: string
  requested_amount?: number
  submission_deadline?: string
  program_name?: string
  target_population?: string
  service_area?: string
}

interface ProposalEditorProps {
  workspaceId: string
  proposal: Proposal
  onClose: () => void
  onUpdate: (proposal: Proposal) => void
}

const SECTION_ICONS: Record<string, string> = {
  executive_summary: '📋',
  organizational_background: '🏢',
  statement_of_need: '📊',
  program_design: '🎯',
  theory_of_change: '🔄',
  logic_model: '📐',
  implementation_plan: '📅',
  staffing_plan: '👥',
  evaluation_plan: '📈',
  sustainability_plan: '🌱',
  budget_narrative: '💰',
  budget: '💵',
  timeline: '⏱️',
  cover_letter: '✉️',
  letters_of_support: '📝',
  appendices: '📎',
  custom: '📄',
}

export function ProposalEditor({ workspaceId, proposal, onClose, onUpdate }: ProposalEditorProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [activeSection, setActiveSection] = useState<Section | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAiWorking, setIsAiWorking] = useState(false)
  const [aiAction, setAiAction] = useState<string>('')
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([])
  const [showGuidance, setShowGuidance] = useState(true)
  const [extractedRequirements, setExtractedRequirements] = useState<ExtractedRequirements | undefined>()
  const [showCompliance, setShowCompliance] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [writingTone, setWritingTone] = useState<'professional' | 'conversational' | 'inspiring' | 'formal' | 'storytelling'>('professional')
  const [isWritingAll, setIsWritingAll] = useState(false)

  // Writing tone options
  const TONE_OPTIONS = [
    { value: 'professional', label: 'Professional', desc: 'Confident & credible' },
    { value: 'conversational', label: 'Conversational', desc: 'Warm & approachable' },
    { value: 'inspiring', label: 'Inspiring', desc: 'Passionate & motivating' },
    { value: 'formal', label: 'Formal', desc: 'Academic & institutional' },
    { value: 'storytelling', label: 'Storytelling', desc: 'Narrative & human' },
  ]

  // Get guidance for current section
  const sectionGuidance: SectionQuestions | undefined = activeSection
    ? getSectionQuestions(activeSection.section_type)
    : undefined

  // Fetch sections and RFP requirements
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch sections
        const sectionsRes = await fetch(`/api/proposals/sections?proposalId=${proposal.id}`)
        if (sectionsRes.ok) {
          const { sections: data } = await sectionsRes.json()
          setSections(data || [])
          if (data && data.length > 0) {
            setActiveSection(data[0])
          }
        }

        // Fetch proposal with linked RFP to get extracted requirements
        const proposalRes = await fetch(`/api/proposals?workspaceId=${workspaceId}&proposalId=${proposal.id}`)
        if (proposalRes.ok) {
          const { proposals } = await proposalRes.json()
          const fullProposal = proposals?.[0]
          if (fullProposal?.rfp?.extracted_requirements) {
            setExtractedRequirements(fullProposal.rfp.extracted_requirements)
            setShowCompliance(true) // Auto-show if requirements exist
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [proposal.id, workspaceId])

  // Save section content
  const saveSection = async (sectionId: string, content: string) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/proposals/sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          content,
        }),
      })

      if (response.ok) {
        const { section } = await response.json()
        setSections(sections.map((s) => (s.id === sectionId ? section : s)))
        if (activeSection?.id === sectionId) {
          setActiveSection(section)
        }
      }
    } catch (error) {
      console.error('Error saving section:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // AI Write action
  const handleAiWrite = async () => {
    if (!activeSection) return

    setIsAiWorking(true)
    setAiAction('write')
    try {
      const response = await fetch('/api/agents/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          proposalId: proposal.id,
          sectionId: activeSection.id,
          sectionType: activeSection.section_type,
          action: 'write',
          wordLimit: activeSection.word_limit,
          writingTone,
        }),
      })

      if (response.ok) {
        const { content } = await response.json()
        const updatedSection = { ...activeSection, content }
        setSections(sections.map((s) => (s.id === activeSection.id ? updatedSection : s)))
        setActiveSection(updatedSection)
      }
    } catch (error) {
      console.error('AI write error:', error)
    } finally {
      setIsAiWorking(false)
      setAiAction('')
    }
  }

  // Write Full Proposal - all sections at once
  const handleWriteFullProposal = async () => {
    if (sections.length === 0) return

    if (!confirm('This will generate AI content for all sections. Continue?')) return

    setIsWritingAll(true)
    try {
      const response = await fetch('/api/agents/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          proposalId: proposal.id,
          action: 'write_all',
          writingTone,
          sections: sections.map(s => ({
            id: s.id,
            section_type: s.section_type,
            title: s.title,
            word_limit: s.word_limit,
          })),
        }),
      })

      if (response.ok) {
        const { content } = await response.json()
        if (content.savedSections) {
          // Update all sections with new content
          setSections(sections.map(s => ({
            ...s,
            content: content.savedSections[s.id] || s.content,
          })))
          // Refresh the active section if it was updated
          if (activeSection && content.savedSections[activeSection.id]) {
            setActiveSection({
              ...activeSection,
              content: content.savedSections[activeSection.id],
            })
          }
          alert(`Successfully generated ${content.sectionsWritten} sections!`)
        }
      }
    } catch (error) {
      console.error('AI write all error:', error)
      alert('Failed to generate proposal. Please try again.')
    } finally {
      setIsWritingAll(false)
    }
  }

  // AI Improve action
  const handleAiImprove = async () => {
    if (!activeSection || !activeSection.content) return

    setIsAiWorking(true)
    setAiAction('improve')
    try {
      const response = await fetch('/api/agents/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          proposalId: proposal.id,
          sectionId: activeSection.id,
          sectionType: activeSection.section_type,
          action: 'improve',
          content: activeSection.content,
          wordLimit: activeSection.word_limit,
        }),
      })

      if (response.ok) {
        const { content } = await response.json()
        const updatedSection = { ...activeSection, content }
        setSections(sections.map((s) => (s.id === activeSection.id ? updatedSection : s)))
        setActiveSection(updatedSection)
      }
    } catch (error) {
      console.error('AI improve error:', error)
    } finally {
      setIsAiWorking(false)
      setAiAction('')
    }
  }

  // AI Suggest action
  const handleAiSuggest = async () => {
    if (!activeSection || !activeSection.content) return

    setIsAiWorking(true)
    setAiAction('suggest')
    try {
      const response = await fetch('/api/agents/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          proposalId: proposal.id,
          sectionId: activeSection.id,
          sectionType: activeSection.section_type,
          action: 'suggest',
          content: activeSection.content,
        }),
      })

      if (response.ok) {
        const { content } = await response.json()
        if (content.suggestions) {
          const updatedSection = { ...activeSection, ai_suggestions: content.suggestions }
          setSections(sections.map((s) => (s.id === activeSection.id ? updatedSection : s)))
          setActiveSection(updatedSection)
        }
      }
    } catch (error) {
      console.error('AI suggest error:', error)
    } finally {
      setIsAiWorking(false)
      setAiAction('')
    }
  }

  // Chat with AI
  const handleChat = async () => {
    if (!chatInput.trim()) return

    const userMessage = { role: 'user', content: chatInput }
    setChatMessages([...chatMessages, userMessage])
    setChatInput('')
    setIsAiWorking(true)

    try {
      const response = await fetch('/api/agents/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          proposalId: proposal.id,
          sectionType: activeSection?.section_type,
          action: 'chat',
          prompt: chatInput,
          content: activeSection?.content,
        }),
      })

      if (response.ok) {
        const { content } = await response.json()
        setChatMessages([...chatMessages, userMessage, { role: 'assistant', content }])
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsAiWorking(false)
    }
  }

  // Mark section complete
  const toggleSectionComplete = async (sectionId: string, isComplete: boolean) => {
    try {
      const response = await fetch('/api/proposals/sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          is_complete: isComplete,
        }),
      })

      if (response.ok) {
        setSections(sections.map((s) =>
          s.id === sectionId ? { ...s, is_complete: isComplete } : s
        ))
        if (activeSection?.id === sectionId) {
          setActiveSection({ ...activeSection, is_complete: isComplete })
        }
      }
    } catch (error) {
      console.error('Error updating section:', error)
    }
  }

  const completedCount = sections.filter((s) => s.is_complete).length
  const progress = sections.length > 0 ? (completedCount / sections.length) * 100 : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-12rem)]">
      {/* Left Sidebar - Section Navigation */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsExportOpen(true)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
          <h2 className="font-medium text-zinc-100 truncate">{proposal.title}</h2>
          <p className="text-xs text-zinc-500 mt-1">
            {proposal.funder_name || 'No funder specified'}
          </p>
        </div>

        {/* Progress */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>Progress</span>
            <span>{completedCount}/{sections.length} sections</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Writing Tone Selector */}
          <div className="mt-4">
            <label className="text-xs text-zinc-500 block mb-1">Writing Tone</label>
            <select
              value={writingTone}
              onChange={(e) => setWritingTone(e.target.value as typeof writingTone)}
              className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300"
            >
              {TONE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Write Full Proposal Button */}
          <Button
            onClick={handleWriteFullProposal}
            disabled={isWritingAll || sections.length === 0}
            className="w-full mt-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
          >
            {isWritingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Writing Proposal...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Write Full Proposal
              </>
            )}
          </Button>
        </div>

        {/* Sections List */}
        <div className="flex-1 overflow-y-auto p-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section)}
              className={`w-full text-left p-3 rounded-lg mb-1 flex items-center gap-3 transition-colors ${
                activeSection?.id === section.id
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <span className="text-lg">{SECTION_ICONS[section.section_type] || '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{section.title}</p>
                <p className="text-xs text-zinc-500">
                  {section.word_count || 0}{section.word_limit ? `/${section.word_limit}` : ''} words
                </p>
              </div>
              {section.is_complete ? (
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              ) : section.content ? (
                <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {activeSection ? (
          <>
            {/* Section Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-zinc-100 flex items-center gap-2">
                  <span>{SECTION_ICONS[activeSection.section_type] || '📄'}</span>
                  {activeSection.title}
                </h3>
                <p className="text-sm text-zinc-500">
                  {activeSection.word_count || 0} words
                  {activeSection.word_limit ? ` / ${activeSection.word_limit} limit` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleSectionComplete(activeSection.id, !activeSection.is_complete)}
                  className={activeSection.is_complete ? 'border-green-500 text-green-400' : 'border-zinc-700'}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {activeSection.is_complete ? 'Completed' : 'Mark Complete'}
                </Button>
              </div>
            </div>

            {/* AI Actions Bar */}
            <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
              <span className="text-xs text-zinc-500 mr-2">AI Assist:</span>

              <Button
                size="sm"
                variant="outline"
                onClick={handleAiWrite}
                disabled={isAiWorking}
                className="border-amber-600/50 text-amber-400 hover:bg-amber-600/20"
              >
                {isAiWorking && aiAction === 'write' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-1" />
                )}
                Write
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleAiImprove}
                disabled={isAiWorking || !activeSection.content}
                className="border-blue-600/50 text-blue-400 hover:bg-blue-600/20"
              >
                {isAiWorking && aiAction === 'improve' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1" />
                )}
                Improve
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleAiSuggest}
                disabled={isAiWorking || !activeSection.content}
                className="border-purple-600/50 text-purple-400 hover:bg-purple-600/20"
              >
                {isAiWorking && aiAction === 'suggest' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <MessageSquare className="w-4 h-4 mr-1" />
                )}
                Get Feedback
              </Button>

              <div className="flex-1" />

              <Button
                size="sm"
                variant="outline"
                onClick={() => setChatOpen(!chatOpen)}
                className={chatOpen ? 'bg-zinc-800' : ''}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Chat
              </Button>

              {extractedRequirements && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCompliance(!showCompliance)}
                  className={showCompliance ? 'bg-green-600/20 border-green-500/50 text-green-400' : 'border-zinc-700'}
                >
                  {showCompliance ? (
                    <PanelRightClose className="w-4 h-4 mr-1" />
                  ) : (
                    <ClipboardCheck className="w-4 h-4 mr-1" />
                  )}
                  Compliance
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => saveSection(activeSection.id, activeSection.content)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save
              </Button>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex overflow-hidden">
              <div className={`flex-1 p-4 overflow-y-auto ${chatOpen || showCompliance ? '' : 'w-full'}`}>
                {/* Section Guidance Panel */}
                {sectionGuidance && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowGuidance(!showGuidance)}
                      className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 mb-2"
                    >
                      {showGuidance ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Lightbulb className="w-4 h-4" />
                      <span>Writing Guidance</span>
                    </button>

                    {showGuidance && (
                      <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg space-y-3">
                        <p className="text-sm text-zinc-300">{sectionGuidance.description}</p>

                        {/* Tips */}
                        <div>
                          <h5 className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">Tips</h5>
                          <ul className="space-y-1">
                            {sectionGuidance.tips.map((tip, i) => (
                              <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                                <span className="text-amber-500 mt-0.5">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Key Questions */}
                        {sectionGuidance.questions.slice(0, 3).length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-2">Key Questions to Address</h5>
                            <ul className="space-y-1">
                              {sectionGuidance.questions.slice(0, 3).map((q) => (
                                <li key={q.id} className="text-sm text-zinc-400 flex items-start gap-2">
                                  <HelpCircle className="w-4 h-4 text-amber-500/70 mt-0.5 flex-shrink-0" />
                                  {q.question}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Word Limit Indicator */}
                        {activeSection.word_limit && (
                          <div className="pt-2 border-t border-amber-700/30">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400">Word Count</span>
                              <span className={`font-medium ${
                                (activeSection.word_count || 0) > activeSection.word_limit
                                  ? 'text-red-400'
                                  : (activeSection.word_count || 0) > activeSection.word_limit * 0.9
                                    ? 'text-yellow-400'
                                    : 'text-zinc-400'
                              }`}>
                                {activeSection.word_count || 0} / {activeSection.word_limit}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  (activeSection.word_count || 0) > activeSection.word_limit
                                    ? 'bg-red-500'
                                    : (activeSection.word_count || 0) > activeSection.word_limit * 0.9
                                      ? 'bg-yellow-500'
                                      : 'bg-amber-500'
                                }`}
                                style={{
                                  width: `${Math.min(((activeSection.word_count || 0) / activeSection.word_limit) * 100, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Suggestions */}
                {activeSection.ai_suggestions && activeSection.ai_suggestions.length > 0 && (
                  <div className="mb-4 p-4 bg-purple-900/20 border border-purple-700/50 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-400 mb-3">AI Suggestions</h4>
                    <div className="space-y-3">
                      {activeSection.ai_suggestions.map((suggestion, i) => (
                        <div key={i} className="text-sm">
                          <div className="flex items-start gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              suggestion.priority === 'high' ? 'bg-red-900/50 text-red-400' :
                              suggestion.priority === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                              'bg-zinc-800 text-zinc-400'
                            }`}>
                              {suggestion.priority}
                            </span>
                            <p className="text-zinc-400">{suggestion.issue}</p>
                          </div>
                          <p className="text-purple-300 mt-1 pl-4">💡 {suggestion.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Writing Area or Budget Builder */}
                {activeSection.section_type === 'budget' ? (
                  <BudgetBuilder
                    proposalId={proposal.id}
                    initialBudget={activeSection.content ? (() => {
                      try {
                        return JSON.parse(activeSection.content)
                      } catch {
                        return undefined
                      }
                    })() : undefined}
                    requestedAmount={proposal.requested_amount}
                    onSave={(budgetItems, summary) => {
                      const content = JSON.stringify({ items: budgetItems, summary })
                      const updated = { ...activeSection, content }
                      setActiveSection(updated)
                      setSections(sections.map((s) => (s.id === activeSection.id ? updated : s)))
                      saveSection(activeSection.id, content)
                    }}
                  />
                ) : (
                  <Textarea
                    value={activeSection.content || ''}
                    onChange={(e) => {
                      const updated = { ...activeSection, content: e.target.value }
                      setActiveSection(updated)
                      setSections(sections.map((s) => (s.id === activeSection.id ? updated : s)))
                    }}
                    placeholder={`Start writing your ${activeSection.title.toLowerCase()}...\n\nTip: Click "Write" to have AI draft this section, or start typing your own content and click "Improve" to enhance it.`}
                    className="w-full h-full min-h-[400px] bg-zinc-900 border-zinc-700 text-zinc-100 resize-none font-mono text-sm leading-relaxed"
                  />
                )}
              </div>

              {/* Chat Panel */}
              {chatOpen && (
                <div className="w-1/3 border-l border-zinc-800 flex flex-col bg-zinc-900">
                  <div className="p-3 border-b border-zinc-800">
                    <h4 className="text-sm font-medium text-zinc-300">AI Writing Assistant</h4>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {chatMessages.length === 0 && (
                      <p className="text-sm text-zinc-500 text-center mt-8">
                        Ask questions about this section, request specific edits, or get help with your writing.
                      </p>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg text-sm ${
                          msg.role === 'user'
                            ? 'bg-amber-600/20 text-amber-200 ml-8'
                            : 'bg-zinc-800 text-zinc-300 mr-8'
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                    {isAiWorking && !aiAction && (
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Thinking...
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-zinc-800">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
                        placeholder="Ask anything..."
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100"
                      />
                      <Button size="sm" onClick={handleChat} disabled={!chatInput.trim() || isAiWorking}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Compliance Tracker Panel */}
              {showCompliance && extractedRequirements && (
                <div className="w-80 border-l border-zinc-800 flex flex-col bg-zinc-900/50 overflow-y-auto">
                  <div className="p-3">
                    <ComplianceTracker
                      extractedRequirements={extractedRequirements}
                      proposalSections={sections.map(s => ({
                        id: s.id,
                        section_type: s.section_type,
                        title: s.title,
                        content: s.content,
                        word_count: s.word_count,
                        word_limit: s.word_limit,
                        is_complete: s.is_complete,
                      }))}
                      onSectionClick={(sectionType) => {
                        const section = sections.find(s =>
                          s.section_type === sectionType ||
                          s.title.toLowerCase().includes(sectionType.toLowerCase())
                        )
                        if (section) setActiveSection(section)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a section to start writing</p>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        proposalId={proposal.id}
        proposalTitle={proposal.title}
        workspaceId={workspaceId}
      />
    </div>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  Loader2,
  RefreshCw,
  Copy,
  Edit2,
  Save,
  HelpCircle,
  FileText,
} from 'lucide-react'

// Section-specific guided questions
const SECTION_GUIDES: Record<string, {
  title: string
  description: string
  questions: Array<{
    id: string
    question: string
    placeholder: string
    hint?: string
    required?: boolean
  }>
}> = {
  executive_summary: {
    title: 'Executive Summary',
    description: 'A compelling overview of your entire proposal',
    questions: [
      {
        id: 'organization',
        question: 'Briefly describe your organization and its mission.',
        placeholder: 'We are a nonprofit organization dedicated to...',
        hint: 'Include your founding year, main focus areas, and primary achievements.',
        required: true,
      },
      {
        id: 'problem',
        question: 'What specific problem or need does this project address?',
        placeholder: 'Our community faces challenges including...',
        hint: 'Be specific about the problem. Use data if available.',
        required: true,
      },
      {
        id: 'solution',
        question: 'What is your proposed solution or approach?',
        placeholder: 'We will implement a program that...',
        hint: 'Summarize your main strategy in 2-3 sentences.',
        required: true,
      },
      {
        id: 'outcomes',
        question: 'What outcomes do you expect to achieve?',
        placeholder: 'We expect to serve X participants and achieve...',
        hint: 'Include specific, measurable outcomes.',
        required: true,
      },
      {
        id: 'funding',
        question: 'How much funding are you requesting and for what period?',
        placeholder: 'We are requesting $X over Y months to...',
        required: true,
      },
    ],
  },
  statement_of_need: {
    title: 'Statement of Need',
    description: 'Establish the problem your project addresses',
    questions: [
      {
        id: 'target_population',
        question: 'Who is your target population? Describe their demographics.',
        placeholder: 'Our target population includes...',
        hint: 'Include age, location, socioeconomic factors, etc.',
        required: true,
      },
      {
        id: 'problem_description',
        question: 'What specific challenges does this population face?',
        placeholder: 'The community faces multiple challenges including...',
        hint: 'Be specific and use data to support your claims.',
        required: true,
      },
      {
        id: 'data_evidence',
        question: 'What data or evidence supports this need?',
        placeholder: 'According to [source], X% of our target population...',
        hint: 'Include statistics, research findings, or community assessments.',
        required: true,
      },
      {
        id: 'consequences',
        question: 'What happens if this need is not addressed?',
        placeholder: 'Without intervention, we can expect...',
        hint: 'Describe the long-term impact of inaction.',
      },
      {
        id: 'gap_analysis',
        question: 'What gaps exist in current services or solutions?',
        placeholder: 'Current services are inadequate because...',
        hint: 'Explain why existing programs aren\'t enough.',
      },
    ],
  },
  organizational_background: {
    title: 'Organizational Background',
    description: 'Demonstrate your capacity to succeed',
    questions: [
      {
        id: 'history',
        question: 'When was your organization founded and what is its history?',
        placeholder: 'Our organization was founded in [year] to...',
        required: true,
      },
      {
        id: 'mission',
        question: 'What is your mission and vision?',
        placeholder: 'Our mission is to... Our vision is...',
        required: true,
      },
      {
        id: 'experience',
        question: 'What relevant experience does your organization have?',
        placeholder: 'We have successfully implemented similar programs including...',
        hint: 'Focus on programs similar to what you\'re proposing.',
        required: true,
      },
      {
        id: 'accomplishments',
        question: 'What are your key accomplishments and outcomes achieved?',
        placeholder: 'Our key accomplishments include serving X participants...',
        hint: 'Include numbers, awards, and measurable results.',
      },
      {
        id: 'partnerships',
        question: 'What partnerships or collaborations strengthen your work?',
        placeholder: 'We partner with organizations such as...',
        hint: 'Highlight formal partnerships and their roles.',
      },
    ],
  },
  program_design: {
    title: 'Program Design',
    description: 'Detail your proposed approach and activities',
    questions: [
      {
        id: 'approach',
        question: 'What is your overall approach or methodology?',
        placeholder: 'Our approach is based on evidence-based practices including...',
        hint: 'Reference research or proven models if applicable.',
        required: true,
      },
      {
        id: 'activities',
        question: 'What specific activities or services will you provide?',
        placeholder: 'Key activities include: 1) ... 2) ... 3) ...',
        hint: 'List and briefly describe each major activity.',
        required: true,
      },
      {
        id: 'participants',
        question: 'How many participants will you serve and how will you recruit them?',
        placeholder: 'We will serve X participants, recruited through...',
        required: true,
      },
      {
        id: 'timeline',
        question: 'What is your implementation timeline?',
        placeholder: 'Month 1-3: ... Month 4-6: ... Month 7-12: ...',
        hint: 'Break down activities by quarters or major phases.',
      },
      {
        id: 'innovation',
        question: 'What makes your approach innovative or unique?',
        placeholder: 'Our program is unique because...',
        hint: 'Highlight what sets you apart from similar programs.',
      },
    ],
  },
  evaluation_plan: {
    title: 'Evaluation Plan',
    description: 'Explain how you will measure success',
    questions: [
      {
        id: 'objectives',
        question: 'What are your specific, measurable objectives?',
        placeholder: 'Objective 1: Increase X by Y%\nObjective 2: ...',
        hint: 'Use SMART goals format.',
        required: true,
      },
      {
        id: 'indicators',
        question: 'What indicators will you use to measure progress?',
        placeholder: 'We will track: attendance, completion rates, skill gains...',
        required: true,
      },
      {
        id: 'data_collection',
        question: 'How will you collect data?',
        placeholder: 'Data collection methods include: surveys, assessments...',
        hint: 'Be specific about tools and timing.',
        required: true,
      },
      {
        id: 'analysis',
        question: 'How will you analyze and report results?',
        placeholder: 'We will analyze data quarterly using...',
      },
      {
        id: 'improvements',
        question: 'How will evaluation inform program improvements?',
        placeholder: 'We will use findings to adjust programming by...',
      },
    ],
  },
  budget_narrative: {
    title: 'Budget Narrative',
    description: 'Justify your budget request',
    questions: [
      {
        id: 'personnel',
        question: 'What staff positions are included and why are they needed?',
        placeholder: 'Personnel costs include: Program Director (X% FTE)...',
        required: true,
      },
      {
        id: 'operational',
        question: 'What operational costs are required?',
        placeholder: 'Operational costs include: rent, utilities, supplies...',
      },
      {
        id: 'program',
        question: 'What direct program costs are included?',
        placeholder: 'Direct program costs include: materials, transportation...',
        required: true,
      },
      {
        id: 'justification',
        question: 'Why are these costs reasonable and necessary?',
        placeholder: 'These costs are based on current market rates and...',
        hint: 'Explain how you determined cost estimates.',
      },
      {
        id: 'other_funding',
        question: 'What other funding sources support this project?',
        placeholder: 'Other funding includes: matching funds from...',
      },
    ],
  },
  sustainability_plan: {
    title: 'Sustainability Plan',
    description: 'Demonstrate long-term viability',
    questions: [
      {
        id: 'continuation',
        question: 'How will the program continue after grant funding ends?',
        placeholder: 'We plan to sustain this program through...',
        required: true,
      },
      {
        id: 'diversification',
        question: 'What other funding sources will you pursue?',
        placeholder: 'We are pursuing funding from: foundations, government...',
      },
      {
        id: 'capacity',
        question: 'What organizational capacity will be built?',
        placeholder: 'This grant will help us build capacity in...',
      },
      {
        id: 'partnerships_growth',
        question: 'How will partnerships contribute to sustainability?',
        placeholder: 'Our partners will contribute to sustainability by...',
      },
    ],
  },
}

interface GuidedSectionEditorProps {
  sectionType: string
  sectionTitle: string
  existingContent?: string
  wordLimit?: number
  rfpContext?: {
    requirements?: string
    evaluationCriteria?: string
    guidance?: string
  }
  onSave: (content: string) => void
  onCancel: () => void
}

export function GuidedSectionEditor({
  sectionType,
  sectionTitle,
  existingContent = '',
  wordLimit,
  rfpContext,
  onSave,
  onCancel,
}: GuidedSectionEditorProps) {
  const guide = SECTION_GUIDES[sectionType]
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [error, setError] = useState('')

  // If no guide exists for this section type, show a basic editor
  if (!guide) {
    return (
      <BasicSectionEditor
        sectionTitle={sectionTitle}
        existingContent={existingContent}
        wordLimit={wordLimit}
        onSave={onSave}
        onCancel={onCancel}
      />
    )
  }

  const questions = guide.questions
  const totalSteps = questions.length
  const currentQuestion = questions[currentStep]
  const completedQuestions = Object.keys(answers).filter((key) =>
    questions.some((q) => q.id === key && answers[key]?.trim())
  ).length

  const handleAnswerChange = (value: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: value })
  }

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleGenerateDraft = async () => {
    setIsGenerating(true)
    setError('')

    try {
      // Build context from answers
      const answersText = questions
        .map((q) => `Q: ${q.question}\nA: ${answers[q.id] || '(not answered)'}`)
        .join('\n\n')

      const response = await fetch('/api/agents/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'guided_draft',
          sectionType,
          sectionTitle: guide.title,
          answers: answersText,
          wordLimit,
          rfpContext,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate draft')
      }

      const data = await response.json()
      setGeneratedContent(data.content || data.message)
      setEditedContent(data.content || data.message)
    } catch (err) {
      console.error('Error generating draft:', err)
      setError('Failed to generate draft. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerate = () => {
    handleGenerateDraft()
  }

  const handleSave = () => {
    onSave(isEditing ? editedContent : generatedContent)
  }

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length
  }

  // If we have generated content, show the review/edit view
  if (generatedContent) {
    const wordCount = countWords(isEditing ? editedContent : generatedContent)
    const isOverLimit = wordLimit && wordCount > wordLimit

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">{guide.title}</h2>
            <p className="text-sm text-zinc-400">Review and edit your generated draft</p>
          </div>
          <div className="flex items-center gap-4">
            {wordLimit && (
              <Badge className={isOverLimit ? 'bg-red-500/20 text-red-400' : 'bg-zinc-700'}>
                {wordCount.toLocaleString()}/{wordLimit.toLocaleString()} words
              </Badge>
            )}
          </div>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            {isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[400px] bg-zinc-800 border-zinc-700 text-zinc-100"
              />
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-zinc-100">
                    {generatedContent}
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setGeneratedContent('')
                setEditedContent('')
              }}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Questions
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                Done Editing
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="gap-2"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(isEditing ? editedContent : generatedContent)
              }}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button onClick={handleSave} className="gap-2 bg-amber-600 hover:bg-amber-700">
              <Save className="h-4 w-4" />
              Use This Draft
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Question-by-question view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">{guide.title}</h2>
          <p className="text-sm text-zinc-400">{guide.description}</p>
        </div>
        <Badge variant="outline">
          {completedQuestions}/{totalSteps} answered
        </Badge>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentStep(i)}
            className={`flex-1 h-2 rounded-full transition-colors ${
              i === currentStep
                ? 'bg-amber-500'
                : answers[q.id]?.trim()
                  ? 'bg-green-500'
                  : 'bg-zinc-700'
            }`}
          />
        ))}
      </div>

      {/* Current Question */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
              {currentStep + 1}
            </div>
            <div className="flex-1">
              <CardTitle className="text-zinc-100 text-base">
                {currentQuestion.question}
                {currentQuestion.required && (
                  <span className="text-red-400 ml-1">*</span>
                )}
              </CardTitle>
              {currentQuestion.hint && (
                <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  {currentQuestion.hint}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={answers[currentQuestion.id] || ''}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder={currentQuestion.placeholder}
            className="min-h-[150px] bg-zinc-800 border-zinc-700"
          />
        </CardContent>
      </Card>

      {/* RFP Context Hint */}
      {rfpContext?.guidance && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            RFP Guidance
          </h4>
          <p className="text-sm text-zinc-300">{rfpContext.guidance}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {currentStep > 0 && (
            <Button variant="outline" onClick={handlePrevious}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {currentStep < totalSteps - 1 ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerateDraft}
              disabled={isGenerating || !questions.some((q) => q.required && !answers[q.id]?.trim()) === false}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Draft
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Question Overview */}
      <div className="pt-4 border-t border-zinc-800">
        <h4 className="text-sm font-medium text-zinc-400 mb-3">All Questions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-2 p-2 rounded text-left text-sm transition-colors ${
                i === currentStep
                  ? 'bg-amber-500/20 text-amber-400'
                  : answers[q.id]?.trim()
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {answers[q.id]?.trim() ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{q.question}</span>
              {q.required && !answers[q.id]?.trim() && (
                <span className="text-red-400">*</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Basic editor for section types without guided questions
function BasicSectionEditor({
  sectionTitle,
  existingContent,
  wordLimit,
  onSave,
  onCancel,
}: {
  sectionTitle: string
  existingContent: string
  wordLimit?: number
  onSave: (content: string) => void
  onCancel: () => void
}) {
  const [content, setContent] = useState(existingContent)

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length
  }

  const wordCount = countWords(content)
  const isOverLimit = wordLimit && wordCount > wordLimit

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-100">{sectionTitle}</h2>
        {wordLimit && (
          <Badge className={isOverLimit ? 'bg-red-500/20 text-red-400' : 'bg-zinc-700'}>
            {wordCount.toLocaleString()}/{wordLimit.toLocaleString()} words
          </Badge>
        )}
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Write your ${sectionTitle.toLowerCase()} here...`}
        className="min-h-[400px] bg-zinc-800 border-zinc-700"
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(content)}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  )
}

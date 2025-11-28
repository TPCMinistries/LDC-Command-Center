'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  Target,
  ListChecks,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react'
import { format } from 'date-fns'

interface ExtractedRequirements {
  summary: string
  fundingAmount?: {
    min?: number
    max?: number
    description: string
  }
  eligibility: Array<{
    requirement: string
    isMet?: boolean
    notes?: string
  }>
  evaluationCriteria: Array<{
    criterion: string
    weight?: number
    description: string
  }>
  requiredSections: Array<{
    name: string
    wordLimit?: number
    pageLimit?: number
    description?: string
  }>
  keyDates: Array<{
    event: string
    date: string
    isDeadline?: boolean
  }>
  complianceChecklist: Array<{
    item: string
    category: 'eligibility' | 'content' | 'format' | 'submission'
    required: boolean
  }>
  specialRequirements: string[]
  fitAssessment?: {
    score: number
    strengths: string[]
    gaps: string[]
    recommendations: string[]
  }
}

interface RFPItem {
  id: string
  title: string
  description?: string
  agency?: string
  response_deadline?: string
  extracted_requirements?: ExtractedRequirements
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RFPAnalysisPanelProps {
  workspaceId: string
  rfp: RFPItem
  onAnalysisComplete?: (analysis: ExtractedRequirements) => void
}

export function RFPAnalysisPanel({ workspaceId, rfp, onAnalysisComplete }: RFPAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState('analysis')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<ExtractedRequirements | null>(
    rfp.extracted_requirements || null
  )

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatting, setIsChatting] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['eligibility', 'dates']))

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const runAnalysis = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/agents/rfp-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfpId: rfp.id,
          workspaceId,
        }),
      })

      if (response.ok) {
        const { analysis: newAnalysis } = await response.json()
        setAnalysis(newAnalysis)
        onAnalysisComplete?.(newAnalysis)
      }
    } catch (error) {
      console.error('Analysis error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatting) return

    const userMessage: ChatMessage = { role: 'user', content: chatInput }
    setChatMessages((prev) => [...prev, userMessage])
    setChatInput('')
    setIsChatting(true)

    try {
      const response = await fetch('/api/agents/rfp-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfpId: rfp.id,
          workspaceId,
          message: chatInput,
          conversationHistory: chatMessages,
        }),
      })

      if (response.ok) {
        const { response: aiResponse } = await response.json()
        setChatMessages((prev) => [...prev, { role: 'assistant', content: aiResponse }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ])
    } finally {
      setIsChatting(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const getFitScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-zinc-800 px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="analysis" className="data-[state=active]:bg-zinc-800">
              <Sparkles className="h-4 w-4 mr-2" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-zinc-800">
              <MessageSquare className="h-4 w-4 mr-2" />
              Ask Questions
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analysis" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Analyze Button */}
              {!analysis && (
                <div className="text-center py-8">
                  <Sparkles className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-zinc-200 mb-2">AI RFP Analysis</h3>
                  <p className="text-zinc-400 text-sm mb-4">
                    Let AI analyze this RFP to extract key requirements, deadlines, and assess your fit.
                  </p>
                  <Button
                    onClick={runAnalysis}
                    disabled={isAnalyzing}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyze RFP
                      </>
                    )}
                  </Button>
                </div>
              )}

              {analysis && (
                <>
                  {/* Summary */}
                  <Card className="bg-zinc-800/50 border-zinc-700">
                    <CardContent className="pt-4">
                      <p className="text-zinc-300 text-sm">{analysis.summary}</p>
                    </CardContent>
                  </Card>

                  {/* Fit Assessment */}
                  {analysis.fitAssessment && (
                    <Card className="bg-zinc-800/50 border-zinc-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-amber-500" />
                            Fit Assessment
                          </span>
                          <span className={`text-2xl font-bold ${getFitScoreColor(analysis.fitAssessment.score)}`}>
                            {analysis.fitAssessment.score}%
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {analysis.fitAssessment.strengths.length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium text-green-400 uppercase tracking-wide mb-1">
                              Strengths
                            </h5>
                            <ul className="space-y-1">
                              {analysis.fitAssessment.strengths.map((s, i) => (
                                <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                                  <CheckCircle className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {analysis.fitAssessment.gaps.length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium text-yellow-400 uppercase tracking-wide mb-1">
                              Gaps to Address
                            </h5>
                            <ul className="space-y-1">
                              {analysis.fitAssessment.gaps.map((g, i) => (
                                <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                                  <AlertTriangle className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
                                  {g}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {analysis.fitAssessment.recommendations.length > 0 && (
                          <div>
                            <h5 className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-1">
                              Recommendations
                            </h5>
                            <ul className="space-y-1">
                              {analysis.fitAssessment.recommendations.map((r, i) => (
                                <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                                  <TrendingUp className="h-3 w-3 text-blue-500 mt-1 flex-shrink-0" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Key Dates */}
                  {analysis.keyDates.length > 0 && (
                    <Card className="bg-zinc-800/50 border-zinc-700">
                      <CardHeader
                        className="pb-2 cursor-pointer"
                        onClick={() => toggleSection('dates')}
                      >
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-amber-500" />
                            Key Dates
                          </span>
                          {expandedSections.has('dates') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      {expandedSections.has('dates') && (
                        <CardContent className="space-y-2">
                          {analysis.keyDates.map((date, i) => (
                            <div
                              key={i}
                              className={`flex items-center justify-between p-2 rounded ${
                                date.isDeadline ? 'bg-red-900/20' : 'bg-zinc-800/50'
                              }`}
                            >
                              <span className="text-sm text-zinc-300">{date.event}</span>
                              <Badge variant={date.isDeadline ? 'destructive' : 'secondary'}>
                                {date.date}
                              </Badge>
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Eligibility */}
                  {analysis.eligibility.length > 0 && (
                    <Card className="bg-zinc-800/50 border-zinc-700">
                      <CardHeader
                        className="pb-2 cursor-pointer"
                        onClick={() => toggleSection('eligibility')}
                      >
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <ListChecks className="h-4 w-4 text-amber-500" />
                            Eligibility Requirements
                          </span>
                          {expandedSections.has('eligibility') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      {expandedSections.has('eligibility') && (
                        <CardContent className="space-y-2">
                          {analysis.eligibility.map((req, i) => (
                            <div key={i} className="p-2 rounded bg-zinc-800/50">
                              <div className="flex items-start gap-2">
                                {req.isMet === true ? (
                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                ) : req.isMet === false ? (
                                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
                                )}
                                <div>
                                  <p className="text-sm text-zinc-300">{req.requirement}</p>
                                  {req.notes && (
                                    <p className="text-xs text-zinc-500 mt-1">{req.notes}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Evaluation Criteria */}
                  {analysis.evaluationCriteria.length > 0 && (
                    <Card className="bg-zinc-800/50 border-zinc-700">
                      <CardHeader
                        className="pb-2 cursor-pointer"
                        onClick={() => toggleSection('criteria')}
                      >
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-amber-500" />
                            Evaluation Criteria
                          </span>
                          {expandedSections.has('criteria') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      {expandedSections.has('criteria') && (
                        <CardContent className="space-y-2">
                          {analysis.evaluationCriteria.map((crit, i) => (
                            <div key={i} className="p-2 rounded bg-zinc-800/50">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-zinc-200">{crit.criterion}</span>
                                {crit.weight && (
                                  <Badge variant="outline" className="text-xs">
                                    {crit.weight}%
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-zinc-400">{crit.description}</p>
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Required Sections */}
                  {analysis.requiredSections.length > 0 && (
                    <Card className="bg-zinc-800/50 border-zinc-700">
                      <CardHeader
                        className="pb-2 cursor-pointer"
                        onClick={() => toggleSection('sections')}
                      >
                        <CardTitle className="text-base flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-amber-500" />
                            Required Sections
                          </span>
                          {expandedSections.has('sections') ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      {expandedSections.has('sections') && (
                        <CardContent className="space-y-2">
                          {analysis.requiredSections.map((section, i) => (
                            <div key={i} className="p-2 rounded bg-zinc-800/50">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-zinc-200">{section.name}</span>
                                <div className="flex gap-2">
                                  {section.wordLimit && (
                                    <Badge variant="outline" className="text-xs">
                                      {section.wordLimit} words
                                    </Badge>
                                  )}
                                  {section.pageLimit && (
                                    <Badge variant="outline" className="text-xs">
                                      {section.pageLimit} pages
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {section.description && (
                                <p className="text-xs text-zinc-400">{section.description}</p>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  )}

                  {/* Re-analyze button */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={runAnalysis}
                      disabled={isAnalyzing}
                      className="w-full"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Re-analyze RFP
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="chat" className="flex-1 flex flex-col m-0">
          {/* Chat Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-zinc-300 mb-2">Ask about this RFP</h3>
                  <p className="text-zinc-500 text-sm mb-4">
                    Get answers about requirements, deadlines, eligibility, and more.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      'What are the eligibility requirements?',
                      'What evaluation criteria will be used?',
                      'Are matching funds required?',
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setChatInput(q)}
                        className="px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-amber-600 text-white'
                        : 'bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {isChatting && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 p-3 rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="p-4 border-t border-zinc-800">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                placeholder="Ask a question about this RFP..."
                className="bg-zinc-800 border-zinc-700"
                disabled={isChatting}
              />
              <Button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || isChatting}
                className="bg-amber-600 hover:bg-amber-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

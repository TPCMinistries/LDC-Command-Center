'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Upload,
  Sparkles,
  Send,
  Loader2,
  Check,
  Plus,
  X,
  FileText,
  Wand2,
} from 'lucide-react'
import { BrandProfile } from '@/types/brand'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface BrandVoiceCoachProps {
  workspaceId: string
  workspaceName: string
  currentBranding: Partial<BrandProfile>
  onProfileUpdate: (profile: Partial<BrandProfile>) => void
}

export function BrandVoiceCoach({
  workspaceId,
  workspaceName,
  currentBranding,
  onProfileUpdate,
}: BrandVoiceCoachProps) {
  const [activeTab, setActiveTab] = useState('questionnaire')

  // Questionnaire state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [extractedProfile, setExtractedProfile] = useState<Partial<BrandProfile> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Sample analysis state
  const [samples, setSamples] = useState<string[]>([''])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [voiceAnalysis, setVoiceAnalysis] = useState<{
    analysis: string
    voiceAnalysis: Record<string, unknown> | null
  } | null>(null)

  // Refinement state
  const [refineMessages, setRefineMessages] = useState<ChatMessage[]>([])
  const [refineInput, setRefineInput] = useState('')
  const [isRefining, setIsRefining] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, refineMessages])

  // Start the questionnaire
  const startQuestionnaire = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/agents/voice-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'questionnaire',
          workspaceId,
          messages: [],
        }),
      })

      const data = await response.json()
      if (data.success) {
        setMessages([
          { role: 'user', content: "Hi, I'd like help defining my brand voice." },
          { role: 'assistant', content: data.message },
        ])
      }
    } catch (error) {
      console.error('Failed to start questionnaire:', error)
    }
    setIsLoading(false)
  }

  // Send message in questionnaire
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: input }]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/agents/voice-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'questionnaire',
          workspaceId,
          messages: newMessages,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setMessages([...newMessages, { role: 'assistant', content: data.message }])
        if (data.extractedProfile) {
          setExtractedProfile(data.extractedProfile)
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
    setIsLoading(false)
  }

  // Analyze content samples
  const analyzeSamples = async () => {
    const validSamples = samples.filter(s => s.trim().length > 50)
    if (validSamples.length === 0) return

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/agents/voice-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_samples',
          workspaceId,
          samples: validSamples,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setVoiceAnalysis({
          analysis: data.analysis,
          voiceAnalysis: data.voiceAnalysis,
        })
      }
    } catch (error) {
      console.error('Failed to analyze samples:', error)
    }
    setIsAnalyzing(false)
  }

  // Send refinement message
  const sendRefineMessage = async () => {
    if (!refineInput.trim() || isRefining) return

    const newMessages: ChatMessage[] = [...refineMessages, { role: 'user', content: refineInput }]
    setRefineMessages(newMessages)
    setRefineInput('')
    setIsRefining(true)

    try {
      const response = await fetch('/api/agents/voice-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refine',
          workspaceId,
          messages: newMessages,
          currentProfile: currentBranding,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setRefineMessages([...newMessages, { role: 'assistant', content: data.message }])
        if (data.profileUpdates) {
          // Apply profile updates
          const updated = { ...currentBranding }
          for (const [path, value] of Object.entries(data.profileUpdates)) {
            const keys = path.split('.')
            let obj: Record<string, unknown> = updated as Record<string, unknown>
            for (let i = 0; i < keys.length - 1; i++) {
              if (!obj[keys[i]]) obj[keys[i]] = {}
              obj = obj[keys[i]] as Record<string, unknown>
            }
            obj[keys[keys.length - 1]] = value
          }
          onProfileUpdate(updated)
        }
      }
    } catch (error) {
      console.error('Failed to send refine message:', error)
    }
    setIsRefining(false)
  }

  // Save extracted profile
  const saveProfile = async (profile: Partial<BrandProfile>) => {
    try {
      const response = await fetch('/api/agents/voice-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_profile',
          workspaceId,
          profile,
        }),
      })

      const data = await response.json()
      if (data.success) {
        onProfileUpdate(data.branding)
        setExtractedProfile(null)
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    }
  }

  // Apply voice analysis to profile
  const applyVoiceAnalysis = async () => {
    if (!voiceAnalysis?.voiceAnalysis) return

    const va = voiceAnalysis.voiceAnalysis
    type VoiceTone = 'formal' | 'professional' | 'conversational' | 'casual' | 'inspirational'
    type CommStyle = 'direct' | 'storytelling' | 'educational' | 'motivational'
    type JargonLevel = 'none' | 'minimal' | 'industry-standard' | 'technical'

    const profileUpdate: Partial<BrandProfile> = {
      voice: {
        tone: va.tone as VoiceTone,
        personality: va.personality as string[],
        communication_style: va.communication_style as CommStyle,
      },
      language: {
        words_to_use: va.words_to_use as string[],
        words_to_avoid: va.words_to_avoid as string[],
        jargon_level: ((va.language_patterns as Record<string, unknown>)?.jargon_level || 'minimal') as JargonLevel,
      },
      messaging: {
        key_themes: va.key_themes as string[],
      },
    }

    await saveProfile(profileUpdate)
    setVoiceAnalysis(null)
    setSamples([''])
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-zinc-100">Brand Voice Coach</CardTitle>
        </div>
        <CardDescription className="text-zinc-400">
          Define and refine your brand voice through conversation, content analysis, or ongoing coaching
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 bg-zinc-800 mb-4">
            <TabsTrigger value="questionnaire" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-500">
              <MessageSquare className="h-4 w-4 mr-2" />
              Discovery
            </TabsTrigger>
            <TabsTrigger value="samples" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-500">
              <Upload className="h-4 w-4 mr-2" />
              Analyze Samples
            </TabsTrigger>
            <TabsTrigger value="refine" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-500">
              <Sparkles className="h-4 w-4 mr-2" />
              Refine
            </TabsTrigger>
          </TabsList>

          {/* Discovery Questionnaire Tab */}
          <TabsContent value="questionnaire" className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-200 mb-2">
                  Let&apos;s discover your brand voice
                </h3>
                <p className="text-zinc-400 mb-4 max-w-md mx-auto">
                  I&apos;ll ask you a few questions about {workspaceName} to understand your
                  unique voice and communication style.
                </p>
                <Button
                  onClick={startQuestionnaire}
                  disabled={isLoading}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Start Discovery'
                  )}
                </Button>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-amber-600/20 text-amber-100'
                              : 'bg-zinc-800 text-zinc-200'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-zinc-800 rounded-lg px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {extractedProfile && (
                  <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-400">Brand Profile Generated!</span>
                    </div>
                    <p className="text-sm text-zinc-400 mb-3">
                      Based on our conversation, I&apos;ve created a brand voice profile for you.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => saveProfile(extractedProfile)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Save Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExtractedProfile(null)}
                        className="border-zinc-700"
                      >
                        Continue Refining
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                    placeholder="Type your response..."
                    className="bg-zinc-800 border-zinc-700 resize-none"
                    rows={2}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Sample Analysis Tab */}
          <TabsContent value="samples" className="space-y-4">
            <p className="text-sm text-zinc-400">
              Paste 1-5 samples of content you love (your own writing, or content that represents
              the voice you want). Each sample should be at least 50 characters.
            </p>

            {samples.map((sample, i) => (
              <div key={i} className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-zinc-500" />
                  <span className="text-sm text-zinc-400">Sample {i + 1}</span>
                  {samples.length > 1 && (
                    <button
                      onClick={() => setSamples(samples.filter((_, idx) => idx !== i))}
                      className="ml-auto text-zinc-500 hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Textarea
                  value={sample}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    const newSamples = [...samples]
                    newSamples[i] = e.target.value
                    setSamples(newSamples)
                  }}
                  placeholder="Paste your content sample here..."
                  className="bg-zinc-800 border-zinc-700 min-h-[120px]"
                />
                {sample.length > 0 && sample.length < 50 && (
                  <p className="text-xs text-amber-500 mt-1">
                    Need at least 50 characters ({50 - sample.length} more)
                  </p>
                )}
              </div>
            ))}

            {samples.length < 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSamples([...samples, ''])}
                className="border-zinc-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Another Sample
              </Button>
            )}

            <div className="flex justify-end">
              <Button
                onClick={analyzeSamples}
                disabled={isAnalyzing || samples.filter(s => s.trim().length > 50).length === 0}
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
                    Analyze Voice
                  </>
                )}
              </Button>
            </div>

            {voiceAnalysis && (
              <div className="bg-zinc-800 rounded-lg p-4 space-y-4">
                <h4 className="font-medium text-zinc-200">Voice Analysis</h4>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {voiceAnalysis.analysis}
                </p>

                {voiceAnalysis.voiceAnalysis && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(voiceAnalysis.voiceAnalysis.personality as string[] || []).map((trait: string) => (
                        <Badge key={trait} variant="secondary" className="bg-amber-600/20 text-amber-400">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      onClick={applyVoiceAnalysis}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Apply to Brand Profile
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Refine Tab */}
          <TabsContent value="refine" className="space-y-4">
            {!currentBranding.voice?.tone ? (
              <div className="text-center py-8">
                <Sparkles className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-200 mb-2">
                  No brand profile yet
                </h3>
                <p className="text-zinc-400 mb-4">
                  Complete the Discovery questionnaire or analyze some samples first to create your brand profile.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('questionnaire')}
                  className="border-zinc-700"
                >
                  Start Discovery
                </Button>
              </div>
            ) : (
              <>
                <div className="bg-zinc-800 rounded-lg p-3 text-sm">
                  <p className="text-zinc-400 mb-2">Current voice profile:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-zinc-600">
                      {currentBranding.voice?.tone}
                    </Badge>
                    {currentBranding.voice?.personality?.slice(0, 3).map((p) => (
                      <Badge key={p} variant="secondary" className="bg-zinc-700">
                        {p}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="border-zinc-600">
                      {currentBranding.voice?.communication_style}
                    </Badge>
                  </div>
                </div>

                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    {refineMessages.length === 0 && (
                      <p className="text-center text-zinc-500 py-4">
                        Ask me to refine any aspect of your brand voice...
                      </p>
                    )}
                    {refineMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-amber-600/20 text-amber-100'
                              : 'bg-zinc-800 text-zinc-200'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {isRefining && (
                      <div className="flex justify-start">
                        <div className="bg-zinc-800 rounded-lg px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Textarea
                    value={refineInput}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRefineInput(e.target.value)}
                    placeholder="e.g., 'Make the tone more casual' or 'Add playfulness to the personality'"
                    className="bg-zinc-800 border-zinc-700 resize-none"
                    rows={2}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendRefineMessage()
                      }
                    }}
                  />
                  <Button
                    onClick={sendRefineMessage}
                    disabled={isRefining || !refineInput.trim()}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

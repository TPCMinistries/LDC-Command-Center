'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Crown,
  Send,
  Loader2,
  Sparkles,
  FileText,
  Target,
  Lightbulb,
  MessageSquare,
  PenTool,
  Calendar,
  ListTodo,
  RefreshCw,
  ChevronRight,
  Search,
  Users,
  Bot,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Mail,
  Heart,
  Briefcase,
  Activity,
  Settings,
  Eye,
  EyeOff,
  Brain,
  BellRing,
  X,
  ThumbsUp,
  ThumbsDown,
  Lock,
  Unlock,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import ReactMarkdown from 'react-markdown'

interface AgentsHubProps {
  workspaceId: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AgentLog {
  id: string
  agent_type: string
  action: string
  input_summary: string
  output_summary: string
  status: string
  created_at: string
  duration_ms: number
}

interface Suggestion {
  id: string
  suggestionType: string
  title: string
  content: string
  priority: string
  triggerReason?: string
  actionType?: string
  createdAt: string
}

interface ContextSettings {
  contextMode: 'full' | 'focused' | 'minimal'
  includeCrossWorkspace: boolean
  includeConversationHistory: boolean
  includeSuggestions: boolean
}

// Define all available agents with autonomy levels
const AGENTS = [
  {
    id: 'chief-of-staff',
    name: 'Chief of Staff',
    description: 'Your strategic advisor for daily briefings, prioritization, and decision-making',
    icon: Crown,
    color: 'amber',
    capabilities: ['Daily briefings', 'Priority triage', 'Strategic advice', 'Weekly reviews'],
    autonomyLevel: 'proactive',
    featured: true,
    canTakeActions: true,
    actions: ['Create tasks', 'Send notifications', 'Suggest time blocks', 'Flag priorities'],
  },
  {
    id: 'research',
    name: 'Research Agent',
    description: 'Autonomously discovers grant opportunities, analyzes funders, and monitors trends',
    icon: Search,
    color: 'emerald',
    capabilities: ['Grant scanning', 'Funder analysis', 'Competitive intel', 'Trend monitoring'],
    autonomyLevel: 'autonomous',
    featured: true,
    canTakeActions: true,
    actions: ['Save research findings', 'Flag opportunities', 'Create follow-up tasks'],
  },
  {
    id: 'outreach',
    name: 'Outreach Agent',
    description: 'Manages relationship health, drafts communications, and tracks engagement',
    icon: Users,
    color: 'pink',
    capabilities: ['Relationship health', 'Draft emails', 'Meeting prep', 'Cultivation plans'],
    autonomyLevel: 'autonomous',
    featured: true,
    canTakeActions: true,
    actions: ['Draft outreach', 'Log interactions', 'Update contact health', 'Create follow-ups'],
  },
  {
    id: 'proposal',
    name: 'Proposal Writer',
    description: 'Expert grant writer that helps draft and improve proposal sections',
    icon: PenTool,
    color: 'blue',
    capabilities: ['Write sections', 'Improve drafts', 'Get suggestions', 'Compliance check'],
    autonomyLevel: 'assistant',
    featured: false,
    canTakeActions: false,
    actions: [],
  },
  {
    id: 'rfp',
    name: 'RFP Analyst',
    description: 'Analyzes RFP opportunities and assesses organizational fit',
    icon: Target,
    color: 'green',
    capabilities: ['Analyze RFPs', 'Assess fit', 'Generate outlines', 'Extract requirements'],
    autonomyLevel: 'assistant',
    featured: false,
    canTakeActions: true,
    actions: ['Update RFP status', 'Flag opportunities', 'Create proposal tasks'],
  },
  {
    id: 'content',
    name: 'Content Creator',
    description: 'Transforms ideas into social media, blog posts, and email content',
    icon: MessageSquare,
    color: 'purple',
    capabilities: ['Social posts', 'Blog articles', 'Email campaigns', 'Sermon outlines'],
    autonomyLevel: 'assistant',
    featured: false,
    canTakeActions: true,
    actions: ['Save drafts for review'],
  },
  {
    id: 'ideas',
    name: 'Idea Processor',
    description: 'Analyzes and categorizes captured ideas with actionable insights',
    icon: Lightbulb,
    color: 'yellow',
    capabilities: ['Categorize ideas', 'Extract actions', 'Suggest content', 'Prioritize'],
    autonomyLevel: 'assistant',
    featured: false,
    canTakeActions: true,
    actions: ['Create tasks from ideas'],
  },
]

const QUICK_ACTIONS = [
  { label: 'Morning Briefing', action: 'briefing', context: { timeOfDay: 'morning' }, icon: Calendar },
  { label: 'Triage My Tasks', action: 'triage', context: {}, icon: ListTodo },
  { label: 'Weekly Review', action: 'weekly_review', context: {}, icon: RefreshCw },
]

const RESEARCH_ACTIONS = [
  { label: 'Scan Opportunities', action: 'scan_opportunities', icon: Search },
  { label: 'Trend Analysis', action: 'trend_analysis', icon: TrendingUp },
  { label: 'Competitive Intel', action: 'competitive_analysis', icon: Briefcase },
]

const OUTREACH_ACTIONS = [
  { label: 'Health Check', action: 'health_check', icon: Heart },
  { label: 'Follow-up Suggestions', action: 'follow_up_suggestions', icon: Mail },
]

export function AgentsHub({ workspaceId }: AgentsHubProps) {
  const [selectedAgent, setSelectedAgent] = useState<string>('chief-of-staff')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([])
  const [researchResults, setResearchResults] = useState<unknown>(null)
  const [outreachResults, setOutreachResults] = useState<unknown>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [contextSettings, setContextSettings] = useState<ContextSettings>({
    contextMode: 'full',
    includeCrossWorkspace: true,
    includeConversationHistory: true,
    includeSuggestions: true,
  })
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Fetch agent activity logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/agents/logs?workspaceId=${workspaceId}&limit=20`)
        if (res.ok) {
          const data = await res.json()
          setAgentLogs(data.logs || [])
        }
      } catch (error) {
        console.error('Failed to fetch agent logs:', error)
      }
    }
    fetchLogs()
  }, [workspaceId])

  // Fetch suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/agents/suggestions?workspaceId=${workspaceId}&status=new&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions || [])
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error)
      }
    }
    fetchSuggestions()
  }, [workspaceId])

  // Fetch context settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`/api/agents/context?workspaceId=${workspaceId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.settings) {
            setContextSettings(data.settings)
          }
        }
      } catch (error) {
        console.error('Failed to fetch context settings:', error)
      }
    }
    fetchSettings()
  }, [workspaceId])

  // Update context settings
  const updateContextMode = async (mode: 'full' | 'focused' | 'minimal') => {
    const newSettings = { ...contextSettings, contextMode: mode }
    setContextSettings(newSettings)
    try {
      await fetch('/api/agents/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, settings: newSettings }),
      })
    } catch (error) {
      console.error('Failed to update context settings:', error)
    }
  }

  // Dismiss a suggestion
  const dismissSuggestion = async (suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
    try {
      await fetch('/api/agents/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, action: 'update_status', suggestionId, status: 'dismissed' }),
      })
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error)
    }
  }

  // Generate new suggestions
  const generateSuggestions = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/agents/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, action: 'generate' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.suggestions) {
          setSuggestions(prev => [...data.suggestions, ...prev].slice(0, 10))
        }
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error)
    }
    setIsLoading(false)
  }

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  const handleQuickAction = async (actionType: string, context: Record<string, unknown>) => {
    setIsLoading(true)

    try {
      const res = await fetch('/api/agents/chief-of-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action: actionType,
          context,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error('Quick action error:', error)
    }

    setIsLoading(false)
  }

  const handleResearchAction = async (action: string) => {
    setIsLoading(true)
    setResearchResults(null)

    try {
      const res = await fetch('/api/agents/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action,
          query: input || undefined,
        }),
      })

      const data = await res.json()
      setResearchResults(data)
      setInput('')
    } catch (error) {
      console.error('Research action error:', error)
    }

    setIsLoading(false)
  }

  const handleOutreachAction = async (action: string) => {
    setIsLoading(true)
    setOutreachResults(null)

    try {
      const res = await fetch('/api/agents/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action,
        }),
      })

      const data = await res.json()
      setOutreachResults(data)
    } catch (error) {
      console.error('Outreach action error:', error)
    }

    setIsLoading(false)
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/agents/chief-of-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action: 'chat',
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await res.json()

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ])
    }

    setIsLoading(false)
  }

  const currentAgent = AGENTS.find((a) => a.id === selectedAgent)

  const getAutonomyBadge = (level: string) => {
    switch (level) {
      case 'autonomous':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
            <Zap className="h-3 w-3 mr-1" />
            Autonomous
          </Badge>
        )
      case 'proactive':
        return (
          <Badge className="bg-amber-500/20 text-amber-400 text-xs">
            <Bot className="h-3 w-3 mr-1" />
            Proactive
          </Badge>
        )
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-400 text-xs">
            Assistant
          </Badge>
        )
    }
  }

  const renderAgentInterface = () => {
    switch (selectedAgent) {
      case 'chief-of-staff':
        return renderChiefOfStaffInterface()
      case 'research':
        return renderResearchInterface()
      case 'outreach':
        return renderOutreachInterface()
      default:
        return renderPlaceholderInterface()
    }
  }

  const renderChiefOfStaffInterface = () => (
    <Card className="bg-zinc-900 border-zinc-800 h-[700px] flex flex-col">
      <CardHeader className="pb-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Crown className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-zinc-100">Chief of Staff</CardTitle>
                {getAutonomyBadge('proactive')}
              </div>
              <CardDescription>
                Your strategic advisor for prioritization and decision-making
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {QUICK_ACTIONS.map((qa) => {
              const Icon = qa.icon
              return (
                <Button
                  key={qa.action}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(qa.action, qa.context)}
                  disabled={isLoading}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <Icon className="h-4 w-4 mr-1" />
                  {qa.label}
                </Button>
              )
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="p-4 rounded-full bg-amber-500/10 mb-4">
                <Sparkles className="h-10 w-10 text-amber-500" />
              </div>
              <h3 className="text-lg font-medium text-zinc-200 mb-2">
                Good to see you, Lorenzo
              </h3>
              <p className="text-zinc-400 max-w-md mb-6">
                I&apos;m your Chief of Staff. I can help you with daily briefings,
                prioritizing tasks, strategic decisions, and keeping everything on track.
              </p>
              <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                <Button
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-auto py-3"
                  onClick={() => handleQuickAction('briefing', { timeOfDay: 'morning' })}
                  disabled={isLoading}
                >
                  <div className="text-left">
                    <div className="font-medium">Morning Briefing</div>
                    <div className="text-xs text-zinc-500">Start your day with priorities</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-auto py-3"
                  onClick={() => handleQuickAction('triage', {})}
                  disabled={isLoading}
                >
                  <div className="text-left">
                    <div className="font-medium">Triage Tasks</div>
                    <div className="text-xs text-zinc-500">Prioritize what matters</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-auto py-3"
                  onClick={() => handleQuickAction('advise', { topic: 'Weekly planning', question: 'What should I focus on this week?' })}
                  disabled={isLoading}
                >
                  <div className="text-left">
                    <div className="font-medium">Strategic Advice</div>
                    <div className="text-xs text-zinc-500">Get guidance on decisions</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-auto py-3"
                  onClick={() => handleQuickAction('weekly_review', {})}
                  disabled={isLoading}
                >
                  <div className="text-left">
                    <div className="font-medium">Weekly Review</div>
                    <div className="text-xs text-zinc-500">Reflect and plan ahead</div>
                  </div>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-amber-600/20 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                    <p className="text-xs text-zinc-500 mt-2">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything... (e.g., 'What should I focus on today?' or 'Help me decide between X and Y')"
              className="min-h-[60px] max-h-[120px] bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderResearchInterface = () => (
    <Card className="bg-zinc-900 border-zinc-800 h-[700px] flex flex-col">
      <CardHeader className="pb-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Search className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-zinc-100">Research Agent</CardTitle>
                {getAutonomyBadge('autonomous')}
              </div>
              <CardDescription>
                Autonomously discovers opportunities and analyzes funding landscape
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex flex-wrap gap-2 mb-4">
          {RESEARCH_ACTIONS.map((ra) => {
            const Icon = ra.icon
            return (
              <Button
                key={ra.action}
                variant="outline"
                onClick={() => handleResearchAction(ra.action)}
                disabled={isLoading}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <Icon className="h-4 w-4 mr-2" />
                {ra.label}
              </Button>
            )
          })}
        </div>

        <div className="mb-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Optional: Specify search focus (e.g., 'environmental justice grants' or 'faith-based education funders')"
            className="min-h-[60px] bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 resize-none"
          />
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-2" />
                <p className="text-zinc-400">Researching...</p>
              </div>
            </div>
          ) : researchResults ? (
            <div className="space-y-4">
              {(researchResults as { summary?: string })?.summary && (
                <div className="p-4 bg-zinc-800 rounded-lg">
                  <h4 className="text-sm font-medium text-zinc-300 mb-2">Summary</h4>
                  <p className="text-zinc-400 text-sm">{(researchResults as { summary: string }).summary}</p>
                </div>
              )}
              {(researchResults as { findings?: Array<{ title: string; type: string; summary: string; relevance_score?: number; recommendation?: string }> })?.findings?.map((finding, idx) => (
                <div key={idx} className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-zinc-200">{finding.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {finding.type}
                    </Badge>
                  </div>
                  <p className="text-zinc-400 text-sm mb-2">{finding.summary}</p>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    {finding.relevance_score && (
                      <span>Relevance: {Math.round(finding.relevance_score * 100)}%</span>
                    )}
                    {finding.recommendation && (
                      <Badge
                        className={
                          finding.recommendation === 'pursue'
                            ? 'bg-green-500/20 text-green-400'
                            : finding.recommendation === 'monitor'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-zinc-500/20 text-zinc-400'
                        }
                      >
                        {finding.recommendation}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="p-4 rounded-full bg-emerald-500/10 mb-4">
                <Search className="h-10 w-10 text-emerald-500" />
              </div>
              <h3 className="text-lg font-medium text-zinc-200 mb-2">
                Ready to Research
              </h3>
              <p className="text-zinc-400 max-w-md">
                I can scan for grant opportunities, analyze funders, gather competitive intelligence,
                and identify funding trends. Choose an action above to get started.
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )

  const renderOutreachInterface = () => (
    <Card className="bg-zinc-900 border-zinc-800 h-[700px] flex flex-col">
      <CardHeader className="pb-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/20">
              <Users className="h-6 w-6 text-pink-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-zinc-100">Outreach Agent</CardTitle>
                {getAutonomyBadge('autonomous')}
              </div>
              <CardDescription>
                Manages relationships and drafts personalized communications
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex flex-wrap gap-2 mb-4">
          {OUTREACH_ACTIONS.map((oa) => {
            const Icon = oa.icon
            return (
              <Button
                key={oa.action}
                variant="outline"
                onClick={() => handleOutreachAction(oa.action)}
                disabled={isLoading}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <Icon className="h-4 w-4 mr-2" />
                {oa.label}
              </Button>
            )
          })}
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-pink-500 mx-auto mb-2" />
                <p className="text-zinc-400">Analyzing relationships...</p>
              </div>
            </div>
          ) : outreachResults ? (
            <div className="space-y-4">
              {(outreachResults as { analysis?: { summary: string; health_distribution?: Record<string, number>; at_risk_relationships?: Array<{ name: string; reason: string; urgency: string }> } })?.analysis && (
                <div className="p-4 bg-zinc-800 rounded-lg">
                  <h4 className="text-sm font-medium text-zinc-300 mb-2">Relationship Health</h4>
                  <p className="text-zinc-400 text-sm mb-3">{(outreachResults as { analysis: { summary: string } }).analysis.summary}</p>

                  {(outreachResults as { analysis: { health_distribution?: Record<string, number> } }).analysis.health_distribution && (
                    <div className="flex gap-4 mb-3">
                      {Object.entries((outreachResults as { analysis: { health_distribution: Record<string, number> } }).analysis.health_distribution).map(([status, count]) => (
                        <div key={status} className="text-center">
                          <div className={`text-lg font-bold ${
                            status === 'hot' ? 'text-red-400' :
                            status === 'warm' ? 'text-orange-400' :
                            status === 'cooling' ? 'text-blue-400' :
                            'text-zinc-400'
                          }`}>
                            {count}
                          </div>
                          <div className="text-xs text-zinc-500 capitalize">{status}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(outreachResults as { analysis: { at_risk_relationships?: Array<{ name: string; reason: string; urgency: string }> } }).analysis.at_risk_relationships && (outreachResults as { analysis: { at_risk_relationships: Array<{ name: string; reason: string; urgency: string }> } }).analysis.at_risk_relationships.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-700">
                      <h5 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        At Risk Relationships
                      </h5>
                      <div className="space-y-2">
                        {(outreachResults as { analysis: { at_risk_relationships: Array<{ name: string; reason: string; urgency: string }> } }).analysis.at_risk_relationships.map((contact, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-300">{contact.name}</span>
                            <Badge className={
                              contact.urgency === 'high' ? 'bg-red-500/20 text-red-400' :
                              contact.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-zinc-500/20 text-zinc-400'
                            }>
                              {contact.urgency}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(outreachResults as { drafts?: Array<{ contact_name: string; type: string; subject?: string; content: string }> })?.drafts && (outreachResults as { drafts: Array<{ contact_name: string; type: string; subject?: string; content: string }> }).drafts.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-zinc-300">Drafted Communications</h4>
                  {(outreachResults as { drafts: Array<{ contact_name: string; type: string; subject?: string; content: string }> }).drafts.map((draft, idx) => (
                    <div key={idx} className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-zinc-200">To: {draft.contact_name}</span>
                        <Badge variant="outline" className="text-xs">{draft.type}</Badge>
                      </div>
                      {draft.subject && (
                        <p className="text-sm text-zinc-400 mb-2">Subject: {draft.subject}</p>
                      )}
                      <p className="text-sm text-zinc-400 whitespace-pre-wrap">{draft.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {(outreachResults as { recommendations?: Array<{ priority: string; recommendation: string; rationale: string }> })?.recommendations && (outreachResults as { recommendations: Array<{ priority: string; recommendation: string; rationale: string }> }).recommendations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-zinc-300">Recommendations</h4>
                  {(outreachResults as { recommendations: Array<{ priority: string; recommendation: string; rationale: string }> }).recommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 bg-zinc-800 rounded-lg flex items-start gap-3">
                      <Badge className={
                        rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-zinc-500/20 text-zinc-400'
                      }>
                        {rec.priority}
                      </Badge>
                      <div>
                        <p className="text-sm text-zinc-200">{rec.recommendation}</p>
                        <p className="text-xs text-zinc-500 mt-1">{rec.rationale}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="p-4 rounded-full bg-pink-500/10 mb-4">
                <Users className="h-10 w-10 text-pink-500" />
              </div>
              <h3 className="text-lg font-medium text-zinc-200 mb-2">
                Relationship Management
              </h3>
              <p className="text-zinc-400 max-w-md">
                I monitor your relationships, draft personalized outreach, and help you stay connected
                with funders, partners, and stakeholders. Run a health check to get started.
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )

  const renderPlaceholderInterface = () => (
    <Card className="bg-zinc-900 border-zinc-800 h-[700px] flex flex-col items-center justify-center">
      <div className="text-center p-8">
        {currentAgent && (
          <>
            <div
              className={`p-4 rounded-full bg-${currentAgent.color}-500/10 mx-auto mb-4 w-fit`}
            >
              <currentAgent.icon
                className={`h-10 w-10 text-${currentAgent.color}-500`}
              />
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="text-lg font-medium text-zinc-200">
                {currentAgent.name}
              </h3>
              {getAutonomyBadge(currentAgent.autonomyLevel)}
            </div>
            <p className="text-zinc-400 max-w-md mb-6">{currentAgent.description}</p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {currentAgent.capabilities.map((cap) => (
                <Badge
                  key={cap}
                  variant="secondary"
                  className="bg-zinc-800 text-zinc-400"
                >
                  {cap}
                </Badge>
              ))}
            </div>
            {currentAgent.canTakeActions && currentAgent.actions.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-zinc-300 mb-2">Can Take Actions:</h4>
                <div className="flex flex-wrap justify-center gap-2">
                  {currentAgent.actions.map((action) => (
                    <Badge
                      key={action}
                      className="bg-emerald-500/20 text-emerald-400"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      {action}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <p className="text-sm text-zinc-500">
              This agent is available throughout the app. Use it from the relevant
              context (RFPs, Proposals, Ideas, etc.)
            </p>
          </>
        )}
      </div>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Agent Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Bot className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{AGENTS.length}</p>
                <p className="text-xs text-zinc-500">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">
                  {AGENTS.filter(a => a.autonomyLevel === 'autonomous').length}
                </p>
                <p className="text-xs text-zinc-500">Autonomous</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{agentLogs.length}</p>
                <p className="text-xs text-zinc-500">Recent Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">
                  {agentLogs.filter(l => l.status === 'success').length}
                </p>
                <p className="text-xs text-zinc-500">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="agents" className="data-[state=active]:bg-zinc-800">
            <Bot className="h-4 w-4 mr-2" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="data-[state=active]:bg-zinc-800">
            <BellRing className="h-4 w-4 mr-2" />
            Suggestions
            {suggestions.length > 0 && (
              <Badge className="ml-2 bg-amber-500/20 text-amber-400 text-xs">{suggestions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-zinc-800">
            <Activity className="h-4 w-4 mr-2" />
            Activity Log
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-zinc-800">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Agent Selector - Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <div className="space-y-2">
                {AGENTS.map((agent) => {
                  const Icon = agent.icon
                  const isSelected = selectedAgent === agent.id
                  const colorClasses: Record<string, string> = {
                    amber: 'bg-amber-500/20 text-amber-500 border-amber-500',
                    blue: 'bg-blue-500/20 text-blue-500 border-blue-500',
                    green: 'bg-green-500/20 text-green-500 border-green-500',
                    purple: 'bg-purple-500/20 text-purple-500 border-purple-500',
                    yellow: 'bg-yellow-500/20 text-yellow-500 border-yellow-500',
                    emerald: 'bg-emerald-500/20 text-emerald-500 border-emerald-500',
                    pink: 'bg-pink-500/20 text-pink-500 border-pink-500',
                  }

                  return (
                    <Card
                      key={agent.id}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? `bg-zinc-800 border-${agent.color}-500/50 ring-1 ring-${agent.color}-500/30`
                          : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50'
                      }`}
                      onClick={() => setSelectedAgent(agent.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              isSelected ? colorClasses[agent.color] : 'bg-zinc-800'
                            }`}
                          >
                            <Icon className={`h-5 w-5 ${isSelected ? '' : 'text-zinc-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3
                                className={`font-medium ${
                                  isSelected ? 'text-zinc-100' : 'text-zinc-300'
                                }`}
                              >
                                {agent.name}
                              </h3>
                              {agent.featured && (
                                <Badge className="bg-amber-500/20 text-amber-500 text-xs">
                                  Featured
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                              {agent.description}
                            </p>
                            <div className="mt-2">
                              {getAutonomyBadge(agent.autonomyLevel)}
                            </div>
                          </div>
                          {isSelected && (
                            <ChevronRight className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Main Agent Interface */}
            <div className="lg:col-span-3">
              {renderAgentInterface()}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Agent Activity Log</CardTitle>
              <CardDescription>Recent actions taken by your AI agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {agentLogs.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No agent activity yet</p>
                  </div>
                ) : (
                  agentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-3 bg-zinc-800 rounded-lg"
                    >
                      <div className={`p-2 rounded-lg ${
                        log.status === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {log.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.agent_type.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm text-zinc-300">{log.action}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{log.output_summary}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                          <Clock className="h-3 w-3" />
                          {log.duration_ms}ms
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(log.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-zinc-100">AI Suggestions</CardTitle>
                  <CardDescription>Proactive insights and recommendations from your agents</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateSuggestions}
                  disabled={isLoading}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                  Generate Suggestions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {suggestions.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <BellRing className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No suggestions yet</p>
                    <p className="text-xs mt-1">Click &quot;Generate Suggestions&quot; to get AI insights</p>
                  </div>
                ) : (
                  suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="p-4 bg-zinc-800 rounded-lg border border-zinc-700"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={
                              suggestion.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                              suggestion.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              suggestion.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-zinc-500/20 text-zinc-400'
                            }>
                              {suggestion.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {suggestion.suggestionType}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-zinc-200 mb-1">{suggestion.title}</h4>
                          <p className="text-sm text-zinc-400">{suggestion.content}</p>
                          {suggestion.triggerReason && (
                            <p className="text-xs text-zinc-500 mt-2">
                              Triggered by: {suggestion.triggerReason}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissSuggestion(suggestion.id)}
                          className="text-zinc-500 hover:text-zinc-300"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-100">Agent Settings</CardTitle>
              <CardDescription>Configure how agents access and use context</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Context Mode */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-zinc-300">Context Mode</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => updateContextMode('full')}
                    className={`p-4 rounded-lg border transition-all ${
                      contextSettings.contextMode === 'full'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Unlock className="h-5 w-5 mx-auto mb-2" />
                    <div className="font-medium">Full</div>
                    <p className="text-xs mt-1 opacity-70">Cross-workspace context</p>
                  </button>
                  <button
                    onClick={() => updateContextMode('focused')}
                    className={`p-4 rounded-lg border transition-all ${
                      contextSettings.contextMode === 'focused'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <Lock className="h-5 w-5 mx-auto mb-2" />
                    <div className="font-medium">Focused</div>
                    <p className="text-xs mt-1 opacity-70">This workspace only</p>
                  </button>
                  <button
                    onClick={() => updateContextMode('minimal')}
                    className={`p-4 rounded-lg border transition-all ${
                      contextSettings.contextMode === 'minimal'
                        ? 'bg-zinc-500/20 border-zinc-500/50 text-zinc-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <EyeOff className="h-5 w-5 mx-auto mb-2" />
                    <div className="font-medium">Minimal</div>
                    <p className="text-xs mt-1 opacity-70">Limited context</p>
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  {contextSettings.contextMode === 'full' && 'Agents can see data across all your workspaces for comprehensive insights.'}
                  {contextSettings.contextMode === 'focused' && 'Agents only see this workspace - ideal for client confidentiality.'}
                  {contextSettings.contextMode === 'minimal' && 'Agents have minimal context - fastest responses with least data.'}
                </p>
              </div>

              {/* Memory Settings */}
              <div className="space-y-4 pt-4 border-t border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300">Memory & History</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-zinc-300">Conversation Memory</Label>
                      <p className="text-xs text-zinc-500">Remember past conversations</p>
                    </div>
                    <Switch
                      checked={contextSettings.includeConversationHistory}
                      onCheckedChange={(checked) => {
                        const newSettings = { ...contextSettings, includeConversationHistory: checked }
                        setContextSettings(newSettings)
                        fetch('/api/agents/context', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ workspaceId, settings: newSettings }),
                        })
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-zinc-300">Show Suggestions</Label>
                      <p className="text-xs text-zinc-500">Inject active suggestions into context</p>
                    </div>
                    <Switch
                      checked={contextSettings.includeSuggestions}
                      onCheckedChange={(checked) => {
                        const newSettings = { ...contextSettings, includeSuggestions: checked }
                        setContextSettings(newSettings)
                        fetch('/api/agents/context', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ workspaceId, settings: newSettings }),
                        })
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Current Mode Indicator */}
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-3">
                  {contextSettings.contextMode === 'full' ? (
                    <Eye className="h-5 w-5 text-emerald-400" />
                  ) : contextSettings.contextMode === 'focused' ? (
                    <Lock className="h-5 w-5 text-amber-400" />
                  ) : (
                    <EyeOff className="h-5 w-5 text-zinc-400" />
                  )}
                  <div>
                    <p className="text-sm text-zinc-300">
                      Currently in <span className="font-medium capitalize">{contextSettings.contextMode}</span> mode
                    </p>
                    <p className="text-xs text-zinc-500">
                      {contextSettings.includeConversationHistory ? 'Memory enabled' : 'Memory disabled'} ·
                      {contextSettings.includeSuggestions ? ' Suggestions enabled' : ' Suggestions disabled'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

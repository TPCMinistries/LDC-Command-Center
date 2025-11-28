'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Wand2,
  BookOpen,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Video,
  Loader2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Mail,
  FileEdit,
  MessageSquare,
} from 'lucide-react'
import { ContentEditorPanel } from './ContentEditorPanel'
import { toast } from 'sonner'

interface ContentGeneratorProps {
  sourceType: string
  sourceId: string
  workspaceId: string
  sourceTitle?: string
  showSermon?: boolean // Only show for ministry workspace
}

type ContentType = 'sermon_outline' | 'email' | 'blog' | 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'tiktok'

interface GeneratedContent {
  contentId?: string
  contentType: ContentType
  content: Record<string, unknown>
  rawText: string
}

const CONTENT_OPTIONS: {
  type: ContentType
  label: string
  icon: typeof Facebook
  color: string
  description: string
  ministryOnly?: boolean
}[] = [
  {
    type: 'sermon_outline',
    label: 'Sermon',
    icon: BookOpen,
    color: 'text-amber-400 border-amber-500/50 hover:bg-amber-500/20',
    description: 'Full outline with points',
    ministryOnly: true,
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    color: 'text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/20',
    description: 'Newsletter message',
  },
  {
    type: 'blog',
    label: 'Blog',
    icon: FileEdit,
    color: 'text-violet-400 border-violet-500/50 hover:bg-violet-500/20',
    description: 'SEO article',
  },
  {
    type: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    color: 'text-blue-400 border-blue-500/50 hover:bg-blue-500/20',
    description: 'Discussion post',
  },
  {
    type: 'instagram',
    label: 'Instagram',
    icon: Instagram,
    color: 'text-pink-400 border-pink-500/50 hover:bg-pink-500/20',
    description: 'Caption + hashtags',
  },
  {
    type: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    color: 'text-sky-400 border-sky-500/50 hover:bg-sky-500/20',
    description: 'Thought leadership',
  },
  {
    type: 'twitter',
    label: 'X / Twitter',
    icon: Twitter,
    color: 'text-zinc-300 border-zinc-500/50 hover:bg-zinc-500/20',
    description: 'Tweet or thread',
  },
  {
    type: 'tiktok',
    label: 'TikTok',
    icon: Video,
    color: 'text-rose-400 border-rose-500/50 hover:bg-rose-500/20',
    description: 'Video script',
  },
]

export function ContentGenerator({
  sourceType,
  sourceId,
  workspaceId,
  sourceTitle,
  showSermon = false,
}: ContentGeneratorProps) {
  const [generating, setGenerating] = useState<ContentType | null>(null)
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([])
  const [expandedContent, setExpandedContent] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<{
    id: string
    contentId?: string
    contentType: ContentType
    rawText: string
  } | null>(null)

  const filteredOptions = CONTENT_OPTIONS.filter(
    opt => showSermon || !opt.ministryOnly
  )

  const handleGenerate = async (contentType: ContentType) => {
    setGenerating(contentType)

    try {
      const response = await fetch('/api/agents/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          sourceId,
          contentType,
          workspaceId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Generation failed')
      }

      const data = await response.json()

      setGeneratedContent(prev => [
        {
          contentId: data.contentId,
          contentType,
          content: data.content,
          rawText: data.rawText,
        },
        ...prev,
      ])

      setExpandedContent(data.contentId || contentType)

      toast.success(`${contentType === 'sermon_outline' ? 'Sermon outline' : 'Social post'} generated!`, {
        description: 'Your content is ready to review and use.',
      })
    } catch (error) {
      toast.error('Generation failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setGenerating(null)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedContent(expandedContent === id ? null : id)
  }

  const handleContentUpdate = (newContent: string, itemId: string) => {
    setGeneratedContent(prev =>
      prev.map(item => {
        const id = item.contentId || `${item.contentType}-${prev.indexOf(item)}`
        if (id === itemId) {
          return { ...item, rawText: newContent }
        }
        return item
      })
    )
  }

  const openEditor = (item: GeneratedContent, index: number) => {
    const id = item.contentId || `${item.contentType}-${index}`
    setEditingContent({
      id,
      contentId: item.contentId,
      contentType: item.contentType,
      rawText: item.rawText,
    })
  }

  return (
    <div className="space-y-6">
      {/* Generate Buttons */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-zinc-100 text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Generate Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredOptions.map((option) => {
              const Icon = option.icon
              const isGenerating = generating === option.type

              return (
                <Button
                  key={option.type}
                  variant="outline"
                  className={`${option.color} justify-start h-auto py-3 px-4`}
                  onClick={() => handleGenerate(option.type)}
                  disabled={generating !== null}
                >
                  {isGenerating ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Icon className="h-5 w-5 mr-2" />
                  )}
                  <div className="text-left">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs opacity-70 font-normal hidden sm:block">
                      {option.description}
                    </div>
                  </div>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Generated Content */}
      {generatedContent.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-zinc-100">Generated Content</h3>

          {generatedContent.map((item, index) => {
            const option = CONTENT_OPTIONS.find(o => o.type === item.contentType)
            const Icon = option?.icon || Wand2
            const id = item.contentId || `${item.contentType}-${index}`
            const isExpanded = expandedContent === id

            return (
              <Card key={id} className="bg-zinc-900 border-zinc-800">
                <CardHeader
                  className="pb-3 cursor-pointer"
                  onClick={() => toggleExpand(id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${option?.color.split(' ')[0]}`} />
                      <div>
                        <CardTitle className="text-zinc-100 text-base">
                          {option?.label || item.contentType}
                        </CardTitle>
                        {sourceTitle && (
                          <p className="text-xs text-zinc-500">From: {sourceTitle}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                        Draft
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-zinc-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-zinc-400" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-600/50 text-amber-400 hover:bg-amber-600/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditor(item, index)
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Edit with AI
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-700"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(item.rawText, id)
                        }}
                      >
                        {copiedId === id ? (
                          <>
                            <Check className="h-4 w-4 mr-2 text-green-500" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Content Display */}
                    {item.contentType === 'sermon_outline' ? (
                      <SermonOutlineDisplay content={item.content} />
                    ) : item.contentType === 'email' ? (
                      <EmailDisplay content={item.content} />
                    ) : item.contentType === 'blog' ? (
                      <BlogPostDisplay content={item.content} />
                    ) : (
                      <SocialPostDisplay content={item.content} rawText={item.rawText} />
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Content Editor Panel */}
      <ContentEditorPanel
        isOpen={editingContent !== null}
        onClose={() => setEditingContent(null)}
        contentId={editingContent?.contentId}
        contentType={editingContent?.contentType || 'facebook'}
        currentContent={editingContent?.rawText || ''}
        workspaceId={workspaceId}
        onContentUpdate={(newContent) => {
          if (editingContent) {
            handleContentUpdate(newContent, editingContent.id)
          }
        }}
      />
    </div>
  )
}

// Helper to render nested object content nicely
function renderValue(value: unknown, depth = 0): React.ReactNode {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-4 space-y-1">
        {value.map((item, i) => (
          <li key={i}>{renderValue(item, depth + 1)}</li>
        ))}
      </ul>
    )
  }
  if (typeof value === 'object') {
    return (
      <div className={depth > 0 ? 'pl-4 border-l border-zinc-700 ml-2' : ''}>
        {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
          <div key={key} className="mb-2">
            <span className="text-zinc-400 capitalize font-medium">{key.replace(/_/g, ' ')}:</span>{' '}
            {typeof val === 'object' ? <div className="mt-1">{renderValue(val, depth + 1)}</div> : renderValue(val, depth + 1)}
          </div>
        ))}
      </div>
    )
  }
  return String(value)
}

// Sermon Outline Display Component
function SermonOutlineDisplay({ content }: { content: Record<string, unknown> }) {
  // Check if content.raw exists and try to parse it as JSON first
  const data = content.raw ? (() => {
    try {
      const parsed = JSON.parse(String(content.raw).replace(/```json\n?|\n?```/g, ''))
      return parsed
    } catch {
      return content
    }
  })() : content

  return (
    <div className="space-y-5 text-zinc-300">
      {/* Title */}
      {data.title && (
        <div className="border-b border-zinc-700 pb-3">
          <h3 className="text-xl font-bold text-zinc-100">{String(data.title)}</h3>
          {data.theme && (
            <p className="text-amber-400 mt-1 italic">{String(data.theme)}</p>
          )}
        </div>
      )}

      {/* Scripture Foundation */}
      {data.scripture_foundation && (
        <div className="bg-amber-900/20 border border-amber-700/30 p-4 rounded-lg">
          <h4 className="font-semibold text-amber-400 mb-2 text-sm uppercase tracking-wide">Scripture Foundation</h4>
          {typeof data.scripture_foundation === 'object' ? (
            <div className="space-y-2">
              {(data.scripture_foundation as Record<string, unknown>).primary_passage && (
                <p className="font-medium text-zinc-100">{String((data.scripture_foundation as Record<string, unknown>).primary_passage)}</p>
              )}
              {(data.scripture_foundation as Record<string, unknown>).text && (
                <p className="text-zinc-300 italic">&ldquo;{String((data.scripture_foundation as Record<string, unknown>).text)}&rdquo;</p>
              )}
              {(data.scripture_foundation as Record<string, unknown>).context && (
                <p className="text-zinc-400 text-sm">{String((data.scripture_foundation as Record<string, unknown>).context)}</p>
              )}
            </div>
          ) : (
            <p>{String(data.scripture_foundation)}</p>
          )}
        </div>
      )}

      {/* Introduction */}
      {data.introduction && (
        <div>
          <h4 className="font-semibold text-amber-400 mb-2 text-sm uppercase tracking-wide">Introduction</h4>
          <div className="bg-zinc-800 p-4 rounded-lg space-y-3">
            {typeof data.introduction === 'object' ? (
              <>
                {(data.introduction as Record<string, unknown>).opening_hook && (
                  <div>
                    <span className="text-zinc-500 text-xs uppercase">Opening Hook:</span>
                    <p className="mt-1">{String((data.introduction as Record<string, unknown>).opening_hook)}</p>
                  </div>
                )}
                {(data.introduction as Record<string, unknown>).bridge && (
                  <div>
                    <span className="text-zinc-500 text-xs uppercase">Bridge:</span>
                    <p className="mt-1">{String((data.introduction as Record<string, unknown>).bridge)}</p>
                  </div>
                )}
                {(data.introduction as Record<string, unknown>).preview && (
                  <div>
                    <span className="text-zinc-500 text-xs uppercase">Preview:</span>
                    <p className="mt-1">{String((data.introduction as Record<string, unknown>).preview)}</p>
                  </div>
                )}
              </>
            ) : (
              <p>{String(data.introduction)}</p>
            )}
          </div>
        </div>
      )}

      {/* Main Points */}
      {data.main_points && Array.isArray(data.main_points) && (
        <div>
          <h4 className="font-semibold text-amber-400 mb-3 text-sm uppercase tracking-wide">Main Points</h4>
          <div className="space-y-4">
            {data.main_points.map((point: unknown, i: number) => {
              const p = point as Record<string, unknown>
              return (
                <div key={i} className="bg-zinc-800 p-4 rounded-lg border-l-4 border-amber-500">
                  <h5 className="font-bold text-zinc-100 text-lg mb-3">
                    {i + 1}. {p.point_title || p.title || `Point ${i + 1}`}
                  </h5>
                  <div className="space-y-3 text-sm">
                    {p.supporting_scripture && (
                      <div className="bg-zinc-900/50 p-2 rounded text-amber-300">
                        <span className="text-zinc-500 text-xs uppercase">Scripture: </span>
                        {String(p.supporting_scripture)}
                      </div>
                    )}
                    {p.explanation && (
                      <div>
                        <span className="text-zinc-500 text-xs uppercase">Explanation:</span>
                        <p className="mt-1">{String(p.explanation)}</p>
                      </div>
                    )}
                    {p.illustration && (
                      <div>
                        <span className="text-zinc-500 text-xs uppercase">Illustration:</span>
                        <p className="mt-1 italic text-zinc-400">{String(p.illustration)}</p>
                      </div>
                    )}
                    {p.application && (
                      <div className="bg-green-900/20 p-2 rounded border border-green-700/30">
                        <span className="text-green-400 text-xs uppercase">Application:</span>
                        <p className="mt-1 text-green-300">{String(p.application)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Conclusion */}
      {data.conclusion && (
        <div>
          <h4 className="font-semibold text-amber-400 mb-2 text-sm uppercase tracking-wide">Conclusion</h4>
          <div className="bg-zinc-800 p-4 rounded-lg">
            {typeof data.conclusion === 'object' ? (
              <div className="space-y-2">
                {Object.entries(data.conclusion as Record<string, unknown>).map(([key, val]) => (
                  <div key={key}>
                    <span className="text-zinc-500 text-xs uppercase">{key.replace(/_/g, ' ')}:</span>
                    <p className="mt-1">{String(val)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>{String(data.conclusion)}</p>
            )}
          </div>
        </div>
      )}

      {/* Additional Resources */}
      {data.additional_resources && (
        <div>
          <h4 className="font-semibold text-amber-400 mb-2 text-sm uppercase tracking-wide">Additional Resources</h4>
          <div className="bg-zinc-800 p-4 rounded-lg">
            {renderValue(data.additional_resources)}
          </div>
        </div>
      )}
    </div>
  )
}

// Social Post Display Component
function SocialPostDisplay({ content, rawText }: { content: Record<string, unknown>; rawText: string }) {
  return (
    <div className="space-y-4">
      {/* Main Post */}
      <div className="bg-zinc-800 p-4 rounded-lg">
        <p className="text-zinc-200 whitespace-pre-wrap">
          {content.post ? String(content.post) : rawText}
        </p>
      </div>

      {/* Hashtags */}
      {content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-2">Hashtags</h4>
          <div className="flex flex-wrap gap-2">
            {content.hashtags.map((tag: unknown, i: number) => (
              <span
                key={i}
                className="px-2 py-1 bg-zinc-800 text-blue-400 text-sm rounded"
              >
                {String(tag).startsWith('#') ? String(tag) : `#${tag}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Image Idea */}
      {content.imageIdea && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-1">Visual Suggestion</h4>
          <p className="text-zinc-300 text-sm">{String(content.imageIdea)}</p>
        </div>
      )}

      {/* Best Time to Post */}
      {content.bestTimeToPost && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-1">Best Time to Post</h4>
          <p className="text-zinc-300 text-sm">{String(content.bestTimeToPost)}</p>
        </div>
      )}

      {/* Engagement Tip */}
      {content.engagementTip && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-1">Engagement Tip</h4>
          <p className="text-zinc-300 text-sm">{String(content.engagementTip)}</p>
        </div>
      )}
    </div>
  )
}

// Email Display Component
function EmailDisplay({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-4 text-zinc-300">
      {/* Subject Line */}
      {content.subject && (
        <div className="bg-emerald-900/20 border border-emerald-700/30 p-3 rounded-lg">
          <h4 className="text-xs font-medium text-emerald-400 mb-1">Subject Line</h4>
          <p className="text-lg font-medium text-zinc-100">{String(content.subject)}</p>
        </div>
      )}

      {/* Preview Text */}
      {content.previewText && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-1">Preview Text</h4>
          <p className="text-zinc-400 text-sm italic">{String(content.previewText)}</p>
        </div>
      )}

      {/* Email Body */}
      {content.body && (
        <div className="bg-zinc-800 p-4 rounded-lg">
          <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed">
            {String(content.body)}
          </p>
        </div>
      )}

      {/* P.S. */}
      {content.ps && (
        <div className="bg-zinc-800/50 p-3 rounded-lg border-l-2 border-emerald-500">
          <p className="text-zinc-300 italic">P.S. {String(content.ps)}</p>
        </div>
      )}

      {/* Call to Action */}
      {content.callToAction && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-1">Call to Action</h4>
          <p className="text-emerald-400 text-sm">{String(content.callToAction)}</p>
        </div>
      )}
    </div>
  )
}

// Blog Post Display Component
function BlogPostDisplay({ content }: { content: Record<string, unknown> }) {
  return (
    <div className="space-y-4 text-zinc-300">
      {/* Title */}
      {content.title && (
        <div>
          <h4 className="text-xs font-medium text-violet-400 mb-1">Title</h4>
          <p className="text-xl font-bold text-zinc-100">{String(content.title)}</p>
        </div>
      )}

      {/* Meta Description */}
      {content.metaDescription && (
        <div className="bg-violet-900/20 border border-violet-700/30 p-3 rounded-lg">
          <h4 className="text-xs font-medium text-violet-400 mb-1">Meta Description (SEO)</h4>
          <p className="text-zinc-300 text-sm">{String(content.metaDescription)}</p>
        </div>
      )}

      {/* Blog Body */}
      {content.body && (
        <div className="bg-zinc-800 p-4 rounded-lg prose prose-invert prose-zinc max-w-none">
          <div className="text-zinc-200 whitespace-pre-wrap leading-relaxed">
            {String(content.body)}
          </div>
        </div>
      )}

      {/* Keywords */}
      {content.keywords && Array.isArray(content.keywords) && content.keywords.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-2">SEO Keywords</h4>
          <div className="flex flex-wrap gap-2">
            {content.keywords.map((keyword: unknown, i: number) => (
              <span
                key={i}
                className="px-2 py-1 bg-violet-600/20 text-violet-400 text-sm rounded border border-violet-600/30"
              >
                {String(keyword)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Call to Action */}
      {content.callToAction && (
        <div>
          <h4 className="text-sm font-medium text-zinc-400 mb-1">Closing CTA</h4>
          <p className="text-violet-400 text-sm">{String(content.callToAction)}</p>
        </div>
      )}
    </div>
  )
}

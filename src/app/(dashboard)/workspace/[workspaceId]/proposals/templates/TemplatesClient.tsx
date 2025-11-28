'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  TemplateBuilder,
  ProposalTemplate,
  TemplateSection,
} from '@/components/proposals/TemplateBuilder'
import {
  ArrowLeft,
  Plus,
  Search,
  FileText,
  Copy,
  Edit2,
  Trash2,
  MoreVertical,
  FileStack,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

interface TemplatesClientProps {
  workspaceId: string
  workspaceName: string
  userId: string
}

interface Template {
  id: string
  name: string
  description?: string
  category: string
  sections: TemplateSection[]
  boilerplate?: Record<string, string>
  is_default?: boolean
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  federal: 'Federal Grant',
  city: 'City Agency',
  foundation: 'Foundation',
  general: 'General',
  custom: 'Custom',
}

const CATEGORY_COLORS: Record<string, string> = {
  federal: 'bg-blue-500/20 text-blue-400',
  city: 'bg-purple-500/20 text-purple-400',
  foundation: 'bg-green-500/20 text-green-400',
  general: 'bg-zinc-500/20 text-zinc-400',
  custom: 'bg-amber-500/20 text-amber-400',
}

export function TemplatesClient({
  workspaceId,
  workspaceName,
}: TemplatesClientProps) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [defaultTemplates, setDefaultTemplates] = useState<Record<string, Template>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [cloneFromDefault, setCloneFromDefault] = useState<string | null>(null)

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/proposals/templates?workspaceId=${workspaceId}&includeDefaults=true`
      )
      if (!res.ok) throw new Error('Failed to fetch templates')

      const data = await res.json()
      setTemplates(data.templates || [])
      setDefaultTemplates(data.defaults || {})
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setIsLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory =
      categoryFilter === 'all' || template.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  // Get custom templates vs default templates
  const customTemplates = filteredTemplates.filter((t) => !t.is_default)
  const defaultTemplatesList = Object.entries(defaultTemplates).map(([key, t]) => ({
    ...t,
    id: `default-${key}`,
    is_default: true,
  }))

  // Save template handler
  const handleSaveTemplate = async (templateData: ProposalTemplate) => {
    try {
      let res: Response

      if (editingTemplate && !editingTemplate.is_default) {
        // Update existing template
        res = await fetch('/api/proposals/templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: editingTemplate.id,
            workspaceId,
            ...templateData,
          }),
        })
      } else if (cloneFromDefault) {
        // Clone from default
        res = await fetch('/api/proposals/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            cloneDefault: cloneFromDefault,
            ...templateData,
          }),
        })
      } else {
        // Create new template
        res = await fetch('/api/proposals/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            ...templateData,
          }),
        })
      }

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save template')
      }

      setShowBuilder(false)
      setEditingTemplate(null)
      setCloneFromDefault(null)
      fetchTemplates()
    } catch (error) {
      console.error('Error saving template:', error)
      throw error
    }
  }

  // Delete template handler
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const res = await fetch(
        `/api/proposals/templates?templateId=${templateId}&workspaceId=${workspaceId}`,
        { method: 'DELETE' }
      )

      if (!res.ok) throw new Error('Failed to delete template')
      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  // Clone default template
  const handleCloneDefault = (defaultKey: string) => {
    const defaultTemplate = defaultTemplates[defaultKey]
    if (!defaultTemplate) return

    setCloneFromDefault(defaultKey)
    setEditingTemplate({
      id: '',
      name: `${defaultTemplate.name} (Custom)`,
      description: defaultTemplate.description,
      category: defaultTemplate.category,
      sections: defaultTemplate.sections as TemplateSection[],
    })
    setShowBuilder(true)
  }

  // Edit custom template
  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template)
    setCloneFromDefault(null)
    setShowBuilder(true)
  }

  // Create new template
  const handleCreateNew = () => {
    setEditingTemplate(null)
    setCloneFromDefault(null)
    setShowBuilder(true)
  }

  if (showBuilder) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => {
              setShowBuilder(false)
              setEditingTemplate(null)
              setCloneFromDefault(null)
            }}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </div>
        <TemplateBuilder
          template={
            editingTemplate
              ? {
                  id: editingTemplate.is_default ? undefined : editingTemplate.id,
                  name: editingTemplate.name,
                  description: editingTemplate.description,
                  category: editingTemplate.category,
                  sections: editingTemplate.sections,
                  boilerplate: editingTemplate.boilerplate,
                }
              : undefined
          }
          onSave={handleSaveTemplate}
          onCancel={() => {
            setShowBuilder(false)
            setEditingTemplate(null)
            setCloneFromDefault(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/workspace/${workspaceId}/proposals`}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">
              Proposal Templates
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Manage templates for {workspaceName}
            </p>
          </div>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-10 bg-zinc-900 border-zinc-800"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Custom Templates */}
          <div>
            <h2 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
              <FileStack className="h-5 w-5 text-amber-500" />
              Your Custom Templates
              <Badge variant="outline" className="ml-2">
                {customTemplates.length}
              </Badge>
            </h2>

            {customTemplates.length === 0 ? (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">No custom templates yet</p>
                  <p className="text-zinc-500 text-sm mt-1">
                    Create a new template or customize a default one
                  </p>
                  <Button className="mt-4" onClick={handleCreateNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={() => handleEditTemplate(template)}
                    onDelete={() => handleDeleteTemplate(template.id)}
                    onClone={() => {
                      setEditingTemplate({
                        ...template,
                        id: '',
                        name: `${template.name} (Copy)`,
                      })
                      setShowBuilder(true)
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Default Templates */}
          <div>
            <h2 className="text-lg font-medium text-zinc-100 mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Default Templates
              <Badge variant="outline" className="ml-2">
                {defaultTemplatesList.length}
              </Badge>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {defaultTemplatesList.map((template) => (
                <DefaultTemplateCard
                  key={template.id}
                  template={template}
                  onClone={() => handleCloneDefault(template.category)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Template Card Component
interface TemplateCardProps {
  template: Template
  onEdit: () => void
  onDelete: () => void
  onClone: () => void
}

function TemplateCard({ template, onEdit, onDelete, onClone }: TemplateCardProps) {
  const totalWords = template.sections?.reduce(
    (acc, s) => acc + (s.word_limit || 0),
    0
  ) || 0
  const requiredCount = template.sections?.filter((s) => s.required).length || 0

  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-zinc-100 text-base">{template.name}</CardTitle>
            <Badge className={CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom}>
              {CATEGORY_LABELS[template.category] || template.category}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClone}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-400">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {template.description && (
          <p className="text-sm text-zinc-400 mb-3 line-clamp-2">
            {template.description}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>{template.sections?.length || 0} sections</span>
          <span>{requiredCount} required</span>
          <span>{totalWords.toLocaleString()} words</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Default Template Card Component
interface DefaultTemplateCardProps {
  template: Template
  onClone: () => void
}

function DefaultTemplateCard({ template, onClone }: DefaultTemplateCardProps) {
  const totalWords = template.sections?.reduce(
    (acc, s) => acc + (s.word_limit || 0),
    0
  ) || 0
  const requiredCount = template.sections?.filter((s) => s.required).length || 0

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 border-dashed hover:border-zinc-700 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-zinc-300 text-base flex items-center gap-2">
              {template.name}
              <Badge variant="outline" className="text-xs">
                Default
              </Badge>
            </CardTitle>
            <Badge className={CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom}>
              {CATEGORY_LABELS[template.category] || template.category}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {template.description && (
          <p className="text-sm text-zinc-500 mb-3 line-clamp-2">
            {template.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span>{template.sections?.length || 0} sections</span>
            <span>{requiredCount} required</span>
            <span>{totalWords.toLocaleString()} words</span>
          </div>
          <Button size="sm" variant="outline" onClick={onClone}>
            <Copy className="h-4 w-4 mr-2" />
            Customize
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

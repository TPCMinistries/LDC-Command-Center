'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Save,
  Copy,
  FileText,
  AlertCircle,
  Check,
} from 'lucide-react'

// Common section types that can be added to templates
const AVAILABLE_SECTION_TYPES = [
  { type: 'cover_letter', label: 'Cover Letter', defaultLimit: 500 },
  { type: 'executive_summary', label: 'Executive Summary', defaultLimit: 1000 },
  { type: 'organizational_background', label: 'Organizational Background', defaultLimit: 1500 },
  { type: 'statement_of_need', label: 'Statement of Need', defaultLimit: 2000 },
  { type: 'program_design', label: 'Program Design', defaultLimit: 2500 },
  { type: 'implementation_plan', label: 'Implementation Plan', defaultLimit: 1500 },
  { type: 'theory_of_change', label: 'Theory of Change', defaultLimit: 1000 },
  { type: 'logic_model', label: 'Logic Model', defaultLimit: 0 },
  { type: 'staffing_plan', label: 'Staffing Plan', defaultLimit: 1500 },
  { type: 'evaluation_plan', label: 'Evaluation Plan', defaultLimit: 1500 },
  { type: 'sustainability_plan', label: 'Sustainability Plan', defaultLimit: 1000 },
  { type: 'budget_narrative', label: 'Budget Narrative', defaultLimit: 1500 },
  { type: 'budget', label: 'Budget', defaultLimit: 0 },
  { type: 'timeline', label: 'Project Timeline', defaultLimit: 0 },
  { type: 'partnerships', label: 'Partnerships & Collaborations', defaultLimit: 1000 },
  { type: 'appendix', label: 'Appendix', defaultLimit: 0 },
  { type: 'custom', label: 'Custom Section', defaultLimit: 1000 },
]

const TEMPLATE_CATEGORIES = [
  { value: 'federal', label: 'Federal Grant' },
  { value: 'city', label: 'City Agency' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'general', label: 'General' },
  { value: 'custom', label: 'Custom' },
]

export interface TemplateSection {
  id: string
  section_type: string
  title: string
  word_limit?: number
  page_limit?: number
  required: boolean
  guidance?: string
  sort_order: number
}

export interface ProposalTemplate {
  id?: string
  name: string
  description?: string
  category: string
  sections: TemplateSection[]
  boilerplate?: Record<string, string>
  created_at?: string
  updated_at?: string
}

interface TemplateBuilderProps {
  template?: ProposalTemplate
  onSave: (template: ProposalTemplate) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

export function TemplateBuilder({
  template,
  onSave,
  onCancel,
  isLoading = false,
}: TemplateBuilderProps) {
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [category, setCategory] = useState(template?.category || 'general')
  const [sections, setSections] = useState<TemplateSection[]>(
    template?.sections || []
  )
  const [boilerplate, setBoilerplate] = useState<Record<string, string>>(
    template?.boilerplate || {}
  )
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null)
  const [showAddSection, setShowAddSection] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Generate unique ID
  const generateId = () => `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Add a new section
  const handleAddSection = (sectionType: string) => {
    const sectionDef = AVAILABLE_SECTION_TYPES.find((s) => s.type === sectionType)
    if (!sectionDef) return

    const newSection: TemplateSection = {
      id: generateId(),
      section_type: sectionType,
      title: sectionDef.label,
      word_limit: sectionDef.defaultLimit || undefined,
      required: true,
      sort_order: sections.length,
    }

    setSections([...sections, newSection])
    setShowAddSection(false)
  }

  // Remove a section
  const handleRemoveSection = (sectionId: string) => {
    setSections(sections.filter((s) => s.id !== sectionId))
    // Also remove any boilerplate for this section
    const section = sections.find((s) => s.id === sectionId)
    if (section && boilerplate[section.section_type]) {
      const newBoilerplate = { ...boilerplate }
      delete newBoilerplate[section.section_type]
      setBoilerplate(newBoilerplate)
    }
  }

  // Update section
  const handleUpdateSection = (updatedSection: TemplateSection) => {
    setSections(
      sections.map((s) => (s.id === updatedSection.id ? updatedSection : s))
    )
    setEditingSection(null)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, sectionId: string) => {
    setDraggedItem(sectionId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem === targetId) return

    const draggedIndex = sections.findIndex((s) => s.id === draggedItem)
    const targetIndex = sections.findIndex((s) => s.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newSections = [...sections]
    const [removed] = newSections.splice(draggedIndex, 1)
    newSections.splice(targetIndex, 0, removed)

    // Update sort_order
    const reordered = newSections.map((s, i) => ({ ...s, sort_order: i }))
    setSections(reordered)
    setDraggedItem(null)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  // Clone a section
  const handleCloneSection = (section: TemplateSection) => {
    const clonedSection: TemplateSection = {
      ...section,
      id: generateId(),
      title: `${section.title} (Copy)`,
      sort_order: sections.length,
    }
    setSections([...sections, clonedSection])
  }

  // Validate template
  const validateTemplate = useCallback(() => {
    const newErrors: string[] = []

    if (!name.trim()) {
      newErrors.push('Template name is required')
    }

    if (sections.length === 0) {
      newErrors.push('At least one section is required')
    }

    // Check for duplicate section types (excluding custom)
    const sectionTypes = sections
      .filter((s) => s.section_type !== 'custom')
      .map((s) => s.section_type)
    const duplicates = sectionTypes.filter(
      (item, index) => sectionTypes.indexOf(item) !== index
    )
    if (duplicates.length > 0) {
      newErrors.push(`Duplicate sections: ${duplicates.join(', ')}`)
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }, [name, sections])

  // Save template
  const handleSave = async () => {
    if (!validateTemplate()) return

    setIsSaving(true)
    try {
      const templateData: ProposalTemplate = {
        id: template?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        sections: sections.map((s, i) => ({ ...s, sort_order: i })),
        boilerplate: Object.keys(boilerplate).length > 0 ? boilerplate : undefined,
      }

      await onSave(templateData)
    } catch (error) {
      console.error('Error saving template:', error)
      setErrors(['Failed to save template. Please try again.'])
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">
            {template ? 'Edit Template' : 'Create Template'}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Define sections, word limits, and requirements for your proposal template
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
            <AlertCircle className="h-4 w-4" />
            Please fix the following errors:
          </div>
          <ul className="list-disc list-inside text-sm text-red-300 space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Info */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 text-base">Template Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., DYCD Youth Program Template"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe when to use this template..."
                className="bg-zinc-800 border-zinc-700 min-h-[80px]"
              />
            </div>

            {/* Stats */}
            <div className="pt-4 border-t border-zinc-800">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-500">Sections</span>
                  <p className="text-zinc-100 font-medium">{sections.length}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Required</span>
                  <p className="text-zinc-100 font-medium">
                    {sections.filter((s) => s.required).length}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Total Words</span>
                  <p className="text-zinc-100 font-medium">
                    {sections.reduce((acc, s) => acc + (s.word_limit || 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sections Editor */}
        <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" />
              Sections
            </CardTitle>
            <Dialog open={showAddSection} onOpenChange={setShowAddSection}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Section
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800">
                <DialogHeader>
                  <DialogTitle>Add Section</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[400px] pr-4">
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_SECTION_TYPES.map((section) => {
                      const isAdded =
                        section.type !== 'custom' &&
                        sections.some((s) => s.section_type === section.type)
                      return (
                        <Button
                          key={section.type}
                          variant="outline"
                          className={`justify-start h-auto py-3 ${
                            isAdded ? 'opacity-50' : ''
                          }`}
                          onClick={() => handleAddSection(section.type)}
                          disabled={isAdded}
                        >
                          <div className="text-left">
                            <div className="font-medium">{section.label}</div>
                            {section.defaultLimit > 0 && (
                              <div className="text-xs text-zinc-500">
                                ~{section.defaultLimit} words
                              </div>
                            )}
                          </div>
                          {isAdded && (
                            <Check className="h-4 w-4 ml-auto text-green-400" />
                          )}
                        </Button>
                      )
                    })}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {sections.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No sections added yet</p>
                <p className="text-sm mt-1">
                  Click &quot;Add Section&quot; to start building your template
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {sections.map((section, index) => (
                    <div
                      key={section.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, section.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, section.id)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        draggedItem === section.id
                          ? 'opacity-50 border-amber-500 bg-amber-500/10'
                          : 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                      }`}
                    >
                      <div className="cursor-grab text-zinc-500 hover:text-zinc-300">
                        <GripVertical className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 font-mono">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="font-medium text-zinc-100 truncate">
                            {section.title}
                          </span>
                          {section.required && (
                            <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                          <span>{section.section_type}</span>
                          {section.word_limit && section.word_limit > 0 && (
                            <span>{section.word_limit.toLocaleString()} words</span>
                          )}
                          {section.page_limit && section.page_limit > 0 && (
                            <span>{section.page_limit} pages</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingSection(section)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCloneSection(section)}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveSection(section.id)}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section Edit Dialog */}
      <Dialog open={!!editingSection} onOpenChange={() => setEditingSection(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
          </DialogHeader>
          {editingSection && (
            <SectionEditor
              section={editingSection}
              boilerplate={boilerplate[editingSection.section_type] || ''}
              onSave={(updated, newBoilerplate) => {
                handleUpdateSection(updated)
                if (newBoilerplate !== undefined) {
                  setBoilerplate({
                    ...boilerplate,
                    [updated.section_type]: newBoilerplate,
                  })
                }
              }}
              onCancel={() => setEditingSection(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Section Editor Component
interface SectionEditorProps {
  section: TemplateSection
  boilerplate: string
  onSave: (section: TemplateSection, boilerplate?: string) => void
  onCancel: () => void
}

function SectionEditor({ section, boilerplate, onSave, onCancel }: SectionEditorProps) {
  const [title, setTitle] = useState(section.title)
  const [wordLimit, setWordLimit] = useState(section.word_limit?.toString() || '')
  const [pageLimit, setPageLimit] = useState(section.page_limit?.toString() || '')
  const [required, setRequired] = useState(section.required)
  const [guidance, setGuidance] = useState(section.guidance || '')
  const [sectionBoilerplate, setSectionBoilerplate] = useState(boilerplate)

  const handleSave = () => {
    const updated: TemplateSection = {
      ...section,
      title,
      word_limit: wordLimit ? parseInt(wordLimit) : undefined,
      page_limit: pageLimit ? parseInt(pageLimit) : undefined,
      required,
      guidance: guidance || undefined,
    }
    onSave(updated, sectionBoilerplate || undefined)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="section-title">Section Title</Label>
        <Input
          id="section-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-zinc-800 border-zinc-700"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="word-limit">Word Limit</Label>
          <Input
            id="word-limit"
            type="number"
            value={wordLimit}
            onChange={(e) => setWordLimit(e.target.value)}
            placeholder="e.g., 1000"
            className="bg-zinc-800 border-zinc-700"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="page-limit">Page Limit</Label>
          <Input
            id="page-limit"
            type="number"
            value={pageLimit}
            onChange={(e) => setPageLimit(e.target.value)}
            placeholder="e.g., 2"
            className="bg-zinc-800 border-zinc-700"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="required"
          checked={required}
          onCheckedChange={setRequired}
        />
        <Label htmlFor="required">Required section</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="guidance">Writing Guidance</Label>
        <Textarea
          id="guidance"
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          placeholder="Tips and instructions for writing this section..."
          className="bg-zinc-800 border-zinc-700 min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="boilerplate">Boilerplate Text</Label>
        <Textarea
          id="boilerplate"
          value={sectionBoilerplate}
          onChange={(e) => setSectionBoilerplate(e.target.value)}
          placeholder="Default content to pre-fill this section..."
          className="bg-zinc-800 border-zinc-700 min-h-[100px]"
        />
        <p className="text-xs text-zinc-500">
          This text will be pre-filled when creating a new proposal from this template
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Changes</Button>
      </div>
    </div>
  )
}

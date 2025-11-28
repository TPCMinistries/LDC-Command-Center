'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Upload,
  FileText,
  Loader2,
  Calendar,
  Building2,
  DollarSign,
  Sparkles,
  AlertCircle,
  CheckCircle,
  X,
  Plus,
} from 'lucide-react'
import { format } from 'date-fns'

interface RFPUploaderProps {
  workspaceId: string
  isOpen: boolean
  onClose: () => void
  onRfpCreated: (rfp: RfpData) => void
}

interface RfpData {
  id: string
  title: string
  agency?: string
  description?: string
  response_deadline?: string
  source_type: 'sam_gov' | 'city_state' | 'foundation' | 'other'
  document_url?: string
  requirements?: string[]
  eligibility?: Record<string, unknown>
  status: string
}

interface ExtractedData {
  title?: string
  agency?: string
  description?: string
  deadline?: string
  fundingAmount?: string
  requirements?: string[]
  eligibilityCriteria?: string[]
  keyDates?: Array<{ label: string; date: string }>
}

const SOURCE_TYPES = [
  { value: 'sam_gov', label: 'SAM.gov (Federal)' },
  { value: 'city_state', label: 'City/State Government' },
  { value: 'foundation', label: 'Private Foundation' },
  { value: 'other', label: 'Other' },
]

export function RFPUploader({ workspaceId, isOpen, onClose, onRfpCreated }: RFPUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual'>('upload')
  const [isUploading, setIsUploading] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [extractionError, setExtractionError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    agency: '',
    description: '',
    responseDeadline: '',
    fundingAmount: '',
    sourceType: 'city_state' as 'sam_gov' | 'city_state' | 'foundation' | 'other',
    sourceUrl: '',
    requirements: '',
    eligibility: '',
  })

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setUploadedFile(file)
    setIsExtracting(true)
    setExtractionError(null)

    try {
      // Upload file to storage
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('workspaceId', workspaceId)

      const uploadResponse = await fetch('/api/rfp/upload', {
        method: 'POST',
        body: formDataUpload,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      const { fileUrl } = await uploadResponse.json()

      // Extract data using AI
      const extractResponse = await fetch('/api/rfp/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl,
          fileName: file.name,
          workspaceId,
        }),
      })

      if (extractResponse.ok) {
        const { extracted } = await extractResponse.json()
        setExtractedData(extracted)

        // Pre-fill form with extracted data
        setFormData((prev) => ({
          ...prev,
          title: extracted.title || prev.title,
          agency: extracted.agency || prev.agency,
          description: extracted.description || prev.description,
          responseDeadline: extracted.deadline || prev.responseDeadline,
          fundingAmount: extracted.fundingAmount || prev.fundingAmount,
          requirements: extracted.requirements?.join('\n') || prev.requirements,
          eligibility: extracted.eligibilityCriteria?.join('\n') || prev.eligibility,
        }))
      } else {
        setExtractionError('Could not extract data from document. Please fill in manually.')
      }
    } catch (error) {
      console.error('Upload/extraction error:', error)
      setExtractionError('Failed to process document. Please fill in manually.')
    } finally {
      setIsExtracting(false)
    }
  }, [workspaceId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 25 * 1024 * 1024, // 25MB
  })

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title for the RFP')
      return
    }

    setIsUploading(true)
    try {
      const response = await fetch('/api/rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          title: formData.title,
          agency: formData.agency || null,
          description: formData.description || null,
          response_deadline: formData.responseDeadline || null,
          source_type: formData.sourceType,
          source_url: formData.sourceUrl || null,
          requirements: formData.requirements
            ? formData.requirements.split('\n').filter((r) => r.trim())
            : null,
          eligibility: formData.eligibility
            ? { criteria: formData.eligibility.split('\n').filter((e) => e.trim()) }
            : null,
          status: 'new',
        }),
      })

      if (response.ok) {
        const { rfp } = await response.json()
        onRfpCreated(rfp)
        handleClose()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create RFP')
      }
    } catch (error) {
      console.error('Error creating RFP:', error)
      alert('Failed to create RFP')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setUploadedFile(null)
    setExtractedData(null)
    setExtractionError(null)
    setFormData({
      title: '',
      agency: '',
      description: '',
      responseDeadline: '',
      fundingAmount: '',
      sourceType: 'city_state',
      sourceUrl: '',
      requirements: '',
      eligibility: '',
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Add RFP Opportunity</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Upload an RFP document to auto-extract details, or enter information manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2 bg-zinc-800">
            <TabsTrigger value="upload" className="data-[state=active]:bg-zinc-700">
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </TabsTrigger>
            <TabsTrigger value="manual" className="data-[state=active]:bg-zinc-700">
              <FileText className="h-4 w-4 mr-2" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-amber-500 bg-amber-500/10'
                  : uploadedFile
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <input {...getInputProps()} />
              {isExtracting ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                  <p className="text-zinc-400">Extracting information from document...</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Sparkles className="h-3 w-3" />
                    AI is analyzing the RFP
                  </div>
                </div>
              ) : uploadedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <p className="text-zinc-200">{uploadedFile.name}</p>
                  <p className="text-xs text-zinc-500">Click or drag to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-zinc-500" />
                  <p className="text-zinc-300">
                    {isDragActive ? 'Drop the file here' : 'Drag & drop an RFP document'}
                  </p>
                  <p className="text-xs text-zinc-500">PDF, DOC, DOCX up to 25MB</p>
                </div>
              )}
            </div>

            {extractionError && (
              <div className="flex items-center gap-2 text-yellow-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {extractionError}
              </div>
            )}

            {extractedData && (
              <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-500 text-sm mb-3">
                  <Sparkles className="h-4 w-4" />
                  AI extracted the following information
                </div>
                {extractedData.title && (
                  <p className="text-sm">
                    <span className="text-zinc-500">Title:</span>{' '}
                    <span className="text-zinc-200">{extractedData.title}</span>
                  </p>
                )}
                {extractedData.agency && (
                  <p className="text-sm">
                    <span className="text-zinc-500">Agency:</span>{' '}
                    <span className="text-zinc-200">{extractedData.agency}</span>
                  </p>
                )}
                {extractedData.deadline && (
                  <p className="text-sm">
                    <span className="text-zinc-500">Deadline:</span>{' '}
                    <span className="text-zinc-200">{extractedData.deadline}</span>
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            {/* Manual entry hint */}
            <p className="text-xs text-zinc-500 mb-4">
              Enter RFP details manually for city/state RFPs, foundation grants, or other opportunities.
            </p>
          </TabsContent>
        </Tabs>

        {/* Form fields - shown for both tabs */}
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sourceType" className="text-zinc-300">
                Source Type
              </Label>
              <Select
                value={formData.sourceType}
                onValueChange={(value) =>
                  setFormData({ ...formData, sourceType: value as typeof formData.sourceType })
                }
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {SOURCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="responseDeadline" className="text-zinc-300">
                Response Deadline
              </Label>
              <Input
                id="responseDeadline"
                type="date"
                value={formData.responseDeadline}
                onChange={(e) => setFormData({ ...formData, responseDeadline: e.target.value })}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title" className="text-zinc-300">
              RFP Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Youth Employment Services RFP"
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agency" className="text-zinc-300">
                Issuing Agency
              </Label>
              <Input
                id="agency"
                value={formData.agency}
                onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                placeholder="e.g., DYCD, DOE, Ford Foundation"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fundingAmount" className="text-zinc-300">
                Funding Amount
              </Label>
              <Input
                id="fundingAmount"
                value={formData.fundingAmount}
                onChange={(e) => setFormData({ ...formData, fundingAmount: e.target.value })}
                placeholder="e.g., $500,000"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl" className="text-zinc-300">
              Source URL (optional)
            </Label>
            <Input
              id="sourceUrl"
              type="url"
              value={formData.sourceUrl}
              onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
              placeholder="https://..."
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-zinc-300">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the opportunity..."
              rows={3}
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements" className="text-zinc-300">
              Key Requirements (one per line)
            </Label>
            <Textarea
              id="requirements"
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              placeholder="e.g.,
501(c)(3) status required
Minimum 3 years experience
..."
              rows={3}
              className="bg-zinc-800 border-zinc-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eligibility" className="text-zinc-300">
              Eligibility Criteria (one per line)
            </Label>
            <Textarea
              id="eligibility"
              value={formData.eligibility}
              onChange={(e) => setFormData({ ...formData, eligibility: e.target.value })}
              placeholder="e.g.,
Must serve NYC residents
Target population: Youth ages 14-24
..."
              rows={3}
              className="bg-zinc-800 border-zinc-700"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={handleClose} className="text-zinc-400">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isUploading || !formData.title.trim()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add RFP
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Clipboard,
  Link,
  PenLine,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Building2,
  DollarSign,
  FileText,
  Globe,
  Upload,
} from 'lucide-react'

interface GrantImporterProps {
  workspaceId: string
  isOpen: boolean
  onClose: () => void
  onGrantImported: (rfp: unknown) => void
}

interface ParsedGrant {
  title: string
  agency: string
  description: string
  deadline: string | null
  fundingAmount: string | null
  eligibility: string[]
  requirements: string[]
  contactInfo: string | null
  sourceUrl: string | null
  category: string
}

const SOURCE_TYPES = [
  { id: 'federal', label: 'Federal', color: 'bg-blue-500/20 text-blue-400' },
  { id: 'state', label: 'State', color: 'bg-purple-500/20 text-purple-400' },
  { id: 'city', label: 'City/Local', color: 'bg-green-500/20 text-green-400' },
  { id: 'foundation', label: 'Foundation', color: 'bg-amber-500/20 text-amber-400' },
  { id: 'corporate', label: 'Corporate', color: 'bg-pink-500/20 text-pink-400' },
  { id: 'other', label: 'Other', color: 'bg-zinc-500/20 text-zinc-400' },
]

export function GrantImporter({
  workspaceId,
  isOpen,
  onClose,
  onGrantImported,
}: GrantImporterProps) {
  const [activeTab, setActiveTab] = useState('paste')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [parsedGrant, setParsedGrant] = useState<ParsedGrant | null>(null)

  // Paste tab state
  const [pasteContent, setPasteContent] = useState('')
  const [pasteSourceUrl, setPasteSourceUrl] = useState('')
  const [pasteSourceType, setPasteSourceType] = useState('other')

  // URL tab state
  const [urlInput, setUrlInput] = useState('')
  const [urlSourceType, setUrlSourceType] = useState('other')

  // Manual tab state
  const [manualForm, setManualForm] = useState({
    title: '',
    agency: '',
    description: '',
    deadline: '',
    fundingAmount: '',
    sourceUrl: '',
    sourceType: 'other',
    eligibility: '',
    requirements: '',
  })

  const resetForm = () => {
    setPasteContent('')
    setPasteSourceUrl('')
    setPasteSourceType('other')
    setUrlInput('')
    setUrlSourceType('other')
    setManualForm({
      title: '',
      agency: '',
      description: '',
      deadline: '',
      fundingAmount: '',
      sourceUrl: '',
      sourceType: 'other',
      eligibility: '',
      requirements: '',
    })
    setParsedGrant(null)
    setError(null)
    setSuccess(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  // Handle paste import with AI parsing
  const handlePasteImport = async () => {
    if (!pasteContent.trim()) {
      setError('Please paste some content to import')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/rfp/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          content: pasteContent,
          sourceUrl: pasteSourceUrl || undefined,
          sourceType: pasteSourceType,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setParsedGrant(data.parsed)
      setSuccess(true)
      onGrantImported(data.rfp)

      // Auto-close after success
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle URL fetch and import
  const handleUrlImport = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Fetch the URL content
      const fetchRes = await fetch('/api/rfp/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      })

      const fetchData = await fetchRes.json()

      if (!fetchRes.ok) {
        throw new Error(fetchData.error || 'Failed to fetch URL')
      }

      // Import the fetched content
      const res = await fetch('/api/rfp/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          content: fetchData.content,
          sourceUrl: urlInput,
          sourceType: urlSourceType,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setParsedGrant(data.parsed)
      setSuccess(true)
      onGrantImported(data.rfp)

      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle manual entry
  const handleManualSubmit = async () => {
    if (!manualForm.title.trim() || !manualForm.agency.trim()) {
      setError('Title and Agency are required')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/rfp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          opportunity: {
            id: `manual-${Date.now()}`,
            title: manualForm.title,
            agency: manualForm.agency,
            description: manualForm.description,
            dueDate: manualForm.deadline || null,
            fundingAmount: manualForm.fundingAmount || null,
            sourceUrl: manualForm.sourceUrl || null,
            type: 'Grant',
            setAside: '',
            naicsCode: '',
            source: manualForm.sourceType,
            eligibility: manualForm.eligibility,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save')
      }

      setSuccess(true)
      onGrantImported(data.rfp)

      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <Upload className="h-5 w-5 text-amber-500" />
            Import Grant / RFP
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-zinc-100 mb-2">
              Grant Imported Successfully!
            </h3>
            {parsedGrant && (
              <p className="text-zinc-400">{parsedGrant.title}</p>
            )}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-zinc-800 grid grid-cols-3">
              <TabsTrigger value="paste" className="data-[state=active]:bg-amber-600/20">
                <Clipboard className="h-4 w-4 mr-2" />
                Paste Content
              </TabsTrigger>
              <TabsTrigger value="url" className="data-[state=active]:bg-amber-600/20">
                <Link className="h-4 w-4 mr-2" />
                From URL
              </TabsTrigger>
              <TabsTrigger value="manual" className="data-[state=active]:bg-amber-600/20">
                <PenLine className="h-4 w-4 mr-2" />
                Manual Entry
              </TabsTrigger>
            </TabsList>

            {/* Error display */}
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Paste Tab */}
            <TabsContent value="paste" className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">
                  Paste grant/RFP content below
                </label>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste the grant announcement, RFP details, or any relevant text here. Our AI will extract the key information automatically..."
                  className="w-full h-48 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">
                    Source URL (optional)
                  </label>
                  <Input
                    value={pasteSourceUrl}
                    onChange={(e) => setPasteSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">
                    Source Type
                  </label>
                  <select
                    value={pasteSourceType}
                    onChange={(e) => setPasteSourceType(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                  >
                    {SOURCE_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-800/50">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-amber-300">
                  AI will automatically extract title, agency, deadline, funding amount, eligibility, and requirements
                </p>
              </div>

              <Button
                onClick={handlePasteImport}
                disabled={isProcessing || !pasteContent.trim()}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Parse & Import
                  </>
                )}
              </Button>
            </TabsContent>

            {/* URL Tab */}
            <TabsContent value="url" className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">
                  Grant/RFP URL
                </label>
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://grants.gov/... or any grant page URL"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-1 block">
                  Source Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setUrlSourceType(type.id)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        urlSourceType === type.id
                          ? type.color + ' ring-2 ring-offset-2 ring-offset-zinc-900'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-900/20 border border-blue-800/50">
                <Globe className="h-4 w-4 text-blue-500" />
                <p className="text-sm text-blue-300">
                  We&apos;ll fetch the page content and use AI to extract all grant details
                </p>
              </div>

              <Button
                onClick={handleUrlImport}
                disabled={isProcessing || !urlInput.trim()}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fetching & Parsing...
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4 mr-2" />
                    Fetch & Import
                  </>
                )}
              </Button>
            </TabsContent>

            {/* Manual Tab */}
            <TabsContent value="manual" className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">
                      Title <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={manualForm.title}
                      onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                      placeholder="Grant or RFP title"
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">
                      Agency / Funder <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={manualForm.agency}
                      onChange={(e) => setManualForm({ ...manualForm, agency: e.target.value })}
                      placeholder="e.g., NYC DYCD, Ford Foundation, HHS"
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">
                      Description
                    </label>
                    <textarea
                      value={manualForm.description}
                      onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                      placeholder="Brief description of the opportunity..."
                      className="w-full h-24 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-zinc-400 mb-1 block">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Deadline
                      </label>
                      <Input
                        type="date"
                        value={manualForm.deadline}
                        onChange={(e) => setManualForm({ ...manualForm, deadline: e.target.value })}
                        className="bg-zinc-800 border-zinc-700"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400 mb-1 block">
                        <DollarSign className="h-3 w-3 inline mr-1" />
                        Funding Amount
                      </label>
                      <Input
                        value={manualForm.fundingAmount}
                        onChange={(e) => setManualForm({ ...manualForm, fundingAmount: e.target.value })}
                        placeholder="e.g., $250,000"
                        className="bg-zinc-800 border-zinc-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">
                      Source URL
                    </label>
                    <Input
                      value={manualForm.sourceUrl}
                      onChange={(e) => setManualForm({ ...manualForm, sourceUrl: e.target.value })}
                      placeholder="https://..."
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">
                      Source Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SOURCE_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setManualForm({ ...manualForm, sourceType: type.id })}
                          className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                            manualForm.sourceType === type.id
                              ? type.color + ' ring-2 ring-offset-2 ring-offset-zinc-900'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">
                      Eligibility Requirements
                    </label>
                    <textarea
                      value={manualForm.eligibility}
                      onChange={(e) => setManualForm({ ...manualForm, eligibility: e.target.value })}
                      placeholder="Who can apply? (one per line)"
                      className="w-full h-20 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">
                      Key Requirements
                    </label>
                    <textarea
                      value={manualForm.requirements}
                      onChange={(e) => setManualForm({ ...manualForm, requirements: e.target.value })}
                      placeholder="Main requirements or deliverables (one per line)"
                      className="w-full h-20 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                  </div>
                </div>
              </ScrollArea>

              <Button
                onClick={handleManualSubmit}
                disabled={isProcessing || !manualForm.title.trim() || !manualForm.agency.trim()}
                className="w-full mt-4 bg-amber-600 hover:bg-amber-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Save Grant
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

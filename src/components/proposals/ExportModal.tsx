'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Download, FileText, Loader2, CheckCircle } from 'lucide-react'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  proposalId: string
  proposalTitle: string
  workspaceId: string
}

export function ExportModal({
  isOpen,
  onClose,
  proposalId,
  proposalTitle,
  workspaceId,
}: ExportModalProps) {
  const [includeToc, setIncludeToc] = useState(true)
  const [includeCoverPage, setIncludeCoverPage] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    setExportSuccess(false)

    try {
      const params = new URLSearchParams({
        proposalId,
        workspaceId,
        format: 'docx',
        toc: includeToc.toString(),
        cover: includeCoverPage.toString(),
      })

      const response = await fetch(`/api/proposals/export?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get the blob from response
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Get filename from response headers or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `${proposalTitle.replace(/[^a-zA-Z0-9]/g, '_')}.docx`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match) filename = match[1]
      }

      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setExportSuccess(true)

      // Close after success
      setTimeout(() => {
        onClose()
        setExportSuccess(false)
      }, 1500)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export proposal. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-500" />
            Export Proposal
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Download your proposal as a formatted Word document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Proposal title */}
          <div className="p-3 rounded-lg bg-zinc-800">
            <p className="text-sm text-zinc-400">Exporting:</p>
            <p className="text-zinc-200 font-medium line-clamp-2">{proposalTitle}</p>
          </div>

          {/* Export options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="cover-page" className="text-zinc-200">
                  Include Cover Page
                </Label>
                <p className="text-xs text-zinc-500">
                  Title page with funder, amount, and deadline
                </p>
              </div>
              <Switch
                id="cover-page"
                checked={includeCoverPage}
                onCheckedChange={setIncludeCoverPage}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="toc" className="text-zinc-200">
                  Include Table of Contents
                </Label>
                <p className="text-xs text-zinc-500">
                  List of sections at the beginning
                </p>
              </div>
              <Switch
                id="toc"
                checked={includeToc}
                onCheckedChange={setIncludeToc}
              />
            </div>
          </div>

          {/* Format info */}
          <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
            <p className="text-xs text-zinc-400">
              <strong className="text-zinc-300">Format:</strong> Microsoft Word (.docx)
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Compatible with Word, Google Docs, and most document editors
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isExporting}
            className="border-zinc-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : exportSuccess ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export to DOCX
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

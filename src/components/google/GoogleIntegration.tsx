'use client'

import { useState, useEffect } from 'react'
import { Mail, Calendar, Link2, Unlink, Loader2, CheckCircle2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import Image from 'next/image'

interface GoogleIntegrationProps {
  workspaceId: string
}

interface GoogleStatus {
  connected: boolean
  email?: string
  name?: string
  picture?: string
  connectedAt?: string
  scopes?: string[]
}

export function GoogleIntegration({ workspaceId }: GoogleIntegrationProps) {
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [workspaceId])

  const checkStatus = async () => {
    try {
      const response = await fetch(`/api/google/status?workspaceId=${workspaceId}`)
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Failed to check Google status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const response = await fetch(`/api/google/connect?workspaceId=${workspaceId}`)
      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('Failed to get authorization URL')
      }
    } catch (error) {
      console.error('Connect error:', error)
      toast.error('Failed to connect to Google')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const response = await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })

      if (response.ok) {
        setStatus({ connected: false })
        toast.success('Google disconnected successfully')
      } else {
        toast.error('Failed to disconnect')
      }
    } catch (error) {
      console.error('Disconnect error:', error)
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 via-green-500 to-yellow-500 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          </div>
          <div>
            <CardTitle className="text-white">Google Integration</CardTitle>
            <CardDescription>
              Connect your Google account for Calendar and Gmail
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status?.connected ? (
          <>
            {/* Connected Status */}
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Connected</p>
                <p className="text-xs text-zinc-400">{status.email}</p>
              </div>
              {status.picture && (
                <Image
                  src={status.picture}
                  alt={status.name || 'Google profile'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
            </div>

            {/* Available Features */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-white">Calendar</p>
                  <p className="text-xs text-zinc-500">Sync events</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg">
                <Mail className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-white">Gmail</p>
                  <p className="text-xs text-zinc-500">Read & send</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="border-zinc-700 text-zinc-300 hover:text-red-400 hover:border-red-500/50"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4 mr-2" />
                )}
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Not Connected */}
            <div className="text-center py-4">
              <p className="text-sm text-zinc-400 mb-4">
                Connect your Google account to sync your calendar events and emails with LDC Command.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-zinc-800/50 rounded-lg text-left">
                  <Calendar className="w-5 h-5 text-blue-400 mb-2" />
                  <p className="text-xs text-zinc-300">View and create calendar events</p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg text-left">
                  <Mail className="w-5 h-5 text-red-400 mb-2" />
                  <p className="text-xs text-zinc-300">Read and send emails</p>
                </div>
              </div>

              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="bg-white text-zinc-900 hover:bg-zinc-200"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4 mr-2" />
                )}
                Connect Google Account
              </Button>
            </div>

            <p className="text-xs text-zinc-500 text-center">
              You will be redirected to Google to authorize access
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

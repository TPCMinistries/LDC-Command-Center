'use client'

import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-amber-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">You're Offline</h1>
          <p className="text-zinc-400">
            It looks like you've lost your internet connection.
            Some features may be unavailable until you're back online.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => window.location.reload()}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          <p className="text-xs text-zinc-500">
            LDC Command will automatically reconnect when your connection is restored.
          </p>
        </div>

        <div className="pt-8 border-t border-zinc-800">
          <p className="text-sm text-zinc-500">
            Available offline: Previously viewed pages, cached data
          </p>
        </div>
      </div>
    </div>
  )
}

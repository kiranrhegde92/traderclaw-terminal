'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, ExternalLink, Loader } from 'lucide-react'
import TerminalCard from '@/components/ui/TerminalCard'
import { useToast } from '@/components/ui/Toast'

export default function FinnhubConfig() {
  const toast = useToast()

  // State
  const [configured, setConfigured] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showInput, setShowInput] = useState(false)

  // Check if configured on mount
  useEffect(() => {
    checkConfiguration()
  }, [])

  const checkConfiguration = async () => {
    try {
      setChecking(true)
      const res = await fetch('/api/config/finnhub')
      const data = await res.json()
      setConfigured(data.configured)
    } catch (err) {
      console.error('Error checking Finnhub config:', err)
      toast.error('Failed to check Finnhub configuration')
    } finally {
      setChecking(false)
    }
  }

  const handleAddKey = async () => {
    if (!apiKey.trim()) {
      toast.warn('Please enter your API key')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/config/finnhub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to save API key')
        return
      }

      setConfigured(true)
      setApiKey('')
      setShowInput(false)
      toast.success('Finnhub API key configured! Real fundamental data is now enabled.')
    } catch (err) {
      console.error('Error saving API key:', err)
      toast.error('Failed to save API key')
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.warn('Please enter your API key first')
      return
    }

    try {
      setTestingConnection(true)
      const res = await fetch('/api/config/finnhub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Connection test failed')
        return
      }

      toast.success('✓ Connection successful! API key is valid.')
    } catch (err) {
      console.error('Error testing connection:', err)
      toast.error('Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure? This will disable real fundamental data.')) {
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/config/finnhub', {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error('Failed to disconnect')
        return
      }

      setConfigured(false)
      setApiKey('')
      setShowInput(false)
      toast.success('Finnhub API key removed. Screener will use demo data.')
    } catch (err) {
      console.error('Error disconnecting:', err)
      toast.error('Failed to disconnect')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <TerminalCard title="Finnhub Configuration" accent="green">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader className="w-4 h-4 animate-spin" />
          Checking configuration...
        </div>
      </TerminalCard>
    )
  }

  return (
    <TerminalCard title="Finnhub Configuration" accent="green">
      <div className="space-y-4">
        {/* Status Section */}
        <div className="flex items-center justify-between p-3 rounded border border-gray-700 bg-gray-900/50">
          <div className="flex items-center gap-2">
            {configured ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">✓ Live Data Enabled</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">⊘ Not Configured</span>
              </>
            )}
          </div>
          {configured && (
            <span className="text-xs text-gray-400">Real fundamental data active</span>
          )}
        </div>

        {/* Info Text */}
        <p className="text-xs text-gray-400">
          Configure your Finnhub API key to enable real fundamental data (PE, ROE, ROCE, etc.) in
          the screener. Get a free key at{' '}
          <a
            href="https://finnhub.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
          >
            finnhub.io <ExternalLink className="w-3 h-3" />
          </a>
        </p>

        {/* Input Section */}
        {!configured || showInput ? (
          <div className="space-y-3 p-3 rounded border border-gray-700 bg-gray-900/30">
            <input
              type="password"
              placeholder="Enter your Finnhub API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading && !testingConnection) {
                  handleAddKey()
                }
              }}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm text-gray-100 placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              disabled={loading || testingConnection}
            />

            <div className="flex gap-2">
              <button
                onClick={handleAddKey}
                disabled={loading || testingConnection || !apiKey.trim()}
                className="flex-1 px-3 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
                Save Key
              </button>

              <button
                onClick={handleTestConnection}
                disabled={loading || testingConnection || !apiKey.trim()}
                className="flex-1 px-3 py-2 rounded border border-gray-600 hover:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                {testingConnection ? <Loader className="w-4 h-4 animate-spin" /> : null}
                Test Connection
              </button>

              {configured && !showInput && (
                <button
                  onClick={() => setShowInput(false)}
                  disabled={loading || testingConnection}
                  className="px-3 py-2 rounded border border-gray-600 hover:border-gray-500 disabled:opacity-50 text-sm font-medium text-gray-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Configured Display */}
        {configured && !showInput && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowInput(true)}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-sm font-medium text-white transition-colors"
            >
              Update Key
            </button>

            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded border border-red-600 hover:border-red-500 hover:bg-red-600/10 disabled:opacity-50 text-sm font-medium text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-4 p-3 rounded bg-gray-900/50 border border-gray-700">
          <p className="text-xs text-gray-400 space-y-1">
            <span className="block font-medium text-gray-300">📊 What You Get:</span>
            <span className="block">
              • Real PE, ROE, ROCE ratios • Debt/Equity ratios • Dividend yields
            </span>
            <span className="block">• EPS & growth rates • Market cap data</span>
          </p>
        </div>

        {!configured && !showInput && (
          <button
            onClick={() => setShowInput(true)}
            className="w-full px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-sm font-medium text-white transition-colors"
          >
            + Add Finnhub API Key
          </button>
        )}
      </div>
    </TerminalCard>
  )
}

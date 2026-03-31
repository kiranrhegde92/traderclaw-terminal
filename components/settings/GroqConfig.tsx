'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, ExternalLink, Loader } from 'lucide-react'
import TerminalCard from '@/components/ui/TerminalCard'
import { useToast } from '@/components/ui/Toast'

export default function GroqConfig() {
  const toast = useToast()

  const [configured, setConfigured]             = useState(false)
  const [apiKey, setApiKey]                     = useState('')
  const [loading, setLoading]                   = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [checking, setChecking]                 = useState(true)
  const [showInput, setShowInput]               = useState(false)

  useEffect(() => { checkConfiguration() }, [])

  const checkConfiguration = async () => {
    try {
      setChecking(true)
      const res  = await fetch('/api/config/groq')
      const data = await res.json()
      setConfigured(data.configured)
    } catch {
      toast.error('Failed to check TraderBot configuration')
    } finally {
      setChecking(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) { toast.warn('Please enter your Groq API key'); return }
    try {
      setLoading(true)
      const res  = await fetch('/api/config/groq', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to save API key'); return }
      setConfigured(true)
      setApiKey('')
      setShowInput(false)
      toast.success('Groq API key saved — TraderBot is now active!')
    } catch {
      toast.error('Failed to save API key')
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    if (!apiKey.trim()) { toast.warn('Enter your API key first'); return }
    try {
      setTestingConnection(true)
      const res  = await fetch('/api/config/groq', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Connection test failed'); return }
      toast.success('✓ Connection successful! API key is valid.')
    } catch {
      toast.error('Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Remove Groq API key? TraderBot will stop working.')) return
    try {
      setLoading(true)
      await fetch('/api/config/groq', { method: 'DELETE' })
      setConfigured(false)
      setShowInput(false)
      toast.success('Groq API key removed.')
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <TerminalCard title="TraderBot AI (Groq)" accent="green">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader className="w-4 h-4 animate-spin" />
          Checking configuration...
        </div>
      </TerminalCard>
    )
  }

  return (
    <TerminalCard title="TraderBot AI (Groq)" accent="green">
      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between p-3 rounded border border-gray-700 bg-gray-900/50">
          <div className="flex items-center gap-2">
            {configured ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">✓ TraderBot Active</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">⊘ Not Configured</span>
              </>
            )}
          </div>
          {configured && <span className="text-xs text-gray-400">Llama 3.3 70B via Groq</span>}
        </div>

        {/* Info */}
        <p className="text-xs text-gray-400">
          TraderBot uses Groq's free API (Llama 3.3 70B) to answer trading questions and help you
          navigate the app. Get a free key at{' '}
          <a
            href="https://console.groq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
          >
            console.groq.com <ExternalLink className="w-3 h-3" />
          </a>
          {' '}— no credit card needed.
        </p>

        {/* Input */}
        {(!configured || showInput) && (
          <div className="space-y-3 p-3 rounded border border-gray-700 bg-gray-900/30">
            <input
              type="password"
              placeholder="gsk_..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !loading) handleSave() }}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-600 text-sm text-gray-100 placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              disabled={loading || testingConnection}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={loading || testingConnection || !apiKey.trim()}
                className="flex-1 px-3 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader className="w-4 h-4 animate-spin" />}
                Save Key
              </button>
              <button
                onClick={handleTest}
                disabled={loading || testingConnection || !apiKey.trim()}
                className="flex-1 px-3 py-2 rounded border border-gray-600 hover:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                {testingConnection && <Loader className="w-4 h-4 animate-spin" />}
                Test
              </button>
              {configured && showInput && (
                <button
                  onClick={() => setShowInput(false)}
                  className="px-3 py-2 rounded border border-gray-600 hover:border-gray-500 text-sm font-medium text-gray-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Configured actions */}
        {configured && !showInput && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowInput(true)}
              className="flex-1 px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-700 text-sm font-medium text-white transition-colors"
            >
              Update Key
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded border border-red-600 hover:bg-red-600/10 disabled:opacity-50 text-sm font-medium text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Add button when empty */}
        {!configured && !showInput && (
          <button
            onClick={() => setShowInput(true)}
            className="w-full px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-sm font-medium text-white transition-colors"
          >
            + Add Groq API Key
          </button>
        )}
      </div>
    </TerminalCard>
  )
}

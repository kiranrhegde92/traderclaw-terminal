'use client'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Modal from '@/components/ui/Modal'
import { X, Send, CheckCircle, AlertCircle } from 'lucide-react'

interface Subscription {
  id?: number
  accountId: number
  email: string
  frequency: 'daily' | 'weekly'
  enableEmail: boolean
  lastSentAt?: string
}

interface Props {
  accountId?: number
  isOpen: boolean
  onClose: () => void
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function ReportSettings({ accountId = 1, isOpen, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily')
  const [enableEmail, setEnableEmail] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isTestingSend, setIsTestingSend] = useState(false)

  const { data: subscription, isLoading, mutate } = useSWR<{
    data: Subscription | null
    subscribed: boolean
  }>(
    isOpen ? `/api/reports/subscribe?accountId=${accountId}` : null,
    fetcher
  )

  // Load existing subscription data
  useEffect(() => {
    if (subscription?.data) {
      setEmail(subscription.data.email)
      setFrequency(subscription.data.frequency)
      setEnableEmail(subscription.data.enableEmail)
    }
  }, [subscription])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/reports/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          email,
          frequency,
          enableEmail,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to save subscription',
        })
        return
      }

      setMessage({
        type: 'success',
        text: 'Subscription settings saved successfully',
      })

      mutate()

      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTestEmail = async () => {
    if (!email) {
      setMessage({
        type: 'error',
        text: 'Please enter an email address first',
      })
      return
    }

    setIsTestingSend(true)
    setMessage(null)

    try {
      const response = await fetch('/api/reports/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          email,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to send test email',
        })
        return
      }

      setMessage({
        type: 'success',
        text: 'Test email sent successfully to ' + email,
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to send test email',
      })
    } finally {
      setIsTestingSend(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal open={isOpen} onClose={onClose} title="Report Settings">
      <div className="bg-gray-900 border border-cyan-900 rounded p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-cyan-900">
          <h2 className="text-lg font-bold text-cyan-400">Report Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 transition-colors"
              required
              disabled={isLoading}
            />
            <div className="text-xs text-gray-500 mt-1">
              Where to send daily reports
            </div>
          </div>

          {/* Frequency Select */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly')}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-600 transition-colors"
              disabled={isLoading}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Every Friday)</option>
            </select>
            <div className="text-xs text-gray-500 mt-1">
              How often to receive reports
            </div>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-sm text-gray-400">Enable Email Reports</label>
              <div className="text-xs text-gray-500 mt-1">
                {enableEmail ? 'Reports will be sent to your email' : 'Reports are disabled'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEnableEmail(!enableEmail)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enableEmail ? 'bg-green-600' : 'bg-gray-600'
              }`}
              disabled={isLoading}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enableEmail ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`flex items-center gap-2 p-3 rounded text-sm ${
                message.type === 'success'
                  ? 'bg-green-900 text-green-300 border border-green-700'
                  : 'bg-red-900 text-red-300 border border-red-700'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Last Sent Info */}
          {subscription?.data?.lastSentAt && (
            <div className="bg-gray-800 border border-gray-700 p-3 rounded text-xs text-gray-400">
              Last report sent:{' '}
              <span className="text-gray-300">
                {new Date(subscription.data.lastSentAt).toLocaleString('en-IN')}
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={isLoading || isSubmitting || isTestingSend}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded text-sm hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Send size={14} />
              {isTestingSend ? 'Sending...' : 'Send Test Email'}
            </button>

            <button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 disabled:opacity-50 transition-colors font-bold"
            >
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 py-2 text-gray-400 rounded text-sm hover:text-gray-300 transition-colors"
          >
            Close
          </button>
        </form>

        {/* Info Section */}
        <div className="mt-6 pt-4 border-t border-gray-700 text-xs text-gray-500 space-y-2">
          <p>
            <span className="text-gray-400">Daily reports</span> are generated at 15:31 IST (market close)
          </p>
          <p>
            <span className="text-gray-400">Reports include:</span> P&L, trade stats, top gainers/losers
          </p>
          <p>
            <span className="text-cyan-400">Note:</span> Your system administrator must configure SMTP
            settings for emails to work
          </p>
        </div>
      </div>
    </Modal>
  )
}

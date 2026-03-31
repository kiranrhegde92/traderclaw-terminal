'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function TelegramSetup() {
  const { data } = useSWR('/api/notifications/telegram', fetcher)
  const [token, setToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const existing = data?.config

  async function handleSave(test = false) {
    if (!token || !chatId) {
      setStatus({ type: 'error', msg: 'Bot Token and Chat ID are required' })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId, test }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setStatus({ type: 'error', msg: json.error ?? 'Failed' })
      } else {
        setStatus({ type: 'success', msg: test ? '✓ Test message sent to Telegram!' : '✓ Configuration saved' })
        mutate('/api/notifications/telegram')
        if (!test) { setToken(''); setChatId('') }
      }
    } catch {
      setStatus({ type: 'error', msg: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Remove Telegram configuration?')) return
    await fetch('/api/notifications/telegram', { method: 'DELETE' })
    mutate('/api/notifications/telegram')
    setStatus({ type: 'success', msg: 'Telegram configuration removed' })
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text)', padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace',
    fontSize: 13, width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text)', fontSize: 13, maxWidth: 500 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--cyan)' }}>
          Telegram Alert Integration
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
          Receive trade alerts, P&L updates and price triggers directly in Telegram.
        </div>
      </div>

      {/* Current config */}
      {existing && (
        <div style={{
          background: 'rgba(0,200,100,0.08)', border: '1px solid var(--green)',
          borderRadius: 6, padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: 'var(--green)', fontSize: 12, fontWeight: 600 }}>✓ Connected</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
              Token: {existing.tokenMasked} · Chat ID: {existing.chatId}
            </div>
          </div>
          <button onClick={handleDelete} style={{
            background: 'none', border: '1px solid var(--red)', color: 'var(--red)',
            borderRadius: 5, padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 11,
          }}>Remove</button>
        </div>
      )}

      {/* Setup instructions */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '12px 14px', marginBottom: 16, fontSize: 12, lineHeight: 1.7,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--amber)' }}>Setup Instructions</div>
        <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)' }}>
          <li>Open Telegram and search for <code style={{ color: 'var(--cyan)' }}>@BotFather</code></li>
          <li>Send <code style={{ color: 'var(--cyan)' }}>/newbot</code> and follow prompts to get your <strong>Bot Token</strong></li>
          <li>Start a chat with your new bot</li>
          <li>Get your Chat ID: message <code style={{ color: 'var(--cyan)' }}>@userinfobot</code> or use the API</li>
        </ol>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 5 }}>BOT TOKEN</label>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="1234567890:ABCDefGHijklmnOPQRstUVwxyz"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginBottom: 5 }}>CHAT ID</label>
          <input
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            placeholder="-1001234567890 or your user ID"
            style={inputStyle}
          />
        </div>

        {status && (
          <div style={{
            padding: '8px 12px', borderRadius: 5, fontSize: 12,
            background: status.type === 'success' ? 'rgba(0,200,100,0.1)' : 'rgba(255,80,80,0.1)',
            color: status.type === 'success' ? 'var(--green)' : 'var(--red)',
            border: `1px solid ${status.type === 'success' ? 'var(--green)' : 'var(--red)'}`,
          }}>{status.msg}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => handleSave(true)}
            disabled={loading}
            style={{
              flex: 1, background: 'var(--surface)', border: '1px solid var(--cyan)',
              color: 'var(--cyan)', borderRadius: 6, padding: '9px 0',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={loading}
            style={{
              flex: 1, background: 'var(--cyan)', border: 'none',
              color: '#000', borderRadius: 6, padding: '9px 0',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              opacity: loading ? 0.6 : 1,
            }}
          >
            Save Config
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import Topbar from '@/components/layout/Topbar'
import TerminalCard from '@/components/ui/TerminalCard'
import FinnhubConfig from '@/components/settings/FinnhubConfig'
import GroqConfig from '@/components/settings/GroqConfig'

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Topbar />

      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <TerminalCard title="Settings" accent="cyan">
            <p className="text-sm text-gray-300">
              Configure data sources and external integrations for TraderClaw Terminal.
            </p>
          </TerminalCard>

          {/* Data Sources Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-cyan-400 px-1">📡 Data Sources</h2>

            {/* TraderBot AI */}
            <GroqConfig />

            {/* Finnhub Configuration */}
            <FinnhubConfig />

            {/* Market Data Status */}
            <TerminalCard title="Market Data" accent="green">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded border border-gray-700 bg-gray-900/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-200">NSE Real-time Quotes</span>
                    <span className="text-xs text-gray-400">Stock prices, gainers/losers</span>
                  </div>
                  <span className="px-3 py-1 rounded bg-green-600/20 text-green-400 text-xs font-medium">
                    ✓ Active
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded border border-gray-700 bg-gray-900/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-200">Yahoo Finance</span>
                    <span className="text-xs text-gray-400">Historical data, charts</span>
                  </div>
                  <span className="px-3 py-1 rounded bg-green-600/20 text-green-400 text-xs font-medium">
                    ✓ Active
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded border border-gray-700 bg-gray-900/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-200">FII/DII Flows</span>
                    <span className="text-xs text-gray-400">Institutional buying/selling</span>
                  </div>
                  <span className="px-3 py-1 rounded bg-green-600/20 text-green-400 text-xs font-medium">
                    ✓ Active
                  </span>
                </div>
              </div>
            </TerminalCard>
          </section>

          {/* About Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-cyan-400 px-1">ℹ️ About</h2>

            <TerminalCard title="Version Information" accent="amber">
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-400">Application:</span>
                  <span className="text-white font-medium">TraderClaw Terminal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Version:</span>
                  <span className="text-white font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Database:</span>
                  <span className="text-white font-medium">SQLite 3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400 font-medium">✓ Active</span>
                </div>
              </div>
            </TerminalCard>
          </section>
        </div>
      </main>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { clsx } from 'clsx'
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { FundamentalFilters, PRESET_FILTERS } from '@/lib/screener/fundamental'

interface Props {
  filters: FundamentalFilters
  onChange: (filters: FundamentalFilters) => void
  activeCount: number
  isLoading?: boolean
}

export default function FundamentalFilter({
  filters, onChange, activeCount, isLoading
}: Props) {
  const [expanded, setExpanded] = useState(true)

  const handleSliderChange = (key: keyof FundamentalFilters, value: number) => {
    onChange({ ...filters, [key]: value })
  }

  const handleRangeChange = (keyMin: string, keyMax: string, minVal: number, maxVal: number) => {
    const newFilters = { ...filters }
    newFilters[keyMin as keyof FundamentalFilters] = minVal
    newFilters[keyMax as keyof FundamentalFilters] = maxVal
    onChange(newFilters)
  }

  const resetFilters = () => {
    onChange({
      pe_min: 0, pe_max: 100,
      pb_min: 0, pb_max: 10,
      roe_min: 0, roe_max: 50,
      roce_min: 0, roce_max: 50,
      debt_min: 0, debt_max: 3,
      mcap_min: 0, mcap_max: 100000,
      div_min: 0, div_max: 10,
      eps_growth_min: -50, eps_growth_max: 50,
    })
  }

  const applyPreset = (presetKey: keyof typeof PRESET_FILTERS) => {
    const preset = PRESET_FILTERS[presetKey]
    onChange({ ...filters, ...preset.filters })
  }

  return (
    <div className="term-card mb-4">
      {/* Header */}
      <div
        className="term-card-header cursor-pointer hover:bg-gray-900/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="term-card-title">
          <span style={{ color: 'var(--cyan)' }}>⚙️ Filters</span>
          {activeCount > 0 && (
            <span className="ml-2 px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded border border-cyan-500/30">
              {activeCount} active
            </span>
          )}
        </div>
        <button className="text-gray-400 hover:text-white transition-colors">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="term-card-body">
          {/* Preset Filters */}
          <div className="mb-6">
            <label className="block text-xs font-mono text-gray-400 mb-2">Quick Presets</label>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              {Object.entries(PRESET_FILTERS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key as keyof typeof PRESET_FILTERS)}
                  className="px-3 py-2 rounded border border-gray-600 text-xs hover:border-cyan-500 hover:bg-cyan-500/10 transition-colors"
                  title={preset.desc}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800 my-4" />

          {/* Filter Ranges */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PE Ratio */}
            <SliderRange
              label="PE Ratio"
              min={0}
              max={100}
              minVal={filters.pe_min}
              maxVal={filters.pe_max}
              step={1}
              onMinChange={(v) => handleRangeChange('pe_min', 'pe_max', v, filters.pe_max)}
              onMaxChange={(v) => handleRangeChange('pe_min', 'pe_max', filters.pe_min, v)}
              color="green"
            />

            {/* PB Ratio */}
            <SliderRange
              label="PB Ratio"
              min={0}
              max={10}
              minVal={filters.pb_min}
              maxVal={filters.pb_max}
              step={0.5}
              onMinChange={(v) => handleRangeChange('pb_min', 'pb_max', v, filters.pb_max)}
              onMaxChange={(v) => handleRangeChange('pb_min', 'pb_max', filters.pb_min, v)}
              color="cyan"
            />

            {/* ROE */}
            <SliderRange
              label="ROE %"
              min={0}
              max={50}
              minVal={filters.roe_min}
              maxVal={filters.roe_max}
              step={1}
              onMinChange={(v) => handleRangeChange('roe_min', 'roe_max', v, filters.roe_max)}
              onMaxChange={(v) => handleRangeChange('roe_min', 'roe_max', filters.roe_min, v)}
              color="amber"
            />

            {/* ROCE */}
            <SliderRange
              label="ROCE %"
              min={0}
              max={50}
              minVal={filters.roce_min}
              maxVal={filters.roce_max}
              step={1}
              onMinChange={(v) => handleRangeChange('roce_min', 'roce_max', v, filters.roce_max)}
              onMaxChange={(v) => handleRangeChange('roce_min', 'roce_max', filters.roce_min, v)}
              color="green"
            />

            {/* Debt/Equity */}
            <SliderRange
              label="Debt/Equity"
              min={0}
              max={3}
              minVal={filters.debt_min}
              maxVal={filters.debt_max}
              step={0.1}
              onMinChange={(v) => handleRangeChange('debt_min', 'debt_max', v, filters.debt_max)}
              onMaxChange={(v) => handleRangeChange('debt_min', 'debt_max', filters.debt_min, v)}
              color="cyan"
            />

            {/* Market Cap */}
            <SliderRange
              label="Market Cap (Cr)"
              min={100}
              max={100000}
              minVal={filters.mcap_min}
              maxVal={filters.mcap_max}
              step={500}
              onMinChange={(v) => handleRangeChange('mcap_min', 'mcap_max', v, filters.mcap_max)}
              onMaxChange={(v) => handleRangeChange('mcap_min', 'mcap_max', filters.mcap_min, v)}
              color="red"
              format={(v) => `${Math.round(v)}`}
            />

            {/* Dividend Yield */}
            <SliderRange
              label="Dividend Yield %"
              min={0}
              max={10}
              minVal={filters.div_min}
              maxVal={filters.div_max}
              step={0.5}
              onMinChange={(v) => handleRangeChange('div_min', 'div_max', v, filters.div_max)}
              onMaxChange={(v) => handleRangeChange('div_min', 'div_max', filters.div_min, v)}
              color="green"
            />

            {/* EPS Growth */}
            <SliderRange
              label="EPS Growth YoY %"
              min={-50}
              max={50}
              minVal={filters.eps_growth_min}
              maxVal={filters.eps_growth_max}
              step={5}
              onMinChange={(v) => handleRangeChange('eps_growth_min', 'eps_growth_max', v, filters.eps_growth_max)}
              onMaxChange={(v) => handleRangeChange('eps_growth_min', 'eps_growth_max', filters.eps_growth_min, v)}
              color="amber"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6 border-t border-gray-800 pt-4">
            <button
              onClick={resetFilters}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded border border-gray-600 text-sm hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={16} />
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface SliderRangeProps {
  label: string
  min: number
  max: number
  minVal: number
  maxVal: number
  step: number
  onMinChange: (value: number) => void
  onMaxChange: (value: number) => void
  color: 'green' | 'red' | 'cyan' | 'amber'
  format?: (v: number) => string
}

function SliderRange({
  label, min, max, minVal, maxVal, step,
  onMinChange, onMaxChange, color, format
}: SliderRangeProps) {
  const colorMap = {
    green: 'var(--green)',
    red: 'var(--red)',
    cyan: 'var(--cyan)',
    amber: 'var(--amber)',
  }

  const defaultFormatter = (v: number) => {
    if (step < 1) return v.toFixed(1)
    return Math.round(v).toString()
  }

  const formatter = format || defaultFormatter

  return (
    <div>
      <label className="block text-xs font-mono text-gray-400 mb-2">{label}</label>
      <div className="space-y-3">
        {/* Min Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs" style={{ color: colorMap[color] }}>Min: {formatter(minVal)}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={minVal}
            onChange={(e) => onMinChange(parseFloat(e.target.value))}
            className="w-full"
            style={{
              accentColor: colorMap[color],
            }}
          />
        </div>

        {/* Max Slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs" style={{ color: colorMap[color] }}>Max: {formatter(maxVal)}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={maxVal}
            onChange={(e) => onMaxChange(parseFloat(e.target.value))}
            className="w-full"
            style={{
              accentColor: colorMap[color],
            }}
          />
        </div>

        {/* Range Display */}
        <div className="text-xs text-gray-500 px-2 py-1 bg-gray-900 rounded">
          Range: {formatter(minVal)} → {formatter(maxVal)}
        </div>
      </div>
    </div>
  )
}

import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        claw: {
          bg:          '#0a0a0a',
          surface:     '#111111',
          surfaceHigh: '#1a1a1a',
          border:      '#1e1e1e',
          borderHigh:  '#2a2a2a',
          green:       '#00ff41',
          greenDim:    '#00cc33',
          greenGlow:   '#00ff4133',
          red:         '#ff0040',
          redDim:      '#cc0033',
          redGlow:     '#ff004033',
          cyan:        '#00d4ff',
          cyanDim:     '#00aacc',
          cyanGlow:    '#00d4ff33',
          amber:       '#ffb700',
          amberDim:    '#cc9200',
          amberGlow:   '#ffb70033',
          purple:      '#bd00ff',
          text:        '#e0e0e0',
          textDim:     '#888888',
          textMuted:   '#444444',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.625rem',
        xs:    '0.75rem',
        sm:    '0.8125rem',
      },
      boxShadow: {
        'neon-green':  '0 0 8px #00ff41, 0 0 20px #00ff4155',
        'neon-red':    '0 0 8px #ff0040, 0 0 20px #ff004055',
        'neon-cyan':   '0 0 8px #00d4ff, 0 0 20px #00d4ff55',
        'neon-amber':  '0 0 8px #ffb700, 0 0 20px #ffb70055',
        'card':        '0 0 0 1px #1e1e1e',
        'card-hover':  '0 0 0 1px #2a2a2a, 0 0 15px #00ff4110',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px)`,
        'scan-lines':   `repeating-linear-gradient(
                           0deg,
                           transparent,
                           transparent 2px,
                           rgba(0,0,0,0.05) 2px,
                           rgba(0,0,0,0.05) 4px
                         )`,
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      animation: {
        'pulse-green':  'pulseGreen 2s ease-in-out infinite',
        'pulse-red':    'pulseRed 2s ease-in-out infinite',
        'blink':        'blink 1s step-end infinite',
        'slide-in':     'slideIn 0.2s ease-out',
        'fade-in':      'fadeIn 0.3s ease-out',
        'matrix-fall':  'matrixFall 3s linear infinite',
        'ticker':       'ticker 40s linear infinite',
        'glow-pulse':   'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 4px #00ff41' },
          '50%':      { boxShadow: '0 0 12px #00ff41, 0 0 24px #00ff4155' },
        },
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 4px #ff0040' },
          '50%':      { boxShadow: '0 0 12px #ff0040, 0 0 24px #ff004055' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        slideIn: {
          from: { transform: 'translateY(-8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        matrixFall: {
          from: { transform: 'translateY(-100%)' },
          to:   { transform: 'translateY(100vh)' },
        },
        ticker: {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1'   },
        },
      },
    },
  },
  plugins: [],
}

export default config

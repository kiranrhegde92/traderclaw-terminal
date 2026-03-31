# TraderClaw Terminal

A production-grade Indian stock market trading terminal built with Next.js 14. Connects to Angel One and Zerodha brokers, provides real-time market data, options analytics, paper trading, portfolio management, and an AI trading assistant.

## Features

- **Live Market Data** — Nifty 50, Bank Nifty, Sensex, sector heatmap, FII/DII flows, gainers/losers
- **Options Chain** — Full chain with Greeks (Delta, Gamma, Theta, Vega), IV surface, max pain, PCR gauge
- **Strategy Builder** — Iron condor, straddle, spreads; payoff charts; deploy to live or paper
- **Backtesting** — Historical P&L, Sharpe ratio, drawdown analysis
- **Paper Trading** — Simulated trading with real market prices
- **Portfolio** — Holdings, intraday P&L, Greeks aggregation, tax (STCG/LTCG), risk metrics
- **Screener** — Fundamental (P/E, ROE, ROCE), delivery spikes, technical patterns
- **Monitor** — Price alerts, custom watchlists, live monitoring dashboard
- **News** — Market news feed, earnings calendar, economic calendar
- **TraderBot AI** — AI assistant for trading queries and app navigation (powered by Groq / Llama 3.3 70B)
- **Real-time Feeds** — WebSocket price feeds, live order updates
- **PWA** — Installable on mobile and desktop

## Brokers Supported

| Broker | Method |
|--------|--------|
| Angel One | SmartAPI — direct login with client ID, PIN, TOTP |
| Zerodha | Kite Connect v3 — OAuth flow |

## Tech Stack

- **Framework** — Next.js 14 (App Router), TypeScript
- **Styling** — Tailwind CSS, custom terminal theme
- **State** — Zustand
- **Database** — SQLite (better-sqlite3)
- **Charts** — Lightweight Charts (TradingView)
- **AI** — Groq API (Llama 3.3 70B, free tier)
- **Server** — Custom Express + WebSocket server

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/kiranrhegde92/traderclaw-terminal.git
cd traderclaw-terminal
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Angel One
ANGELONE_API_KEY=your_api_key
ANGELONE_CLIENT_ID=your_client_id
ANGELONE_CLIENT_PIN=your_pin
ANGELONE_TOTP_SECRET=your_totp_secret

# Zerodha (optional)
ZERODHA_API_KEY=your_api_key
ZERODHA_API_SECRET=your_api_secret

# App
SESSION_SECRET=your_random_32_char_secret
JWT_SECRET=your_random_secret
DB_PATH=./data/openclaw.db
PORT=3000
```

### 3. Initialize database

```bash
npm run db:init
```

### 4. Run

```bash
npm run dev
# or production:
npm start
```

Open [http://localhost:3000](http://localhost:3000) and connect your broker via the **Connect** page.

## AI Chatbot Setup

TraderBot uses Groq's free API (no credit card needed):

1. Get a free key at [console.groq.com](https://console.groq.com)
2. Go to **Settings → TraderBot AI** in the app
3. Paste your key and save

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F9` | Open order modal |
| `Ctrl+K` | Global search |
| `Ctrl+\`` | Toggle console |
| `?` | Show all shortcuts |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANGELONE_API_KEY` | Yes* | Angel One SmartAPI key |
| `ANGELONE_CLIENT_ID` | Yes* | Angel One login ID |
| `ANGELONE_CLIENT_PIN` | Yes* | Angel One PIN |
| `ANGELONE_TOTP_SECRET` | No | Auto-TOTP (else enter manually) |
| `ZERODHA_API_KEY` | Yes* | Zerodha API key |
| `ZERODHA_API_SECRET` | Yes* | Zerodha API secret |
| `SESSION_SECRET` | Yes | JWT session signing secret |
| `DB_PATH` | No | SQLite path (default: `./data/openclaw.db`) |
| `PORT` | No | Server port (default: 3000) |

*One broker is sufficient.

## License

MIT

import { type DailyReport } from '@/lib/db/queries/reports'
import { formatINR, formatPct } from '@/lib/utils/format'

interface EmailConfig {
  host?: string
  port?: number
  secure?: boolean
  user?: string
  password?: string
}

/**
 * Check if email is configured
 */
export function isEmailConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  )
}

/**
 * Get SMTP configuration from environment
 */
function getSmtpConfig(): EmailConfig {
  return {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  }
}

/**
 * Generate HTML email body for daily report
 */
function generateEmailHtml(report: DailyReport): string {
  const date = new Date(report.reportDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const pnlColor = report.totalPnl >= 0 ? '#00ff00' : '#ff4444'
  const winRateColor = report.winRate >= 50 ? '#00ff00' : '#ffaa00'

  const gainerRows = (report.topGainers || [])
    .map(
      g =>
        `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #333;">${g.symbol}</td>
      <td style="padding: 8px; border-bottom: 1px solid #333; text-align: right;">${g.qty}</td>
      <td style="padding: 8px; border-bottom: 1px solid #333; text-align: right; color: #00ff00;">₹${g.pnl.toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #333; text-align: right; color: #00ff00;">+${g.return.toFixed(2)}%</td>
    </tr>`
    )
    .join('')

  const loserRows = (report.topLosers || [])
    .map(
      l =>
        `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #333;">${l.symbol}</td>
      <td style="padding: 8px; border-bottom: 1px solid #333; text-align: right;">${l.qty}</td>
      <td style="padding: 8px; border-bottom: 1px solid #333; text-align: right; color: #ff4444;">₹${l.pnl.toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #333; text-align: right; color: #ff4444;">${l.return.toFixed(2)}%</td>
    </tr>`
    )
    .join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Monaco', 'Courier New', monospace;
      background-color: #0a0e27;
      color: #00ff00;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #1a1f3a;
      border: 1px solid #00ff00;
      padding: 20px;
    }
    .header {
      border-bottom: 1px solid #00ff00;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      color: #00ff00;
    }
    .subtitle {
      font-size: 12px;
      color: #888;
      margin-top: 5px;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #00ff00;
      border-bottom: 1px solid #333;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .metric {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 10px;
    }
    .metric-item {
      padding: 10px;
      background-color: #0a0e27;
      border: 1px solid #333;
    }
    .metric-label {
      font-size: 12px;
      color: #888;
    }
    .metric-value {
      font-size: 18px;
      font-weight: bold;
      color: #00ff00;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th {
      text-align: left;
      padding: 10px;
      border-bottom: 2px solid #00ff00;
      font-size: 12px;
      font-weight: bold;
      color: #00ff00;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #333;
    }
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #333;
      font-size: 11px;
      color: #666;
      text-align: center;
    }
    .empty {
      color: #666;
      font-style: italic;
      padding: 15px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">TraderClaw Daily Report</div>
      <div class="subtitle">${date}</div>
    </div>

    <div class="section">
      <div class="section-title">P&L Summary</div>
      <div class="metric">
        <div class="metric-item">
          <div class="metric-label">Realized P&L</div>
          <div class="metric-value" style="color: ${report.realizedPnl >= 0 ? '#00ff00' : '#ff4444'}">
            ${formatINR(report.realizedPnl, true)}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Unrealized P&L</div>
          <div class="metric-value" style="color: ${report.unrealizedPnl >= 0 ? '#00ff00' : '#ff4444'}">
            ${formatINR(report.unrealizedPnl, true)}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Total P&L</div>
          <div class="metric-value" style="color: ${report.totalPnl >= 0 ? '#00ff00' : '#ff4444'}">
            ${formatINR(report.totalPnl, true)}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Total Return</div>
          <div class="metric-value" style="color: ${report.totalReturn >= 0 ? '#00ff00' : '#ff4444'}">
            ${formatPct(report.totalReturn)}
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Trading Statistics</div>
      <div class="metric">
        <div class="metric-item">
          <div class="metric-label">Win Rate</div>
          <div class="metric-value" style="color: ${report.winRate >= 50 ? '#00ff00' : '#ffaa00'}">
            ${report.winRate.toFixed(1)}%
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Profit Factor</div>
          <div class="metric-value" style="color: ${report.profitFactor >= 1 ? '#00ff00' : '#ffaa00'}">
            ${isFinite(report.profitFactor) ? report.profitFactor.toFixed(2) : '∞'}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Avg Win</div>
          <div class="metric-value" style="color: #00ff00">
            ${formatINR(report.avgWin, true)}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Avg Loss</div>
          <div class="metric-value" style="color: #ff4444">
            ${formatINR(report.avgLoss, true)}
          </div>
        </div>
      </div>
      <div style="margin-top: 10px; padding: 10px; background-color: #0a0e27; border: 1px solid #333;">
        <div style="font-size: 12px; color: #888;">Trades Executed</div>
        <div style="font-size: 18px; font-weight: bold; color: #00ff00; margin-top: 5px;">
          ${report.tradesExecuted}
        </div>
      </div>
    </div>

    ${
      report.topGainers && report.topGainers.length > 0
        ? `
    <div class="section">
      <div class="section-title">Top Gainers</div>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Quantity</th>
            <th>P&L</th>
            <th>Return</th>
          </tr>
        </thead>
        <tbody>
          ${gainerRows}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    ${
      report.topLosers && report.topLosers.length > 0
        ? `
    <div class="section">
      <div class="section-title">Top Losers</div>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Quantity</th>
            <th>P&L</th>
            <th>Return</th>
          </tr>
        </thead>
        <tbody>
          ${loserRows}
        </tbody>
      </table>
    </div>
    `
        : ''
    }

    <div class="footer">
      <p>This is an automated report from TraderClaw Terminal</p>
      <p>Report generated on ${new Date().toLocaleString('en-IN')}</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate plain text email body
 */
function generateEmailText(report: DailyReport): string {
  const date = new Date(report.reportDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const gainersList = (report.topGainers || [])
    .map(g => `  ${g.symbol}: ${g.qty}x @ ₹${g.pnl.toFixed(2)} (+${g.return.toFixed(2)}%)`)
    .join('\n')

  const losersList = (report.topLosers || [])
    .map(l => `  ${l.symbol}: ${l.qty}x @ ₹${l.pnl.toFixed(2)} (${l.return.toFixed(2)}%)`)
    .join('\n')

  return `
TraderClaw Daily Report - ${date}

P&L SUMMARY
──────────────────────
Realized P&L:  ₹${report.realizedPnl.toFixed(2)}
Unrealized P&L: ₹${report.unrealizedPnl.toFixed(2)}
Total P&L:     ₹${report.totalPnl.toFixed(2)}
Total Return:  ${report.totalReturn.toFixed(2)}%

TRADING STATISTICS
──────────────────────
Win Rate:      ${report.winRate.toFixed(1)}%
Profit Factor: ${isFinite(report.profitFactor) ? report.profitFactor.toFixed(2) : '∞'}
Avg Win:       ₹${report.avgWin.toFixed(2)}
Avg Loss:      ₹${report.avgLoss.toFixed(2)}
Trades:        ${report.tradesExecuted}

${
  report.topGainers && report.topGainers.length > 0
    ? `TOP GAINERS
──────────────────────
${gainersList}\n`
    : ''
}
${
  report.topLosers && report.topLosers.length > 0
    ? `TOP LOSERS
──────────────────────
${losersList}\n`
    : ''
}
---
Generated: ${new Date().toLocaleString('en-IN')}
  `.trim()
}

/**
 * Send daily report email
 * Requires SMTP configuration in environment variables
 */
export async function sendDailyReportEmail(
  toEmail: string,
  report: DailyReport
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn('Email not configured - skipping email send')
    return false
  }

  try {
    // Dynamically import nodemailer to avoid hard dependency if not using email
    const nodemailer = await import('nodemailer').catch(() => null)
    if (!nodemailer) {
      console.error('nodemailer not installed - email send skipped')
      return false
    }

    const config = getSmtpConfig()

    const transporter = nodemailer.default.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    })

    const date = new Date(report.reportDate).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || config.user,
      to: toEmail,
      subject: `TraderClaw Daily Report - ${date}`,
      text: generateEmailText(report),
      html: generateEmailHtml(report),
    })

    console.log(`Email sent to ${toEmail}:`, info.messageId)
    return true
  } catch (error) {
    console.error(`Failed to send email to ${toEmail}:`, error)
    return false
  }
}

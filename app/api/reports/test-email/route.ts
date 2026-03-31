import { NextRequest, NextResponse } from 'next/server'
import { generateDailyReport } from '@/lib/reports/daily'
import { sendDailyReportEmail, isEmailConfigured } from '@/lib/reports/email'

export async function POST(req: NextRequest) {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error: 'Email not configured. Please set SMTP environment variables.',
          configured: false,
        },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { accountId = 1, email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Generate today's report
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const report = await generateDailyReport(accountId, today)

    // Send test email
    const success = await sendDailyReportEmail(email, report)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send email. Check server logs for details.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
      email,
    })
  } catch (error) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    )
  }
}

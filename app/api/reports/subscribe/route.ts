import { NextRequest, NextResponse } from 'next/server'
import {
  createOrUpdateSubscription,
  getSubscription,
  type ReportSubscription,
} from '@/lib/db/queries/reports'

export async function GET(req: NextRequest) {
  const accountId = parseInt(req.nextUrl.searchParams.get('accountId') ?? '1')
  const email = req.nextUrl.searchParams.get('email') ?? undefined

  try {
    const subscription = getSubscription(accountId, email ?? undefined)

    if (!subscription) {
      return NextResponse.json({
        data: null,
        subscribed: false,
      })
    }

    return NextResponse.json({
      data: subscription,
      subscribed: subscription.enableEmail,
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { accountId = 1, email, frequency = 'daily', enableEmail = true } = body

    // Validate inputs
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!['daily', 'weekly'].includes(frequency)) {
      return NextResponse.json(
        { error: 'Frequency must be daily or weekly' },
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

    const subscription: ReportSubscription = {
      accountId,
      email,
      frequency: frequency as 'daily' | 'weekly',
      enableEmail,
    }

    const subscriptionId = createOrUpdateSubscription(subscription)

    return NextResponse.json(
      {
        data: {
          ...subscription,
          id: subscriptionId,
        },
        message: 'Subscription updated successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    )
  }
}

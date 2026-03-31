/**
 * Angel One authentication helpers
 * TOTP generation + session management
 */
import { log } from '@/lib/utils/logger'

/** Generate TOTP for Angel One 2FA */
export async function generateTOTP(secret: string): Promise<string> {
  try {
    const { authenticator } = await import('otplib')
    authenticator.options = { digits: 6, period: 30, algorithm: 'sha1' as any }
    return authenticator.generate(secret)
  } catch (err) {
    log.error('auth', `TOTP generation failed: ${err}`)
    throw err
  }
}

/** Verify a provided TOTP against the secret */
export async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  try {
    const { authenticator } = await import('otplib')
    return authenticator.verify({ token, secret })
  } catch {
    return false
  }
}

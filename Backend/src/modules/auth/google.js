import { OAuth2Client } from 'google-auth-library'
import { env } from '../../config/env.js'
import { AppError } from '../../utils/AppError.js'

const client = new OAuth2Client()

export const isGoogleEnabled = () => Boolean(env.GOOGLE_CLIENT_ID)

/**
 * Verifies a Google Identity Services ID token (the `credential` the
 * "Sign in with Google" button returns): signature against Google's keys,
 * issuer, expiry, and that it was issued for *our* client ID.
 * Returns the Google profile, or throws a 401.
 */
export async function verifyGoogleIdToken(idToken) {
  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID })
    payload = ticket.getPayload()
  } catch {
    throw AppError.unauthorized('Google sign-in failed. Please try again.', { code: 'GOOGLE_TOKEN_INVALID' })
  }

  if (!payload?.sub || !payload.email) {
    throw AppError.unauthorized('Google didn’t share an email address for this account.', { code: 'GOOGLE_TOKEN_INVALID' })
  }
  // Only trust emails Google has verified — otherwise someone could claim
  // another person's address and get linked to their Tripzy account.
  if (!payload.email_verified) {
    throw AppError.unauthorized('Your Google email address isn’t verified.', { code: 'GOOGLE_EMAIL_UNVERIFIED' })
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name?.trim() || payload.email.split('@')[0],
    avatarUrl: payload.picture ?? null,
  }
}

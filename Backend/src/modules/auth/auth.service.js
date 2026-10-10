import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'
import {
  accessTokenLifetimeSeconds,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
} from './tokens.js'

const BCRYPT_ROUNDS = 12
// Two tabs refreshing at once both present the same token; the loser gets a
// retryable error instead of tripping theft detection.
const ROTATION_GRACE_MS = 30_000
// Compared against when the email doesn't exist, so response timing doesn't
// reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('tripzy-timing-equaliser', BCRYPT_ROUNDS)

/** The only user shape that ever leaves the server — no password hash. */
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  }
}

async function issueSession(user, { userAgent, familyId = crypto.randomUUID(), tx = prisma } = {}) {
  const refreshToken = generateRefreshToken()
  await tx.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: refreshTokenExpiry(),
      userAgent: userAgent?.slice(0, 255),
    },
  })
  return {
    user: publicUser(user),
    accessToken: signAccessToken(user),
    expiresIn: accessTokenLifetimeSeconds(),
    refreshToken,
  }
}

export async function register({ name, email, password }, meta = {}) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw AppError.conflict('An account with this email already exists.', { code: 'EMAIL_TAKEN', details: { email: 'Email already in use' } })

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  try {
    const user = await prisma.user.create({ data: { name, email, passwordHash } })
    return issueSession(user, meta)
  } catch (error) {
    // Two sign-ups racing for the same email: the unique index decides.
    if (error.code === 'P2002') {
      throw AppError.conflict('An account with this email already exists.', { code: 'EMAIL_TAKEN', details: { email: 'Email already in use' } })
    }
    throw error
  }
}

export async function login({ email, password }, meta = {}) {
  const user = await prisma.user.findUnique({ where: { email } })
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !user.passwordHash || !valid) {
    throw AppError.unauthorized('Invalid email or password.', { code: 'INVALID_CREDENTIALS' })
  }
  return issueSession(user, meta)
}

/**
 * Exchanges a refresh token for a new access + refresh token pair (rotation).
 * Presenting an already-rotated token means it was stolen or replayed, so the
 * whole token family is revoked and the user must log in again.
 */
export async function refresh(rawToken, meta = {}) {
  const invalid = () => AppError.unauthorized('Your session has expired. Please log in again.', { code: 'INVALID_REFRESH_TOKEN' })
  if (!rawToken) throw invalid()

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { user: true } })
  if (!stored) throw invalid()

  if (stored.revokedAt) {
    const justRotated = stored.revokedReason === 'ROTATED' && Date.now() - stored.revokedAt.getTime() < ROTATION_GRACE_MS
    if (justRotated) {
      throw AppError.unauthorized('Session was refreshed in another tab. Retry.', { code: 'REFRESH_RACE' })
    }
    await revokeFamily(stored.familyId, 'REUSE')
    throw invalid()
  }
  if (stored.expiresAt <= new Date()) throw invalid()

  return prisma.$transaction(async (tx) => {
    // Conditional update: if two refreshes race, only one wins.
    const { count } = await tx.refreshToken.updateMany({ where: { id: stored.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: 'ROTATED' } })
    if (count !== 1) throw AppError.unauthorized('Session was refreshed in another tab. Retry.', { code: 'REFRESH_RACE' })
    return issueSession(stored.user, { ...meta, familyId: stored.familyId, tx })
  })
}

/** Revokes every token issued from the same login as this refresh token. */
export async function logout(rawToken) {
  if (!rawToken) return
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } })
  if (!stored) return
  await revokeFamily(stored.familyId, 'LOGOUT')
}

function revokeFamily(familyId, reason) {
  return prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } })
}

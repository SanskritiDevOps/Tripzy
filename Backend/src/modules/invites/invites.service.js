import crypto from 'node:crypto'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { sendMail } from '../../config/mailer.js'
import { AppError } from '../../utils/AppError.js'
import { serializeTrip } from '../trips/trips.service.js'
import { ACTIONS, logTripActivity } from '../activities/activities.service.js'

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

/** "priya.nair@gmail.com" → "pr***@gmail.com" (shown to people who aren't the invitee). */
export function maskEmail(email) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`
}

function serializeInvite(invite) {
  return {
    id: invite.id,
    tripId: invite.tripId,
    email: invite.email,
    status: invite.status,
    expired: invite.status === 'PENDING' && invite.expiresAt <= new Date(),
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  }
}

function inviteEmail({ trip, inviter, link }) {
  const subject = `${inviter.name} invited you to plan “${trip.name}” on Tripzy`
  const text = [
    `${inviter.name} invited you to join the trip “${trip.name}” (${trip.destination}) on Tripzy.`,
    '',
    `Join the trip: ${link}`,
    '',
    `This link expires in ${env.INVITE_TTL_DAYS} days. If you weren’t expecting it, you can ignore this email.`,
  ].join('\n')
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#0f172a">
      <h2 style="margin:0 0 8px">You’re invited to plan ${escapeHtml(trip.name)}</h2>
      <p style="margin:0 0 16px;color:#475569">${escapeHtml(inviter.name)} wants you on the team for ${escapeHtml(trip.destination)}.</p>
      <a href="${link}" style="display:inline-block;background:#1d5967;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Join the trip</a>
      <p style="margin:16px 0 0;font-size:12px;color:#64748b">This link expires in ${env.INVITE_TTL_DAYS} days.</p>
    </div>`
  return { subject, text, html }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/** Leader-only (enforced by the route). Re-inviting the same email replaces the older pending invite. */
export async function createInvite({ tripId, inviterId, email }) {
  const [trip, inviter, alreadyMember] = await Promise.all([
    prisma.trip.findUnique({ where: { id: tripId } }),
    prisma.user.findUnique({ where: { id: inviterId } }),
    prisma.tripMember.findFirst({ where: { tripId, user: { email } } }),
  ])
  if (!trip) throw AppError.notFound('Trip not found', { code: 'TRIP_NOT_FOUND' })
  if (alreadyMember) throw AppError.conflict('That person is already on this trip.', { code: 'ALREADY_MEMBER', details: { email: 'Already a member' } })

  const token = crypto.randomBytes(32).toString('base64url')
  const invite = await prisma.$transaction(async (tx) => {
    await tx.tripInvite.updateMany({ where: { tripId, email, status: 'PENDING' }, data: { status: 'REVOKED' } })
    const created = await tx.tripInvite.create({
      data: {
        tripId,
        email,
        tokenHash: hashToken(token),
        invitedById: inviterId,
        expiresAt: new Date(Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    })
    await logTripActivity(tx, { tripId, userId: inviterId, action: ACTIONS.INVITE_SENT, details: { email } })
    return created
  })

  const inviteUrl = `${env.appUrl}/join-trip?token=${token}`
  const { delivered } = await sendMail({ to: email, ...inviteEmail({ trip, inviter, link: inviteUrl }) })
  // The link is returned to the leader too, so it can be shared directly if email isn't set up.
  return { invite: serializeInvite(invite), inviteUrl, emailDelivered: delivered }
}

export async function listInvites(tripId) {
  const invites = await prisma.tripInvite.findMany({ where: { tripId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } })
  return invites.map(serializeInvite)
}

export async function revokeInvite(tripId, inviteId) {
  const { count } = await prisma.tripInvite.updateMany({ where: { id: inviteId, tripId, status: 'PENDING' }, data: { status: 'REVOKED' } })
  if (count === 0) throw AppError.notFound('Pending invite not found', { code: 'INVITE_NOT_FOUND' })
}

async function findByToken(token) {
  const invite = await prisma.tripInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { trip: { include: { _count: { select: { members: true } } } }, invitedBy: { select: { name: true } } },
  })
  if (!invite) throw AppError.notFound('This invite link is invalid.', { code: 'INVITE_INVALID' })
  return invite
}

/** Public preview for the join page: enough to recognise the trip, nothing sensitive. */
export async function previewInvite(token) {
  const invite = await findByToken(token)
  return {
    status: invite.status,
    expired: invite.expiresAt <= new Date(),
    email: maskEmail(invite.email),
    invitedBy: invite.invitedBy?.name ?? null,
    trip: {
      name: invite.trip.name,
      destination: invite.trip.destination,
      startDate: invite.trip.startDate.toISOString().slice(0, 10),
      endDate: invite.trip.endDate.toISOString().slice(0, 10),
      memberCount: invite.trip._count.members,
    },
  }
}

/**
 * Accepts an invite for the logged-in user. The invite is bound to the email it
 * was sent to, so a forwarded link can't be used by someone else's account.
 * Accepting twice is harmless (returns the trip again).
 */
export async function acceptInvite(user, token) {
  const invite = await findByToken(token)
  const existing = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId: invite.tripId, userId: user.id } } })

  if (invite.status === 'ACCEPTED' && (invite.acceptedById === user.id || existing)) return loadTrip(invite.tripId, user.id)
  if (invite.status === 'ACCEPTED') throw new AppError(410, 'This invite has already been used.', { code: 'INVITE_USED' })
  if (invite.status === 'REVOKED') throw new AppError(410, 'This invite was cancelled by the team leader.', { code: 'INVITE_REVOKED' })
  if (invite.expiresAt <= new Date()) throw new AppError(410, 'This invite has expired. Ask the team leader for a new one.', { code: 'INVITE_EXPIRED' })
  if (invite.email !== user.email.toLowerCase()) {
    throw AppError.forbidden(`This invite was sent to ${maskEmail(invite.email)}. Log in with that email to join.`, { code: 'INVITE_EMAIL_MISMATCH' })
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.tripInvite.updateMany({
      where: { id: invite.id, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedById: user.id, acceptedAt: new Date() },
    })
    if (count === 0) throw new AppError(410, 'This invite has already been used.', { code: 'INVITE_USED' })
    if (!existing) {
      await tx.tripMember.create({ data: { tripId: invite.tripId, userId: user.id, role: 'MEMBER' } })
      await logTripActivity(tx, { tripId: invite.tripId, userId: user.id, action: ACTIONS.MEMBER_JOINED, details: {} })
    }
  })
  return loadTrip(invite.tripId, user.id)
}

async function loadTrip(tripId, userId) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }, orderBy: { joinedAt: 'asc' } } },
  })
  return serializeTrip(trip, userId)
}

import { prisma } from '../../config/prisma.js'
import { AppError } from '../../utils/AppError.js'
import { buildSplits, computeBalances, simplifyDebts } from '../../utils/money.js'
import { ACTIONS, logTripActivity } from '../activities/activities.service.js'

const OWNER_MESSAGE = 'Only the person who added this expense or the team leader can change it.'

export function serializeExpense(e) {
  return {
    id: e.id,
    tripId: e.tripId,
    title: e.title,
    amountMinor: Number(e.amountMinor),
    currency: e.currency,
    paidBy: e.paidById,
    splitType: e.splitType,
    category: e.category,
    splits: e.splits.map((s) => ({ userId: s.userId, shareMinor: Number(s.shareMinor) })),
    createdBy: e.createdById,
    idempotencyKey: e.idempotencyKey,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

function serializeSettlement(s) {
  return {
    id: s.id,
    tripId: s.tripId,
    fromUser: s.fromUserId,
    toUser: s.toUserId,
    amountMinor: Number(s.amountMinor),
    recordedBy: s.recordedById,
    settledAt: s.settledAt.toISOString(),
  }
}

async function memberIds(db, tripId) {
  return new Set((await db.tripMember.findMany({ where: { tripId }, select: { userId: true } })).map((m) => m.userId))
}

/** Splits are built on the server, so shares always add up to the amount exactly. */
async function prepare(db, tripId, input) {
  const members = await memberIds(db, tripId)
  if (!members.has(input.paidBy)) throw AppError.badRequest('The payer must be a member of this trip.', { code: 'VALIDATION_ERROR', details: { paidBy: 'Not a trip member' } })
  if (input.participants.some((p) => !members.has(p.userId))) {
    throw AppError.badRequest('Everyone sharing the expense must be a member of this trip.', { code: 'VALIDATION_ERROR', details: { participants: 'Not a trip member' } })
  }
  const result = buildSplits(input)
  if (result.error) throw AppError.badRequest(result.error, { code: 'VALIDATION_ERROR', details: { [result.field]: result.error } })
  return result.splits
}

async function findExpense(tripId, expenseId) {
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, tripId }, include: { splits: true } })
  if (!expense) throw AppError.notFound('Expense not found', { code: 'EXPENSE_NOT_FOUND' })
  return expense
}

function assertCanChange(expense, { userId, role }) {
  if (role !== 'LEADER' && expense.createdById !== userId) throw AppError.forbidden(OWNER_MESSAGE, { code: 'NOT_EXPENSE_OWNER' })
}

export async function listExpenses(tripId) {
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({ where: { tripId }, include: { splits: true }, orderBy: { createdAt: 'desc' } }),
    prisma.settlement.findMany({ where: { tripId }, orderBy: { settledAt: 'desc' } }),
  ])
  return { expenses: expenses.map(serializeExpense), settlements: settlements.map(serializeSettlement) }
}

/**
 * POST with an Idempotency-Key: repeating the same key (double-click, retry
 * after a timeout) returns the original expense instead of creating another.
 * Returns { expense, created }.
 */
export async function createExpense({ tripId, userId }, { idempotencyKey, ...input }) {
  const existing = await prisma.expense.findUnique({ where: { idempotencyKey }, include: { splits: true } })
  if (existing) {
    if (existing.tripId !== tripId) throw AppError.conflict('This Idempotency-Key was already used for another trip.', { code: 'IDEMPOTENCY_KEY_REUSED' })
    return { expense: serializeExpense(existing), created: false }
  }
  try {
    const expense = await prisma.$transaction(async (tx) => {
      const splits = await prepare(tx, tripId, input)
      const trip = await tx.trip.findUnique({ where: { id: tripId }, select: { currency: true } })
      const created = await tx.expense.create({
        data: {
          tripId,
          title: input.title,
          amountMinor: BigInt(input.amountMinor),
          currency: trip.currency,
          paidById: input.paidBy,
          splitType: input.splitType,
          category: input.category,
          idempotencyKey,
          createdById: userId,
          splits: { create: splits.map((s) => ({ userId: s.userId, shareMinor: BigInt(s.shareMinor) })) },
        },
        include: { splits: true },
      })
      await logTripActivity(tx, {
        tripId,
        userId,
        action: ACTIONS.EXPENSE_ADDED,
        details: { expenseId: created.id, title: created.title, amountMinor: input.amountMinor, currency: trip.currency },
      })
      return created
    })
    return { expense: serializeExpense(expense), created: true }
  } catch (error) {
    // Two identical requests racing: the unique key lets exactly one through.
    if (error.code === 'P2002') {
      const winner = await prisma.expense.findUnique({ where: { idempotencyKey }, include: { splits: true } })
      if (winner?.tripId === tripId) return { expense: serializeExpense(winner), created: false }
    }
    throw error
  }
}

export async function updateExpense({ tripId, userId, role, expenseId }, input) {
  const expense = await findExpense(tripId, expenseId)
  assertCanChange(expense, { userId, role })
  const updated = await prisma.$transaction(async (tx) => {
    const splits = await prepare(tx, tripId, input)
    await tx.expenseSplit.deleteMany({ where: { expenseId } })
    const result = await tx.expense.update({
      where: { id: expenseId },
      data: {
        title: input.title,
        amountMinor: BigInt(input.amountMinor),
        paidById: input.paidBy,
        splitType: input.splitType,
        category: input.category,
        splits: { create: splits.map((s) => ({ userId: s.userId, shareMinor: BigInt(s.shareMinor) })) },
      },
      include: { splits: true },
    })
    await logTripActivity(tx, { tripId, userId, action: ACTIONS.EXPENSE_UPDATED, details: { expenseId, title: result.title } })
    return result
  })
  return serializeExpense(updated)
}

export async function deleteExpense({ tripId, userId, role, expenseId }) {
  const expense = await findExpense(tripId, expenseId)
  assertCanChange(expense, { userId, role })
  await prisma.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: expenseId } })
    await logTripActivity(tx, {
      tripId,
      userId,
      action: ACTIONS.EXPENSE_DELETED,
      details: { expenseId, title: expense.title, amountMinor: Number(expense.amountMinor), currency: expense.currency },
    })
  })
}

/** The payer, the receiver or the team leader can record that a payment happened. */
export async function recordSettlement({ tripId, userId, role }, { fromUser, toUser, amountMinor }) {
  if (fromUser === toUser) throw AppError.badRequest('Payer and receiver must be different people.', { code: 'VALIDATION_ERROR', details: { toUser: 'Must differ from payer' } })
  if (role !== 'LEADER' && userId !== fromUser && userId !== toUser) {
    throw AppError.forbidden('Only the people involved or the team leader can record this payment.', { code: 'NOT_INVOLVED' })
  }
  const involved = await prisma.user.findMany({
    where: {
      id: { in: [fromUser, toUser] },
      OR: [{ memberships: { some: { tripId } } }, { expensesPaid: { some: { tripId } } }, { expenseShares: { some: { expense: { tripId } } } }],
    },
    select: { id: true, name: true },
  })
  if (involved.length !== 2) throw AppError.badRequest('Both people must be part of this trip.', { code: 'VALIDATION_ERROR' })
  const names = Object.fromEntries(involved.map((u) => [u.id, u.name]))

  const settlement = await prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({ where: { id: tripId }, select: { currency: true } })
    const created = await tx.settlement.create({ data: { tripId, fromUserId: fromUser, toUserId: toUser, amountMinor: BigInt(amountMinor), recordedById: userId } })
    await logTripActivity(tx, {
      tripId,
      userId,
      action: ACTIONS.SETTLEMENT_RECORDED,
      details: { fromUser, toUser, fromName: names[fromUser], toName: names[toUser], amountMinor, currency: trip.currency },
    })
    return created
  })
  return serializeSettlement(settlement)
}

/** Net balance per person and the minimal set of payments to settle up (README §10.2). */
export async function getBalances(tripId) {
  const [{ expenses, settlements }, members] = await Promise.all([listExpenses(tripId), memberIds(prisma, tripId)])
  const balances = computeBalances([...members], expenses, settlements)
  return { balances, suggested: simplifyDebts(balances) }
}

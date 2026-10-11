import { Router } from 'express'
import { z } from 'zod'
import { validate, uuidParam } from '../../middleware/validate.js'
import { AppError } from '../../utils/AppError.js'
import * as expenses from './expenses.service.js'

const CATEGORIES = ['stay', 'transit', 'food', 'activity', 'shopping', 'other']

const expenseSchema = z.object({
  title: z.string().trim().min(2, 'What was this for?').max(120, 'Title is too long'),
  amountMinor: z.number().int('Amount must be in whole paise').min(1, 'Enter an amount greater than zero').max(100_000_000_000),
  paidBy: uuidParam,
  splitType: z.enum(['EQUAL', 'EXACT', 'PERCENT']),
  category: z.enum(CATEGORIES).default('other'),
  // EQUAL: value ignored · EXACT: paise · PERCENT: percentage (up to 2 decimals)
  participants: z.array(z.object({ userId: uuidParam, value: z.number().min(0).optional() })).min(1, 'Pick at least one person').max(50),
})

const settlementSchema = z.object({
  fromUser: uuidParam,
  toUser: uuidParam,
  amountMinor: z.number().int().min(1, 'Enter an amount greater than zero').max(100_000_000_000),
})

const expenseParams = z.object({ tripId: uuidParam, expenseId: uuidParam })
const idempotencyKey = z.string().trim().min(8, 'Idempotency-Key is too short').max(128)

const ctx = (req) => ({ tripId: req.valid.params.tripId, userId: req.user.id, role: req.tripRole, expenseId: req.valid.params.expenseId })

/** Mounted at /api/trips/:tripId behind requireAuth + requireTripAccess() (any member). */
export const expensesRouter = Router({ mergeParams: true })

expensesRouter.get('/expenses', async (req, res) => {
  res.json(await expenses.listExpenses(req.valid.params.tripId))
})

/** Requires an `Idempotency-Key` header (README §10.4). Replays return 200 with the original expense. */
expensesRouter.post('/expenses', validate({ body: expenseSchema }), async (req, res) => {
  const key = idempotencyKey.safeParse(req.get('idempotency-key') ?? '')
  if (!key.success) throw AppError.badRequest('An Idempotency-Key header is required to add an expense.', { code: 'IDEMPOTENCY_KEY_REQUIRED' })
  const { expense, created } = await expenses.createExpense(ctx(req), { ...req.body, idempotencyKey: key.data })
  res.status(created ? 201 : 200).json({ expense, created })
})

expensesRouter.patch('/expenses/:expenseId', validate({ params: expenseParams, body: expenseSchema }), async (req, res) => {
  res.json({ expense: await expenses.updateExpense(ctx(req), req.body) })
})

expensesRouter.delete('/expenses/:expenseId', validate({ params: expenseParams }), async (req, res) => {
  await expenses.deleteExpense(ctx(req))
  res.status(204).end()
})

expensesRouter.get('/balances', async (req, res) => {
  res.json(await expenses.getBalances(req.valid.params.tripId))
})

expensesRouter.post('/settlements', validate({ body: settlementSchema }), async (req, res) => {
  res.status(201).json({ settlement: await expenses.recordSettlement(ctx(req), req.body) })
})

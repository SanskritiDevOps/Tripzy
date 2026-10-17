import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { AppError } from '../../utils/AppError.js'
import { expenseParams, expenseSchema, idempotencyKey, settlementSchema } from './expenses.schemas.js'
import * as expensesService from './expenses.service.js'

const ctx = (req) => ({ tripId: req.valid.params.tripId, userId: req.user.id, role: req.tripRole, expenseId: req.valid.params.expenseId })

/** Mounted at /api/trips/:tripId behind requireAuth + requireTripAccess() (any member). */
export const expensesRouter = Router({ mergeParams: true })

expensesRouter.get('/expenses', async (req, res) => {
  res.json(await expensesService.listExpenses(req.valid.params.tripId))
})

/** Requires an `Idempotency-Key` header. Replays return 200 with the original expense. */
expensesRouter.post('/expenses', validate({ body: expenseSchema }), async (req, res) => {
  const key = idempotencyKey.safeParse(req.get('idempotency-key') ?? '')
  if (!key.success) throw AppError.badRequest('An Idempotency-Key header is required to add an expense.', { code: 'IDEMPOTENCY_KEY_REQUIRED' })
  const { expense, created } = await expensesService.createExpense(ctx(req), { ...req.body, idempotencyKey: key.data })
  res.status(created ? 201 : 200).json({ expense, created })
})

expensesRouter.patch('/expenses/:expenseId', validate({ params: expenseParams, body: expenseSchema }), async (req, res) => {
  res.json({ expense: await expensesService.updateExpense(ctx(req), req.body) })
})

expensesRouter.delete('/expenses/:expenseId', validate({ params: expenseParams }), async (req, res) => {
  await expensesService.deleteExpense(ctx(req))
  res.status(204).end()
})

expensesRouter.get('/balances', async (req, res) => {
  res.json(await expensesService.getBalances(req.valid.params.tripId))
})

expensesRouter.post('/settlements', validate({ body: settlementSchema }), async (req, res) => {
  res.status(201).json({ settlement: await expensesService.recordSettlement(ctx(req), req.body) })
})

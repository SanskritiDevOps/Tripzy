import { z } from 'zod'
import { uuidParam } from '../../middleware/validate.js'

const CATEGORIES = ['stay', 'transit', 'food', 'activity', 'shopping', 'other']

export const expenseSchema = z.object({
  title: z.string().trim().min(2, 'What was this for?').max(120, 'Title is too long'),
  amountMinor: z.number().int('Amount must be in whole paise').min(1, 'Enter an amount greater than zero').max(100_000_000_000),
  paidBy: uuidParam,
  splitType: z.enum(['EQUAL', 'EXACT', 'PERCENT']),
  category: z.enum(CATEGORIES).default('other'),
  // EQUAL: value ignored · EXACT: paise · PERCENT: percentage (up to 2 decimals)
  participants: z.array(z.object({ userId: uuidParam, value: z.number().min(0).optional() })).min(1, 'Pick at least one person').max(50),
})

export const settlementSchema = z.object({
  fromUser: uuidParam,
  toUser: uuidParam,
  amountMinor: z.number().int().min(1, 'Enter an amount greater than zero').max(100_000_000_000),
})

export const expenseParams = z.object({ tripId: uuidParam, expenseId: uuidParam })
export const idempotencyKey = z.string().trim().min(8, 'Idempotency-Key is too short').max(128)

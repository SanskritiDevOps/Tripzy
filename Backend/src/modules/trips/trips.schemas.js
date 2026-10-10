import { z } from 'zod'
import { uuidParam } from '../../middleware/validate.js'

const MAX_TRIP_DAYS = 30
const GROUP_TYPES = ['friends', 'couple', 'family', 'solo', 'work']

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date')

const dayCount = (start, end) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1

const tripFields = {
  name: z.string().trim().min(2, 'Give your trip a name').max(60, 'Keep it under 60 characters'),
  destination: z.string().trim().min(2, 'Where are you going?').max(120, 'Destination is too long'),
  startDate: isoDate,
  endDate: isoDate,
  currency: z.string().trim().toUpperCase().length(3, 'Use a 3-letter currency code'),
  budgetMinor: z.number().int('Budget must be in whole paise').min(0).max(1e12),
  groupType: z.enum(GROUP_TYPES),
}

function checkDates(value, ctx) {
  if (!value.startDate || !value.endDate) return
  const days = dayCount(value.startDate, value.endDate)
  if (days < 1) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The trip must end on or after the start date' })
  else if (days > MAX_TRIP_DAYS) ctx.addIssue({ code: 'custom', path: ['endDate'], message: `Trips can be up to ${MAX_TRIP_DAYS} days long` })
}

export const createTripSchema = z
  .object({
    ...tripFields,
    currency: tripFields.currency.default('INR'),
    budgetMinor: tripFields.budgetMinor.default(0),
    groupType: tripFields.groupType.default('friends'),
  })
  .superRefine(checkDates)

export const updateTripSchema = z
  // No defaults here, so a PATCH never resets fields it didn't send.
  .object(Object.fromEntries(Object.entries(tripFields).map(([key, schema]) => [key, schema.optional()])))
  .refine((value) => Object.values(value).some((v) => v !== undefined), 'Nothing to update')
  .refine((value) => (value.startDate === undefined) === (value.endDate === undefined), {
    path: ['endDate'],
    message: 'Send startDate and endDate together',
  })
  .superRefine(checkDates)

export const tripParams = z.object({ tripId: uuidParam })
export const memberParams = z.object({ tripId: uuidParam, userId: uuidParam })

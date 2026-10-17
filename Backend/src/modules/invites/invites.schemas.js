import { z } from 'zod'
import { uuidParam } from '../../middleware/validate.js'

export const createInviteSchema = z.object({
  email: z.string({ error: 'Email is required' }).trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
})
export const inviteParams = z.object({ tripId: uuidParam, inviteId: uuidParam })
export const tokenSchema = z.object({ token: z.string({ error: 'Invite token is required' }).min(20, 'Invalid invite token').max(200) })

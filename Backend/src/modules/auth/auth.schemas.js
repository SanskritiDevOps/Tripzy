import { z } from 'zod'

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'))

// bcrypt only uses the first 72 bytes, so longer passwords are rejected outright.
const password = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes')

export const registerSchema = z.object({
  name: z.string({ error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  email,
  password: password.refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), 'Use at least one letter and one number'),
})

export const googleSchema = z.object({
  // The ID token (JWT) returned by Google Identity Services.
  credential: z.string({ error: 'Missing Google credential' }).min(20, 'Invalid Google credential').max(4096),
})

export const loginSchema = z.object({
  email,
  // Don't leak the password policy on login; just require something.
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200),
})

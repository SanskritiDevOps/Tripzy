import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url().optional(),
  // Optional: shares Socket.IO rooms across API instances. Unreachable Redis falls back to in-memory.
  REDIS_URL: z.string().trim().optional().transform((v) => v || undefined),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  // Optional: enables "Continue with Google". OAuth 2.0 Web client ID from Google Cloud Console.
  GOOGLE_CLIENT_ID: z.string().trim().optional().transform((v) => v || undefined),
  // Invite emails. Without SMTP_URL, emails are written to the log (dev mode).
  SMTP_URL: z.string().trim().optional().transform((v) => v || undefined),
  MAIL_FROM: z.string().default('Tripzy <no-reply@tripzy.app>'),
  // Public URL of the frontend, used in invite links. Defaults to the first CLIENT_URL.
  APP_URL: z.string().url().optional(),
  INVITE_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')
  console.error(`Invalid environment configuration:\n${problems}`)
  process.exit(1)
}

const values = parsed.data

export const env = {
  ...values,
  isProduction: values.NODE_ENV === 'production',
  isTest: values.NODE_ENV === 'test',
  appUrl: (values.APP_URL ?? values.CLIENT_URL[0]).replace(/\/$/, ''),
  // Tests run against a separate database so they can truncate tables freely.
  databaseUrl: values.NODE_ENV === 'test' && values.TEST_DATABASE_URL ? values.TEST_DATABASE_URL : values.DATABASE_URL,
}

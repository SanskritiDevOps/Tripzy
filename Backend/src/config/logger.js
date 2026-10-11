import pino from 'pino'
import { env } from './env.js'

export const logger = pino({
  level: env.LOG_LEVEL ?? (env.isTest ? 'silent' : env.isProduction ? 'info' : 'debug'),
  // Never write credentials or tokens to the logs.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.GEMINI_API_KEY',
      'req.headers["x-goog-api-key"]',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
  ...(env.isProduction || env.isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
})

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { prisma } from './config/prisma.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { tripsRouter } from './modules/trips/trips.routes.js'
import { publicInvitesRouter } from './modules/invites/invites.routes.js'
import { geoRouter } from './modules/geo/geo.routes.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY)

  app.use(helmet())
  app.use(
    cors({
      // Strict allowlist; credentials are needed for the refresh-token cookie.
      origin: (origin, callback) => callback(null, !origin || env.CLIENT_URL.includes(origin)),
      credentials: true,
    }),
  )
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/api/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  )
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  // API responses are per-user: never let a CDN or proxy (e.g. Vercel in front of /api)
  // cache them. Routes that can be cached privately override this.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  // /health for the host's health check; /api/health is the same through the frontend's
  // /api proxy and also shows the client IP the API sees, to verify TRUST_PROXY.
  const health = async (req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ status: 'ok', database: 'up', ...(req.path === '/api/health' ? { yourIp: req.ip } : {}) })
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' })
    }
  }
  app.get('/health', health)
  app.get('/api/health', health)

  app.use('/api/auth', authRouter)
  app.use('/api/trips', tripsRouter)
  app.use('/api/invites', publicInvitesRouter)
  app.use('/api/geo', geoRouter)

  app.use(notFound)
  app.use(errorHandler)
  return app
}

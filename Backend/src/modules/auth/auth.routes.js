import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { requireAuth } from '../../middleware/auth.js'
import { authLimiter, refreshLimiter } from '../../middleware/rateLimit.js'
import { googleSchema, loginSchema, registerSchema } from './auth.schemas.js'
import * as controller from './auth.controller.js'

export const authRouter = Router()

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), controller.register)
authRouter.post('/signup', authLimiter, validate({ body: registerSchema }), controller.register)
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), controller.login)
authRouter.post('/google', authLimiter, validate({ body: googleSchema }), controller.google)
authRouter.get('/providers', controller.providers)
authRouter.post('/refresh', refreshLimiter, controller.refresh)
authRouter.post('/logout', controller.logout)
authRouter.get('/me', requireAuth(), controller.me)

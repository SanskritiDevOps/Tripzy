import { AppError } from '../utils/AppError.js'
import { logger } from '../config/logger.js'

export function notFound(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`, { code: 'ROUTE_NOT_FOUND' }))
}

/** Maps known errors to clean JSON responses; anything unexpected becomes a 500.
 *  Express recognises error handlers by their four arguments, so `_next` stays. */
export function errorHandler(err, req, res, _next) {
  let error = err

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    error = AppError.badRequest('Request body must be valid JSON', { code: 'INVALID_JSON' })
  } else if (err.type === 'entity.too.large') {
    error = new AppError(413, 'Request body is too large', { code: 'PAYLOAD_TOO_LARGE' })
  } else if (err.code === 'P2002') {
    error = AppError.conflict('That record already exists', { code: 'DUPLICATE' })
  } else if (err.code === 'P2025') {
    error = AppError.notFound('Record not found')
  }

  if (!(error instanceof AppError)) {
    (req.log ?? logger).error({ err }, 'Unhandled error')
    return res.status(500).json({ message: 'Something went wrong on our side. Please try again.', code: 'INTERNAL_ERROR' })
  }

  if (error.status >= 500) (req.log ?? logger).error({ err }, error.message)

  const body = { message: error.message, code: error.code }
  if (error.details) body.details = error.details
  res.status(error.status).json(body)
}

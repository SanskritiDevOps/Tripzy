import { z } from 'zod'
import { AppError } from '../utils/AppError.js'

function toFieldErrors(error) {
  const fields = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    fields[key] ??= issue.message
  }
  return fields
}

/**
 * Validates request parts against Zod schemas: validate({ body, params, query }).
 * The parsed body replaces req.body; parsed params/query land on req.valid
 * (Express 5 makes req.query read-only).
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid ??= {}
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue
      const result = schemas[part].safeParse(req[part] ?? {})
      if (!result.success) {
        return next(
          AppError.badRequest('Please check the highlighted fields.', {
            code: 'VALIDATION_ERROR',
            details: toFieldErrors(result.error),
          }),
        )
      }
      req.valid[part] = result.data
      if (part === 'body') req.body = result.data
    }
    next()
  }
}

export const uuidParam = z.string().uuid('Invalid id')

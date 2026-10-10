/** An error whose message is safe to show to the client. */
export class AppError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message, options) {
    return new AppError(400, message, { code: 'BAD_REQUEST', ...options })
  }

  static unauthorized(message = 'Authentication required', options) {
    return new AppError(401, message, { code: 'UNAUTHORIZED', ...options })
  }

  static forbidden(message = 'You don’t have permission to do that', options) {
    return new AppError(403, message, { code: 'FORBIDDEN', ...options })
  }

  static notFound(message = 'Not found', options) {
    return new AppError(404, message, { code: 'NOT_FOUND', ...options })
  }

  static conflict(message, options) {
    return new AppError(409, message, { code: 'CONFLICT', ...options })
  }
}

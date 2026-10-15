// Errors carry a stable `code` that the frontend translates (EN/AR).
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const bad = (code, message, details) => new HttpError(400, code, message, details);
export const unauthorized = (code = 'login_required', message = 'Please log in') => new HttpError(401, code, message);
export const forbidden = (code = 'forbidden', message = 'Not allowed') => new HttpError(403, code, message);
export const notFound = (code = 'not_found', message = 'Not found') => new HttpError(404, code, message);
export const conflict = (code, message, details) => new HttpError(409, code, message, details);
export const tooMany = (code = 'too_many_attempts', message = 'Too many attempts, try again later') =>
  new HttpError(429, code, message);

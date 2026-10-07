export class AppError extends Error {
  public statusCode: number;
  public details?: unknown;
  public code?: string;

  constructor(message: string, statusCode: number = 500, details?: unknown, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

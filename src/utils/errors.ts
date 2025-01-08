export class BaseError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class TwitterScraperError extends BaseError {
  constructor(
    message: string,
    code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message, code);
  }
}

export class RateLimitError extends TwitterScraperError {
  constructor(retryAfter: number) {
    super(
      'Rate limit exceeded',
      'RATE_LIMIT_ERROR',
      { retryAfter }
    );
  }
}

export class NetworkError extends TwitterScraperError {
  constructor(message: string, public readonly statusCode: number) {
    super(message, 'NETWORK_ERROR', { statusCode });
  }
}

export class ValidationError extends TwitterScraperError {
  constructor(message: string, public readonly issues: unknown[]) {
    super(message, 'VALIDATION_ERROR', { issues });
  }
}
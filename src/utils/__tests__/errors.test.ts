import { describe, it, expect } from 'vitest';
import { RateLimitError, NetworkError, ValidationError } from '../errors';

describe('Error Utilities', () => {
  describe('RateLimitError', () => {
    it('should create rate limit error with retry after context', () => {
      const error = new RateLimitError(60);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.code).toBe('RATE_LIMIT_ERROR');
      expect(error.context).toEqual({ retryAfter: 60 });
    });
  });

  describe('NetworkError', () => {
    it('should create network error with status code', () => {
      const error = new NetworkError('Failed to fetch', 429);
      expect(error.message).toBe('Failed to fetch');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.statusCode).toBe(429);
      expect(error.context).toEqual({ statusCode: 429 });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with issues', () => {
      const issues = [{ path: ['user'], message: 'Required' }];
      const error = new ValidationError('Validation failed', issues);
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.context).toEqual({ issues });
    });
  });
});
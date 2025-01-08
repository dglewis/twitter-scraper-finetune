import { describe, it, expect } from 'vitest';
import { TwitterUserSchema, TweetSchema, ScrapingConfigSchema } from '../index';

describe('Schema Validation', () => {
  describe('TwitterUserSchema', () => {
    it('should validate a correct user object', () => {
      const validUser = {
        id: '123456',
        username: 'testuser',
        displayName: 'Test User',
        followers: 100,
        following: 50,
        createdAt: new Date(),
      };

      const result = TwitterUserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('should fail on invalid user data', () => {
      const invalidUser = {
        id: '123456',
        username: 'testuser',
        // missing required fields
      };

      const result = TwitterUserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
    });
  });

  describe('TweetSchema', () => {
    it('should validate a correct tweet object', () => {
      const validTweet = {
        id: '123456',
        text: 'Hello, world!',
        authorId: '789',
        createdAt: new Date(),
        replyCount: 0,
        retweetCount: 5,
        likeCount: 10,
      };

      const result = TweetSchema.safeParse(validTweet);
      expect(result.success).toBe(true);
    });

    it('should fail on invalid tweet data', () => {
      const invalidTweet = {
        id: '123456',
        text: 'Hello, world!',
        // missing required fields
      };

      const result = TweetSchema.safeParse(invalidTweet);
      expect(result.success).toBe(false);
    });
  });

  describe('ScrapingConfigSchema', () => {
    it('should validate a correct config object', () => {
      const validConfig = {
        maxDepth: 3,
        concurrency: 5,
        rateLimit: 1000,
        timeout: 30000,
        retryAttempts: 3,
      };

      const result = ScrapingConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should fail on invalid config values', () => {
      const invalidConfig = {
        maxDepth: -1, // should be positive
        concurrency: 0, // should be positive
        rateLimit: 1000,
        timeout: 30000,
        retryAttempts: 3,
      };

      const result = ScrapingConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });
});
import { describe, it, expect } from 'vitest';
import { TweetSchema, UserSchema } from '../typescript/types';
import { z } from 'zod';

describe('Twitter Types', () => {
  describe('TweetSchema', () => {
    it('should validate a valid tweet', () => {
      const validTweet = {
        id_str: '1234567890',
        created_at: '2024-01-07T12:00:00Z',
        text: 'Hello, world!',
        user: {
          id_str: '987654321',
          screen_name: 'testuser',
          name: 'Test User',
          description: 'A test user',
          followers_count: 100,
          friends_count: 50,
          verified: false,
        },
        retweet_count: 0,
        favorite_count: 0,
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [],
        },
      };

      const result = TweetSchema.safeParse(validTweet);
      expect(result.success).toBe(true);
    });

    it('should validate a tweet with optional fields', () => {
      const tweetWithOptionals = {
        id_str: '1234567890',
        created_at: '2024-01-07T12:00:00Z',
        text: 'Hello, world!',
        full_text: 'Hello, world! This is a longer tweet.',
        user: {
          id_str: '987654321',
          screen_name: 'testuser',
          name: 'Test User',
          description: 'A test user',
          followers_count: 100,
          friends_count: 50,
          verified: false,
        },
        retweet_count: 0,
        favorite_count: 0,
        reply_count: 5,
        quote_count: 2,
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
        entities: {
          hashtags: [{ text: 'test' }],
          urls: [{
            url: 'https://t.co/abc',
            expanded_url: 'https://example.com',
            display_url: 'example.com',
          }],
          user_mentions: [],
        },
      };

      const result = TweetSchema.safeParse(tweetWithOptionals);
      expect(result.success).toBe(true);
    });

    it('should reject invalid tweet data', () => {
      const invalidTweet = {
        id_str: 12345, // Should be string
        text: 'Hello, world!',
      };

      const result = TweetSchema.safeParse(invalidTweet);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('UserSchema', () => {
    it('should validate a valid user', () => {
      const validUser = {
        id_str: '987654321',
        screen_name: 'testuser',
        name: 'Test User',
        description: 'A test user',
        followers_count: 100,
        friends_count: 50,
        statuses_count: 1000,
        favourites_count: 500,
        created_at: '2024-01-07T12:00:00Z',
        verified: false,
        protected: false,
        location: 'San Francisco, CA',
        url: 'https://example.com',
        profile_image_url_https: 'https://example.com/avatar.jpg',
      };

      const result = UserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('should validate a user with null fields', () => {
      const userWithNulls = {
        id_str: '987654321',
        screen_name: 'testuser',
        name: 'Test User',
        description: null,
        followers_count: 100,
        friends_count: 50,
        statuses_count: 1000,
        favourites_count: 500,
        created_at: '2024-01-07T12:00:00Z',
        verified: false,
        protected: false,
        location: null,
        url: null,
        profile_image_url_https: 'https://example.com/avatar.jpg',
      };

      const result = UserSchema.safeParse(userWithNulls);
      expect(result.success).toBe(true);
    });

    it('should reject invalid user data', () => {
      const invalidUser = {
        id_str: 12345, // Should be string
        name: 'Test User',
      };

      const result = UserSchema.safeParse(invalidUser);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
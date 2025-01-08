import { describe, it, expect } from 'vitest';
import { TweetFilter } from '../typescript/TweetFilter';
import type { Tweet } from '../typescript/types';

console.log('Module import:', { TweetFilter });

describe('TweetFilter', () => {
  console.log('Inside describe:', { TweetFilter });
  describe('isValid', () => {
    it('should accept valid tweets', () => {
      const validTweet: Tweet = {
        id_str: '1234567890',
        created_at: '2024-01-07T12:00:00Z',
        text: 'This is a valid tweet',
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
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [],
        },
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
      };

      expect(TweetFilter.isValid(validTweet)).toBe(true);
    });

    it('should reject tweets with missing required fields', () => {
      const invalidTweet = {
        id_str: '1234567890',
        // missing created_at
        text: 'This is an invalid tweet',
        user: {
          id_str: '987654321',
          screen_name: 'testuser',
          name: 'Test User',
          description: 'A test user',
          followers_count: 100,
          friends_count: 50,
          verified: false,
        },
      } as Tweet;

      expect(TweetFilter.isValid(invalidTweet)).toBe(false);
    });

    it('should reject tweets from suspended/deleted accounts', () => {
      const tweetFromSuspendedAccount: Tweet = {
        id_str: '1234567890',
        created_at: '2024-01-07T12:00:00Z',
        text: 'Tweet from suspended account',
        user: {
          id_str: '987654321',
          screen_name: '', // empty screen name
          name: 'Test User',
          description: 'A test user',
          followers_count: 100,
          friends_count: 50,
          verified: false,
        },
        retweet_count: 0,
        favorite_count: 0,
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [],
        },
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
      };

      expect(TweetFilter.isValid(tweetFromSuspendedAccount)).toBe(false);
    });

    it('should reject tweets that are too short', () => {
      const shortTweet: Tweet = {
        id_str: '1234567890',
        created_at: '2024-01-07T12:00:00Z',
        text: 'hi',
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
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [],
        },
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
      };

      expect(TweetFilter.isValid(shortTweet)).toBe(false);
    });

    it('should reject tweets that are just URLs', () => {
      const urlOnlyTweet: Tweet = {
        id_str: '1234567890',
        created_at: '2024-01-07T12:00:00Z',
        text: 'https://example.com',
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
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [],
        },
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
      };

      expect(TweetFilter.isValid(urlOnlyTweet)).toBe(false);
    });

    it('should reject tweets that are just hashtags', () => {
      const hashtagOnlyTweet: Tweet = {
        id_str: '1234567890',
        created_at: '2024-01-07T12:00:00Z',
        text: '#test #hashtag',
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
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [],
        },
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
      };

      expect(TweetFilter.isValid(hashtagOnlyTweet)).toBe(false);
    });

    it('should reject tweets that are just mentions', () => {
      const mentionOnlyTweet: Tweet = {
        id_str: '1234567890',
        created_at: '2024-01-07T12:00:00Z',
        text: '@user1 @user2',
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
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [],
        },
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
      };

      expect(TweetFilter.isValid(mentionOnlyTweet)).toBe(false);
    });
  });
});
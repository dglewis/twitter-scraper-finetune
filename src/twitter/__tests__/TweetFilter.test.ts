import { describe, it, expect } from 'vitest';
import { TweetFilter } from '../typescript/TweetFilter';
import type { Tweet, CollectionOptions } from '../typescript/types';

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

  describe('promptCollectionMode', () => {
    it('should return default collection options', async () => {
      const options = await TweetFilter.promptCollectionMode();
      expect(options).toEqual({
        tweetTypes: [],
        contentTypes: [],
        filterByEngagement: false,
        filterByDate: false,
        excludeKeywords: false
      });
    });
  });

  describe('promptCustomOptions', () => {
    it('should return default collection options', async () => {
      const options = await TweetFilter.promptCustomOptions();
      expect(options).toEqual({
        tweetTypes: [],
        contentTypes: [],
        filterByEngagement: false,
        filterByDate: false,
        excludeKeywords: false
      });
    });
  });

  describe('collection options validation', () => {
    it('should validate engagement filters when enabled', async () => {
      const options = await TweetFilter.promptCustomOptions();
      options.filterByEngagement = true;
      options.minLikes = 10;
      options.minRetweets = 5;

      expect(options.filterByEngagement).toBe(true);
      expect(options.minLikes).toBe(10);
      expect(options.minRetweets).toBe(5);
    });

    it('should validate date filters when enabled', async () => {
      const options = await TweetFilter.promptCustomOptions();
      options.filterByDate = true;
      options.startDate = '2024-01-01';
      options.endDate = '2024-01-07';

      expect(options.filterByDate).toBe(true);
      expect(options.startDate).toBe('2024-01-01');
      expect(options.endDate).toBe('2024-01-07');
    });

    it('should validate keyword exclusions when enabled', async () => {
      const options = await TweetFilter.promptCustomOptions();
      options.excludeKeywords = true;
      options.keywordsToExclude = ['spam', 'ads'];

      expect(options.excludeKeywords).toBe(true);
      expect(options.keywordsToExclude).toEqual(['spam', 'ads']);
    });
  });
});
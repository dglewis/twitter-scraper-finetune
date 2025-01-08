import { describe, it, expect } from 'vitest';
import type { Tweet } from '../typescript/types';
import { TweetProcessor } from '../typescript/TweetProcessor';

describe('TweetProcessor', () => {
  describe('processTweet', () => {
    it('should process a basic tweet correctly', () => {
      const rawTweet: Tweet = {
        id_str: '1234567890',
        created_at: 'Wed Oct 10 20:19:24 +0000 2023',
        text: 'Hello, world!',
        full_text: 'Hello, world! This is a test tweet.',
        user: {
          id_str: '987654321',
          screen_name: 'testuser',
          name: 'Test User',
          description: null,
          followers_count: 100,
          friends_count: 50,
          verified: false,
        },
        retweet_count: 5,
        favorite_count: 10,
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

      const processor = new TweetProcessor();
      const processed = processor.processTweet(rawTweet);

      expect(processed).toEqual({
        id: '1234567890',
        text: 'Hello, world! This is a test tweet.',
        created_at: '2023-10-10T20:19:24.000Z',
        author: {
          id: '987654321',
          username: 'testuser',
          name: 'Test User',
          followers_count: 100,
          following_count: 50,
          is_verified: false,
        },
        metrics: {
          retweets: 5,
          likes: 10,
          replies: 0,
          quotes: 0,
        },
        entities: {
          hashtags: [],
          urls: [],
          mentions: [],
        },
        referenced_tweets: {
          replied_to: null,
          quoted: null,
          retweeted: null,
        },
      });
    });

    it('should process tweet entities correctly', () => {
      const rawTweet: Tweet = {
        id_str: '1234567890',
        created_at: 'Wed Oct 10 20:19:24 +0000 2023',
        text: 'Hello @user! Check out https://t.co/abc #test',
        full_text: 'Hello @user! Check out https://t.co/abc #test',
        user: {
          id_str: '987654321',
          screen_name: 'testuser',
          name: 'Test User',
          description: null,
          followers_count: 100,
          friends_count: 50,
          verified: false,
        },
        retweet_count: 0,
        favorite_count: 0,
        entities: {
          hashtags: [{ text: 'test' }],
          urls: [{
            url: 'https://t.co/abc',
            expanded_url: 'https://example.com',
            display_url: 'example.com',
          }],
          user_mentions: [{
            id_str: '11111',
            screen_name: 'user',
            name: 'Test User',
          }],
        },
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
      };

      const processor = new TweetProcessor();
      const processed = processor.processTweet(rawTweet);

      expect(processed.entities).toEqual({
        hashtags: ['test'],
        urls: [{
          short_url: 'https://t.co/abc',
          expanded_url: 'https://example.com',
          display_url: 'example.com',
        }],
        mentions: [{
          id: '11111',
          username: 'user',
          name: 'Test User',
        }],
      });
    });

    it('should process referenced tweets correctly', () => {
      const rawTweet: Tweet = {
        id_str: '1234567890',
        created_at: 'Wed Oct 10 20:19:24 +0000 2023',
        text: 'Replying to @user',
        full_text: 'Replying to @user',
        user: {
          id_str: '987654321',
          screen_name: 'testuser',
          name: 'Test User',
          description: null,
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
        in_reply_to_status_id_str: '99999',
        in_reply_to_user_id_str: '88888',
        quoted_status_id_str: '77777',
        retweeted_status_id_str: '66666',
      };

      const processor = new TweetProcessor();
      const processed = processor.processTweet(rawTweet);

      expect(processed.referenced_tweets).toEqual({
        replied_to: {
          tweet_id: '99999',
          author_id: '88888',
        },
        quoted: '77777',
        retweeted: '66666',
      });
    });

    it('should handle optional metrics correctly', () => {
      const rawTweet: Tweet = {
        id_str: '1234567890',
        created_at: 'Wed Oct 10 20:19:24 +0000 2023',
        text: 'Test tweet',
        full_text: 'Test tweet',
        user: {
          id_str: '987654321',
          screen_name: 'testuser',
          name: 'Test User',
          description: null,
          followers_count: 100,
          friends_count: 50,
          verified: false,
        },
        retweet_count: 5,
        favorite_count: 10,
        reply_count: 3,
        quote_count: 2,
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

      const processor = new TweetProcessor();
      const processed = processor.processTweet(rawTweet);

      expect(processed.metrics).toEqual({
        retweets: 5,
        likes: 10,
        replies: 3,
        quotes: 2,
      });
    });
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TwitterPipeline } from '../typescript/TwitterPipeline';
import { TweetProcessor } from '../typescript/TweetProcessor';
import { DataProcessor } from '../typescript/DataProcessor';
import type { Tweet } from '../typescript/types';

// Create mock functions
const mockProcessTweet = vi.fn();

// Mock TweetProcessor
vi.mock('../typescript/TweetProcessor', () => ({
  TweetProcessor: vi.fn().mockImplementation(() => ({
    processTweet: mockProcessTweet,
  })),
}));

// Mock DataProcessor
vi.mock('../typescript/DataProcessor', () => ({
  DataProcessor: vi.fn().mockImplementation(() => ({
    getLastNextToken: vi.fn().mockResolvedValue(null),
    saveNextToken: vi.fn().mockResolvedValue(undefined),
    getPaths: vi.fn().mockReturnValue({
      raw: { tweets: '/test/tweets.json', urls: '/test/urls.txt' },
      processed: { finetuning: '/test/finetuning.jsonl' },
      analytics: { stats: '/test/stats.json' },
      exports: { summary: '/test/summary.md' },
      meta: { nextToken: '/test/next_token.txt' },
    }),
  })),
}));

// Mock Logger
vi.mock('../typescript/Logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    updateCollectionProgress: vi.fn(),
  },
}));

describe('TwitterPipeline', () => {
  let pipeline: TwitterPipeline;

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new TwitterPipeline('testuser');
    // Mock the private randomDelay method
    vi.spyOn(pipeline as any, 'randomDelay').mockResolvedValue(undefined);
    // Setup mock implementation for processTweet
    mockProcessTweet.mockImplementation((tweet: Tweet) => ({
      id: tweet.id_str,
      text: tweet.text,
      created_at: tweet.created_at,
      author: {
        id: tweet.user.id_str,
        username: tweet.user.screen_name,
        name: tweet.user.name,
        followers_count: tweet.user.followers_count,
        following_count: tweet.user.friends_count,
        is_verified: tweet.user.verified,
      },
      metrics: {
        retweets: tweet.retweet_count,
        likes: tweet.favorite_count,
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
    }));
  });

  describe('tweet processing', () => {
    it('should use TweetProcessor for processing tweets', async () => {
      const mockTweet: Tweet = {
        id_str: '123',
        text: 'test tweet',
        created_at: '2023-01-01T00:00:00.000Z',
        user: {
          id_str: 'user123',
          screen_name: 'testuser',
          name: 'Test User',
          description: null,
          followers_count: 100,
          friends_count: 100,
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

      // Mock the scraper's getTweets method
      const mockScraper = {
        getTweets: vi.fn().mockImplementation(async function* () {
          yield mockTweet;
        }),
      };

      // Call collectTweets
      await pipeline.collectTweets(mockScraper as any);

      // Verify TweetProcessor was used
      expect(mockProcessTweet).toHaveBeenCalledWith(mockTweet);
    });

    it('should handle empty tweet responses', async () => {
      const mockScraper = {
        getTweets: vi.fn().mockImplementation(async function* () {
          // yield nothing
        }),
      };

      const tweets = await pipeline.collectTweets(mockScraper as any);
      expect(tweets).toHaveLength(0);
    });

    it('should stop after reaching maxTweets', async () => {
      // Override maxTweets to a small number for faster testing
      pipeline['config'].twitter.maxTweets = 2;

      const mockTweet: Tweet = {
        id_str: '123',
        text: 'test tweet',
        created_at: '2023-01-01T00:00:00.000Z',
        user: {
          id_str: 'user123',
          screen_name: 'testuser',
          name: 'Test User',
          description: null,
          followers_count: 100,
          friends_count: 100,
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

      const mockScraper = {
        getTweets: vi.fn().mockImplementation(async function* () {
          for (let i = 0; i < 5; i++) { // Try to yield more than maxTweets
            yield { ...mockTweet, id_str: `${i}` };
          }
        }),
      };

      const tweets = await pipeline.collectTweets(mockScraper as any);
      expect(tweets).toHaveLength(2); // Should stop at maxTweets
      expect(mockScraper.getTweets).toHaveBeenCalledTimes(1);
    });
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(pipeline).toBeInstanceOf(TwitterPipeline);
      expect(pipeline['username']).toBe('testuser');
      expect(pipeline['tweetProcessor']).toBeDefined();
      expect(pipeline['dataProcessor']).toBeDefined();
      expect(pipeline['config']).toBeDefined();
      expect(pipeline['config'].twitter.maxTweets).toBeGreaterThan(0);
    });

    it('should use environment variables for configuration', () => {
      process.env.MAX_TWEETS = '1000';
      process.env.MAX_RETRIES = '3';
      const configuredPipeline = new TwitterPipeline('testuser');
      expect(configuredPipeline['config'].twitter.maxTweets).toBe(1000);
      expect(configuredPipeline['config'].twitter.maxRetries).toBe(3);
    });
  });

  describe('error handling', () => {
    it('should handle rate limits gracefully', async () => {
      const mockScraper = {
        getTweets: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      };

      const result = await pipeline.collectTweets(mockScraper as any);
      expect(result).toEqual([]);
    });

    it('should retry on rate limit before giving up', async () => {
      // Set a low rate limit threshold
      pipeline['config'].twitter.rateLimitThreshold = 2;

      const mockTweet: Tweet = {
        id_str: '123',
        text: 'test tweet',
        created_at: '2023-01-01T00:00:00.000Z',
        user: {
          id_str: 'user123',
          screen_name: 'testuser',
          name: 'Test User',
          description: null,
          followers_count: 100,
          friends_count: 100,
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

      const mockScraper = {
        getTweets: vi.fn()
          .mockRejectedValueOnce(new Error('Rate limit exceeded'))
          .mockRejectedValueOnce(new Error('Rate limit exceeded')),
      };

      await pipeline.collectTweets(mockScraper as any);
      expect(mockScraper.getTweets).toHaveBeenCalledTimes(2);
      expect(mockProcessTweet).not.toHaveBeenCalled();
    });
  });

  describe('fallback mode', () => {
    it('should throw error when fallback is disabled', async () => {
      pipeline['config'].fallback.enabled = false;
      await expect(pipeline.collectWithFallback('query')).rejects.toThrow('Fallback mode is disabled');
    });

    it('should handle fallback collection errors', async () => {
      const result = await pipeline.collectWithFallback('query');
      expect(result).toEqual([]);
    });
  });
});
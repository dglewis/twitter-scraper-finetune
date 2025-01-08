import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TwitterPipeline } from '../typescript/TwitterPipeline';
import { Scraper } from 'agent-twitter-client';
import fs from 'fs/promises';

vi.mock('fs/promises');
vi.mock('agent-twitter-client');

const mockTweet = {
  id: '1234567890',
  text: 'This is a test tweet',
  username: 'testuser',
  name: 'Test User',
  userId: '987654321',
  timeParsed: new Date('2024-01-07T12:00:00Z'),
  retweets: 0,
  likes: 0,
  replies: 0,
  hashtags: [],
  urls: [],
  inReplyToStatusId: null,
  quotedStatusId: null,
  retweetedStatusId: null
};

const mockScraper = {
  getTweets: vi.fn().mockImplementation(async function* () {
    yield mockTweet;
  }),
  login: vi.fn().mockResolvedValue(undefined),
  isLoggedIn: vi.fn().mockResolvedValue(true),
  setCookies: vi.fn().mockResolvedValue(undefined),
  getCookies: vi.fn().mockResolvedValue([{ name: 'test_cookie' }]),
  cleanup: vi.fn().mockResolvedValue(undefined),
};

vi.mocked(Scraper).mockImplementation(() => mockScraper as any);

describe('TwitterPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWITTER_USERNAME = 'test_user';
    process.env.TWITTER_PASSWORD = 'test_pass';
    process.env.TWITTER_EMAIL = 'test@example.com';
  });

  describe('Scraper Initialization', () => {
    it('should initialize scraper with saved cookies if available', async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify([{ name: 'test_cookie' }]));
      mockScraper.isLoggedIn.mockResolvedValueOnce(true);

      const pipeline = new TwitterPipeline('testuser', { maxTweets: 1 });
      vi.spyOn(pipeline as any, 'randomDelay').mockResolvedValue(undefined);
      const success = await pipeline['initializeScraper']();

      expect(success).toBe(true);
      expect(fs.access).toHaveBeenCalled();
      expect(fs.readFile).toHaveBeenCalled();
      expect(mockScraper.setCookies).toHaveBeenCalledWith([{ name: 'test_cookie' }]);
    });

    it('should attempt fresh login if cookies are invalid', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('File not found'));
      mockScraper.isLoggedIn.mockResolvedValueOnce(false);
      mockScraper.login.mockResolvedValueOnce(undefined);

      const pipeline = new TwitterPipeline('testuser', { maxTweets: 1 });
      vi.spyOn(pipeline as any, 'randomDelay').mockResolvedValue(undefined);
      const success = await pipeline['initializeScraper']();

      expect(success).toBe(true);
      expect(mockScraper.login).toHaveBeenCalledWith('test_user', 'test_pass', 'test@example.com');
      expect(mockScraper.getCookies).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Tweet Collection', () => {
    it('should collect and process tweets successfully', async () => {
      mockScraper.getTweets.mockImplementation(async function* () {
        yield mockTweet;
      });

      const pipeline = new TwitterPipeline('testuser', { maxTweets: 1 });
      vi.spyOn(pipeline as any, 'randomDelay').mockResolvedValue(undefined);
      const scraper = pipeline['scraper'] as Scraper;
      const tweets = await pipeline.collectTweets(scraper);

      expect(tweets).toHaveLength(1);
      expect(mockScraper.getTweets).toHaveBeenCalledWith('testuser', undefined);
    });

    it('should handle rate limits gracefully', async () => {
      // Reset the mock implementation first
      mockScraper.getTweets.mockReset();
      // Then implement the rate limit error followed by empty responses
      let callCount = 0;
      mockScraper.getTweets.mockImplementation(async function* () {
        callCount++;
        if (callCount === 1) {
          throw new Error('Rate limit exceeded');
        }
        // Return empty array for subsequent calls to trigger the "no new tweets" condition
        return [];
      });

      const pipeline = new TwitterPipeline('testuser', { maxTweets: 1 });
      vi.spyOn(pipeline as any, 'randomDelay').mockResolvedValue(undefined);
      const scraper = pipeline['scraper'] as Scraper;
      const tweets = await pipeline.collectTweets(scraper);

      expect(tweets).toHaveLength(0);
      // We expect 4 calls:
      // 1. Initial call that hits rate limit
      // 2. Retry after rate limit
      // 3-4. Empty response attempts before stopping
      expect(mockScraper.getTweets).toHaveBeenCalledTimes(4);
    });

    it('should stop after three empty responses', async () => {
      mockScraper.getTweets.mockImplementation(async function* () {
        yield* [];
      });

      const pipeline = new TwitterPipeline('testuser', { maxTweets: 1 });
      vi.spyOn(pipeline as any, 'randomDelay').mockResolvedValue(undefined);
      const scraper = pipeline['scraper'] as Scraper;
      const tweets = await pipeline.collectTweets(scraper);

      expect(tweets).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle scraper initialization failures', async () => {
      mockScraper.isLoggedIn.mockResolvedValue(false);
      mockScraper.login.mockRejectedValue(new Error('Login verification failed'));

      const pipeline = new TwitterPipeline('testuser', { maxTweets: 1 });
      vi.spyOn(pipeline as any, 'randomDelay').mockResolvedValue(undefined);
      const success = await pipeline['initializeScraper']();

      expect(success).toBe(false);
    });

    it('should handle cookie saving failures', async () => {
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Write failed'));
      mockScraper.getCookies.mockResolvedValueOnce([{ name: 'test_cookie' }]);

      const pipeline = new TwitterPipeline('testuser', { maxTweets: 1 });
      await pipeline['saveCookies']();

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CLI } from '../typescript/CLI';
import { TwitterPipeline } from '../typescript/TwitterPipeline';
import { DataProcessor } from '../typescript/DataProcessor';
import { TweetProcessor } from '../typescript/TweetProcessor';
import { CollectionMode } from '../typescript/types';
import type { Tweet } from '../typescript/types';
import Logger from '../typescript/Logger';
import { promises as fs } from 'fs';

// Mock all dependencies
vi.mock('../typescript/TwitterPipeline');
vi.mock('../typescript/DataProcessor', () => ({
  DataProcessor: vi.fn().mockImplementation(() => ({
    saveTweets: vi.fn().mockImplementation(async (tweets) => {
      await fs.writeFile('/test/tweets.json', JSON.stringify(tweets), 'utf-8');
    }),
    getPaths: vi.fn().mockReturnValue({
      raw: { tweets: '/test/tweets.json', urls: '/test/urls.txt' },
      processed: { finetuning: '/test/finetuning.jsonl' },
      analytics: { stats: '/test/stats.json' },
      exports: { summary: '/test/summary.md' },
      meta: { nextToken: '/test/next_token.txt' },
    }),
  })),
}));
vi.mock('../typescript/TweetProcessor');
vi.mock('../typescript/Logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
    updateCollectionProgress: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe('Twitter Scraper Integration', () => {
  let cli: CLI;
  let mockTweet: Tweet;
  let originalProcessExit: (code?: number) => never;
  let exitMock: ReturnType<typeof vi.fn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    // Save original process.env
    originalEnv = process.env;
    process.env = { ...originalEnv };

    // Mock process.exit
    originalProcessExit = process.exit;
    exitMock = vi.fn();
    process.exit = exitMock as any;

    // Setup environment variables
    process.env.TWITTER_USERNAME = 'testuser';
    process.env.TWITTER_PASSWORD = 'testpass';

    // Create mock tweet data
    mockTweet = {
      id_str: '123456789',
      text: 'Test tweet',
      created_at: '2023-01-01T00:00:00.000Z',
      user: {
        id_str: 'user123',
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

    // Setup CLI with command line arguments
    process.argv = ['node', 'script.js', '--mode', 'timeline', '--username', 'testuser'];
    cli = new CLI();
  });

  afterEach(() => {
    vi.resetModules();
    process.env = originalEnv;
    process.argv = ['node', 'script.js'];
    process.exit = originalProcessExit;
  });

  describe('Complete Workflow', () => {
    it('should successfully collect and process tweets', async () => {
      // Mock TwitterPipeline implementation
      const mockPipeline = {
        run: vi.fn().mockImplementation(async () => {
          const dataProcessor = new DataProcessor('testuser', '/test/data');
          await dataProcessor.saveTweets([mockTweet]);
          return [mockTweet];
        }),
        cleanup: vi.fn().mockResolvedValue(undefined),
        randomDelay: vi.fn().mockResolvedValue(undefined),
        collectTweets: vi.fn().mockResolvedValue([mockTweet]),
        collectWithFallback: vi.fn().mockResolvedValue([mockTweet]),
      };

      vi.mocked(TwitterPipeline).mockImplementation(() => mockPipeline as unknown as TwitterPipeline);

      // Setup CLI with command line arguments
      process.argv = ['node', 'script.js', '--mode', 'timeline', '--username', 'testuser'];
      cli = new CLI();

      // Run the CLI
      await cli.run();

      // Verify environment validation
      expect(Logger.startSpinner).toHaveBeenCalledWith('Validating environment');
      expect(Logger.stopSpinner).toHaveBeenCalled();

      // Verify TwitterPipeline was initialized correctly
      expect(TwitterPipeline).toHaveBeenCalledWith('testuser', expect.objectContaining({ maxTweets: 1000 }));

      // Verify tweet collection
      expect(mockPipeline.run).toHaveBeenCalled();

      // Verify data processing
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tweets.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should handle collection errors gracefully', async () => {
      // Mock TwitterPipeline to throw an error
      const mockPipeline = {
        run: vi.fn().mockRejectedValue(new Error('Collection failed')),
        cleanup: vi.fn().mockResolvedValue(undefined),
        randomDelay: vi.fn().mockResolvedValue(undefined),
        collectTweets: vi.fn().mockRejectedValue(new Error('Collection failed')),
        collectWithFallback: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(TwitterPipeline).mockImplementation(() => mockPipeline as unknown as TwitterPipeline);

      // Setup CLI with command line arguments
      process.argv = ['node', 'script.js', '--mode', 'timeline', '--username', 'testuser'];
      cli = new CLI();

      // Run the CLI
      await cli.run();

      // Verify error handling
      expect(exitMock).toHaveBeenCalledWith(1);
      expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Collection failed'));
    });

    it('should handle rate limits with fallback mode', async () => {
      // Mock TwitterPipeline implementation
      const mockPipeline = {
        run: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')),
        cleanup: vi.fn().mockResolvedValue(undefined),
        randomDelay: vi.fn().mockResolvedValue(undefined),
        collectTweets: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')),
        collectWithFallback: vi.fn().mockImplementation(async () => {
          const dataProcessor = new DataProcessor('testuser', '/test/data');
          await dataProcessor.saveTweets([mockTweet]);
          return [mockTweet];
        }),
      };

      vi.mocked(TwitterPipeline).mockImplementation(() => mockPipeline as unknown as TwitterPipeline);

      // Setup CLI with command line arguments
      process.argv = ['node', 'script.js', '--mode', 'timeline', '--username', 'testuser'];
      cli = new CLI();

      // Run the CLI
      await cli.run();

      // Verify fallback collection was attempted
      expect(mockPipeline.collectWithFallback).toHaveBeenCalled();
      expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('Rate limit exceeded'));
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Attempting fallback'));
    });

    it('should process different collection modes correctly', async () => {
      // Test different collection modes
      const modes = [CollectionMode.Timeline, CollectionMode.Search, CollectionMode.Likes];

      for (const mode of modes) {
        // Reset mocks
        vi.clearAllMocks();

        // Mock TwitterPipeline for this mode
        const mockPipeline = {
          run: vi.fn().mockImplementation(async () => {
            const dataProcessor = new DataProcessor('testuser', '/test/data');
            await dataProcessor.saveTweets([mockTweet]);
            return [mockTweet];
          }),
          cleanup: vi.fn().mockResolvedValue(undefined),
          randomDelay: vi.fn().mockResolvedValue(undefined),
          collectTweets: vi.fn().mockResolvedValue([mockTweet]),
          collectWithFallback: vi.fn().mockResolvedValue([mockTweet]),
        };

        vi.mocked(TwitterPipeline).mockImplementation(() => mockPipeline as unknown as TwitterPipeline);

        // Setup CLI with specific mode
        process.argv = ['node', 'script.js', '--mode', mode, '--username', 'testuser'];
        const modeSpecificCli = new CLI();

        // Run the CLI
        await modeSpecificCli.run();

        // Verify mode-specific behavior
        expect(TwitterPipeline).toHaveBeenCalledWith('testuser', expect.objectContaining({ maxTweets: 1000 }));
        expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining(mode));
      }
    });
  });
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Tweet } from '../typescript/types';
import { DataProcessor } from '../typescript/DataProcessor';
import { promises as fs } from 'fs';
import path from 'path';

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
  },
}));

describe('DataProcessor', () => {
  let processor: DataProcessor;
  const baseDir = '/test/data';
  const username = 'testuser';

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new DataProcessor(baseDir, username);
  });

  describe('Directory Structure', () => {
    it('should create required directories on initialization', async () => {
      const expectedDirs = ['raw', 'processed', 'analytics', 'exports', 'meta'];

      await processor.createDirectories();

      expectedDirs.forEach(dir => {
        expect(fs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining(dir),
          expect.any(Object)
        );
      });
    });

    it('should use constructor username for directory path, not default', async () => {
      const customUsername = 'customuser';
      const processor = new DataProcessor(baseDir, customUsername);
      await processor.createDirectories();

      // Verify all directory creations use the custom username
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(`/${customUsername.toLowerCase()}/`),
        expect.any(Object)
      );
      // Verify no directories are created with default username
      expect(fs.mkdir).not.toHaveBeenCalledWith(
        expect.stringContaining('/degenspartan/'),
        expect.any(Object)
      );
    });

    it('should handle directory creation errors gracefully', async () => {
      vi.mocked(fs.mkdir).mockRejectedValueOnce(new Error('Permission denied'));

      await expect(processor.createDirectories()).resolves.not.toThrow();
    });
  });

  describe('Path Management', () => {
    it('should generate correct file paths', () => {
      const paths = processor.getPaths();

      expect(paths.raw.tweets).toContain('raw/tweets.json');
      expect(paths.processed.finetuning).toContain('processed/finetuning.jsonl');
      expect(paths.analytics.stats).toContain('analytics/stats.json');
      expect(paths.exports.summary).toContain('exports/summary.md');
      expect(paths.meta.nextToken).toContain('meta/next_token.txt');
    });

    it('should use lowercase username in paths', () => {
      const paths = processor.getPaths();

      Object.values(paths).forEach(category => {
        Object.values(category).forEach(p => {
          expect(p).toContain('testuser');
        });
      });
    });
  });

  describe('Token Management', () => {
    it('should save and retrieve next token', async () => {
      const mockToken = 'test_token_123';
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockToken);
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);

      await processor.saveNextToken(mockToken);
      const retrievedToken = await processor.getLastNextToken();

      expect(retrievedToken).toBe(mockToken);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('next_token.txt'),
        mockToken,
        'utf-8'
      );
    });

    it('should handle missing token file gracefully', async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('File not found'));

      const token = await processor.getLastNextToken();

      expect(token).toBeNull();
    });
  });

  describe('Data Processing', () => {
    const mockTweets: Tweet[] = [
      {
        id_str: '123',
        text: 'Test tweet 1',
        created_at: '2023-01-01T12:00:00.000Z',
        favorite_count: 10,
        retweet_count: 5,
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
        user: {
          id_str: 'user123',
          screen_name: 'testuser',
          name: 'Test User',
          description: 'Test user description',
          followers_count: 100,
          friends_count: 50,
          verified: false,
        },
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [],
        },
      },
      {
        id_str: '456',
        text: 'Test tweet 2',
        created_at: '2023-01-02T12:00:00.000Z',
        favorite_count: 20,
        retweet_count: 8,
        in_reply_to_status_id_str: '789',
        in_reply_to_user_id_str: 'user789',
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
        user: {
          id_str: 'user123',
          screen_name: 'testuser',
          name: 'Test User',
          description: 'Test user description',
          followers_count: 100,
          friends_count: 50,
          verified: false,
        },
        entities: {
          hashtags: [],
          urls: [{ url: 'https://test.com', expanded_url: 'https://test.com', display_url: 'test.com' }],
          user_mentions: [],
        },
      },
      {
        id_str: '789',
        text: 'Original tweet',
        created_at: '2023-01-03T12:00:00.000Z',
        favorite_count: 100,
        retweet_count: 50,
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
        user: {
          id_str: 'user456',
          screen_name: 'otheruser',
          name: 'Other User',
          description: 'Other user description',
          followers_count: 200,
          friends_count: 100,
          verified: true,
        },
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [],
        },
      },
      {
        id_str: '101112',
        text: 'RT @otheruser: Original tweet',
        created_at: '2023-01-03T13:00:00.000Z',
        favorite_count: 0,
        retweet_count: 0,
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: '789',
        user: {
          id_str: 'user789',
          screen_name: 'retweeter',
          name: 'Retweeter',
          description: 'Retweeter description',
          followers_count: 50,
          friends_count: 25,
          verified: false,
        },
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: [{
            id_str: 'user456',
            screen_name: 'otheruser',
            name: 'Other User',
          }],
        },
      },
    ];

    it('should save tweets and generate all required files', async () => {
      await processor.saveTweets(mockTweets);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tweets.json'),
        expect.any(String),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('urls.txt'),
        expect.any(String),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('stats.json'),
        expect.any(String),
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('finetuning.jsonl'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should generate correct analytics', () => {
      const analytics = processor.generateAnalytics(mockTweets);

      expect(analytics).toEqual({
        totalTweets: 4,
        directTweets: 2,
        replies: 1,
        retweets: 1,
        engagement: {
          totalLikes: 130,
          totalRetweetCount: 63,
          totalReplies: 0,
          averageLikes: '43.33',
          topTweets: expect.any(Array),
        },
        timeRange: {
          start: '2023-01-01',
          end: '2023-01-03',
        },
        contentTypes: {
          withImages: 0,
          withVideos: 0,
          withLinks: 1,
          textOnly: 3,
        },
      });
    });

    it('should handle empty tweet arrays in analytics', () => {
      const analytics = processor.generateAnalytics([]);

      expect(analytics).toEqual({
        totalTweets: 0,
        directTweets: 0,
        replies: 0,
        retweets: 0,
        engagement: {
          totalLikes: 0,
          totalRetweetCount: 0,
          totalReplies: 0,
          averageLikes: '0.00',
          topTweets: [],
        },
        timeRange: {
          start: 'N/A',
          end: 'N/A',
        },
        contentTypes: {
          withImages: 0,
          withVideos: 0,
          withLinks: 0,
          textOnly: 0,
        },
      });
    });

    it('should generate fine-tuning data', () => {
      const finetuningData = processor.generateFinetuningData(mockTweets);

      expect(finetuningData).toHaveLength(2);
      expect(finetuningData[0]).toEqual({
        text: mockTweets[0].text,
        metadata: {
          id: mockTweets[0].id_str,
          created_at: expect.any(String),
          metrics: {
            likes: mockTweets[0].favorite_count,
            retweets: mockTweets[0].retweet_count,
            replies: 0,
          },
        },
      });
    });

    describe('Top Tweets Processing', () => {
      it('should exclude retweets from top tweets', () => {
        const analytics = processor.generateAnalytics(mockTweets);
        const topTweetIds = analytics.engagement.topTweets.map(t => t.id);

        // The retweet (id: '101112') should not be in top tweets
        expect(topTweetIds).not.toContain('101112');
        // The original tweet (id: '789') should be included
        expect(topTweetIds).toContain('789');
      });

      it('should not have duplicate tweets in top tweets', () => {
        const analytics = processor.generateAnalytics(mockTweets);
        const topTweetIds = analytics.engagement.topTweets.map(t => t.id);
        const uniqueIds = new Set(topTweetIds);

        // Number of top tweets should equal number of unique IDs
        expect(topTweetIds.length).toBe(uniqueIds.size);
      });

      it('should sort top tweets by likes in descending order', () => {
        const analytics = processor.generateAnalytics(mockTweets);
        const likes = analytics.engagement.topTweets.map(t => t.likes);

        // Verify likes are in descending order
        expect(likes).toEqual([...likes].sort((a, b) => b - a));
      });

      it('should limit top tweets to 5 entries', () => {
        const analytics = processor.generateAnalytics(mockTweets);
        expect(analytics.engagement.topTweets.length).toBeLessThanOrEqual(5);
      });
    });
  });
});
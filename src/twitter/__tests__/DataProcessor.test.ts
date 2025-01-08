import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Tweet } from '../../typescript/types';
import { DataProcessor } from '../../typescript/DataProcessor';
import { promises as fs } from 'fs';
import path from 'path';

vi.mock('fs/promises');
vi.mock('path');

describe('DataProcessor', () => {
  let processor: DataProcessor;
  const mockUsername = 'testuser';
  const mockBaseDir = 'pipeline';
  const mockDate = new Date('2024-01-08');

  beforeEach(() => {
    vi.resetAllMocks();
    vi.setSystemTime(mockDate);
    processor = new DataProcessor(mockBaseDir, mockUsername);
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
      const processor = new DataProcessor(mockBaseDir, 'TestUser');
      const paths = processor.getPaths();

      Object.values(paths).flat().forEach(p => {
        expect(p).toContain('testuser');
      });
    });
  });

  describe('Token Management', () => {
    it('should save and retrieve next token', async () => {
      const mockToken = 'test_token_123';

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
        id_str: '1',
        created_at: '2024-01-08T12:00:00Z',
        text: 'Test tweet 1',
        user: {
          id_str: '123',
          screen_name: 'testuser',
          name: 'Test User',
          description: 'Test description',
          followers_count: 100,
          friends_count: 50,
          verified: false
        },
        retweet_count: 5,
        favorite_count: 10,
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: []
        },
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null
      }
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
    });

    it('should generate correct analytics', () => {
      const analytics = processor.generateAnalytics(mockTweets);

      expect(analytics).toEqual({
        totalTweets: 1,
        directTweets: 1,
        replies: 0,
        retweets: 0,
        engagement: {
          totalLikes: 10,
          totalRetweetCount: 5,
          totalReplies: 0,
          averageLikes: '10.00',
          topTweets: expect.any(Array)
        },
        timeRange: {
          start: '2024-01-08',
          end: '2024-01-08'
        },
        contentTypes: {
          withImages: 0,
          withVideos: 0,
          withLinks: 0,
          textOnly: 1
        }
      });
    });

    it('should handle empty tweet arrays in analytics', () => {
      const analytics = processor.generateAnalytics([]);

      expect(analytics.totalTweets).toBe(0);
      expect(analytics.engagement.averageLikes).toBe('0.00');
      expect(analytics.timeRange.start).toBe('N/A');
    });

    it('should generate fine-tuning data', () => {
      const finetuningData = processor.generateFinetuningData(mockTweets);

      expect(finetuningData).toEqual([
        expect.objectContaining({
          text: expect.any(String),
          metadata: expect.any(Object)
        })
      ]);
    });
  });
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressReporter } from '../typescript/ProgressReporter';
import type { Tweet } from '../typescript/types';

describe('ProgressReporter', () => {
  let reporter: ProgressReporter;
  let mockTweets: Tweet[];

  beforeEach(() => {
    reporter = new ProgressReporter();
    mockTweets = [
      {
        id_str: '1',
        text: 'Test tweet 1',
        created_at: '2025-01-08T12:00:00.000Z',
        favorite_count: 100,
        retweet_count: 50,
        in_reply_to_status_id_str: null,
        in_reply_to_user_id_str: null,
        quoted_status_id_str: null,
        retweeted_status_id_str: null,
        user: {
          id_str: 'user1',
          screen_name: 'testuser',
          name: 'Test User',
          description: '',
          followers_count: 1000,
          friends_count: 500,
          verified: false
        },
        entities: {
          hashtags: [],
          urls: [],
          user_mentions: []
        }
      }
    ];
  });

  describe('Initial Tweet Count', () => {
    it('should display total available tweets', () => {
      const output = reporter.displayInitialCount('pmarca', 11197);
      expect(output).toContain('Found 11,197 total tweets for @pmarca');
    });
  });

  describe('Progress Updates', () => {
    it('should show progress percentage', () => {
      const output = reporter.updateProgress(100, 11197);
      expect(output).toContain('Progress: 100 unique tweets (0.9%)');
    });

    it('should handle zero total tweets', () => {
      const output = reporter.updateProgress(0, 0);
      expect(output).toContain('Progress: 0 unique tweets (0.0%)');
    });
  });

  describe('Content Type Summary', () => {
    it('should display content type breakdown', () => {
      const stats = {
        textOnly: 79,
        withImages: 16,
        withVideos: 1,
        withLinks: 4
      };
      const output = reporter.displayContentTypeSummary(stats);
      expect(output).toContain('Content Type Breakdown:');
      expect(output).toContain('Text Only: 79');
      expect(output).toContain('With Images: 16');
      expect(output).toContain('With Videos: 1');
      expect(output).toContain('With Links: 4');
    });
  });

  describe('Engagement Summary', () => {
    it('should display engagement statistics', () => {
      const stats = {
        totalLikes: 139428,
        totalRetweets: 10863,
        totalReplies: 9572,
        averageLikes: 1394.28
      };
      const output = reporter.displayEngagementSummary(stats);
      expect(output).toContain('Engagement Statistics:');
      expect(output).toContain('Total Likes: 139,428');
      expect(output).toContain('Total Retweets: 10,863');
      expect(output).toContain('Total Replies: 9,572');
      expect(output).toContain('Average Likes: 1,394.28');
    });
  });

  describe('Collection Results', () => {
    it('should display detailed collection results table', () => {
      const results = {
        totalTweets: 100,
        originalTweets: 100,
        replies: 0,
        retweets: 0,
        dateRange: { start: '2024-12-22', end: '2025-01-08' },
        runtime: 14.8,
        collectionRate: 405.4,
        successRate: Infinity,
        rateLimitHits: 0,
        fallbackCollections: 0,
        storageLocation: 'pipeline/pmarca/2025-01-08'
      };
      const output = reporter.displayCollectionResults(results);
      expect(output).toContain('Collection Results:');
      expect(output).toContain('Total Tweets: 100');
      expect(output).toContain('Original Tweets: 100');
      expect(output).toContain('Runtime: 14.8 seconds');
      expect(output).toContain('Collection Rate: 405.4 tweets/minute');
    });
  });
});
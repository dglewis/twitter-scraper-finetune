import { promises as fs } from 'fs';
import path from 'path';
import { format } from 'date-fns';
import type { Tweet } from './types';
import Logger from './Logger';

interface Analytics {
  totalTweets: number;
  directTweets: number;
  replies: number;
  retweets: number;
  engagement: {
    totalLikes: number;
    totalRetweetCount: number;
    totalReplies: number;
    averageLikes: string;
    topTweets: Array<{
      id: string;
      text: string;
      likes: number;
      retweetCount: number;
      url: string;
    }>;
  };
  timeRange: {
    start: string;
    end: string;
  };
  contentTypes: {
    withImages: number;
    withVideos: number;
    withLinks: number;
    textOnly: number;
  };
}

interface FinetuningData {
  text: string;
  metadata: {
    id: string;
    created_at: string;
    metrics: {
      likes: number;
      retweets: number;
      replies: number;
    };
  };
}

export class DataProcessor {
  private readonly baseDir: string;

  constructor(baseDir: string, username: string) {
    this.baseDir = path.join(
      baseDir,
      username.toLowerCase(),
      format(new Date(), 'yyyy-MM-dd')
    );
    this.createDirectories();
  }

  async createDirectories(): Promise<void> {
    const dirs = ['raw', 'processed', 'analytics', 'exports', 'meta'];
    for (const dir of dirs) {
      const fullPath = path.join(this.baseDir, dir);
      try {
        await fs.mkdir(fullPath, { recursive: true });
        Logger.info(`Created directory: ${fullPath}`);
      } catch (error) {
        Logger.warn(`Failed to create directory ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  getPaths() {
    return {
      raw: {
        tweets: path.join(this.baseDir, 'raw', 'tweets.json'),
        urls: path.join(this.baseDir, 'raw', 'urls.txt'),
      },
      processed: {
        finetuning: path.join(this.baseDir, 'processed', 'finetuning.jsonl'),
      },
      analytics: {
        stats: path.join(this.baseDir, 'analytics', 'stats.json'),
      },
      exports: {
        summary: path.join(this.baseDir, 'exports', 'summary.md'),
      },
      meta: {
        nextToken: path.join(this.baseDir, 'meta', 'next_token.txt'),
      },
    };
  }

  async getLastNextToken(): Promise<string | null> {
    try {
      const data = await fs.readFile(this.getPaths().meta.nextToken, 'utf-8');
      const trimmed = data.trim();
      Logger.debug(`Retrieved last next_token: ${trimmed}`);
      return trimmed || null;
    } catch (error) {
      Logger.warn('No next_token found. Starting fresh.');
      return null;
    }
  }

  async saveNextToken(nextToken: string): Promise<void> {
    try {
      await fs.writeFile(this.getPaths().meta.nextToken, nextToken, 'utf-8');
      Logger.debug(`Saved next_token: ${nextToken}`);
    } catch (error) {
      Logger.warn(`Failed to save next_token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async saveTweets(tweets: Tweet[]): Promise<Analytics> {
    const paths = this.getPaths();

    try {
      // Save raw tweets
      await fs.writeFile(
        paths.raw.tweets,
        JSON.stringify(tweets, null, 2),
        'utf-8'
      );
      Logger.success(`Saved tweets to ${paths.raw.tweets}`);

      // Save tweet URLs
      const urls = tweets.map(t => `https://twitter.com/${t.user.screen_name}/status/${t.id_str}`);
      await fs.writeFile(paths.raw.urls, urls.join('\n'), 'utf-8');
      Logger.success(`Saved tweet URLs to ${paths.raw.urls}`);

      // Generate and save analytics
      const analytics = this.generateAnalytics(tweets);
      await fs.writeFile(
        paths.analytics.stats,
        JSON.stringify(analytics, null, 2),
        'utf-8'
      );
      Logger.success(`Saved analytics to ${paths.analytics.stats}`);

      // Generate and save fine-tuning data
      const finetuningData = this.generateFinetuningData(tweets);
      if (finetuningData.length > 0) {
        await fs.writeFile(
          paths.processed.finetuning,
          finetuningData.map(d => JSON.stringify(d)).join('\n'),
          'utf-8'
        );
        Logger.success(`Saved fine-tuning data to ${paths.processed.finetuning}`);
      } else {
        Logger.warn('No fine-tuning data to save.');
      }

      return analytics;
    } catch (error) {
      Logger.error(`Error saving data: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  generateAnalytics(tweets: Tweet[]): Analytics {
    if (tweets.length === 0) {
      return {
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
      };
    }

    const dates = tweets
      .map(t => {
        const timestamp = new Date(t.created_at).getTime();
        return isNaN(timestamp) ? null : timestamp;
      })
      .filter((d): d is number => d !== null)
      .sort();

    return {
      totalTweets: tweets.length,
      directTweets: tweets.filter(t => !t.in_reply_to_status_id_str && !t.retweeted_status_id_str).length,
      replies: tweets.filter(t => t.in_reply_to_status_id_str).length,
      retweets: tweets.filter(t => t.retweeted_status_id_str).length,
      engagement: {
        totalLikes: tweets.reduce((sum, t) => sum + t.favorite_count, 0),
        totalRetweetCount: tweets.reduce((sum, t) => sum + t.retweet_count, 0),
        totalReplies: 0, // Not available in basic Tweet type
        averageLikes: (tweets.reduce((sum, t) => sum + t.favorite_count, 0) / tweets.length).toFixed(2),
        topTweets: tweets
          .sort((a, b) => b.favorite_count - a.favorite_count)
          .slice(0, 5)
          .map(t => ({
            id: t.id_str,
            text: t.text.slice(0, 100),
            likes: t.favorite_count,
            retweetCount: t.retweet_count,
            url: `https://twitter.com/${t.user.screen_name}/status/${t.id_str}`,
          })),
      },
      timeRange: {
        start: dates.length > 0 ? format(dates[0]!, 'yyyy-MM-dd') : 'N/A',
        end: dates.length > 0 ? format(dates[dates.length - 1]!, 'yyyy-MM-dd') : 'N/A',
      },
      contentTypes: {
        withImages: 0, // Media entities not in basic Tweet type
        withVideos: 0, // Media entities not in basic Tweet type
        withLinks: tweets.filter(t => t.entities.urls.length > 0).length,
        textOnly: tweets.filter(t => t.entities.urls.length === 0).length,
      },
    };
  }

  generateFinetuningData(tweets: Tweet[]): FinetuningData[] {
    return tweets
      .filter(t => !t.retweeted_status_id_str) // Exclude retweets
      .map(tweet => ({
        text: tweet.text,
        metadata: {
          id: tweet.id_str,
          created_at: new Date(tweet.created_at).toISOString(),
          metrics: {
            likes: tweet.favorite_count,
            retweets: tweet.retweet_count,
            replies: 0, // Not available in basic Tweet type
          },
        },
      }));
  }
}
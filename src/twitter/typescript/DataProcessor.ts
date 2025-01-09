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

interface TweetEntities {
  hashtags: Array<{ text: string }>;
  urls: Array<{
    url: string;
    expanded_url: string;
    display_url: string;
  }>;
  user_mentions: Array<{
    id_str: string;
    screen_name: string;
    name: string;
  }>;
  media?: Array<{
    type: string;
    media_url: string;
  }>;
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

interface ExtendedTweet extends Tweet {
  entities: TweetEntities;
}

export class DataProcessor {
  private baseDir: string;

  constructor(baseDir: string, username: string) {
    this.baseDir = path.join(baseDir, username, format(new Date(), 'yyyy-MM-dd'));
  }

  public async createDirectories(): Promise<void> {
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

  public getPaths() {
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

  public async getLastNextToken(): Promise<string | null> {
    try {
      const tokenPath = this.getPaths().meta.nextToken;
      const exists = await fs.access(tokenPath).then(() => true).catch(() => false);
      if (exists) {
        const token = await fs.readFile(tokenPath, 'utf-8');
        return token.trim();
      }
    } catch (error) {
      Logger.debug(`Failed to read next token: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }

  public async saveNextToken(token: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.getPaths().meta.nextToken), { recursive: true });
      await fs.writeFile(this.getPaths().meta.nextToken, token, 'utf-8');
    } catch (error) {
      Logger.warn(`Failed to save next token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async saveTweets(tweets: Tweet[]): Promise<Analytics> {
    try {
      const paths = this.getPaths();
      await fs.mkdir(path.dirname(paths.raw.tweets), { recursive: true });

      // Save raw tweets
      Logger.info(`Saving ${tweets.length} tweets to ${paths.raw.tweets}`);
      await fs.writeFile(
        paths.raw.tweets,
        JSON.stringify(tweets, null, 2),
        'utf-8'
      );
      Logger.success(`✅ Saved raw tweets`);

      // Save tweet URLs
      Logger.info(`Saving tweet URLs to ${paths.raw.urls}`);
      const urls = tweets.map(t => `https://twitter.com/${t.user.screen_name}/status/${t.id_str}`);
      await fs.writeFile(paths.raw.urls, urls.join('\n'), 'utf-8');
      Logger.success(`✅ Saved tweet URLs`);

      // Generate and save analytics
      Logger.info(`Generating analytics...`);
      const analytics = this.generateAnalytics(tweets as ExtendedTweet[]);
      await fs.writeFile(
        paths.analytics.stats,
        JSON.stringify(analytics, null, 2),
        'utf-8'
      );
      Logger.success(`✅ Saved analytics`);

      // Generate and save fine-tuning data
      Logger.info(`Generating fine-tuning data...`);
      const finetuningData = this.generateFinetuningData(tweets);
      if (finetuningData.length > 0) {
        await fs.mkdir(path.dirname(paths.processed.finetuning), { recursive: true });
        await fs.writeFile(
          paths.processed.finetuning,
          finetuningData.map(d => JSON.stringify(d)).join('\n'),
          'utf-8'
        );
        Logger.success(`✅ Saved ${finetuningData.length} fine-tuning entries`);
      } else {
        Logger.warn(`⚠️  No fine-tuning data to save`);
      }

      return analytics;
    } catch (error) {
      Logger.error(`Failed to save tweets: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  public generateAnalytics(tweets: ExtendedTweet[]): Analytics {
    if (tweets.length === 0) {
      Logger.warn('⚠️  No tweets to analyze.');
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

    const validTweets = tweets.filter((t) => {
      const timestamp = new Date(t.created_at).getTime();
      return !isNaN(timestamp) && timestamp > 0;
    });

    const invalidTweets = tweets.filter((t) => {
      const timestamp = new Date(t.created_at).getTime();
      return isNaN(timestamp) || timestamp <= 0;
    });

    if (invalidTweets.length > 0) {
      Logger.warn(
        `⚠️  Found ${invalidTweets.length} tweets with invalid or missing dates. They will be excluded from analytics.`
      );
    }

    const validDates = validTweets
      .map((t) => new Date(t.created_at).getTime())
      .sort((a, b) => a - b);

    const tweetsForEngagement = tweets.filter((t) => !t.retweeted_status_id_str);

    return {
      totalTweets: tweets.length,
      directTweets: tweets.filter((t) => !t.in_reply_to_status_id_str && !t.retweeted_status_id_str).length,
      replies: tweets.filter((t) => t.in_reply_to_status_id_str).length,
      retweets: tweets.filter((t) => t.retweeted_status_id_str).length,
      engagement: {
        totalLikes: tweetsForEngagement.reduce(
          (sum, t) => sum + (t.favorite_count || 0),
          0
        ),
        totalRetweetCount: tweetsForEngagement.reduce(
          (sum, t) => sum + (t.retweet_count || 0),
          0
        ),
        totalReplies: tweetsForEngagement.reduce(
          (sum, t) => sum + (t.reply_count || 0),
          0
        ),
        averageLikes: (
          tweetsForEngagement.reduce((sum, t) => sum + (t.favorite_count || 0), 0) /
          tweetsForEngagement.length
        ).toFixed(2),
        topTweets: tweetsForEngagement
          .sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0))
          .slice(0, 5)
          .map((t) => ({
            id: t.id_str,
            text: t.text.slice(0, 100) + (t.text.length > 100 ? '...' : ''),
            likes: t.favorite_count || 0,
            retweetCount: t.retweet_count || 0,
            url: `https://twitter.com/${t.user.screen_name}/status/${t.id_str}`,
          })),
      },
      timeRange: {
        start: validDates.length > 0
          ? format(validDates[0]!, 'yyyy-MM-dd')
          : 'N/A',
        end: validDates.length > 0
          ? format(validDates[validDates.length - 1]!, 'yyyy-MM-dd')
          : 'N/A',
      },
      contentTypes: {
        withImages: tweets.filter((t) => t.entities.media?.some(m => m.type === 'photo')).length,
        withVideos: tweets.filter((t) => t.entities.media?.some(m => m.type === 'video')).length,
        withLinks: tweets.filter((t) => t.entities.urls?.length > 0).length,
        textOnly: tweets.filter(
          (t) =>
            (!t.entities.media || t.entities.media.length === 0) &&
            (!t.entities.urls || t.entities.urls.length === 0)
        ).length,
      },
    };
  }

  public generateFinetuningData(tweets: Tweet[]): FinetuningData[] {
    return tweets
      .filter(t => !t.retweeted_status_id_str && !t.in_reply_to_status_id_str) // Exclude retweets and replies
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
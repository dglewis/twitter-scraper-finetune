import Logger from './Logger';
import { TweetFilter } from './TweetFilter';
import { DataProcessor } from './DataProcessor';
import { TweetProcessor } from './TweetProcessor';
import type { Analytics, Tweet, ProcessedTweet } from './types';
import type { Page } from 'puppeteer';
import type { Scraper } from 'agent-twitter-client';

interface TwitterConfig {
  maxTweets: number;
  maxRetries: number;
  retryDelay: number;
  minDelayBetweenRequests: number;
  maxDelayBetweenRequests: number;
  rateLimitThreshold: number;
}

interface FallbackConfig {
  enabled: boolean;
  sessionDuration: number;
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor: number;
    hasTouch: boolean;
    isLandscape: boolean;
  };
}

interface PipelineConfig {
  twitter: TwitterConfig;
  fallback: FallbackConfig;
}

export class TwitterPipeline {
  private username: string;
  private scraper: any | null = null;
  private cluster: any | null = null;
  private tweetProcessor: TweetProcessor;
  private dataProcessor: DataProcessor;
  private config: PipelineConfig;
  private stats = {
    rateLimitHits: 0,
    fallbackCount: 0,
    fallbackUsed: false,
    uniqueTweets: 0,
    retriesCount: 0,
  };

  constructor(username: string) {
    this.username = username;
    this.tweetProcessor = new TweetProcessor();
    this.dataProcessor = new DataProcessor('pipeline', username);

    // Enhanced configuration with fallback handling
    this.config = {
      twitter: {
        maxTweets: parseInt(process.env.MAX_TWEETS || "50000"),
        maxRetries: parseInt(process.env.MAX_RETRIES || "5"),
        retryDelay: parseInt(process.env.RETRY_DELAY || "5000"),
        minDelayBetweenRequests: parseInt(process.env.MIN_DELAY || "1000"),
        maxDelayBetweenRequests: parseInt(process.env.MAX_DELAY || "3000"),
        rateLimitThreshold: 3, // Number of rate limits before considering fallback
      },
      fallback: {
        enabled: true,
        sessionDuration: 30 * 60 * 1000, // 30 minutes
        viewport: {
          width: 1366,
          height: 768,
          deviceScaleFactor: 1,
          hasTouch: false,
          isLandscape: true,
        },
      },
    };
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(min + Math.random() * (max - min));
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async initializeFallback(): Promise<void> {
    if (!this.config.fallback.enabled) {
      throw new Error('Fallback mode is disabled');
    }

    // Initialize fallback system
    Logger.info('Setting up fallback collection system...');
    // TODO: Implement fallback initialization
  }

  private async setupFallbackPage(page: Page): Promise<void> {
    // Set viewport
    await page.setViewport(this.config.fallback.viewport);

    // TODO: Implement page setup for fallback mode
    Logger.info('Setting up fallback page...');
  }

  async collectTweets(scraper: Scraper): Promise<ProcessedTweet[]> {
    const tweets: ProcessedTweet[] = [];
    let nextToken: string | null = await this.dataProcessor.getLastNextToken();
    let rateLimitRetries = 0;
    let noNewTweetsCount = 0;

    while (tweets.length < this.config.twitter.maxTweets) {
      try {
        await this.randomDelay(
          this.config.twitter.minDelayBetweenRequests,
          this.config.twitter.maxDelayBetweenRequests
        );

        const response = await scraper.getTweets(this.username, nextToken ? parseInt(nextToken) : undefined);
        const responseTweets: Tweet[] = [];
        for await (const tweet of response) {
          const typedTweet = tweet as unknown as Tweet;
          if (TweetFilter.isValid(typedTweet)) {
            responseTweets.push(typedTweet);
          }
        }

        if (responseTweets.length === 0) {
          noNewTweetsCount++;
          if (noNewTweetsCount >= 3) {
            Logger.warn("No new tweets in last 3 requests, stopping collection");
            break;
          }
          continue;
        }

        noNewTweetsCount = 0;
        nextToken = null;

        // Use TweetProcessor instead of inline processing
        const newTweets = responseTweets
          .map(tweet => this.tweetProcessor.processTweet(tweet));

        if (responseTweets.length > 0) {
          const oldest = responseTweets.at(-1);
          const newest = responseTweets.at(0);

          if (oldest && newest) {
            Logger.updateCollectionProgress({
              totalCollected: tweets.length + newTweets.length,
              newInBatch: newTweets.length,
              batchSize: responseTweets.length,
              oldestTweetDate: new Date(oldest.created_at).getTime(),
              newestTweetDate: new Date(newest.created_at).getTime(),
              currentDelay: this.config.twitter.minDelayBetweenRequests,
            });
          }
        }

        if (nextToken) {
          await this.dataProcessor.saveNextToken(nextToken);
        }

        tweets.push(...newTweets);
        rateLimitRetries = 0;

      } catch (error) {
        if (error instanceof Error && error.message.includes('Rate limit')) {
          rateLimitRetries++;
          if (rateLimitRetries >= this.config.twitter.rateLimitThreshold) {
            Logger.warn(`Rate limit threshold reached (${rateLimitRetries}), stopping collection`);
            break;
          }
          await this.randomDelay(
            this.config.twitter.retryDelay,
            this.config.twitter.retryDelay * 2
          );
          continue;
        }
        Logger.error(`Failed to collect tweets: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }

    return tweets;
  }

  async cleanup(): Promise<void> {
    try {
      // Cleanup main scraper
      if (this.scraper) {
        await this.scraper.logout();
        Logger.success('🔒 Logged out of primary system');
      }

      // Cleanup fallback system
      if (this.cluster) {
        await this.cluster.close();
        Logger.success('🔒 Cleaned up fallback system');
      }

      Logger.success('✨ Cleanup complete');
    } catch (error) {
      Logger.warn(`⚠️  Cleanup error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async run(): Promise<void> {
    try {
      const tweets = await this.collectTweets(this.scraper);
      Logger.success(`✅ Collected ${tweets.length} tweets`);
    } catch (error) {
      Logger.error(`Failed to run pipeline: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async collectWithFallback(searchQuery: string): Promise<ProcessedTweet[]> {
    Logger.info("Initializing fallback collection mode...");
    await this.initializeFallback();

    const tweets: ProcessedTweet[] = [];
    const fallbackTask = async ({ page }: { page: Page }) => {
      await this.setupFallbackPage(page);

      try {
        // ... existing fallback collection code ...

        // Use TweetProcessor for fallback tweets too
        const newTweets = await page.evaluate(() => {
          const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
          return Array.from(tweetElements).map(tweet => ({
            id_str: `fallback_${Date.now()}`,
            text: tweet.querySelector('[data-testid="tweetText"]')?.textContent || '',
            created_at: tweet.querySelector('time')?.dateTime || new Date().toISOString(),
            user: {
              id_str: 'fallback_user',
              screen_name: tweet.querySelector('[data-testid="User-Name"] a')?.textContent?.replace('@', '') || '',
              name: tweet.querySelector('[data-testid="User-Name"] span')?.textContent || '',
              description: null,
              followers_count: 0,
              friends_count: 0,
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
          }));
        });

        for (const tweet of newTweets) {
          if (!tweets.some(t => t.text === tweet.text)) {
            tweets.push(this.tweetProcessor.processTweet(tweet));
          }
        }

        // ... rest of fallback collection code ...
      } catch (error) {
        Logger.error(`Fallback collection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    };

    try {
      await this.cluster?.execute(searchQuery, fallbackTask);
      return tweets;
    } catch (error) {
      Logger.error(`Failed to collect tweets using fallback mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    } finally {
      await this.cluster?.close();
    }
  }
}
import Logger from './Logger';
import { TweetFilter } from './TweetFilter';
import { DataProcessor } from './DataProcessor';
import { TweetProcessor } from './TweetProcessor';
import type { Analytics, Tweet, ProcessedTweet } from './types';
import type { Page } from 'puppeteer';
import { Scraper, type Tweet as ScraperTweet } from 'agent-twitter-client';
import path from 'path';
import fs from 'fs/promises';

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

type PartialTwitterConfig = Partial<TwitterConfig>;

export class TwitterPipeline {
  private username: string;
  private scraper: Scraper | null = null;
  private cluster: any | null = null;
  private tweetProcessor: TweetProcessor;
  private dataProcessor: DataProcessor;
  private config: PipelineConfig;
  private cookiePath: string;
  private stats = {
    rateLimitHits: 0,
    fallbackCount: 0,
    fallbackUsed: false,
    uniqueTweets: 0,
    retriesCount: 0,
  };

  constructor(username: string, twitterConfig?: PartialTwitterConfig) {
    this.username = username;
    this.tweetProcessor = new TweetProcessor();
    this.dataProcessor = new DataProcessor('pipeline', username);
    this.cookiePath = path.join(
      process.cwd(),
      'cookies',
      `${process.env.TWITTER_USERNAME}_cookies.json`
    );

    // Enhanced configuration with fallback handling
    this.config = {
      twitter: {
        maxTweets: twitterConfig?.maxTweets ?? parseInt(process.env.MAX_TWEETS || "50000"),
        maxRetries: twitterConfig?.maxRetries ?? parseInt(process.env.MAX_RETRIES || "5"),
        retryDelay: twitterConfig?.retryDelay ?? parseInt(process.env.RETRY_DELAY || "5000"),
        minDelayBetweenRequests: twitterConfig?.minDelayBetweenRequests ?? parseInt(process.env.MIN_DELAY || "1000"),
        maxDelayBetweenRequests: twitterConfig?.maxDelayBetweenRequests ?? parseInt(process.env.MAX_DELAY || "3000"),
        rateLimitThreshold: twitterConfig?.rateLimitThreshold ?? 3, // Number of rate limits before considering fallback
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

    this.scraper = new Scraper();
  }

  private async loadCookies(): Promise<boolean> {
    try {
      const exists = await fs.access(this.cookiePath).then(() => true).catch(() => false);
      if (exists) {
        const cookiesData = await fs.readFile(this.cookiePath, 'utf-8');
        const cookies = JSON.parse(cookiesData);
        await this.scraper?.setCookies(cookies);
        return true;
      }
    } catch (error) {
      Logger.warn(`Failed to load cookies: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  }

  private async saveCookies(): Promise<void> {
    try {
      const cookies = await this.scraper?.getCookies();
      if (cookies) {
        // Create cookies directory if it doesn't exist
        await fs.mkdir(path.dirname(this.cookiePath), { recursive: true });
        await fs.writeFile(this.cookiePath, JSON.stringify(cookies));
        Logger.success('Saved authentication cookies');
      }
    } catch (error) {
      Logger.warn(`Failed to save cookies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async initializeScraper(): Promise<boolean> {
    Logger.startSpinner("Initializing Twitter scraper");
    let retryCount = 0;

    // Try loading cookies first
    if (await this.loadCookies() && this.scraper) {
      try {
        if (await this.scraper.isLoggedIn()) {
          Logger.success("✅ Successfully authenticated with saved cookies");
          Logger.stopSpinner();
          return true;
        }
      } catch (error) {
        Logger.warn("Saved cookies are invalid, attempting fresh login");
      }
    }

    // Verify all required credentials are present
    const username = process.env.TWITTER_USERNAME;
    const password = process.env.TWITTER_PASSWORD;
    const email = process.env.TWITTER_EMAIL;

    if (!username || !password || !email) {
      Logger.error("Missing required credentials. Need username, password, AND email");
      Logger.stopSpinner(false);
      return false;
    }

    // Attempt login with email verification
    while (retryCount < this.config.twitter.maxRetries && this.scraper) {
      try {
        // Add random delay before login attempt
        await this.randomDelay(5000, 10000);

        // Always use email in login attempt
        await this.scraper.login(username, password, email);

        // Verify login success
        const isLoggedIn = await this.scraper.isLoggedIn();
        if (isLoggedIn) {
          await this.saveCookies();
          Logger.success("✅ Successfully authenticated with Twitter");
          Logger.stopSpinner();
          return true;
        } else {
          throw new Error("Login verification failed");
        }

      } catch (error) {
        retryCount++;
        Logger.warn(
          `⚠️  Authentication attempt ${retryCount} failed: ${error instanceof Error ? error.message : String(error)}`
        );

        if (retryCount >= this.config.twitter.maxRetries) {
          Logger.stopSpinner(false);
          return false;
        }

        // Exponential backoff with jitter
        const baseDelay = this.config.twitter.retryDelay * Math.pow(2, retryCount - 1);
        const maxJitter = baseDelay * 0.2; // 20% jitter
        const jitter = Math.floor(Math.random() * maxJitter);
        await this.randomDelay(baseDelay + jitter, baseDelay + jitter + 5000);
      }
    }
    return false;
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

  private convertScraperTweetToTweet(scraperTweet: ScraperTweet): Tweet {
    return {
      id_str: scraperTweet.id || '',
      text: scraperTweet.text || '',
      created_at: scraperTweet.timeParsed?.toISOString() || new Date().toISOString(),
      user: {
        id_str: scraperTweet.userId || '',
        screen_name: scraperTweet.username || '',
        name: scraperTweet.name || '',
        description: null,
        followers_count: 0,
        friends_count: 0,
        verified: false
      },
      retweet_count: scraperTweet.retweets || 0,
      favorite_count: scraperTweet.likes || 0,
      reply_count: scraperTweet.replies || 0,
      entities: {
        hashtags: (scraperTweet.hashtags || []).map(tag => ({ text: tag })),
        urls: (scraperTweet.urls || []).map(url => ({
          url: url,
          expanded_url: url,
          display_url: url
        })),
        user_mentions: []  // The scraper doesn't provide mentions data
      },
      in_reply_to_status_id_str: scraperTweet.inReplyToStatusId || null,
      in_reply_to_user_id_str: null,
      quoted_status_id_str: scraperTweet.quotedStatusId || null,
      retweeted_status_id_str: scraperTweet.retweetedStatusId || null
    };
  }

  async collectTweets(scraper: Scraper): Promise<ProcessedTweet[]> {
    const tweets: ProcessedTweet[] = [];
    let nextToken: string | null = await this.dataProcessor.getLastNextToken();
    let rateLimitRetries = 0;
    let noNewTweetsCount = 0;

    Logger.info(`Starting tweet collection for user: ${this.username}`);
    Logger.info(`Initial next_token: ${nextToken || 'none'}`);

    while (tweets.length < this.config.twitter.maxTweets) {
      try {
        const delay = Math.floor(
          this.config.twitter.minDelayBetweenRequests +
          Math.random() * (this.config.twitter.maxDelayBetweenRequests - this.config.twitter.minDelayBetweenRequests)
        );
        Logger.info(`Waiting ${delay}ms before next request...`);
        await this.randomDelay(
          this.config.twitter.minDelayBetweenRequests,
          this.config.twitter.maxDelayBetweenRequests
        );

        Logger.info('Fetching tweets');
        const response = await scraper.getTweets(this.username, nextToken ? parseInt(nextToken) : undefined);
        Logger.info('Got response from Twitter API');

        Logger.info('Processing tweet response...');
        const responseTweets: Tweet[] = [];

        // Handle the async iterator response
        for await (const scraperTweet of response) {
          if (tweets.length >= this.config.twitter.maxTweets) {
            Logger.info('Reached max tweets limit, stopping collection');
            break;
          }

          if (scraperTweet) {
            const tweet = this.convertScraperTweetToTweet(scraperTweet);
            if (TweetFilter.isValid(tweet)) {
              responseTweets.push(tweet);
            } else {
              Logger.debug(`Tweet ${tweet.id_str} filtered out`);
            }
          }
        }

        Logger.info(`Processed ${responseTweets.length} tweets from response`);

        if (responseTweets.length === 0) {
          noNewTweetsCount++;
          Logger.warn(`No new tweets in response (attempt ${noNewTweetsCount}/3)`);
          if (noNewTweetsCount >= 3) {
            Logger.warn("No new tweets in last 3 requests, stopping collection");
            break;
          }
          continue;
        }

        noNewTweetsCount = 0;

        // Process tweets through TweetProcessor
        const newTweets = responseTweets
          .map(tweet => this.tweetProcessor.processTweet(tweet))
          .filter((tweet): tweet is ProcessedTweet => tweet !== null);

        if (responseTweets.length > 0) {
          const oldest = responseTweets[responseTweets.length - 1];
          const newest = responseTweets[0];

          if (oldest && newest) {
            const oldestDate = new Date(oldest.created_at);
            const newestDate = new Date(newest.created_at);
            Logger.info(`Tweet date range: ${oldestDate.toISOString()} to ${newestDate.toISOString()}`);

            Logger.updateCollectionProgress({
              totalCollected: tweets.length + newTweets.length,
              newInBatch: newTweets.length,
              batchSize: responseTweets.length,
              oldestTweetDate: oldestDate.getTime(),
              newestTweetDate: newestDate.getTime(),
              currentDelay: this.config.twitter.minDelayBetweenRequests,
            });
          }
        }

        const toAdd = newTweets.slice(0, this.config.twitter.maxTweets - tweets.length);
        Logger.info(`Adding ${toAdd.length} new tweets to collection`);
        tweets.push(...toAdd);

        if (tweets.length >= this.config.twitter.maxTweets) {
          Logger.info('Reached max tweets limit, stopping collection');
          break;
        }
        rateLimitRetries = 0;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Rate limit')) {
          rateLimitRetries++;
          Logger.warn(`Rate limit hit (attempt ${rateLimitRetries}/${this.config.twitter.rateLimitThreshold})`);
          if (rateLimitRetries >= this.config.twitter.rateLimitThreshold) {
            Logger.warn(`Rate limit threshold reached (${rateLimitRetries}), stopping collection`);
            break;
          }
          const retryDelay = this.config.twitter.retryDelay * 2;
          Logger.info(`Waiting ${retryDelay}ms before retry...`);
          await this.randomDelay(
            this.config.twitter.retryDelay,
            this.config.twitter.retryDelay * 2
          );
          continue;
        }
        Logger.error(`Failed to collect tweets: ${errorMessage}\nFull error: ${JSON.stringify(error, null, 2)}`);
        break;
      }
    }

    Logger.info(`Collection complete. Total tweets collected: ${tweets.length}`);
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
      // Initialize scraper before collecting tweets
      if (!await this.initializeScraper()) {
        throw new Error('Failed to initialize Twitter scraper');
      }

      const processedTweets = await this.collectTweets(this.scraper!);
      Logger.success(`✅ Collected ${processedTweets.length} tweets`);

      // Save the collected tweets
      if (processedTweets.length > 0) {
        // Convert ProcessedTweet back to Tweet
        const tweets = processedTweets.map(pt => ({
          id_str: pt.id,
          text: pt.text,
          created_at: pt.created_at,
          user: {
            id_str: pt.author.id,
            screen_name: pt.author.username,
            name: pt.author.name,
            description: null,
            followers_count: pt.author.followers_count,
            friends_count: pt.author.following_count,
            verified: pt.author.is_verified
          },
          retweet_count: pt.metrics.retweets,
          favorite_count: pt.metrics.likes,
          reply_count: pt.metrics.replies,
          entities: {
            hashtags: pt.entities.hashtags.map(tag => ({ text: tag })),
            urls: pt.entities.urls.map(url => ({
              url: url.short_url,
              expanded_url: url.expanded_url,
              display_url: url.display_url
            })),
            user_mentions: pt.entities.mentions.map(mention => ({
              id_str: mention.id,
              screen_name: mention.username,
              name: mention.name
            }))
          },
          in_reply_to_status_id_str: pt.referenced_tweets.replied_to?.tweet_id || null,
          in_reply_to_user_id_str: pt.referenced_tweets.replied_to?.author_id || null,
          quoted_status_id_str: pt.referenced_tweets.quoted,
          retweeted_status_id_str: pt.referenced_tweets.retweeted
        }));
        const analytics = await this.dataProcessor.saveTweets(tweets);
        Logger.success(`✅ Saved ${tweets.length} tweets with analytics`);
      } else {
        Logger.warn('No tweets collected to save');
      }
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
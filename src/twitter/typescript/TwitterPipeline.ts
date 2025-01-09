import Logger from './Logger';
import { TweetFilter } from './TweetFilter';
import { DataProcessor } from './DataProcessor';
import { TweetProcessor } from './TweetProcessor';
import { ProgressReporter } from './ProgressReporter';
import type { Analytics, Tweet, ProcessedTweet } from './types';
import type { Page } from 'puppeteer';
import { Scraper, type Profile, type Tweet as ScraperTweet, SearchMode } from 'agent-twitter-client';
import path from 'path';
import fs from 'fs/promises';
import { format } from 'date-fns';

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

interface UserInfo {
  tweets?: number;
}

// Define the scraper tweet interface based on what we're actually getting
interface ScrapedTweet {
  id: string;
  text: string;
  timestamp?: number;
  timeParsed?: Date;
  username?: string;
  name?: string;
  isReply?: boolean;
  isRetweet?: boolean;
  likes?: number;
  retweets?: number;
  replies?: number;
  photos?: string[];
  videos?: string[];
  urls?: string[];
  permanentUrl?: string;
  quotedStatusId?: string;
  inReplyToStatusId?: string;
  hashtags?: string[];
}

export class TwitterPipeline {
  private username: string;
  private scraper: Scraper | null = null;
  private cluster: any | null = null;
  private tweetProcessor: TweetProcessor;
  private dataProcessor: DataProcessor;
  private progressReporter: ProgressReporter;
  private config: PipelineConfig;
  private cookiePath: string;
  private stats = {
    rateLimitHits: 0,
    fallbackCount: 0,
    fallbackUsed: false,
    uniqueTweets: 0,
    retriesCount: 0,
    totalAvailableTweets: 0,
    startTime: Date.now(),
  };

  constructor(username: string, twitterConfig?: PartialTwitterConfig) {
    this.username = username;
    this.tweetProcessor = new TweetProcessor();
    this.dataProcessor = new DataProcessor('pipeline', username);
    this.progressReporter = new ProgressReporter();
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
        rateLimitThreshold: twitterConfig?.rateLimitThreshold ?? 3,
      },
      fallback: {
        enabled: true,
        sessionDuration: 30 * 60 * 1000,
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
    const tweets = new Map<string, Tweet>();
    let previousCount = 0;
    let stagnantBatches = 0;
    const MAX_STAGNANT_BATCHES = 2;

    // Get total tweet count from profile
    try {
      const profile = await scraper.getProfile(this.username) as Profile & { tweetsCount: number };
      this.stats.totalAvailableTweets = profile.tweetsCount;
      Logger.info(this.progressReporter.displayInitialCount(this.username, this.stats.totalAvailableTweets));
    } catch (error) {
      Logger.debug(`Failed to get tweet count: ${error instanceof Error ? error.message : String(error)}`);
    }

    Logger.info(`Starting tweet collection for user: ${this.username}`);

    // Try main collection first
    try {
      const searchResults = scraper.searchTweets(
        `from:${this.username}`,
        this.config.twitter.maxTweets,
        SearchMode.Latest
      );

      for await (const scrapedTweet of searchResults) {
        const tweet = scrapedTweet as unknown as ScrapedTweet;
        if (tweet && tweet.id) {
          let timestamp = tweet.timestamp;
          if (!timestamp) {
            timestamp = tweet.timeParsed?.getTime() || Date.now();
          }
          if (timestamp < 1e12) timestamp *= 1000;

          const rawTweet: Tweet = {
            id_str: tweet.id,
            created_at: new Date(timestamp).toISOString(),
            text: tweet.text || '',
            user: {
              id_str: tweet.id, // We don't have author ID, use tweet ID as fallback
              screen_name: tweet.username || this.username,
              name: tweet.name || tweet.username || this.username,
              description: null,
              followers_count: 0,
              friends_count: 0,
              verified: false
            },
            retweet_count: tweet.retweets || 0,
            favorite_count: tweet.likes || 0,
            reply_count: tweet.replies || 0,
            quote_count: 0,
            entities: {
              hashtags: (tweet.hashtags || []).map(tag => ({ text: tag })),
              urls: (tweet.urls || []).map(url => ({
                url: url,
                expanded_url: url,
                display_url: url
              })),
              user_mentions: []
            },
            in_reply_to_status_id_str: tweet.inReplyToStatusId || null,
            in_reply_to_user_id_str: null,
            quoted_status_id_str: tweet.quotedStatusId || null,
            retweeted_status_id_str: null
          };

          const processedTweet = this.tweetProcessor.processTweet(rawTweet);
          if (processedTweet && TweetFilter.isValid(rawTweet)) {
            tweets.set(tweet.id, rawTweet);

            if (tweets.size % 100 === 0) {
              const completion = ((tweets.size / this.stats.totalAvailableTweets) * 100).toFixed(1);
              Logger.info(`📊 Progress: ${tweets.size.toLocaleString()} unique tweets (${completion}%)`);

              if (tweets.size === previousCount) {
                stagnantBatches++;
                if (stagnantBatches >= MAX_STAGNANT_BATCHES) {
                  Logger.info("📝 Collection rate has stagnated, checking fallback...");
                  break;
                }
              } else {
                stagnantBatches = 0;
              }
              previousCount = tweets.size;
            }
          }
        }

        if (tweets.size >= this.config.twitter.maxTweets) {
          Logger.info('Reached max tweets limit, stopping collection');
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("rate limit")) {
        this.stats.rateLimitHits++;
        if (this.stats.rateLimitHits >= this.config.twitter.rateLimitThreshold) {
          Logger.info("Switching to fallback collection...");
          const fallbackTweets = await this.collectWithFallback(`from:${this.username}`);

          for (const tweet of fallbackTweets) {
            if (tweet.id_str) {
              tweets.set(tweet.id_str, tweet);
              this.stats.fallbackUsed = true;
            }
          }
        }
      }
      Logger.warn(`⚠️  Search error: ${errorMessage}`);
    }

    // Use fallback if we haven't collected enough tweets
    if (tweets.size < this.stats.totalAvailableTweets * 0.8 && this.config.fallback.enabled) {
      Logger.info("\n🔍 Collecting additional tweets via fallback...");

      try {
        const fallbackTweets = await this.collectWithFallback(`from:${this.username}`);
        let newTweetsCount = 0;

        for (const tweet of fallbackTweets) {
          if (tweet.id_str) {
            tweets.set(tweet.id_str, tweet);
            newTweetsCount++;
            this.stats.fallbackUsed = true;
          }
        }

        if (newTweetsCount > 0) {
          Logger.info(`Found ${newTweetsCount} additional tweets via fallback`);
        }
      } catch (error) {
        Logger.warn(`⚠️  Fallback collection error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    Logger.success(
      `\n🎉 Collection complete! ${tweets.size.toLocaleString()} unique tweets collected${
        this.stats.fallbackUsed ? ` (including fallback tweets)` : ""
      }`
    );

    // Process all tweets at the end
    return Array.from(tweets.values()).map(tweet => this.tweetProcessor.processTweet(tweet)).filter((tweet): tweet is ProcessedTweet => tweet !== null);
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

  async collectWithFallback(searchQuery: string): Promise<Tweet[]> {
    Logger.info("Initializing fallback collection mode...");
    await this.initializeFallback();

    const tweets: Tweet[] = [];
    const fallbackTask = async ({ page }: { page: Page }) => {
      await this.setupFallbackPage(page);

      try {
        // Use TweetProcessor for fallback tweets too
        const newTweets = await page.evaluate(() => {
          const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
          return Array.from(tweetElements).map(tweet => ({
            id_str: `fallback_${Date.now()}`,
            text: tweet.querySelector('[data-testid="tweetText"]')?.textContent || '',
            created_at: tweet.querySelector('time')?.dateTime || new Date().toISOString(),
            user: {
              id_str: 'fallback',
              screen_name: 'fallback',
              name: 'fallback',
              description: null,
              followers_count: 0,
              friends_count: 0,
              verified: false
            },
            retweet_count: 0,
            favorite_count: 0,
            reply_count: 0,
            quote_count: 0,
            entities: {
              hashtags: [],
              urls: [],
              user_mentions: []
            },
            in_reply_to_status_id_str: null,
            in_reply_to_user_id_str: null,
            quoted_status_id_str: null,
            retweeted_status_id_str: null
          }));
        });

        for (const tweet of newTweets) {
          if (!tweets.some(t => t.text === tweet.text)) {
            tweets.push(tweet);
          }
        }
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

  private processTweetData(tweet: any): Tweet | null {
    try {
      if (!tweet || !tweet.id) return null;

      let timestamp = tweet.timestamp;
      if (!timestamp) {
        timestamp = new Date(tweet.created_at).getTime();
      }

      if (!timestamp) return null;

      if (timestamp < 1e12) timestamp *= 1000;

      if (isNaN(timestamp) || timestamp <= 0) {
        Logger.warn(`⚠️  Invalid timestamp for tweet ${tweet.id}`);
        return null;
      }

      return {
        id_str: tweet.id,
        text: tweet.text,
        created_at: new Date(timestamp).toISOString(),
        user: {
          id_str: tweet.user?.id_str || 'unknown',
          screen_name: tweet.user?.screen_name || this.username,
          name: tweet.user?.name || this.username,
          description: tweet.user?.description || null,
          followers_count: tweet.user?.followers_count || 0,
          friends_count: tweet.user?.friends_count || 0,
          verified: tweet.user?.verified || false
        },
        retweet_count: tweet.retweet_count || 0,
        favorite_count: tweet.favorite_count || 0,
        reply_count: tweet.reply_count || 0,
        entities: {
          hashtags: tweet.entities?.hashtags || [],
          urls: tweet.entities?.urls || [],
          user_mentions: tweet.entities?.user_mentions || []
        },
        in_reply_to_status_id_str: tweet.in_reply_to_status_id_str || null,
        in_reply_to_user_id_str: tweet.in_reply_to_user_id_str || null,
        quoted_status_id_str: tweet.quoted_status_id_str || null,
        retweeted_status_id_str: tweet.retweeted_status_id_str || null
      };
    } catch (error) {
      Logger.warn(`⚠️  Error processing tweet ${tweet?.id}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
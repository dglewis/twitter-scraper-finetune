import type { Ora } from 'ora';
import { z } from 'zod';

// Twitter API Response Types
export const TweetSchema = z.object({
  id_str: z.string(),
  created_at: z.string(),
  text: z.string(),
  full_text: z.string().optional(),
  user: z.object({
    id_str: z.string(),
    screen_name: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    followers_count: z.number(),
    friends_count: z.number(),
    verified: z.boolean(),
  }),
  retweet_count: z.number(),
  favorite_count: z.number(),
  reply_count: z.number().optional(),
  quote_count: z.number().optional(),
  in_reply_to_status_id_str: z.string().nullable(),
  in_reply_to_user_id_str: z.string().nullable(),
  quoted_status_id_str: z.string().nullable(),
  retweeted_status_id_str: z.string().nullable(),
  entities: z.object({
    hashtags: z.array(z.object({
      text: z.string(),
    })),
    urls: z.array(z.object({
      url: z.string(),
      expanded_url: z.string(),
      display_url: z.string(),
    })),
    user_mentions: z.array(z.object({
      id_str: z.string(),
      screen_name: z.string(),
      name: z.string(),
    })),
  }),
});

export const UserSchema = z.object({
  id_str: z.string(),
  screen_name: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  followers_count: z.number(),
  friends_count: z.number(),
  statuses_count: z.number(),
  favourites_count: z.number(),
  created_at: z.string(),
  verified: z.boolean(),
  protected: z.boolean(),
  location: z.string().nullable(),
  url: z.string().nullable(),
  profile_image_url_https: z.string(),
});

export type Tweet = z.infer<typeof TweetSchema>;
export type User = z.infer<typeof UserSchema>;

export interface CollectionStats {
  oldestTweet: number | null;
  newestTweet: number | null;
  rateLimitHits: number;
  resets: number;
  batchesWithNewTweets: number;
  totalBatches: number;
  startTime: number;
  tweetsPerMinute: number;
  currentDelay: number;
  lastResetTime: number | null;
}

export interface CollectionProgress {
  totalCollected: number;
  newInBatch?: number;
  batchSize?: number;
  oldestTweetDate?: number | null;
  newestTweetDate?: number | null;
  currentDelay?: number;
  isReset?: boolean;
}

export interface CollectionStatus {
  totalCollected: number;
  newInBatch: number;
  batchSize: number;
  isReset: boolean;
}

export interface Logger {
  startSpinner(text: string): void;
  stopSpinner(success?: boolean): void;
  info(msg: string): void;
  success(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
  updateCollectionProgress(progress: CollectionProgress): void;
  displayCollectionStatus(status: CollectionStatus): void;
  recordRateLimit(): void;
  stats(title: string, data: Record<string, unknown>): void;
  reset(): void;
}

export interface LoggerConstructor {
  new(): never;
  startSpinner(text: string): void;
  stopSpinner(success?: boolean): void;
  info(msg: string): void;
  success(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
  updateCollectionProgress(progress: CollectionProgress): void;
  displayCollectionStatus(status: CollectionStatus): void;
  recordRateLimit(): void;
  stats(title: string, data: Record<string, unknown>): void;
  reset(): void;
}

// Processed Tweet Types
export interface ProcessedTweet {
  id: string;
  text: string;
  created_at: string;
  author: {
    id: string;
    username: string;
    name: string;
    followers_count: number;
    following_count: number;
    is_verified: boolean;
  };
  metrics: {
    retweets: number;
    likes: number;
    replies: number;
    quotes: number;
  };
  entities: {
    hashtags: string[];
    urls: {
      short_url: string;
      expanded_url: string;
      display_url: string;
    }[];
    mentions: {
      id: string;
      username: string;
      name: string;
    }[];
  };
  referenced_tweets: {
    replied_to: {
      tweet_id: string;
      author_id: string;
    } | null;
    quoted: string | null;
    retweeted: string | null;
  };
}
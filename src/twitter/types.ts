import type { Ora } from 'ora';

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
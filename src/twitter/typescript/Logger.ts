import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import Table from 'cli-table3';
import { format } from 'date-fns';
import type { Logger, LoggerConstructor, CollectionStats, CollectionProgress, CollectionStatus } from './types';

class LoggerImpl implements Logger {
  private constructor() {
    throw new Error('Logger is a static class and cannot be instantiated');
  }

  static spinner: Ora | null = null;
  static progressBar: any | null = null;
  static lastUpdate: number = Date.now();
  static collectionStats: CollectionStats = {
    oldestTweet: null,
    newestTweet: null,
    rateLimitHits: 0,
    resets: 0,
    batchesWithNewTweets: 0,
    totalBatches: 0,
    startTime: Date.now(),
    tweetsPerMinute: 0,
    currentDelay: 0,
    lastResetTime: null
  };

  static isDebugEnabled = process.env.DEBUG === 'true';

  startSpinner(text: string): void {
    LoggerImpl.spinner = ora(text).start();
  }

  stopSpinner(success = true): void {
    if (LoggerImpl.spinner) {
      success ? LoggerImpl.spinner.succeed() : LoggerImpl.spinner.fail();
      LoggerImpl.spinner = null;
    }
  }

  info(msg: string): void {
    console.log(chalk.blue(`ℹ️  ${msg}`));
  }

  success(msg: string): void {
    console.log(chalk.green(`✅ ${msg}`));
  }

  warn(msg: string): void {
    console.log(chalk.yellow(`⚠️  ${msg}`));
  }

  error(msg: string): void {
    console.log(chalk.red(`❌ ${msg}`));
  }

  debug(msg: string): void {
    if (LoggerImpl.isDebugEnabled) {
      console.log(chalk.gray(`🔍 Debug: ${msg}`));
    }
  }

  updateCollectionProgress({
    totalCollected,
    newInBatch = 0,
    batchSize = 0,
    oldestTweetDate = null,
    newestTweetDate = null,
    currentDelay = 0,
    isReset = false
  }: CollectionProgress): void {
    const now = Date.now();

    // Update stats
    LoggerImpl.collectionStats.totalBatches++;
    if (newInBatch > 0) LoggerImpl.collectionStats.batchesWithNewTweets++;
    if (isReset) LoggerImpl.collectionStats.resets++;
    LoggerImpl.collectionStats.currentDelay = currentDelay;

    // Update date range
    if (oldestTweetDate) {
      LoggerImpl.collectionStats.oldestTweet = !LoggerImpl.collectionStats.oldestTweet ?
        oldestTweetDate :
        Math.min(LoggerImpl.collectionStats.oldestTweet, oldestTweetDate);
    }
    if (newestTweetDate) {
      LoggerImpl.collectionStats.newestTweet = !LoggerImpl.collectionStats.newestTweet ?
        newestTweetDate :
        Math.max(LoggerImpl.collectionStats.newestTweet, newestTweetDate);
    }

    // Calculate efficiency metrics
    const runningTime = (now - LoggerImpl.collectionStats.startTime) / 1000 / 60; // minutes
    LoggerImpl.collectionStats.tweetsPerMinute = Number((totalCollected / runningTime).toFixed(1));

    // Only update display every second to avoid spam
    if (now - LoggerImpl.lastUpdate > 1000) {
      this.displayCollectionStatus({
        totalCollected,
        newInBatch,
        batchSize,
        isReset
      });
      LoggerImpl.lastUpdate = now;
    }
  }

  displayCollectionStatus({ totalCollected, newInBatch, batchSize, isReset }: CollectionStatus): void {
    console.clear(); // Clear console for clean display

    // Display collection header
    console.log(chalk.bold.blue('\n🐦 Twitter Collection Status\n'));

    // Display current activity
    if (isReset) {
      console.log(chalk.yellow('↩️  Resetting collection position...\n'));
    }

    // Create status table
    const table = new Table({
      head: [chalk.white('Metric'), chalk.white('Value')],
      colWidths: [25, 50]
    });

    // Add current status
    table.push(
      ['Total Tweets Collected', chalk.green(totalCollected.toLocaleString())],
      ['Collection Rate', `${chalk.cyan(LoggerImpl.collectionStats.tweetsPerMinute)} tweets/minute`],
      ['Current Delay', `${chalk.yellow(LoggerImpl.collectionStats.currentDelay)}ms`],
      ['Batch Efficiency', `${chalk.cyan((LoggerImpl.collectionStats.batchesWithNewTweets / LoggerImpl.collectionStats.totalBatches * 100).toFixed(1))}%`],
      ['Position Resets', chalk.yellow(LoggerImpl.collectionStats.resets)],
      ['Rate Limit Hits', chalk.red(LoggerImpl.collectionStats.rateLimitHits)]
    );

    // Add date range if we have it
    if (LoggerImpl.collectionStats.oldestTweet) {
      const dateRange = `${format(LoggerImpl.collectionStats.oldestTweet, 'yyyy-MM-dd')} to ${format(LoggerImpl.collectionStats.newestTweet!, 'yyyy-MM-dd')}`;
      table.push(['Date Range', chalk.cyan(dateRange)]);
    }

    // Add latest batch info
    table.push(
      ['Latest Batch', `${chalk.green(newInBatch)} new / ${chalk.blue(batchSize)} total`]
    );

    console.log(table.toString());

    // Add running time
    const runningTime = Math.floor((Date.now() - LoggerImpl.collectionStats.startTime) / 1000);
    console.log(chalk.dim(`\nRunning for ${Math.floor(runningTime / 60)}m ${runningTime % 60}s`));
  }

  recordRateLimit(): void {
    LoggerImpl.collectionStats.rateLimitHits++;
    LoggerImpl.collectionStats.lastResetTime = Date.now();
  }

  stats(title: string, data: Record<string, unknown>): void {
    console.log(chalk.cyan(`\n📊 ${title}:`));
    const table = new Table({
      head: [chalk.white('Parameter'), chalk.white('Value')],
      colWidths: [25, 60],
    });
    Object.entries(data).forEach(([key, value]) => {
      table.push([chalk.white(key), value as string]);
    });
    console.log(table.toString());
  }

  reset(): void {
    LoggerImpl.collectionStats = {
      oldestTweet: null,
      newestTweet: null,
      rateLimitHits: 0,
      resets: 0,
      batchesWithNewTweets: 0,
      totalBatches: 0,
      startTime: Date.now(),
      tweetsPerMinute: 0,
      currentDelay: 0,
      lastResetTime: null
    };
    LoggerImpl.lastUpdate = Date.now();
  }

  // Static methods that delegate to instance methods
  static startSpinner(text: string): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.startSpinner(text);
  }

  static stopSpinner(success = true): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.stopSpinner(success);
  }

  static info(msg: string): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.info(msg);
  }

  static success(msg: string): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.success(msg);
  }

  static warn(msg: string): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.warn(msg);
  }

  static error(msg: string): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.error(msg);
  }

  static debug(msg: string): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.debug(msg);
  }

  static updateCollectionProgress(progress: CollectionProgress): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.updateCollectionProgress(progress);
  }

  static displayCollectionStatus(status: CollectionStatus): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.displayCollectionStatus(status);
  }

  static recordRateLimit(): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.recordRateLimit();
  }

  static stats(title: string, data: Record<string, unknown>): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.stats(title, data);
  }

  static reset(): void {
    const instance = Object.create(LoggerImpl.prototype);
    instance.reset();
  }
}

export default LoggerImpl as unknown as LoggerConstructor;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Logger from '../typescript/Logger';
import type { Logger as LoggerType } from '../typescript/types';

describe('Logger', () => {
  const consoleSpy = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    clear: vi.spyOn(console, 'clear').mockImplementation(() => {})
  };

  let logger: LoggerType;

  beforeEach(() => {
    // Reset the logger before each test
    logger = Object.create(Logger.prototype);
    logger.reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      logger.info('test message');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('test message'));
    });

    it('should log success messages', () => {
      logger.success('test success');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('test success'));
    });

    it('should log warning messages', () => {
      logger.warn('test warning');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('test warning'));
    });

    it('should log error messages', () => {
      logger.error('test error');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('test error'));
    });

    it('should only log debug messages when enabled', () => {
      Logger.isDebugEnabled = false;
      logger.debug('test debug');
      expect(consoleSpy.log).not.toHaveBeenCalled();

      Logger.isDebugEnabled = true;
      logger.debug('test debug');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('test debug'));
    });
  });

  describe('Collection Progress', () => {
    it('should update collection stats', () => {
      const progress = {
        totalCollected: 100,
        newInBatch: 10,
        batchSize: 20,
        oldestTweetDate: Date.now() - 1000000,
        newestTweetDate: Date.now(),
        currentDelay: 1000,
        isReset: false
      };

      logger.updateCollectionProgress(progress);

      expect(Logger.collectionStats.batchesWithNewTweets).toBeGreaterThan(0);
      expect(Logger.collectionStats.totalBatches).toBe(1);
      expect(Logger.collectionStats.currentDelay).toBe(1000);
    });

    it('should handle rate limit recording', () => {
      logger.recordRateLimit();
      expect(Logger.collectionStats.rateLimitHits).toBe(1);
      expect(Logger.collectionStats.lastResetTime).not.toBeNull();
    });

    it('should reset collection stats', () => {
      // First set some values
      Logger.collectionStats.rateLimitHits = 5;
      Logger.collectionStats.resets = 3;
      Logger.collectionStats.batchesWithNewTweets = 10;
      Logger.collectionStats.totalBatches = 20;

      // Then reset
      logger.reset();

      // Verify reset values
      expect(Logger.collectionStats.rateLimitHits).toBe(0);
      expect(Logger.collectionStats.resets).toBe(0);
      expect(Logger.collectionStats.batchesWithNewTweets).toBe(0);
      expect(Logger.collectionStats.totalBatches).toBe(0);
    });
  });

  describe('Display Functions', () => {
    it('should display collection status', () => {
      const status = {
        totalCollected: 100,
        newInBatch: 10,
        batchSize: 20,
        isReset: false
      };

      logger.displayCollectionStatus(status);
      expect(consoleSpy.clear).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should display stats table', () => {
      const data = {
        total: 100,
        new: 10,
        rate: '10/min'
      };

      logger.stats('Test Stats', data);
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe('Spinner Functions', () => {
    it('should start and stop spinner', () => {
      logger.startSpinner('Loading...');
      expect(Logger.spinner).not.toBeNull();

      logger.stopSpinner();
      expect(Logger.spinner).toBeNull();
    });

    it('should handle spinner success and failure', () => {
      logger.startSpinner('Loading...');
      logger.stopSpinner(true);
      expect(Logger.spinner).toBeNull();

      logger.startSpinner('Loading...');
      logger.stopSpinner(false);
      expect(Logger.spinner).toBeNull();
    });
  });
});
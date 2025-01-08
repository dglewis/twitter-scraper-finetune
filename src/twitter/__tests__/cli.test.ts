import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CLI, TwitterPipeline } from '../typescript';
import Logger from '../typescript/Logger';
import { CollectionMode } from '../typescript/types';
import inquirer from 'inquirer';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({})
  }
}));

// Mock Logger
vi.mock('../typescript/Logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    startSpinner: vi.fn(),
    stopSpinner: vi.fn(),
  },
}));

// Mock TwitterPipeline
vi.mock('../typescript/TwitterPipeline', () => ({
  TwitterPipeline: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({}),
    cleanup: vi.fn().mockResolvedValue(undefined),
    randomDelay: vi.fn().mockResolvedValue(undefined),
    collectTweets: vi.fn().mockResolvedValue([]),
    collectWithFallback: vi.fn().mockResolvedValue([])
  } as unknown as TwitterPipeline)),
}));

describe('CLI', () => {
  let originalProcessExit: (code?: number) => never;
  let originalProcessOn: typeof process.on;
  let exitMock: ReturnType<typeof vi.fn>;
  let originalEnv: NodeJS.ProcessEnv;
  let originalArgv: string[];

  beforeEach(() => {
    // Save original process.exit, process.on, process.env, and process.argv
    originalProcessExit = process.exit;
    originalProcessOn = process.on;
    originalEnv = process.env;
    originalArgv = process.argv;

    // Mock process.exit
    exitMock = vi.fn();
    process.exit = exitMock as any;

    // Mock process.on
    process.on = vi.fn() as any;

    // Reset process.env
    process.env = { ...originalEnv };

    // Reset process.argv
    process.argv = ['node', 'script.js'];

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original process.exit, process.on, process.env, and process.argv
    process.exit = originalProcessExit;
    process.on = originalProcessOn;
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  describe('constructor', () => {
    it('should create a CLI instance with default username', () => {
      const cli = new CLI();
      expect(cli).toBeInstanceOf(CLI);
      expect(TwitterPipeline).toHaveBeenCalledWith('degenspartan');
    });

    it('should create a CLI instance with provided username', () => {
      const cli = new CLI('testuser');
      expect(cli).toBeInstanceOf(CLI);
      expect(TwitterPipeline).toHaveBeenCalledWith('testuser');
    });
  });

  describe('setupErrorHandlers', () => {
    it('should set up unhandledRejection handler', () => {
      const cli = new CLI();
      cli.setupErrorHandlers();
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should set up uncaughtException handler', () => {
      const cli = new CLI();
      cli.setupErrorHandlers();
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });

    it('should set up SIGINT handler', () => {
      const cli = new CLI();
      cli.setupErrorHandlers();
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should set up SIGTERM handler', () => {
      const cli = new CLI();
      cli.setupErrorHandlers();
      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });
  });

  describe('cleanup', () => {
    it('should handle cleanup gracefully', async () => {
      const cli = new CLI();
      await cli.cleanup();
      expect(Logger.warn).toHaveBeenCalledWith('\n🛑 Received termination signal. Cleaning up...');
      expect(Logger.success).toHaveBeenCalledWith('🔒 Logged out successfully.');
      expect(exitMock).toHaveBeenCalledWith(0);
    });

    it('should handle cleanup errors', async () => {
      const error = new Error('Cleanup failed');
      const mockPipeline = {
        run: vi.fn(),
        cleanup: vi.fn().mockRejectedValue(error),
        randomDelay: vi.fn().mockResolvedValue(undefined),
        collectTweets: vi.fn().mockResolvedValue([]),
        collectWithFallback: vi.fn().mockResolvedValue([])
      } as unknown as TwitterPipeline;
      vi.mocked(TwitterPipeline).mockImplementationOnce(() => mockPipeline);

      const cli = new CLI();
      await cli.cleanup();
      expect(Logger.error).toHaveBeenCalledWith('❌ Error during cleanup: Cleanup failed');
      expect(exitMock).toHaveBeenCalledWith(0);
    });
  });

  describe('run', () => {
    it('should run the pipeline successfully', async () => {
      const cli = new CLI();
      await cli.run();
      expect(TwitterPipeline).toHaveBeenCalled();
    });

    it('should handle pipeline errors', async () => {
      const error = new Error('Pipeline failed');
      const mockPipeline = {
        run: vi.fn().mockRejectedValue(error),
        cleanup: vi.fn(),
        randomDelay: vi.fn().mockResolvedValue(undefined),
        collectTweets: vi.fn().mockResolvedValue([]),
        collectWithFallback: vi.fn().mockResolvedValue([])
      } as unknown as TwitterPipeline;
      vi.mocked(TwitterPipeline).mockImplementationOnce(() => mockPipeline);

      const cli = new CLI();
      await cli.run();
      expect(exitMock).toHaveBeenCalledWith(1);
    });
  });

  describe('validateEnvironment', () => {
    it('should pass when all required environment variables are present', async () => {
      process.env.TWITTER_USERNAME = 'testuser';
      process.env.TWITTER_PASSWORD = 'testpass';

      const cli = new CLI();
      await cli.validateEnvironment();

      expect(Logger.startSpinner).toHaveBeenCalledWith('Validating environment');
      expect(Logger.stopSpinner).toHaveBeenCalled();
      expect(exitMock).not.toHaveBeenCalled();
    });

    it('should exit when required environment variables are missing', async () => {
      delete process.env.TWITTER_USERNAME;
      delete process.env.TWITTER_PASSWORD;

      const cli = new CLI();
      await cli.validateEnvironment();

      expect(Logger.startSpinner).toHaveBeenCalledWith('Validating environment');
      expect(Logger.stopSpinner).toHaveBeenCalledWith(false);
      expect(Logger.error).toHaveBeenCalledWith('Missing required environment variables:');
      expect(Logger.error).toHaveBeenCalledWith('- TWITTER_USERNAME');
      expect(Logger.error).toHaveBeenCalledWith('- TWITTER_PASSWORD');
      expect(exitMock).toHaveBeenCalledWith(1);
    });

    it('should exit when only some environment variables are missing', async () => {
      process.env.TWITTER_USERNAME = 'testuser';
      delete process.env.TWITTER_PASSWORD;

      const cli = new CLI();
      await cli.validateEnvironment();

      expect(Logger.startSpinner).toHaveBeenCalledWith('Validating environment');
      expect(Logger.stopSpinner).toHaveBeenCalledWith(false);
      expect(Logger.error).toHaveBeenCalledWith('Missing required environment variables:');
      expect(Logger.error).toHaveBeenCalledWith('- TWITTER_PASSWORD');
      expect(exitMock).toHaveBeenCalledWith(1);
    });
  });

  describe('processArgs', () => {
    beforeEach(() => {
      // Set default mock responses for inquirer
      vi.mocked(inquirer.prompt).mockResolvedValue({
        mode: CollectionMode.Timeline,
        username: 'degenspartan'
      });
    });

    it('should handle collection mode from command line', async () => {
      process.argv = ['node', 'script.js', '--mode', 'timeline', '--username', 'testuser'];
      const cli = new CLI();
      await cli.processArgs();
      expect(cli.getCollectionMode()).toBe(CollectionMode.Timeline);
      expect(cli.getUsername()).toBe('testuser');
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should handle username from command line', async () => {
      process.argv = ['node', 'script.js', '--username', 'testuser'];
      const cli = new CLI();
      await cli.processArgs();
      expect(cli.getUsername()).toBe('testuser');
      expect(inquirer.prompt).toHaveBeenCalledOnce(); // Only for mode
    });

    it('should handle limit from command line', async () => {
      process.argv = ['node', 'script.js', '--limit', '100'];
      const cli = new CLI();
      await cli.processArgs();
      expect(cli.getLimit()).toBe(100);
      expect(inquirer.prompt).toHaveBeenCalledTimes(2); // For mode and username
    });

    it('should handle invalid mode gracefully', async () => {
      process.argv = ['node', 'script.js', '--mode', 'invalid'];
      const cli = new CLI();
      await cli.processArgs();
      expect(Logger.error).toHaveBeenCalledWith('Invalid collection mode: invalid');
      expect(exitMock).toHaveBeenCalledWith(1);
    });

    it('should handle invalid limit gracefully', async () => {
      process.argv = ['node', 'script.js', '--limit', 'invalid'];
      const cli = new CLI();
      await cli.processArgs();
      expect(Logger.error).toHaveBeenCalledWith('Invalid limit: invalid');
      expect(exitMock).toHaveBeenCalledWith(1);
    });
  });

  describe('interactive mode', () => {
    it('should prompt for collection mode when not provided', async () => {
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({ mode: CollectionMode.Timeline });
      process.argv = ['node', 'script.js'];
      const cli = new CLI();
      await cli.processArgs();
      expect(inquirer.prompt).toHaveBeenCalledWith([{
        type: 'list',
        name: 'mode',
        message: 'Please select a collection mode:',
        choices: Object.values(CollectionMode)
      }]);
    });

    it('should prompt for username when not provided', async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ mode: CollectionMode.Timeline })
        .mockResolvedValueOnce({ username: 'testuser' });
      process.argv = ['node', 'script.js'];
      const cli = new CLI();
      await cli.processArgs();
      expect(inquirer.prompt).toHaveBeenCalledWith([{
        type: 'input',
        name: 'username',
        message: 'Please enter a username:',
        default: 'degenspartan'
      }]);
    });
  });
});
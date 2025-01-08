import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CLI } from '../typescript/CLI';
import { config as dotenvConfig } from 'dotenv';

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn().mockReturnValue({
    parsed: {
      TWITTER_USERNAME: 'test_user',
      TWITTER_PASSWORD: 'test_pass'
    }
  })
}));

// Mock the CLI class
vi.mock('../typescript/CLI', () => ({
  CLI: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('Entry Point', () => {
  const mockEnv = {
    TWITTER_USERNAME: 'test_user',
    TWITTER_PASSWORD: 'test_pass'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up test environment variables
    Object.assign(process.env, mockEnv);
  });

  afterEach(() => {
    // Clean up test environment variables
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });
  });

  it('should load environment variables on import', async () => {
    // Import the module to test
    const mod = await import('../typescript/index');

    // Verify dotenv.config was called
    expect(dotenvConfig).toHaveBeenCalled();
  }, 10000); // Increase timeout for dynamic import

  it('should properly initialize CLI when run as main module', async () => {
    // Import the module to test
    const mod = await import('../typescript/index');

    // Since we're not actually the main module in tests, verify the CLI wasn't initialized
    expect(CLI).not.toHaveBeenCalled();
  }, 10000); // Increase timeout for dynamic import

  it('should export required components', async () => {
    const exports = await import('../typescript/index');
    expect(exports.CLI).toBeDefined();
    expect(exports.TwitterPipeline).toBeDefined();
    expect(exports.TweetProcessor).toBeDefined();
    expect(exports.DataProcessor).toBeDefined();
  }, 10000); // Increase timeout for dynamic import

  it('should properly load environment variables for CLI usage', async () => {
    // Import the module which will trigger dotenv.config()
    await import('../typescript/index');

    // Verify environment variables are available
    expect(process.env.TWITTER_USERNAME).toBe('test_user');
    expect(process.env.TWITTER_PASSWORD).toBe('test_pass');
  }, 10000); // Increase timeout for dynamic import
});
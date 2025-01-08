import { TwitterPipeline } from '../typescript/TwitterPipeline';
import { CLI } from '../typescript/CLI';
import { CollectionMode } from '../typescript/types';
import inquirer from 'inquirer';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../typescript/TwitterPipeline');
vi.mock('inquirer');

describe('CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = ['node', 'script.js'];
    // Mock environment variables
    process.env.TWITTER_USERNAME = 'test_user';
    process.env.TWITTER_PASSWORD = 'test_pass';
  });

  describe('CLI Arguments', () => {
    it('should use username from command line arguments', async () => {
      process.argv = ['node', 'script.js', '--mode', 'timeline', '--username', 'testuser'];
      const cli = new CLI();
      await cli.initialize();

      expect(cli.getUsername()).toBe('testuser');
      expect(TwitterPipeline).toHaveBeenCalledWith('testuser', expect.any(Object));
    });

    it('should not use default username when one is provided', async () => {
      process.argv = ['node', 'script.js', '--mode', 'timeline', '--username', 'customuser'];
      const cli = new CLI();
      await cli.initialize();

      expect(cli.getUsername()).toBe('customuser');
      expect(TwitterPipeline).not.toHaveBeenCalledWith('degenspartan', expect.any(Object));
    });

    it('should pass limit to TwitterPipeline', async () => {
      process.argv = ['node', 'script.js', '--mode', 'timeline', '--username', 'testuser', '--limit', '5'];
      const cli = new CLI();
      await cli.initialize();

      expect(cli.getLimit()).toBe(5);
      expect(TwitterPipeline).toHaveBeenCalledWith('testuser', { maxTweets: 5 });
    });

    // ... existing tests ...
  });
});
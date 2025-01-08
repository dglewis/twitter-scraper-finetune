import { describe, it, expect } from 'vitest';
import Logger from '../typescript/Logger';
import { TweetFilter } from '../typescript/TweetFilter';
import { TweetProcessor } from '../typescript/TweetProcessor';
import type { Tweet, User } from '../typescript/types';

describe('TypeScript Module Structure', () => {
  it('should import TypeScript modules from typescript directory', () => {
    expect(Logger).toBeDefined();
    expect(TweetFilter).toBeDefined();
    expect(TweetProcessor).toBeDefined();
  });

  it('should maintain type definitions', () => {
    const mockTweet = {} as Tweet;
    const mockUser = {} as User;
    expect(mockTweet).toBeDefined();
    expect(mockUser).toBeDefined();
  });
});
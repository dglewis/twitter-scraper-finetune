import type { Tweet, CollectionOptions } from './types';

/**
 * Static class for filtering and validating tweets.
 * This is the TypeScript implementation that will eventually replace the JavaScript version.
 */
class TweetFilter {
  private static options: CollectionOptions = {
    tweetTypes: [],
    contentTypes: [],
    filterByEngagement: false,
    filterByDate: false,
    excludeKeywords: false
  };

  private constructor() {
    throw new Error('TweetFilter is a static class and cannot be instantiated');
  }

  static async promptCollectionMode(): Promise<CollectionOptions> {
    return { ...this.options };
  }

  static async promptCustomOptions(): Promise<CollectionOptions> {
    return { ...this.options };
  }

  /**
   * Validates if a tweet meets the basic criteria for processing
   * @param tweet - The tweet to validate
   * @returns boolean indicating if the tweet is valid
   */
  static isValid(tweet: Tweet): boolean {
    // Skip tweets that are missing required fields
    if (!tweet.id_str || !tweet.text || !tweet.created_at || !tweet.user) {
      return false;
    }

    // Skip tweets from suspended or deleted accounts
    if (!tweet.user.screen_name || !tweet.user.name) {
      return false;
    }

    // Skip tweets that are too short or empty
    const cleanText = tweet.text.trim();
    if (cleanText.length < 3) {
      return false;
    }

    // Skip tweets that are just URLs
    const urlRegex = /^https?:\/\/[^\s]+$/;
    if (urlRegex.test(cleanText)) {
      return false;
    }

    // Skip tweets that are just hashtags
    const hashtagRegex = /^(?:#\w+\s*)+$/;
    if (hashtagRegex.test(cleanText)) {
      return false;
    }

    // Skip tweets that are just mentions
    const mentionRegex = /^(?:@\w+\s*)+$/;
    if (mentionRegex.test(cleanText)) {
      return false;
    }

    return true;
  }
}

export { TweetFilter };


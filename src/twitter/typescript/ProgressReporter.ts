import { format } from 'date-fns';
import chalk from 'chalk';

interface ContentTypeStats {
  textOnly: number;
  withImages: number;
  withVideos: number;
  withLinks: number;
}

interface EngagementStats {
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  averageLikes: number;
}

interface CollectionResults {
  totalTweets: number;
  originalTweets: number;
  replies: number;
  retweets: number;
  dateRange: {
    start: string;
    end: string;
  };
  runtime: number;
  collectionRate: number;
  successRate: number;
  rateLimitHits: number;
  fallbackCollections: number;
  storageLocation: string;
}

export class ProgressReporter {
  displayInitialCount(username: string, totalTweets: number): string {
    return `📊 Found ${chalk.bold(totalTweets.toLocaleString())} total tweets for @${username}`;
  }

  updateProgress(currentCount: number, totalTweets: number): string {
    if (totalTweets > 0) {
      const percentage = ((currentCount / totalTweets) * 100).toFixed(1);
      return `📊 Progress: ${currentCount.toLocaleString()} unique tweets (${percentage}%)`;
    }
    return `📊 Progress: ${currentCount.toLocaleString()} unique tweets collected`;
  }

  displayContentTypeSummary(stats: ContentTypeStats): string {
    return `
📊 Content Type Breakdown:
• Text Only: ${stats.textOnly.toLocaleString()}
• With Images: ${stats.withImages.toLocaleString()}
• With Videos: ${stats.withVideos.toLocaleString()}
• With Links: ${stats.withLinks.toLocaleString()}`;
  }

  displayEngagementSummary(stats: EngagementStats): string {
    return `
💫 Engagement Statistics:
• Total Likes: ${stats.totalLikes.toLocaleString()}
• Total Retweets: ${stats.totalRetweets.toLocaleString()}
• Total Replies: ${stats.totalReplies.toLocaleString()}
• Average Likes: ${stats.averageLikes.toLocaleString()}`;
  }

  displayCollectionResults(results: CollectionResults): string {
    return `
📊 Collection Results:
Total Tweets: ${results.totalTweets.toLocaleString()}
Original Tweets: ${results.originalTweets.toLocaleString()}
Replies: ${results.replies.toLocaleString()}
Retweets: ${results.retweets.toLocaleString()}
Date Range: ${results.dateRange.start} to ${results.dateRange.end}
Runtime: ${results.runtime.toFixed(1)} seconds
Collection Rate: ${results.collectionRate.toFixed(1)} tweets/minute
Success Rate: ${results.successRate.toFixed(1)}%
Rate Limit Hits: ${results.rateLimitHits.toLocaleString()}
Fallback Collections: ${results.fallbackCollections.toLocaleString()}
Storage Location: ${chalk.gray(results.storageLocation)}`;
  }
}
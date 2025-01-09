import { format } from 'date-fns';

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
    return `📊 Found ${totalTweets.toLocaleString()} total tweets for @${username}`;
  }

  updateProgress(currentCount: number, totalTweets: number): string {
    const percentage = totalTweets === 0 ? 0.0 : ((currentCount / totalTweets) * 100);
    return `📊 Progress: ${currentCount} unique tweets (${percentage.toFixed(1)}%)`;
  }

  displayContentTypeSummary(stats: ContentTypeStats): string {
    return `
📊 Content Type Breakdown:
• Text Only: ${stats.textOnly}
• With Images: ${stats.withImages}
• With Videos: ${stats.withVideos}
• With Links: ${stats.withLinks}`;
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
Total Tweets: ${results.totalTweets}
Original Tweets: ${results.originalTweets}
Replies: ${results.replies}
Retweets: ${results.retweets}
Date Range: ${results.dateRange.start} to ${results.dateRange.end}
Runtime: ${results.runtime.toFixed(1)} seconds
Collection Rate: ${results.collectionRate.toFixed(1)} tweets/minute
Success Rate: ${results.successRate}%
Rate Limit Hits: ${results.rateLimitHits}
Fallback Collections: ${results.fallbackCollections}
Storage Location: ${results.storageLocation}`;
  }
}
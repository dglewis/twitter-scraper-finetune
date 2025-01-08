import type { Tweet, ProcessedTweet } from './types';
import { parse } from 'date-fns';

export class TweetProcessor {
  processTweet(tweet: Tweet): ProcessedTweet {
    return {
      id: tweet.id_str,
      text: tweet.full_text || tweet.text,
      created_at: this.formatDate(tweet.created_at),
      author: {
        id: tweet.user.id_str,
        username: tweet.user.screen_name,
        name: tweet.user.name,
        followers_count: tweet.user.followers_count,
        following_count: tweet.user.friends_count,
        is_verified: tweet.user.verified,
      },
      metrics: {
        retweets: tweet.retweet_count,
        likes: tweet.favorite_count,
        replies: tweet.reply_count || 0,
        quotes: tweet.quote_count || 0,
      },
      entities: {
        hashtags: tweet.entities.hashtags.map(h => h.text),
        urls: tweet.entities.urls.map(u => ({
          short_url: u.url,
          expanded_url: u.expanded_url,
          display_url: u.display_url,
        })),
        mentions: tweet.entities.user_mentions.map(m => ({
          id: m.id_str,
          username: m.screen_name,
          name: m.name,
        })),
      },
      referenced_tweets: {
        replied_to: tweet.in_reply_to_status_id_str ? {
          tweet_id: tweet.in_reply_to_status_id_str,
          author_id: tweet.in_reply_to_user_id_str!,
        } : null,
        quoted: tweet.quoted_status_id_str,
        retweeted: tweet.retweeted_status_id_str,
      },
    };
  }

  private formatDate(dateStr: string): string {
    const date = parse(dateStr, 'EEE MMM dd HH:mm:ss xx yyyy', new Date());
    return date.toISOString();
  }
}

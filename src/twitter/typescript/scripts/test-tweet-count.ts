import { Scraper, type Profile } from 'agent-twitter-client';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

async function testProfileTweetCount(username: string) {
  console.log(`Testing tweet count for @${username}...`);

  const scraper = new Scraper();

  try {
    const profile = await scraper.getProfile(username) as Profile & { tweetsCount: number };
    console.log('Raw profile data:', JSON.stringify(profile, null, 2));
    console.log('\nTweet count:', profile.tweetsCount.toLocaleString());
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

// Test with command line argument or default to 'svpino'
const username = process.argv[2] || 'iam_danlewis';
testProfileTweetCount(username);
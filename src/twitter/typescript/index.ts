import { CLI } from './CLI';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables from .env file
dotenvConfig();

// Export components
export { TwitterPipeline } from './TwitterPipeline';
export { CLI } from './CLI';
export { TweetProcessor } from './TweetProcessor';
export { DataProcessor } from './DataProcessor';
export type { Tweet, ProcessedTweet, Analytics } from './types';

// Run CLI when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cli = new CLI();

  // Handle termination signals
  const cleanup = async () => {
    console.log('\nReceived termination signal. Cleaning up...');
    try {
      await cli.cleanup();
    } catch (error) {
      console.error('Error during cleanup:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  cli.run().catch(error => {
    console.error('Failed to run CLI:', error);
    process.exit(1);
  });
}
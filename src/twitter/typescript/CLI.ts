import Logger from './Logger';
import { TwitterPipeline } from '.';

export class CLI {
  private pipeline: TwitterPipeline;

  constructor(username: string = 'degenspartan') {
    this.pipeline = new TwitterPipeline(username);
  }

  setupErrorHandlers(): void {
    process.on('unhandledRejection', (error: Error) => {
      Logger.error(`❌ Unhandled promise rejection: ${error.message}`);
      process.exit(1);
    });

    process.on('uncaughtException', (error: Error) => {
      Logger.error(`❌ Uncaught exception: ${error.message}`);
      process.exit(1);
    });

    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
  }

  async validateEnvironment(): Promise<void> {
    Logger.startSpinner('Validating environment');
    const required = ['TWITTER_USERNAME', 'TWITTER_PASSWORD'];
    const missing = required.filter((var_) => !process.env[var_]);

    if (missing.length > 0) {
      Logger.stopSpinner(false);
      Logger.error('Missing required environment variables:');
      missing.forEach((var_) => Logger.error(`- ${var_}`));
      console.log('\n📝 Create a .env file with your Twitter credentials:');
      console.log(`TWITTER_USERNAME=your_username`);
      console.log(`TWITTER_PASSWORD=your_password`);
      process.exit(1);
    }
    Logger.stopSpinner();
  }

  async cleanup(): Promise<void> {
    Logger.warn('\n🛑 Received termination signal. Cleaning up...');
    try {
      await this.pipeline.cleanup();
      Logger.success('🔒 Logged out successfully.');
    } catch (error) {
      Logger.error(`❌ Error during cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
    process.exit(0);
  }

  async run(): Promise<void> {
    try {
      await this.pipeline.run();
    } catch (error) {
      process.exit(1);
    }
  }
}

// Create and export the default instance
export default new CLI();
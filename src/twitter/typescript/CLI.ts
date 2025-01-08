import Logger from './Logger';
import { TwitterPipeline } from '.';
import { CollectionMode } from './types';
import inquirer from 'inquirer';

export class CLI {
  private pipeline: TwitterPipeline;
  private collectionMode: CollectionMode = CollectionMode.Timeline;
  private username: string;
  private limit: number = 1000;

  constructor(username: string = 'degenspartan') {
    this.username = username;
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

  async processArgs(): Promise<void> {
    const args = process.argv.slice(2);
    let i = 0;
    let hasMode = false;
    let hasUsername = false;

    // Process command line arguments first
    while (i < args.length) {
      switch (args[i]) {
        case '--mode': {
          const mode = args[++i]?.toLowerCase();
          if (!Object.values(CollectionMode).includes(mode as CollectionMode)) {
            Logger.error(`Invalid collection mode: ${mode}`);
            process.exit(1);
          }
          this.collectionMode = mode as CollectionMode;
          hasMode = true;
          break;
        }

        case '--username': {
          const username = args[++i];
          if (!username) {
            Logger.error('Username is required');
            process.exit(1);
          }
          this.username = username;
          hasUsername = true;
          break;
        }

        case '--limit': {
          const limit = parseInt(args[++i] || '', 10);
          if (isNaN(limit) || limit <= 0) {
            Logger.error(`Invalid limit: ${args[i]}`);
            process.exit(1);
          }
          this.limit = limit;
          break;
        }

        default:
          Logger.error(`Unknown argument: ${args[i]}`);
          process.exit(1);
      }
      i++;
    }

    // Handle interactive mode for missing required options
    if (!hasMode) {
      const response = await inquirer.prompt([{
        type: 'list',
        name: 'mode',
        message: 'Please select a collection mode:',
        choices: Object.values(CollectionMode)
      }]);
      this.collectionMode = response.mode;
    }

    if (!hasUsername) {
      const response = await inquirer.prompt([{
        type: 'input',
        name: 'username',
        message: 'Please enter a username:',
        default: this.username
      }]);
      this.username = response.username;
    }
  }

  getCollectionMode(): CollectionMode {
    return this.collectionMode;
  }

  getUsername(): string {
    return this.username;
  }

  getLimit(): number {
    return this.limit;
  }

  async run(): Promise<void> {
    try {
      await this.validateEnvironment();
      await this.processArgs();
      await this.pipeline.run();
    } catch (error) {
      process.exit(1);
    }
  }
}

// Create and export the default instance
export default new CLI();
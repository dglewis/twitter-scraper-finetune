import Logger from './Logger';
import { TwitterPipeline } from './TwitterPipeline';
import { CollectionMode } from './types';
import inquirer from 'inquirer';

export class CLI {
  private pipeline!: TwitterPipeline;
  private collectionMode: CollectionMode = CollectionMode.Timeline;
  private username!: string;
  private limit: number = parseInt(process.env.MAX_TWEETS || '1000');
  private initialized: boolean = false;

  constructor() {
    // Pipeline will be initialized after processing arguments
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
      await this.pipeline?.cleanup();
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
        default: 'degenspartan'
      }]);
      this.username = response.username;
    }

    // Initialize pipeline with the correct username and limit
    this.pipeline = new TwitterPipeline(this.username, {
      maxTweets: this.limit
    });

    // Log the selected mode
    Logger.info(`Collection mode: ${this.collectionMode}`);
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

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.validateEnvironment();
      await this.processArgs();
      this.initialized = true;
    }
  }

  async run(): Promise<void> {
    try {
      await this.initialize();

      try {
        await this.pipeline.run();
      } catch (error) {
        if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
          Logger.warn('Rate limit exceeded. Attempting fallback collection...');
          Logger.info('Attempting fallback collection mode...');
          await this.pipeline.collectWithFallback(this.username);
        } else {
          Logger.error(`Collection failed: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      }
    } catch (error) {
      Logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
}

// Create and export the default instance
export default new CLI();
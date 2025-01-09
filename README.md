# Degen Scraper

Pipeline for generating AI character files and training datasets by scraping public figures' online presence across Twitter and blogs.

> ⚠️ **IMPORTANT**: Create a new Twitter account for this tool. DO NOT use your main account as it may trigger Twitter's automation detection and result in account restrictions.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Copy the `.env.example` into a `.env` file:
   ```properties
   # (Required) Twitter Authentication
   TWITTER_USERNAME=     # your twitter username
   TWITTER_PASSWORD=     # your twitter password

   # (Optional) Blog Configuration
   BLOG_URLS_FILE=      # path to file containing blog URLs

   # (Optional) Scraping Configuration
   MAX_TWEETS=          # max tweets to scrape
   MAX_RETRIES=         # max retries for scraping
   RETRY_DELAY=         # delay between retries
   MIN_DELAY=          # minimum delay between requests
   MAX_DELAY=          # maximum delay between requests
   ```

## Usage

### Twitter Collection (✅ TypeScript Available)

TypeScript version (recommended):
```bash
pnpm tw --mode <mode> --username <username> --limit <number>
```

Available collection modes:
- `timeline`: Collect tweets from user's timeline
- `search`: Search for tweets from the user
- `list`: Collect tweets from a user's list
- `likes`: Collect tweets liked by the user
- `bookmarks`: Collect bookmarked tweets

Example:
```bash
pnpm tw --mode timeline --username pmarca --limit 5000
```

Features:
- Command-line arguments for configuration
- Multiple collection modes
- Concise progress output
- Collection rate and efficiency metrics

JavaScript version:
```bash
# Run the scraper (only username as argument)
pnpm twitter pmarca

# All other options must be set in .env:
MAX_TWEETS=5000      # Number of tweets to collect (default: 50000)
MAX_RETRIES=5        # Number of retries on failure (default: 5)
RETRY_DELAY=5000     # Delay between retries in ms (default: 5000)
MIN_DELAY=1000       # Min delay between requests in ms (default: 1000)
MAX_DELAY=3000       # Max delay between requests in ms (default: 3000)
```

Features:
- Detailed progress with percentage
- Interactive sample tweet viewer
- Content type breakdown
- Engagement statistics
- Comprehensive analytics table

### Blog Collection (🚧 JavaScript Only)
```bash
pnpm blog
```

### Generate Character (🚧 JavaScript Only)
```bash
pnpm character -- username
```
Example: `pnpm character -- pmarca`

### Finetune (🚧 JavaScript Only)
```bash
pnpm finetune
```

### Finetune Test (🚧 JavaScript Only)
```bash
pnpm finetune:test
```

### Generate Virtuals Character Card (🚧 JavaScript Only)
https://whitepaper.virtuals.io/developer-documents/agent-contribution/contribute-to-cognitive-core#character-card-and-goal-samples

Run this after Twitter Collection step
```bash
pnpm generate-virtuals -- username date
```

Example: `pnpm generate-virtuals -- pmarca 2024-11-29`
Example without date: `pnpm generate-virtuals -- pmarca`

## Output Files

The generated files will be in the following locations:
- Character file: `pipeline/[username]/[date]/character/character.json`
- Tweet dataset: `pipeline/[username]/[date]/raw/tweets.json`
- URLs list: `pipeline/[username]/[date]/raw/urls.txt`
- Analytics: `pipeline/[username]/[date]/analytics/stats.json`
- Fine-tuning data: `pipeline/[username]/[date]/processed/finetuning.jsonl`

## Migration Status

Currently, only the Twitter collection module has been migrated to TypeScript. Other modules (blog collection, character generation, fine-tuning) remain in JavaScript. The TypeScript migration is being done incrementally to ensure stability and maintain functionality.
# TypeScript Migration Plan

## Overview
This document defines the strategy and architectural decisions for migrating the Twitter scraper project from JavaScript to TypeScript. It serves as the source of truth for:
- Migration approach and principles
- Quality requirements and standards
- Testing strategy and coverage requirements
- Architectural decisions and patterns

Implementation progress and current metrics are tracked separately in `typescript-migration-progress.md`.

## Table of Contents
- [TypeScript Migration Plan](#typescript-migration-plan)
  - [Overview](#overview)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites (Completed)](#prerequisites-completed)
  - [Technology Stack](#technology-stack)
  - [Migration Strategy Updates](#migration-strategy-updates)
    - [Phase 1: Initial Setup (Completed)](#phase-1-initial-setup-completed)
    - [Phase 2: Module Migration](#phase-2-module-migration)
    - [File Organization](#file-organization)
    - [Migration Process](#migration-process)
    - [Testing Strategy](#testing-strategy)
    - [Phase 3: Validation and Cleanup](#phase-3-validation-and-cleanup)
  - [Implementation Guidelines](#implementation-guidelines)
    - [Type System Best Practices](#type-system-best-practices)
    - [Error Handling Patterns](#error-handling-patterns)
    - [Documentation Standards](#documentation-standards)
    - [Data Processing Patterns](#data-processing-patterns)
    - [Test Coverage Requirements](#test-coverage-requirements)
  - [Migration Status](#migration-status)

## Prerequisites (Completed)

1. Update package manager to pnpm:
```bash
npm install -g pnpm
```

2. Install TypeScript and essential dev dependencies:
```bash
pnpm add -D typescript @types/node tsx tsup
pnpm add -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui
pnpm add -D prettier prettier-plugin-organize-imports
pnpm add -D @total-typescript/ts-reset
pnpm add -D zod
```

3. Install type definitions for existing dependencies:
```bash
pnpm add -D @types/inquirer @types/progress @types/ua-parser-js
```

## Technology Stack

- **Package Manager**: pnpm (faster, more efficient than npm)
- **Runtime**: Node.js (Latest LTS)
- **Language**: TypeScript 5.3+
- **Testing Framework**: Vitest
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier
- **Module System**: ESM
- **Build Tool**: tsup (for production builds)
- **Runtime Type Checking**: Zod
- **Type Utilities**: @total-typescript/ts-reset

## Migration Strategy Updates

### Phase 1: Initial Setup (Completed)

1. Tooling and Configuration:
   - Moved to ESLint flat config format (`eslint.config.js`)
   - Using co-located tests in `__tests__` directories
   - Implemented incremental TypeScript adoption with `allowJs: true`

2. Core Type Definitions:
   - Created Zod schemas for data validation
   - Implemented Tweet, User, and Config types
   - Added comprehensive test coverage

3. Error Handling:
   - Implemented error class hierarchy
   - Added type-safe error context
   - Full test coverage for error utilities

### Phase 2: Module Migration

The migration order and current status are tracked in `typescript-migration-progress.md`. This section defines the migration approach for each module:

1. Logger Module:
   - Instance-based implementation with static state
   - Type-safe logging methods
   - Collection stats tracking
   - Progress display utilities

2. Twitter API Types:
   - Zod schemas for runtime validation
   - Comprehensive type definitions
   - Optional field handling
   - Null safety

3. Tweet Processing:
   - Entity handling
   - Reference resolution
   - Metric calculations
   - Type-safe transformations

4. Data Processing:
   - File system operations
   - Analytics generation
   - Fine-tuning data preparation
   - Directory management

5. CLI Interface:
   - Command handling
   - Input validation
   - Error reporting
   - User feedback

### File Organization
- TypeScript implementations live in a `typescript` subdirectory
- Original JavaScript files remain in their current location
- Tests import from the typescript directory
- This structure ensures:
  - Clear separation between JS and TS code
  - No naming conflicts during migration
  - Easy path to eventual replacement
  - Clear migration boundaries

### Migration Process
1. Define interfaces before implementation
2. Write comprehensive tests following TDD
3. Implement type-safe code
4. Validate existing functionality
5. Keep TypeScript implementations separate from JavaScript
6. Never modify JavaScript files - they are the source of truth

### Testing Strategy
1. Core Requirements:
   - Write tests before implementation (TDD)
   - Co-locate tests with source code in `__tests__` directories
   - TypeScript tests import only from TypeScript files
   - JavaScript tests remain untouched
   - Mock external dependencies
   - Test error cases and edge conditions

2. Quality Standards:
   - Maintain high test coverage
   - Validate type safety in tests
   - Use proper type assertions
   - Test both success and failure paths
   - Mock external dependencies and side effects
   - Verify error handling

### Phase 3: Validation and Cleanup

1. Type System:
   - Strict type checking
   - No implicit any
   - Runtime validation with Zod
   - Proper error handling types

2. Quality Assurance:
   - Full test coverage
   - Type checking validation
   - ESLint compliance
   - Existing functionality preservation

## Implementation Guidelines

### Type System Best Practices

1. Use TypeScript's strict mode features:
   - Enable all strict flags
   - No type assertions without validation
   - Prefer union types over enums
   - Use branded types for IDs
   - Create standardized interfaces for processed data
   - Use nullable types instead of undefined for optional fields
   - Leverage type inference with proper type guards
   - Implement Zod schemas for runtime validation
   - Maintain comprehensive schema test coverage

2. Type Safety Examples:
```typescript
// Example of standardized processed data
interface ProcessedData<T> {
  id: string;
  created_at: string;  // ISO 8601 format
  raw: T;  // Original data
  processed: {
    // Standardized fields
    metadata: Record<string, unknown>;
    content: string;
    references: string[];
  };
}

// Example of type guard with schema validation
function isProcessedTweet(data: unknown): data is ProcessedTweet {
  return tweetSchema.safeParse(data).success;
}

// Example of Zod schema with runtime validation
const tweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  created_at: z.string().datetime(),
  // ... other fields
}).strict();
```

### Error Handling Patterns

```typescript
// Example of error handling
async function fetchTweet(id: string): Promise<Tweet> {
  try {
    const response = await fetch(`/api/tweets/${id}`);
    if (!response.ok) {
      throw new NetworkError('Failed to fetch tweet', response.status);
    }
    const data = await response.json();
    return TweetSchema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid tweet data', error.issues);
    }
    throw error;
  }
}
```

### Documentation Standards

1. Code Documentation:
   - All public APIs must have JSDoc comments
   - Include examples in documentation
   - Document error cases and handling
   - Keep documentation up to date with code

2. Example Documentation:
```typescript
/**
 * Fetches a user's timeline with rate limiting and retry logic.
 *
 * @param userId - The unique identifier of the user
 * @param options - Configuration options for the request
 * @throws {RateLimitError} When API rate limit is exceeded
 * @throws {NetworkError} When network request fails
 * @returns Promise resolving to an array of tweets
 *
 * @example
 * ```typescript
 * const timeline = await fetchUserTimeline('123', { limit: 100 });
 * ```
 */
async function fetchUserTimeline(
  userId: string,
  options: TimelineOptions
): Promise<Tweet[]> {
  // Implementation
}
```

### Data Processing Patterns

```typescript
// Example of analytics generation
interface Analytics {
  totalTweets: number;
  engagement: {
    totalLikes: number;
    totalRetweetCount: number;
    averageLikes: string;
    topTweets: Array<{
      id: string;
      text: string;
      likes: number;
    }>;
  };
  timeRange: {
    start: string;
    end: string;
  };
}

class DataProcessor {
  /**
   * Processes tweets and generates analytics.
   *
   * @param tweets - Array of tweets to process
   * @returns Analytics object with engagement metrics
   *
   * @example
   * ```typescript
   * const processor = new DataProcessor(baseDir, username);
   * const analytics = await processor.generateAnalytics(tweets);
   * ```
   */
  generateAnalytics(tweets: Tweet[]): Analytics {
    // Implementation
  }

  /**
   * Saves tweets and generates required files.
   *
   * @param tweets - Array of tweets to save
   * @returns Analytics for the saved tweets
   * @throws {ValidationError} When tweet data is invalid
   * @throws {FileSystemError} When file operations fail
   */
  async saveTweets(tweets: Tweet[]): Promise<Analytics> {
    // Implementation
  }
}
```

### Test Coverage Requirements

1. Module Coverage Requirements:
   - Logger Module: Must cover all logging levels, collection stats tracking, and display functions
   - Twitter API Types: Must validate all supported API response structures and edge cases
   - Tweet Processing: Must verify entity handling, reference resolution, and metric calculations
   - Tweet Filtering: Must cover all validation rules and edge cases
   - Schema Validation: Must verify all data structure validations and transformations
   - Error Utilities: Must cover all error types and their context handling

2. Test Categories:
   - Type validation: Verify type safety and schema validation
   - Error handling: Cover all error cases and recovery paths
   - Data processing: Verify data transformations and state management
   - Edge cases: Test boundary conditions and invalid inputs
   - Integration: Verify module interactions and data flow

3. Quality Standards:
   - All public APIs must have comprehensive test coverage
   - Error cases must be explicitly tested
   - Edge cases must be identified and verified
   - Data transformations must be validated
   - Type safety must be verified
   - Integration points must be tested

## Migration Status
For current implementation status, test coverage metrics, and next actions, refer to `typescript-migration-progress.md`.

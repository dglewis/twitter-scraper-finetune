# TypeScript Migration Plan

## Overview
This document outlines the strategy for migrating the Twitter scraper project from JavaScript to TypeScript, using modern tools and best practices. The migration will be done incrementally to minimize disruption while maintaining code quality and security.

## Table of Contents
- [TypeScript Migration Plan](#typescript-migration-plan)
  - [Overview](#overview)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites (Completed)](#prerequisites-completed)
  - [Technology Stack](#technology-stack)
  - [Migration Strategy Updates](#migration-strategy-updates)
    - [Phase 1: Initial Setup (Completed)](#phase-1-initial-setup-completed)
    - [Phase 2: Module Migration (In Progress)](#phase-2-module-migration-in-progress)
    - [Phase 3: Validation and Cleanup](#phase-3-validation-and-cleanup)
  - [Implementation Guidelines](#implementation-guidelines)
    - [Type System Best Practices](#type-system-best-practices)
    - [Error Handling Patterns](#error-handling-patterns)
    - [Documentation Standards](#documentation-standards)
  - [Current Progress](#current-progress)
  - [Next Steps](#next-steps)

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

### Phase 2: Module Migration (In Progress)

1. Migration Order (Prioritized):
   - Logger module (used throughout codebase)
   - Twitter API types and interfaces
   - Data processing utilities
   - CLI interfaces

2. Migration Strategy:
   - Co-locate tests with source code
   - Maintain backward compatibility
   - Validate with type checking and tests
   - No breaking changes to existing functionality

3. Testing Approach:
   - Test-driven development
   - Co-located tests in `__tests__` directories
   - Full type coverage
   - Maintain existing functionality

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

2. Type Safety Examples:
```typescript
// Example of branded types
type UserId = string & { readonly __brand: unique symbol };

function createUserId(id: string): UserId {
  return id as UserId;
}

// Example of discriminated unions
type TwitterEvent =
  | { type: 'tweet'; content: string }
  | { type: 'retweet'; originalId: string }
  | { type: 'like'; tweetId: string };
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

## Current Progress

- ✅ TypeScript configuration
- ✅ ESLint setup with flat config
- ✅ Core type definitions
- ✅ Error handling utilities
- ✅ Initial test infrastructure
- 🔄 Module migration planning
- ⏳ Logger module migration
- ⏳ Twitter API types

## Next Steps

1. Logger Module:
   - Define interfaces
   - Implement type-safe methods
   - Add tests
   - Maintain existing API

2. Twitter API Types:
   - Define request/response types
   - Add Zod validation
   - Implement error handling
   - Test coverage

3. Data Processing:
   - Type-safe transformations
   - Validation pipelines
   - Error boundary handling
   - Comprehensive testing

3. Setup ESLint configuration (`eslint.config.js`):
```javascript
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
];
```

4. Testing Strategy:
   - Co-locate tests with source code in `__tests__` directories
   - Use Vitest for TypeScript-aware testing
   - Maintain high test coverage
   - Test both TypeScript and JavaScript files during migration

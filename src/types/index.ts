import { z } from 'zod';

// Core Twitter types
export const TwitterUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string().optional(),
  followers: z.number().int().positive(),
  following: z.number().int().positive(),
  createdAt: z.date(),
});

export const TweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  authorId: z.string(),
  createdAt: z.date(),
  replyCount: z.number().int().nonnegative(),
  retweetCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
});

// Configuration types
export const ScrapingConfigSchema = z.object({
  maxDepth: z.number().int().positive(),
  concurrency: z.number().int().positive(),
  rateLimit: z.number().positive(),
  timeout: z.number().positive(),
  retryAttempts: z.number().int().min(0),
});

// Export inferred types
export type TwitterUser = z.infer<typeof TwitterUserSchema>;
export type Tweet = z.infer<typeof TweetSchema>;
export type ScrapingConfig = z.infer<typeof ScrapingConfigSchema>;
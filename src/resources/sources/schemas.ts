import { z } from "zod";

export const GitHubBranchSchema = z.object({ displayName: z.string() });
export type GitHubBranch = z.infer<typeof GitHubBranchSchema>;

export const GitHubRepoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  isPrivate: z.boolean().optional(),
  defaultBranch: GitHubBranchSchema.optional(),
  branches: z.array(GitHubBranchSchema).optional(),
});
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

export const SourceSchema = z.object({
  name: z.string(),
  id: z.string(),
  githubRepo: GitHubRepoSchema.optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const SourceListSchema = z.object({
  sources: z.array(SourceSchema).optional(),
  nextPageToken: z.string().optional(),
});
export type SourceList = z.infer<typeof SourceListSchema>;

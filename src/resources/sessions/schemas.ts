import { z } from "zod";
import { ChangeSetSchema } from "../activities/schemas.js";

export const SessionStateSchema = z.enum([
  "STATE_UNSPECIFIED",
  "QUEUED",
  "PLANNING",
  "AWAITING_PLAN_APPROVAL",
  "AWAITING_USER_FEEDBACK",
  "IN_PROGRESS",
  "PAUSED",
  "FAILED",
  "COMPLETED",
]);
export type SessionState = z.infer<typeof SessionStateSchema>;

export const GitHubRepoContextSchema = z.object({
  startingBranch: z.string().optional(),
});

export const SourceContextSchema = z.object({
  source: z.string(),
  githubRepoContext: GitHubRepoContextSchema.optional(),
});
export type SourceContext = z.infer<typeof SourceContextSchema>;

export const PullRequestSchema = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string().optional(),
  number: z.number().optional(),
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

export const SessionOutputSchema = z.object({
  pullRequest: PullRequestSchema.optional(),
  changeSet: ChangeSetSchema.optional(),
});

export const SessionSchema = z.object({
  name: z.string().optional(),
  id: z.string(),
  title: z.string().optional(),
  prompt: z.string(),
  state: SessionStateSchema.optional(),
  sourceContext: SourceContextSchema.optional(),
  createTime: z.string().optional(),
  updateTime: z.string().optional(),
  outputs: z.array(SessionOutputSchema).optional(),
  requirePlanApproval: z.boolean().optional(),
  automationMode: z.string().optional(),
  archived: z.boolean().optional(),
  url: z.string().optional(),
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionListSchema = z.object({
  sessions: z.array(SessionSchema).optional(),
  nextPageToken: z.string().optional(),
});
export type SessionList = z.infer<typeof SessionListSchema>;

export const CreateSessionRequestSchema = z.object({
  prompt: z.string(),
  sourceContext: SourceContextSchema,
  title: z.string().optional(),
  requirePlanApproval: z.boolean().optional(),
  automationMode: z.literal("AUTO_CREATE_PR").optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const SendMessageRequestSchema = z.object({
  prompt: z.string(),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

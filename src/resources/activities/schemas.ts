import { z } from "zod";

export const PlanStepSchema = z.object({
  id: z.string().optional(),
  index: z.number().optional(),
  title: z.string(),
  description: z.string().optional(),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const PlanSchema = z.object({
  id: z.string().optional(),
  steps: z.array(PlanStepSchema).optional(),
  createTime: z.string().optional(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const PlanGeneratedSchema = z.object({ plan: PlanSchema.optional() });
export const PlanApprovedSchema = z.object({ planId: z.string().optional() });
export const AgentMessagedSchema = z.object({ agentMessage: z.string() });
export const UserMessagedSchema = z.object({ userMessage: z.string() });
export const ProgressUpdatedSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});
export const SessionCompletedSchema = z.object({});
export const SessionFailedSchema = z.object({ reason: z.string().optional() });

export const GitPatchSchema = z.object({
  baseCommitId: z.string().optional(),
  suggestedCommitMessage: z.string().optional(),
  unidiffPatch: z.string().optional(),
});

export const ChangeSetSchema = z.object({
  source: z.string().optional(),
  gitPatch: GitPatchSchema.optional(),
});

export const BashOutputSchema = z.object({
  command: z.string().optional(),
  output: z.string().optional(),
  exitCode: z.number().optional(),
});

export const MediaSchema = z.object({
  data: z.string().optional(),
  mimeType: z.string().optional(),
});

export const ArtifactSchema = z.object({
  media: MediaSchema.optional(),
  bashOutput: BashOutputSchema.optional(),
  changeSet: ChangeSetSchema.optional(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const ActivitySchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  createTime: z.string().optional(),
  originator: z.string().optional(),
  planGenerated: PlanGeneratedSchema.optional(),
  planApproved: PlanApprovedSchema.optional(),
  agentMessaged: AgentMessagedSchema.optional(),
  userMessaged: UserMessagedSchema.optional(),
  progressUpdated: ProgressUpdatedSchema.optional(),
  sessionCompleted: SessionCompletedSchema.optional(),
  sessionFailed: SessionFailedSchema.optional(),
  artifacts: z.array(ArtifactSchema).optional(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const ActivityListSchema = z.object({
  activities: z.array(ActivitySchema).optional(),
  nextPageToken: z.string().optional(),
});
export type ActivityList = z.infer<typeof ActivityListSchema>;

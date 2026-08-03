export const activityPlanGeneratedFixture = {
  name: "sessions/1234567890/activities/a1",
  id: "a1",
  createTime: "2026-08-02T13:07:34.799222Z",
  originator: "agent",
  planGenerated: {
    plan: {
      id: "plan-1",
      steps: [
        {
          id: "step-1",
          title: "Enhance Focus Visibility (A11y)",
          description: "Update focus-visible outlines to high contrast.",
        },
      ],
    },
  },
};

export const activityPlanApprovedFixture = {
  name: "sessions/1234567890/activities/a2",
  createTime: "2026-08-02T13:08:00.000000Z",
  originator: "user",
  planApproved: { planId: "plan-1" },
};

export const activityAgentMessagedFixture = {
  name: "sessions/1234567890/activities/a3",
  createTime: "2026-08-02T13:09:00.000000Z",
  originator: "agent",
  agentMessaged: { agentMessage: "Starting work on the plan now." },
};

export const activityUserMessagedFixture = {
  name: "sessions/1234567890/activities/a4",
  createTime: "2026-08-02T13:10:00.000000Z",
  originator: "user",
  userMessaged: { userMessage: "Also add integration tests please." },
};

export const activityProgressUpdatedFixture = {
  name: "sessions/1234567890/activities/a5",
  createTime: "2026-08-02T13:11:00.000000Z",
  originator: "agent",
  progressUpdated: {
    title: "Running test suite",
    description: "42 of 100 tests passed so far.",
  },
};

export const activitySessionCompletedFixture = {
  name: "sessions/1234567890/activities/a6",
  createTime: "2026-08-02T13:45:38.626149Z",
  originator: "agent",
  sessionCompleted: {},
};

export const activitySessionFailedFixture = {
  name: "sessions/2222222222/activities/a7",
  createTime: "2026-08-02T13:12:00.000000Z",
  originator: "agent",
  sessionFailed: { reason: "Build failed: missing dependency 'left-pad'." },
};

export const activityArtifactsFixture = {
  name: "sessions/1234567890/activities/a8",
  createTime: "2026-08-02T13:13:00.000000Z",
  originator: "agent",
  artifacts: [
    {
      changeSet: {
        source: "sources/github/acme/widget-app",
        gitPatch: {
          baseCommitId: "abc123",
          suggestedCommitMessage: "Add auth tests",
          unidiffPatch: "diff --git a/foo b/foo\n...",
        },
      },
    },
    {
      bashOutput: {
        command: "pnpm test",
        output: "42 passed",
        exitCode: 0,
      },
    },
    {
      media: {
        mimeType: "image/png",
        data: "base64data",
      },
    },
  ],
};

export const activityNoVariantFixture = {
  name: "sessions/1234567890/activities/a9",
  createTime: "2026-08-02T13:14:00.000000Z",
  originator: "agent",
};

export const activityListFixture = {
  activities: [
    activityPlanGeneratedFixture,
    activityPlanApprovedFixture,
    activityAgentMessagedFixture,
    activityUserMessagedFixture,
    activityProgressUpdatedFixture,
    activitySessionCompletedFixture,
    activityArtifactsFixture,
  ],
  nextPageToken: "activity-page-2",
};

import type { Session, SessionList } from "../../src/resources/sessions/schemas.js";

export const sessionCompletedFixture = {
  name: "sessions/1234567890",
  id: "1234567890",
  title: "Add unit tests for auth module",
  prompt: "Add unit tests for the authentication module",
  state: "COMPLETED",
  sourceContext: {
    source: "sources/github/acme/widget-app",
    githubRepoContext: { startingBranch: "main" },
  },
  createTime: "2026-08-02T13:00:02.155722147Z",
  updateTime: "2026-08-02T13:45:38.626149Z",
  archived: false,
  url: "https://jules.google.com/session/1234567890",
  outputs: [
    {
      pullRequest: {
        url: "https://github.com/acme/widget-app/pull/42",
        title: "Add auth module unit tests",
        description: "Adds coverage for login/logout/token refresh.",
        number: 42,
      },
    },
  ],
} satisfies Session;

export const sessionCompletedNoPrFixture = {
  id: "9999999999",
  title: "Investigate flaky test",
  prompt: "Investigate why test X is flaky",
  state: "COMPLETED",
} satisfies Session;

export const sessionAwaitingPlanApprovalFixture = {
  id: "2222222222",
  title: "Refactor database layer",
  prompt: "Refactor the database layer to use the repository pattern",
  state: "AWAITING_PLAN_APPROVAL",
  requirePlanApproval: true,
} satisfies Session;

export const sessionAwaitingUserFeedbackFixture = {
  id: "3333333333",
  title: "Palette: Micro-UX & Accessibility Agent",
  prompt: "Find and implement one micro-UX improvement.",
  state: "AWAITING_USER_FEEDBACK",
} satisfies Session;

export const sessionCompletedWithMultipleOutputsFixture = {
  name: "sessions/18290074838581230171",
  id: "18290074838581230171",
  title: "Code Review: PR 17 (fix/encode-path-segments)",
  prompt: "Do a code review for branch fix/encode-path-segments that's on PR 17",
  state: "COMPLETED",
  sourceContext: {
    source: "sources/github/acme/widget-app",
    githubRepoContext: { startingBranch: "main" },
  },
  createTime: "2026-08-02T13:00:02.155722147Z",
  updateTime: "2026-08-02T13:45:38.626149Z",
  archived: false,
  url: "https://jules.google.com/session/18290074838581230171",
  outputs: [
    {
      changeSet: {
        source: "sources/github/acme/widget-app",
        gitPatch: {
          baseCommitId: "abc123",
          suggestedCommitMessage: "Code Review: PR 17 (fix/encode-path-segments)",
          unidiffPatch:
            "diff --git a/foo b/foo\n--- a/foo\n+++ b/foo\n@@ -1,3 +1,3 @@\n-old line\n+new line",
        },
      },
    },
    {
      pullRequest: {
        url: "https://github.com/acme/widget-app/pull/18",
        title: "Code Review: PR 17 (fix/encode-path-segments)",
        description: "Review comments and fixes.",
        number: 18,
      },
    },
  ],
} satisfies Session;

export const sessionListFixture = {
  sessions: [
    sessionCompletedFixture,
    sessionCompletedWithMultipleOutputsFixture,
    sessionAwaitingPlanApprovalFixture,
  ],
  nextPageToken: "session-page-2",
} satisfies SessionList;

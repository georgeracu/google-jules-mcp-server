import { describe, expect, it } from "vitest";

import {
  formatSessionCreated,
  formatSessionList,
  formatSessionOutput,
  formatSessionStatus,
  formatStuckSessionList,
  formatWaitResolution,
  formatWaitTimeout,
} from "../../../src/resources/sessions/format.js";
import { activityListFixture } from "../../fixtures/activities.js";
import {
  sessionAwaitingPlanApprovalFixture,
  sessionAwaitingUserFeedbackFixture,
  sessionCompletedFixture,
  sessionCompletedNoPrFixture,
  sessionCompletedWithMultipleOutputsFixture,
  sessionListFixture,
} from "../../fixtures/sessions.js";

describe("formatSessionList", () => {
  it("renders a helpful message when there are no sessions", () => {
    expect(formatSessionList({})).toContain("No sessions found");
  });

  it("numbers sessions and includes PR links when present", () => {
    const text = formatSessionList(sessionListFixture);
    expect(text).toContain("1. Add unit tests for auth module");
    expect(text).toContain("PR: https://github.com/acme/widget-app/pull/42");
    expect(text).toContain("PR: https://github.com/acme/widget-app/pull/18");
    expect(text).toContain(`pageToken: ${sessionListFixture.nextPageToken}`);
  });

  it("formats session list with untitled session", () => {
    const listWithUntitled = {
      sessions: [
        {
          id: "untitled-1",
          prompt: "Do something",
          state: "COMPLETED" as const,
        },
      ],
    };
    const text = formatSessionList(listWithUntitled);
    expect(text).toContain("Untitled");
  });
});

describe("formatStuckSessionList", () => {
  it("renders a clear message when there are no stuck sessions", () => {
    expect(formatStuckSessionList({ sessions: [] })).toContain("No stuck sessions found");
  });

  it("formats the fields needed to act on a stuck session", () => {
    const text = formatStuckSessionList({
      sessions: [
        {
          id: "approval-1",
          title: "Review authentication plan",
          prompt: "Review the plan",
          state: "AWAITING_PLAN_APPROVAL",
          url: "https://jules.google.com/session/approval-1",
          updateTime: "2026-08-17T08:00:00Z",
        },
      ],
    });

    expect(text).toContain("Review authentication plan");
    expect(text).toContain("ID: approval-1");
    expect(text).toContain("State: AWAITING_PLAN_APPROVAL");
    expect(text).toContain("URL: https://jules.google.com/session/approval-1");
    expect(text).toContain("Updated: 2026-08-17T08:00:00Z");
  });

  it("uses fallbacks for missing stuck-session display fields", () => {
    const text = formatStuckSessionList({
      sessions: [
        {
          id: "approval-2",
          prompt: "Review the plan",
          state: "AWAITING_PLAN_APPROVAL",
        },
      ],
    });

    expect(text).toContain("Untitled");
    expect(text).toContain("URL: unknown");
    expect(text).toContain("Updated: unknown");
  });
});

describe("formatSessionCreated", () => {
  it("notes manual approval is required when autoApprove is false", () => {
    const text = formatSessionCreated(sessionCompletedFixture, {
      repoOwner: "acme",
      repoName: "widget-app",
      branch: "main",
      autoApprove: false,
      autoCreatePR: false,
    });
    expect(text).toContain("Manual plan approval required");
  });

  it("omits the approval note when autoApprove is true", () => {
    const text = formatSessionCreated(sessionCompletedFixture, {
      repoOwner: "acme",
      repoName: "widget-app",
      branch: "main",
      autoApprove: true,
      autoCreatePR: true,
    });
    expect(text).not.toContain("Manual plan approval required");
    expect(text).toContain("Auto-create PR: true");
  });
});

describe("formatSessionStatus", () => {
  it("includes pull request details when present", () => {
    const text = formatSessionStatus(sessionCompletedFixture, {});
    expect(text).toContain("Pull Request Created:");
    expect(text).toContain("https://github.com/acme/widget-app/pull/42");
  });

  it("formats session status with untitled session and pr without description", () => {
    const sessionUntitledNoPrDesc = {
      id: "untitled-2",
      prompt: "Do something",
      state: "COMPLETED" as const,
      outputs: [
        {
          pullRequest: {
            url: "https://github.com/acme/widget-app/pull/42",
            title: "Add auth module unit tests",
          },
        },
      ],
    };
    const text = formatSessionStatus(sessionUntitledNoPrDesc, {});
    expect(text).toContain("Session: Untitled");
    expect(text).not.toContain("Description:");
  });

  it("finds and includes pull request details when PR is at a non-zero index", () => {
    const text = formatSessionStatus(sessionCompletedWithMultipleOutputsFixture, {});
    expect(text).toContain("Pull Request Created:");
    expect(text).toContain("https://github.com/acme/widget-app/pull/18");
  });

  it("reports no activities yet when the activity list is empty", () => {
    const text = formatSessionStatus(sessionAwaitingPlanApprovalFixture, {});
    expect(text).toContain("No activities yet - session starting up.");
  });

  it("renders recent activity summaries without falling back to a generic message", () => {
    const text = formatSessionStatus(sessionCompletedFixture, activityListFixture);
    expect(text).toContain("Recent Activity");
    expect(text).toContain("[agent]");
    expect(text).not.toContain("Activity occurred");
  });

  it.each([
    ["COMPLETED" as const, "Session complete!"],
    ["FAILED" as const, "Session failed."],
    ["AWAITING_PLAN_APPROVAL" as const, "awaiting plan approval"],
    ["AWAITING_USER_FEEDBACK" as const, "waiting on you"],
    ["PAUSED" as const, "Session is paused."],
    ["IN_PROGRESS" as const, "Poll again in 10-30 seconds"],
  ])("guides the caller for state %s", (state, expectedSubstring) => {
    const text = formatSessionStatus({ ...sessionAwaitingPlanApprovalFixture, state }, {});
    expect(text).toContain(expectedSubstring);
  });

  it("guides on AWAITING_USER_FEEDBACK using its own fixture", () => {
    const text = formatSessionStatus(sessionAwaitingUserFeedbackFixture, {});
    expect(text).toContain("waiting on you");
  });

  it("adds no trailing guidance for STATE_UNSPECIFIED", () => {
    const text = formatSessionStatus(
      { ...sessionAwaitingPlanApprovalFixture, state: "STATE_UNSPECIFIED" },
      {}
    );
    expect(text.endsWith("No activities yet - session starting up.")).toBe(true);
  });

  it("returns empty guidance when session.state is missing", () => {
    const text = formatSessionStatus(
      { ...sessionAwaitingPlanApprovalFixture, state: undefined },
      {}
    );
    expect(text.endsWith("No activities yet - session starting up.")).toBe(true);
  });
});

describe("formatSessionOutput", () => {
  it("reports the current state when the session is not yet completed", () => {
    const text = formatSessionOutput(sessionAwaitingPlanApprovalFixture);
    expect(text).toContain("is not yet completed");
    expect(text).toContain("AWAITING_PLAN_APPROVAL");
  });

  it("explains a completed session with no pull request", () => {
    const text = formatSessionOutput(sessionCompletedNoPrFixture);
    expect(text).toContain("no pull request was created");
  });

  it("renders full pull request details for a completed session", () => {
    const text = formatSessionOutput(sessionCompletedFixture);
    expect(text).toContain("Pull Request:");
    expect(text).toContain("Number: #42");
    expect(text).toContain("Adds coverage for login/logout/token refresh.");
  });

  it("finds and renders full pull request details when PR is at a non-zero index", () => {
    const text = formatSessionOutput(sessionCompletedWithMultipleOutputsFixture);
    expect(text).toContain("Pull Request:");
    expect(text).toContain("Number: #18");
    expect(text).toContain("Review comments and fixes.");
  });

  it("renders both the pull request and the changeSet when a session's outputs contain both", () => {
    const text = formatSessionOutput(sessionCompletedWithMultipleOutputsFixture);
    expect(text).toContain("Pull Request:");
    expect(text).toContain("Number: #18");
    expect(text).toContain("Review comments and fixes.");
    expect(text).toContain("Code Change:");
    expect(text).toContain("Source: sources/github/acme/widget-app");
    expect(text).toContain(
      "Suggested commit message: Code Review: PR 17 (fix/encode-path-segments)"
    );
    expect(text).toContain("Diff:\n    diff --git a/foo b/foo");
  });

  it("renders code change details when only changeSet is present in outputs", () => {
    const sessionWithChangeSet = {
      id: "7777777777",
      title: "Jules Code Review",
      prompt: "Review the code change",
      state: "COMPLETED" as const,
      outputs: [
        {
          changeSet: {
            source: "sources/github/acme/widget-app",
            gitPatch: {
              suggestedCommitMessage: "Fix path segmentation",
              unidiffPatch:
                "diff --git a/foo b/foo\n--- a/foo\n+++ b/foo\n@@ -1,3 +1,3 @@\n-old\n+new",
            },
          },
        },
      ],
    };
    const text = formatSessionOutput(sessionWithChangeSet);
    expect(text).toContain("Code Change:");
    expect(text).toContain("Source: sources/github/acme/widget-app");
    expect(text).toContain("Suggested commit message: Fix path segmentation");
    expect(text).toContain("Touched files:\n    - foo");
    expect(text).toContain("Diff:\n    diff --git a/foo b/foo");
  });

  it("truncates the diff when it exceeds the character budget", () => {
    const sessionWithHugeDiff = {
      id: "8888888888",
      title: "Jules Large Patch",
      prompt: "Generate a large patch",
      state: "COMPLETED" as const,
      outputs: [
        {
          changeSet: {
            source: "sources/github/acme/widget-app",
            gitPatch: {
              suggestedCommitMessage: "Fix lots of things",
              unidiffPatch: "diff --git a/foo b/foo\n--- a/foo\n+++ b/foo\n" + "x".repeat(3000),
            },
          },
        },
      ],
    };
    const text = formatSessionOutput(sessionWithHugeDiff);
    expect(text).toContain("Code Change:");
    expect(text).toContain("chars omitted");
    expect(text).toContain("re-requesting this activity will not recover it");
  });
});

describe("formatWaitResolution and formatWaitTimeout", () => {
  it("formats completed state with PR details and activities", () => {
    const text = formatWaitResolution(sessionCompletedFixture, activityListFixture);
    expect(text).toContain("Session Wait Resolved!");
    expect(text).toContain("Final State: COMPLETED");
    expect(text).toContain("Session completed successfully.");
    expect(text).toContain("Pull Request(s) Created:");
    expect(text).toContain("Recent Activities (7):");
  });

  it("formats completed state with PR without a number and with empty activities", () => {
    const sessionWithNoPrNumber = {
      ...sessionCompletedFixture,
      outputs: [
        {
          pullRequest: {
            url: "https://github.com/acme/widget-app/pull/42",
            title: "Add auth module unit tests",
          },
        },
      ],
    };
    const text = formatWaitResolution(sessionWithNoPrNumber, {});
    expect(text).toContain("Session Wait Resolved!");
    expect(text).not.toContain("Number:");
    expect(text).not.toContain("Recent Activities");
  });

  it("formats completed state with activity missing originator", () => {
    const activitiesWithNoOriginator = {
      activities: [
        {
          name: "sessions/123/activities/a1",
          description: "Something happened",
        },
      ],
    };
    const text = formatWaitResolution(sessionCompletedFixture, activitiesWithNoOriginator);
    expect(text).toContain("[unknown]");
  });

  it("formats session output missing pull request description", () => {
    const sessionNoPrDesc = {
      ...sessionCompletedFixture,
      outputs: [
        {
          pullRequest: {
            url: "https://github.com/acme/widget-app/pull/42",
            title: "Add auth module unit tests",
          },
        },
      ],
    };
    const text = formatSessionOutput(sessionNoPrDesc);
    expect(text).not.toContain("Description:");
  });

  it("formats session status with activity missing originator", () => {
    const activitiesWithNoOriginator = {
      activities: [
        {
          name: "sessions/123/activities/a1",
          description: "Something happened",
        },
      ],
    };
    const text = formatSessionStatus(sessionCompletedFixture, activitiesWithNoOriginator);
    expect(text).toContain("[unknown]");
  });

  it("formats failed state with reason", () => {
    const failedActivities = {
      activities: [
        {
          name: "sessions/123/activities/a1",
          sessionFailed: { reason: "Cloud VM out of memory" },
        },
      ],
    };
    const text = formatWaitResolution(
      { ...sessionCompletedFixture, state: "FAILED" as const },
      failedActivities
    );
    expect(text).toContain("Final State: FAILED");
    expect(text).toContain("Session failed. Reason: Cloud VM out of memory");
  });

  it("formats failed state with empty activities and empty outputs", () => {
    const text = formatWaitResolution(
      { ...sessionCompletedFixture, outputs: [], state: "FAILED" as const },
      {}
    );
    expect(text).toContain("Final State: FAILED");
    expect(text).not.toContain("Pull Request");
    expect(text).not.toContain("Recent Activities");
  });

  it("formats other states like awaiting approval, user feedback, paused, default", () => {
    const states = [
      "AWAITING_PLAN_APPROVAL",
      "AWAITING_USER_FEEDBACK",
      "PAUSED",
      "QUEUED",
      undefined,
    ] as const;
    for (const state of states) {
      const text = formatWaitResolution({ ...sessionCompletedFixture, state }, activityListFixture);
      expect(text).toContain(`Final State: ${state}`);
    }
  });

  it("formats timeout details with activities", () => {
    const text = formatWaitTimeout(sessionCompletedFixture, activityListFixture, 60);
    expect(text).toContain("Session Wait Time Limit Reached (60s)!");
    expect(text).toContain("Instruction to LLM Client:");
    expect(text).toContain('Please call "jules_wait_for_session"');
    expect(text).toContain("Recent Activities (7):");
  });

  it("formats timeout details with empty activities", () => {
    const text = formatWaitTimeout(sessionCompletedFixture, {}, 60);
    expect(text).toContain("Session Wait Time Limit Reached (60s)!");
    expect(text).not.toContain("Recent Activities");
  });

  it("formats wait timeout with activities missing originator", () => {
    const activitiesWithNoOriginator = {
      activities: [
        {
          name: "sessions/123/activities/a1",
          description: "Something happened",
        },
      ],
    };
    const text = formatWaitTimeout(sessionCompletedFixture, activitiesWithNoOriginator, 60);
    expect(text).toContain("[unknown]");
  });
});

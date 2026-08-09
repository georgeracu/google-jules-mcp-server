import { describe, expect, it } from "vitest";

import {
  formatSessionCreated,
  formatSessionList,
  formatSessionOutput,
  formatSessionStatus,
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
    expect(text).toContain("1. Code Review: PR 17 (fix/encode-path-segments)");
    expect(text).toContain("PR: https://github.com/acme/widget-app/pull/18");
    expect(text).toContain(`pageToken: ${sessionListFixture.nextPageToken}`);
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
});

import { describe, expect, it } from "vitest";

import {
  formatActivityDetail,
  formatActivityList,
  formatActivitySummary,
} from "../../../src/resources/activities/format.js";
import {
  activityAgentMessagedFixture,
  activityArtifactsFixture,
  activityListFixture,
  activityNoVariantFixture,
  activityPlanApprovedFixture,
  activityPlanGeneratedFixture,
  activityProgressUpdatedFixture,
  activitySessionCompletedFixture,
  activitySessionFailedFixture,
  activityUserMessagedFixture,
} from "../../fixtures/activities.js";

describe("formatActivitySummary", () => {
  it.each([
    [activityPlanGeneratedFixture, "Generated execution plan with 1 steps"],
    [activityPlanApprovedFixture, "Plan approved"],
    [activityAgentMessagedFixture, "Message: Starting work on the plan now."],
    [activityUserMessagedFixture, "Received: Also add integration tests please."],
    [activityProgressUpdatedFixture, "Progress update: Running test suite"],
    [activitySessionCompletedFixture, "Session completed successfully"],
    [activitySessionFailedFixture, "Session failed: Build failed: missing dependency 'left-pad'."],
    [activityArtifactsFixture, "Produced 3 artifact(s)"],
    [activityNoVariantFixture, "Activity occurred"],
  ])("renders %#", (activity, expected) => {
    expect(formatActivitySummary(activity)).toBe(expected);
  });

  it("truncates long messages at 100 characters", () => {
    const longMessage = "x".repeat(150);
    const text = formatActivitySummary({
      name: "a",
      agentMessaged: { agentMessage: longMessage },
    });
    expect(text).toBe(`Message: ${"x".repeat(100)}...`);
  });
});

describe("formatActivityDetail", () => {
  it("renders every plan step with its description", () => {
    const text = formatActivityDetail(activityPlanGeneratedFixture);
    expect(text).toContain("[agent]");
    expect(text).toContain("Generated execution plan:");
    expect(text).toContain("1. Enhance Focus Visibility (A11y)");
    expect(text).toContain("Update focus-visible outlines to high contrast.");
  });

  it("renders sessionFailed with reason", () => {
    expect(formatActivityDetail(activitySessionFailedFixture)).toContain(
      "Reason: Build failed: missing dependency 'left-pad'."
    );
  });

  it("renders every artifact kind", () => {
    const text = formatActivityDetail(activityArtifactsFixture);
    expect(text).toContain("Code change on sources/github/acme/widget-app");
    expect(text).toContain("Bash: pnpm test");
    expect(text).toContain("Media (image/png)");
  });

  it("falls back to 'Activity occurred' when no variant is present", () => {
    expect(formatActivityDetail(activityNoVariantFixture)).toContain("Activity occurred");
  });

  it("renders planApproved", () => {
    expect(formatActivityDetail(activityPlanApprovedFixture)).toContain("Plan approved");
  });

  it("renders agentMessaged", () => {
    expect(formatActivityDetail(activityAgentMessagedFixture)).toContain(
      "Message sent: Starting work on the plan now."
    );
  });

  it("renders userMessaged", () => {
    expect(formatActivityDetail(activityUserMessagedFixture)).toContain(
      "Message received: Also add integration tests please."
    );
  });

  it("renders progressUpdated with title and description", () => {
    const text = formatActivityDetail(activityProgressUpdatedFixture);
    expect(text).toContain("Progress update: Running test suite");
    expect(text).toContain("42 of 100 tests passed so far.");
  });

  it("renders progressUpdated with neither title nor description", () => {
    const text = formatActivityDetail({ name: "a", progressUpdated: {} });
    expect(text).toContain("Progress update");
  });

  it("renders sessionCompleted", () => {
    expect(formatActivityDetail(activitySessionCompletedFixture)).toContain(
      "Session completed successfully"
    );
  });

  it("renders sessionFailed without a reason", () => {
    const text = formatActivityDetail({ name: "a", sessionFailed: {} });
    expect(text).toContain("Session failed");
    expect(text).not.toContain("Reason:");
  });
});

describe("formatActivityList", () => {
  it("renders a helpful message when there are no activities", () => {
    expect(formatActivityList({}, "sess-1")).toContain("The session may be just starting");
  });

  it("numbers every activity and includes the session id and count", () => {
    const text = formatActivityList(activityListFixture, "sess-1");
    expect(text).toContain(
      `Activities for session sess-1 (${activityListFixture.activities.length}):`
    );
    expect(text).toContain("1. [agent]");
    expect(text).toContain("Steps:");
  });

  it("includes the next page token when present", () => {
    const text = formatActivityList(activityListFixture, "sess-1");
    expect(text).toContain(`pageToken: ${activityListFixture.nextPageToken}`);
  });

  it("never falls through to the generic fallback for a known variant", () => {
    const text = formatActivityList(activityListFixture, "sess-1");
    expect(text).not.toContain("Activity occurred");
  });

  it("falls back to 'Activity occurred' for an activity with no known variant", () => {
    const text = formatActivityList({ activities: [activityNoVariantFixture] }, "sess-1");
    expect(text).toContain("Activity occurred");
  });

  it("omits the Reason line when sessionFailed has no reason", () => {
    const text = formatActivityList({ activities: [{ name: "a", sessionFailed: {} }] }, "sess-1");
    expect(text).toContain("Session failed");
    expect(text).not.toContain("Reason:");
  });
});

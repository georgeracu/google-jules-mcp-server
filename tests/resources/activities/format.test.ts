import { describe, expect, it } from "vitest";

import {
  formatActivityDetail,
  formatActivityList,
  formatActivitySummary,
} from "../../../src/resources/activities/format.js";
import {
  activityAgentMessagedFixture,
  activityArtifactsFixture,
  activityDescriptionOnlyFixture,
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

  it("falls back to the activity's own description when no known variant is present", () => {
    expect(formatActivitySummary(activityDescriptionOnlyFixture)).toBe(
      "Cloned repository and installed dependencies."
    );
  });

  it("caps the whole line at 100 characters, label included", () => {
    const text = formatActivitySummary({
      name: "a",
      agentMessaged: { agentMessage: "x".repeat(150) },
    });
    expect(text).toBe(`Message: ${"x".repeat(91)}...`);
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

  it("labels an artifact of no recognised kind", () => {
    expect(formatActivityDetail({ name: "a", artifacts: [{}] })).toContain("Unknown artifact");
  });

  it("falls back to the activity's own description when no known variant is present", () => {
    expect(formatActivityDetail(activityDescriptionOnlyFixture)).toContain(
      "Cloned repository and installed dependencies."
    );
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

  it("renders the Reason line when sessionFailed has one", () => {
    const text = formatActivityList({ activities: [activitySessionFailedFixture] }, "sess-1");
    expect(text).toContain("Reason: Build failed: missing dependency 'left-pad'.");
  });
});

describe("output caps", () => {
  const longText = (length: number) => "x".repeat(length);
  const listOne = (variant: object, sessionId = "sess-1") =>
    formatActivityList(
      { activities: [{ name: "sessions/s1/activities/a1", ...variant }] },
      sessionId
    );

  it.each([
    ["agentMessaged", { agentMessaged: { agentMessage: longText(5000) } }],
    ["userMessaged", { userMessaged: { userMessage: longText(5000) } }],
    ["progressUpdated title", { progressUpdated: { title: longText(5000) } }],
    ["sessionFailed reason", { sessionFailed: { reason: longText(5000) } }],
    ["description fallback", { description: longText(5000) }],
  ])("caps the %s summary line, which jules_get_status renders unbudgeted", (_label, variant) => {
    expect(formatActivitySummary({ name: "a", ...variant }).length).toBeLessThanOrEqual(103);
  });

  it("caps a long list entry and names both arguments jules_get_activity needs", () => {
    const text = listOne({ agentMessaged: { agentMessage: longText(5000) } });
    expect(text).toContain(
      'use jules_get_activity with sessionId "sess-1" and activityId "a1" for the full entry'
    );
    expect(text).not.toContain(longText(801));
  });

  it("bounds an entry whose size comes from the number of plan steps, not one long field", () => {
    const steps = Array.from({ length: 400 }, (_, i) => ({
      title: `step ${i}`,
      description: `does the ${i}th thing`,
    }));
    const text = listOne({ planGenerated: { plan: { steps } } });
    expect(text.length).toBeLessThan(1200);
    expect(text).toContain("use jules_get_activity");
  });

  it("bounds an entry with a large number of artifacts", () => {
    const artifacts = Array.from({ length: 400 }, (_, i) => ({
      bashOutput: { command: `run step ${i}` },
    }));
    expect(listOne({ artifacts }).length).toBeLessThan(1200);
  });

  it("prefers the activity's own id over the segment parsed out of its name", () => {
    const text = formatActivityList(
      {
        activities: [
          {
            name: "sessions/s1/activities/from-name",
            id: "from-id",
            agentMessaged: { agentMessage: longText(5000) },
          },
        ],
      },
      "sess-1"
    );
    expect(text).toContain('activityId "from-id"');
    expect(text).not.toContain("from-name");
  });

  it("leaves an entry inside the slack window whole rather than inflating it with a hint", () => {
    const text = listOne({ agentMessaged: { agentMessage: longText(900) } });
    expect(text).toContain(longText(900));
    expect(text).not.toContain("use jules_get_activity");
  });

  it("caps an entry once past the slack window", () => {
    expect(listOne({ agentMessaged: { agentMessage: longText(1000) } })).toContain(
      "use jules_get_activity"
    );
  });

  it("caps the detail path, including a plan carrying hundreds of steps", () => {
    const steps = Array.from({ length: 2000 }, (_, i) => ({ title: `step ${i}` }));
    const text = formatActivityDetail({
      name: "sessions/s1/activities/a1",
      planGenerated: { plan: { steps } },
    });
    expect(text.length).toBeLessThanOrEqual(8003);
    expect(text.endsWith("...")).toBe(true);
  });

  it("leaves detail text just under the cap untouched", () => {
    const text = formatActivityDetail({
      name: "sessions/s1/activities/a1",
      agentMessaged: { agentMessage: longText(7000) },
    });
    expect(text).toContain(longText(7000));
    expect(text.endsWith("...")).toBe(false);
  });

  it("stops rendering entries once the page budget is spent", () => {
    const activities = Array.from({ length: 40 }, (_, i) => ({
      name: `sessions/s1/activities/a${i}`,
      agentMessaged: { agentMessage: longText(5000) },
    }));

    const text = formatActivityList({ activities, nextPageToken: "tok" }, "sess-1");
    const shown = /Showing (\d+) of 40 activities/.exec(text);

    expect(Number(shown?.[1])).toBeGreaterThan(0);
    expect(Number(shown?.[1])).toBeLessThan(40);
    expect(text.length).toBeLessThan(11_000);
  });

  it("warns that the page token skips the entries it did not show", () => {
    const activities = Array.from({ length: 40 }, (_, i) => ({
      name: `sessions/s1/activities/a${i}`,
      agentMessaged: { agentMessage: longText(5000) },
    }));
    const text = formatActivityList({ activities, nextPageToken: "tok" }, "sess-1");
    expect(text).toContain("pageToken skips past all 40");
  });

  it("says nothing about capping when everything fits", () => {
    const text = formatActivityList(activityListFixture, "sess-1");
    expect(text).not.toContain("Showing");
    expect(text).not.toContain("use jules_get_activity");
  });
});

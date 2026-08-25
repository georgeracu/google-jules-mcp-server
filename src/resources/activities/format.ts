import type { Activity, ActivityList } from "./schemas.js";

export function getTouchedFiles(patch: string): string[] {
  const files = new Set<string>();
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (match) {
        files.add(match[1]);
        files.add(match[2]);
      }
    }
    if (line.startsWith("--- ")) {
      const file = line.slice(4).split("\t")[0].trim().replace(/^a\//, "");
      if (file && file !== "/dev/null") files.add(file);
    }
    if (line.startsWith("+++ ")) {
      const file = line.slice(4).split("\t")[0].trim().replace(/^b\//, "");
      if (file && file !== "/dev/null") files.add(file);
    }
  }
  return Array.from(files);
}

const SUMMARY_CHAR_BUDGET = 100;
const LIST_ITEM_CHAR_BUDGET = 800;
const LIST_PAGE_CHAR_BUDGET = 10_000;
const DETAIL_CHAR_BUDGET = 8_000;
const CHANGE_SET_DIFF_CHAR_BUDGET = 2_000;
const UNKNOWN_ACTIVITY_TEXT = "Activity occurred";

function formatOmittedNote(omitted: number): string {
  return (
    `[+${omitted} chars omitted - this is the largest rendering available and no tool ` +
    `returns the remainder, so re-requesting this activity will not recover it]`
  );
}

export function formatChangeSet(
  changeSet: NonNullable<NonNullable<Activity["artifacts"]>[number]["changeSet"]>,
  indent = ""
): string {
  let res = "";
  if (changeSet.source) {
    res += `${indent}Source: ${changeSet.source}\n`;
  }
  const patch = changeSet.gitPatch;
  if (patch) {
    if (patch.suggestedCommitMessage) {
      res += `${indent}Suggested commit message: ${patch.suggestedCommitMessage}\n`;
    }
    if (patch.unidiffPatch) {
      const touchedFiles = getTouchedFiles(patch.unidiffPatch);
      if (touchedFiles.length > 0) {
        res += `${indent}Touched files:\n`;
        for (const file of touchedFiles) {
          res += `${indent}  - ${file}\n`;
        }
      }
      res += `${indent}Diff:\n`;
      let diffText = patch.unidiffPatch;
      if (diffText.length > CHANGE_SET_DIFF_CHAR_BUDGET) {
        const omitted = diffText.length - CHANGE_SET_DIFF_CHAR_BUDGET;
        diffText =
          diffText.slice(0, CHANGE_SET_DIFF_CHAR_BUDGET) + `...\n${formatOmittedNote(omitted)}`;
      }
      const indentedDiff = diffText
        .split("\n")
        .map((line) => (line ? `${indent}  ${line}` : ""))
        .join("\n");
      res += indentedDiff + "\n";
    }
  }
  return res;
}

function activityRef(activity: Activity): string {
  const segments = activity.name.split("/");
  return activity.id ?? segments[segments.length - 1];
}

function formatArtifactBullet(
  artifact: NonNullable<Activity["artifacts"]>[number],
  indent = ""
): string {
  if (artifact.changeSet) {
    const formatted = formatChangeSet(artifact.changeSet, indent + "  ");
    return `- Code change on ${artifact.changeSet.source ?? "unknown source"}:\n${formatted.trimEnd()}`;
  }
  if (artifact.bashOutput) return `- Bash: ${artifact.bashOutput.command ?? "unknown command"}`;
  if (artifact.media) return `- Media (${artifact.media.mimeType ?? "unknown type"})`;
  return "- Unknown artifact";
}

/** Shared by formatActivityDetail (indent "") and formatActivityListItem (indent "   "). */
function formatPlanSteps(
  steps: NonNullable<NonNullable<Activity["planGenerated"]>["plan"]>["steps"],
  indent: string
): string {
  return (steps ?? [])
    .map(
      (step, i) =>
        `${indent}${i + 1}. ${step.title}\n` +
        (step.description ? `${indent}   ${step.description}\n` : "")
    )
    .join("");
}

/** Shared by formatActivityDetail (indent "") and formatActivityListItem (indent "   "). */
function formatArtifactBullets(
  artifacts: NonNullable<Activity["artifacts"]>,
  indent: string
): string {
  return artifacts.map((a) => `${indent}${formatArtifactBullet(a, indent)}\n`).join("");
}

function summaryText(activity: Activity): string {
  if (activity.planGenerated) {
    const steps = activity.planGenerated.plan?.steps?.length ?? 0;
    return `Generated execution plan with ${steps} steps`;
  }
  if (activity.planApproved) return "Plan approved";
  if (activity.agentMessaged) return `Message: ${activity.agentMessaged.agentMessage}`;
  if (activity.userMessaged) return `Received: ${activity.userMessaged.userMessage}`;
  if (activity.progressUpdated) {
    return `Progress update${activity.progressUpdated.title ? `: ${activity.progressUpdated.title}` : ""}`;
  }
  if (activity.sessionCompleted) return "Session completed successfully";
  if (activity.sessionFailed)
    return `Session failed: ${activity.sessionFailed.reason ?? "unknown error"}`;
  if (activity.artifacts?.length) return `Produced ${activity.artifacts.length} artifact(s)`;
  return activity.description ?? UNKNOWN_ACTIVITY_TEXT;
}

/**
 * Single-line variant summary used in jules_get_status's recent-activity digest.
 * jules_get_status renders one of these per activity with no budget of its own,
 * so the cap applies to the whole line rather than to individual fields.
 */
export function formatActivitySummary(activity: Activity): string {
  const text = summaryText(activity);
  return text.length > SUMMARY_CHAR_BUDGET ? `${text.slice(0, SUMMARY_CHAR_BUDGET)}...` : text;
}

function detailText(activity: Activity): string {
  const header = `[${activity.originator ?? "unknown"}] ${activity.createTime ?? "no timestamp"}\n\n`;

  if (activity.planGenerated) {
    const stepLines = formatPlanSteps(activity.planGenerated.plan?.steps, "");
    return `${header}Generated execution plan:\n${stepLines}`;
  }
  if (activity.planApproved) return `${header}Plan approved`;
  if (activity.agentMessaged)
    return `${header}Message sent: ${activity.agentMessaged.agentMessage}`;
  if (activity.userMessaged)
    return `${header}Message received: ${activity.userMessaged.userMessage}`;
  if (activity.progressUpdated) {
    const title = activity.progressUpdated.title ? `: ${activity.progressUpdated.title}` : "";
    const description = activity.progressUpdated.description
      ? `\n${activity.progressUpdated.description}`
      : "";
    return `${header}Progress update${title}${description}`;
  }
  if (activity.sessionCompleted) return `${header}Session completed successfully`;
  if (activity.sessionFailed) {
    const reason = activity.sessionFailed.reason
      ? `\nReason: ${activity.sessionFailed.reason}`
      : "";
    return `${header}Session failed${reason}`;
  }
  if (activity.artifacts?.length) {
    const bullets = formatArtifactBullets(activity.artifacts, "");
    return `${header}Produced ${activity.artifacts.length} artifact(s):\n${bullets}`;
  }
  return `${header}${activity.description ?? UNKNOWN_ACTIVITY_TEXT}`;
}

/**
 * Full multi-line rendering of one activity, used standalone by jules_get_activity.
 * This is the escape hatch the list path points at, so it gets the largest budget —
 * capped all the same, since a plan can carry hundreds of steps. There is nothing
 * past this cap to page to, so a cut here says so outright: without that, an
 * assistant sent here by the list hint would keep re-requesting an activity whose
 * remainder no tool can return.
 */
export function formatActivityDetail(activity: Activity): string {
  const text = detailText(activity);
  if (text.length <= DETAIL_CHAR_BUDGET) return text;

  const omitted = text.length - DETAIL_CHAR_BUDGET;
  return (
    `${text.slice(0, DETAIL_CHAR_BUDGET)}...\n` +
    `[+${omitted} chars omitted - this is the largest rendering available and no tool ` +
    `returns the remainder, so re-requesting this activity will not recover it]\n`
  );
}

function listItemText(activity: Activity, index: number): string {
  const originator = activity.originator ?? "unknown";
  const createTime = activity.createTime ?? "no timestamp";
  let body = `${index + 1}. [${originator}] ${createTime}\n`;

  if (activity.planGenerated) {
    const steps = activity.planGenerated.plan?.steps ?? [];
    body += "   Generated execution plan:\n";
    if (steps.length > 0) {
      body += "   Steps:\n";
      body += formatPlanSteps(steps, "   ");
    }
  } else if (activity.planApproved) {
    body += "   Plan approved\n";
  } else if (activity.agentMessaged) {
    body += `   Message sent: ${activity.agentMessaged.agentMessage}\n`;
  } else if (activity.userMessaged) {
    body += `   Message received: ${activity.userMessaged.userMessage}\n`;
  } else if (activity.progressUpdated) {
    body += "   Progress update";
    if (activity.progressUpdated.title) body += `: ${activity.progressUpdated.title}`;
    body += "\n";
    if (activity.progressUpdated.description)
      body += `   ${activity.progressUpdated.description}\n`;
  } else if (activity.sessionCompleted) {
    body += "   Session completed successfully\n";
  } else if (activity.sessionFailed) {
    body += "   Session failed\n";
    if (activity.sessionFailed.reason) body += `   Reason: ${activity.sessionFailed.reason}\n`;
  } else if (activity.artifacts?.length) {
    body += `   Produced ${activity.artifacts.length} artifact(s):\n`;
    body += formatArtifactBullets(activity.artifacts, "   ");
  } else {
    body += `   ${activity.description ?? UNKNOWN_ACTIVITY_TEXT}\n`;
  }

  return body;
}

/**
 * Caps one rendered entry rather than each field inside it, which bounds every
 * field transitively — including collections like plan steps, where a per-field
 * cap leaves the count unbounded. The hint is in-band and actionable: it names
 * the arguments jules_get_activity needs to return this entry under its own,
 * much larger budget.
 */
function formatActivityListItem(activity: Activity, index: number, sessionId: string): string {
  const body = listItemText(activity, index);
  if (body.length <= LIST_ITEM_CHAR_BUDGET) return body;

  const omitted = body.length - LIST_ITEM_CHAR_BUDGET;
  return (
    `${body.slice(0, LIST_ITEM_CHAR_BUDGET)}...\n` +
    `   [+${omitted} chars - use jules_get_activity with sessionId "${sessionId}" ` +
    `and activityId "${activityRef(activity)}" for the expanded entry]\n`
  );
}

export function formatActivityList(data: ActivityList, sessionId: string): string {
  if (!data.activities || data.activities.length === 0) {
    return "No activities found for this session. The session may be just starting.";
  }

  const total = data.activities.length;
  const items: string[] = [];
  let used = 0;
  for (const [index, activity] of data.activities.entries()) {
    const item = `${formatActivityListItem(activity, index, sessionId)}\n`;
    if (used + item.length > LIST_PAGE_CHAR_BUDGET) break;
    items.push(item);
    used += item.length;
  }

  let text = `Activities for session ${sessionId} (${total}):\n\n`;
  text += items.join("");

  if (items.length < total) {
    text +=
      `Showing ${items.length} of ${total} activities - output capped. ` +
      `Re-run with a smaller limit to see the rest; pageToken skips past all ${total}.\n`;
  }
  if (data.nextPageToken) {
    text += `More activities available. Use pageToken: ${data.nextPageToken}\n`;
  }
  return text;
}

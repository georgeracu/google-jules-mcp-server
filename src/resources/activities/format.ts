import type { Activity, ActivityList } from "./schemas.js";

const SUMMARY_TRUNCATE_LENGTH = 100;

function truncate(text: string): string {
  return text.length > SUMMARY_TRUNCATE_LENGTH
    ? `${text.slice(0, SUMMARY_TRUNCATE_LENGTH)}...`
    : text;
}

function formatArtifactBullet(artifact: NonNullable<Activity["artifacts"]>[number]): string {
  if (artifact.changeSet)
    return `- Code change on ${artifact.changeSet.source ?? "unknown source"}`;
  if (artifact.bashOutput) return `- Bash: ${artifact.bashOutput.command ?? "unknown command"}`;
  if (artifact.media) return `- Media (${artifact.media.mimeType ?? "unknown type"})`;
  return "- Unknown artifact";
}

/** Single-line variant summary used in jules_get_status's recent-activity digest. */
export function formatActivitySummary(activity: Activity): string {
  if (activity.planGenerated) {
    const steps = activity.planGenerated.plan?.steps?.length ?? 0;
    return `Generated execution plan with ${steps} steps`;
  }
  if (activity.planApproved) return "Plan approved";
  if (activity.agentMessaged) return `Message: ${truncate(activity.agentMessaged.agentMessage)}`;
  if (activity.userMessaged) return `Received: ${truncate(activity.userMessaged.userMessage)}`;
  if (activity.progressUpdated) {
    return `Progress update${activity.progressUpdated.title ? `: ${activity.progressUpdated.title}` : ""}`;
  }
  if (activity.sessionCompleted) return "Session completed successfully";
  if (activity.sessionFailed)
    return `Session failed: ${activity.sessionFailed.reason ?? "unknown error"}`;
  if (activity.artifacts?.length) return `Produced ${activity.artifacts.length} artifact(s)`;
  return "Activity occurred";
}

/** Full multi-line rendering of one activity, used standalone by jules_get_activity. */
export function formatActivityDetail(activity: Activity): string {
  const header = `[${activity.originator ?? "unknown"}] ${activity.createTime ?? "no timestamp"}\n\n`;

  if (activity.planGenerated) {
    const steps = activity.planGenerated.plan?.steps ?? [];
    const stepLines = steps
      .map(
        (step, i) =>
          `${i + 1}. ${step.title}\n` + (step.description ? `   ${step.description}\n` : "")
      )
      .join("");
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
    const bullets = activity.artifacts.map((a) => `${formatArtifactBullet(a)}\n`).join("");
    return `${header}Produced ${activity.artifacts.length} artifact(s):\n${bullets}`;
  }
  return `${header}Activity occurred`;
}

function formatActivityListItem(activity: Activity, index: number): string {
  const originator = activity.originator ?? "unknown";
  const createTime = activity.createTime ?? "no timestamp";
  let body = `${index + 1}. [${originator}] ${createTime}\n`;

  if (activity.planGenerated) {
    const steps = activity.planGenerated.plan?.steps ?? [];
    body += "   Generated execution plan:\n";
    if (steps.length > 0) {
      body += "   Steps:\n";
      body += steps
        .map(
          (step, i) =>
            `   ${i + 1}. ${step.title}\n` + (step.description ? `      ${step.description}\n` : "")
        )
        .join("");
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
    body += activity.artifacts.map((a) => `   ${formatArtifactBullet(a)}\n`).join("");
  } else {
    body += "   Activity occurred\n";
  }

  return body;
}

export function formatActivityList(data: ActivityList, sessionId: string): string {
  if (!data.activities || data.activities.length === 0) {
    return "No activities found for this session. The session may be just starting.";
  }

  let text = `Activities for session ${sessionId} (${data.activities.length}):\n\n`;
  text += data.activities.map((activity, i) => `${formatActivityListItem(activity, i)}\n`).join("");

  if (data.nextPageToken) {
    text += `More activities available. Use pageToken: ${data.nextPageToken}\n`;
  }
  return text;
}

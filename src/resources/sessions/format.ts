import { formatActivitySummary, formatChangeSet } from "../activities/format.js";
import type { ActivityList } from "../activities/schemas.js";
import type { Session, SessionList } from "./schemas.js";

export function formatSessionList(data: SessionList): string {
  if (!data.sessions || data.sessions.length === 0) {
    return "No sessions found. Create one with jules_create_session.";
  }

  const sessionsList = data.sessions
    .map((session, index) => {
      const prUrl = session.outputs?.find((o) => o.pullRequest)?.pullRequest?.url;
      const prInfo = prUrl ? `\n  PR: ${prUrl}` : "";
      return (
        `${index + 1}. ${session.title ?? "Untitled"}\n` +
        `   ID: ${session.id}\n` +
        `   State: ${session.state}\n` +
        `   Created: ${session.createTime ?? "unknown"}${prInfo}`
      );
    })
    .join("\n\n");

  let response = `Your Jules sessions (${data.sessions.length}):\n\n${sessionsList}`;
  if (data.nextPageToken) {
    response += `\n\nMore results available. Use pageToken: ${data.nextPageToken}`;
  }
  return response;
}

export function formatSessionCreated(
  session: Session,
  params: {
    repoOwner: string;
    repoName: string;
    branch: string;
    autoApprove: boolean;
    autoCreatePR: boolean;
  }
): string {
  const approvalNote = params.autoApprove
    ? ""
    : "\n\nNote: Manual plan approval required. Use jules_list_activities to see the plan, then jules_approve_plan to proceed.";

  return (
    "Session created successfully!\n\n" +
    `Session ID: ${session.id}\n` +
    `Title: ${session.title}\n` +
    `Repository: ${params.repoOwner}/${params.repoName}\n` +
    `Branch: ${params.branch}\n` +
    `State: ${session.state}\n` +
    `Auto-create PR: ${params.autoCreatePR}${approvalNote}\n\n` +
    "Jules is now working asynchronously in an isolated cloud VM.\n" +
    `Use jules_get_status with session ID "${session.id}" to check progress.`
  );
}

function formatStateGuidance(session: Session): string {
  switch (session.state) {
    case "COMPLETED":
      return "\n\nSession complete! Use jules_get_session_output for detailed results.";
    case "FAILED":
      return "\n\nSession failed. Use jules_list_activities to see detailed error information.";
    case "AWAITING_PLAN_APPROVAL":
      return "\n\nSession awaiting plan approval. Use jules_list_activities to see the plan, then jules_approve_plan to proceed.";
    case "AWAITING_USER_FEEDBACK":
      return "\n\nSession is waiting on you. Use jules_list_activities to see what Jules is asking, then jules_send_message to respond.";
    case "PAUSED":
      return "\n\nSession is paused.";
    case "QUEUED":
    case "PLANNING":
    case "IN_PROGRESS":
      return "\n\nSession still running. Poll again in 10-30 seconds for updates.";
    default:
      return "";
  }
}

export function formatSessionStatus(session: Session, activities: ActivityList): string {
  let statusText = `Session: ${session.title ?? "Untitled"}\nState: ${session.state}\nPrompt: ${session.prompt}\n\n`;

  const pr = session.outputs?.find((o) => o.pullRequest)?.pullRequest;
  if (pr) {
    statusText += "Pull Request Created:\n";
    statusText += `  URL: ${pr.url}\n`;
    statusText += `  Title: ${pr.title}\n`;
    if (pr.description) statusText += `  Description: ${pr.description}\n`;
    statusText += "\n";
  }

  if (activities.activities && activities.activities.length > 0) {
    statusText += `Recent Activity (${activities.activities.length}):\n`;
    activities.activities.forEach((activity, index) => {
      const originator = activity.originator ?? "unknown";
      statusText += `\n${index + 1}. [${originator}] ${formatActivitySummary(activity)}`;
    });
  } else {
    statusText += "No activities yet - session starting up.";
  }

  return statusText + formatStateGuidance(session);
}

export function formatSessionOutput(session: Session): string {
  if (session.state !== "COMPLETED") {
    return (
      `Session ${session.id} is not yet completed.\n\n` +
      `Current state: ${session.state}\n\n` +
      "Use jules_get_status to monitor progress until state is COMPLETED."
    );
  }

  const pr = session.outputs?.find((o) => o.pullRequest)?.pullRequest;
  if (pr) {
    return (
      "Session Output:\n\n" +
      `Session: ${session.title}\n` +
      `State: ${session.state}\n\n` +
      "Pull Request:\n" +
      `  URL: ${pr.url}\n` +
      `  Title: ${pr.title}\n` +
      (pr.number ? `  Number: #${pr.number}\n` : "") +
      (pr.description ? `  Description: ${pr.description}\n` : "") +
      "\n" +
      "Visit the PR URL to review changes and merge when ready."
    );
  }

  const changeSet = session.outputs?.find((o) => o.changeSet)?.changeSet;
  if (changeSet) {
    const formattedChangeSet = formatChangeSet(changeSet, "  ");
    return (
      "Session Output:\n\n" +
      `Session: ${session.title}\n` +
      `State: ${session.state}\n\n` +
      "Code Change:\n" +
      formattedChangeSet
    );
  }

  return (
    "Session completed but no pull request was created.\n\n" +
    `Title: ${session.title}\n` +
    `Prompt: ${session.prompt}\n\n` +
    "This may be expected if the task didn't require code changes, " +
    "or if automationMode was not set to AUTO_CREATE_PR."
  );
}

export function formatWaitResolution(session: Session, activities: ActivityList): string {
  let text = `Session Wait Resolved!\n\n`;
  text += `Session ID: ${session.id}\n`;
  text += `Title: ${session.title ?? "Untitled"}\n`;
  text += `Final State: ${session.state}\n`;
  text += `Prompt: ${session.prompt}\n\n`;

  text += "Summary: ";
  switch (session.state) {
    case "COMPLETED":
      text += "Session completed successfully.\n";
      break;
    case "FAILED": {
      const failReason = activities.activities?.find((a) => a.sessionFailed)?.sessionFailed?.reason;
      text += `Session failed.${failReason ? ` Reason: ${failReason}` : ""}\n`;
      break;
    }
    case "AWAITING_PLAN_APPROVAL":
      text += "The execution plan was generated and is awaiting your approval.\n";
      break;
    case "AWAITING_USER_FEEDBACK":
      text += "Jules is waiting for user feedback/input.\n";
      break;
    case "PAUSED":
      text += "The session has been paused.\n";
      break;
    default:
      text += `Session reached state ${session.state}.\n`;
  }

  const prs = session.outputs
    ?.map((o) => o.pullRequest)
    .filter((pr): pr is NonNullable<typeof pr> => !!pr);
  if (prs && prs.length > 0) {
    text += "\nPull Request(s) Created:\n";
    for (const pr of prs) {
      text += `  - URL: ${pr.url}\n`;
      text += `    Title: ${pr.title}\n`;
      if (pr.number) text += `    Number: #${pr.number}\n`;
    }
  }

  if (activities.activities && activities.activities.length > 0) {
    text += `\nRecent Activities (${activities.activities.length}):\n`;
    activities.activities.forEach((activity, index) => {
      const originator = activity.originator ?? "unknown";
      text += `  ${index + 1}. [${originator}] ${formatActivitySummary(activity)}\n`;
    });
  }

  return text + formatStateGuidance(session);
}

export function formatWaitTimeout(
  session: Session,
  activities: ActivityList,
  maxWaitSeconds: number
): string {
  let text = `Session Wait Time Limit Reached (${maxWaitSeconds}s)!\n\n`;
  text += `Session ID: ${session.id}\n`;
  text += `Current State: ${session.state}\n`;
  text += `Title: ${session.title ?? "Untitled"}\n\n`;

  text += `Instruction to LLM Client:\n`;
  text += `The session did not reach a terminal state within the wait limit of ${maxWaitSeconds} seconds. `;
  text += "However, Jules is still running asynchronously and no progress or work has been lost.\n";
  text += `Please call "jules_wait_for_session" with sessionId "${session.id}" to resume polling and wait for completion.\n\n`;

  if (activities.activities && activities.activities.length > 0) {
    text += `Recent Activities (${activities.activities.length}):\n`;
    activities.activities.forEach((activity, index) => {
      const originator = activity.originator ?? "unknown";
      text += `  ${index + 1}. [${originator}] ${formatActivitySummary(activity)}\n`;
    });
  }

  return text;
}

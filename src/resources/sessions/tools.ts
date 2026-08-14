import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ActivitiesClient } from "../activities/client.js";
import { formatErrorForUser } from "../../core/errors.js";
import { errorResult, textResult, type ToolResult } from "../../core/tool-result.js";
import { PageParams } from "../../shared/pagination.js";
import type { SessionsClient } from "./client.js";
import {
  formatSessionCreated,
  formatSessionList,
  formatSessionOutput,
  formatSessionStatus,
  formatWaitResolution,
  formatWaitTimeout,
} from "./format.js";
import {
  CreateSessionRequestSchema,
  TERMINAL_SESSION_STATES,
  type CreateSessionRequest,
} from "./schemas.js";

function buildCreateSessionRequest(params: {
  repoOwner: string;
  repoName: string;
  prompt: string;
  branch: string;
  autoApprove: boolean;
  autoCreatePR: boolean;
  title?: string;
}): CreateSessionRequest {
  return CreateSessionRequestSchema.parse({
    prompt: params.prompt,
    sourceContext: {
      source: `sources/github/${params.repoOwner}/${params.repoName}`,
      githubRepoContext: { startingBranch: params.branch },
    },
    title: params.title || `${params.repoName}: ${params.prompt.slice(0, 50)}`,
    requirePlanApproval: !params.autoApprove,
    ...(params.autoCreatePR ? { automationMode: "AUTO_CREATE_PR" as const } : {}),
  });
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const CREATE_SESSION_ERROR_HINTS =
  "Common issues:\n- Repository not connected to Jules (run jules_list_sources)\n- Invalid repository owner/name\n- Branch does not exist";

interface WaitExtra {
  signal?: AbortSignal;
  _meta?: {
    progressToken?: string | number;
  };
  sendNotification?: (notification: {
    method: "notifications/progress";
    params: {
      progressToken: string | number;
      progress: number;
      total: number;
      message: string;
    };
  }) => Promise<void>;
}

export function createSessionHandlers(sessions: SessionsClient, activities: ActivitiesClient) {
  const pollSession = async (
    sessionId: string,
    maxWaitSeconds: number,
    includeActivities: number,
    extra?: WaitExtra
  ): Promise<ToolResult> => {
    const start = Date.now();
    const pollIntervalMs = 5000;
    const maxWaitMs = maxWaitSeconds * 1000;

    while (true) {
      if (extra?.signal?.aborted) {
        try {
          const session = await sessions.getSession(sessionId);
          return textResult(
            `Wait operation was cancelled. Current session state: ${session.state}`
          );
        } catch (error) {
          return errorResult(`Error getting session status: ${formatErrorForUser(error)}`);
        }
      }

      let session;
      try {
        session = await sessions.getSession(sessionId);
      } catch (error) {
        return errorResult(`Error getting session status: ${formatErrorForUser(error)}`);
      }

      const isTerminal = TERMINAL_SESSION_STATES.includes(session.state);

      const elapsedMs = Date.now() - start;
      const isTimeout = elapsedMs >= maxWaitMs;

      if (isTerminal || isTimeout) {
        try {
          const activityList = await activities.listActivities(sessionId, {
            pageSize: includeActivities,
          });
          if (isTerminal) {
            return textResult(formatWaitResolution(session, activityList));
          } else {
            return textResult(formatWaitTimeout(session, activityList, maxWaitSeconds));
          }
        } catch (error) {
          return errorResult(`Error fetching activities: ${formatErrorForUser(error)}`);
        }
      }

      if (extra?._meta?.progressToken !== undefined && extra.sendNotification !== undefined) {
        try {
          await extra.sendNotification({
            method: "notifications/progress",
            params: {
              progressToken: extra._meta.progressToken,
              progress: Math.floor(elapsedMs / 1000),
              total: maxWaitSeconds,
              message: `Session "${sessionId}" is in state: ${session.state}. Waiting for completion... (Elapsed: ${Math.floor(elapsedMs / 1000)}s / ${maxWaitSeconds}s)`,
            },
          });
        } catch {
          // Best-effort: a dropped progress notification shouldn't abort an otherwise-healthy poll loop
        }
      }

      const remainingMs = maxWaitMs - (Date.now() - start);
      const sleepMs = Math.max(0, Math.min(pollIntervalMs, remainingMs));
      await abortableSleep(sleepMs, extra?.signal);
    }
  };

  return {
    createSession: async ({
      repoOwner,
      repoName,
      prompt,
      branch,
      autoApprove,
      autoCreatePR,
      title,
    }: {
      repoOwner: string;
      repoName: string;
      prompt: string;
      branch: string;
      autoApprove: boolean;
      autoCreatePR: boolean;
      title?: string;
    }): Promise<ToolResult> => {
      try {
        const request = buildCreateSessionRequest({
          repoOwner,
          repoName,
          prompt,
          branch,
          autoApprove,
          autoCreatePR,
          title,
        });

        const session = await sessions.createSession(request);
        return textResult(
          formatSessionCreated(session, { repoOwner, repoName, branch, autoApprove, autoCreatePR })
        );
      } catch (error) {
        return errorResult(
          `Error creating session: ${formatErrorForUser(error)}\n\n${CREATE_SESSION_ERROR_HINTS}`
        );
      }
    },

    waitForSession: async (
      {
        sessionId,
        maxWaitSeconds,
        includeActivities,
      }: {
        sessionId: string;
        maxWaitSeconds: number;
        includeActivities: number;
      },
      extra?: WaitExtra
    ): Promise<ToolResult> => {
      return pollSession(sessionId, maxWaitSeconds, includeActivities, extra);
    },

    executeAndWait: async (
      {
        repoOwner,
        repoName,
        prompt,
        branch,
        autoApprove,
        autoCreatePR,
        title,
        maxWaitSeconds,
        includeActivities,
      }: {
        repoOwner: string;
        repoName: string;
        prompt: string;
        branch: string;
        autoApprove: boolean;
        autoCreatePR: boolean;
        title?: string;
        maxWaitSeconds: number;
        includeActivities: number;
      },
      extra?: WaitExtra
    ): Promise<ToolResult> => {
      let session;
      try {
        const request = buildCreateSessionRequest({
          repoOwner,
          repoName,
          prompt,
          branch,
          autoApprove,
          autoCreatePR,
          title,
        });
        session = await sessions.createSession(request);
      } catch (error) {
        return errorResult(
          `Error creating session: ${formatErrorForUser(error)}\n\n${CREATE_SESSION_ERROR_HINTS}`
        );
      }

      return pollSession(session.id, maxWaitSeconds, includeActivities, extra);
    },

    listSessions: async ({
      pageSize,
      pageToken,
    }: {
      pageSize: number;
      pageToken?: string;
    }): Promise<ToolResult> => {
      try {
        const data = await sessions.listSessions({ pageSize, pageToken });
        return textResult(formatSessionList(data));
      } catch (error) {
        return errorResult(`Error listing sessions: ${formatErrorForUser(error)}`);
      }
    },

    getStatus: async ({
      sessionId,
      includeActivities,
    }: {
      sessionId: string;
      includeActivities: number;
    }): Promise<ToolResult> => {
      try {
        const [session, activityList] = await Promise.all([
          sessions.getSession(sessionId),
          activities.listActivities(sessionId, { pageSize: includeActivities }),
        ]);
        return textResult(formatSessionStatus(session, activityList));
      } catch (error) {
        return errorResult(`Error getting session status: ${formatErrorForUser(error)}`);
      }
    },

    sendMessage: async ({
      sessionId,
      message,
    }: {
      sessionId: string;
      message: string;
    }): Promise<ToolResult> => {
      try {
        await sessions.sendMessage(sessionId, { prompt: message });
        return textResult(
          `Message sent successfully to session ${sessionId}.\n\n` +
            "Jules will respond in the next activity. Use jules_list_activities or jules_get_status to see the response."
        );
      } catch (error) {
        return errorResult(`Error sending message: ${formatErrorForUser(error)}`);
      }
    },

    approvePlan: async ({ sessionId }: { sessionId: string }): Promise<ToolResult> => {
      try {
        await sessions.approvePlan(sessionId);
        return textResult(
          `Plan approved for session ${sessionId}.\n\n` +
            "Jules will now execute the task. Use jules_get_status to monitor progress."
        );
      } catch (error) {
        return errorResult(
          `Error approving plan: ${formatErrorForUser(error)}\n\n` +
            "Note: This only works for sessions created with autoApprove=false and state AWAITING_PLAN_APPROVAL."
        );
      }
    },

    getSessionOutput: async ({ sessionId }: { sessionId: string }): Promise<ToolResult> => {
      try {
        const session = await sessions.getSession(sessionId);
        return textResult(formatSessionOutput(session));
      } catch (error) {
        return errorResult(`Error getting session output: ${formatErrorForUser(error)}`);
      }
    },

    deleteSession: async ({ sessionId }: { sessionId: string }): Promise<ToolResult> => {
      try {
        await sessions.deleteSession(sessionId);
        return textResult(`Session ${sessionId} deleted.`);
      } catch (error) {
        return errorResult(`Error deleting session: ${formatErrorForUser(error)}`);
      }
    },

    archiveSession: async ({ sessionId }: { sessionId: string }): Promise<ToolResult> => {
      try {
        const session = await sessions.archiveSession(sessionId);
        return textResult(`Session ${sessionId} archived.\n\nState: ${session.state}`);
      } catch (error) {
        return errorResult(`Error archiving session: ${formatErrorForUser(error)}`);
      }
    },

    unarchiveSession: async ({ sessionId }: { sessionId: string }): Promise<ToolResult> => {
      try {
        const session = await sessions.unarchiveSession(sessionId);
        return textResult(`Session ${sessionId} unarchived.\n\nState: ${session.state}`);
      } catch (error) {
        return errorResult(`Error unarchiving session: ${formatErrorForUser(error)}`);
      }
    },
  };
}

export function registerSessionTools(
  server: McpServer,
  sessions: SessionsClient,
  activities: ActivitiesClient
): void {
  const handlers = createSessionHandlers(sessions, activities);
  const sessionIdField = z.string().describe("Session ID");

  server.registerTool(
    "jules_create_session",
    {
      title: "Create Jules Coding Session",
      description:
        "Start a new asynchronous coding task with Jules. Provide a detailed task description and the repository to work on. Jules runs in an isolated cloud VM and typically completes tasks in 5-60 minutes depending on complexity.",
      inputSchema: {
        repoOwner: z.string().describe("GitHub repository owner (username or organization)"),
        repoName: z.string().describe("GitHub repository name"),
        prompt: z
          .string()
          .describe("Detailed task description - be specific about what needs to be done"),
        branch: z.string().default("main").describe("Starting branch name (default: main)"),
        autoApprove: z
          .boolean()
          .default(true)
          .describe(
            "Automatically approve the execution plan (default: true). Set false to manually approve with jules_approve_plan"
          ),
        autoCreatePR: z
          .boolean()
          .default(false)
          .describe("Automatically create pull request when task completes (default: false)"),
        title: z.string().optional().describe("Optional custom title for the session"),
      },
    },
    handlers.createSession
  );

  server.registerTool(
    "jules_list_sessions",
    {
      title: "List Jules Sessions",
      description:
        "List all your Jules sessions with their current states. Useful for finding session IDs or checking on multiple tasks.",
      inputSchema: {
        pageSize: z.number().default(10).describe("Number of sessions per page (default: 10)"),
        pageToken: PageParams.pageToken,
      },
    },
    handlers.listSessions
  );

  server.registerTool(
    "jules_get_status",
    {
      title: "Get Jules Session Status",
      description:
        "Check the current status and recent activity of a Jules session. Use this to poll for progress and completion. Sessions typically take 5-60 minutes to complete.",
      inputSchema: {
        sessionId: sessionIdField.describe("Session ID to check"),
        includeActivities: z
          .number()
          .default(3)
          .describe("Number of recent activities to include (default: 3)"),
      },
    },
    handlers.getStatus
  );

  server.registerTool(
    "jules_send_message",
    {
      title: "Send Message to Jules Session",
      description:
        "Send a follow-up message or instruction to a running Jules session. Jules will respond in the next activity, which you can see with jules_list_activities or jules_get_status.",
      inputSchema: {
        sessionId: sessionIdField.describe("Session ID to send message to"),
        message: z.string().describe("Message or instruction to send to Jules"),
      },
    },
    handlers.sendMessage
  );

  server.registerTool(
    "jules_approve_plan",
    {
      title: "Approve Jules Execution Plan",
      description:
        "Approve the execution plan for a Jules session that has requirePlanApproval=true. Only needed when session state is AWAITING_PLAN_APPROVAL. View the plan first with jules_list_activities.",
      inputSchema: { sessionId: sessionIdField.describe("Session ID to approve plan for") },
    },
    handlers.approvePlan
  );

  server.registerTool(
    "jules_get_session_output",
    {
      title: "Get Jules Session Output",
      description:
        "Retrieve the final output and results from a completed Jules session, including pull request details. Use after session state is COMPLETED.",
      inputSchema: { sessionId: sessionIdField.describe("Session ID to get output for") },
    },
    handlers.getSessionOutput
  );

  server.registerTool(
    "jules_delete_session",
    {
      title: "Delete Jules Session",
      description:
        "Permanently delete a Jules session. This cannot be undone. Use jules_archive_session instead if you may want the session back later.",
      inputSchema: { sessionId: sessionIdField.describe("Session ID to delete") },
    },
    handlers.deleteSession
  );

  server.registerTool(
    "jules_archive_session",
    {
      title: "Archive Jules Session",
      description:
        "Archive a Jules session to hide it from the default session list without deleting it. Use jules_unarchive_session to restore it.",
      inputSchema: { sessionId: sessionIdField.describe("Session ID to archive") },
    },
    handlers.archiveSession
  );

  server.registerTool(
    "jules_unarchive_session",
    {
      title: "Unarchive Jules Session",
      description:
        "Restore a previously archived Jules session so it appears in the default session list again.",
      inputSchema: { sessionId: sessionIdField.describe("Session ID to unarchive") },
    },
    handlers.unarchiveSession
  );

  server.registerTool(
    "jules_wait_for_session",
    {
      title: "Wait for Jules Session to Complete",
      description:
        "Wait/poll for a Jules session to complete. Automatically tracks progress, emits progress notifications, and returns a unified payload with final state, summary, and PR details upon resolution. Bounded by a wait limit to prevent timeouts.",
      inputSchema: {
        sessionId: sessionIdField.describe("Session ID to wait/poll for"),
        maxWaitSeconds: z
          .number()
          .int()
          .min(1)
          .max(300)
          .default(60)
          .describe("Maximum time to wait/poll in seconds (default: 60, max: 300)"),
        includeActivities: z
          .number()
          .int()
          .min(0)
          .default(5)
          .describe("Number of recent activities to include in the output (default: 5)"),
      },
    },
    handlers.waitForSession
  );

  server.registerTool(
    "jules_execute_and_wait",
    {
      title: "Create and Wait for Jules Session",
      description:
        "Create a new Jules session and immediately wait/poll for its completion. Automatically tracks progress, emits progress notifications, and returns a unified payload with final state, summary, and PR details upon resolution. Bounded by a wait limit to prevent timeouts.",
      inputSchema: {
        repoOwner: z.string().describe("GitHub repository owner (username or organization)"),
        repoName: z.string().describe("GitHub repository name"),
        prompt: z
          .string()
          .describe("Detailed task description - be specific about what needs to be done"),
        branch: z.string().default("main").describe("Starting branch name (default: main)"),
        autoApprove: z
          .boolean()
          .default(true)
          .describe(
            "Automatically approve the execution plan (default: true). Set false to manually approve with jules_approve_plan"
          ),
        autoCreatePR: z
          .boolean()
          .default(false)
          .describe("Automatically create pull request when task completes (default: false)"),
        title: z.string().optional().describe("Optional custom title for the session"),
        maxWaitSeconds: z
          .number()
          .int()
          .min(1)
          .max(300)
          .default(60)
          .describe("Maximum time to wait/poll in seconds (default: 60, max: 300)"),
        includeActivities: z
          .number()
          .int()
          .min(0)
          .default(5)
          .describe("Number of recent activities to include in the output (default: 5)"),
      },
    },
    handlers.executeAndWait
  );
}

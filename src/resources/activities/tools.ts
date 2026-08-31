import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { textResult, wrap, type ToolResult } from "../../core/tool-result.js";
import type { ActivitiesClient } from "./client.js";
import { formatActivityDetail, formatActivityList } from "./format.js";

export function createActivityHandlers(client: ActivitiesClient) {
  return {
    listActivities: ({
      sessionId,
      limit,
    }: {
      sessionId: string;
      limit: number;
    }): Promise<ToolResult> =>
      wrap("Error listing activities", async () => {
        const activities = [];
        let pageToken: string | undefined;

        for (let page = 0; page < 10; page++) {
          const pageSize = Math.max(1, Math.min(50, limit - activities.length));
          const data = await client.listActivities(sessionId, { pageSize, pageToken });
          activities.push(...(data.activities ?? []));

          if (activities.length >= limit) {
            activities.splice(limit);
            pageToken = data.nextPageToken;
            break;
          }

          pageToken = data.nextPageToken;
          if (!pageToken) break;
        }

        return textResult(formatActivityList({ activities, nextPageToken: pageToken }, sessionId));
      }),

    getActivity: ({
      sessionId,
      activityId,
    }: {
      sessionId: string;
      activityId: string;
    }): Promise<ToolResult> =>
      wrap("Error getting activity", async () => {
        const activity = await client.getActivity(sessionId, activityId);
        return textResult(formatActivityDetail(activity));
      }),
  };
}

export function registerActivityTools(server: McpServer, client: ActivitiesClient): void {
  const handlers = createActivityHandlers(client);

  server.registerTool(
    "jules_list_activities",
    {
      title: "List Jules Session Activities",
      description:
        "Get detailed activity log for a Jules session. Activities include plan generation, progress updates, messages, and completion events. Most recent activities appear first.",
      inputSchema: {
        sessionId: z.string().describe("Session ID to get activities for"),
        limit: z.number().default(10).describe("Number of activities to retrieve (default: 10)"),
      },
    },
    handlers.listActivities
  );

  server.registerTool(
    "jules_get_activity",
    {
      title: "Get Jules Activity",
      description:
        "Get a single activity from a Jules session by ID. Use jules_list_activities to find activity IDs.",
      inputSchema: {
        sessionId: z.string().describe("Session ID the activity belongs to"),
        activityId: z.string().describe("Activity ID to retrieve"),
      },
    },
    handlers.getActivity
  );
}

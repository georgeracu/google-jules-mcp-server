import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createRequire } from "node:module";

import { JulesHttpClient } from "./core/http-client.js";
import { ActivitiesClient } from "./resources/activities/client.js";
import { registerActivityTools } from "./resources/activities/tools.js";
import { SessionsClient } from "./resources/sessions/client.js";
import { registerSessionTools } from "./resources/sessions/tools.js";
import { SourcesClient } from "./resources/sources/client.js";
import { registerSourceTools } from "./resources/sources/tools.js";

export const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

export const TOOL_NAMES = [
  "jules_list_sources",
  "jules_get_source",
  "jules_create_session",
  "jules_list_sessions",
  "jules_get_status",
  "jules_send_message",
  "jules_approve_plan",
  "jules_get_session_output",
  "jules_delete_session",
  "jules_archive_session",
  "jules_unarchive_session",
  "jules_wait_for_session",
  "jules_execute_and_wait",
  "jules_list_activities",
  "jules_get_activity",
] as const;

export function createServer(apiKey: string): McpServer {
  const server = new McpServer({ name: "google-jules-mcp-server", version });

  const http = new JulesHttpClient(apiKey);
  const sources = new SourcesClient(http);
  const sessions = new SessionsClient(http);
  const activities = new ActivitiesClient(http);

  registerSourceTools(server, sources);
  registerSessionTools(server, sessions, activities);
  registerActivityTools(server, activities);

  return server;
}

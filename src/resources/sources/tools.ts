import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { textResult, wrap, type ToolResult } from "../../core/tool-result.js";
import { PageParams } from "../../shared/pagination.js";
import type { SourcesClient } from "./client.js";
import { formatSource, formatSourceList } from "./format.js";

export function createSourceHandlers(client: SourcesClient) {
  return {
    listSources: ({
      pageSize,
      pageToken,
      filter,
    }: {
      pageSize?: number;
      pageToken?: string;
      filter?: string;
    }): Promise<ToolResult> =>
      wrap("Error listing sources", async () => {
        const data = await client.listSources({ pageSize, pageToken, filter });
        return textResult(formatSourceList(data));
      }),

    getSource: ({
      repoOwner,
      repoName,
    }: {
      repoOwner: string;
      repoName: string;
    }): Promise<ToolResult> =>
      wrap(
        "Error getting source",
        async () => {
          const source = await client.getSource(repoOwner, repoName);
          return textResult(formatSource(source));
        },
        "\n\nCommon issues:\n- Repository not connected to Jules (run jules_list_sources)\n- Invalid repository owner/name"
      ),
  };
}

export function registerSourceTools(server: McpServer, client: SourcesClient): void {
  const handlers = createSourceHandlers(client);

  server.registerTool(
    "jules_list_sources",
    {
      title: "List Jules Sources",
      description:
        "List all GitHub repositories connected to Jules. You must install the Jules GitHub app at https://jules.google.com before repositories appear here.",
      inputSchema: {
        ...PageParams,
        filter: z
          .string()
          .optional()
          .describe("AIP-160 filter expression to narrow the results (e.g. by repo owner)"),
      },
    },
    handlers.listSources
  );

  server.registerTool(
    "jules_get_source",
    {
      title: "Get Jules Source",
      description:
        "Get details for a single GitHub repository connected to Jules, including its branches and visibility. Use jules_list_sources to see all connected repositories.",
      inputSchema: {
        repoOwner: z.string().describe("GitHub repository owner (username or organization)"),
        repoName: z.string().describe("GitHub repository name"),
      },
    },
    handlers.getSource
  );
}

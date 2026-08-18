#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getApiKey } from "./core/config.js";
import { logger } from "./core/logger.js";
import { createServer, TOOL_NAMES } from "./server.js";
import { startWatcher } from "./watch.js";

async function main(): Promise<void> {
  const isWatcher = process.argv[2] === "watch";

  if (isWatcher) {
    await startWatcher();
  }

  const apiKey = getApiKey();
  const server = createServer(apiKey);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Jules MCP server running");
  logger.info(`Connected tools: ${TOOL_NAMES.length}`);
}

main().catch((error: unknown) => {
  logger.error("Fatal error starting Jules MCP server:", error);
  process.exit(1);
});

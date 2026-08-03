#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getApiKey } from "./core/config.js";
import { logger } from "./core/logger.js";
import { createServer, TOOL_NAMES } from "./server.js";

async function main(): Promise<void> {
  const apiKey = getApiKey();
  const server = createServer(apiKey);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Jules MCP server running");
  logger.info(`Connected tools: ${TOOL_NAMES.length}`);
  for (const name of TOOL_NAMES) {
    logger.info(`  - ${name}`);
  }
}

main().catch((error: unknown) => {
  logger.error("Fatal error starting Jules MCP server:", error);
  process.exit(1);
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

import { createServer, TOOL_NAMES, version } from "../src/server.js";

const packageJson = createRequire(import.meta.url)("../package.json") as { version: string };

describe("createServer", () => {
  it("registers exactly the documented tools", () => {
    const registerSpy = vi.spyOn(McpServer.prototype, "registerTool");

    const server = createServer("test-key");

    expect(server).toBeInstanceOf(McpServer);
    expect(registerSpy).toHaveBeenCalledTimes(TOOL_NAMES.length);
    const names = registerSpy.mock.calls.map((call) => call[0]);
    expect(names).toEqual(TOOL_NAMES);
  });

  it("reports the version declared in package.json", () => {
    expect(version).toBe(packageJson.version);
  });
});

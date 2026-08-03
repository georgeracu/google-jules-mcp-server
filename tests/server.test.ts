import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";

import { createServer, TOOL_NAMES } from "../src/server.js";

describe("createServer", () => {
  it("registers exactly the 13 documented tools", () => {
    const registerSpy = vi.spyOn(McpServer.prototype, "registerTool");

    const server = createServer("test-key");

    expect(server).toBeInstanceOf(McpServer);
    expect(registerSpy).toHaveBeenCalledTimes(TOOL_NAMES.length);
    const names = registerSpy.mock.calls.map((call) => call[0]);
    expect(names).toEqual(TOOL_NAMES);
  });
});

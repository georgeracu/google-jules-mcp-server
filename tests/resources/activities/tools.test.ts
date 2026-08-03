import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { JulesHttpClient } from "../../../src/core/http-client.js";
import { ActivitiesClient } from "../../../src/resources/activities/client.js";
import {
  createActivityHandlers,
  registerActivityTools,
} from "../../../src/resources/activities/tools.js";
import { server } from "../../msw/server.js";

const BASE = "https://jules.googleapis.com/v1alpha";

function makeHandlers() {
  return createActivityHandlers(new ActivitiesClient(new JulesHttpClient("test-key", BASE)));
}

describe("activity tool handlers", () => {
  it("listActivities returns a text result on success", async () => {
    const result = await makeHandlers().listActivities({ sessionId: "1234567890", limit: 10 });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Activities for session 1234567890");
  });

  it("listActivities returns an error result on failure", async () => {
    server.use(
      http.get(`${BASE}/sessions/bad/activities`, () =>
        HttpResponse.json({ error: { message: "no such session" } }, { status: 404 })
      )
    );
    const result = await makeHandlers().listActivities({ sessionId: "bad", limit: 10 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error listing activities");
  });

  it("getActivity returns a text result on success", async () => {
    const result = await makeHandlers().getActivity({ sessionId: "1234567890", activityId: "a1" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Generated execution plan");
  });

  it("getActivity returns an error result on failure", async () => {
    server.use(
      http.get(`${BASE}/sessions/1234567890/activities/missing`, () =>
        HttpResponse.json({ error: { message: "no such activity" } }, { status: 404 })
      )
    );
    const result = await makeHandlers().getActivity({
      sessionId: "1234567890",
      activityId: "missing",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error getting activity");
  });
});

describe("registerActivityTools", () => {
  it("registers jules_list_activities and jules_get_activity with a working handler", async () => {
    const mcpServer = new McpServer({ name: "test", version: "0.0.0" });
    const registerSpy = vi.spyOn(mcpServer, "registerTool");

    registerActivityTools(mcpServer, new ActivitiesClient(new JulesHttpClient("test-key", BASE)));

    expect(registerSpy).toHaveBeenCalledTimes(2);
    const names = registerSpy.mock.calls.map((call) => call[0]);
    expect(names).toEqual(["jules_list_activities", "jules_get_activity"]);

    const listActivitiesHandler = registerSpy.mock.calls[0][2] as (args: object) => Promise<{
      content: Array<{ text: string }>;
    }>;
    const result = await listActivitiesHandler({ sessionId: "1234567890", limit: 10 });
    expect(result.content[0].text).toContain("Activities for session");
  });
});

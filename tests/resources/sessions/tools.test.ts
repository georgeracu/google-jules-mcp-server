import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { JulesHttpClient } from "../../../src/core/http-client.js";
import { ActivitiesClient } from "../../../src/resources/activities/client.js";
import { SessionsClient } from "../../../src/resources/sessions/client.js";
import {
  createSessionHandlers,
  registerSessionTools,
} from "../../../src/resources/sessions/tools.js";
import { server } from "../../msw/server.js";

const BASE = "https://jules.googleapis.com/v1alpha";

function makeHandlers() {
  const httpClient = new JulesHttpClient("test-key", BASE);
  return createSessionHandlers(new SessionsClient(httpClient), new ActivitiesClient(httpClient));
}

const baseCreateInput = {
  repoOwner: "acme",
  repoName: "widget-app",
  prompt: "Add tests",
  branch: "main",
  autoApprove: true,
  autoCreatePR: false,
};

describe("session tool handlers", () => {
  it("createSession returns a text result on success", async () => {
    const result = await makeHandlers().createSession(baseCreateInput);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Session created successfully!");
    expect(result.content[0].text).toContain("acme/widget-app");
  });

  it("createSession sends automationMode when autoCreatePR is true and honors an explicit title", async () => {
    let capturedBody: { automationMode?: string; title?: string } | undefined;
    server.use(
      http.post(`${BASE}/sessions`, async ({ request }) => {
        capturedBody = (await request.json()) as { automationMode?: string; title?: string };
        return HttpResponse.json({ id: "1", prompt: "p", state: "QUEUED" });
      })
    );

    await makeHandlers().createSession({
      ...baseCreateInput,
      autoCreatePR: true,
      title: "Custom title",
    });

    expect(capturedBody?.automationMode).toBe("AUTO_CREATE_PR");
    expect(capturedBody?.title).toBe("Custom title");
  });

  it("createSession returns an error result with troubleshooting hints on failure", async () => {
    server.use(
      http.post(`${BASE}/sessions`, () =>
        HttpResponse.json({ error: { message: "no such repo" } }, { status: 404 })
      )
    );
    const result = await makeHandlers().createSession(baseCreateInput);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Repository not connected to Jules");
  });

  it("listSessions returns a text result on success", async () => {
    const result = await makeHandlers().listSessions({ pageSize: 10 });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Your Jules sessions");
  });

  it("listSessions returns an error result on failure", async () => {
    server.use(
      http.get(`${BASE}/sessions`, () =>
        HttpResponse.json({ error: { message: "down" } }, { status: 500 })
      )
    );
    const result = await makeHandlers().listSessions({ pageSize: 10 });
    expect(result.isError).toBe(true);
  });

  it("getStatus combines session and activities into one text result", async () => {
    const result = await makeHandlers().getStatus({
      sessionId: "1234567890",
      includeActivities: 3,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Session:");
    expect(result.content[0].text).toContain("Recent Activity");
  });

  it("getStatus returns an error result when the session fetch fails", async () => {
    server.use(
      http.get(`${BASE}/sessions/missing`, () =>
        HttpResponse.json({ error: { message: "no session" } }, { status: 404 })
      )
    );
    const result = await makeHandlers().getStatus({ sessionId: "missing", includeActivities: 3 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error getting session status");
  });

  it("sendMessage returns a confirmation text result on success", async () => {
    const result = await makeHandlers().sendMessage({ sessionId: "1234567890", message: "hi" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Message sent successfully");
  });

  it("sendMessage returns an error result on failure", async () => {
    server.use(
      http.post(`${BASE}/sessions/1234567890:sendMessage`, () =>
        HttpResponse.json({ error: { message: "session closed" } }, { status: 400 })
      )
    );
    const result = await makeHandlers().sendMessage({ sessionId: "1234567890", message: "hi" });
    expect(result.isError).toBe(true);
  });

  it("approvePlan returns a confirmation text result on success", async () => {
    const result = await makeHandlers().approvePlan({ sessionId: "1234567890" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Plan approved");
  });

  it("approvePlan returns an error result with a usage note on failure", async () => {
    server.use(
      http.post(`${BASE}/sessions/1234567890:approvePlan`, () =>
        HttpResponse.json({ error: { message: "no plan pending" } }, { status: 400 })
      )
    );
    const result = await makeHandlers().approvePlan({ sessionId: "1234567890" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("AWAITING_PLAN_APPROVAL");
  });

  it("getSessionOutput returns a text result on success", async () => {
    const result = await makeHandlers().getSessionOutput({ sessionId: "1234567890" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Session Output:");
  });

  it("getSessionOutput returns an error result on failure", async () => {
    server.use(
      http.get(`${BASE}/sessions/missing`, () =>
        HttpResponse.json({ error: { message: "no session" } }, { status: 404 })
      )
    );
    const result = await makeHandlers().getSessionOutput({ sessionId: "missing" });
    expect(result.isError).toBe(true);
  });

  it("deleteSession returns a confirmation text result on success", async () => {
    const result = await makeHandlers().deleteSession({ sessionId: "1234567890" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("deleted");
  });

  it("deleteSession returns an error result on failure", async () => {
    server.use(
      http.delete(`${BASE}/sessions/1234567890`, () =>
        HttpResponse.json({ error: { message: "cannot delete" } }, { status: 400 })
      )
    );
    const result = await makeHandlers().deleteSession({ sessionId: "1234567890" });
    expect(result.isError).toBe(true);
  });

  it("archiveSession returns the new state on success", async () => {
    const result = await makeHandlers().archiveSession({ sessionId: "1234567890" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("archived");
  });

  it("archiveSession returns an error result on failure", async () => {
    server.use(
      http.post(`${BASE}/sessions/1234567890:archive`, () =>
        HttpResponse.json({ error: { message: "cannot archive" } }, { status: 400 })
      )
    );
    const result = await makeHandlers().archiveSession({ sessionId: "1234567890" });
    expect(result.isError).toBe(true);
  });

  it("unarchiveSession returns the new state on success", async () => {
    const result = await makeHandlers().unarchiveSession({ sessionId: "1234567890" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("unarchived");
  });

  it("unarchiveSession returns an error result on failure", async () => {
    server.use(
      http.post(`${BASE}/sessions/1234567890:unarchive`, () =>
        HttpResponse.json({ error: { message: "cannot unarchive" } }, { status: 400 })
      )
    );
    const result = await makeHandlers().unarchiveSession({ sessionId: "1234567890" });
    expect(result.isError).toBe(true);
  });
});

describe("registerSessionTools", () => {
  it("registers all 9 session tools with a working handler", async () => {
    const mcpServer = new McpServer({ name: "test", version: "0.0.0" });
    const registerSpy = vi.spyOn(mcpServer, "registerTool");
    const httpClient = new JulesHttpClient("test-key", BASE);

    registerSessionTools(
      mcpServer,
      new SessionsClient(httpClient),
      new ActivitiesClient(httpClient)
    );

    const names = registerSpy.mock.calls.map((call) => call[0]);
    expect(names).toEqual([
      "jules_create_session",
      "jules_list_sessions",
      "jules_get_status",
      "jules_send_message",
      "jules_approve_plan",
      "jules_get_session_output",
      "jules_delete_session",
      "jules_archive_session",
      "jules_unarchive_session",
    ]);

    const getStatusHandler = registerSpy.mock.calls[2][2] as (args: object) => Promise<{
      content: Array<{ text: string }>;
    }>;
    const result = await getStatusHandler({ sessionId: "1234567890", includeActivities: 3 });
    expect(result.content[0].text).toContain("Session:");
  });
});

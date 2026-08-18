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

  it("listStuckSessions reports when no sessions are stuck", async () => {
    server.use(
      http.get(`${BASE}/sessions`, () =>
        HttpResponse.json({
          sessions: [{ id: "running", title: "Running", prompt: "p", state: "IN_PROGRESS" }],
        })
      )
    );

    const result = await makeHandlers().listStuckSessions({ pageSize: 50 });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No stuck sessions found");
  });

  it("listStuckSessions returns sessions awaiting action", async () => {
    server.use(
      http.get(`${BASE}/sessions`, () =>
        HttpResponse.json({
          sessions: [
            {
              id: "approval",
              title: "Approve me",
              prompt: "p",
              state: "AWAITING_PLAN_APPROVAL",
              url: "https://jules.google.com/session/approval",
              updateTime: "2026-08-17T08:00:00Z",
            },
            {
              id: "feedback",
              title: "Reply to me",
              prompt: "p",
              state: "AWAITING_USER_FEEDBACK",
              url: "https://jules.google.com/session/feedback",
              updateTime: "2026-08-17T08:05:00Z",
            },
            { id: "done", title: "Done", prompt: "p", state: "COMPLETED" },
          ],
        })
      )
    );

    const result = await makeHandlers().listStuckSessions({ pageSize: 50 });

    expect(result.content[0].text).toContain("Stuck Jules sessions (2)");
    expect(result.content[0].text).toContain("Approve me");
    expect(result.content[0].text).toContain("Reply to me");
    expect(result.content[0].text).not.toContain("Done");
  });

  it("listStuckSessions follows pagination past the first page", async () => {
    const requestedTokens: Array<string | null> = [];
    server.use(
      http.get(`${BASE}/sessions`, ({ request }) => {
        const url = new URL(request.url);
        requestedTokens.push(url.searchParams.get("pageToken"));
        expect(url.searchParams.get("pageSize")).toBe("25");

        if (!url.searchParams.get("pageToken")) {
          return HttpResponse.json({
            sessions: [{ id: "running", prompt: "p", state: "IN_PROGRESS" }],
            nextPageToken: "second-page",
          });
        }
        return HttpResponse.json({
          sessions: [
            {
              id: "feedback-on-page-two",
              title: "Needs feedback",
              prompt: "p",
              state: "AWAITING_USER_FEEDBACK",
            },
          ],
        });
      })
    );

    const result = await makeHandlers().listStuckSessions({ pageSize: 25 });

    expect(requestedTokens).toEqual([null, "second-page"]);
    expect(result.content[0].text).toContain("Needs feedback");
  });

  it("listStuckSessions returns an error when the API request fails", async () => {
    server.use(
      http.get(`${BASE}/sessions`, () =>
        HttpResponse.json({ error: { message: "temporarily unavailable" } }, { status: 503 })
      )
    );

    const result = await makeHandlers().listStuckSessions({ pageSize: 50 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error listing stuck sessions");
  });

  it("listStuckSessions stops after scanning 500 sessions", async () => {
    let requests = 0;
    server.use(
      http.get(`${BASE}/sessions`, () => {
        requests++;
        return HttpResponse.json({
          sessions: Array.from({ length: 500 }, (_, index) => ({
            id: `running-${index}`,
            prompt: "p",
            state: "IN_PROGRESS",
          })),
          nextPageToken: "should-not-be-fetched",
        });
      })
    );

    const result = await makeHandlers().listStuckSessions({ pageSize: 500 });

    expect(requests).toBe(1);
    expect(result.content[0].text).toContain("No stuck sessions found");
  });

  it("listStuckSessions stops after five pages", async () => {
    let requests = 0;
    server.use(
      http.get(`${BASE}/sessions`, () => {
        requests++;
        return HttpResponse.json({
          sessions: [{ id: `running-${requests}`, prompt: "p", state: "IN_PROGRESS" }],
          nextPageToken: `page-${requests + 1}`,
        });
      })
    );

    const result = await makeHandlers().listStuckSessions({ pageSize: 1 });

    expect(requests).toBe(5);
    expect(result.content[0].text).toContain("No stuck sessions found");
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
  it("registers all 12 session tools with a working handler", async () => {
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
      "jules_list_stuck_sessions",
      "jules_get_status",
      "jules_send_message",
      "jules_approve_plan",
      "jules_get_session_output",
      "jules_delete_session",
      "jules_archive_session",
      "jules_unarchive_session",
      "jules_wait_for_session",
      "jules_execute_and_wait",
    ]);

    const getStatusHandler = registerSpy.mock.calls[3][2] as (args: object) => Promise<{
      content: Array<{ text: string }>;
    }>;
    const result = await getStatusHandler({ sessionId: "1234567890", includeActivities: 3 });
    expect(result.content[0].text).toContain("Session:");
  });
});

describe("jules_wait_for_session and jules_execute_and_wait", () => {
  it("resolves immediately if session is COMPLETED", async () => {
    server.use(
      http.get(`${BASE}/sessions/1234567890`, () =>
        HttpResponse.json({ id: "1234567890", prompt: "p", state: "COMPLETED" })
      )
    );

    const result = await makeHandlers().waitForSession({
      sessionId: "1234567890",
      maxWaitSeconds: 10,
      includeActivities: 3,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Session Wait Resolved!");
    expect(result.content[0].text).toContain("Final State: COMPLETED");
  });

  it("jules_execute_and_wait supports autoCreatePR=true and autoApprove=false", async () => {
    let capturedBody: { requirePlanApproval?: boolean; automationMode?: string } | undefined;
    server.use(
      http.post(`${BASE}/sessions`, async ({ request }) => {
        capturedBody = (await request.json()) as {
          requirePlanApproval?: boolean;
          automationMode?: string;
        };
        return HttpResponse.json({ id: "created-456", prompt: "p", state: "QUEUED" });
      }),
      http.get(`${BASE}/sessions/created-456`, () =>
        HttpResponse.json({ id: "created-456", prompt: "p", state: "COMPLETED" })
      )
    );

    const result = await makeHandlers().executeAndWait({
      ...baseCreateInput,
      autoCreatePR: true,
      autoApprove: false,
      maxWaitSeconds: 10,
      includeActivities: 3,
    });

    expect(result.isError).toBeUndefined();
    expect(capturedBody?.requirePlanApproval).toBe(true);
    expect(capturedBody?.automationMode).toBe("AUTO_CREATE_PR");
  });

  it("polls and resolves when session becomes COMPLETED", async () => {
    vi.useFakeTimers();
    let getCalls = 0;
    server.use(
      http.get(`${BASE}/sessions/1234567890`, () => {
        getCalls++;
        const state = getCalls === 1 ? "IN_PROGRESS" : "COMPLETED";
        return HttpResponse.json({ id: "1234567890", prompt: "p", state });
      })
    );

    const promise = makeHandlers().waitForSession({
      sessionId: "1234567890",
      maxWaitSeconds: 10,
      includeActivities: 3,
    });

    // Advance the fake timers so the sleep resolves
    await vi.advanceTimersByTimeAsync(5000);

    const result = await promise;
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Session Wait Resolved!");
    expect(result.content[0].text).toContain("Final State: COMPLETED");
    vi.useRealTimers();
  });

  it("stops and returns timeout instruction when hitting maxWaitSeconds", async () => {
    vi.useFakeTimers();
    server.use(
      http.get(`${BASE}/sessions/1234567890`, () =>
        HttpResponse.json({ id: "1234567890", prompt: "p", state: "IN_PROGRESS" })
      )
    );

    const promise = makeHandlers().waitForSession({
      sessionId: "1234567890",
      maxWaitSeconds: 3,
      includeActivities: 3,
    });

    // Advance fake timer by 5000ms
    await vi.advanceTimersByTimeAsync(5000);

    const result = await promise;
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Session Wait Time Limit Reached");
    expect(result.content[0].text).toContain('Please call "jules_wait_for_session"');
    vi.useRealTimers();
  });

  interface MockProgressNotification {
    method: string;
    params: {
      progressToken: string | number;
      progress: number;
      total: number;
      message: string;
    };
  }

  it("emits progress notifications while polling", async () => {
    vi.useFakeTimers();
    let getCalls = 0;
    server.use(
      http.get(`${BASE}/sessions/1234567890`, () => {
        getCalls++;
        const state = getCalls === 1 ? "IN_PROGRESS" : "COMPLETED";
        return HttpResponse.json({ id: "1234567890", prompt: "p", state });
      })
    );

    const sentNotifications: MockProgressNotification[] = [];
    const mockExtra = {
      _meta: { progressToken: "my-token" },
      sendNotification: async (notif: MockProgressNotification) => {
        sentNotifications.push(notif);
        await Promise.resolve();
      },
    };

    const promise = makeHandlers().waitForSession(
      {
        sessionId: "1234567890",
        maxWaitSeconds: 10,
        includeActivities: 3,
      },
      mockExtra
    );

    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(sentNotifications.length).toBeGreaterThan(0);
    expect(sentNotifications[0].method).toBe("notifications/progress");
    expect(sentNotifications[0].params.progressToken).toBe("my-token");
    expect(sentNotifications[0].params.message).toContain("Waiting for completion");
    vi.useRealTimers();
  });

  it("supports abort signal", async () => {
    vi.useFakeTimers();
    server.use(
      http.get(`${BASE}/sessions/1234567890`, () =>
        HttpResponse.json({ id: "1234567890", prompt: "p", state: "IN_PROGRESS" })
      )
    );

    const controller = new AbortController();
    const mockExtra = {
      signal: controller.signal,
    };

    const promise = makeHandlers().waitForSession(
      {
        sessionId: "1234567890",
        maxWaitSeconds: 10,
        includeActivities: 3,
      },
      mockExtra
    );

    // Abort after first poll/sleep start
    controller.abort();
    await vi.advanceTimersByTimeAsync(5000);

    const result = await promise;
    expect(result.content[0].text).toContain("Wait operation was cancelled");
    vi.useRealTimers();
  });

  it("jules_execute_and_wait creates session and waits successfully", async () => {
    server.use(
      http.post(`${BASE}/sessions`, () =>
        HttpResponse.json({ id: "created-123", prompt: "p", state: "QUEUED" })
      ),
      http.get(`${BASE}/sessions/created-123`, () =>
        HttpResponse.json({ id: "created-123", prompt: "p", state: "COMPLETED" })
      )
    );

    const result = await makeHandlers().executeAndWait({
      ...baseCreateInput,
      maxWaitSeconds: 10,
      includeActivities: 3,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Session Wait Resolved!");
    expect(result.content[0].text).toContain("Final State: COMPLETED");
  });

  it("returns error result if getSession fails during wait", async () => {
    server.use(
      http.get(`${BASE}/sessions/1234567890`, () =>
        HttpResponse.json({ error: { message: "unauthorized" } }, { status: 401 })
      )
    );

    const result = await makeHandlers().waitForSession({
      sessionId: "1234567890",
      maxWaitSeconds: 10,
      includeActivities: 3,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error getting session status");
  });

  it("returns error result if listActivities fails during wait resolution", async () => {
    server.use(
      http.get(`${BASE}/sessions/1234567890`, () =>
        HttpResponse.json({ id: "1234567890", prompt: "p", state: "COMPLETED" })
      ),
      http.get(`${BASE}/sessions/1234567890/activities`, () =>
        HttpResponse.json({ error: { message: "internal error" } }, { status: 500 })
      )
    );

    const result = await makeHandlers().waitForSession({
      sessionId: "1234567890",
      maxWaitSeconds: 10,
      includeActivities: 3,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error fetching activities");
  });

  it("returns error result if executeAndWait fails to create session", async () => {
    server.use(
      http.post(`${BASE}/sessions`, () =>
        HttpResponse.json({ error: { message: "repo not connected" } }, { status: 404 })
      )
    );

    const result = await makeHandlers().executeAndWait({
      ...baseCreateInput,
      maxWaitSeconds: 10,
      includeActivities: 3,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error creating session");
  });
});

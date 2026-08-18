import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { JULES_API_BASE } from "../src/core/config.js";
import { JulesHttpClient } from "../src/core/http-client.js";
import { SessionsClient } from "../src/resources/sessions/client.js";
import { pollStuckSessions } from "../src/watch.js";
import { server } from "./msw/server.js";

describe("watcher", () => {
  it("polls sessions and posts newly stuck ones to webhook", async () => {
    // Setup client
    const client = new SessionsClient(new JulesHttpClient("fake-key"));
    const seenStates = new Map<string, string>();
    const webhookUrl = "http://fake-webhook.com/post";

    // Mock Jules API returning a stuck session
    const stuckSessionId = "session-123";
    server.use(
      http.get(`${JULES_API_BASE}/sessions`, () => {
        return HttpResponse.json({
          sessions: [
            {
              id: stuckSessionId,
              state: "AWAITING_PLAN_APPROVAL",
              title: "Test stuck session",
              prompt: "test prompt",
              url: "https://jules.google.com/session-123",
            },
            {
              id: "session-456",
              state: "COMPLETED",
              prompt: "another prompt",
              title: "Done session",
            },
          ],
        });
      })
    );

    // Mock the webhook endpoint
    const postedPayloads: Record<string, unknown>[] = [];
    server.use(
      http.post(webhookUrl, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        postedPayloads.push(body);
        return new HttpResponse(null, { status: 200 });
      })
    );

    // Poll 1: Should notify about the stuck session
    await pollStuckSessions(client, webhookUrl, seenStates);

    expect(postedPayloads).toHaveLength(1);
    expect(postedPayloads[0]).toEqual({
      id: stuckSessionId,
      title: "Test stuck session",
      state: "AWAITING_PLAN_APPROVAL",
      url: "https://jules.google.com/session-123",
    });
    expect(seenStates.get(stuckSessionId)).toBe("AWAITING_PLAN_APPROVAL");

    // Poll 2: Should NOT notify again
    await pollStuckSessions(client, webhookUrl, seenStates);
    expect(postedPayloads).toHaveLength(1); // Still 1

    // Poll 3: State changes, should notify again
    server.use(
      http.get(`${JULES_API_BASE}/sessions`, () => {
        return HttpResponse.json({
          sessions: [
            {
              id: stuckSessionId,
              state: "AWAITING_USER_FEEDBACK",
              title: "Test stuck session",
              prompt: "test prompt",
              url: "https://jules.google.com/session-123",
            },
          ],
        });
      })
    );
    await pollStuckSessions(client, webhookUrl, seenStates);
    expect(postedPayloads).toHaveLength(2);
    expect(postedPayloads[1].state).toBe("AWAITING_USER_FEEDBACK");
    expect(seenStates.get(stuckSessionId)).toBe("AWAITING_USER_FEEDBACK");
  });
});

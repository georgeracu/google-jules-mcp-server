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

  it("handles webhook failures gracefully", async () => {
    const client = new SessionsClient(new JulesHttpClient("fake-key"));
    const seenStates = new Map<string, string>();
    const webhookUrl = "http://fake-webhook.com/post-fail";

    server.use(
      http.get(`${JULES_API_BASE}/sessions`, () => {
        return HttpResponse.json({
          sessions: [
            {
              id: "session-fail",
              state: "AWAITING_PLAN_APPROVAL",
              title: "Failing webhook session",
              prompt: "test prompt",
              url: "https://jules.google.com/session-fail",
            }
          ],
        });
      })
    );

    server.use(
      http.post(webhookUrl, () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    await pollStuckSessions(client, webhookUrl, seenStates);
    // Should NOT have added to seenStates since webhook failed
    expect(seenStates.has("session-fail")).toBe(false);
  });

  it("handles fetch throwing entirely", async () => {
    const client = new SessionsClient(new JulesHttpClient("fake-key"));
    const seenStates = new Map<string, string>();
    const webhookUrl = "http://fake-webhook.com/post-throw";

    server.use(
      http.get(`${JULES_API_BASE}/sessions`, () => {
        return HttpResponse.json({
          sessions: [
            {
              id: "session-throw",
              state: "AWAITING_PLAN_APPROVAL",
              title: "Throwing webhook session",
              prompt: "test prompt",
              url: "https://jules.google.com/session-throw",
            }
          ],
        });
      })
    );

    server.use(
      http.post(webhookUrl, () => {
        return HttpResponse.error();
      })
    );

    await pollStuckSessions(client, webhookUrl, seenStates);
    // Should NOT have added to seenStates since webhook threw
    expect(seenStates.has("session-throw")).toBe(false);
  });

  it("catches sessionsClient throwing", async () => {
    const client = new SessionsClient(new JulesHttpClient("fake-key"));
    const seenStates = new Map<string, string>();
    const webhookUrl = "http://fake-webhook.com/post";

    server.use(
      http.get(`${JULES_API_BASE}/sessions`, () => {
        return HttpResponse.error();
      })
    );

    // Should swallow error and resolve normally
    await pollStuckSessions(client, webhookUrl, seenStates);
  });

  describe("startWatcher", () => {
    it("throws if JULES_WATCH_WEBHOOK_URL is not set", async () => {
      process.env.JULES_API_KEY = "fake-key";
      delete process.env.JULES_WATCH_WEBHOOK_URL;
      const { startWatcher } = await import("../src/watch.js");
      await expect(startWatcher()).rejects.toThrow("JULES_WATCH_WEBHOOK_URL environment variable is required");
    });

    it("throws if JULES_WATCH_INTERVAL_SECONDS is invalid", async () => {
      process.env.JULES_API_KEY = "fake-key";
      process.env.JULES_WATCH_WEBHOOK_URL = "http://test";
      process.env.JULES_WATCH_INTERVAL_SECONDS = "abc";
      const { startWatcher } = await import("../src/watch.js");
      await expect(startWatcher()).rejects.toThrow("must be a positive integer");
    });

    it("starts without throwing on valid config", async () => {
      process.env.JULES_API_KEY = "fake-key";
      process.env.JULES_WATCH_WEBHOOK_URL = "http://test";
      process.env.JULES_WATCH_INTERVAL_SECONDS = "60";

      server.use(
        http.get(`${JULES_API_BASE}/sessions`, () => {
          return HttpResponse.json({ sessions: [] });
        })
      );

      const { startWatcher } = await import("../src/watch.js");
      const promise = startWatcher();
      // Should hang indefinitely, so we just expect it to be a promise that doesn't reject immediately
      expect(promise).toBeInstanceOf(Promise);
    });
  });
});

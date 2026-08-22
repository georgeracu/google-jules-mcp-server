import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { JulesHttpClient } from "../../../src/core/http-client.js";
import { SessionsClient } from "../../../src/resources/sessions/client.js";
import { sessionCompletedFixture, sessionListFixture } from "../../fixtures/sessions.js";
import { server } from "../../msw/server.js";

const BASE = "https://jules.googleapis.com/v1alpha";

function makeClient() {
  return new SessionsClient(new JulesHttpClient("test-key", BASE));
}

describe("SessionsClient", () => {
  it("createSession POSTs the request body to /sessions", async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/sessions`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(sessionCompletedFixture);
      })
    );

    const request = {
      prompt: "do the thing",
      sourceContext: { source: "sources/github/acme/widget-app" },
    };
    const result = await makeClient().createSession(request);

    expect(result).toEqual(sessionCompletedFixture);
    expect(capturedBody).toEqual(request);
  });

  it("createSession defaults the state when the API omits it", async () => {
    server.use(
      http.post(`${BASE}/sessions`, () => {
        const response: Record<string, unknown> = { ...sessionCompletedFixture };
        delete response.state;
        return HttpResponse.json(response);
      })
    );

    const result = await makeClient().createSession({
      prompt: "do the thing",
      sourceContext: { source: "sources/github/acme/widget-app" },
    });

    expect(result.state).toBe("QUEUED");
  });

  it("listSessions sends pageSize/pageToken as query params", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/sessions`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(sessionListFixture);
      })
    );

    const result = await makeClient().listSessions({ pageSize: 10 });
    expect(result).toEqual(sessionListFixture);
    expect(capturedUrl).toContain("pageSize=10");
  });

  it("getSession fetches /sessions/{id}", async () => {
    server.use(
      http.get(`${BASE}/sessions/1234567890`, () => HttpResponse.json(sessionCompletedFixture))
    );
    expect(await makeClient().getSession("1234567890")).toEqual(sessionCompletedFixture);
  });

  it("encodes a sessionId containing path traversal instead of letting it redirect the request", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/sessions/*`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json(sessionCompletedFixture);
      })
    );

    await makeClient().getSession("../../other-account");

    expect(capturedPath).toBe("/v1alpha/sessions/..%2F..%2Fother-account");
  });

  it("sendMessage POSTs to /sessions/{id}:sendMessage", async () => {
    let capturedPath: string | undefined;
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/sessions/1234567890:sendMessage`, async ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      })
    );

    await makeClient().sendMessage("1234567890", { prompt: "hello" });
    expect(capturedPath).toBe("/v1alpha/sessions/1234567890:sendMessage");
    expect(capturedBody).toEqual({ prompt: "hello" });
  });

  it("approvePlan POSTs an empty body to /sessions/{id}:approvePlan", async () => {
    let capturedBody: unknown;
    server.use(
      http.post(`${BASE}/sessions/1234567890:approvePlan`, async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 200 });
      })
    );

    await makeClient().approvePlan("1234567890");
    expect(capturedBody).toEqual({});
  });

  it("deleteSession issues a DELETE to /sessions/{id}", async () => {
    let capturedMethod: string | undefined;
    server.use(
      http.delete(`${BASE}/sessions/1234567890`, ({ request }) => {
        capturedMethod = request.method;
        return new HttpResponse(null, { status: 200 });
      })
    );

    await makeClient().deleteSession("1234567890");
    expect(capturedMethod).toBe("DELETE");
  });

  it("archiveSession POSTs to /sessions/{id}:archive and returns the updated session", async () => {
    server.use(
      http.post(`${BASE}/sessions/1234567890:archive`, () =>
        HttpResponse.json({ ...sessionCompletedFixture, archived: true })
      )
    );
    const result = await makeClient().archiveSession("1234567890");
    expect(result.archived).toBe(true);
  });

  it("unarchiveSession POSTs to /sessions/{id}:unarchive and returns the updated session", async () => {
    server.use(
      http.post(`${BASE}/sessions/1234567890:unarchive`, () =>
        HttpResponse.json({ ...sessionCompletedFixture, archived: false })
      )
    );
    const result = await makeClient().unarchiveSession("1234567890");
    expect(result.archived).toBe(false);
  });
});

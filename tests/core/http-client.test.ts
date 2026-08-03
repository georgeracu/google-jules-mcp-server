import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  JulesAuthError,
  JulesNetworkError,
  JulesNotFoundError,
  JulesRateLimitError,
  JulesResponseValidationError,
  JulesServerError,
} from "../../src/core/errors.js";
import { JulesHttpClient } from "../../src/core/http-client.js";
import { DEFAULT_RETRY_POLICY } from "../../src/core/retry.js";
import { server } from "../msw/server.js";

const BASE = "https://jules.googleapis.com/v1alpha";
const FAST_POLICY = { ...DEFAULT_RETRY_POLICY, maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5 };

function makeClient(apiKey = "test-api-key") {
  return new JulesHttpClient(apiKey, BASE, FAST_POLICY);
}

describe("JulesHttpClient", () => {
  it("sends the API key header and validates the response against the schema", async () => {
    let receivedApiKey: string | null = null;
    server.use(
      http.get(`${BASE}/ping`, ({ request }) => {
        receivedApiKey = request.headers.get("X-Goog-Api-Key");
        return HttpResponse.json({ ok: true });
      })
    );

    const client = makeClient("secret-key");
    const result = await client.request("/ping", z.object({ ok: z.boolean() }));

    expect(result).toEqual({ ok: true });
    expect(receivedApiKey).toBe("secret-key");
  });

  it("requestVoid succeeds against an empty response body", async () => {
    server.use(http.post(`${BASE}/void`, () => new HttpResponse(null, { status: 200 })));
    const client = makeClient();
    await expect(client.requestVoid("/void", { method: "POST" })).resolves.toBeUndefined();
  });

  it("maps 404 to JulesNotFoundError", async () => {
    server.use(
      http.get(`${BASE}/missing`, () =>
        HttpResponse.json(
          { error: { code: 404, message: "not found", status: "NOT_FOUND" } },
          { status: 404 }
        )
      )
    );
    const client = makeClient();
    await expect(client.request("/missing", z.object({}))).rejects.toThrow(JulesNotFoundError);
  });

  it("maps 401 to JulesAuthError", async () => {
    server.use(
      http.get(`${BASE}/secure`, () =>
        HttpResponse.json(
          { error: { code: 401, message: "bad key", status: "UNAUTHENTICATED" } },
          { status: 401 }
        )
      )
    );
    const client = makeClient();
    await expect(client.request("/secure", z.object({}))).rejects.toThrow(JulesAuthError);
  });

  it("retries a 429 and succeeds, honoring Retry-After", async () => {
    let attempts = 0;
    server.use(
      http.get(`${BASE}/limited`, () => {
        attempts++;
        if (attempts === 1) {
          return HttpResponse.json(
            { error: { code: 429, message: "slow down", status: "RESOURCE_EXHAUSTED" } },
            { status: 429, headers: { "Retry-After": "0" } }
          );
        }
        return HttpResponse.json({ ok: true });
      })
    );
    const client = makeClient();
    const result = await client.request("/limited", z.object({ ok: z.boolean() }));
    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it("exhausts retries on persistent 5xx and throws JulesServerError", async () => {
    server.use(
      http.get(`${BASE}/broken`, () =>
        HttpResponse.json(
          { error: { code: 500, message: "boom", status: "INTERNAL" } },
          { status: 500 }
        )
      )
    );
    const client = makeClient();
    await expect(client.request("/broken", z.object({}))).rejects.toThrow(JulesServerError);
  });

  it("does not retry a 400 client error", async () => {
    let attempts = 0;
    server.use(
      http.get(`${BASE}/bad-request`, () => {
        attempts++;
        return HttpResponse.json({ error: { code: 400, message: "bad input" } }, { status: 400 });
      })
    );
    const client = makeClient();
    await expect(client.request("/bad-request", z.object({}))).rejects.toThrow("bad input");
    expect(attempts).toBe(1);
  });

  it("maps a network failure to JulesNetworkError", async () => {
    server.use(http.get(`${BASE}/unreachable`, () => HttpResponse.error()));
    const client = makeClient();
    await expect(client.request("/unreachable", z.object({}))).rejects.toThrow(JulesNetworkError);
  });

  describe("with a non-Error fetch rejection", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("stringifies the thrown value in the JulesNetworkError message", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue("raw string failure"));
      const client = makeClient();
      await expect(client.request("/anything", z.object({}))).rejects.toThrow("raw string failure");
    });
  });

  it("throws JulesResponseValidationError when the response doesn't match the schema", async () => {
    server.use(http.get(`${BASE}/drifted`, () => HttpResponse.json({ unexpected: "shape" })));
    const client = makeClient();
    await expect(client.request("/drifted", z.object({ expected: z.string() }))).rejects.toThrow(
      JulesResponseValidationError
    );
  });

  describe("proxy dispatcher", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("passes a dispatcher to fetch so HTTP_PROXY/HTTPS_PROXY are honored", async () => {
      const fetchSpy: typeof fetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", fetchSpy);

      const client = makeClient();
      await client.request("/ping", z.object({ ok: z.boolean() }));

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = vi.mocked(fetchSpy).mock.calls[0];
      expect(calledUrl).toBe(`${BASE}/ping`);
      expect(calledInit?.dispatcher).toBeDefined();
    });
  });

  it("exposes retryAfterMs on JulesRateLimitError when retries are exhausted", async () => {
    server.use(
      http.get(`${BASE}/still-limited`, () =>
        HttpResponse.json(
          { error: { code: 429, message: "still slow" } },
          { status: 429, headers: { "Retry-After": "1" } }
        )
      )
    );
    const client = new JulesHttpClient("k", BASE, { ...FAST_POLICY, maxAttempts: 1 });
    await expect(client.request("/still-limited", z.object({}))).rejects.toSatisfy(
      (error: unknown) => error instanceof JulesRateLimitError && error.retryAfterMs === 1000
    );
  });
});

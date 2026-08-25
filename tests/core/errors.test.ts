import { describe, expect, it } from "vitest";

import { formatErrorForUser, JulesApiError, mapResponseToError } from "../../src/core/errors.js";

describe("mapResponseToError", () => {
  it("maps 403 to an auth error", async () => {
    const response = new Response(JSON.stringify({ error: { message: "forbidden" } }), {
      status: 403,
    });
    const error = await mapResponseToError(response);
    expect(error).toBeInstanceOf(JulesApiError);
    expect(error.kind).toBe("auth");
    expect(error.message).toContain("forbidden");
  });

  it("maps other 4xx codes to a client error", async () => {
    const response = new Response(JSON.stringify({ error: { message: "bad" } }), { status: 400 });
    const error = await mapResponseToError(response);
    expect(error).toBeInstanceOf(JulesApiError);
    expect(error.kind).toBe("client");
  });

  it("appends a plain-text body when it isn't JSON", async () => {
    const response = new Response("upstream is on fire", { status: 500 });
    const error = await mapResponseToError(response);
    expect(error).toBeInstanceOf(JulesApiError);
    expect(error.kind).toBe("server");
    expect(error.message).toContain("upstream is on fire");
  });

  it("parses a numeric Retry-After header as seconds", async () => {
    const response = new Response(null, { status: 429, headers: { "Retry-After": "30" } });
    const error = await mapResponseToError(response);
    expect(error.kind).toBe("rate_limit");
    expect(error.retryAfterMs).toBe(30000);
  });

  it("parses an HTTP-date Retry-After header", async () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const response = new Response(null, { status: 429, headers: { "Retry-After": future } });
    const error = await mapResponseToError(response);
    expect(error.kind).toBe("rate_limit");
    if (error.retryAfterMs !== undefined) {
      expect(error.retryAfterMs).toBeGreaterThan(0);
    } else {
      expect(error.retryAfterMs).toBeDefined();
    }
  });

  it("leaves retryAfterMs undefined for an unparsable Retry-After header", async () => {
    const response = new Response(null, { status: 429, headers: { "Retry-After": "not-a-date" } });
    const error = await mapResponseToError(response);
    expect(error.kind).toBe("rate_limit");
    expect(error.retryAfterMs).toBeUndefined();
  });

  it("leaves retryAfterMs undefined when the header is absent", async () => {
    const response = new Response(null, { status: 429 });
    const error = await mapResponseToError(response);
    expect(error.kind).toBe("rate_limit");
    expect(error.retryAfterMs).toBeUndefined();
  });

  it("maps 404 without a JSON body to a not_found error with the default message", async () => {
    const response = new Response(null, { status: 404, statusText: "Not Found" });
    const error = await mapResponseToError(response);
    expect(error).toBeInstanceOf(JulesApiError);
    expect(error.kind).toBe("not_found");
    expect(error.message).toContain("Not Found");
  });
});

describe("formatErrorForUser", () => {
  it("returns the message for Error instances", () => {
    expect(formatErrorForUser(new Error("oops"))).toBe("oops");
  });

  it("returns a generic message for non-Error throws", () => {
    expect(formatErrorForUser("just a string")).toBe("An unknown error occurred");
  });
});

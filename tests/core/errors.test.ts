import { describe, expect, it } from "vitest";

import {
  formatErrorForUser,
  JulesAuthError,
  JulesClientError,
  JulesNotFoundError,
  JulesRateLimitError,
  JulesServerError,
  mapResponseToError,
} from "../../src/core/errors.js";

describe("mapResponseToError", () => {
  it("maps 403 to JulesAuthError", async () => {
    const response = new Response(JSON.stringify({ error: { message: "forbidden" } }), {
      status: 403,
    });
    const error = await mapResponseToError(response);
    expect(error).toBeInstanceOf(JulesAuthError);
    expect(error.message).toContain("forbidden");
  });

  it("maps other 4xx codes to JulesClientError", async () => {
    const response = new Response(JSON.stringify({ error: { message: "bad" } }), { status: 400 });
    expect(await mapResponseToError(response)).toBeInstanceOf(JulesClientError);
  });

  it("appends a plain-text body when it isn't JSON", async () => {
    const response = new Response("upstream is on fire", { status: 500 });
    const error = await mapResponseToError(response);
    expect(error).toBeInstanceOf(JulesServerError);
    expect(error.message).toContain("upstream is on fire");
  });

  it("parses a numeric Retry-After header as seconds", async () => {
    const response = new Response(null, { status: 429, headers: { "Retry-After": "30" } });
    const error = (await mapResponseToError(response)) as JulesRateLimitError;
    expect(error.retryAfterMs).toBe(30000);
  });

  it("parses an HTTP-date Retry-After header", async () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const response = new Response(null, { status: 429, headers: { "Retry-After": future } });
    const error = (await mapResponseToError(response)) as JulesRateLimitError;
    expect(error.retryAfterMs).toBeGreaterThan(0);
  });

  it("leaves retryAfterMs undefined for an unparsable Retry-After header", async () => {
    const response = new Response(null, { status: 429, headers: { "Retry-After": "not-a-date" } });
    const error = (await mapResponseToError(response)) as JulesRateLimitError;
    expect(error.retryAfterMs).toBeUndefined();
  });

  it("leaves retryAfterMs undefined when the header is absent", async () => {
    const response = new Response(null, { status: 429 });
    const error = (await mapResponseToError(response)) as JulesRateLimitError;
    expect(error.retryAfterMs).toBeUndefined();
  });

  it("maps 404 without a JSON body to JulesNotFoundError with the default message", async () => {
    const response = new Response(null, { status: 404, statusText: "Not Found" });
    const error = await mapResponseToError(response);
    expect(error).toBeInstanceOf(JulesNotFoundError);
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

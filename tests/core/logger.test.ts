import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../src/core/logger.js";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes info messages to stderr via console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.info("hello");
    expect(spy).toHaveBeenCalledWith("hello");
  });

  it("writes error messages with an attached error object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const err = new Error("boom");
    logger.error("failed", err);
    expect(spy).toHaveBeenCalledWith("failed", err);
  });

  it("writes error messages without an error object", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("failed");
    expect(spy).toHaveBeenCalledWith("failed");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { getApiKey } from "../../src/core/config.js";

describe("getApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the JULES_API_KEY environment variable when set", () => {
    vi.stubEnv("JULES_API_KEY", "my-secret-key");
    expect(getApiKey()).toBe("my-secret-key");
  });

  it("throws a helpful error when JULES_API_KEY is not set", () => {
    vi.stubEnv("JULES_API_KEY", "");
    expect(() => getApiKey()).toThrow("JULES_API_KEY environment variable is required");
  });
});

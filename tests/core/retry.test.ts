import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { retryWithBackoff, type RetryPolicy } from "../../src/core/retry.js";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const policy: RetryPolicy = {
    maxAttempts: 3,
    baseDelayMs: 10,
    maxDelayMs: 100,
    isRetryable: (error) => error instanceof RangeError,
    retryAfterMs: () => undefined,
  };

  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(retryWithBackoff(fn, policy)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors up to maxAttempts then throws", async () => {
    const fn = vi.fn().mockRejectedValue(new RangeError("always fails"));
    const promise = retryWithBackoff(fn, policy);
    const assertion = expect(promise).rejects.toThrow("always fails");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(policy.maxAttempts);
  });

  it("succeeds after a transient failure", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RangeError("transient"))
      .mockResolvedValueOnce("recovered");
    const promise = retryWithBackoff(fn, policy);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("not retryable"));
    await expect(retryWithBackoff(fn, policy)).rejects.toThrow("not retryable");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("honors policy.retryAfterMs over the computed backoff", async () => {
    const retryAfterPolicy: RetryPolicy = {
      ...policy,
      retryAfterMs: () => 5000,
      maxDelayMs: 2000,
    };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RangeError("rate limited"))
      .mockResolvedValueOnce("ok");
    const promise = retryWithBackoff(fn, retryAfterPolicy);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe("ok");
  });
});

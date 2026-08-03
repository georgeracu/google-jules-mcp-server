import { JulesNetworkError, JulesRateLimitError, JulesServerError } from "./errors.js";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  isRetryable: (error: unknown) => boolean;
  retryAfterMs: (error: unknown) => number | undefined;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5000,
  isRetryable: (error) =>
    error instanceof JulesRateLimitError ||
    error instanceof JulesServerError ||
    error instanceof JulesNetworkError,
  retryAfterMs: (error) => (error instanceof JulesRateLimitError ? error.retryAfterMs : undefined),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelayMs(
  attempt: number,
  policy: RetryPolicy,
  retryAfterMs: number | undefined
): number {
  if (retryAfterMs !== undefined) {
    return Math.min(retryAfterMs, policy.maxDelayMs);
  }
  const exponential = policy.baseDelayMs * 2 ** attempt;
  const jitter = Math.random() * policy.baseDelayMs;
  return Math.min(exponential + jitter, policy.maxDelayMs);
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt >= policy.maxAttempts - 1;
      if (!policy.isRetryable(error) || isLastAttempt) {
        throw error;
      }
      await sleep(computeDelayMs(attempt, policy, policy.retryAfterMs(error)));
    }
  }
}

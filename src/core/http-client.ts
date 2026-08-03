import type { z } from "zod";

import { JULES_API_BASE } from "./config.js";
import { JulesNetworkError, JulesResponseValidationError, mapResponseToError } from "./errors.js";
import { DEFAULT_RETRY_POLICY, retryWithBackoff, type RetryPolicy } from "./retry.js";

/**
 * The only path from a raw fetch response to a typed value: every resource
 * client calls request()/requestVoid() here, never fetch() directly, so
 * retry/backoff, error mapping, and schema validation apply uniformly.
 */
export class JulesHttpClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = JULES_API_BASE,
    private readonly retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY
  ) {}

  async request<S extends z.ZodTypeAny>(
    path: string,
    schema: S,
    init: RequestInit = {}
  ): Promise<z.infer<S>> {
    const raw = await this.rawJson(path, init);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new JulesResponseValidationError(path, parsed.error);
    }
    return parsed.data;
  }

  /** For endpoints whose response body is empty or not needed (delete, archive, unarchive, send-message). */
  async requestVoid(path: string, init: RequestInit = {}): Promise<void> {
    await this.rawJson(path, init);
  }

  private rawJson(path: string, init: RequestInit): Promise<unknown> {
    return retryWithBackoff(() => this.rawFetch(path, init), this.retryPolicy);
  }

  private async rawFetch(path: string, init: RequestInit): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          "X-Goog-Api-Key": this.apiKey,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
    } catch (error) {
      throw new JulesNetworkError(
        `Network error connecting to Jules API: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!response.ok) {
      throw await mapResponseToError(response);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as unknown) : undefined;
  }
}

import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";
import type { z } from "zod";

import { JULES_API_BASE } from "./config.js";
import { JulesApiError, mapResponseToError } from "./errors.js";
import { DEFAULT_RETRY_POLICY, retryWithBackoff, type RetryPolicy } from "./retry.js";

const PROXY_ENV_VARS = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"];

/**
 * Honours HTTP_PROXY/HTTPS_PROXY/NO_PROXY, as set by enterprise proxies, without
 * any config on our side.
 *
 * Both halves are picked together and neither travels alone. Node's global fetch
 * runs on its own bundled undici, so handing it a dispatcher built from this
 * separate copy drops every response header once that dispatcher tunnels through
 * a proxy: content-encoding vanishes and gzipped bodies reach JSON.parse as raw
 * bytes, and retry-after vanishes with it. undici's own fetch keeps them. With no
 * proxy configured there is nothing for the dispatcher to do, so we leave the
 * platform's fetch alone rather than route around it for no gain.
 */
const proxyDispatcher: NonNullable<RequestInit["dispatcher"]> | undefined = PROXY_ENV_VARS.some(
  (name) => process.env[name]
)
  ? new EnvHttpProxyAgent()
  : undefined;

/** Read per request rather than captured: globalThis.fetch is what mocks replace. */
function currentFetch(): typeof globalThis.fetch {
  return proxyDispatcher ? (undiciFetch as unknown as typeof globalThis.fetch) : globalThis.fetch;
}

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
      throw new JulesApiError(
        `Response from ${path} did not match the expected schema: ${parsed.error.message}`,
        { kind: "validation", path, zodError: parsed.error }
      );
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
      response = await currentFetch()(url, {
        ...init,
        dispatcher: proxyDispatcher,
        headers: {
          "X-Goog-Api-Key": this.apiKey,
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
    } catch (error) {
      throw new JulesApiError(
        `Network error connecting to Jules API: ${error instanceof Error ? error.message : String(error)}`,
        { kind: "network" }
      );
    }

    if (!response.ok) {
      throw await mapResponseToError(response);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as unknown) : undefined;
  }
}

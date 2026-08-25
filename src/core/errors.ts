import type { z } from "zod";

export type JulesApiErrorKind =
  "auth" | "not_found" | "rate_limit" | "server" | "client" | "network" | "validation";

export interface JulesApiErrorOptions {
  kind: JulesApiErrorKind;
  status?: number;
  retryAfterMs?: number;
  path?: string;
  zodError?: z.ZodError;
}

export class JulesApiError extends Error {
  public readonly kind: JulesApiErrorKind;
  public readonly status?: number;
  public readonly retryAfterMs?: number;
  public readonly path?: string;
  public readonly zodError?: z.ZodError;

  constructor(message: string, options: JulesApiErrorOptions) {
    super(message);
    this.name = "JulesApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
    this.path = options.path;
    this.zodError = options.zodError;
  }
}

interface JulesErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

/**
 * Builds the right JulesApiError subclass from a non-OK fetch Response.
 * Reads the body once (as text, then attempts JSON parse) so both
 * JSON-structured and plain-text error bodies are handled.
 */
export async function mapResponseToError(response: Response): Promise<JulesApiError> {
  const bodyText = await response.text();
  let message = `Jules API error ${response.status}: ${response.statusText}`;

  if (bodyText) {
    try {
      const body = JSON.parse(bodyText) as JulesErrorBody;
      if (body.error?.message) {
        message = `Jules API error ${response.status}: ${body.error.message}`;
      }
    } catch {
      message += ` - ${bodyText}`;
    }
  }

  if (response.status === 401 || response.status === 403) {
    return new JulesApiError(message, { kind: "auth", status: response.status });
  }
  if (response.status === 404) {
    return new JulesApiError(message, { kind: "not_found", status: response.status });
  }
  if (response.status === 429) {
    return new JulesApiError(message, {
      kind: "rate_limit",
      status: response.status,
      retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
    });
  }
  if (response.status >= 500) {
    return new JulesApiError(message, { kind: "server", status: response.status });
  }
  return new JulesApiError(message, { kind: "client", status: response.status });
}

/**
 * Formats an error for an MCP tool response — the user-facing message
 * without exposing stack traces or internal details.
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unknown error occurred";
}

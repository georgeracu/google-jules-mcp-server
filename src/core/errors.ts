import type { z } from "zod";

export abstract class JulesApiError extends Error {}

export class JulesAuthError extends JulesApiError {
  constructor(message: string) {
    super(message);
    this.name = "JulesAuthError";
  }
}

export class JulesNotFoundError extends JulesApiError {
  constructor(message: string) {
    super(message);
    this.name = "JulesNotFoundError";
  }
}

export class JulesRateLimitError extends JulesApiError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "JulesRateLimitError";
  }
}

export class JulesServerError extends JulesApiError {
  constructor(message: string) {
    super(message);
    this.name = "JulesServerError";
  }
}

export class JulesClientError extends JulesApiError {
  constructor(message: string) {
    super(message);
    this.name = "JulesClientError";
  }
}

export class JulesNetworkError extends JulesApiError {
  constructor(message: string) {
    super(message);
    this.name = "JulesNetworkError";
  }
}

export class JulesResponseValidationError extends JulesApiError {
  constructor(
    public readonly path: string,
    public readonly zodError: z.ZodError
  ) {
    super(`Response from ${path} did not match the expected schema: ${zodError.message}`);
    this.name = "JulesResponseValidationError";
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
    return new JulesAuthError(message);
  }
  if (response.status === 404) {
    return new JulesNotFoundError(message);
  }
  if (response.status === 429) {
    return new JulesRateLimitError(message, parseRetryAfterMs(response.headers.get("retry-after")));
  }
  if (response.status >= 500) {
    return new JulesServerError(message);
  }
  return new JulesClientError(message);
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

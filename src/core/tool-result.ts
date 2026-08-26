import { formatErrorForUser } from "./errors.js";

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

export async function wrap(
  label: string,
  fn: () => Promise<ToolResult>,
  suffix: string = ""
): Promise<ToolResult> {
  try {
    return await fn();
  } catch (error) {
    return errorResult(`${label}: ${formatErrorForUser(error)}${suffix}`);
  }
}

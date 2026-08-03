/**
 * stdout is reserved for the MCP stdio JSON-RPC protocol — every log line here
 * must go to stderr, or it corrupts the protocol stream.
 */
export const logger = {
  info(message: string): void {
    console.error(message);
  },
  error(message: string, error?: unknown): void {
    if (error !== undefined) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  },
};

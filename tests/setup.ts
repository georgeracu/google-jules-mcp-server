import { afterAll, afterEach, beforeAll } from "vitest";

// Cleared before any src module loads: the http client picks its transport from
// these at import time, and only the platform's fetch is one MSW can intercept.
// A developer behind a corporate proxy would otherwise watch the suite dial out.
for (const name of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"]) {
  delete process.env[name];
}

import { server } from "./msw/server.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

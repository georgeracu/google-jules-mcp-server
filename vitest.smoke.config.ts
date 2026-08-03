import { defineConfig } from "vitest/config";

// Separate config, deliberately without tests/setup.ts's MSW server — the
// smoke test must hit the real Jules API, not an intercepted mock response.
export default defineConfig({
  test: {
    include: ["tests/smoke/**/*.test.ts"],
  },
});

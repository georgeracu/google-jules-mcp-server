/**
 * Opt-in smoke test against the real Jules API. Read-only (jules_list_sources
 * only) to avoid burning real task quota on session creation. Excluded from
 * the default `vitest run` and from CI — run explicitly with:
 *
 *   JULES_LIVE_SMOKE_TEST=1 npm run test:smoke
 */
import { describe, expect, it } from "vitest";

import { getApiKey } from "../../src/core/config.js";
import { JulesHttpClient } from "../../src/core/http-client.js";
import { SourcesClient } from "../../src/resources/sources/client.js";

describe.skipIf(!process.env.JULES_LIVE_SMOKE_TEST)("live Jules API", () => {
  it("jules_list_sources round-trips through real schema validation", async () => {
    const client = new SourcesClient(new JulesHttpClient(getApiKey()));
    const result = await client.listSources({ pageSize: 5 });
    expect(result).toBeTypeOf("object");
  });
});

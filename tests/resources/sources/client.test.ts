import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { JulesHttpClient } from "../../../src/core/http-client.js";
import { SourcesClient } from "../../../src/resources/sources/client.js";
import { sourceFixture, sourceListFixture } from "../../fixtures/sources.js";
import { server } from "../../msw/server.js";

const BASE = "https://jules.googleapis.com/v1alpha";

function makeClient() {
  return new SourcesClient(new JulesHttpClient("test-key", BASE));
}

describe("SourcesClient", () => {
  it("listSources sends pageSize/pageToken as query params and validates the response", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/sources`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(sourceListFixture);
      })
    );

    const result = await makeClient().listSources({ pageSize: 25, pageToken: "abc" });

    expect(result).toEqual(sourceListFixture);
    expect(capturedUrl).toContain("pageSize=25");
    expect(capturedUrl).toContain("pageToken=abc");
  });

  it("listSources sends filter as a query param", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/sources`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(sourceListFixture);
      })
    );

    await makeClient().listSources({ filter: "owner=acme" });

    expect(capturedUrl).toContain(`filter=${encodeURIComponent("owner=acme")}`);
  });

  it("getSource builds the sources/github/{owner}/{repo} path", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/sources/github/acme/widget-app`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json(sourceFixture);
      })
    );

    const result = await makeClient().getSource("acme", "widget-app");

    expect(result).toEqual(sourceFixture);
    expect(capturedPath).toBe("/v1alpha/sources/github/acme/widget-app");
  });

  it("encodes a repoName containing path traversal instead of letting it redirect the request", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/sources/github/acme/*`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json(sourceFixture);
      })
    );

    await makeClient().getSource("acme", "../../other-owner/other-repo");

    expect(capturedPath).toBe("/v1alpha/sources/github/acme/..%2F..%2Fother-owner%2Fother-repo");
  });
});

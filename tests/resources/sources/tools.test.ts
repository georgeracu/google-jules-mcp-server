import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { JulesHttpClient } from "../../../src/core/http-client.js";
import { SourcesClient } from "../../../src/resources/sources/client.js";
import { createSourceHandlers, registerSourceTools } from "../../../src/resources/sources/tools.js";
import { server } from "../../msw/server.js";

const BASE = "https://jules.googleapis.com/v1alpha";

function makeHandlers() {
  return createSourceHandlers(new SourcesClient(new JulesHttpClient("test-key", BASE)));
}

describe("source tool handlers", () => {
  it("listSources returns a text result on success", async () => {
    let requests = 0;
    server.use(
      http.get(`${BASE}/sources`, () => {
        requests++;
        if (requests === 1) {
          return HttpResponse.json({
            sources: [{ id: "github/acme/repo1", name: "sources/github/acme/repo1" }],
            nextPageToken: "token-2",
          });
        }
        return HttpResponse.json({
          sources: [{ id: "github/acme/repo2", name: "sources/github/acme/repo2" }],
        });
      })
    );

    const result = await makeHandlers().listSources({});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Connected repositories (2)");
    expect(result.content[0].text).toContain("repo1");
    expect(result.content[0].text).toContain("repo2");
    expect(requests).toBe(2);
  });

  it("listSources returns an error result on failure", async () => {
    server.use(
      http.get(`${BASE}/sources`, () =>
        HttpResponse.json({ error: { message: "down" } }, { status: 500 })
      )
    );
    const result = await makeHandlers().listSources({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error listing sources");
  });

  it("getSource returns a text result on success", async () => {
    const result = await makeHandlers().getSource({ repoOwner: "acme", repoName: "widget-app" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("acme/widget-app");
  });

  it("getSource returns an error result with troubleshooting hints on failure", async () => {
    server.use(
      http.get(`${BASE}/sources/github/acme/missing`, () =>
        HttpResponse.json({ error: { code: 404, message: "not found" } }, { status: 404 })
      )
    );
    const result = await makeHandlers().getSource({ repoOwner: "acme", repoName: "missing" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Repository not connected to Jules");
  });
});

describe("registerSourceTools", () => {
  it("registers jules_list_sources and jules_get_source with a working handler", async () => {
    const mcpServer = new McpServer({ name: "test", version: "0.0.0" });
    const registerSpy = vi.spyOn(mcpServer, "registerTool");

    registerSourceTools(mcpServer, new SourcesClient(new JulesHttpClient("test-key", BASE)));

    expect(registerSpy).toHaveBeenCalledTimes(2);
    const names = registerSpy.mock.calls.map((call) => call[0]);
    expect(names).toEqual(["jules_list_sources", "jules_get_source"]);

    const listSourcesHandler = registerSpy.mock.calls[0][2] as (args: object) => Promise<{
      content: Array<{ text: string }>;
    }>;
    const result = await listSourcesHandler({});
    expect(result.content[0].text).toContain("Connected repositories");
  });
});

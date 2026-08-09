import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { JulesHttpClient } from "../../../src/core/http-client.js";
import { ActivitiesClient } from "../../../src/resources/activities/client.js";
import { activityListFixture, activityPlanGeneratedFixture } from "../../fixtures/activities.js";
import { server } from "../../msw/server.js";

const BASE = "https://jules.googleapis.com/v1alpha";

function makeClient() {
  return new ActivitiesClient(new JulesHttpClient("test-key", BASE));
}

describe("ActivitiesClient", () => {
  it("listActivities builds the sessions/{id}/activities path with pageSize/pageToken", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get(`${BASE}/sessions/1234567890/activities`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(activityListFixture);
      })
    );

    const result = await makeClient().listActivities("1234567890", {
      pageSize: 5,
      pageToken: "tok",
    });

    expect(result).toEqual(activityListFixture);
    expect(capturedUrl).toContain("pageSize=5");
    expect(capturedUrl).toContain("pageToken=tok");
  });

  it("getActivity builds the sessions/{id}/activities/{activityId} path", async () => {
    server.use(
      http.get(`${BASE}/sessions/1234567890/activities/a1`, () =>
        HttpResponse.json(activityPlanGeneratedFixture)
      )
    );

    const result = await makeClient().getActivity("1234567890", "a1");
    expect(result).toEqual(activityPlanGeneratedFixture);
  });

  it("encodes an activityId containing path traversal instead of letting it redirect the request", async () => {
    let capturedPath: string | undefined;
    server.use(
      http.get(`${BASE}/sessions/1234567890/activities/*`, ({ request }) => {
        capturedPath = new URL(request.url).pathname;
        return HttpResponse.json(activityPlanGeneratedFixture);
      })
    );

    await makeClient().getActivity("1234567890", "../../sessions/other-session");

    expect(capturedPath).toBe(
      "/v1alpha/sessions/1234567890/activities/..%2F..%2Fsessions%2Fother-session"
    );
  });
});

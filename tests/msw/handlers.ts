import { http, HttpResponse } from "msw";

import { JULES_API_BASE } from "../../src/core/config.js";
import { activityListFixture } from "../fixtures/activities.js";
import { sessionCompletedFixture, sessionListFixture } from "../fixtures/sessions.js";
import { sourceFixture, sourceListFixture } from "../fixtures/sources.js";

const BASE = JULES_API_BASE.replace(/[.]/g, "\\.");

export const defaultHandlers = [
  http.get(`${JULES_API_BASE}/sources`, () => HttpResponse.json(sourceListFixture)),
  http.get(new RegExp(`^${BASE}/sources/github/[^/]+/[^/]+$`), () =>
    HttpResponse.json(sourceFixture)
  ),

  http.post(`${JULES_API_BASE}/sessions`, () => HttpResponse.json(sessionCompletedFixture)),
  http.get(`${JULES_API_BASE}/sessions`, () => HttpResponse.json(sessionListFixture)),
  http.get(new RegExp(`^${BASE}/sessions/[^/:]+$`), () =>
    HttpResponse.json(sessionCompletedFixture)
  ),
  http.delete(
    new RegExp(`^${BASE}/sessions/[^/:]+$`),
    () => new HttpResponse(null, { status: 200 })
  ),
  http.post(
    new RegExp(`^${BASE}/sessions/[^/:]+:sendMessage$`),
    () => new HttpResponse(null, { status: 200 })
  ),
  http.post(
    new RegExp(`^${BASE}/sessions/[^/:]+:approvePlan$`),
    () => new HttpResponse(null, { status: 200 })
  ),
  http.post(new RegExp(`^${BASE}/sessions/[^/:]+:archive$`), () =>
    HttpResponse.json(sessionCompletedFixture)
  ),
  http.post(new RegExp(`^${BASE}/sessions/[^/:]+:unarchive$`), () =>
    HttpResponse.json(sessionCompletedFixture)
  ),

  http.get(new RegExp(`^${BASE}/sessions/[^/]+/activities/[^/]+$`), () =>
    HttpResponse.json(activityListFixture.activities[0])
  ),
  http.get(new RegExp(`^${BASE}/sessions/[^/]+/activities(\\?.*)?$`), () =>
    HttpResponse.json(activityListFixture)
  ),
];

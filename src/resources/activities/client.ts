import type { JulesHttpClient } from "../../core/http-client.js";
import { buildPageQuery } from "../../shared/pagination.js";
import { ActivityListSchema, ActivitySchema, type Activity, type ActivityList } from "./schemas.js";

export class ActivitiesClient {
  constructor(private readonly http: JulesHttpClient) {}

  listActivities(
    sessionId: string,
    params: { pageSize?: number; pageToken?: string }
  ): Promise<ActivityList> {
    return this.http.request(
      `/sessions/${encodeURIComponent(sessionId)}/activities${buildPageQuery(params)}`,
      ActivityListSchema
    );
  }

  getActivity(sessionId: string, activityId: string): Promise<Activity> {
    return this.http.request(
      `/sessions/${encodeURIComponent(sessionId)}/activities/${encodeURIComponent(activityId)}`,
      ActivitySchema
    );
  }
}

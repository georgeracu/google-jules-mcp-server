import type { JulesHttpClient } from "../../core/http-client.js";
import { buildPageQuery } from "../../shared/pagination.js";
import { SourceListSchema, SourceSchema, type Source, type SourceList } from "./schemas.js";

export class SourcesClient {
  constructor(private readonly http: JulesHttpClient) {}

  listSources(params: {
    pageSize?: number;
    pageToken?: string;
    filter?: string;
  }): Promise<SourceList> {
    return this.http.request(`/sources${buildPageQuery(params)}`, SourceListSchema);
  }

  getSource(repoOwner: string, repoName: string): Promise<Source> {
    return this.http.request(
      `/sources/github/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}`,
      SourceSchema
    );
  }
}

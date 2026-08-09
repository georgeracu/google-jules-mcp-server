import type { JulesHttpClient } from "../../core/http-client.js";
import { buildPageQuery } from "../../shared/pagination.js";
import {
  SessionListSchema,
  SessionSchema,
  type CreateSessionRequest,
  type SendMessageRequest,
  type Session,
  type SessionList,
} from "./schemas.js";

export class SessionsClient {
  constructor(private readonly http: JulesHttpClient) {}

  createSession(request: CreateSessionRequest): Promise<Session> {
    return this.http.request("/sessions", SessionSchema, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  listSessions(params: { pageSize?: number; pageToken?: string }): Promise<SessionList> {
    return this.http.request(`/sessions${buildPageQuery(params)}`, SessionListSchema);
  }

  getSession(sessionId: string): Promise<Session> {
    return this.http.request(`/sessions/${encodeURIComponent(sessionId)}`, SessionSchema);
  }

  sendMessage(sessionId: string, request: SendMessageRequest): Promise<void> {
    return this.http.requestVoid(`/sessions/${encodeURIComponent(sessionId)}:sendMessage`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  approvePlan(sessionId: string): Promise<void> {
    return this.http.requestVoid(`/sessions/${encodeURIComponent(sessionId)}:approvePlan`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  deleteSession(sessionId: string): Promise<void> {
    return this.http.requestVoid(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  }

  archiveSession(sessionId: string): Promise<Session> {
    return this.http.request(`/sessions/${encodeURIComponent(sessionId)}:archive`, SessionSchema, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  unarchiveSession(sessionId: string): Promise<Session> {
    return this.http.request(
      `/sessions/${encodeURIComponent(sessionId)}:unarchive`,
      SessionSchema,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
  }
}

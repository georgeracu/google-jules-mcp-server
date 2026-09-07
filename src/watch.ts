import { getApiKey } from "./core/config.js";
import { JulesHttpClient } from "./core/http-client.js";
import { logger } from "./core/logger.js";
import { SessionsClient } from "./resources/sessions/client.js";
import type { Session } from "./resources/sessions/schemas.js";

// Exported for testing
export async function pollStuckSessions(
  sessionsClient: SessionsClient,
  webhookUrl: string,
  seenStates: Map<string, string>
): Promise<void> {
  try {
    const stuckSessions: Session[] = [];
    let sessionsScanned = 0;
    let pageToken: string | undefined;

    // Follow jules_list_stuck_sessions logic to fetch
    for (let page = 0; page < 5 && sessionsScanned < 500; page++) {
      const data = await sessionsClient.listSessions({ pageSize: 50, pageToken });
      const pageSessions = (data.sessions ?? []).slice(0, 500 - sessionsScanned);
      sessionsScanned += pageSessions.length;
      for (const session of pageSessions) {
        if (
          session.state === "AWAITING_PLAN_APPROVAL" ||
          session.state === "AWAITING_USER_FEEDBACK"
        ) {
          stuckSessions.push(session);
        } else {
          // A later re-entry into a stuck state should notify again.
          seenStates.delete(session.id);
        }
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }

    // Process found stuck sessions
    for (const session of stuckSessions) {
      const prevState = seenStates.get(session.id);
      if (prevState !== session.state) {
        // State changed to stuck, or new stuck session
        logger.info(`Session ${session.id} entered state ${session.state}, notifying webhook...`);

        try {
          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: session.id,
              title: session.title,
              state: session.state,
              url: session.url,
            }),
          });

          if (!response.ok) {
            logger.error(`Webhook failed with status ${response.status} ${response.statusText}`);
          } else if (session.state) {
            // Only update seen states if webhook succeeded, so we retry on failure
            seenStates.set(session.id, session.state);
          }
        } catch (error) {
          logger.error("Failed to POST to webhook:", error);
        }
      }
    }
  } catch (error) {
    logger.error("Error polling stuck sessions:", error);
  }
}

export async function startWatcher(): Promise<never> {
  const apiKey = getApiKey();
  const http = new JulesHttpClient(apiKey);
  const sessions = new SessionsClient(http);

  const webhookUrl = process.env.JULES_WATCH_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error(
      "JULES_WATCH_WEBHOOK_URL environment variable is required to run the session watcher."
    );
  }

  const intervalSecondsStr = process.env.JULES_WATCH_INTERVAL_SECONDS ?? "60";
  const intervalSeconds = parseInt(intervalSecondsStr, 10);
  if (isNaN(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error("JULES_WATCH_INTERVAL_SECONDS must be a positive integer.");
  }

  const seenStates = new Map<string, string>();

  logger.info(`Jules session watcher started.`);
  logger.info(`Polling interval: ${intervalSeconds} seconds`);
  logger.info(`Webhook URL: ${webhookUrl}`);

  // Initial poll right away
  await pollStuckSessions(sessions, webhookUrl, seenStates);

  // Then loop
  setInterval(() => {
    pollStuckSessions(sessions, webhookUrl, seenStates).catch((error) => {
      logger.error("Unexpected error in watcher loop:", error);
    });
  }, intervalSeconds * 1000);

  // Return a never-resolving promise to keep the process alive
  return new Promise(() => {
    // Keep alive
  });
}

export const JULES_API_BASE = "https://jules.googleapis.com/v1alpha";

export function getApiKey(): string {
  const apiKey = process.env.JULES_API_KEY;
  if (!apiKey) {
    throw new Error(
      "JULES_API_KEY environment variable is required. " +
        "Get your API key from https://jules.google.com/settings#api"
    );
  }
  return apiKey;
}

/** Returns whether session creation is permitted for an owner/repo pair. */
export function isRepositoryAllowed(repoOwner: string, repoName: string): boolean {
  const raw = process.env.JULES_REPOSITORY_ALLOWLIST;
  if (!raw || raw.trim() === "") return true;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(`${repoOwner}/${repoName}`);
}

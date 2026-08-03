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

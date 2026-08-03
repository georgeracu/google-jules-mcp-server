import type { Source, SourceList } from "./schemas.js";

function formatSourceSummary(source: Source): string {
  const repo = source.githubRepo;
  if (!repo) return `- ${source.name} (${source.id})`;
  const privacy = repo.isPrivate ? "private" : "public";
  const branches = repo.branches?.map((b) => b.displayName).join(", ") || "unknown";
  return `- ${repo.owner}/${repo.repo} (${privacy})\n  Branches: ${branches}\n  Source name: ${source.name}`;
}

export function formatSourceList(data: SourceList): string {
  if (!data.sources || data.sources.length === 0) {
    return (
      "No repositories connected to Jules.\n\n" +
      "To connect repositories:\n" +
      "1. Visit https://jules.google.com\n" +
      "2. Click 'Connect to GitHub account'\n" +
      "3. Authorize the Jules GitHub app\n" +
      "4. Select repositories to grant access"
    );
  }

  const sourcesList = data.sources.map(formatSourceSummary).join("\n\n");
  let response = `Connected repositories (${data.sources.length}):\n\n${sourcesList}`;
  if (data.nextPageToken) {
    response += `\n\nMore results available. Use pageToken: ${data.nextPageToken}`;
  }
  return response;
}

export function formatSource(source: Source): string {
  const repo = source.githubRepo;
  if (!repo) return `${source.name} (${source.id})`;
  return (
    `${repo.owner}/${repo.repo} (${repo.isPrivate ? "private" : "public"})\n` +
    `Default branch: ${repo.defaultBranch?.displayName || "unknown"}\n` +
    `Branches: ${repo.branches?.map((b) => b.displayName).join(", ") || "unknown"}\n` +
    `Source name: ${source.name}`
  );
}

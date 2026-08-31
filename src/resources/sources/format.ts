import type { Source, SourceList } from "./schemas.js";

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

  const sourcesList = data.sources.map((s) => formatSource(s, { summary: true })).join("\n\n");
  let response = `Connected repositories (${data.sources.length}):\n\n${sourcesList}`;
  if (data.nextPageToken) {
    response += `\n\nMore results available, but the output limit was reached.`;
  }
  return response;
}

export function formatSource(source: Source, options?: { summary?: boolean }): string {
  const repo = source.githubRepo;
  if (!repo)
    return options?.summary ? `- ${source.name} (${source.id})` : `${source.name} (${source.id})`;

  const privacy = repo.isPrivate ? "private" : "public";
  const branches = repo.branches?.map((b) => b.displayName).join(", ") || "unknown";

  if (options?.summary) {
    return `- ${repo.owner}/${repo.repo} (${privacy})\n  Branches: ${branches}\n  Source name: ${source.name}`;
  }

  return (
    `${repo.owner}/${repo.repo} (${privacy})\n` +
    `Default branch: ${repo.defaultBranch?.displayName || "unknown"}\n` +
    `Branches: ${branches}\n` +
    `Source name: ${source.name}`
  );
}

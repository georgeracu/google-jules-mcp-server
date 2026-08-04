# google-jules-mcp-server

[![CI](https://github.com/georgeracu/google-jules-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/georgeracu/google-jules-mcp-server/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/georgeracu/google-jules-mcp-server/branch/main/graph/badge.svg)](https://codecov.io/gh/georgeracu/google-jules-mcp-server)
[![npm version](https://img.shields.io/npm/v/google-jules-mcp-server.svg)](https://www.npmjs.com/package/google-jules-mcp-server)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-google--jules--mcp--server-blue)](https://registry.modelcontextprotocol.io/?search=google-jules-mcp-server)

Model Context Protocol (MCP) server for Google's Jules AI coding agent — unofficial. Lets AI assistants like Claude create and manage asynchronous coding tasks through the Jules API v1alpha.

## Overview

Jules is Google's AI coding agent that executes development tasks in isolated cloud VMs — generating code, fixing bugs, writing tests, updating dependencies, and refactoring across files. This server exposes the full Jules API surface as 13 MCP tools, covering repository sources, session lifecycle, and activity logs.

Tasks run asynchronously and typically complete in 5–60 minutes depending on complexity.

## Architecture

The server is organized by Jules resource domain rather than as one flat file:

```
src/
├── index.ts                 # entrypoint: connects the stdio transport
├── server.ts                 # createServer(): wires the MCP server + all tool registrations
├── core/                     # transport-agnostic: auth, HTTP client, retry/backoff, typed errors, logging
└── resources/
    ├── sources/               # jules_list_sources, jules_get_source
    ├── sessions/              # session lifecycle (create/list/status/message/approve/output/delete/archive/unarchive)
    └── activities/            # jules_list_activities, jules_get_activity
```

Each resource module owns its own [Zod](https://zod.dev) schemas, a typed API client, and its MCP tool registrations. Zod schemas are the single source of truth: TypeScript types are inferred from them (`z.infer`), and every Jules API response is validated at runtime through `core/http-client.ts` — so a drifted API response fails loudly as a `JulesResponseValidationError` instead of silently producing `undefined`s downstream.

`core/http-client.ts` also centralizes retry-with-backoff (bounded, honors `Retry-After`) and a typed error hierarchy (`JulesAuthError`, `JulesNotFoundError`, `JulesRateLimitError`, `JulesServerError`, `JulesClientError`, `JulesNetworkError`, `JulesResponseValidationError`) so callers can distinguish failure modes programmatically rather than pattern-matching error strings.

## Prerequisites

1. **Google Account** with Jules access
2. **Jules API Key** — get one from https://jules.google.com/settings#api (up to 3 keys allowed)
3. **GitHub Integration** — install the Jules GitHub app at https://jules.google.com to connect repositories
4. **Node.js** 22+

## Quick Start

### 1. Install

The package is published on npm as [`google-jules-mcp-server`](https://www.npmjs.com/package/google-jules-mcp-server). Most MCP clients can run it directly via `npx` — no separate install step needed, skip to step 2.

If you'd rather install it once instead of letting your client invoke `npx` on every launch:

```bash
npm install -g google-jules-mcp-server
```

This puts a `google-jules-mcp` binary on your `PATH`.

**Building from source** (for contributors, or to run unreleased changes):

```bash
git clone https://github.com/georgeracu/google-jules-mcp-server.git
cd google-jules-mcp-server
npm install
npm run build
```

### 2. Configure your API key

Get a key from https://jules.google.com/settings#api. Set it directly in your MCP client's server config (see below) — that's the only place it needs to live for normal use.

If you're building from source and want to run `npm run test:smoke` or use `.env` for local scripts:

```bash
cp .env.example .env
# edit .env and set JULES_API_KEY
```

### 3. Register the server with your MCP client

**Claude Desktop** — edit the config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "jules": {
      "command": "npx",
      "args": ["-y", "google-jules-mcp-server"],
      "env": { "JULES_API_KEY": "your_actual_jules_api_key_here" }
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add jules -s user -e JULES_API_KEY=your_actual_jules_api_key_here -- npx -y google-jules-mcp-server
```

**GitHub Copilot CLI**:

```bash
copilot mcp add jules -e JULES_API_KEY=your_actual_jules_api_key_here -- npx -y google-jules-mcp-server
```

Or edit `~/.copilot/mcp-config.json` directly:

```json
{
  "mcpServers": {
    "jules": {
      "type": "local",
      "command": "npx",
      "args": ["-y", "google-jules-mcp-server"],
      "env": { "JULES_API_KEY": "your_actual_jules_api_key_here" },
      "tools": ["*"]
    }
  }
}
```

**VS Code** (Copilot Chat agent mode) — via terminal:

```bash
code --add-mcp '{"name":"jules","command":"npx","args":["-y","google-jules-mcp-server"],"env":{"JULES_API_KEY":"your_actual_jules_api_key_here"}}'
```

Or add to `.vscode/mcp.json` (workspace) or via **MCP: Open User Configuration** (user-level):

```json
{
  "servers": {
    "jules": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "google-jules-mcp-server"],
      "env": { "JULES_API_KEY": "your_actual_jules_api_key_here" }
    }
  }
}
```

**Cursor** — add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project-only):

```json
{
  "mcpServers": {
    "jules": {
      "command": "npx",
      "args": ["-y", "google-jules-mcp-server"],
      "env": { "JULES_API_KEY": "your_actual_jules_api_key_here" }
    }
  }
}
```

**OpenAI Codex CLI**:

```bash
codex mcp add jules --env JULES_API_KEY=your_actual_jules_api_key_here -- npx -y google-jules-mcp-server
```

Or edit `~/.codex/config.toml` directly:

```toml
[mcp_servers.jules]
command = "npx"
args = ["-y", "google-jules-mcp-server"]
env = { JULES_API_KEY = "your_actual_jules_api_key_here" }
```

If you installed globally instead, replace `"command": "npx", "args": ["-y", "google-jules-mcp-server"]` with `"command": "google-jules-mcp", "args": []` (and any `npx -y google-jules-mcp-server` in a CLI command above with just `google-jules-mcp`).

If you're running from a local clone instead, use `"command": "node", "args": ["/absolute/path/to/google-jules-mcp-server/build/index.js"]` (an absolute path to `build/index.js`).

Restart your client after editing its config.

### 4. Verify

Ask your assistant: "List my Jules repositories." You should see the `jules` server connected with 13 tools available.

## Available Tools

| Tool                       | Purpose                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| `jules_list_sources`       | List GitHub repositories connected to Jules                             |
| `jules_get_source`         | Get details (branches, visibility) for one connected repository         |
| `jules_create_session`     | Start a new asynchronous coding task                                    |
| `jules_list_sessions`      | List sessions and their states                                          |
| `jules_get_status`         | Check a session's status and recent activity                            |
| `jules_send_message`       | Send a follow-up instruction to a running session                       |
| `jules_approve_plan`       | Approve a session's execution plan (when `requirePlanApproval` was set) |
| `jules_get_session_output` | Retrieve the final output (PR details) of a completed session           |
| `jules_delete_session`     | Permanently delete a session                                            |
| `jules_archive_session`    | Archive a session without deleting it                                   |
| `jules_unarchive_session`  | Restore an archived session                                             |
| `jules_list_activities`    | Get a session's detailed activity log                                   |
| `jules_get_activity`       | Get a single activity by ID                                             |

## Async Workflow Pattern

1. **Create** a session — returns immediately with a session ID.
2. **Poll** every 10–30 seconds with `jules_get_status`.
3. **Monitor** detailed progress with `jules_list_activities`.
4. **Retrieve** the pull request URL once state is `COMPLETED`, via `jules_get_session_output`.

Your assistant handles this polling loop automatically when asked to monitor a task.

## Rate Limits and Quotas

Jules enforces task quotas based on subscription tier (Free: 15 daily / 3 concurrent; Google AI Pro: ~75 daily / 15 concurrent; Google AI Ultra: ~300 daily / 60 concurrent). Tasks count against quota even if they fail, on a rolling 24-hour window.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full setup and PR checklist, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

```bash
npm run dev              # tsc --watch
npm run lint              # eslint
npm run format             # prettier --check
npm run typecheck           # tsc --noEmit
npm test                    # vitest run
npm run test:coverage        # vitest run --coverage (enforces threshold)
npm run test:watch            # vitest
npm run inspector               # MCP Inspector — exercise tools without a full client
```

### Testing strategy

Unit tests use [MSW](https://mswjs.io) to intercept HTTP at the network layer rather than mocking the client module directly — this means `core/http-client.ts`'s own logic (auth headers, retry/backoff, error mapping, Retry-After parsing) is exercised by tests, not just the handlers built on top of it. Fixtures in `tests/fixtures/` encode real, previously-verified Jules API response shapes as MSW mock bodies; because the real client parses them through the Zod schemas at test time, a schema/fixture mismatch fails the test suite immediately.

`tests/smoke/live-api.smoke.test.ts` is an opt-in, read-only smoke test against the real Jules API (`jules_list_sources` only, to avoid spending task quota). It's excluded from `npm test` and CI, and only runs via:

```bash
JULES_LIVE_SMOKE_TEST=1 npm run test:smoke
```

### Adding a new tool

1. Add/extend the resource's `schemas.ts` (Zod schema + inferred type).
2. Add the API call to that resource's `client.ts`.
3. Add formatting logic to `format.ts` and the handler + `registerTool` call to `tools.ts`.
4. Add MSW-backed tests for the client, format, and tool-handler layers.

## Troubleshooting

- **Tools not appearing**: verify the absolute path in your client config, confirm `build/index.js` exists (`npm run build`), and restart the client completely.
- **"JULES_API_KEY environment variable is required"**: the key isn't set in your client's server config `env` block.
- **"No repositories connected to Jules"**: visit https://jules.google.com, connect your GitHub account, and grant repository access.
- **401 / 403 / 404**: 401 means an invalid API key (regenerate at the settings link above), 403 means insufficient permissions or exceeded quota, 404 means the session or repository ID doesn't exist.

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for how to report it privately.

## API Reference

- **Base URL**: `https://jules.googleapis.com/v1alpha`
- **Authentication**: `X-Goog-Api-Key` header
- **Jules web app**: https://jules.google.com

## License

MIT

## Changelog

See [GitHub Releases](https://github.com/georgeracu/google-jules-mcp-server/releases) — every published version gets an auto-generated release with notes grouped by change type.

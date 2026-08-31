# Contributing

## Setup

```bash
git clone https://github.com/georgeracu/google-jules-mcp-server.git
cd google-jules-mcp-server
npm install
cp .env.example .env   # set JULES_API_KEY if you'll run the smoke test
```

## Before opening a PR

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run format
npm run build
```

All of these run in CI (`.github/workflows/ci.yml`) and must pass before a PR can merge — `main` is a protected branch with required status checks.

## Testing

Unit tests use [MSW](https://mswjs.io) to intercept HTTP at the network layer rather than mocking the client module, so `core/http-client.ts`'s own logic (auth headers, retry/backoff, error mapping) is exercised, not just the handlers built on top of it. Fixtures in `tests/fixtures/` encode real Jules API response shapes; a schema/fixture mismatch fails the suite immediately.

`tests/smoke/live-api.smoke.test.ts` is an opt-in, read-only test against the real Jules API. It's excluded from `npm test` and CI — only run it locally with `JULES_LIVE_SMOKE_TEST=1 npm run test:smoke`, and never against a paid account you don't control.

## Adding a new tool

1. Add/extend the resource's `schemas.ts` (Zod schema + inferred type).
2. Add the API call to that resource's `client.ts`.
3. Add formatting logic to `format.ts` and the handler + `registerTool` call to `tools.ts`.
4. Add MSW-backed tests for the client, format, and tool-handler layers.

## Code style

Formatting and lint rules are enforced by Prettier and ESLint (`npm run format`, `npm run lint`) — no need to debate style in review. Prefer editing existing files over adding new abstractions; avoid comments that restate what the code does.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
`chore:`, `ci:`, `test:`, `build:`, etc.) — [release-please](https://github.com/googleapis/release-please)
reads these to decide the next version and to write the changelog, so an unprefixed or
mislabelled commit either fails to bump the version or lands in the wrong changelog section.
This repo merges via merge commit rather than squash, so every individual commit on `main` is
read, not just the PR title.

## Releasing

Versioning and changelog generation are automated by
[release-please](https://github.com/googleapis/release-please)
(config in [`release-please-config.json`](release-please-config.json), current version tracked in
[`.release-please-manifest.json`](.release-please-manifest.json)). On every push to `main`,
[`.github/workflows/release-please.yml`](.github/workflows/release-please.yml) either opens or
updates a standing "chore(release): x.y.z" pull request containing the version bump (`package.json`,
`package-lock.json`, `server.json`) and the generated `CHANGELOG.md` entry.

Review and merge that PR like any other — `main`'s branch protection (required PR, required
`build-and-test` check, no admin bypass) applies to it the same as everything else. Merging it
is what triggers the release: release-please creates the GitHub Release and pushes the `vX.Y.Z`
tag, which in turn triggers [`.github/workflows/release.yml`](.github/workflows/release.yml) to
`npm publish` and publish to the MCP Registry.

Authentication for npm is via npm's [Trusted Publisher](https://docs.npmjs.com/trusted-publishers)
(OIDC) — no stored npm token, and provenance attestation is generated automatically. This requires
a one-time setup on npmjs.com: package Settings → Trusted Publisher → GitHub Actions, with
organization/user `georgeracu`, repository `google-jules-mcp-server`, workflow filename
`release.yml`, no environment.

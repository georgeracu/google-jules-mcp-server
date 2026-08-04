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

Clear, imperative summary of what changed and why (e.g. `Add retry backoff for 429 responses`). No required prefix convention.

## Releasing

Publishing to npm is automated via `.github/workflows/release.yml`, triggered by pushing a `vX.Y.Z` tag that matches `package.json`'s version. `main` requires a PR (no direct pushes, even for admins), so the version bump has to land before the tag:

```bash
git checkout -b release/vX.Y.Z
npm version patch --no-git-tag-version   # or minor / major — bumps package.json only
git commit -am "vX.Y.Z"
git push -u origin release/vX.Y.Z
gh pr create --fill
```

Once that PR merges:

```bash
git checkout main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
```

Tag pushes aren't covered by `main`'s branch protection, so this last step doesn't need a PR.

The workflow re-runs lint/typecheck/tests/build (via `prepublishOnly`) and refuses to publish if the tag doesn't match `package.json`'s version, then runs `npm publish`. Authentication is via npm's [Trusted Publisher](https://docs.npmjs.com/trusted-publishers) (OIDC) — no stored npm token, and provenance attestation is generated automatically. This requires a one-time setup on npmjs.com: package Settings → Trusted Publisher → GitHub Actions, with organization/user `georgeracu`, repository `google-jules-mcp-server`, workflow filename `release.yml`, no environment.

After publishing, the workflow also creates a GitHub Release for the tag with auto-generated notes (`gh release create --generate-notes`), grouped into categories by PR label per `.github/release.yml` (Dependabot PRs are auto-labeled `dependencies`; use `enhancement`/`bug`/`breaking-change` on your own PRs to get them categorized correctly).

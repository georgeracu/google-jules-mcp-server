# AGENTS.md

## Project Overview

- **Core Stack**: Node.js (>=22.0.0), TypeScript, Model Context Protocol (MCP) SDK.
- **Purpose**: Google Jules API (v1alpha) integration server enabling LLM tool calling via MCP stdio transport.

## Single Source of Truth for Code Style

- **Do NOT duplicate style configurations** in this file.
- **Rule**: You must dynamically check the local project configuration files (`package.json`, `tsconfig.json`, `.prettierrc.json`, or `eslint.config.js` if present) to read the formatting and lint rules.
- **Validation**: Run the verification commands listed below before committing or completing any task to ensure code complies with local rules.

## Build & Test Commands

- **Install Dependencies**: `npm install` or `npm ci`
- **Compile**: `npm run build`
- **Type Check**: `npm run typecheck` or `npx tsc --noEmit`
- **Lint Verification**: `npm run lint` (ESLint flat config)
- **Format Check**: `npm run format` (Prettier check)
- **Format Fix**: `npm run format:fix` (Prettier fix)
- **Run Tests**: `npm test` (Vitest unit test suite)
- **Coverage**: `npm run test:coverage` (Vitest coverage report)
- **Smoke Test**: `JULES_LIVE_SMOKE_TEST=1 npm run test:smoke` (Opt-in live API check)

## MCP & Tool Constraints

- **Schema Validation**: Use `zod` for parsing and defining tool schemas. Every API response is validated at runtime with Zod (`z.infer`).
- **Tool Registration**: Registration order in `src/server.ts` must strictly match `TOOL_NAMES` array (Sources tools, Session tools, then Activity tools) to ensure `tests/server.test.ts` passes.
- **API Mapping**: Map parameters accurately to Google Jules API v1alpha specifications.

## Boundaries & Permissions

- **ALWAYS**: Run local build, type-checking, linting, and tests before finalizing any code modification.
- **NEVER**: Hardcode API credentials or environment variables; always look for `JULES_API_KEY` in process environment variables.
- **NEVER**: Include AI co-author trailers in git commits.

## Code Style

- **ES Modules**: The project uses ECMAScript modules (`"type": "module"` in `package.json`). Relative imports in TypeScript source files must use explicit `.js` extensions (e.g., `import { ... } from './schemas.js'`).
- **Strict TypeScript**: TypeScript strict mode is enabled. Do not use `any` type annotations in source or test code. Ensure all async functions contain necessary `await` expressions.
- **Directory Organization**: Code is organized by domain under `src/resources/` (`sources/`, `sessions/`, `activities/`). Each resource domain owns its `schemas.ts`, `client.ts`, `format.ts`, and `tools.ts`. Shared HTTP client and error handling logic live in `src/core/`.
- **Minimal Abstractions**: Prefer editing existing files directly rather than introducing unnecessary abstractions. Avoid redundant comments that restate what the code clearly does.

## Testing

- **Test Framework**: Vitest is used for all unit testing.
- **Network Interception**: Unit tests use MSW (Mock Service Worker) to intercept HTTP at the network layer rather than mocking the HTTP client directly. This ensures `core/http-client.ts` logic (auth, retry, backoff, Zod parsing) is verified.
- **Fixtures**: Real Jules API response shapes are stored in `tests/fixtures/` and validated through Zod schemas during unit test runs.
- **Coverage Thresholds**: Target project code coverage is 90% with strict thresholds enforced by `.codecov.yml` and `vitest.config.ts`.
- **Smoke Tests**: `tests/smoke/live-api.smoke.test.ts` runs against the live Jules API when `JULES_LIVE_SMOKE_TEST=1` is set. It is excluded from regular `npm test` and CI runs to avoid quota consumption.

## Security

- **Credential Handling**: `JULES_API_KEY` must only be read from process environment variables and sent as the `X-Goog-Api-Key` HTTP header to `https://jules.googleapis.com`.
- **Zero Leakage**: Never log, store, or transmit API keys, bearer tokens, or sensitive payload data.
- **Vulnerability Reporting**: Security vulnerabilities must be reported privately per `SECURITY.md` (via GitHub Security Advisories or security email contact).

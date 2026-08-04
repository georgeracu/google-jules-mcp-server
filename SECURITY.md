# Security Policy

## Reporting a Vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Instead, report it privately via [GitHub Security Advisories](https://github.com/georgeracu/google-jules-mcp-server/security/advisories/new), or email racu.george@gmail.com. Include a description of the issue, steps to reproduce, and its potential impact. You should get a response within a few days.

## Scope

This server holds a Jules API key (`JULES_API_KEY`) in the environment it runs in and sends it as the `X-Goog-Api-Key` header on every request to `https://jules.googleapis.com`. It never logs, persists, or transmits that key anywhere else. Issues involving key handling, request/response validation, or dependency vulnerabilities that could leak the key or execute unintended code are in scope.

Vulnerabilities in the Jules API itself, or in Google's infrastructure, are out of scope here — report those to Google directly.

## Supported Versions

This project is pre-1.0 and does not yet maintain multiple release branches. Fixes land on the latest published version.

#!/usr/bin/env node
/**
 * Runs from npm's `version` lifecycle, after package.json is bumped and before
 * the release commit, so server.json ships the version it claims. The release
 * workflow rewrites the same two fields inside its own checkout and throws that
 * copy away; without this the committed file silently trailed every release.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const path = join(root, "server.json");
const server = JSON.parse(readFileSync(path, "utf8"));

server.version = pkg.version;
for (const entry of server.packages ?? []) {
  entry.version = pkg.version;
}

writeFileSync(path, `${JSON.stringify(server, null, 2)}\n`);

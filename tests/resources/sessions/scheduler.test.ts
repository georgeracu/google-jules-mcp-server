import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { SessionScheduler } from "../../../src/resources/sessions/scheduler.js";

const request = {
  prompt: "Run task",
  sourceContext: {
    source: "sources/github/acme/app",
    githubRepoContext: { startingBranch: "main" },
  },
  title: "Task",
  requirePlanApproval: false,
};

describe("SessionScheduler", () => {
  it("persists, loads, lists, and removes schedules", async () => {
    const file = path.join(
      await fs.mkdtemp(path.join(os.tmpdir(), "jules-scheduler-")),
      "schedules.json"
    );
    const sessions = { createSession: vi.fn().mockResolvedValue({}) } as never;
    const first = new SessionScheduler(sessions, file);
    const schedule = await first.add("0 0 1 1 *", request);
    expect(first.list()).toHaveLength(1);

    const second = new SessionScheduler(sessions, file);
    await second.start();
    expect(second.list()[0].id).toBe(schedule.id);
    expect(await second.remove(schedule.id)).toBe(true);
    expect(second.list()).toHaveLength(0);
  });
});

it("rethrows persistence errors other than a missing file", async () => {
  const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "jules-scheduler-")), "bad");
  await fs.writeFile(file, "not-json", "utf8");
  await expect(new SessionScheduler({} as never, file).start()).rejects.toThrow();
});

it("logs failures when creating a scheduled session", async () => {
  const sessions = { createSession: vi.fn().mockRejectedValue(new Error("down")) };
  const scheduler = new SessionScheduler(sessions as never, "/tmp/unused-schedules.json");
  await (scheduler as unknown as { fire: (s: unknown) => Promise<void> }).fire({
    id: "x",
    request: {},
  });
  expect(sessions.createSession).toHaveBeenCalled();
});

it("allows matching repositories through the allowlist check", async () => {
  const previous = process.env.JULES_REPOSITORY_ALLOWLIST;
  delete process.env.JULES_REPOSITORY_ALLOWLIST;
  const sessions = { createSession: vi.fn().mockResolvedValue({}) };
  const scheduler = new SessionScheduler(sessions as never, "/tmp/unused-schedules.json");
  try {
    await (scheduler as unknown as { fire: (s: unknown) => Promise<void> }).fire({
      id: "allowed",
      request,
    });
    expect(sessions.createSession).toHaveBeenCalledWith(request);
  } finally {
    if (previous === undefined) delete process.env.JULES_REPOSITORY_ALLOWLIST;
    else process.env.JULES_REPOSITORY_ALLOWLIST = previous;
  }
});

it("skips repositories excluded by the allowlist", async () => {
  const previous = process.env.JULES_REPOSITORY_ALLOWLIST;
  process.env.JULES_REPOSITORY_ALLOWLIST = "other/repo";
  const sessions = { createSession: vi.fn().mockResolvedValue({}) };
  const scheduler = new SessionScheduler(sessions as never, "/tmp/unused-schedules.json");
  try {
    await (scheduler as unknown as { fire: (s: unknown) => Promise<void> }).fire({
      id: "blocked",
      request,
    });
    expect(sessions.createSession).not.toHaveBeenCalled();
  } finally {
    if (previous === undefined) delete process.env.JULES_REPOSITORY_ALLOWLIST;
    else process.env.JULES_REPOSITORY_ALLOWLIST = previous;
  }
});

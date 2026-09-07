import { Cron } from "croner";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

import { logger } from "../../core/logger.js";
import os from "node:os";
import path from "node:path";

import type { SessionsClient } from "./client.js";
import type { CreateSessionRequest } from "./schemas.js";

export interface RecurringSchedule {
  id: string;
  cron: string;
  request: CreateSessionRequest;
  createdAt: string;
}

export class SessionScheduler {
  private readonly file: string;
  private schedules = new Map<string, RecurringSchedule>();
  private jobs = new Map<string, Cron>();

  constructor(
    private readonly sessions: SessionsClient,
    file = process.env.JULES_SCHEDULE_FILE ?? path.join(os.homedir(), ".jules-schedules.json")
  ) {
    this.file = file;
  }

  async start(): Promise<void> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const records = JSON.parse(raw) as RecurringSchedule[];
      for (const schedule of records) {
        this.schedules.set(schedule.id, schedule);
        this.install(schedule);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async add(cronExpression: string, request: CreateSessionRequest): Promise<RecurringSchedule> {
    const schedule: RecurringSchedule = {
      id: randomUUID(),
      cron: cronExpression,
      request,
      createdAt: new Date().toISOString(),
    };
    // Validate before persisting.
    const job = new Cron(cronExpression, () => this.fire(schedule));
    job.stop();
    this.schedules.set(schedule.id, schedule);
    this.install(schedule);
    await this.persist();
    return schedule;
  }

  list(): RecurringSchedule[] {
    return [...this.schedules.values()];
  }

  async remove(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.stop();
    this.jobs.delete(id);
    this.schedules.delete(id);
    await this.persist();
    return true;
  }

  private install(schedule: RecurringSchedule): void {
    const job = new Cron(schedule.cron, () => this.fire(schedule));
    this.jobs.set(schedule.id, job);
  }

  private async fire(schedule: RecurringSchedule): Promise<void> {
    try {
      await this.sessions.createSession(schedule.request);
    } catch (error) {
      logger.error(`Recurring session ${schedule.id} failed:`, error);
    }
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.list(), null, 2) + "\n", "utf8");
  }
}

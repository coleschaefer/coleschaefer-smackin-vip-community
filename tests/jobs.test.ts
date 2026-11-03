import { afterEach, expect, it } from "vitest";
import type { Db } from "../src/lib/db";
import { enqueueJob, processNextJob, releaseStaleJobs } from "../src/lib/jobs";
import { freshDb } from "./helpers";

const open: Db[] = [];

afterEach(async () => {
  await Promise.all(open.splice(0).map((item) => item.close()));
});

it("claims a job once, retries failures, and releases stale locks", async () => {
  const db = await freshDb();
  open.push(db);
  const id = await enqueueJob(db, "probe_capabilities");
  const first = await processNextJob(db, "worker-a");
  const second = await processNextJob(db, "worker-b");
  expect(first?.id).toBe(id);
  expect(first?.status).toBe("succeeded");
  expect(second).toBeNull();
  const rows = await db.query("SELECT status FROM capabilities WHERE key = 'facebook_group_publish'");
  expect(rows[0]?.status).toBe("unsupported");

  const bad = await enqueueJob(db, "not-a-real-job");
  const failed = await processNextJob(db, "worker-a");
  expect(failed?.id).toBe(bad);
  expect(failed?.status).toBe("failed");
  const requeued = await db.query("SELECT status, attempts, last_error FROM jobs WHERE id = $1", [bad]);
  expect(requeued[0]?.status).toBe("queued");
  expect(Number(requeued[0]?.attempts)).toBe(1);
  expect(String(requeued[0]?.last_error)).toMatch(/Unknown job/);

  await db.query(
    `INSERT INTO jobs (id, type, payload, status, locked_at, locked_by, attempts)
     VALUES ('stale-job', 'probe_capabilities', '{}'::jsonb, 'running', $1, 'old', 1)`,
    [new Date(Date.now() - 60 * 60 * 1000).toISOString()],
  );
  const released = await releaseStaleJobs(db, new Date(Date.now() - 15 * 60 * 1000));
  expect(released).toBe(1);
  const stale = await db.query("SELECT status FROM jobs WHERE id = 'stale-job'");
  expect(stale[0]?.status).toBe("queued");
});

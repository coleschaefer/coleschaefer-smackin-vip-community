import type { Db, Row } from "./db";
import { asObject, jsonParam, nullableText, text } from "./db";
import { CAPABILITIES, type CapabilityStatus } from "./capabilities";
import { newId } from "./ops";
import { contributionReport, listFollowUps } from "./ops";
import { loadPolicy } from "./policy";
import { redact } from "./redact";

export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
}

function mapJob(row: Row): Job {
  return {
    id: text(row, "id"),
    type: text(row, "type"),
    payload: asObject(row.payload),
    status: text(row, "status"),
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    lastError: nullableText(row, "last_error"),
  };
}

export async function enqueueJob(
  db: Db,
  type: string,
  payload: Record<string, unknown> = {},
  runAt = new Date(),
): Promise<string> {
  const id = newId();
  await db.query(
    `INSERT INTO jobs (id, type, payload, status, run_at) VALUES ($1, $2, $3::jsonb, 'queued', $4)`,
    [id, type, jsonParam(payload), runAt.toISOString()],
  );
  return id;
}

export async function releaseStaleJobs(db: Db, staleBefore: Date): Promise<number> {
  const rows = await db.query(
    `UPDATE jobs
     SET status = 'queued', locked_at = NULL, locked_by = NULL
     WHERE status = 'running' AND locked_at IS NOT NULL AND locked_at < $1
     RETURNING id`,
    [staleBefore.toISOString()],
  );
  return rows.length;
}

export async function claimJob(db: Db, workerId: string): Promise<Job | null> {
  return db.tx(async (tx) => {
    const rows = await tx.query(
      `WITH next AS (
         SELECT id FROM jobs
         WHERE status = 'queued' AND run_at <= now()
         ORDER BY run_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE jobs AS j
       SET status = 'running', locked_at = now(), locked_by = $1, attempts = j.attempts + 1
       FROM next
       WHERE j.id = next.id
       RETURNING j.*`,
      [workerId],
    );
    return rows.length === 0 ? null : mapJob(rows[0]);
  });
}

async function finish(db: Db, id: string): Promise<void> {
  await db.query(
    `UPDATE jobs SET status = 'succeeded', finished_at = now(), locked_at = NULL, last_error = NULL WHERE id = $1`,
    [id],
  );
}

async function fail(db: Db, job: Job, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const dead = job.attempts >= job.maxAttempts;
  const delayMs = Math.min(job.attempts, 6) * 30_000;
  await db.query(
    `UPDATE jobs
     SET status = $2, last_error = $3, locked_at = NULL, locked_by = NULL,
         run_at = $4, finished_at = CASE WHEN $2 = 'dead' THEN now() ELSE NULL END
     WHERE id = $1`,
    [job.id, dead ? "dead" : "queued", message.slice(0, 500), new Date(Date.now() + delayMs).toISOString()],
  );
}

async function probeCapabilities(db: Db): Promise<void> {
  const policy = loadPolicy();
  const grokRuns = await db.query(
    "SELECT id FROM grok_runs WHERE status = 'succeeded' LIMIT 1",
  );
  for (const capability of CAPABILITIES) {
    let status: CapabilityStatus = capability.status;
    let summary = capability.summary;
    if (capability.key === "grok_function_calling") {
      if (grokRuns.length > 0) {
        status = "supported";
        summary = "A Grok tool-calling run has completed in this database. Publish tools are still not exposed.";
      } else if (process.env.XAI_API_KEY?.trim()) {
        status = "degraded";
        summary = "XAI_API_KEY is set, but no successful tool-calling run is recorded yet.";
      }
    }
    if (capability.key === "buffer_notification_schedule" && process.env.BUFFER_API_KEY?.trim()) {
      status = "degraded";
      summary =
        "BUFFER_API_KEY is set. Backup notification calls are possible in bounded live mode. No live post was created by this probe. A Buffer id is not a verified Facebook post.";
    }
    const evidence = {
      ...capability.evidence,
      policyVersion: policy.version,
      probedAt: new Date().toISOString(),
    };
    await db.query(
      `INSERT INTO capabilities (key, name, status, summary, evidence, checked_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
       ON CONFLICT (key) DO UPDATE
       SET name = EXCLUDED.name, status = EXCLUDED.status, summary = EXCLUDED.summary,
           evidence = EXCLUDED.evidence, checked_at = now()`,
      [capability.key, capability.name, status, summary, jsonParam(redact(evidence))],
    );
  }
}

async function scanFollowUps(db: Db): Promise<void> {
  const open = await listFollowUps(db);
  const overdue = open.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < Date.now() && item.state !== "closed");
  if (overdue.length === 0) return;
  await db.query(
    `INSERT INTO learning_notes (id, week_key, observation, decision, source)
     VALUES ($1, $2, $3, $4, 'job')`,
    [
      newId(),
      new Date().toISOString().slice(0, 10),
      `${overdue.length} follow-up${overdue.length === 1 ? "" : "s"} past due. They stay open until a person closes them with an outcome.`,
      "Review overdue items before writing new posts.",
      ],
  );
}

async function rollupMetrics(db: Db): Promise<void> {
  const policy = loadPolicy();
  const official = await contributionReport(db, new Date(), policy.metrics.officialSources, "official");
  const illustration = await contributionReport(
    db,
    new Date(),
    policy.metrics.illustrationSources,
    "illustration",
  );
  await db.query(
    `INSERT INTO metric_snapshots (id, week_start, payload) VALUES ($1, $2, $3::jsonb)`,
    [newId(), new Date().toISOString().slice(0, 10), jsonParam({ official, illustration })],
  );
}

export async function runJob(db: Db, job: Job): Promise<void> {
  if (job.type === "probe_capabilities") return probeCapabilities(db);
  if (job.type === "scan_followups") return scanFollowUps(db);
  if (job.type === "rollup_metrics") return rollupMetrics(db);
  throw new Error(`Unknown job type ${job.type}`);
}

export async function processNextJob(db: Db, workerId = "worker"): Promise<Job | null> {
  await releaseStaleJobs(db, new Date(Date.now() - 15 * 60 * 1000));
  const job = await claimJob(db, workerId);
  if (!job) return null;
  try {
    await runJob(db, job);
    await finish(db, job.id);
    return { ...job, status: "succeeded" };
  } catch (error) {
    await fail(db, job, error);
    return { ...job, status: "failed", lastError: error instanceof Error ? error.message : String(error) };
  }
}

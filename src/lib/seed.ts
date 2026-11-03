import { CAPABILITIES } from "./capabilities";
import { HUB_DRAFTS } from "./content/hubs";
import { SAMPLE_CALENDAR } from "./content/sampleCalendar";
import type { Db } from "./db";
import { jsonParam } from "./db";
import { enqueueJob, processNextJob } from "./jobs";
import {
  createDraft,
  createFollowUp,
  createTask,
  ensureMember,
  newId,
  proposeCalendarItem,
  recordLearning,
} from "./ops";
import { loadPolicy } from "./policy";
import { redact } from "./redact";

const SEED_NOW = new Date("2026-11-03T18:00:00-06:00");

async function ensureSettings(db: Db): Promise<void> {
  const policy = loadPolicy();
  await db.query(
    `INSERT INTO app_settings (id, mode, publication_paused, timezone)
     VALUES ('default', $1, false, $2)
     ON CONFLICT (id) DO NOTHING`,
    [policy.modes.default, policy.timezone],
  );
}

async function seedFacts(db: Db): Promise<void> {
  const facts = [
    {
      slug: "support-email",
      statement: "Private order support email is contact@smackinsnacks.com. Approved 2026-11-03.",
      status: "verified",
      category: "support",
      from: "2026-11-03",
      until: null,
      source: "Cole setup fact 2026-11-03 and VIP Featured Drafts Review.",
    },
    {
      slug: "no-timed-vip-benefit-week-of-2026-11-02",
      statement: "No timed VIP benefit is confirmed for the week of 2026-11-02.",
      status: "verified",
      category: "offer",
      from: "2026-11-02",
      until: "2026-11-08",
      source: "VIP This Week draft, Cole 2026-11-03.",
    },
    {
      slug: "advent-tease-week-of-2026-11-03",
      statement:
        "From 2026-11-02 through 2026-11-08 the group may tease that an advent calendar is in the works. Dates, prices, access, and availability are not confirmed.",
      status: "verified",
      category: "offer",
      from: "2026-11-02",
      until: "2026-11-08",
      source: "Cole setup fact 2026-11-03. Tease only.",
    },
    {
      slug: "group-url",
      statement: "The group is https://www.facebook.com/groups/604690051505802/.",
      status: "verified",
      category: "operations",
      from: "2026-11-03",
      until: null,
      source: "Operator configuration.",
    },
    {
      slug: "single-bag-unconfirmed",
      statement:
        "Members have asked about buying one bag instead of a bundle. No confirmed single-bag offer, price, or date is recorded.",
      status: "unverified",
      category: "offer",
      from: null,
      until: null,
      source: "Audit paraphrase of purchase-friction questions. Not an offer.",
    },
  ];
  for (const fact of facts) {
    await db.query(
      `INSERT INTO knowledge_facts
        (id, slug, statement, status, category, effective_from, effective_until, source_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO UPDATE
       SET statement = EXCLUDED.statement, status = EXCLUDED.status, category = EXCLUDED.category,
           effective_from = EXCLUDED.effective_from, effective_until = EXCLUDED.effective_until,
           source_note = EXCLUDED.source_note, updated_at = now()`,
      [newId(), fact.slug, fact.statement, fact.status, fact.category, fact.from, fact.until, fact.source],
    );
  }
}

async function seedCapabilities(db: Db): Promise<void> {
  for (const capability of CAPABILITIES) {
    await db.query(
      `INSERT INTO capabilities (key, name, status, summary, evidence, checked_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (key) DO UPDATE
       SET name = EXCLUDED.name, status = EXCLUDED.status, summary = EXCLUDED.summary,
           evidence = EXCLUDED.evidence, checked_at = EXCLUDED.checked_at`,
      [
        capability.key,
        capability.name,
        capability.status,
        capability.summary,
        jsonParam(redact(capability.evidence)),
        "2026-11-03T21:00:00.000Z",
      ],
    );
  }
}

async function seedIllustration(db: Db): Promise<void> {
  const rows: Array<{
    id: string;
    name: string;
    kind: "post" | "comment" | "reaction";
    at: string;
  }> = [
    { id: "sample-a-1", name: "Sample Member A", kind: "comment", at: "2026-10-01T10:00:00-05:00" },
    { id: "sample-a-2", name: "Sample Member A", kind: "reaction", at: "2026-10-02T10:00:00-05:00" },
    { id: "sample-a-3", name: "Sample Member A", kind: "comment", at: "2026-10-04T10:00:00-05:00" },
    { id: "sample-b-1", name: "Sample Member B", kind: "post", at: "2026-10-20T10:00:00-05:00" },
    { id: "sample-c-1", name: "Sample Member C", kind: "comment", at: "2026-11-01T10:00:00-06:00" },
    { id: "sample-d-1", name: "Sample Member D", kind: "comment", at: "2026-11-03T09:00:00-06:00" },
    { id: "sample-cole", name: "Cole Schaefer", kind: "comment", at: "2026-10-04T12:00:00-05:00" },
    { id: "sample-brian", name: "Brian Waddick", kind: "comment", at: "2026-10-21T12:00:00-05:00" },
    { id: "sample-marc", name: "Marc", kind: "post", at: "2026-10-22T12:00:00-05:00" },
    { id: "sample-eli", name: "Eli", kind: "comment", at: "2026-10-23T12:00:00-05:00" },
    { id: "sample-agent", name: "SMACKIN’ community assistant", kind: "comment", at: "2026-10-05T12:00:00-05:00" },
  ];
  for (const row of rows) {
    const existing = await db.query("SELECT id FROM contributions WHERE id = $1", [row.id]);
    if (existing.length > 0) continue;
    const member = await ensureMember(db, row.name, "sample_not_live");
    await db.query(
      `INSERT INTO contributions (id, member_id, kind, body, occurred_at, source)
       VALUES ($1, $2, $3, $4, $5, 'sample_not_live')`,
      [row.id, member.id, row.kind, "Illustration row. Not a live Facebook ingest.", row.at],
    );
  }
}

async function seedWork(db: Db): Promise<void> {
  const specs = [
    {
      title: "Founder queue example — live shopping question",
      memberDisplayName: "Sample Member C",
      questionText:
        "Members asked what happened to live shopping. No confirmed answer is in the fact library. This sample is an audit paraphrase, not a new live post.",
      sensitivity: "ordinary",
      kind: "founder",
      dueAt: "2026-11-04T17:00:00-06:00",
    },
    {
      title: "First contribution example",
      memberDisplayName: "Sample Member D",
      questionText:
        "First comment this week in the illustration set. Prepare context for Cole. Do not invent his reaction.",
      sensitivity: "ordinary",
      kind: "first_contribution",
      dueAt: null,
    },
    {
      title: "Idea example — single bag",
      memberDisplayName: "Sample Member B",
      questionText:
        "Could trying one bag be easier than a bundle? The fact single-bag-unconfirmed says no offer is recorded.",
      sensitivity: "ordinary",
      kind: "idea",
      dueAt: null,
    },
    {
      title: "Personal story — do not mine",
      memberDisplayName: "Sample Member A",
      questionText: "A member shared a family moment. Keep it out of marketing posts.",
      sensitivity: "personal_story",
      kind: "question",
      dueAt: null,
    },
  ];
  for (const spec of specs) {
    const existing = await db.query("SELECT id FROM follow_ups WHERE title = $1", [spec.title]);
    if (existing.length > 0) continue;
    const followUp = await createFollowUp(db, spec, "seed");
    if (spec.kind === "founder") {
      await createTask(db, followUp.id, "Confirm what is actually true about live shopping before Cole replies.", "seed");
    }
  }
  const learning = await db.query(
    "SELECT id FROM learning_notes WHERE observation LIKE 'Hypothesis under test%'",
  );
  if (learning.length === 0) {
    await recordLearning(
      db,
      {
        weekKey: "2026-11-02",
        observation:
          "Hypothesis under test, not a result: notice a member, invite a useful contribution, respond specifically, show the outcome, give a reason to return. The November 3 audit is a sample, not a census.",
        decision: "Run the five-slot rhythm only when the material is real. Skip empty slots.",
        source: "audit_2026-11-03",
      },
      "seed",
    );
  }
}

async function seedCalendar(db: Db): Promise<void> {
  for (const slot of SAMPLE_CALENDAR) {
    const existing = await db.query("SELECT id FROM calendar_items WHERE id = $1", [slot.id]);
    if (existing.length > 0) continue;
    await proposeCalendarItem(
      db,
      {
        id: slot.id,
        pillar: slot.pillar,
        scheduledOn: slot.scheduledOn,
        title: slot.title,
        body: slot.body,
        voice: slot.voice,
      },
      "seed",
    );
  }
}

async function seedHubs(db: Db): Promise<void> {
  for (const hub of HUB_DRAFTS) {
    const existing = await db.query("SELECT id FROM drafts WHERE id = $1", [hub.id]);
    if (existing.length > 0) continue;
    await createDraft(
      db,
      {
        id: hub.id,
        kind: "post",
        intent: "post",
        voice: "assistant",
        body: hub.body,
        author: "drive_doc_2026-11-03",
      },
      "seed",
      SEED_NOW,
    );
  }
}

export async function seed(db: Db): Promise<void> {
  await ensureSettings(db);
  await seedFacts(db);
  await seedCapabilities(db);
  await seedIllustration(db);
  await seedWork(db);
  await seedCalendar(db);
  await seedHubs(db);
  const queued = await db.query("SELECT id FROM jobs WHERE type = 'probe_capabilities' LIMIT 1");
  if (queued.length === 0) {
    await enqueueJob(db, "probe_capabilities");
    await enqueueJob(db, "scan_followups");
    await enqueueJob(db, "rollup_metrics");
    await processNextJob(db, "seed");
    await processNextJob(db, "seed");
    await processNextJob(db, "seed");
  }
}

export { SEED_NOW };

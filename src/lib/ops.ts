import type { Db, Row } from "./db";
import { asArray, bool, jsonParam, nullableText, text } from "./db";
import { OpsError } from "./errors";
import { evaluateDraft, type DraftIntent, type FactRef, type Voice } from "./gate";
import { rhythmDecision, type RhythmItem } from "./calendar";
import { computeContributionReport, type ContributionReport, type ContributionRow } from "./metrics";
import { publicationVerdict, type Attestation } from "./permalink";
import { loadPolicy, type OperatingMode, type Policy } from "./policy";
import { scheduleGroupNotification } from "./buffer";
import { isExcludedStaffName, normalizeBody, normalizeName, bodyHash } from "./text";
import { asDateOnly, asInstant, chicagoDate } from "./time";
import { redact } from "./redact";

export function newId(): string {
  return crypto.randomUUID();
}

export interface Settings {
  mode: OperatingMode;
  publicationPaused: boolean;
  timezone: string;
}

export interface FollowUp {
  id: string;
  title: string;
  memberDisplayName: string;
  questionText: string;
  state: string;
  ownerLabel: string | null;
  dueAt: string | null;
  handoffConfirmedAt: string | null;
  handoffNote: string | null;
  outcome: string | null;
  sensitivity: string;
  kind: string;
  createdAt: string;
  closedAt: string | null;
}

export interface Draft {
  id: string;
  kind: string;
  followUpId: string | null;
  calendarItemId: string | null;
  body: string;
  voice: Voice;
  intent: DraftIntent;
  status: string;
  gatePass: boolean;
  gateNotes: string[];
  author: string;
  colePersonalized: boolean;
  createdAt: string;
}

function mapFollowUp(row: Row): FollowUp {
  return {
    id: text(row, "id"),
    title: text(row, "title"),
    memberDisplayName: text(row, "member_display_name"),
    questionText: text(row, "question_text"),
    state: text(row, "state"),
    ownerLabel: nullableText(row, "owner_label"),
    dueAt: nullableText(row, "due_at"),
    handoffConfirmedAt: nullableText(row, "handoff_confirmed_at"),
    handoffNote: nullableText(row, "handoff_note"),
    outcome: nullableText(row, "outcome"),
    sensitivity: text(row, "sensitivity"),
    kind: text(row, "kind"),
    createdAt: text(row, "created_at"),
    closedAt: nullableText(row, "closed_at"),
  };
}

function mapDraft(row: Row): Draft {
  return {
    id: text(row, "id"),
    kind: text(row, "kind"),
    followUpId: nullableText(row, "follow_up_id"),
    calendarItemId: nullableText(row, "calendar_item_id"),
    body: text(row, "body"),
    voice: text(row, "voice") as Voice,
    intent: text(row, "intent") as DraftIntent,
    status: text(row, "status"),
    gatePass: bool(row, "gate_pass"),
    gateNotes: asArray(row.gate_notes).map(String),
    author: text(row, "author"),
    colePersonalized: bool(row, "cole_personalized"),
    createdAt: text(row, "created_at"),
  };
}

export async function logAction(
  db: Db,
  actor: string,
  action: string,
  entityType: string,
  entityId: string | null,
  detail: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO action_log (id, actor, action, entity_type, entity_id, detail)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [newId(), actor, action, entityType, entityId, jsonParam(redact(detail))],
  );
}

export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.query("SELECT mode, publication_paused, timezone FROM app_settings WHERE id = 'default'");
  if (rows.length === 0) {
    throw new OpsError("settings_missing", "App settings are not seeded.");
  }
  return {
    mode: text(rows[0], "mode") as OperatingMode,
    publicationPaused: bool(rows[0], "publication_paused"),
    timezone: text(rows[0], "timezone"),
  };
}

export async function updateSettings(
  db: Db,
  input: { mode?: OperatingMode; publicationPaused?: boolean },
  actor: string,
): Promise<Settings> {
  const policy = loadPolicy();
  if (input.mode && !policy.modes.allowed.includes(input.mode)) {
    throw new OpsError("bad_mode", "That mode is not in the runtime policy.");
  }
  const current = await getSettings(db);
  const mode = input.mode ?? current.mode;
  const paused = input.publicationPaused ?? current.publicationPaused;
  await db.query(
    `UPDATE app_settings SET mode = $1, publication_paused = $2, updated_at = now() WHERE id = 'default'`,
    [mode, paused],
  );
  await logAction(db, actor, "settings.update", "settings", "default", { mode, publicationPaused: paused });
  return getSettings(db);
}

export async function listFacts(
  db: Db,
): Promise<Array<FactRef & { id: string; slug: string; category: string; sourceNote: string }>> {
  const rows = await db.query("SELECT * FROM knowledge_facts ORDER BY status, slug");
  return rows.map((row) => ({
    id: text(row, "id"),
    slug: text(row, "slug"),
    statement: text(row, "statement"),
    status: text(row, "status") as FactRef["status"],
    category: text(row, "category"),
    effectiveFrom: row.effective_from == null ? null : asDateOnly(row.effective_from),
    effectiveUntil: row.effective_until == null ? null : asDateOnly(row.effective_until),
    sourceNote: text(row, "source_note"),
  }));
}

export async function addFact(
  db: Db,
  input: {
    slug: string;
    statement: string;
    status: FactRef["status"];
    category: string;
    effectiveFrom?: string | null;
    effectiveUntil?: string | null;
    sourceNote: string;
  },
  actor: string,
): Promise<void> {
  await db.query(
    `INSERT INTO knowledge_facts
      (id, slug, statement, status, category, effective_from, effective_until, source_note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      newId(),
      input.slug,
      input.statement,
      input.status,
      input.category,
      input.effectiveFrom ?? null,
      input.effectiveUntil ?? null,
      input.sourceNote,
    ],
  );
  await logAction(db, actor, "fact.create", "knowledge_fact", input.slug, { status: input.status });
}

export async function setFactStatus(db: Db, slug: string, status: FactRef["status"], actor: string): Promise<void> {
  const rows = await db.query("UPDATE knowledge_facts SET status = $2, updated_at = now() WHERE slug = $1 RETURNING slug", [
    slug,
    status,
  ]);
  if (rows.length === 0) throw new OpsError("fact_missing", "No fact with that slug.");
  await logAction(db, actor, "fact.status", "knowledge_fact", slug, { status });
}

async function loadFacts(db: Db): Promise<FactRef[]> {
  const rows = await listFacts(db);
  return rows.map((fact) => ({
    statement: fact.statement,
    status: fact.status,
    effectiveFrom: fact.effectiveFrom,
    effectiveUntil: fact.effectiveUntil,
  }));
}

export async function ensureMember(
  db: Db,
  displayName: string,
  source: string,
): Promise<{ id: string; isStaff: boolean; isAgent: boolean }> {
  const policy = loadPolicy();
  const normalized = normalizeName(displayName);
  const isStaff = isExcludedStaffName(displayName, policy.staffExcluded);
  const isAgent = policy.agentExcludedNames.some((name) => normalizeName(name) === normalized);
  const existing = await db.query("SELECT id, is_staff, is_agent FROM members WHERE normalized_name = $1", [
    normalized,
  ]);
  if (existing.length > 0) {
    return {
      id: text(existing[0], "id"),
      isStaff: bool(existing[0], "is_staff"),
      isAgent: bool(existing[0], "is_agent"),
    };
  }
  const id = newId();
  await db.query(
    `INSERT INTO members (id, display_name, normalized_name, is_staff, is_agent, source)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, displayName.trim(), normalized, isStaff, isAgent, source],
  );
  return { id, isStaff, isAgent };
}

export async function recordContribution(
  db: Db,
  input: {
    displayName: string;
    kind: "post" | "comment" | "reaction";
    occurredAt: Date;
    source: string;
    body?: string;
    threadRef?: string;
  },
): Promise<string> {
  const member = await ensureMember(db, input.displayName, input.source);
  const id = newId();
  await db.query(
    `INSERT INTO contributions (id, member_id, kind, thread_ref, body, occurred_at, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, member.id, input.kind, input.threadRef ?? null, input.body ?? null, input.occurredAt.toISOString(), input.source],
  );
  return id;
}

export async function contributionReport(
  db: Db,
  asOf: Date,
  sources: string[],
  label: string,
): Promise<ContributionReport> {
  const policy = loadPolicy();
  if (sources.length === 0) {
    return computeContributionReport([], asOf, policy, label);
  }
  const placeholders = sources.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await db.query(
    `SELECT c.kind, c.occurred_at, c.source, m.id AS member_id, m.display_name, m.is_staff, m.is_agent
     FROM contributions c JOIN members m ON m.id = c.member_id
     WHERE c.source IN (${placeholders})`,
    sources,
  );
  const mapped: ContributionRow[] = rows.map((row) => ({
    memberId: text(row, "member_id"),
    displayName: text(row, "display_name"),
    isStaff: bool(row, "is_staff"),
    isAgent: bool(row, "is_agent"),
    kind: text(row, "kind") as ContributionRow["kind"],
    occurredAt: asInstant(row.occurred_at),
    source: text(row, "source"),
  }));
  return computeContributionReport(mapped, asOf, policy, label);
}

export async function createFollowUp(
  db: Db,
  input: {
    title: string;
    memberDisplayName: string;
    questionText: string;
    sensitivity?: string;
    kind?: string;
    dueAt?: string | null;
  },
  actor: string,
): Promise<FollowUp> {
  const id = newId();
  const rows = await db.query(
    `INSERT INTO follow_ups
      (id, title, member_display_name, question_text, state, sensitivity, kind, due_at)
     VALUES ($1, $2, $3, $4, 'new', $5, $6, $7)
     RETURNING *`,
    [
      id,
      input.title,
      input.memberDisplayName,
      input.questionText,
      input.sensitivity ?? "ordinary",
      input.kind ?? "question",
      input.dueAt ?? null,
    ],
  );
  await logAction(db, actor, "follow_up.create", "follow_up", id, { state: "new" });
  return mapFollowUp(rows[0]);
}

async function getFollowUp(db: Db, id: string): Promise<FollowUp> {
  const rows = await db.query("SELECT * FROM follow_ups WHERE id = $1", [id]);
  if (rows.length === 0) throw new OpsError("follow_up_missing", "Follow-up not found.");
  return mapFollowUp(rows[0]);
}

async function setFollowUpState(db: Db, id: string, state: string, extraSql = "", extra: unknown[] = []): Promise<FollowUp> {
  const rows = await db.query(
    `UPDATE follow_ups SET state = $2, updated_at = now() ${extraSql} WHERE id = $1 RETURNING *`,
    [id, state, ...extra],
  );
  return mapFollowUp(rows[0]);
}

export async function createTask(db: Db, followUpId: string, title: string, actor: string): Promise<FollowUp> {
  const current = await getFollowUp(db, followUpId);
  if (!["new", "reopened", "tasked"].includes(current.state)) {
    throw new OpsError("bad_transition", `A task cannot be added from state ${current.state}.`);
  }
  await db.query(
    `INSERT INTO tasks (id, follow_up_id, title, status) VALUES ($1, $2, $3, 'open')`,
    [newId(), followUpId, title],
  );
  const next = current.state === "tasked" ? current : await setFollowUpState(db, followUpId, "tasked");
  await logAction(db, actor, "task.create", "follow_up", followUpId, { title, state: next.state });
  return next;
}

export async function acknowledgeFollowUp(db: Db, id: string, actor: string): Promise<FollowUp> {
  const policy = loadPolicy();
  const current = await getFollowUp(db, id);
  if (current.state !== "tasked") {
    throw new OpsError("bad_transition", "Acknowledge only after the follow-up is tasked.");
  }
  if (policy.followUp.acknowledgementRequiresTask) {
    const tasks = await db.query("SELECT id FROM tasks WHERE follow_up_id = $1", [id]);
    if (tasks.length === 0) throw new OpsError("task_required", "Acknowledgement requires a task.");
  }
  const next = await setFollowUpState(db, id, "acknowledged");
  await logAction(db, actor, "follow_up.acknowledge", "follow_up", id, {});
  return next;
}

export async function assignOwner(db: Db, id: string, owner: string, actor: string): Promise<FollowUp> {
  const current = await getFollowUp(db, id);
  if (current.state !== "acknowledged" && current.state !== "owned") {
    throw new OpsError("bad_transition", "Assign an owner after acknowledgement.");
  }
  const rows = await db.query(
    `UPDATE follow_ups SET state = 'owned', owner_label = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, owner],
  );
  await logAction(db, actor, "follow_up.own", "follow_up", id, { owner });
  return mapFollowUp(rows[0]);
}

export async function confirmHandoff(db: Db, id: string, note: string, actor: string): Promise<FollowUp> {
  const rows = await db.query(
    `UPDATE follow_ups
     SET handoff_confirmed_at = now(), handoff_note = $2, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, note],
  );
  if (rows.length === 0) throw new OpsError("follow_up_missing", "Follow-up not found.");
  await logAction(db, actor, "follow_up.handoff", "follow_up", id, { note });
  return mapFollowUp(rows[0]);
}

export async function markReadyForPublicUpdate(db: Db, id: string, actor: string): Promise<FollowUp> {
  const current = await getFollowUp(db, id);
  if (!["owned", "waiting_on_owner"].includes(current.state)) {
    throw new OpsError("bad_transition", "A public update is ready only after the item has an owner.");
  }
  const next = await setFollowUpState(db, id, "public_update_ready");
  await logAction(db, actor, "follow_up.ready", "follow_up", id, {});
  return next;
}

export async function closeFollowUp(db: Db, id: string, outcome: string, actor: string): Promise<FollowUp> {
  const policy = loadPolicy();
  const current = await getFollowUp(db, id);
  if (current.state !== "public_update_ready") {
    throw new OpsError("bad_transition", "Close only from a public update that is ready, with an outcome.");
  }
  if (policy.followUp.closeRequiresOutcome && outcome.trim().length === 0) {
    throw new OpsError("outcome_required", "Closing requires an outcome.");
  }
  const rows = await db.query(
    `UPDATE follow_ups
     SET state = 'closed', outcome = $2, closed_at = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, outcome.trim()],
  );
  await logAction(db, actor, "follow_up.close", "follow_up", id, { outcome: outcome.trim() });
  return mapFollowUp(rows[0]);
}

export async function listFollowUps(db: Db): Promise<FollowUp[]> {
  const rows = await db.query("SELECT * FROM follow_ups ORDER BY created_at DESC");
  return rows.map(mapFollowUp);
}

async function gateContext(db: Db, followUpId: string | null, now: Date) {
  const policy = loadPolicy();
  const facts = await loadFacts(db);
  const day = chicagoDate(now);
  const countRows = await db.query(
    "SELECT COUNT(*)::int AS n FROM reply_events WHERE occurred_on = $1",
    [day],
  );
  const repliesToday = Number(countRows[0]?.n ?? 0);
  const recent = await db.query(
    `SELECT body FROM drafts WHERE status <> 'blocked' AND created_at >= $1`,
    [new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()],
  );
  let handoffConfirmed = false;
  if (followUpId) {
    const followUp = await getFollowUp(db, followUpId);
    handoffConfirmed = Boolean(followUp.handoffConfirmedAt);
  }
  return {
    policy,
    facts,
    repliesToday,
    recentNormalizedBodies: recent.map((row) => normalizeBody(text(row, "body"))),
    handoffConfirmed,
  };
}

export async function createDraft(
  db: Db,
  input: {
    kind: "reply" | "post";
    intent: DraftIntent;
    voice: Voice;
    body: string;
    followUpId?: string | null;
    calendarItemId?: string | null;
    author: string;
    grokRunId?: string | null;
    id?: string;
  },
  actor: string,
  now = new Date(),
): Promise<Draft> {
  const settings = await getSettings(db);
  if (settings.mode === "observe") {
    throw new OpsError("observe_mode", "Observe mode does not create drafts.");
  }
  const ctx = await gateContext(db, input.followUpId ?? null, now);
  const gate = evaluateDraft({
    body: input.body,
    voice: input.voice,
    intent: input.intent,
    now,
    facts: ctx.facts,
    policy: ctx.policy,
    handoffConfirmed: ctx.handoffConfirmed,
    recentNormalizedBodies: ctx.recentNormalizedBodies,
    repliesToday: ctx.repliesToday,
  });
  const id = input.id ?? newId();
  const status = gate.pass ? "proposed" : "blocked";
  const rows = await db.query(
    `INSERT INTO drafts
      (id, kind, follow_up_id, calendar_item_id, body, voice, intent, status, gate_pass, gate_notes, author, grok_run_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
     RETURNING *`,
    [
      id,
      input.kind,
      input.followUpId ?? null,
      input.calendarItemId ?? null,
      input.body,
      input.voice,
      input.intent,
      status,
      gate.pass,
      jsonParam(gate.notes),
      input.author,
      input.grokRunId ?? null,
    ],
  );
  if (gate.pass && input.intent !== "post") {
    await db.query(
      `INSERT INTO reply_events (id, draft_id, body_hash, body_normalized, intent, occurred_on)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newId(), id, bodyHash(input.body), normalizeBody(input.body), input.intent, chicagoDate(now)],
    );
  }
  await logAction(db, actor, "draft.create", "draft", id, {
    status,
    gatePass: gate.pass,
    notes: gate.notes,
  });
  return mapDraft(rows[0]);
}

export async function getDraft(db: Db, id: string): Promise<Draft> {
  const rows = await db.query("SELECT * FROM drafts WHERE id = $1", [id]);
  if (rows.length === 0) throw new OpsError("draft_missing", "Draft not found.");
  return mapDraft(rows[0]);
}

export async function listDrafts(db: Db): Promise<Draft[]> {
  const rows = await db.query("SELECT * FROM drafts ORDER BY created_at DESC");
  return rows.map(mapDraft);
}

export async function approveDraft(db: Db, id: string, actor: string, now = new Date()): Promise<Draft> {
  const current = await getDraft(db, id);
  if (!["proposed", "pending_review"].includes(current.status)) {
    throw new OpsError("bad_draft_state", `Cannot approve a draft in status ${current.status}.`);
  }
  const ctx = await gateContext(db, current.followUpId, now);
  const gate = evaluateDraft({
    body: current.body,
    voice: current.voice,
    intent: current.intent,
    now,
    facts: ctx.facts,
    policy: ctx.policy,
    handoffConfirmed: ctx.handoffConfirmed,
    recentNormalizedBodies: ctx.recentNormalizedBodies.filter((body) => body !== normalizeBody(current.body)),
    repliesToday: 0,
  });
  if (!gate.pass) {
    await db.query(
      `UPDATE drafts SET status = 'blocked', gate_pass = false, gate_notes = $2::jsonb WHERE id = $1`,
      [id, jsonParam(gate.notes)],
    );
    throw new OpsError("fact_gate", gate.notes.join(" "));
  }
  const rows = await db.query(
    `UPDATE drafts SET status = 'approved', gate_pass = true, gate_notes = $2::jsonb WHERE id = $1 RETURNING *`,
    [id, jsonParam(gate.notes)],
  );
  await logAction(db, actor, "draft.approve", "draft", id, { requiresCole: gate.requiresCole });
  return mapDraft(rows[0]);
}

export async function rejectDraft(db: Db, id: string, actor: string): Promise<Draft> {
  const rows = await db.query(
    `UPDATE drafts SET status = 'rejected' WHERE id = $1 AND status IN ('proposed', 'pending_review', 'blocked') RETURNING *`,
    [id],
  );
  if (rows.length === 0) throw new OpsError("bad_draft_state", "That draft cannot be rejected.");
  await logAction(db, actor, "draft.reject", "draft", id, {});
  return mapDraft(rows[0]);
}

export async function attestColePersonalized(db: Db, id: string, actor: string): Promise<Draft> {
  const current = await getDraft(db, id);
  if (current.voice !== "founder_draft") {
    throw new OpsError("not_founder", "Only founder drafts take a Cole personalization attestation.");
  }
  if (current.status !== "approved") {
    throw new OpsError("bad_draft_state", "Approve the draft before attesting that Cole personalized it.");
  }
  const rows = await db.query(
    `UPDATE drafts SET cole_personalized = true WHERE id = $1 RETURNING *`,
    [id],
  );
  await logAction(db, actor, "draft.cole_personalized", "draft", id, {});
  return mapDraft(rows[0]);
}

async function assertCanQueue(db: Db): Promise<Settings> {
  const settings = await getSettings(db);
  if (settings.publicationPaused) {
    throw new OpsError("paused", "Publication is paused. Nothing was queued.");
  }
  if (settings.mode === "observe") {
    throw new OpsError("observe_mode", "Observe mode does not queue publication.");
  }
  return settings;
}

export interface Publication {
  id: string;
  draftId: string;
  channel: string;
  status: string;
  bufferPostId: string | null;
  permalink: string | null;
  evidence: string;
}

function mapPublication(row: Row): Publication {
  return {
    id: text(row, "id"),
    draftId: text(row, "draft_id"),
    channel: text(row, "channel"),
    status: text(row, "status"),
    bufferPostId: nullableText(row, "buffer_post_id"),
    permalink: nullableText(row, "permalink"),
    evidence: text(row, "evidence"),
  };
}

export async function queueHumanPublish(db: Db, draftId: string, actor: string): Promise<Publication> {
  await assertCanQueue(db);
  const draft = await getDraft(db, draftId);
  if (draft.status !== "approved" || !draft.gatePass) {
    throw new OpsError("not_approved", "Queue only an approved draft that passed the fact gate.");
  }
  if (draft.voice === "founder_draft" && !draft.colePersonalized) {
    throw new OpsError(
      "cole_required",
      "A founder draft stays off the publish queue until Cole has personalized it.",
    );
  }
  const evidence =
    draft.voice === "founder_draft"
      ? "Human-assisted queue. Cole posts this himself in the Facebook group. The assistant did not post and did not call Facebook."
      : "Human-assisted queue. A person posts this as the community assistant in the Facebook group, then pastes the permalink. The app did not call Facebook.";
  const rows = await db.query(
    `INSERT INTO publications (id, draft_id, channel, status, evidence)
     VALUES ($1, $2, 'human_assisted', 'awaiting_human', $3)
     RETURNING *`,
    [newId(), draftId, evidence],
  );
  await logAction(db, actor, "publication.queue_human", "publication", text(rows[0], "id"), {
    draftId,
    status: "awaiting_human",
  });
  return mapPublication(rows[0]);
}

export async function scheduleBufferBackup(
  db: Db,
  draftId: string,
  actor: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Publication> {
  const settings = await assertCanQueue(db);
  const policy = loadPolicy();
  if (settings.mode !== "bounded_live" || !policy.boundedLive.bufferNotificationAfterApproval) {
    throw new OpsError("buffer_blocked", "Buffer backup runs only in bounded live mode, after approval.");
  }
  const draft = await getDraft(db, draftId);
  if (draft.status !== "approved" || !draft.gatePass || draft.voice !== "assistant") {
    throw new OpsError("buffer_blocked", "Buffer backup accepts approved assistant drafts only.");
  }
  if (draft.followUpId) {
    const followUp = await getFollowUp(db, draft.followUpId);
    if (followUp.sensitivity !== "ordinary") {
      throw new OpsError("buffer_blocked", "Sensitive follow-ups stay on the human queue.");
    }
  }
  const result = await scheduleGroupNotification(policy, { text: draft.body }, fetchImpl);
  if (!result.ok || !result.bufferPostId) {
    await logAction(db, actor, "publication.buffer_not_sent", "draft", draftId, {
      status: result.status,
      message: result.message,
    });
    throw new OpsError("buffer_not_sent", result.message);
  }
  const rows = await db.query(
    `INSERT INTO publications (id, draft_id, channel, status, buffer_post_id, evidence)
     VALUES ($1, $2, 'buffer_notification', 'buffer_notification_scheduled', $3, $4)
     RETURNING *`,
    [
      newId(),
      draftId,
      result.bufferPostId,
      "Buffer accepted a notification reminder only. This is not a verified Facebook post.",
    ],
  );
  await logAction(db, actor, "publication.buffer_notification", "publication", text(rows[0], "id"), {
    bufferPostId: result.bufferPostId,
    status: "buffer_notification_scheduled",
  });
  return mapPublication(rows[0]);
}

export async function submitPermalink(
  db: Db,
  publicationId: string,
  permalink: string,
  attestation: Attestation,
  actor: string,
): Promise<Publication> {
  const existing = await db.query("SELECT * FROM publications WHERE id = $1", [publicationId]);
  if (existing.length === 0) throw new OpsError("publication_missing", "Publication not found.");
  const status = text(existing[0], "status");
  if (!["awaiting_human", "buffer_notification_scheduled", "link_submitted", "unverified"].includes(status)) {
    throw new OpsError("bad_publication", `Cannot attach a link to status ${status}.`);
  }
  const verdict = publicationVerdict(permalink, attestation, loadPolicy());
  const rows = await db.query(
    `UPDATE publications
     SET status = $2, permalink = $3, attestation = $4::jsonb, evidence = $5, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [publicationId, verdict.status, permalink.trim(), jsonParam(attestation), verdict.evidence],
  );
  await logAction(db, actor, "publication.link", "publication", publicationId, {
    status: verdict.status,
    permalink: permalink.trim(),
  });
  return mapPublication(rows[0]);
}

export async function listPublications(db: Db): Promise<Publication[]> {
  const rows = await db.query("SELECT * FROM publications ORDER BY created_at DESC");
  return rows.map(mapPublication);
}

export async function listCalendar(db: Db): Promise<Row[]> {
  return db.query("SELECT * FROM calendar_items ORDER BY scheduled_on, title");
}

export async function proposeCalendarItem(
  db: Db,
  input: {
    pillar: string;
    scheduledOn: string;
    title: string;
    body: string;
    voice: Voice;
    sourceFollowUpId?: string | null;
    id?: string;
  },
  actor: string,
): Promise<string> {
  const settings = await getSettings(db);
  if (settings.mode === "observe") {
    throw new OpsError("observe_mode", "Observe mode does not add calendar items.");
  }
  const policy = loadPolicy();
  if (input.sourceFollowUpId && policy.memberSafety.sensitiveStoriesNotMarketing) {
    const followUp = await getFollowUp(db, input.sourceFollowUpId);
    if (followUp.sensitivity === "personal_story" || followUp.sensitivity === "safety") {
      throw new OpsError(
        "member_safety",
        "Sensitive member stories are not turned into calendar posts.",
      );
    }
  }
  const existingRows = await listCalendar(db);
  const existing: RhythmItem[] = existingRows.map((row) => ({
    id: text(row, "id"),
    scheduledOn: asDateOnly(row.scheduled_on),
    pillar: text(row, "pillar"),
    status: text(row, "status"),
  }));
  const decision = rhythmDecision(existing, { scheduledOn: input.scheduledOn, pillar: input.pillar }, policy);
  if (!decision.ok) throw new OpsError("rhythm", decision.reason);
  const id = input.id ?? newId();
  await db.query(
    `INSERT INTO calendar_items (id, pillar, scheduled_on, title, body_draft, voice, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'proposed')`,
    [id, input.pillar, input.scheduledOn, input.title, input.body, input.voice],
  );
  await logAction(db, actor, "calendar.propose", "calendar_item", id, {
    scheduledOn: input.scheduledOn,
    pillar: input.pillar,
  });
  return id;
}

export async function sendCalendarToReview(db: Db, calendarItemId: string, actor: string, now = new Date()): Promise<Draft> {
  const rows = await db.query("SELECT * FROM calendar_items WHERE id = $1", [calendarItemId]);
  if (rows.length === 0) throw new OpsError("calendar_missing", "Calendar item not found.");
  return createDraft(
    db,
    {
      kind: "post",
      intent: "post",
      voice: text(rows[0], "voice") as Voice,
      body: text(rows[0], "body_draft"),
      calendarItemId,
      author: actor,
    },
    actor,
    now,
  );
}

export async function recordLearning(
  db: Db,
  input: { observation: string; decision?: string; source: string; weekKey: string },
  actor: string,
): Promise<string> {
  const id = newId();
  await db.query(
    `INSERT INTO learning_notes (id, week_key, observation, decision, source)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, input.weekKey, input.observation, input.decision ?? null, input.source],
  );
  await logAction(db, actor, "learning.record", "learning_note", id, {});
  return id;
}

export async function listLearning(db: Db): Promise<Row[]> {
  return db.query("SELECT * FROM learning_notes ORDER BY created_at DESC");
}

export async function founderQueue(db: Db): Promise<FollowUp[]> {
  const rows = await db.query(
    `SELECT * FROM follow_ups
     WHERE state NOT IN ('closed') AND kind IN ('first_contribution', 'idea', 'founder')
     ORDER BY created_at ASC
     LIMIT 3`,
  );
  return rows.map(mapFollowUp);
}

export async function countByAction(db: Db, action: string): Promise<number> {
  const rows = await db.query("SELECT COUNT(*)::int AS n FROM action_log WHERE action = $1", [action]);
  return Number(rows[0]?.n ?? 0);
}

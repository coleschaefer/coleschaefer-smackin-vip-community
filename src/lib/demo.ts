import type { Db } from "./db";
import { jsonParam } from "./db";
import { OpsError } from "./errors";
import {
  acknowledgeFollowUp,
  approveDraft,
  assignOwner,
  closeFollowUp,
  contributionReport,
  createDraft,
  createFollowUp,
  createTask,
  getSettings,
  listFollowUps,
  markReadyForPublicUpdate,
  newId,
  queueHumanPublish,
  recordContribution,
  submitPermalink,
  updateSettings,
} from "./ops";
import { loadPolicy } from "./policy";

export interface DemoStep {
  step: string;
  detail: string;
}

export interface DemoResult {
  id: string;
  branch: "verified" | "unverified";
  steps: DemoStep[];
  publicationStatus: string;
  followUpState: string;
  officialContributors: number | null;
  demoContributors: number | null;
  demoReactions: number;
}

const QUESTION =
  "Can I try a single bag of a flavor I haven't had, or do I have to buy a bundle? My order number is 123456.";

export const DEMO_REPLY = `Thanks for asking about trying a flavor before committing to a bundle.

There isn’t a confirmed single-bag option in the fact library, so I can’t say that one is available or quote a price. VIP This Week is the place that will list a confirmed offer if one exists.

For the order-specific part, email contact@smackinsnacks.com and keep the order number out of this thread. An acknowledgement here is not a resolution.

— SMACKIN’ community assistant`;

export async function runDemoPath(
  db: Db,
  branch: "verified" | "unverified",
  now = new Date("2026-11-03T18:00:00-06:00"),
): Promise<DemoResult> {
  const policy = loadPolicy();
  const steps: DemoStep[] = [];
  const previous = await getSettings(db);
  if (previous.publicationPaused) {
    throw new OpsError("paused", "Unpause publication before running the demo.");
  }
  if (previous.mode === "observe") {
    throw new OpsError("observe_mode", "Switch out of observe mode before running the demo.");
  }
  const member = "Demo Member (fixture)";

  await recordContribution(db, {
    displayName: member,
    kind: "comment",
    occurredAt: now,
    source: "demo_fixture",
    body: "Fixture question recorded for the demo path. Not a live group post.",
    threadRef: "demo",
  });
  await recordContribution(db, {
    displayName: member,
    kind: "reaction",
    occurredAt: now,
    source: "demo_fixture",
    threadRef: "demo",
  });
  await recordContribution(db, {
    displayName: "Cole Schaefer",
    kind: "comment",
    occurredAt: now,
    source: "demo_fixture",
    body: "Staff fixture. Excluded from unique contributors.",
    threadRef: "demo",
  });
  steps.push({
    step: "question",
    detail: "Recorded a fixture member comment, a reaction, and a staff comment. Nothing was sent to Facebook.",
  });

  const followUp = await createFollowUp(
    db,
    {
      title: "Demo — single bag vs bundle",
      memberDisplayName: member,
      questionText: QUESTION,
      sensitivity: "order",
      kind: "question",
    },
    "demo",
  );
  const tasked = await createTask(db, followUp.id, "Answer from verified facts and route the order number to support.", "demo");
  steps.push({ step: "task", detail: `Follow-up ${followUp.id} is ${tasked.state}.` });

  await acknowledgeFollowUp(db, followUp.id, "demo");
  await assignOwner(db, followUp.id, "Community owner", "demo");
  await markReadyForPublicUpdate(db, followUp.id, "demo");

  if (DEMO_REPLY.includes("123456")) {
    throw new OpsError("member_safety", "Demo reply echoed an order number.");
  }
  const draft = await createDraft(
    db,
    {
      kind: "reply",
      intent: "reply",
      voice: "assistant",
      body: DEMO_REPLY,
      followUpId: followUp.id,
      author: "policy_composer",
    },
    "demo",
    now,
  );
  if (!draft.gatePass) {
    throw new OpsError("fact_gate", draft.gateNotes.join(" "));
  }
  const approved = await approveDraft(db, draft.id, "demo", now);
  steps.push({
    step: "approved_reply",
    detail: `Draft ${approved.id} approved. Author is the policy composer, not a claim that Grok ran.`,
  });

  await updateSettings(db, { publicationPaused: true }, "demo");
  let pauseBlocked = false;
  try {
    await queueHumanPublish(db, approved.id, "demo");
  } catch (error) {
    pauseBlocked = error instanceof OpsError && error.code === "paused";
  } finally {
    await updateSettings(db, { publicationPaused: previous.publicationPaused }, "demo");
  }
  if (!pauseBlocked) {
    throw new OpsError("paused", "Pause did not block the queue.");
  }
  steps.push({ step: "pause_checked", detail: "Publication pause blocked the queue, then the previous pause flag was restored." });

  const publication = await queueHumanPublish(db, approved.id, "demo");
  if (publication.status !== "awaiting_human") {
    throw new OpsError("bad_publication", "Human queue did not stay awaiting a person.");
  }
  steps.push({
    step: "queued",
    detail: `${publication.id} is awaiting_human. No Facebook or Buffer call was made.`,
  });

  const permalink =
    branch === "verified"
      ? `https://www.facebook.com/groups/${policy.group.id}/posts/900000000000001/`
      : "https://example.com/not-a-group-post";
  const linked = await submitPermalink(
    db,
    publication.id,
    permalink,
    { postedByHuman: true, textMatchesDraft: true, actor: "operator" },
    "demo",
  );
  steps.push({
    step: branch === "verified" ? "verified_publish" : "unverified_publish",
    detail: `${linked.status}: ${linked.evidence}`,
  });

  let followUpState = "public_update_ready";
  if (linked.status === "verified") {
    const closed = await closeFollowUp(
      db,
      followUp.id,
      "Public reply verified by operator attestation. Member was sent to contact@smackinsnacks.com for the order. No single-bag offer was confirmed.",
      "demo",
    );
    followUpState = closed.state;
    steps.push({ step: "closure", detail: "Follow-up closed with an outcome." });
  } else {
    const open = await listFollowUps(db);
    followUpState = open.find((item) => item.id === followUp.id)?.state ?? followUpState;
    steps.push({
      step: "closure",
      detail: "Link was unverified, so the follow-up stays open. It was not marked published.",
    });
  }

  const official = await contributionReport(db, now, policy.metrics.officialSources, "official");
  const demoReport = await contributionReport(db, now, policy.metrics.demoSources, "demo");
  const demoWeek = demoReport.weeks.at(-1);
  steps.push({
    step: "reporting",
    detail: `Demo unique contributors in the latest week bucket: ${demoWeek?.uniqueContributors ?? 0}. Reactions in that bucket: ${demoWeek?.reactions ?? 0}. Staff exclusions in that bucket: ${demoWeek?.staffOrAgentExcluded ?? 0}.`,
  });

  const id = newId();
  await db.query(`INSERT INTO demo_runs (id, branch, trace) VALUES ($1, $2, $3::jsonb)`, [
    id,
    branch,
    jsonParam(steps),
  ]);

  return {
    id,
    branch,
    steps,
    publicationStatus: linked.status,
    followUpState,
    officialContributors: official.weeks.at(-1)?.uniqueContributors ?? 0,
    demoContributors: demoWeek?.uniqueContributors ?? 0,
    demoReactions: demoWeek?.reactions ?? 0,
  };
}

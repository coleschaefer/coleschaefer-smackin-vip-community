import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { rhythmDecision } from "../src/lib/calendar";
import { CAPABILITIES } from "../src/lib/capabilities";
import { HUB_DRAFTS } from "../src/lib/content/hubs";
import { runDemoPath } from "../src/lib/demo";
import type { Db } from "../src/lib/db";
import { OpsError } from "../src/lib/errors";
import { evaluateDraft } from "../src/lib/gate";
import { GROK_TOOLS } from "../src/lib/grok/tools";
import { computeContributionReport, type ContributionRow } from "../src/lib/metrics";
import {
  acknowledgeFollowUp,
  approveDraft,
  assignOwner,
  attestColePersonalized,
  closeFollowUp,
  confirmHandoff,
  createDraft,
  createFollowUp,
  createTask,
  getSettings,
  listDrafts,
  markReadyForPublicUpdate,
  proposeCalendarItem,
  queueHumanPublish,
  scheduleBufferBackup,
  submitPermalink,
  updateSettings,
} from "../src/lib/ops";
import { classifyPermalink } from "../src/lib/permalink";
import { loadPolicy } from "../src/lib/policy";
import { notificationVariables } from "../src/lib/buffer";
import { freshDb, seededDb } from "./helpers";

const NOW = new Date("2026-11-03T18:00:00-06:00");
const open: Db[] = [];

async function db(): Promise<Db> {
  const created = await freshDb();
  open.push(created);
  return created;
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((item) => item.close()));
});

function facts() {
  return [
    {
      statement:
        "From 2026-11-02 through 2026-11-08 the group may tease that an advent calendar is in the works. Dates, prices, access, and availability are not confirmed.",
      status: "verified" as const,
      effectiveFrom: "2026-11-02",
      effectiveUntil: "2026-11-08",
    },
    {
      statement: "Private order support email is contact@smackinsnacks.com. Approved 2026-11-03.",
      status: "verified" as const,
      effectiveFrom: "2026-11-03",
      effectiveUntil: null,
    },
  ];
}

describe("acceptance", () => {
  it("AT-01 defaults to draft and does not publish", async () => {
    const database = await seededDb();
    open.push(database);
    const settings = await getSettings(database);
    const policy = loadPolicy();
    expect(settings.mode).toBe("draft");
    expect(settings.publicationPaused).toBe(false);
    expect(policy.modes.default).toBe("draft");
    expect(policy.publication.unattendedGroupWrite).toBe(false);
    expect(policy.publication.primary).toBe("human_assisted_browser");
  });

  it("AT-02 keeps the assistant distinct from Cole", async () => {
    const database = await db();
    const policy = loadPolicy();
    expect(GROK_TOOLS.map((tool) => tool.name)).not.toEqual(expect.arrayContaining(["publish_to_facebook", "approve", "queue_publish"]));
    expect(GROK_TOOLS.some((tool) => tool.name.includes("publish"))).toBe(false);
    const founder = await createDraft(
      database,
      {
        kind: "post",
        intent: "post",
        voice: "founder_draft",
        body: "One real note from the week belongs here after Cole writes it. No launch is announced.",
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(founder.gatePass).toBe(true);
    expect(founder.gateNotes.join(" ")).toContain("Cole");
    const approved = await approveDraft(database, founder.id, "test", NOW);
    await expect(queueHumanPublish(database, approved.id, "test")).rejects.toBeInstanceOf(OpsError);
    await attestColePersonalized(database, approved.id, "test");
    const queued = await queueHumanPublish(database, approved.id, "test");
    expect(queued.status).toBe("awaiting_human");
    expect(queued.evidence.toLowerCase()).toContain("cole");
    const impersonation = await createDraft(
      database,
      {
        kind: "reply",
        intent: "reply",
        voice: "assistant",
        body: "I'm Cole and I tasted this batch last night.",
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(impersonation.gatePass).toBe(false);
    expect(policy.identity.assistantName).toContain("assistant");
  });

  it("AT-03 excludes staff and agent and keeps reactions separate", () => {
    const policy = loadPolicy();
    const rows: ContributionRow[] = [
      row("m-a", "Sample Member A", false, false, "comment", "2026-11-03T15:00:00-06:00"),
      row("m-a", "Sample Member A", false, false, "reaction", "2026-11-03T15:05:00-06:00"),
      row("cole", "Cole Schaefer", true, false, "comment", "2026-11-03T16:00:00-06:00"),
      row("marc", "Marc", true, false, "post", "2026-11-03T16:05:00-06:00"),
      row("agent", "SMACKIN’ community assistant", false, true, "comment", "2026-11-03T16:10:00-06:00"),
    ];
    const report = computeContributionReport(rows, NOW, policy, "test");
    const week = report.weeks.find((item) => item.weekStart === "2026-11-02");
    expect(week?.uniqueContributors).toBe(1);
    expect(week?.reactions).toBe(1);
    expect(week?.staffOrAgentExcluded).toBe(3);
    expect(policy.metrics.reactionsSeparate).toBe(true);
  });

  it("AT-04 reports 7-day and 28-day return only for matured cohorts", () => {
    const policy = loadPolicy();
    const rows: ContributionRow[] = [
      row("a", "Sample Member A", false, false, "comment", "2026-10-01T10:00:00-05:00"),
      row("a", "Sample Member A", false, false, "comment", "2026-10-04T10:00:00-05:00"),
      row("a", "Sample Member A", false, false, "reaction", "2026-10-02T10:00:00-05:00"),
      row("b", "Sample Member B", false, false, "post", "2026-10-20T10:00:00-05:00"),
      row("c", "Sample Member C", false, false, "comment", "2026-11-01T10:00:00-06:00"),
      row("d", "Sample Member D", false, false, "comment", "2026-11-03T09:00:00-06:00"),
      row("cole", "Cole Schaefer", true, false, "comment", "2026-10-04T12:00:00-05:00"),
    ];
    const report = computeContributionReport(rows, NOW, policy, "illustration");
    const seven = report.returns.find((item) => item.windowDays === 7);
    const twentyEight = report.returns.find((item) => item.windowDays === 28);
    expect(seven).toMatchObject({ matured: 2, returned: 1, rate: 0.5 });
    expect(seven?.immature).toBe(2);
    expect(twentyEight).toMatchObject({ matured: 1, returned: 1, rate: 1 });
    expect(twentyEight?.immature).toBe(3);
  });

  it("AT-05 blocks invented prices, dates, and access windows", () => {
    const result = evaluateDraft({
      body: "The tin drops November 20 for $39 with 24-hour early access.",
      voice: "assistant",
      intent: "post",
      now: NOW,
      facts: facts(),
      policy: loadPolicy(),
      handoffConfirmed: false,
      recentNormalizedBodies: [],
      repliesToday: 0,
    });
    expect(result.pass).toBe(false);
    expect(result.notes.join(" ")).toMatch(/price|date|access/i);
  });

  it("AT-06 allows an advent tease only inside the window and without details", () => {
    const policy = loadPolicy();
    const plain = evaluateDraft({
      body: "Advent calendar: something fun is in the works. Details are not locked yet. No prices or guarantees.",
      voice: "assistant",
      intent: "post",
      now: NOW,
      facts: facts(),
      policy,
      handoffConfirmed: false,
      recentNormalizedBodies: [],
      repliesToday: 0,
    });
    expect(plain.pass).toBe(true);
    const priced = evaluateDraft({
      ...gateBase(),
      body: "The advent calendar is $29.",
    });
    expect(priced.pass).toBe(false);
    const later = evaluateDraft({
      ...gateBase(),
      now: new Date("2026-11-16T12:00:00-06:00"),
      body: "An advent calendar is coming.",
    });
    expect(later.pass).toBe(false);
  });

  it("AT-07 sends order questions to the support email and strips identifiers", async () => {
    const database = await db();
    const leaked = await createDraft(
      database,
      {
        kind: "reply",
        intent: "reply",
        voice: "assistant",
        body: "Your order number is 123456. Email hello@example.com.",
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(leaked.gatePass).toBe(false);
    const safe = await createDraft(
      database,
      {
        kind: "reply",
        intent: "reply",
        voice: "assistant",
        body: "For anything about a specific order, email contact@smackinsnacks.com and keep the order number out of the thread.",
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(safe.gatePass).toBe(true);
    expect(loadPolicy().support.email).toBe("contact@smackinsnacks.com");
  });

  it("AT-08 enforces the weekly rhythm and confirm placeholders", async () => {
    const database = await db();
    const policy = loadPolicy();
    await proposeCalendarItem(
      database,
      {
        pillar: "flavor_lab",
        scheduledOn: "2026-11-02",
        title: "Monday",
        body: "A real question with no offer attached.",
        voice: "assistant",
      },
      "test",
    );
    await expect(
      proposeCalendarItem(
        database,
        {
          pillar: "flavor_lab",
          scheduledOn: "2026-11-02",
          title: "Second Monday",
          body: "Another post.",
          voice: "assistant",
        },
        "test",
      ),
    ).rejects.toBeInstanceOf(OpsError);
    await expect(
      proposeCalendarItem(
        database,
        {
          pillar: "flavor_lab",
          scheduledOn: "2026-11-05",
          title: "Thursday",
          body: "Off rhythm.",
          voice: "assistant",
        },
        "test",
      ),
    ).rejects.toBeInstanceOf(OpsError);
    const crowded = rhythmDecision(
      ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-06", "2026-11-08"].map((scheduledOn, index) => ({
        scheduledOn,
        pillar: Object.values(policy.contentRhythm.pillars)[index],
        status: "proposed",
      })),
      { scheduledOn: "2026-11-02", pillar: "flavor_lab" },
      { ...policy, contentRhythm: { ...policy.contentRhythm, maxRoutinePostsPerDay: 2 } },
    );
    expect(crowded.ok).toBe(false);
    expect(crowded.reason).toMatch(/week/i);
    const blocked = await createDraft(
      database,
      {
        kind: "post",
        intent: "post",
        voice: "assistant",
        body: "What we heard\n[CONFIRM theme]",
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(blocked.status).toBe("blocked");
    await expect(approveDraft(database, blocked.id, "test", NOW)).rejects.toBeInstanceOf(OpsError);
  });

  it("AT-09 requires a task, a handoff, and an outcome", async () => {
    const database = await db();
    const followUp = await createFollowUp(
      database,
      { title: "Missing item", memberDisplayName: "Sample Member A", questionText: "Bag was short.", sensitivity: "order" },
      "test",
    );
    await expect(acknowledgeFollowUp(database, followUp.id, "test")).rejects.toBeInstanceOf(OpsError);
    await createTask(database, followUp.id, "Route to support", "test");
    await acknowledgeFollowUp(database, followUp.id, "test");
    await assignOwner(database, followUp.id, "Support", "test");
    await expect(closeFollowUp(database, followUp.id, "done", "test")).rejects.toBeInstanceOf(OpsError);
    await markReadyForPublicUpdate(database, followUp.id, "test");
    await expect(closeFollowUp(database, followUp.id, "   ", "test")).rejects.toBeInstanceOf(OpsError);
    const closed = await closeFollowUp(database, followUp.id, "Member was directed to support. No public promise made.", "test");
    expect(closed.state).toBe("closed");

    const other = await createFollowUp(
      database,
      { title: "Handoff", memberDisplayName: "Sample Member B", questionText: "Please check this." },
      "test",
    );
    const premature = await createDraft(
      database,
      {
        kind: "reply",
        intent: "reply",
        voice: "assistant",
        body: "I passed this along to the team.",
        followUpId: other.id,
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(premature.gatePass).toBe(false);
    await confirmHandoff(database, other.id, "Support owner accepted the question.", "test");
    const ready = await createDraft(
      database,
      {
        kind: "reply",
        intent: "reply",
        voice: "assistant",
        body: "I passed this along to the team. For the order itself, email contact@smackinsnacks.com.",
        followUpId: other.id,
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(ready.gatePass).toBe(true);
  });

  it("AT-10 enforces reply caps, duplicates, and acknowledgement shape", async () => {
    const database = await db();
    const cap = loadPolicy().replyCaps.maxPublicRepliesPerStaffedDay;
    for (let index = 0; index < cap; index += 1) {
      const draft = await createDraft(
        database,
        {
          kind: "reply",
          intent: "reply",
          voice: "assistant",
          body: `Thanks for the bag photo number ${index}. Glad it got there.`,
          author: "operator",
        },
        "test",
        NOW,
      );
      expect(draft.gatePass).toBe(true);
    }
    const overflow = await createDraft(
      database,
      {
        kind: "reply",
        intent: "reply",
        voice: "assistant",
        body: "Thanks for one more bag photo that is still distinct.",
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(overflow.gatePass).toBe(false);
    const duplicate = await createDraft(
      database,
      {
        kind: "reply",
        intent: "reply",
        voice: "assistant",
        body: "Thanks for the bag photo number 0. Glad it got there.",
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(duplicate.gateNotes.join(" ")).toMatch(/repeats|cap/i);
    const question = await createDraft(
      database,
      {
        kind: "reply",
        intent: "ack",
        voice: "assistant",
        body: "Love this. What else should we make?",
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(question.gatePass).toBe(false);
    expect(question.gateNotes.join(" ")).toMatch(/question/i);
  });

  it("AT-11 observe mode does not draft or queue", async () => {
    const database = await db();
    await updateSettings(database, { mode: "observe" }, "test");
    await expect(
      createDraft(
        database,
        { kind: "reply", intent: "reply", voice: "assistant", body: "Hello from observe.", author: "agent" },
        "test",
        NOW,
      ),
    ).rejects.toBeInstanceOf(OpsError);
    await expect(
      proposeCalendarItem(
        database,
        {
          pillar: "flavor_lab",
          scheduledOn: "2026-11-02",
          title: "Nope",
          body: "Nope",
          voice: "assistant",
        },
        "test",
      ),
    ).rejects.toBeInstanceOf(OpsError);
  });

  it("AT-12 draft mode queues a person and does not call Buffer", async () => {
    const database = await db();
    const draft = await createDraft(
      database,
      {
        kind: "post",
        intent: "post",
        voice: "assistant",
        body: "Collector corner is open for photos and identification. No rarity or resale values.",
        author: "operator",
      },
      "test",
      NOW,
    );
    const approved = await approveDraft(database, draft.id, "test", NOW);
    const queued = await queueHumanPublish(database, approved.id, "test");
    expect(queued.status).toBe("awaiting_human");
    await expect(scheduleBufferBackup(database, approved.id, "test", fetch)).rejects.toMatchObject({
      code: "buffer_blocked",
    });
    expect(queued.status).not.toBe("verified");
  });

  it("AT-13 bounded live Buffer backup is notification-only", async () => {
    const database = await db();
    await updateSettings(database, { mode: "bounded_live" }, "test");
    const draft = await createDraft(
      database,
      {
        kind: "post",
        intent: "post",
        voice: "assistant",
        body: "A collector question for the group. No offer is attached.",
        author: "operator",
      },
      "test",
      NOW,
    );
    const approved = await approveDraft(database, draft.id, "test", NOW);
    const variables = notificationVariables(loadPolicy(), { text: approved.body });
    expect((variables.input as { schedulingType: string }).schedulingType).toBe("notification");
    expect(JSON.stringify(variables)).not.toContain("automatic");
    process.env.BUFFER_API_KEY = "test-buffer-key";
    let body = "";
    const fetchImpl: typeof fetch = async (_url, init) => {
      body = String(init?.body ?? "");
      return new Response(
        JSON.stringify({ data: { createPost: { post: { id: "buf_1", dueAt: null } } } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    try {
      const publication = await scheduleBufferBackup(database, approved.id, "test", fetchImpl);
      expect(publication.status).toBe("buffer_notification_scheduled");
      expect(publication.status).not.toBe("verified");
      expect(body).toContain("notification");
      expect(body).not.toContain("automatic");
      const header = JSON.parse(body) as { variables: { input: { schedulingType: string } } };
      expect(header.variables.input.schedulingType).toBe("notification");
    } finally {
      delete process.env.BUFFER_API_KEY;
    }
    expect(CAPABILITIES.find((item) => item.key === "facebook_group_publish")?.status).toBe("unsupported");
  });

  it("AT-14 verifies only a group permalink with a human attestation", async () => {
    const database = await db();
    const policy = loadPolicy();
    expect(classifyPermalink(`https://www.facebook.com/groups/${policy.group.id}/posts/123/`, policy)).toBe("group_post");
    expect(classifyPermalink("https://www.facebook.com/groups/999/posts/123/", policy)).toBe("mismatch");
    expect(classifyPermalink("https://example.com/post", policy)).toBe("invalid");
    const draft = await createDraft(
      database,
      { kind: "post", intent: "post", voice: "assistant", body: "A plain community note with no offer.", author: "operator" },
      "test",
      NOW,
    );
    const approved = await approveDraft(database, draft.id, "test", NOW);
    const queued = await queueHumanPublish(database, approved.id, "test");
    const verified = await submitPermalink(
      database,
      queued.id,
      `https://www.facebook.com/groups/${policy.group.id}/posts/555/`,
      { postedByHuman: true, textMatchesDraft: true, actor: "operator" },
      "test",
    );
    expect(verified.status).toBe("verified");
    const second = await queueHumanPublish(database, approved.id, "test");
    const unverified = await submitPermalink(
      database,
      second.id,
      "https://facebook.com/share/not-a-group-permalink",
      { postedByHuman: true, textMatchesDraft: true, actor: "operator" },
      "test",
    );
    expect(unverified.status).toBe("unverified");
    expect(verified.status).not.toBe("published");
  });

  it("AT-15 protects private details and sensitive stories", async () => {
    const database = await db();
    const story = await createFollowUp(
      database,
      {
        title: "Family story",
        memberDisplayName: "Sample Member A",
        questionText: "A personal family moment.",
        sensitivity: "personal_story",
      },
      "test",
    );
    await expect(
      proposeCalendarItem(
        database,
        {
          pillar: "member_contribution",
          scheduledOn: "2026-11-03",
          title: "Reuse the story",
          body: "We loved this family story.",
          voice: "assistant",
          sourceFollowUpId: story.id,
        },
        "test",
      ),
    ).rejects.toMatchObject({ code: "member_safety" });
    const pii = await createDraft(
      database,
      {
        kind: "reply",
        intent: "reply",
        voice: "assistant",
        body: "Ship it to 18 Oak Street and call 312-555-0100.",
        author: "operator",
      },
      "test",
      NOW,
    );
    expect(pii.gatePass).toBe(false);
  });

  it("AT-16 runs question to report without a live group post", async () => {
    const verifiedDb = await seededDb();
    const unverifiedDb = await seededDb();
    open.push(verifiedDb, unverifiedDb);
    const original = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("network is not allowed in the demo path");
    }) as typeof fetch;
    try {
      const verified = await runDemoPath(verifiedDb, "verified", NOW);
      expect(verified.steps.map((step) => step.step)).toEqual([
        "question",
        "task",
        "approved_reply",
        "pause_checked",
        "queued",
        "verified_publish",
        "closure",
        "reporting",
      ]);
      expect(verified.publicationStatus).toBe("verified");
      expect(verified.followUpState).toBe("closed");
      expect(verified.demoContributors).toBe(1);
      expect(verified.demoReactions).toBe(1);
      const unverified = await runDemoPath(unverifiedDb, "unverified", NOW);
      expect(unverified.publicationStatus).toBe("unverified");
      expect(unverified.followUpState).not.toBe("closed");
      const hubs = await listDrafts(verifiedDb);
      const flavor = hubs.find((item) => item.id === "hub-flavor-lab");
      const vip = hubs.find((item) => item.id === "hub-vip-this-week");
      const help = hubs.find((item) => item.id === "hub-help");
      const collector = hubs.find((item) => item.id === "hub-collector");
      const start = hubs.find((item) => item.id === "hub-start-here");
      expect(flavor?.gatePass).toBe(false);
      expect(vip?.gatePass).toBe(true);
      expect(help?.gatePass).toBe(true);
      expect(collector?.gatePass).toBe(true);
      expect(start?.gatePass).toBe(true);
      expect(HUB_DRAFTS).toHaveLength(5);
      const report = readFileSync("docs/capability-report.md", "utf8");
      for (const capability of CAPABILITIES) {
        expect(report).toContain(capability.key);
      }
    } finally {
      globalThis.fetch = original;
    }
  });
});

function row(
  memberId: string,
  displayName: string,
  isStaff: boolean,
  isAgent: boolean,
  kind: ContributionRow["kind"],
  occurredAt: string,
): ContributionRow {
  return {
    memberId,
    displayName,
    isStaff,
    isAgent,
    kind,
    occurredAt: new Date(occurredAt),
    source: "sample_not_live",
  };
}

function gateBase() {
  return {
    voice: "assistant" as const,
    intent: "post" as const,
    now: NOW,
    facts: facts(),
    policy: loadPolicy(),
    handoffConfirmed: false,
    recentNormalizedBodies: [],
    repliesToday: 0,
  };
}

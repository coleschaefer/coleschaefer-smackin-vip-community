import type { Db } from "../db";
import { OpsError } from "../errors";
import {
  contributionReport,
  createDraft,
  createFollowUp,
  createTask,
  getSettings,
  listFacts,
  listFollowUps,
  proposeCalendarItem,
  recordLearning,
} from "../ops";
import { loadPolicy, type Policy } from "../policy";
import type { DraftIntent, Voice } from "../gate";

export interface ToolContext {
  db: Db;
  actor: string;
  now: Date;
}

export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const GROK_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    name: "search_knowledge",
    description: "Search verified and unverified operating facts. Unverified facts are not permission to publish a claim.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_operating_facts",
    description: "Read the support route, group, tease windows, mode, and publication pause flag.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "list_open_follow_ups",
    description: "List follow-ups that are not closed.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    type: "function",
    name: "create_follow_up",
    description: "Record a member question or idea as a follow-up. This does not reply in Facebook.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        memberDisplayName: { type: "string" },
        questionText: { type: "string" },
        sensitivity: { type: "string", enum: ["ordinary", "order", "safety", "personal_story"] },
        kind: { type: "string", enum: ["question", "idea", "first_contribution", "founder"] },
      },
      required: ["title", "memberDisplayName", "questionText"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_task",
    description: "Attach a task to a follow-up so it can be acknowledged.",
    parameters: {
      type: "object",
      properties: { followUpId: { type: "string" }, title: { type: "string" } },
      required: ["followUpId", "title"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "draft_public_text",
    description:
      "Store a proposed public reply or post. The fact gate runs first. This does not approve or publish.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["reply", "post"] },
        intent: { type: "string", enum: ["reply", "ack", "post"] },
        voice: { type: "string", enum: ["assistant", "founder_draft"] },
        body: { type: "string" },
        followUpId: { type: "string" },
      },
      required: ["kind", "intent", "voice", "body"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "record_learning",
    description: "Save an operating observation. Do not record invented results.",
    parameters: {
      type: "object",
      properties: {
        observation: { type: "string" },
        decision: { type: "string" },
        weekKey: { type: "string" },
      },
      required: ["observation", "weekKey"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "propose_calendar_item",
    description: "Propose a calendar slot inside the weekly pillar rhythm. Does not publish.",
    parameters: {
      type: "object",
      properties: {
        pillar: { type: "string" },
        scheduledOn: { type: "string", description: "YYYY-MM-DD in America/Chicago" },
        title: { type: "string" },
        body: { type: "string" },
        voice: { type: "string", enum: ["assistant", "founder_draft"] },
        sourceFollowUpId: { type: "string" },
      },
      required: ["pillar", "scheduledOn", "title", "body", "voice"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "contribution_snapshot",
    description: "Read official contribution metrics. Sample and demo rows are excluded.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
];

const FORBIDDEN = ["approve", "publish", "publish_to_facebook", "schedule_buffer", "queue_publish"];

export function assertToolsAreBounded(tools: ToolDefinition[] = GROK_TOOLS): void {
  const names = tools.map((tool) => tool.name);
  for (const name of names) {
    if (FORBIDDEN.some((blocked) => name.includes(blocked))) {
      throw new Error(`Tool ${name} is not allowed.`);
    }
  }
}

function toolError(error: unknown): { error: string } {
  if (error instanceof OpsError) return { error: `${error.code}: ${error.message}` };
  if (error instanceof Error) return { error: error.message };
  return { error: "Tool failed." };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const policy = loadPolicy();
  try {
    switch (name) {
      case "search_knowledge": {
        const query = String(args.query ?? "").toLowerCase();
        const facts = await listFacts(ctx.db);
        return facts
          .filter((fact) => fact.statement.toLowerCase().includes(query) || fact.slug.includes(query))
          .map((fact) => ({
            slug: fact.slug,
            status: fact.status,
            statement: fact.statement,
            effectiveFrom: fact.effectiveFrom,
            effectiveUntil: fact.effectiveUntil,
          }));
      }
      case "get_operating_facts": {
        const settings = await getSettings(ctx.db);
        return publicFacts(policy, settings.mode, settings.publicationPaused);
      }
      case "list_open_follow_ups": {
        const rows = await listFollowUps(ctx.db);
        return rows.filter((row) => row.state !== "closed");
      }
      case "create_follow_up":
        return createFollowUp(
          ctx.db,
          {
            title: String(args.title),
            memberDisplayName: String(args.memberDisplayName),
            questionText: String(args.questionText),
            sensitivity: args.sensitivity ? String(args.sensitivity) : "ordinary",
            kind: args.kind ? String(args.kind) : "question",
          },
          ctx.actor,
        );
      case "create_task":
        return createTask(ctx.db, String(args.followUpId), String(args.title), ctx.actor);
      case "draft_public_text":
        return createDraft(
          ctx.db,
          {
            kind: args.kind as "reply" | "post",
            intent: args.intent as DraftIntent,
            voice: args.voice as Voice,
            body: String(args.body),
            followUpId: args.followUpId ? String(args.followUpId) : null,
            author: "grok",
          },
          ctx.actor,
          ctx.now,
        );
      case "record_learning":
        return recordLearning(
          ctx.db,
          {
            observation: String(args.observation),
            decision: args.decision ? String(args.decision) : undefined,
            weekKey: String(args.weekKey),
            source: "grok",
          },
          ctx.actor,
        );
      case "propose_calendar_item":
        return proposeCalendarItem(
          ctx.db,
          {
            pillar: String(args.pillar),
            scheduledOn: String(args.scheduledOn),
            title: String(args.title),
            body: String(args.body),
            voice: args.voice as Voice,
            sourceFollowUpId: args.sourceFollowUpId ? String(args.sourceFollowUpId) : null,
          },
          ctx.actor,
        );
      case "contribution_snapshot":
        return contributionReport(ctx.db, ctx.now, policy.metrics.officialSources, "official");
      default:
        return { error: `Unknown tool ${name}. Approve and publish are not tools.` };
    }
  } catch (error) {
    return toolError(error);
  }
}

export function publicFacts(policy: Policy, mode: string, publicationPaused: boolean) {
  return {
    assistantName: policy.identity.assistantName,
    neverImpersonate: policy.identity.neverImpersonate,
    supportEmail: policy.support.email,
    groupUrl: policy.group.url,
    mode,
    publicationPaused,
    teaseWindows: policy.teaseWindows,
    maxPostsPerWeek: policy.contentRhythm.maxPostsPerWeek,
    pillars: policy.contentRhythm.pillars,
    unattendedGroupWrite: policy.publication.unattendedGroupWrite,
  };
}

export function systemInstructions(policy: Policy): string {
  return [
    `You are ${policy.identity.assistantName} for the private SMACKIN’ VIP Facebook group.`,
    `You are not ${policy.identity.neverImpersonate.join(" or ")}. Never write in Cole's voice as if the words were already his.`,
    "Use the tools to read facts and to store drafts, tasks, and notes. You cannot approve, publish, or call Facebook.",
    `The only public support email is ${policy.support.email}.`,
    "Do not invent prices, dates, access windows, refunds, or scarcity. If a fact is unverified, say it is unconfirmed.",
    "During the advent tease window you may say an advent calendar is in the works only, with no date, price, or access.",
    "Keep order numbers, addresses, and payment details out of public copy.",
    "Do not say you passed something along unless a tool result shows a confirmed handoff.",
    policy.identity.founderDraftLabel,
  ].join("\n");
}

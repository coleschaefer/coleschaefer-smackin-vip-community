import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";

const policySchema = z.object({
  version: z.string(),
  timezone: z.string(),
  identity: z.object({
    assistantName: z.string(),
    neverImpersonate: z.array(z.string()).min(1),
    founderDraftLabel: z.string(),
  }),
  modes: z.object({
    default: z.enum(["observe", "draft", "bounded_live"]),
    allowed: z.array(z.enum(["observe", "draft", "bounded_live"])).min(1),
  }),
  staffExcluded: z.array(z.string()).min(1),
  agentExcludedNames: z.array(z.string()).min(1),
  support: z.object({ email: z.string().email() }),
  group: z.object({ id: z.string(), url: z.string().url() }),
  drive: z.object({
    folderId: z.string(),
    folderUrl: z.string().url(),
    draftsDocumentId: z.string(),
  }),
  buffer: z.object({
    channelId: z.string(),
    organizationId: z.string(),
    schedulingType: z.literal("notification"),
    role: z.literal("backup"),
  }),
  contentRhythm: z.object({
    maxPostsPerWeek: z.number().int().positive(),
    maxRoutinePostsPerDay: z.number().int().positive(),
    pillars: z.object({
      monday: z.string(),
      tuesday: z.string(),
      wednesday: z.string(),
      friday: z.string(),
      sunday: z.string(),
    }),
  }),
  replyCaps: z.object({
    maxPublicRepliesPerStaffedDay: z.number().int().positive(),
    rejectDuplicateBody: z.boolean(),
    rejectQuestionOnAcknowledgement: z.boolean(),
  }),
  followUp: z.object({
    acknowledgementRequiresTask: z.boolean(),
    passedAlongRequiresHandoff: z.boolean(),
    closeRequiresOutcome: z.boolean(),
  }),
  factGate: z.object({
    blockUnverified: z.array(z.string()),
    blockConfirmPlaceholders: z.boolean(),
  }),
  teaseWindows: z.array(
    z.object({
      id: z.string(),
      topic: z.string(),
      start: z.string(),
      end: z.string(),
      allowsMentionWithoutVerifiedOffer: z.boolean(),
      forbids: z.array(z.string()),
    }),
  ),
  metrics: z.object({
    contributorKinds: z.array(z.enum(["post", "comment", "reaction"])),
    reactionsSeparate: z.boolean(),
    excludeStaff: z.boolean(),
    excludeAgent: z.boolean(),
    returnWindowsDays: z.array(z.number().int().positive()),
    maturedCohortsOnly: z.boolean(),
    officialSources: z.array(z.string()),
    illustrationSources: z.array(z.string()),
    demoSources: z.array(z.string()),
  }),
  memberSafety: z.object({
    blockPublicPii: z.boolean(),
    sensitiveStoriesNotMarketing: z.boolean(),
  }),
  reviewWindows: z.object({
    timezone: z.string(),
    localTimes: z.array(z.string()),
  }),
  boundedLive: z.object({
    bufferNotificationAfterApproval: z.boolean(),
    stillHuman: z.array(z.string()),
  }),
  publication: z.object({
    primary: z.literal("human_assisted_browser"),
    backup: z.literal("buffer_notification"),
    unattendedGroupWrite: z.literal(false),
  }),
});

export type Policy = z.infer<typeof policySchema>;
export type OperatingMode = Policy["modes"]["allowed"][number];

let cached: Policy | null = null;

export function policyPath(): string {
  return path.join(process.cwd(), "policy", "runtime-policy.yaml");
}

export function loadPolicy(file = policyPath()): Policy {
  if (cached && file === policyPath()) return cached;
  const raw = parse(readFileSync(file, "utf8"));
  const policy = policySchema.parse(raw);
  if (file === policyPath()) cached = policy;
  return policy;
}

export function resetPolicyCache(): void {
  cached = null;
}

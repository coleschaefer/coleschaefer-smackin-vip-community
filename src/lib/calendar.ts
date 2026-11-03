import type { Policy } from "./policy";
import { mondayOf, weekdayOfIso } from "./time";

export interface RhythmItem {
  id?: string;
  scheduledOn: string;
  pillar: string;
  status: string;
}

const PILLAR_BY_DAY: Record<string, keyof Policy["contentRhythm"]["pillars"] | null> = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: null,
  friday: "friday",
  saturday: null,
  sunday: "sunday",
};

export function expectedPillar(isoDate: string, policy: Policy): string | null {
  const key = PILLAR_BY_DAY[weekdayOfIso(isoDate)];
  if (!key) return null;
  return policy.contentRhythm.pillars[key];
}

export function rhythmDecision(
  existing: RhythmItem[],
  candidate: { scheduledOn: string; pillar: string },
  policy: Policy,
): { ok: boolean; reason: string } {
  const expected = expectedPillar(candidate.scheduledOn, policy);
  if (!expected) {
    return {
      ok: false,
      reason: `${candidate.scheduledOn} is outside the Monday–Sunday pillar rhythm.`,
    };
  }
  if (candidate.pillar !== expected) {
    return {
      ok: false,
      reason: `${candidate.scheduledOn} expects the ${expected} pillar.`,
    };
  }
  const dayCount = existing.filter(
    (item) => item.scheduledOn === candidate.scheduledOn && item.status !== "skipped",
  ).length;
  if (dayCount >= policy.contentRhythm.maxRoutinePostsPerDay) {
    return {
      ok: false,
      reason: "That day already has its routine post. Skip or move one before adding another.",
    };
  }
  const week = mondayOf(candidate.scheduledOn);
  const weekCount = existing.filter(
    (item) => mondayOf(item.scheduledOn) === week && item.status !== "skipped",
  ).length;
  if (weekCount >= policy.contentRhythm.maxPostsPerWeek) {
    return {
      ok: false,
      reason: `The week of ${week} already has ${policy.contentRhythm.maxPostsPerWeek} posts.`,
    };
  }
  return { ok: true, reason: "Within the weekly rhythm." };
}

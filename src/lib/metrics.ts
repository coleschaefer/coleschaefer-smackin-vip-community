import type { Policy } from "./policy";
import { addDaysToInstant, chicagoDate, mondayOf } from "./time";

export interface ContributionRow {
  memberId: string;
  displayName: string;
  isStaff: boolean;
  isAgent: boolean;
  kind: "post" | "comment" | "reaction";
  occurredAt: Date;
  source: string;
}

export interface WeekBucket {
  weekStart: string;
  uniqueContributors: number;
  firstTime: number;
  returning: number;
  posts: number;
  comments: number;
  reactions: number;
  staffOrAgentExcluded: number;
}

export interface ReturnWindow {
  windowDays: number;
  matured: number;
  returned: number;
  immature: number;
  rate: number | null;
}

export interface ContributionReport {
  label: string;
  weeks: WeekBucket[];
  returns: ReturnWindow[];
  coverage: string;
}

function eligible(row: ContributionRow, policy: Policy): boolean {
  if (policy.metrics.excludeStaff && row.isStaff) return false;
  if (policy.metrics.excludeAgent && row.isAgent) return false;
  return policy.metrics.contributorKinds.includes(row.kind);
}

export function computeContributionReport(
  rows: ContributionRow[],
  asOf: Date,
  policy: Policy,
  label: string,
): ContributionReport {
  const people = new Map<string, { first: Date | null; events: Date[] }>();
  for (const row of rows) {
    if (!eligible(row, policy)) continue;
    const current = people.get(row.memberId) ?? { first: null, events: [] };
    current.events.push(row.occurredAt);
    if (!current.first || row.occurredAt < current.first) current.first = row.occurredAt;
    people.set(row.memberId, current);
  }

  const weekMap = new Map<string, WeekBucket>();
  const sorted = [...rows].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const contributorHistory = new Set<string>();

  for (const row of sorted) {
    const day = chicagoDate(row.occurredAt);
    const weekStart = mondayOf(day);
    const bucket = weekMap.get(weekStart) ?? {
      weekStart,
      uniqueContributors: 0,
      firstTime: 0,
      returning: 0,
      posts: 0,
      comments: 0,
      reactions: 0,
      staffOrAgentExcluded: 0,
    };
    if (row.kind === "reaction") bucket.reactions += 1;
    if (row.isStaff || row.isAgent) {
      if (row.kind === "post" || row.kind === "comment") bucket.staffOrAgentExcluded += 1;
    }
    weekMap.set(weekStart, bucket);
  }

  const counted = new Map<string, Set<string>>();
  for (const row of sorted) {
    if (!eligible(row, policy)) continue;
    const weekStart = mondayOf(chicagoDate(row.occurredAt));
    const bucket = weekMap.get(weekStart)!;
    if (row.kind === "post") bucket.posts += 1;
    if (row.kind === "comment") bucket.comments += 1;
    const members = counted.get(weekStart) ?? new Set<string>();
    if (!members.has(row.memberId)) {
      members.add(row.memberId);
      bucket.uniqueContributors += 1;
      if (contributorHistory.has(row.memberId)) bucket.returning += 1;
      else bucket.firstTime += 1;
      contributorHistory.add(row.memberId);
    }
    counted.set(weekStart, members);
  }

  const returns: ReturnWindow[] = policy.metrics.returnWindowsDays.map((windowDays) => {
    let matured = 0;
    let returned = 0;
    let immature = 0;
    for (const person of people.values()) {
      if (!person.first) continue;
      const windowEnd = addDaysToInstant(person.first, windowDays);
      if (policy.metrics.maturedCohortsOnly && asOf < windowEnd) {
        immature += 1;
        continue;
      }
      matured += 1;
      const cameBack = person.events.some(
        (event) => event > person.first! && event <= windowEnd,
      );
      if (cameBack) returned += 1;
    }
    return {
      windowDays,
      matured,
      returned,
      immature,
      rate: matured === 0 ? null : returned / matured,
    };
  });

  const reactionCount = rows.filter((row) => row.kind === "reaction").length;
  return {
    label,
    weeks: [...weekMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    returns,
    coverage:
      rows.length === 0
        ? "No rows in this set. Raw counts are zero; a rate is not shown."
        : `${rows.length} rows in this set, including ${reactionCount} reactions kept out of unique contributors. Rates use matured cohorts only.`,
  };
}

import type { Policy } from "./policy";
import { normalizeBody } from "./text";
import { chicagoDate } from "./time";

export type Voice = "assistant" | "founder_draft";
export type DraftIntent = "reply" | "ack" | "post";

export interface FactRef {
  statement: string;
  status: "verified" | "unverified" | "retired";
  effectiveFrom: string | null;
  effectiveUntil: string | null;
}

export interface GateInput {
  body: string;
  voice: Voice;
  intent: DraftIntent;
  now: Date;
  facts: FactRef[];
  policy: Policy;
  handoffConfirmed: boolean;
  recentNormalizedBodies: string[];
  repliesToday: number;
}

export interface GateResult {
  pass: boolean;
  publishable: boolean;
  requiresCole: boolean;
  notes: string[];
}

const MONTH =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

const PRICE = /\$\s?\d|\b\d+(?:\.\d+)?\s?%/i;
const ACCESS =
  /\b(\d+[-\s]?hours?\s+early|early access|vip access|access window)\b/i;
const AVAILABILITY =
  /\b(on sale|available now|buy it now|goes live|drops on|launching|now available|limited drop)\b/i;
const REFUND =
  /\b(full refund|we(?:'|’)ll refund|you will (?:get|receive) a (?:refund|replacement)|sending a replacement)\b/i;
const SCARCITY = /\b(selling out|almost gone|only \d+ left|last chance)\b/i;
const OFFER_DATE = new RegExp(
  `\\b(?:${MONTH})\\.?\\s+\\d{1,2}\\b|\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b`,
  "i",
);
const ISO_DATE = /\b20\d{2}-\d{2}-\d{2}\b/g;
const IMPERSONATION = /\b(i am|i'm|i’m|this is)\s+cole\b/i;
const PASSED_ALONG =
  /\b(i|we)(?:'ve|’ve| have)? passed (this |it |that )?(along|to the team)\b/i;
const ORDER_NUMBER = /\border\s*(number|no\.?|#)?\s*(is|:|#)?\s*\d{4,}\b/i;
const PHONE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;
const STREET =
  /\b\d{1,6}\s+[a-z0-9.' ]+\s+(st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive)\b/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const CARD = /\b(?:\d[ -]*?){13,16}\b/;

function factCovers(fact: FactRef, isoDate: string): boolean {
  if (fact.status !== "verified") return false;
  if (fact.effectiveFrom && isoDate < fact.effectiveFrom) return false;
  if (fact.effectiveUntil && isoDate > fact.effectiveUntil) return false;
  return true;
}

function verifiedText(facts: FactRef[], isoDate: string): string {
  return facts
    .filter((fact) => factCovers(fact, isoDate))
    .map((fact) => fact.statement.toLowerCase())
    .join("\n");
}

function metadataLines(body: string): string {
  return body
    .split("\n")
    .filter((line) => !/^\s*(last updated|as of|approved|facts used|status)\b/i.test(line))
    .join("\n");
}

function leftoverLongNumbers(body: string, groupId: string): string[] {
  const stripped = body
    .replaceAll(groupId, "")
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(ISO_DATE, "");
  return stripped.match(/\b\d{5,}\b/g) ?? [];
}

export function evaluateDraft(input: GateInput): GateResult {
  const notes: string[] = [];
  const onDate = chicagoDate(input.now);
  const facts = verifiedText(input.facts, onDate);
  const prose = metadataLines(input.body);
  const requiresCole = input.voice === "founder_draft";

  if (requiresCole) {
    notes.push(input.policy.identity.founderDraftLabel);
  }
  if (input.voice === "assistant" && IMPERSONATION.test(input.body)) {
    notes.push("The assistant cannot speak as Cole.");
  }
  if (input.policy.factGate.blockConfirmPlaceholders && /\[CONFIRM/i.test(input.body)) {
    notes.push("Replace every [CONFIRM] before this can be approved.");
  }

  if (input.policy.memberSafety.blockPublicPii) {
    const emails = input.body.match(EMAIL) ?? [];
    const foreign = emails.filter(
      (email) => email.toLowerCase() !== input.policy.support.email.toLowerCase(),
    );
    if (foreign.length > 0) {
      notes.push("Public copy can only use the approved support email.");
    }
    if (ORDER_NUMBER.test(input.body) || leftoverLongNumbers(input.body, input.policy.group.id).length > 0) {
      notes.push("Remove order numbers and other long account identifiers from public copy.");
    }
    if (PHONE.test(input.body) || STREET.test(input.body) || CARD.test(input.body)) {
      notes.push("Remove phone numbers, street addresses, and payment details from public copy.");
    }
  }

  const price = prose.match(PRICE);
  if (price && !facts.includes(price[0].toLowerCase().replace(/\s+/g, ""))) {
    const compact = price[0].toLowerCase().replace(/\s+/g, "");
    if (!facts.replace(/\s+/g, "").includes(compact)) {
      notes.push("A price or percent-off claim is not in a verified fact.");
    }
  }

  if (ACCESS.test(prose) && !/not locked|not applicable|not confirmed|no timed|until confirmed|aren(?:'|’)t locked|are not locked/i.test(prose)) {
    if (!facts.includes("early access") && !facts.includes("access window")) {
      notes.push("An access-window claim is not in a verified fact.");
    }
  }

  if (AVAILABILITY.test(prose) && !facts.includes("available")) {
    notes.push("An availability claim is not in a verified fact.");
  }
  if (REFUND.test(prose)) {
    notes.push("Refund and replacement promises stay with support, not public copy.");
  }
  if (SCARCITY.test(prose)) {
    notes.push("Scarcity language is not backed by a verified fact.");
  }

  const offerDate = prose.match(OFFER_DATE);
  if (offerDate) {
    const token = offerDate[0].toLowerCase();
    if (!facts.includes(token)) {
      notes.push(`An offer date (${offerDate[0]}) is not in a verified fact.`);
    }
  }

  if (/advent calendar/i.test(input.body)) {
    const tease = input.policy.teaseWindows.find(
      (window) =>
        window.topic.toLowerCase() === "advent calendar" &&
        onDate >= window.start &&
        onDate <= window.end,
    );
    const verifiedMention = facts.includes("advent calendar");
    const detailHit =
      PRICE.test(prose) ||
      (ACCESS.test(prose) &&
        !/not locked|not applicable|not confirmed|no timed|until confirmed/i.test(prose)) ||
      AVAILABILITY.test(prose) ||
      Boolean(offerDate);
    if (detailHit) {
      notes.push("Advent calendar copy cannot add a price, date, access window, or availability.");
    } else if (!tease && !verifiedMention) {
      notes.push("Advent calendar is outside the approved tease window and has no verified fact.");
    } else if (tease) {
      notes.push("Advent calendar mention stays a tease: no date, price, or access.");
    }
  }

  if (input.policy.followUp.passedAlongRequiresHandoff && PASSED_ALONG.test(input.body) && !input.handoffConfirmed) {
    notes.push("“Passed along” is allowed only after a confirmed handoff is on the follow-up.");
  }

  if (
    input.policy.replyCaps.rejectQuestionOnAcknowledgement &&
    input.intent === "ack" &&
    input.body.includes("?")
  ) {
    notes.push("Acknowledgements do not add a question.");
  }

  if (input.intent !== "post" && input.repliesToday >= input.policy.replyCaps.maxPublicRepliesPerStaffedDay) {
    notes.push(
      `Reply cap of ${input.policy.replyCaps.maxPublicRepliesPerStaffedDay} public replies for this staffed day is already met.`,
    );
  }

  if (input.policy.replyCaps.rejectDuplicateBody) {
    const normalized = normalizeBody(input.body);
    if (normalized.length > 0 && input.recentNormalizedBodies.some((existing) => existing === normalized)) {
      notes.push("This repeats a recent public reply.");
    }
  }

  const blocking = notes.filter((note) => note !== input.policy.identity.founderDraftLabel && !note.startsWith("Advent calendar mention stays"));
  const pass = blocking.length === 0;
  return {
    pass,
    publishable: pass && !requiresCole,
    requiresCole,
    notes,
  };
}

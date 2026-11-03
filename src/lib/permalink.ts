import type { Policy } from "./policy";

export type PermalinkClass = "group_post" | "mismatch" | "invalid";

export function classifyPermalink(url: string, policy: Policy): PermalinkClass {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return "invalid";
  }
  const host = parsed.hostname.toLowerCase();
  if (!["facebook.com", "www.facebook.com", "m.facebook.com"].includes(host)) {
    return "invalid";
  }
  const match = parsed.pathname.match(/^\/groups\/(\d+)\/posts\/(\d+)/);
  if (!match) return "mismatch";
  if (match[1] !== policy.group.id) return "mismatch";
  return "group_post";
}

export interface Attestation {
  postedByHuman: boolean;
  textMatchesDraft: boolean;
  actor: string;
}

export function publicationVerdict(
  permalink: string,
  attestation: Attestation | null,
  policy: Policy,
): { status: "verified" | "unverified"; evidence: string } {
  const kind = classifyPermalink(permalink, policy);
  if (
    kind === "group_post" &&
    attestation?.postedByHuman === true &&
    attestation.textMatchesDraft === true
  ) {
    return {
      status: "verified",
      evidence:
        "Operator attested that a person posted this text and the permalink is a post in the configured group. The app did not call Facebook.",
    };
  }
  return {
    status: "unverified",
    evidence:
      kind === "group_post"
        ? "The link is in the group, but the human attestation is incomplete. Left unverified."
        : "The link is not a post permalink in the configured group. Left unverified. This is not a published status.",
  };
}

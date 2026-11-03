export interface HubDraft {
  id: string;
  title: string;
  body: string;
}

const sign = "— SMACKIN’ VIP Community";

export const HUB_DRAFTS: HubDraft[] = [
  {
    id: "hub-start-here",
    title: "Start here",
    body: `Welcome to SMACKIN’ VIP.

This group is for customers who want to be first to know what’s real, help shape what comes next, and find people who take their snacks as seriously as you do.

How to contribute
- Share a real taste, bag, or card story (photos welcome).
- Answer another member’s question if you know the answer.
- Give specific, respectful product feedback. Honesty helps us improve.
- Keep order numbers, addresses, and payment details out of public comments. Private order support: contact@smackinsnacks.com (also in the Help post).

What this group is not
- Not a place for harassment, spam, or personal attacks.
- Not where we invent exclusives, scarcity, or refunds in the comments. Confirmed updates only.

Introduce yourself. Drop a comment: What flavor brought you here, and where do you usually snack?

We’ll keep a short VIP This Week post current with any real benefits and dates. If something isn’t listed there, treat it as not confirmed yet.

${sign}`,
  },
  {
    id: "hub-vip-this-week",
    title: "VIP this week",
    body: `VIP This Week
Last updated: 2026-11-03 America/Chicago

Current verified benefits
- No timed VIP benefit confirmed for this week.

Coming up (provisional tease only)
- Advent calendar: something fun is in the works. Details (dates, how to get it, any VIP access) are not locked yet. We’ll update this post the moment they’re confirmed. No prices, windows, or guarantees until then.

How early access works (if applicable)
- Not applicable until a confirmed access window exists.

Expired offers are removed or clearly marked archived. If you see an old comment promising something not listed here, trust this post.

Questions about an order stay in the Help route, not this thread.

${sign}`,
  },
  {
    id: "hub-flavor-lab",
    title: "Flavor Lab",
    body: `Flavor Lab

This is where we ask questions the team is actually considering. Your answers get summarized and routed. We will not pretend a poll equals a product decision.

This week’s question: What makes you come back to a flavor: the first bite, the seasoning after a handful, or something else? Tell us which, and why.

Decision log (update only with confirmed status)
Theme | Status | Note
[CONFIRM theme] | heard / under review / decided | [CONFIRM why, or leave blank]

We will post what we heard and what changed when we have a real update. No fake “we’re shipping it” claims.

Drop your answer below. One concrete detail beats a long list.

${sign}`,
  },
  {
    id: "hub-collector",
    title: "Collector Corner",
    body: `Collector Corner

Bags, cards, first finds, and “what is this?” questions live here.

Ground rules
- Share photos and the story. Help each other identify cards and bags.
- No invented rarity rankings, guaranteed values, or food resale/trading in this group.
- Credit useful member explanations. If you reuse someone’s guide elsewhere, ask first.

Starter prompt: What’s the oldest SMACKIN’ bag or card you still have? Drop a photo and why you kept it. If you know what someone else found, help them identify it.

Ask the room: Stuck on a card or bag? Describe what you see (or post a clear photo) and what you’ve already tried. Collectors who’ve been through it: jump in with specifics.

We’ll feature especially clear member answers (with permission when needed) so new fans don’t have to dig.

${sign}`,
  },
  {
    id: "hub-help",
    title: "Help and honest feedback",
    body: `Help and honest feedback

Honest product feedback is welcome. Be specific and respectful. No harassment, spam, or personal attacks.

What belongs in public comments
- Taste, texture, seasoning, packaging experience
- Ideas that could help other members
- General questions about how VIP works (we’ll answer from confirmed facts)

What belongs in private support
- Order status, missing items, refunds/replacements, addresses, payment issues
Keep order numbers, addresses, and payment details out of comments.

Canonical support route
Email: contact@smackinsnacks.com
Approved 2026-11-03. Prefer this over older scattered contact references once this post is live.

How we handle public issues
We acknowledge when we can, and we share updates only when we have a confirmed answer. “Passed to the team” only happens after a real handoff. An acknowledgment is not a resolution.

If something went wrong with an order, use the support route above. If you’re sharing product feedback the whole room can learn from, post it here with enough detail to be useful.

${sign}`,
  },
];

import type { Voice } from "../gate";

export interface SampleSlot {
  id: string;
  scheduledOn: string;
  pillar: string;
  title: string;
  voice: Voice;
  body: string;
}

export const SAMPLE_CALENDAR: SampleSlot[] = [
  {
    id: "cal-2026-11-02-flavor",
    scheduledOn: "2026-11-02",
    pillar: "flavor_lab",
    voice: "assistant",
    title: "Flavor Lab — what brings you back",
    body: `Flavor Lab

This is a question the team can actually read. It is not a product decision.

What makes you come back to a flavor: the first bite, the seasoning after a handful, or something else? Tell us which, and why.

Answers get summarized and routed. The decision log stays empty until a confirmed status exists. Nothing in this post is a launch, a price, or an access window.

— SMACKIN’ community assistant`,
  },
  {
    id: "cal-2026-11-03-member",
    scheduledOn: "2026-11-03",
    pillar: "member_contribution",
    voice: "assistant",
    title: "Collector Corner — oldest bag or card",
    body: `Collector Corner

What’s the oldest SMACKIN’ bag or card you still have? Drop a photo and why you kept it. If you know what someone else found, help them identify it.

No rarity rankings, resale values, or food trading. Useful member answers can be featured later only with permission.

— SMACKIN’ community assistant`,
  },
  {
    id: "cal-2026-11-04-founder",
    scheduledOn: "2026-11-04",
    pillar: "founder",
    voice: "founder_draft",
    title: "Cole slot — replace before posting",
    body: `FOR COLE TO REPLACE BEFORE ANYONE POSTS THIS.

One real decision, tasting note, or behind-the-scenes detail from this week, plus the true tradeoff. If you do not have one, skip this slot.

The community assistant will not invent a personal experience or post this as Cole.

— Draft for Cole`,
  },
  {
    id: "cal-2026-11-06-vip",
    scheduledOn: "2026-11-06",
    pillar: "vip_event",
    voice: "assistant",
    title: "VIP this week — advent tease only",
    body: `VIP This Week
Last updated: 2026-11-03 America/Chicago

No timed VIP benefit is confirmed for this week.

Advent calendar: something fun is in the works. Details (dates, how to get it, any VIP access) are not locked yet. No prices, windows, or guarantees until they are confirmed and this post is updated.

Questions about an order go to contact@smackinsnacks.com, not this thread.

— SMACKIN’ community assistant`,
  },
  {
    id: "cal-2026-11-08-heard",
    scheduledOn: "2026-11-08",
    pillar: "what_we_heard",
    voice: "assistant",
    title: "What we heard — blocked until themes are real",
    body: `What we heard

Do not publish until three themes are copied from actual threads this week. No theme is confirmed in the fact library yet.

[CONFIRM theme 1]
[CONFIRM theme 2]
[CONFIRM theme 3]

No decision or fix is claimed here.

— SMACKIN’ community assistant`,
  },
  {
    id: "cal-2026-11-09-flavor",
    scheduledOn: "2026-11-09",
    pillar: "flavor_lab",
    voice: "assistant",
    title: "Flavor Lab — trying a new flavor",
    body: `Flavor Lab

If you could change one thing about how you try a new flavor, what would make it easier? Tell us what gets in the way today.

We will route useful answers. This post does not announce a new pack size, price, or single-bag offer.

— SMACKIN’ community assistant`,
  },
  {
    id: "cal-2026-11-10-member",
    scheduledOn: "2026-11-10",
    pillar: "member_contribution",
    voice: "assistant",
    title: "Member credit — blocked until a real contribution is chosen",
    body: `Member contribution

Credit one helpful member answer from this week only with permission. Do not invent rarity or resale values.

[CONFIRM which contribution to credit]

— SMACKIN’ community assistant`,
  },
  {
    id: "cal-2026-11-11-founder",
    scheduledOn: "2026-11-11",
    pillar: "founder",
    voice: "founder_draft",
    title: "Cole slot — week 2",
    body: `FOR COLE TO REPLACE BEFORE ANYONE POSTS THIS.

Bring one real note from the week. If there isn’t one, skip the slot. The assistant will not pretend this is Cole’s experience.

— Draft for Cole`,
  },
  {
    id: "cal-2026-11-13-vip",
    scheduledOn: "2026-11-13",
    pillar: "vip_event",
    voice: "assistant",
    title: "Friday — no verified benefit on the books",
    body: `VIP This Week

No verified VIP benefit is recorded for this Friday. Skip this slot unless a confirmed benefit or a confirmed tasting is added to the fact library first.

Do not repeat the advent calendar tease unless a verified fact extends it. There is no date, price, or access to add.

— SMACKIN’ community assistant`,
  },
  {
    id: "cal-2026-11-15-heard",
    scheduledOn: "2026-11-15",
    pillar: "what_we_heard",
    voice: "assistant",
    title: "What we heard — week 2 placeholder",
    body: `What we heard

[CONFIRM three themes from real threads]
[CONFIRM what changed, or say that nothing changed]
[CONFIRM what is still open]

Do not claim a decision that has not happened.

— SMACKIN’ community assistant`,
  },
];

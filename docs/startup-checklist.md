# Startup checklist

Do this before the first real week in the group. The app boots in **draft**. It does not post to Facebook.

## Already recorded on 2026-11-03

- Group: https://www.facebook.com/groups/604690051505802/
- Support email: contact@smackinsnacks.com
- This week’s only tease: an advent calendar, with no date, price, or access
- Buffer backup channel: `6aea4900e29c69a17150b894` (SMACKIN’ VIP, Facebook group, connected)
- Buffer organization: `6aea481c2f2977ad27bd75d1` (cole@smackinsnacks.com, America/Chicago)
- Drive folder “Facebook VIP”: `1oNe5i3nNx-jm9ckuurF44ogtVctqicJ3`
- Draft pack in that folder: “VIP Featured Drafts Review 2026-11-03”
- Staff excluded from contributor metrics: Cole Schaefer, Brian Waddick, Marc, Eli
- Facebook login email for Cole’s browser session: coleschefer55@yahoo.com
- The Facebook password stays in the password vault. It is not an environment variable.

## Cole still has to supply

1. `XAI_API_KEY` if Grok should draft. Without it, the policy composer and the review queue still run, and the app says Grok did not.
2. `BUFFER_API_KEY` from Buffer → Settings → API, only if the notification backup should be callable from this app. The channel is already connected. Fix the duplicated `https://` on the channel URL in Buffer before trusting reminders.
3. Buffer mobile app on Cole’s phone, with push notifications enabled for that channel. Buffer cannot post the group update by itself.
4. `OPS_ACCESS_TOKEN` before the app is reachable by anyone else.
5. A Postgres URL (`DATABASE_URL`) for any shared or production deploy.
6. A real founder note for Wednesday, or skip that slot. The assistant will not invent one.
7. Replacements for every `[CONFIRM]` before those drafts can be approved.
8. A decision to stay in draft, or to move to bounded live after a few approved human posts look right.
9. Confirmation that Marc and Eli’s display names still match the exclusion list when contributions are entered by hand.

## First session in the app

1. Copy `.env.example` to `.env.local` and fill only the values you have. Do not commit it.
2. `npm install`
3. `npm run setup`
4. `npm run dev`
5. Open Today, Knowledge, and the capability registry. Unsupported Facebook rows should stay unsupported.
6. Read the two-week calendar. Send a passing slot to review. Approve it. Queue it for a person. Do not mark it verified until the group permalink is pasted.
7. Run the demo path once on the verified branch and once on the unverified branch. Both are fixtures.
8. Pause publication and confirm the queue refuses. Unpause when a person is actually ready to post.

## Go-live post, by a person

1. Mode is draft or bounded live, and publication is not paused.
2. The draft passed the fact gate and a person approved it.
3. Founder drafts additionally need “Cole personalized this.”
4. Cole, logged into Facebook himself, posts the approved text in the group.
5. Paste `https://www.facebook.com/groups/604690051505802/posts/…` and check both attestation boxes.
6. Status becomes **verified** only then. Anything else stays **unverified** and the follow-up stays open.

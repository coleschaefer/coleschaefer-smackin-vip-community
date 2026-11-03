# Architecture

SMACKIN’ VIP ops is a Next.js console and a Postgres database. The web process serves the operator UI. A worker process claims durable jobs. Grok, when configured, calls tools that the app runs. Facebook writes stay with a person.

## Boundaries

- `policy/runtime-policy.yaml` is the operating contract: identity, modes, staff exclusion, support email, rhythm, reply caps, tease window, and the rule that unattended group write is false.
- `src/lib/gate.ts` refuses prices, offer dates, access windows, refunds, scarcity, placeholders, public order numbers, and “I passed this along” without a handoff.
- `src/lib/ops.ts` is the state machine for follow-ups, drafts, and publications.
- `src/lib/grok/tools.ts` exposes read and draft tools. It does not expose approve or publish.
- `src/lib/buffer.ts` can only build `schedulingType: notification`.
- `src/lib/capabilities.ts` is the registry seeded into the database. The probe job refreshes it. It does not create a Buffer post.

## Data

Migrations live in `db/migrations`. Local development without `DATABASE_URL` uses PGlite, which is Postgres in-process, so the same SQL runs. Production sets `DATABASE_URL` and `REQUIRE_POSTGRES=true`.

Official contribution metrics count `manual` and `import` rows only. `sample_not_live` and `demo_fixture` are reported separately. Staff and the assistant are excluded. Reactions are never unique contributors. Return rates are omitted until the 7-day or 28-day window has fully elapsed.

## Demo path

`src/lib/demo.ts` runs question → task → approved policy reply → pause check → human queue → verified or unverified link → closure only when verified → a contribution report. It does not call the network.

# Deploy and recovery

## Process

Run two processes against the same Postgres database:

- Web: `npm run build` then `npm run start`
- Worker: `npm run worker`

The worker claims jobs with `FOR UPDATE SKIP LOCKED`, retries with backoff, and requeues a job whose lock is older than 15 minutes. Job types are `probe_capabilities`, `scan_followups`, and `rollup_metrics`. None of them post to Facebook.

Set `REQUIRE_POSTGRES=true` in production so the app refuses to boot on the embedded database.

## Environment

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | Postgres connection string |
| `OPS_ACCESS_TOKEN` | Any shared host | Cookie gate for the console |
| `XAI_API_KEY` | When Grok should draft | xAI Responses API. Never logged. |
| `XAI_MODEL` | No | Defaults to `grok-4.7` |
| `BUFFER_API_KEY` | Only for the backup | GraphQL at `https://api.buffer.com`. Group calls are forced to `schedulingType=notification`. |
| `REQUIRE_POSTGRES` | Production | `true` |

There is no Facebook password setting. Do not add one.

Copy `.env.example`. Keep real values in the host secret store.

## First boot

```bash
npm ci
npm run setup
npm run build
npm run start
npm run worker
```

`npm run setup` applies `db/migrations` and seeds facts, the capability registry, the sample calendar, and hub drafts. It does not post.

Health check: `GET /api/health` returns mode, pause flag, and `database: postgres`. It does not return secrets. When `OPS_ACCESS_TOKEN` is set, the health route is behind the same cookie as the console.

## Recovery

1. Pause publication in Settings. That blocks new human-queue rows and Buffer notification calls. It does not delete history.
2. If the worker dies, start it again. A job left `running` for more than 15 minutes returns to the queue.
3. If a draft was approved by mistake, reject is only available before approval. After approval, do not paste a permalink. Leave the publication `awaiting_human` or mark the link unverified. Do not edit the database to say verified.
4. Restore Postgres from `pg_dump` if the database is lost. Publications, follow-ups, facts, and jobs are rows. There is no Facebook-side undo in this app because it never held a write token.
5. Grok and Buffer keys can be rotated without a migration. Restart both processes after changing them.
6. Embedded `.data/pglite` is for a single local process. It is not the recovery store. Do not run the worker against it.

## What a verified row means

`verified` means an operator checked two boxes and the URL path was `/groups/604690051505802/posts/{id}`. The app did not ask Facebook whether the post is still there. If that attestation was wrong, set the operational follow-up back by opening a new follow-up. Do not treat the row as proof of reach or of a sale.

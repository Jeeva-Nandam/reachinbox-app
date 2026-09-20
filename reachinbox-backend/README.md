# ReachInbox.ai — Email Scheduler Backend

Backend-only (Phase 1) implementation for the ReachInbox.ai Software Development
Intern assignment. No frontend, no Docker. Runs directly on your machine with
Node.js, PostgreSQL, Redis and (optionally) Elasticsearch installed locally.

---

## 1. Architecture

```
Frontend (future)
       ↓
Express API + Worker (npm run dev)
       ↓                                  ↓
PostgreSQL  ←───────── source of truth ───┤
       ↑                                  ↓
       └──────────────  BullMQ / Redis  ──┘
                              ↓
                      Rate Limiter (Redis Lua)
                              ↓
                         Ethereal SMTP
                              ↓
                        Elasticsearch (search index)
                              ↓
                            Slack (notifications)
```

**Why each piece exists:**

- **PostgreSQL** — the permanent source of truth for every email's state
  (`scheduled → processing → sent/failed/cancelled`). Redis/BullMQ can be flushed
  and rebuilt; Postgres cannot — it's what survives.
- **Redis + BullMQ** — holds delayed jobs and drives execution timing.  BullMQ
  persists job state (including `delay`) in Redis, so jobs survive an API/worker
  restart: nothing about a delayed job's due time depends on the Node process
  staying alive. We deliberately did **not** use cron/node-cron/agenda/setInterval,
  since those only fire while a specific process is alive and don't durably persist
  "fire at this exact timestamp" the way BullMQ delayed jobs backed by Redis do.
- **Worker (separate process)** — pulls jobs off the queue with configurable
  concurrency, and is where the actual send pipeline runs (rate-limit check → send
  → status update → search indexing).
- **Elasticsearch** — a read-optimized search index over email data. It is
  explicitly *not* on the critical path for sending: if it's down, emails still
  send and get marked `sent`; only the search API degrades.
- **Slack** — a notification side-channel. If not connected, or if it errors, email
  processing is completely unaffected.

### Concurrency & the "global delay" problem

Worker concurrency (`WORKER_CONCURRENCY`) controls how many BullMQ jobs a single
worker processes *in parallel*. That is orthogonal to the *per-recipient send
spacing* (`delayBetweenEmailsMs`) — concurrency does not automatically enforce
global ordering. So we don't rely on concurrency=1 to get spacing; instead **each
job carries its own absolute `scheduledAt` timestamp**, computed once at schedule
time as `startTime + index * delayBetweenEmailsMs`, and is enqueued as a BullMQ
*delayed* job with `delay = scheduledAt - now`. BullMQ itself won't move a job to
`active` before its delay elapses, regardless of how many workers are polling. This
means you can safely run several workers/concurrency > 1 for *throughput* (e.g. many
different senders' emails in flight at once) while still getting exact spacing for
any single sender's batch, because the spacing is baked into each job's due time
rather than into a runtime lock.

**Trade-off:** if a worker is busy (all `WORKER_CONCURRENCY` slots occupied) exactly
when a job's delay elapses, that job waits in the `delayed→waiting` transition until
a slot frees up — so under heavy load, actual send time can slip *later* than
`scheduledAt`, never earlier. We accept this (documented, not hidden) rather than
faking an artificial global mutex, which would become a throughput bottleneck across
different senders/tenants for no correctness benefit.

### Hourly rate limiting

`MAX_EMAILS_PER_HOUR_PER_SENDER` (or a per-request `hourlyLimit`) is enforced with a
Redis key `email-rate:{senderId}:{hourWindow}` (e.g. `email-rate:sender123:2026-09-20T10`)
via a single **Lua script** run inside the worker (`src/services/rate-limit.service.ts`)
that does `GET` + compare + `INCR` + `EXPIRE` as one atomic operation. This is the
part that matters: a naive `if (count < limit) count++` in application code is a
check-then-act race — two workers can both pass the check before either increments,
overshooting the limit. Lua scripts execute atomically in Redis (no other command
can interleave), so the check-and-reserve is safe under any number of concurrent
worker processes.

When a job is rejected by the limiter:

1. Its DB row goes back to `scheduled` with `lastError` noting the delay.
2. `schedulerService.rescheduleForRateLimit` removes the old BullMQ job and re-adds
   it (same deterministic job ID) with a new `delay` targeting the start of the next
   UTC hour.
3. A Slack notification is attempted at most once per `(sender, hourWindow)`, via an
   atomic Redis `SET NX` claim (`slack-rate-limit-notified:{senderId}:{hourWindow}`)
   — so if 50 jobs hit the limit in the same window simultaneously, only one Slack
   message goes out.

So for `hourlyLimit=100` and `500` emails, you get approximately `100/100/100/100/100`
across five consecutive hours, exactly as described in the spec — nothing is
permanently failed; it's rescheduled forward.

### Restart safety

BullMQ jobs (including their remaining delay) live in Redis, not in the Node
process's memory. If the API/worker process restarts, already-enqueued delayed jobs
are untouched — Redis still knows exactly when each is due. **We do not rebuild jobs
from the database on startup**, because that would risk creating duplicates for jobs
that already exist in Redis. The only startup responsibility is: don't create a
second job for an email that already has one. We guarantee that by using a
**deterministic BullMQ job ID** (`email:{emailId}`) everywhere a job is added —
BullMQ treats `queue.add()` with an existing job ID as effectively a no-op, so even
an accidental double-call can't create a duplicate job.

**If Redis itself is unavailable:** the API refuses to start (`server.ts` checks
connectivity at boot and exits with a clear error) rather than accepting schedule
requests it can't durably queue. If Redis goes down *while running*, in-flight API
requests to `/schedule` will fail loudly (500) rather than silently dropping jobs;
already-delayed jobs resume automatically once Redis is back, since nothing about
BullMQ's job state lived outside Redis.

### Idempotency — what is and isn't guaranteed

Two layers, by design:

1. **Batch-level**: a `batchKey` is derived either from a client-supplied
   `Idempotency-Key` header, or deterministically hashed from the semantically
   significant fields of the request (tenant, sender, subject, body, startTime,
   delay, hourlyLimit, sorted recipients). Resubmitting the exact same request
   produces the same `batchKey`.
2. **Row-level**: each recipient's `idempotencyKey = hash(tenantId, batchKey, recipient)`
   is protected by a Postgres `@@unique([tenantId, idempotencyKey])` constraint.
   Creation uses `createMany({ skipDuplicates: true })` (`ON CONFLICT DO NOTHING`),
   so a retried request creates **zero** new rows instead of erroring or duplicating.
3. **Queue-level**: the BullMQ job ID is derived from the email's DB id, so even if
   application code somehow tried to enqueue twice for the same row, only one job
   would exist.

**What this does *not* guarantee** — and no system built on SMTP can — is exactly-once
*delivery*. There is an unavoidable window between "SMTP accepted the message" and
"we recorded `status = sent` in Postgres": if the process crashes in that exact
window, the email may have actually been sent even though our database still shows
`processing`/`scheduled`, and a retry could send a second copy. We minimize this
window (the DB write happens immediately after the `sendMail` call returns) and
guard against *worker-level* duplicate re-processing (a job already marked `sent` in
the DB is skipped on re-delivery — see `email.worker.ts`), but we do not claim
exactly-once SMTP delivery, only idempotent *job processing*.

### Elasticsearch failure behavior

Indexing is fire-and-forget from the worker's perspective — the email's `sent`
status is committed to Postgres *before* we attempt to index it, and indexing
errors are caught and logged, never thrown back into the send pipeline. An
Elasticsearch outage degrades `/api/emails/search` (which reads only from
Elasticsearch, per spec §19) but never causes a duplicate send or a lost email
status update.

### 1000+ email scenario

For 1000 recipients with `concurrency=10`, `delay=2000ms`, `hourlyLimit=200`:

- All 1000 BullMQ jobs are created immediately (fast: it's just Postgres inserts +
  Redis `ZADD`-backed delayed job registration), each with its own future
  `scheduledAt`.
- Nothing attempts to open 1000 SMTP connections at once. Delayed jobs become
  `active` only as their individual timestamps arrive, throttled further by the
  10-way worker concurrency and the 200/hour Redis-enforced ceiling per sender.
- Recipients 201–1000 (beyond the first hour's 200-email allowance) get
  rate-limited and rescheduled into hour 2, 3, etc., exactly as described above.

---

## 2. Email status state machine

```
scheduled → processing → sent
                 ↘
                  failed              (after RETRY_MAX_ATTEMPTS exhausted)
scheduled → processing → scheduled    (rate-limited or a retryable SMTP failure — looped back)
scheduled → cancelled                 (DELETE /api/emails/:id, only while still "scheduled")
```

All transitions happen inside `email.worker.ts` / `scheduler.service.ts` using
targeted `prisma.email.update` calls keyed by id; there is no code path that writes
a terminal state (`sent`/`failed`/`cancelled`) except the one owning that
transition, and the worker checks current status defensively before acting
(skipping already-`sent` or `cancelled` rows) to prevent invalid transitions from
racing jobs.

## 3. Retry policy

Configured via `RETRY_BACKOFF_DELAYS_MS` (default `0,5000,30000,120000`):
attempt 1 fires immediately, then retries after 5s, 30s, and 2 minutes on transient
SMTP failures, implemented as a BullMQ **custom backoff strategy**
(`src/queues/email.worker.ts`) rather than BullMQ's default exponential backoff, to
match the spec exactly. After the final configured attempt fails, the email is
marked `failed` permanently — it is not retried indefinitely.

---

## 4. Local installation (no Docker)

### Node.js

Install Node.js **18.18+** (LTS 20.x recommended). Verify:

```bash
node -v
```

### PostgreSQL

- **macOS**: `brew install postgresql@16 && brew services start postgresql@16`
- **Ubuntu/Debian**: `sudo apt install postgresql postgresql-contrib && sudo systemctl start postgresql`
- **Windows**: install via the official installer at https://www.postgresql.org/download/windows/ (includes a service that starts automatically).

Then create the database:

```bash
createdb reachinbox
# or, from psql:
# CREATE DATABASE reachinbox;
```

### Redis

- **macOS**: `brew install redis && brew services start redis`
- **Ubuntu/Debian**: `sudo apt install redis-server && sudo systemctl start redis-server`
- **Windows**: native Redis isn't officially supported. Do **not** use Docker per
  the project rules — instead use one of these non-Docker options:
  - **WSL2** (Windows Subsystem for Linux, not a container): install Ubuntu via
    `wsl --install`, then follow the Ubuntu instructions above inside WSL2. This is
    a real Linux environment, not a container, so it satisfies "no Docker."
  - **Memurai** (https://www.memurai.com/) — a native Windows-built Redis-compatible
    server, no WSL or containers required. The free "Developer" edition is
    sufficient for local development.

### Elasticsearch

Elasticsearch is the most involved local dependency. Simplest supported method:

1. Download the ZIP/TAR distribution (not Docker) from
   https://www.elastic.co/downloads/elasticsearch for your OS.
2. Extract it, then run:
   - macOS/Linux: `./bin/elasticsearch`
   - Windows: `bin\elasticsearch.bat`
3. On first run, disable security for local dev simplicity (single-node, no auth)
   by adding to `config/elasticsearch.yml`:
   ```yaml
   xpack.security.enabled: false
   discovery.type: single-node
   ```
4. Confirm it's up: `curl http://localhost:9200` should return a JSON cluster info
   response.

If you'd rather not install Elasticsearch right now, set `ELASTICSEARCH_DISABLED=true`
in `.env`. The core scheduling/sending pipeline works fully without it; only
`/api/emails/search` will return empty results until you enable it. **We do not
silently swap in an in-memory mock** — search simply reports unavailable/empty.

---

## 5. Required commands

```bash
npm install
```

```bash
cp .env.example .env
# edit .env: set DATABASE_URL, SESSION_SECRET, JWT_SECRET at minimum
```

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Start the API and email worker:

```bash
npm run dev
```

The API process starts the BullMQ worker automatically, so scheduled emails are
executed without a second terminal. `npm run worker` remains available when the
worker needs to run as a separate process.

Production build:

```bash
npm run build
npm start            # runs the API and worker from dist/
# Optional: run only the worker in a separate process
npm run start:worker
```

Tests:

```bash
npm test
```

---

## 6. Demo sequence

1. Start PostgreSQL, Redis, (optionally) Elasticsearch.
2. `cp .env.example .env` and fill in `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`.
   Leave `DEV_AUTH_BYPASS=true` for now so you can test without Google OAuth.
3. `npx prisma migrate dev`
4. `npm run dev` (starts the API and worker)
6. Open Swagger UI: http://localhost:4000/api-docs
7. Get a dev token:
   ```bash
   curl -X POST http://localhost:4000/api/auth/dev-login
   ```
   Copy the `token` from the response; use it as `Authorization: Bearer <token>`
   for everything below.
8. Create a sender (get Ethereal credentials first — see §7 below):
   ```bash
   curl -X POST http://localhost:4000/api/emails/senders \
     -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
     -d '{"email":"YOUR_ETHEREAL_USER","displayName":"Demo Sender","smtpUser":"YOUR_ETHEREAL_USER","smtpPassword":"YOUR_ETHEREAL_PASSWORD"}'
   ```
9. Schedule 5 emails, ~2s apart, starting a few seconds from now:
   ```bash
   curl -X POST http://localhost:4000/api/emails/schedule \
     -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
     -d '{
       "subject": "Test Email",
       "body": "Hello from ReachInbox",
       "startTime": "2026-09-20T10:00:00.000Z",
       "delayBetweenEmailsMs": 2000,
       "hourlyLimit": 100,
       "senderId": "SENDER_ID_FROM_STEP_8",
       "recipients": ["a@example.com","b@example.com","c@example.com","d@example.com","e@example.com"]
     }'
   ```
10. Open Bull Board: http://localhost:4000/admin/queues — watch jobs move from
    `delayed` → `active` → `completed`.
11. Check Ethereal (https://ethereal.email/messages, log in with the sender's
    Ethereal credentials) — or grab `previewUrl` from `GET /api/emails/sent`.
12. `GET /api/emails/scheduled` / `GET /api/emails/sent` in Swagger or curl.
13. `GET /api/emails/search?q=example` to confirm Elasticsearch indexing.
14. Schedule a batch with `hourlyLimit: 2` and 5 recipients to see rate limiting
    kick in — watch 2 send immediately and the rest reschedule into the next hour
    (`GET /api/emails/scheduled` will show their `scheduledAt` pushed forward).
15. Connect Slack (`GET /api/slack/connect` → open the returned `authorizeUrl` in a
    browser → approve) and re-run step 14 to see the rate-limit notification land
    in Slack.
16. Stop the process, wait, then restart `npm run dev`. Schedule another future
   batch, stop the process mid-way through its delay, restart it, and confirm
   the remaining jobs still fire at the correct time — nothing was lost or
   duplicated.

---

## 7. Accounts / External Setup Required

### PostgreSQL — no external account required (local install only)

### Redis — no external account required (local install only)

### Elasticsearch — no external account required if running locally

### Ethereal

Ethereal credentials are created via **the Ethereal website**, not generated
programmatically by this backend (Nodemailer *can* auto-generate a throwaway
account via `nodemailer.createTestAccount()`, but we intentionally don't call that
at runtime, since credentials need to persist across restarts and per-sender — see
`Sender` model). Steps:

1. Go to https://ethereal.email/create and click "Create Ethereal Account."
2. Copy the generated **username** (an email address) and **password**.
3. Use them when creating a Sender via `POST /api/emails/senders`
   (`smtpUser`, `smtpPassword`, and `email` = the same generated address).

### Google OAuth

Not required to test the backend (`DEV_AUTH_BYPASS=true` covers that), but needed
for the real login flow:

1. Create a project at https://console.cloud.google.com/.
2. Configure the OAuth consent screen (External, add your own email as a test user).
3. Create OAuth client credentials: **APIs & Services → Credentials → Create
   Credentials → OAuth client ID → Web application**.
4. Add authorized redirect URI: `http://localhost:4000/api/auth/google/callback`.
5. Copy the **Client ID**.
6. Copy the **Client Secret**.
7. Put both into `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### Slack OAuth

1. Create an app at https://api.slack.com/apps → "Create New App" → "From scratch."
2. Under **OAuth & Permissions**, add redirect URL:
   `http://localhost:4000/api/slack/callback`.
3. Under **Scopes → Bot Token Scopes**, add `chat:write` (and `chat:write.public`
   if you want to post to channels the bot hasn't been invited to).
4. Install the app to your workspace.
5. Copy the **Client ID** and **Client Secret** from **Basic Information**.
6. Put them into `.env` as `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.

---

## 8. Testing

```bash
npm test
```

- `tests/time.test.ts`, `tests/hashing.test.ts`, `tests/csv-parsing.test.ts` are
  pure unit tests — no external services required.
- `tests/rate-limit.test.ts`, `tests/scheduling.integration.test.ts` require a
  running local Postgres (migrated) and Redis — they exercise the real Lua script
  and real Prisma/BullMQ calls rather than mocks, since the whole point of those
  components is their behavior under real concurrency.
- `tests/auth.test.ts`'s authentication-rejection cases auto-skip when
  `DEV_AUTH_BYPASS=true` (the default local `.env`), since the bypass makes those
  assertions inapplicable by design. Set `DEV_AUTH_BYPASS=false` before running
  `npm test` if you want to exercise them.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| API exits immediately with "PostgreSQL is unreachable" | Postgres isn't running, or `DATABASE_URL` is wrong. Verify with `psql $DATABASE_URL -c 'select 1'`. |
| API exits immediately with "Redis is unreachable" | Redis isn't running, or `REDIS_HOST`/`REDIS_PORT` are wrong. Verify with `redis-cli ping`. |
| Jobs never leave "delayed" | The email worker failed to start or Redis is unavailable. Check the API logs for worker startup or Redis errors. |
| `/api/emails/search` always returns empty | Elasticsearch isn't running/reachable, or `ELASTICSEARCH_DISABLED=true`. Check `GET /health/ready`. |
| Emails stuck in `processing` after a crash | The worker died mid-send. On restart, BullMQ will retry the job per the configured attempts (it was never marked `completed`), and the worker's own idempotency check prevents a genuinely already-sent email from being re-sent twice — see "Idempotency" above for the narrow SMTP-ack window this can't fully close. |
| `401 UNAUTHENTICATED` on every request | No `Authorization: Bearer <token>` header, and either `NODE_ENV != development` or `DEV_AUTH_BYPASS != true`. Use `POST /api/auth/dev-login` to get a token, or complete Google OAuth. |
| Slack notifications never arrive | Confirm `GET /api/slack/status` shows `connected: true`; check the worker logs for `"Slack notification failed"` (non-fatal, but logged) — usually a scope issue (`chat:write`) or the bot not being in the target channel. |
| `403 Forbidden` from npm registry / install hangs | Your network blocks the npm registry — check with your network administrator or a proxy config; this is unrelated to the app itself. |
| Bull Board shows nothing | Confirm you're hitting `/admin/queues` with a valid token (or `DEV_AUTH_BYPASS=true`), and that at least one schedule request has been made. |

---

## 10. Project structure

```
reachinbox-backend/
├── src/
│   ├── config/        env, database, redis, elasticsearch, oauth, bull-board
│   ├── controllers/    auth, email, sender, search, slack
│   ├── routes/          auth, email, search, slack, health
│   ├── services/        email, scheduler, email-sender, rate-limit, idempotency,
│   │                     search, slack, auth
│   ├── queues/           email.queue, email.worker, queue.events
│   ├── middleware/       auth, error, validation
│   ├── utils/            logger, errors, hashing, time
│   ├── types/            email, auth, slack
│   ├── app.ts
│   └── server.ts
├── prisma/schema.prisma
├── tests/
├── swagger.yaml
├── .env.example
└── README.md
```

## 11. What's implemented

Scheduling API · CSV upload scheduling · BullMQ delayed jobs with restart-safe,
deterministic job IDs · configurable worker concurrency · per-recipient delay
spacing via absolute timestamps · Redis Lua atomic hourly rate limiting with
automatic reschedule-forward (never permanent failure) · Ethereal SMTP sending via
per-tenant Sender identities · Elasticsearch indexing + search, fully non-blocking
for the send path · Slack OAuth + de-duplicated rate-limit notifications · Google
OAuth (+ guarded dev-only bypass) · JWT auth with tenant isolation · fixed-schedule
retry/backoff · email cancellation · Bull Board dashboard · Swagger docs · liveness
+ readiness health checks · structured Pino logging with secret redaction ·
centralized error handling with consistent JSON error shapes · unit + integration
tests.

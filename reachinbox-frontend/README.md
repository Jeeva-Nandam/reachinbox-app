# ReachInbox — Frontend (Phase 2)

React + TypeScript + Vite + Tailwind frontend for the ReachInbox email scheduler,
built against the Phase 1 backend. No Docker, no mock data — every screen reads
and writes through the real backend REST API.

---

## 1. Overview

Login (real Google OAuth) → Dashboard → Scheduled / Sent / Search / Slack →
Compose New Email (subject, body, CSV or manual recipients, sender, start
time/delay/hourly limit) → `POST /api/emails/schedule` → the backend's BullMQ
pipeline takes it from there.

## 2. Architecture

```
React (Vite)
   ↓ fetch, via src/api/client.ts
Express API  (VITE_API_URL)
   ↓
PostgreSQL / BullMQ / Redis / Worker / Ethereal / Elasticsearch / Slack
   (all Phase 1 — unchanged by this frontend)
```

- **`src/api/`** — the only place `fetch` is called. Every endpoint the backend
  exposes gets one typed function (`getScheduledEmails()`, `scheduleEmails()`,
  etc.). Components never call `fetch`/`axios` directly.
- **`src/context/AuthContext.tsx`** — centralized auth state. Holds the current
  `User`, exposes `loginWithGoogle`/`loginAsDev`/`logout`, and re-derives
  authentication from a stored JWT on every page load via `GET /api/auth/me`.
- **`src/context/ToastContext.tsx`** — a minimal, dependency-free toast system
  (per the "don't add unnecessary libraries" rule) used for schedule
  success/failure, Slack connect/disconnect, and cancellation feedback.
- **TanStack Query** (`src/hooks/`) — all server state (scheduled emails, sent
  emails, search results, Slack status, senders) goes through `useQuery` /
  `useMutation` consistently, giving you caching, background refetch, and
  invalidation-on-mutation for free, without hand-rolled loading/error state in
  every component.
- **`src/router/ProtectedRoute.tsx`** — redirects `/dashboard/*` to `/login` when
  unauthenticated; `AuthCallbackPage` is where the backend's OAuth redirect lands.

## 3. Folder structure

```
src/
├── api/            client.ts (fetch wrapper), auth/emails/senders/slack .api.ts
├── components/
│   ├── layout/       Header, Sidebar, DashboardLayout
│   ├── auth/          GoogleLoginButton
│   ├── emails/         EmailTable, EmailStatusBadge, EmailSearch, ComposeEmail,
│   │                    CsvUploader, ScheduleForm, EmailEmptyState
│   ├── slack/           SlackConnection
│   └── ui/                Button, Input, Modal, Spinner, Skeleton, Pagination
├── context/          AuthContext, ToastContext
├── hooks/             useEmails, useSearchEmails, useSlack, useSenders
├── pages/              LoginPage, AuthCallbackPage, Scheduled/Sent/Search/SlackPage
├── router/            ProtectedRoute
├── types/              auth, email, slack
├── utils/               csv.ts, format.ts
├── App.tsx, main.tsx
```

## 4. Environment variables

```bash
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:4000
```

This is the **only** place the backend URL is configured — no hardcoded
`http://localhost:4000` anywhere else in the app (see `src/api/client.ts` and
`src/api/auth.api.ts`, both read `import.meta.env.VITE_API_URL`).

## 5. Installation & running locally

Requires the **Phase 1 backend already running** (API on `npm run dev`, worker on
`npm run worker`) — see the backend's own README.

```bash
npm install
cp .env.example .env   # adjust VITE_API_URL if your backend isn't on :4000
npm run dev
```

Open http://localhost:5173.

Also make sure the backend's `.env` has:

```env
FRONTEND_URL=http://localhost:5173
```

so its CORS config and OAuth redirects point back here correctly.

Build / preview:

```bash
npm run build
npm run preview
```

Tests:

```bash
npm test
```

Type-check:

```bash
npm run lint
```

## 6. Backend dependency — endpoints this frontend calls

All confirmed against the actual Phase 1 backend (not assumed):

| Function | Endpoint |
|---|---|
| `googleLoginUrl()` | `GET /api/auth/google` (browser redirect, not fetched) |
| `getCurrentUser()` | `GET /api/auth/me` |
| `devLogin()` | `POST /api/auth/dev-login` |
| `scheduleEmails()` | `POST /api/emails/schedule` |
| `scheduleEmailsFromCsv()` | `POST /api/emails/schedule/csv` (available, see §9) |
| `getScheduledEmails()` | `GET /api/emails/scheduled?page&limit` |
| `getSentEmails()` | `GET /api/emails/sent?page&limit` |
| `cancelEmail()` | `DELETE /api/emails/:id` |
| `searchEmails()` | `GET /api/emails/search?q&status&page&limit` |
| `getSenders()` / `createSender()` | `GET` / `POST /api/emails/senders` |
| `getSlackStatus()` | `GET /api/slack/status` |
| `connectSlack()` | `GET /api/slack/connect` → redirect to `authorizeUrl` |
| `disconnectSlack()` | `POST /api/slack/disconnect` |

**One endpoint the assignment mentions that the backend does not have:** a
`POST /api/auth/logout`. The backend is stateless JWT auth, so there is no
server-side session to invalidate — `logout()` in `AuthContext` simply discards
the locally stored token. If you'd rather have a real logout endpoint (e.g. for a
token-blocklist later), that's a backend change I did not make unilaterally —
flagging it here per the "don't invent APIs" instruction rather than guessing.

## 7. Google OAuth flow

```
"Continue with Google" button
        ↓  window.location.href = `${VITE_API_URL}/api/auth/google`
Backend redirects to Google
        ↓
Google redirects to backend's /api/auth/google/callback
        ↓
Backend issues a JWT, redirects to
   `${FRONTEND_URL}/auth/callback?token=<jwt>`
        ↓
AuthCallbackPage reads ?token=, stores it (localStorage), calls GET /api/auth/me
        ↓
Redirect to /dashboard
```

No mocked login: the button navigates the full browser to the real backend
endpoint; nothing about the token is fabricated client-side.

**Local dev login (`loginAsDev`)** on the Login page calls the backend's own
`POST /api/auth/dev-login`, which only succeeds when the backend has
`NODE_ENV=development` and `DEV_AUTH_BYPASS=true` — it's for exercising the
frontend before you've configured a Google Cloud OAuth client, not a frontend
mock (a misconfigured backend simply returns a real 403, shown as a toast).

## 8. Slack OAuth flow

```
"Connect Slack" button
        ↓ GET /api/slack/connect (authenticated) → { authorizeUrl }
window.location.href = authorizeUrl
        ↓
Slack's consent screen → backend's /api/slack/callback
        ↓
Backend redirects to `${FRONTEND_URL}/settings/slack?connected=true`
```

Note: the backend currently redirects to `/settings/slack`, while this frontend's
Slack page lives at `/dashboard/slack`. That query-string redirect isn't
consumed by any route in this app (no functional impact — `GET /api/slack/status`
on the Slack page reflects the true connection state regardless of where the
redirect lands), but if you want the post-connect redirect to land exactly on
`/dashboard/slack`, that's a one-line change in the backend's
`slack.controller.ts` I did not make without flagging it, per the same
don't-silently-change-the-backend rule.

## 9. CSV upload behavior

The composer accepts recipients two ways, combined into one deduplicated list:

1. **Manual entry** — type an address, press Enter, it becomes a chip.
2. **CSV upload** — drag & drop or browse. `src/utils/csv.ts` mirrors the
   backend's own column-detection logic (auto-detects a header literally/loosely
   named "email"; falls back to scanning every cell) purely to give instant
   feedback: "✓ 250 email addresses detected", plus valid/invalid/duplicate
   counts.

**This client-side parse is a preview only.** On submit, the frontend sends the
combined, deduplicated recipient list as a JSON array via
`POST /api/emails/schedule` — not the raw file via the multipart
`/schedule/csv` endpoint. Both backend endpoints exist and both work; JSON was
chosen so manually-typed and CSV-sourced recipients merge into a single request
with one validation pass, rather than needing two separate submissions. The
backend independently re-validates every recipient regardless of which endpoint
is used, so nothing is "uploaded blindly." (`scheduleEmailsFromCsv()` in
`src/api/emails.api.ts` is still implemented and available if you'd prefer to
wire the raw-file path instead.)

## 10. Scheduling flow

```
Compose → validate (subject, body, sender, ≥1 recipient, valid future start
          time, delay ≥ 0, hourlyLimit > 0)
       → POST /api/emails/schedule
       → success: toast "✓ N emails scheduled successfully.", close modal,
                  invalidate the Scheduled Emails query (auto-refetches)
       → error: toast with the backend's error message
```

## 11. Search flow

`EmailSearch` debounces input (350ms) and calls `GET /api/emails/search?q=...`
directly — there is no client-side filtering of already-fetched data standing in
for search; every keystroke (once settled) hits the real Elasticsearch-backed
endpoint.

## 12. Testing

```bash
npm test
```

`tests/csv.test.ts` covers the CSV preview parser (header detection, duplicate
removal, invalid-row reporting) as a pure unit test. Given the scope of Phase 2,
component/interaction tests (auth gating, empty/loading/error states, Slack
connect/disconnect) are documented as the testing plan in the assignment (§34)
but are not all included as automated specs here — see that section for what to
click through manually against a running backend: unauthenticated dashboard
access, empty/loading/error states on both email lists, CSV validation, and the
Slack connected/disconnected UI.

## 13. Design notes on the Figma reference

The provided screenshot was a low-resolution mobile capture of the Figma file's
thumbnail grid, not a full-resolution frame — exact pixel values (precise hex
colors, exact spacing/radii, font family) weren't legible. What *was* clear and
was followed: a light theme with a green primary accent, a left-side
Compose/Scheduled/Sent navigation, a clean white table-based email list, and a
full-screen composer with To/Subject/Body + CSV/attachment affordances. Those
structural choices are implemented; exact visual values (colors, spacing) are a
reasonable clean-dashboard interpretation rather than a pixel-perfect trace, and
are easy to adjust (`tailwind.config.js` `brand` palette) once you can view the
Figma file directly.

## 14. Troubleshooting

| Symptom | Fix |
|---|---|
| Login button does nothing / CORS error | Backend `FRONTEND_URL` doesn't match where this app is running, or backend isn't running. Check backend `.env`. |
| Stuck on "Signing you in…" | Backend OAuth callback didn't include `?token=`. Check backend logs / that `GOOGLE_CLIENT_ID`/`SECRET` are configured, or use "Use local dev login" instead. |
| Dashboard redirects straight back to `/login` | Token expired/invalid, or `GET /api/auth/me` failed — check the Network tab for a 401. |
| Scheduled emails never leave "Scheduled" | That's a backend/worker issue, not this frontend — confirm `npm run worker` is running on the backend. |
| Compose says "No senders yet" | Use the inline "Add one" form (needs Ethereal credentials — https://ethereal.email/create), or `POST /api/emails/senders` directly. |
| Search always empty | Backend Elasticsearch may be down or `ELASTICSEARCH_DISABLED=true` — check backend `/health/ready`. |
| Slack "Connect" redirects to an error | Backend `SLACK_CLIENT_ID`/`SECRET`/`SLACK_REDIRECT_URI` not configured — see backend README §7. |

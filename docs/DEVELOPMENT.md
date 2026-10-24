# Development

Setup is in the [README](../README.md); configuration names are in [`.env.example`](../.env.example).

## Configuration and database

- `.env.local`: Turso `DATABASE_URL`/`DATABASE_AUTH_TOKEN`, random `BETTER_AUTH_SECRET` (at least 32 characters), exact `BETTER_AUTH_URL`, and `ALLOW_SIGN_UP`.
- Setup never overwrites an existing file. Restart after environment changes; preserve the auth secret securely. Production requires HTTPS. Close registration after creating intended accounts.
- Review generated SQL/snapshots from `bun run db:generate`; retain them with schema changes. `bun run db:migrate` applies migrations, not schema push/reset. Remote runs require approval and `CONFIRM_REMOTE_MIGRATION=true`.
- Migrations `0000`–`0002` create auth/items and add reminder/deletion dates; applied to the configured Turso database.
- Export regularly. JSON exports cover items (including Deleted), not users/passwords/sessions; verify a separate database backup/restore strategy before relying on it. Never commit env files, databases or test artifacts.

## Checks

```sh
bun run lint
bun run typecheck
bun run test              # Vitest, not bun test
bun run build
bun run format:check
bunx playwright install chromium
bun run test:e2e
```

Stop `bun dev` before E2E: Next shares its development lock. E2E uses port 3100, fresh secrets and an isolated SQLite database, never personal Turso data. Fixtures create independent accounts/client rate-limit buckets without disabling production limits. Use visible/scoped locators because Next can retain hidden routes.

`bun run format` formats sources/docs. `bun run start` serves a production build. `bun run icons:generate` rebuilds the ICO fallback from `app/icon.svg`; keep its Lucide license notice. PWA/home-screen assets are separate.

## Code map

| Location                         | Responsibility                                                      |
| -------------------------------- | ------------------------------------------------------------------- |
| `app/`, `components/`            | Routes, forms, session/provider and interactive UI                  |
| `lib/items/model.ts`             | Zod Item schema, independent type/intent/status, selectors          |
| `lib/items/remote-repository.ts` | Authenticated requests, validated state, no offline writes          |
| `lib/items/repository.ts`        | Portable formats/merge; legacy storage code used only in tests      |
| `lib/db/`, `drizzle/`            | Relational schema, connection, generated migrations                 |
| `lib/server/`                    | Better Auth, owner-scoped API, transactions, safe metadata fetching |
| `tests/e2e/`                     | Desktop/mobile journeys and scoped axe accessibility checks         |

## Behavior and safety

- Account-only: never read/upload/delete legacy browser saves or fall back to local saving on auth/network failure. Theme preferences alone use a non-sensitive cookie.
- Every server operation validates a Better Auth session and derives ownership from it. Workspace headers only detect account mismatch, never authorize ownership. Keep Origin checks, database auth rate limits and private/no-store responses.
- Updates/delete/restore/purge require `expectedUpdatedAt`; compare-and-swap rejects stale changes with 409. Imports/bulk actions are transactional. Login/logout reload the document to discard private route state; refresh is on focus/every 30 visible seconds, not real-time sync.
- Keep account gates inside page content, not around root layout children, so route segments remain rendered for Next navigation validation.
- `deletedAt` is independent of status: Deleted preserves prior content/status/dates. Restore clears it; only separately confirmed permanent deletion erases it. No auto-empty. Exclude Deleted from ordinary views/counts/reminders and reject edits/bulk triage until restored.
- Portable/API envelopes are v3; v1/v2 remain importable. Exports include trash but exclude ownership/secrets. Imports preview, never overwrite; identical ID/content skips, conflicting IDs get new UUIDs. Limits: 10 MiB/5,000 items; bulk triage up to 200.
- Pending means non-deleted inbox/later. Done remains searchable; Archived is hidden from ordinary lists by default. Revisit dates are UTC with local-time editing, not delivered notifications; preserve tested DST behavior.
- Metadata is opt-in and applies suggestions to drafts only. Retain public-address DNS checks, IP-pinned transport/TLS identity, redirect revalidation, HTML/type/byte/time limits (512 KiB, 8 seconds, 3 redirects) and 10 requests/user/minute. No raw saved HTML, unsafe URL schemes, remote JS or automatic overwrite.
- Shared/bookmarklet capture uses a URL fragment and explicit review/save, including after sign-in. No service worker/private-response cache; installed-device sharing is not yet verified.
- Keep a compact personal utility: plain labels, visible search, collapsed filters, no marketing/hero/footer copy or fake data. Icon actions need hover/focus help, visible touch labels and 44px targets. Theme supports Automatic/Light/Dark via modern `light-dark()` CSS; overrides restore after hydration.
- Clipsy stays separate: no shared DB/session secrets or copied cookies/passwords. Integration needs a newly verified API and scoped read-only credential; permission is required before modifying Clipsy.

Automated browser/axe tests are not full accessibility or production certification. See the README for remaining work; update existing notes rather than adding milestone/session documents.

# Development

Setup is in the [README](../README.md); configuration names are in [`.env.example`](../.env.example).

## Configuration and database

- `.env.local`: Turso `DATABASE_URL`/`DATABASE_AUTH_TOKEN`, random `BETTER_AUTH_SECRET` (at least 32 characters), exact `BETTER_AUTH_URL`, and `ALLOW_SIGN_UP`.
- Setup never overwrites an existing file. Restart after environment changes; preserve the auth secret securely. Production requires HTTPS. Close registration after creating intended accounts.
- Review generated SQL/snapshots from `bun run db:generate`; retain them with schema changes. `bun run db:migrate` applies migrations, not schema push/reset. Remote runs require approval and `CONFIRM_REMOTE_MIGRATION=true`.
- Migrations `0000`–`0002` create auth/items and add reminder/deletion dates. `0003`–`0004` add per-user Clipsy connections and short-lived authorization state; these new migrations require intentional application before using the connection flow.
- Export regularly. JSON exports cover items (including Deleted), not users/passwords/sessions; verify a separate database backup/restore strategy before relying on it. Never commit env files, databases or test artifacts.

## Clipsy summary

Each user opens **Account → Connect Clipsy**, signs in to Clipsy if needed, approves read-only counts access, and returns to Shelfy. Accounts stay separate; matching emails never link them. Overview shows that user's video, to-watch/watching, collection and subscription counts. Disconnect is available in Shelfy's Account screen and Clipsy's Settings. No video import/editing, copied cookies or shared databases/auth secrets. Deleted records are excluded. Overview reuses successful summary counts in account-scoped browser memory for six hours, showing elapsed minutes since fetching (updated each minute/on focus without a request; exact timestamp on hover). Revisiting within that window avoids API requests; Refresh/Retry always fetches afresh. Expiry is checked on loading Overview, not by background polling. Failed refreshes discard old counts, never show fake zeros or alter library items.

The summary cache belongs to the current document's library provider, not module-global state, local/session storage, a service worker or the server. Page reload/new tab/device fetches separately. Logout, connection changes, and discovering a disconnected/expired connection clear it; old in-flight requests cannot repopulate an invalidated cache. Another account cannot read its entries. Counts may remain visible after remote changes/revocation until refresh or the next expired-cache load; every actual server request still validates authorization. Library refresh uses a separate policy described below.

Users do not copy tokens, account IDs or edit environment variables. The operator configures only public deployment origins: optional `CLIPSY_URL` in Shelfy (defaults to the hosted Clipsy app), and `SHELFY_URL` in Clipsy, matching Shelfy's `BETTER_AUTH_URL` origin. Clipsy permits only the exact `/api/clipsy/callback` at that registered origin. Both apps require HTTPS in production; HTTP localhost/127.0.0.1 is allowed only outside production. Other users on the same deployments can connect independently.

Before deploying, review/apply Shelfy's generated `0003`–`0004` migrations intentionally. Clipsy has separate, tracked additive migrations in `packages/db/drizzle-integrations/` because its existing core migration directory is local/ignored: after reviewing them, the operator can run `bun run --cwd packages/db db:migrate:integrations` in Clipsy against its already-initialized database. Neither deployment nor remote migration is automatic or authorized by a code change. The old per-account environment settings (`CLIPSY_SUMMARY_TOKEN`, `CLIPSY_SHELFY_USER_ID`, `SHELFY_SUMMARY_USER_ID`, `SHELFY_SUMMARY_TOKEN_SHA256`) are no longer used; remove them and connect through Account.

Authorization uses 256-bit random state bound to the initiating Shelfy session (10 minutes), PKCE S256 and a hashed, single-use authorization code (5 minutes), exchanged server-to-server. Shelfy stores access tokens/verifiers encrypted with AES-256-GCM using a purpose-separated HKDF key derived from its existing auth secret, with account/purpose/provider authentication. Keep the auth secret stable and protected; changing it requires reconnecting. Saved credentials stay bound to their original Clipsy origin, even if the configured default changes. Clipsy stores only token hashes and scopes each grant to the consenting active account's counts. Grants expire after 90 days; disconnect and connect again to renew. Neither the token nor verifier is exposed to browser JavaScript; only short-lived code/state travel in the redirect. Callback state is single-use, denies changed sessions, and cannot save a grant after pending authorization is cancelled.

Responses are private/no-store, code redirects use no-referrer, and POST account changes check Origin/session/workspace as appropriate. Server-to-server token/summary/revoke requests disallow redirects, have a five-second timeout and a 4 KiB JSON response limit. Clipsy bounds token/consent request bodies to 8 KiB. Shelfy revokes remotely before removing saved credentials; on revocation failure it retains them for retry. Revocation is idempotent, including already-revoked grants. If callback saving fails, Shelfy attempts to revoke the unused grant; any stranded grant can also be revoked in Clipsy Settings and expires automatically. Libraries are never modified by connection/revocation.

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

E2E runs every test on desktop and only tests tagged `@mobile` on mobile: responsive layout, touch/focus, accessibility, themes, shared capture, imports and the core library journey. Tag new tests when mobile-specific coverage is needed; shared account/data logic runs on desktop. For focused feedback use `bun run test:e2e -- <spec-file> --project=desktop`; keep the default suite for final verification. Avoid running lint while E2E recreates its output directory.

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
- Updates/delete/restore/purge require `expectedUpdatedAt`; compare-and-swap rejects stale changes with 409. Imports/bulk actions are transactional. Login/logout reload the document to discard private route state. The library stays in account-scoped memory across navigation; automatic refresh runs on focus/every five minutes while visible, skipping successful loads less than one minute old. Failed loads remain retryable; explicit retries, imports and bulk actions bypass freshness. Saves update memory immediately; other-device changes are not real-time.
- Keep account gates inside page content, not around root layout children, so route segments remain rendered for Next navigation validation.
- `deletedAt` is independent of status: Deleted preserves prior content/status/dates. Restore clears it; only separately confirmed permanent deletion erases it. No auto-empty. Exclude Deleted from ordinary views/counts/reminders and reject edits/bulk triage until restored.
- Portable/API envelopes are v3; v1/v2 remain importable. Exports include trash but exclude ownership/secrets. Imports preview, never overwrite; identical ID/content skips, conflicting IDs get new UUIDs. Limits: 10 MiB/5,000 items; bulk triage up to 200.
- Pending means non-deleted inbox/later. Done remains searchable; Archived is hidden from ordinary lists by default. Revisit dates are UTC with local-time editing, not delivered notifications; preserve tested DST behavior.
- New captures infer buy/Shopping for recognized Amazon, Zalando, Etsy, eBay, IKEA and Blue Tomato domains; YouTube infers watch, other links read, notes none. Explicit intent always wins and existing items are never reclassified. The editable code registry is `lib/items/link-sites.ts`: exact known roots/subdomains only, no guessed country TLDs, substring matching or redirect fetching. Domain detection also supplies local site icons/labels (including X/Twitter and Reddit); unknown sites retain type icons. No external favicons, network requests, schema changes or custom shopping lists.
- Link titles use local URL hints for Wikipedia articles, Amazon product slugs/IDs and X/Twitter post authors; unknown URLs fall back to their domain. Lists/search also derive these labels for existing domain-only titles without rewriting saved data or custom titles. Saved descriptions appear as two-line list previews. The card's main link covers its background and opens the original URL in a new tab (notes open saved details); separate visible Edit/Trash actions open saved fields/tags or move the item to recoverable Deleted. Deleted cards offer Details/Restore instead. Checkboxes and actions remain independent of the main link. Wikipedia and supported Google Search `/search` URLs have local site icons, with no remote favicon requests.
- Metadata is opt-in and applies suggestions to drafts only, in the capture form’s collapsed Link details section or the item editor. Capture saves chosen title/description/tags together with the item. A small local keyword registry (`lib/items/tag-suggestions.ts`) suggests up to five topic tags from the fetched title/description and URL path, not host/query/fragment. These are rules, not AI: no model, provider or API key. Applying tags merges with authored tags (case-insensitive duplicate avoidance, 50-tag limit); nothing is applied or saved automatically. Retain public-address DNS checks, IP-pinned transport/TLS identity, redirect revalidation, HTML/type/byte/time limits (512 KiB, 8 seconds, 3 redirects) and 10 requests/user/minute. No raw saved HTML, unsafe URL schemes, remote JS or automatic overwrite.
- Shared/bookmarklet capture uses a URL fragment and explicit review/save, including after sign-in. No service worker/private-response cache; installed-device sharing is not yet verified.
- Keep a compact personal utility: plain labels, visible search, collapsed filters, no marketing/hero/footer copy or fake data. Icon actions need hover/focus help, visible touch labels and 44px targets. Theme supports Automatic/Light/Dark via modern `light-dark()` CSS; overrides restore after hydration.
- Labels reuse item `tags` without a schema/portable-format change. Non-deleted items supply the collapsible sidebar list; card chips link to `/all?label=…`, with reload/history support. Labels overlap, while built-in queues remain independent. Ordinary label results exclude Archived by default (use the Status filter to include them) and always exclude Deleted. Capture/edit and each active card offer a searchable checkbox picker and explicit new-label creation; comma-separated entry remains available. Picks are drafts until saved. Bulk add/remove preserves unrelated labels and is transactional, owner-scoped and concurrency-checked (up to 200 items); label overflow rejects the whole operation rather than truncating. Note capture retains its inferred title/content, and label edits preserve the Added date.
- Capture warns about already-saved links/notes, including Archived, with a link to saved details; saving another copy remains intentional and non-destructive. URL comparisons normalize syntax only, retaining meaningful query/fragment distinctions. Note comparisons use full content with surrounding whitespace ignored. Deleted items do not trigger this warning.
- Clipsy stays separate: only its aggregate summary API uses a distinct account-scoped read-only credential. No shared DB/session secrets or copied cookies/passwords; permission is required before modifying Clipsy.

Automated browser/axe tests are not full accessibility or production certification. See the README for remaining work; update existing notes rather than adding milestone/session documents.

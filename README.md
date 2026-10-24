# Shelfy

Personal app for saved links, notes, videos and shopping items.

## Features

- Quick capture, tags, search, filters and reading/watching/shopping queues.
- Archived and Deleted folders; restore items or separately confirm permanent deletion.
- JSON/bookmark imports and JSON exports, optional link metadata and revisit dates.
- Automatic, light and dark themes; keyboard/focus tooltips and touch action labels.
- Sign-in required. Turso stores items and Better Auth users, hashed passwords and sessions. No browser-local library.

## Run locally

Requires Bun (see `package.json`) and a Turso database.

```sh
bun install --frozen-lockfile
bun run setup
```

Fill `.env.local` using [`.env.example`](.env.example). Setup generates an auth secret without overwriting existing settings. Keep secrets server-only; never commit `.env.local`.

Apply migrations intentionally against the configured database, then start:

```sh
CONFIRM_REMOTE_MIGRATION=true bun run db:migrate
bun dev
```

Open [localhost:3000](http://localhost:3000) and create an account. To close registration afterward, set `ALLOW_SIGN_UP=false` and restart. Production requires an HTTPS `BETTER_AUTH_URL`.

## Remaining work

- Change-password screen and email verification/password recovery.
- HTTPS hosting, backup/restore verification and real-phone sharing tests.
- Broader screen-reader and large-library testing; the full library currently loads at once.

Revisit dates do not send notifications. Clipsy is not connected. AI, price monitoring and offline sync are not implemented.

## Development

Next.js App Router, React, TypeScript, Tailwind, Drizzle/libSQL and Better Auth.

See [development notes](docs/DEVELOPMENT.md) for checks, architecture and data safety, and [agent rules](AGENTS.md) for coding constraints. Keep documentation limited to these three files; no running session logs or duplicate roadmaps.

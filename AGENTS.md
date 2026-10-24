# Shelfy agent entry point

Read [README](README.md) and [development notes](docs/DEVELOPMENT.md), then inspect Git state and real code. Preserve user work.

- Keep only these three Markdown documents. Update current facts/essential rationale in place; no duplicate specs, roadmaps or session histories. Code/tests are the detailed reference.
- Compact personal utility, not a landing page: plain labels, items prominent, optional filters collapsed, no marketing copy/fake counts/demo data. Preserve keyboard/touch accessibility.
- Account-only Turso/Better Auth. No local-saving fallback or automatic legacy-data upload/deletion. Derive ownership from validated sessions; retain concurrency, Origin/workspace checks, transactional imports and private/no-store responses.
- Delete is recoverable; permanent deletion is separately confirmed. No automatic trash expiry or destructive imports. Metadata fetching must retain DNS/IP pinning/TLS, redirect, size/type/time and rate-limit protections; never overwrite authored fields automatically.
- One Next App Router app, Bun, strict TypeScript/React/Tailwind. Server Components by default; narrow client boundaries, Zod validation, modest dependencies. Read installed Next guides before unfamiliar APIs.
- Run relevant checks and report honestly. For app changes: lint/typecheck/unit/E2E/build; for docs-only: formatting/links/whitespace. Don't expand docs with check-by-check logs.
- No deployments, paid provisioning, remote pushes/migrations, destructive Git actions, secret logging, AI processing or Clipsy edits without explicit permission. Never print env/token values or inspect other projects' secrets. Preserve generated Drizzle migrations; never casually reset/push schema.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->

# AGENTS.md

Apfel-Hafen: local HTTPS web interface (macOS 26, Apple Silicon) for managing
Apple `container` workloads and per-user LaunchD services. GPL-3.
German-first UI and commit/PR culture; keep user-facing strings German
(English translation maintained in parallel via `src/i18n.js` / `lib/server-i18n.mjs`).

## Stack & layout

- Node >= 20, **pnpm** (lockfile: `pnpm-lock.yaml`). React 19 + Vite 8 frontend, plain-JS backend.
- `server.mjs` — monolithic HTTPS server (~1.8k lines): routing, auth, all `/api/*`. Domain logic lives in `lib/*.mjs` (imported by server; keep new backend logic in `lib/`, not in server.mjs).
- `src/*.jsx` — frontend. `vite build` builds client; `vite build --config vite.server.config.js` bundles server to `server-dist/` (both run by the native app / release archive).
- `MacApp/` — native SwiftUI launcher; `launchd/` + `service-control.mjs` manage the LaunchAgent. Never run the server with `sudo` (container CLI belongs to the logged-in user).
- External prerequisites for real runs: `/usr/local/bin/container` (Apple container CLI), macOS 26. Not available in CI/anywhere else — many flows can only be smoke-tested on the owner's Mac.

## Commands

- Install: `pnpm install`
- Dev server: `pnpm dev` (serves at `https://127.0.0.1:4173`, self-signed cert auto-generated)
- Build: `pnpm build` (client **and** server bundle — do not run only plain `vite build`)
- Full test suite: `pnpm test` = `node --test tests/*.test.mjs` **then** `vitest run tests/*.test.jsx`. Both runners must pass; `.mjs` → node:test, `.jsx` → vitest+jsdom.
- Single test: `node --test tests/parser.test.mjs` or `pnpm vitest run tests/compose-center.test.jsx`
- PAM helper (needed for auth flows): `cc auth/pam-auth.c -o auth/pam-auth -lpam`
- Release artifacts (DMG + zip → `out/`): `pnpm release`. Launchd test: `pnpm test:launchd`.

## Testing quirks (easy to break)

- **Meta-tests assert on source text.** `tests/service-release.test.mjs` and friends `readFile` root files (`server.mjs`, `service-control.mjs`, `Start-Apfel-Hafen.command`, scripts, `src/main.jsx`) and regex-match exact strings — including German messages like `läuft bereits als Hintergrunddienst` and structural things (`setTimeout` blocks, `ditto` lines in build scripts). Refactoring those files will fail these tests; update the assertion together with the change, never weaken it silently.
- `tests/update-check.test.mjs` and registry code may hit live registries (ghcr.io/Docker Hub) — network failures there are not code failures.
- Keep the full suite green before merging; roadmap explicitly requires "alle bestehenden Tests bleiben grün".

## Release & versioning process

- Version lives in `package.json` only; release metadata is covered by `tests/service-release.test.mjs` — bump both together.
- Per-version flow (follow the established pattern): feature branch `codex/<topic>` (or `security/<topic>`) → PR → regular merge commit to `main` (no squash). Release ships as its own PR titled "Release Apfel-Hafen X.Y.Z"; tag `vX.Y.Z` points at that merge commit. `RELEASE-NOTES-0.3.x.md` at repo root per version.
- `ROADMAP-0.3.x.md` is the working plan with per-version status (`veröffentlicht` / `in Entwicklung`) and acceptance criteria. Read the current target version before starting feature work; keep the roadmap status updated when a version ships.
- Security fixes go through dedicated `security/*` PRs — keep that separation.

## Security rules (hard-won, do not regress)

- RAM budget: every start path (single container lifecycle/MCP, stack start/install, builder VM) is gated by `assertMemoryBudgetForStart` via `lib/memory-budget.mjs` before touching `container start`. Budget lives in `settings.json` `memoryBudgetMb` (0 = auto 60 % of RAM). Keep the gate on any new start flow.
- HTTPS only; no plain HTTP. TLS material lives in `~/Library/Application Support/Apfel-Hafen/tls/`, keys user-readable-only.
- Auth: PAM against local admin account, nothing stored. Unauthenticated reads are status-only and rate-limited (login oracle fix PR #9); validate hosts/image refs before shelling out to `container` (`lib/image-policy.mjs`, PRs #11/#14).
- MCP endpoint `/mcp` is disabled unless `APFEL_HAFEN_MCP_TOKEN` (≥32 chars) or `~/Library/Application Support/Apfel-Hafen/mcp-token` exists; token path derives from the real user home, **not** `APFEL_HAFEN_DATA_DIR`. MCP exposes only the 7 read/start/stop container tools — never add shell/delete/host-change tools there.
- No new unauthenticated endpoints. Destructive actions require confirmation and backups (`~/.../backups`); container replace verifies against a temp test container.
- Single-instance enforcement (`acquireServiceLock`, EADDRINUSE handling) is tested — keep it when touching startup.

## Repo hygiene

- Compiled `auth/pam-auth`, `node_modules/`, `dist/`, `out/` are gitignored — never commit build outputs or tokens.

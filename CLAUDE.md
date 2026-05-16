# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Project Sentinel

## OVERVIEW

Project Sentinel is an autonomous incident resolution engine. A Chaos Monkey injects real source-level bugs (syntax errors, type mismatches, logic inversions, renamed variables, deleted imports) into three Fastify microservices. A SQLite-backed Next.js 14 dashboard surfaces the resulting incidents. Specialized subagents — debugger-alpha and qa-beta — are then coordinated by a main orchestrator to diagnose, patch, test, and commit fixes under a strict resolution protocol, with every action recorded in both sentinel.db and an append-only incident log.

## ARCHITECTURE

- Monorepo (pnpm workspaces): `pnpm install` at root installs everything
- `/app` — Next.js 14 App Router dashboard (Tailwind, dark mode, TypeScript strict)
- `/services/{auth,payments,inventory}` — Fastify microservices on ports 4001/4002/4003
- `/packages/shared` — shared `ServiceName`, `BugType`, `Incident` types; `SERVICE_REGISTRY`; `createLogger()`
- `/scripts` — `chaos.ts` (injects bugs), `chaos-reset.ts` (restores files)
- `/docs/incident-history.log` — append-only JSONL of every chaos event and resolution
- `sentinel.db` — SQLite DB tracking services, incidents, resolutions (managed via SQLite MCP)

Key commands:
```
pnpm dev              # all services + dashboard
pnpm dev:services     # services only (auth, payments, inventory)
pnpm poll             # health-poll loop
pnpm chaos:run        # inject a random bug
pnpm chaos:reset      # restore all mutated files
pnpm test             # vitest across all workspaces
```

## CODING STANDARDS

- Strict TypeScript everywhere: no `any`, no `@ts-ignore`, no `@ts-expect-error` without a justification comment on the same line
- Naming: `camelCase` for variables and functions, `PascalCase` for types and React components, `kebab-case` for filenames
- Services use `createLogger()` from `@sentinel/shared` — never `console.log` in service code
- Every async function has explicit error handling (no unhandled promise rejections)
- No manual CSS in `/app` — use the `frontend-design` skill only
- Import order: Node built-ins → external packages → `@sentinel/*` → relative paths

## COMMIT CONVENTION

Conventional commits only. Allowed prefixes: `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`.

Every `fix:` commit body must include: `Resolves: INC-<id>`.

## RESOLUTION PROTOCOL

This is the contract every Sentinel subagent must follow when resolving an incident. Violations are failures.

1. **Read history first.** Before proposing any fix, read `/docs/incident-history.log` and search for any previous incident with the same `service` AND `bugType`. If a prior fix attempt failed (`status: FAILED_FIX`), do not repeat it — switch to extended thinking and propose a different approach. Document the rejected approach in the resolution entry.

2. **Diagnose from logs, not guesses.** Read the service's log file at `/services/logs/<service>.log` to find the actual error signature. Then read the source file. Never propose a fix based on the `bugType` alone.

3. **Minimal patch.** The fix must be the smallest change that resolves the root cause. No refactoring, no formatting, no opportunistic improvements.

4. **Regression test is mandatory.** Every fix is accompanied by a Vitest regression test at `/services/<service>/__tests__/<bugType>-<incidentId>.test.ts` that:
   - Fails when run against the broken code
   - Passes after the patch is applied
   - Tests the specific behavior that the bug broke

5. **Test gate.** Never commit a fix until `pnpm test` returns green for the entire workspace.

6. **Database update.** Update the incidents row in `sentinel.db` via the SQLite MCP server: status transitions `OPEN → INVESTIGATING → FIXING → TESTING → RESOLVED`. Set `resolved_at`, `root_cause`, `fix_summary`, `commit_sha` on `RESOLVED`.

7. **Append to history.** Append a resolution entry to `/docs/incident-history.log`:
   ```json
   {"incidentId":"","timestamp":"","status":"RESOLVED","rootCause":"","fixSummary":"","testFile":"","commitSha":"","agent":"<agent-name>","durationMs":0}
   ```

8. **Commit format.**
   ```
   fix(<service>): <one-line summary>

   Root cause: <one sentence>
   Fix: <one sentence>
   Test: <test file path>
   Resolves: INC-<id>
   ```

## SUBAGENT ROLES

- **debugger-alpha** — traces errors, identifies root cause, proposes minimal patch as a unified diff. Never writes tests. Never modifies files directly. Output is JSON only.
- **qa-beta** — receives debugger-alpha's patch, writes the regression test, verifies it fails on broken code, applies the patch, verifies it passes, runs full test suite. Never modifies service source files except to apply the patch verbatim.
- **main agent (orchestrator)** — coordinates the two subagents, updates `sentinel.db` at each phase transition, commits when both succeed, appends to `incident-history.log`.

## FORBIDDEN

- Manual UI styling (use `frontend-design` skill)
- Committing without a passing test
- Skipping the history check in step 1 of the resolution protocol
- Using `any` to silence type errors
- Modifying source files outside the scope of the proposed patch
- Committing before `pnpm test` passes

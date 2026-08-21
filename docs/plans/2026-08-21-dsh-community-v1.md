# DSH Community V1 Implementation Plan

> **For Codex:** Execute this plan end to end, preserving local Usage as the independent source of truth and keeping Community synchronization optional and failure-isolated.

**Goal:** Add an opt-in Community upload path to `dsh-usage` and ship a Cloudflare Worker + D1 web application with public rankings and profiles.

**Architecture:** `dsh-usage` derives an absolute Host snapshot from durable session history, subtracting each fork's inherited seed prefix before aggregation. The plugin links a local random installation through a browser GitHub flow and uploads versioned, digest-protected absolute snapshots. `apps/dsh-community` verifies and atomically upserts those snapshots into D1; its public React UI reads aggregated leaderboard and profile APIs.

**Tech Stack:** TypeScript, React, Cordis/DSH projection and RPC services, Cloudflare Workers, D1, Vite, Vitest, pnpm.

---

### Task 1: Protocol and fork-safe Host snapshots

**Files:**
- Modify: `dsh-usage/src/projection.ts`
- Create: `dsh-usage/src/community/protocol.ts`
- Create: `dsh-usage/src/community/snapshot.ts`
- Test: `dsh-usage/tests/community-snapshot.spec.ts`

1. Export a pure event-fold helper from the existing projection.
2. Derive each session's owned usage as full projection minus the immutable `seedLength` prefix projection.
3. Aggregate owned usage by UTC day and normalized public model taxonomy.
4. Canonicalize and hash protocol V1 snapshots; verify fork, replacement, and privacy-normalization cases.

### Task 2: Plugin linking, persistence, synchronization, and settings UI

**Files:**
- Create: `dsh-usage/src/community/service.ts`
- Create: `dsh-usage/src/community/state.ts`
- Create: `dsh-usage/src/client/community-remote.ts`
- Create: `dsh-usage/src/client/CommunitySettings.tsx`
- Modify: `dsh-usage/src/index.ts`
- Modify: `dsh-usage/src/client/index.ts`
- Modify: `dsh-usage/src/client/UsageSection.tsx`
- Modify: `dsh-usage/package.json`

1. Persist only random installation identity, device credential, sync preference, and last accepted revision/digest.
2. Implement device-link start/poll, status, toggle, and immediate synchronization RPCs.
3. Trigger an initial full snapshot only after explicit opt-in, then refresh at most every 30 minutes.
4. Isolate all network and Community failures from local projection and rendering.
5. Expose joined identity, sync toggle, last success, and retry state on the existing Usage settings page.

### Task 3: Cloudflare Worker, OAuth, D1, and API

**Files:**
- Create: `apps/dsh-community/package.json`
- Create: `apps/dsh-community/wrangler.jsonc`
- Create: `apps/dsh-community/migrations/0001_initial.sql`
- Create: `apps/dsh-community/src/worker/*`
- Test: `apps/dsh-community/tests/*`

1. Implement GitHub OAuth with state, PKCE, short-lived attempts, HttpOnly web sessions, and no retained GitHub access token.
2. Implement expiring one-time device linking and hashed device credentials.
3. Validate protocol/taxonomy/plugin versions, recompute snapshot digests, and enforce revision conflict rules.
4. Upsert the complete supplied daily/model key sets atomically while retaining omitted V1 keys.
5. Expose public leaderboard/profile APIs and authenticated `/api/v1/me`.

### Task 4: Public Community web UI

**Files:**
- Create: `apps/dsh-community/src/web/*`
- Copy/adapt: supplied `logo.svg` and `icon.svg` into `apps/dsh-community/public/`

1. Build the public 7D-first leaderboard, fixed signed-in standing panel, and responsive expandable rows.
2. Build public `/u/:login` profiles with activity and model mix.
3. Add `/about`, `/privacy`, GitHub sign-in/out, link confirmation, loading, empty, and error states.
4. Match the supplied dark data-dashboard direction with bundled assets and accessible responsive behavior.

### Task 5: Verification and handoff

**Files:**
- Modify: root/package scripts and documentation as required.

1. Run focused protocol, Worker, and UI tests.
2. Run recursive typecheck/test/build/check with the frozen root lockfile.
3. Run package dry-run validation and inspect Git diff for secrets, generated output, or unrelated changes.
4. Document local D1 migration/dev commands and required Cloudflare/GitHub environment configuration.

# Community Correctness and Connection UX Implementation Plan

> **For Codex:** Execute this plan task-by-task in the current scoped branch and verify every boundary before deployment.

**Goal:** Make Community snapshots true device-level replacements, minimize GitHub OAuth permissions, derive the plugin version from package metadata, cover Worker/D1 behavior with integration tests, and clarify the device confirmation experience without adopting Device Flow.

**Architecture:** Keep protocol V1 and the existing GitHub Authorization Code + PKCE flow. Apply every accepted snapshot as one D1 transaction: revision-guarded upserts, removal of rows absent from the new revision, and the device compare-and-set. Exercise the actual Worker handler against a local D1 database using Cloudflare's Vitest integration.

**Tech Stack:** TypeScript, React, Vitest 4, `@cloudflare/vitest-plugin`, workerd/Miniflare, Cloudflare D1, GitHub OAuth.

---

### Task 1: Add the Worker/D1 integration-test harness

**Files:**
- Modify: `apps/dsh-community/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/dsh-community/vitest.config.ts`
- Create: `apps/dsh-community/tests/apply-migrations.ts`
- Create: `apps/dsh-community/tests/env.d.ts`

**Steps:**

1. Add `@cloudflare/vitest-plugin` as a package dev dependency.
2. Configure `cloudflareTest()` with `wrangler.jsonc`, D1 migrations, and test-only secret bindings.
3. Apply migration `0001_initial.sql` before integration tests.
4. Run the existing Community tests and confirm the harness starts in workerd.

**Verify:** `pnpm --filter dsh-community test`

### Task 2: Specify and implement absolute snapshot replacement

**Files:**
- Create: `apps/dsh-community/tests/worker.integration.spec.ts`
- Modify: `apps/dsh-community/src/worker/index.ts`

**Steps:**

1. Write a failing route-level test that uploads revision 1 with two days/models, then revision 2 with one day/model.
2. Assert the omitted rows are removed and retained rows carry revision 2.
3. Add `DELETE ... WHERE device_id=? AND revision<?` statements after revision-guarded upserts and before final acceptance.
4. Keep the deletes, device revision update, and visibility update in the same `DB.batch()` transaction.
5. Make profile visibility conditional on the same accepted device revision/digest so a losing concurrent batch cannot publish a profile.
6. Add empty-snapshot replacement coverage.

**Verify:** The replacement tests fail before the implementation and pass afterward.

### Task 3: Cover revision, credential, and aggregation boundaries

**Files:**
- Modify: `apps/dsh-community/tests/worker.integration.spec.ts`

**Steps:**

1. Test a matching revision/digest as idempotent.
2. Test a matching revision with a different digest as conflict.
3. Test an older revision as stale.
4. Test missing, invalid, valid, and revoked device credentials.
5. Test one-time approved device-link credential delivery and hashed storage.
6. Upload snapshots for two devices belonging to one user and one device belonging to another user.
7. Assert leaderboard totals and ranks aggregate per user without double counting.

**Verify:** `pnpm --filter dsh-community test`

### Task 4: Minimize OAuth permissions

**Files:**
- Modify: `apps/dsh-community/src/worker/index.ts`
- Modify: `apps/dsh-community/tests/worker.integration.spec.ts`
- Modify: `apps/dsh-community/README.md`

**Steps:**

1. Add a route-level test for `/auth/github/start` asserting the GitHub URL contains PKCE/state but no `scope` parameter.
2. Remove the `read:user` scope request.
3. Document that Community requests only public profile identity and does not retain GitHub access tokens.

**Verify:** OAuth redirect test passes and no `read:user` occurrence remains in shipped source/docs.

### Task 5: Derive the plugin version from package metadata

**Files:**
- Create: `dsh-usage/src/version.ts`
- Modify: `dsh-usage/src/index.ts`
- Modify: `dsh-usage/tests/plugin.spec.ts`
- Modify: `dsh-usage/CHANGELOG.md`

**Steps:**

1. Load the installed package's `package.json` through Node's module loader and export a validated semantic version.
2. Pass that value into `CommunityUsageService` instead of a string literal.
3. Assert the registered service version equals `dsh-usage/package.json`.

**Verify:** `pnpm --filter dsh-usage test` and `pnpm --filter dsh-usage release:check`

### Task 6: Clarify the device confirmation page

**Files:**
- Modify: `apps/dsh-community/src/web/LinkDevice.tsx`
- Modify: `apps/dsh-community/src/web/styles.css`

**Steps:**

1. Preserve the explicit confirmation button and current PKCE flow.
2. When authenticated, state that GitHub sign-in is complete, show the active GitHub identity, and explain that the remaining action connects only the current DSH installation.
3. State beside the primary action that Community Sync remains off until explicitly enabled in Settings.
4. When unauthenticated, state that only public GitHub identity is requested.
5. Keep Chinese and English copy equivalent and ensure mobile layout remains usable.

**Verify:** Build the web app, run it locally, and visually inspect authenticated, unauthenticated, success, and mobile states.

### Task 7: Full verification and external configuration audit

**Files:**
- Modify if required: `apps/dsh-community/README.md`

**Steps:**

1. Run `pnpm check` at the workspace root.
2. Run Community and Usage release checks.
3. Confirm the GitHub OAuth App metadata uses `DSH Community`, `https://dshcommunity.com`, a public-profile-only description, and the production callback URL.
4. Do not enable Device Flow and do not alter the GitHub-login/Community-Sync separation.
5. Review the diff and verify no credentials, generated output, or unrelated files are included.

**Verify:** All checks pass and `git diff --check` is clean.

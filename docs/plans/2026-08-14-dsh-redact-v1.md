# dsh-redact v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish-ready `dsh-redact` package that tokenizes sensitive tool output before model exposure and Session persistence.

**Architecture:** A pure redaction engine and Agent-scoped in-memory vault feed a prepended `tools/post-execute` wrapper. Successful results replace canonical values and rely on Harness for output-schema validation; failures replace content, while sanitizer faults block with constant feedback.

**Tech Stack:** TypeScript 6, Node.js 22+, Cordis 4, DeepSeek Harness tools/session/agent packages, Vitest, pnpm 11.

---

### Task 1: Package skeleton and pure vault

**Files:**
- Create: `dsh-redact/package.json`
- Create: `dsh-redact/tsconfig.json`
- Create: `dsh-redact/tsconfig.build.json`
- Create: `dsh-redact/src/vault.ts`
- Test: `dsh-redact/tests/vault.spec.ts`

1. Add a failing test for unique prefixed tokens, stable same-value tokens, exact restoration, and clear.
2. Run `pnpm --filter dsh-redact test -- vault.spec.ts`; expect failure before implementation.
3. Implement `SecretVault` with injected UUID generation for deterministic tests.
4. Re-run the focused test; expect pass.

### Task 2: Recursive redaction engine

**Files:**
- Create: `dsh-redact/src/redaction.ts`
- Test: `dsh-redact/tests/redaction.spec.ts`

1. Add failing tests for sensitive keys, authorization, webhook, URL query credentials, PEM, JSON strings, and code-reference preservation.
2. Run the focused test and confirm failure.
3. Port and extend Noval's semantics, returning the tokenized value plus count/categories.
4. Re-run tests and confirm valid JSON and no fixture secret remains.

### Task 3: Harness post-execute integration

**Files:**
- Create: `dsh-redact/src/types.ts`
- Create: `dsh-redact/src/plugin.ts`
- Create: `dsh-redact/src/index.ts`
- Test: `dsh-redact/tests/plugin.spec.ts`
- Test: `dsh-redact/tests/harness.spec.ts`

1. Add failing listener tests for success values, failure content, downstream replacements, private events, cleanup, and injected sanitizer failure.
2. Implement the prepended waterfall wrapper and `redaction/applied` event type.
3. Add a real `ToolRuntime` test proving schema revalidation rejects a tokenized string where the declared output requires a number.
4. Run all package tests; expect pass.

### Task 4: Package documentation and release verification

**Files:**
- Create: `dsh-redact/README.md`
- Create: `dsh-redact/CHANGELOG.md`
- Create: `dsh-redact/LICENSE`
- Create: `dsh-redact/cordis.patch.yml`
- Create: `dsh-redact/scripts/verify-release.mjs`
- Modify: `README.md`
- Modify: `pnpm-lock.yaml`

1. Document exact guarantees, exclusions, event vocabulary, configuration, and installation.
2. Add release metadata and a verification script checking required files and package identity.
3. Run `pnpm install`, package `check`, root `check`, dry-run packing, `git diff --check`, and a sensitive-fixture scan.
4. Inspect Git scope and report results; do not push or publish.

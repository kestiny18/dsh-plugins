# dsh-redact v1 Design

## Scope

`dsh-redact` protects tool output before it becomes durable Harness history or model input. Version 1 tokenizes sensitive values in the `tools/post-execute` waterfall, keeps the token-to-secret mapping only in memory for the owning live Agent, and records a `redaction/applied` event containing only the replacement count and category names.

The model and Session log always retain tokens. Version 1 does not restore tokens into tool arguments and does not rewrite user messages. A future trusted presentation layer may restore exact tokens for display while the live in-memory mapping still exists.

## Data flow

1. Run the rest of the `tools/post-execute` waterfall.
2. Inspect the effective successful canonical value, or the effective failure/block content.
3. Recursively tokenize sensitive fields and strings with an Agent-scoped `SecretVault`.
4. Return a canonical value replacement for success so Harness revalidates the value against the tool output schema and re-renders model content.
5. Return sanitized content for failures and blocked outcomes.
6. Append `redaction/applied` with only `{ count, categories }` when replacements occurred.
7. On any sanitizer, mapping, or audit-event error, return constant corrective feedback and block the result.

The listener is prepended so it wraps later post-execute policy and sanitizes that policy's final decision. It never logs or persists original values.

## Detection semantics

The implementation ports Noval's validated coverage for password, secret/API-key, token, authorization, webhook, private-key/PEM, and URL-query credentials. It preserves environment-variable reads, function calls, type annotations, and declaration placeholders. JSON-encoded strings are parsed recursively, tokenized structurally, and serialized back as valid JSON.

Tokens use `⟦dsh:redact:<uuid>⟧`. The prefix prevents accidental treatment of arbitrary UUIDs as secrets. A vault returns a stable token for the same original string within one live Agent and supports exact restoration as a pure in-memory capability, but restoration is not connected to tool execution or persistence in v1.

## Failure and lifecycle boundaries

- A schema-incompatible replacement becomes Harness's normal tool-output error; the raw result is not accepted.
- A sanitizer or event append exception fails closed with constant secret-free feedback.
- Agent disposal clears the vault explicitly; a `WeakMap` also prevents plugin-owned retention.
- Agentless executions use an execution-local vault and cannot be restored later.
- Unknown or malformed token-looking text is ordinary text; restoration only replaces tokens present in the vault.

## Verification

Unit tests cover every credential family, recursive structured values, nested JSON strings, valid JSON preservation, source-code references, stable tokens, restoration, error content, downstream post-policy replacement, fail-closed behavior, schema rejection through the real ToolRuntime, event privacy, lifecycle cleanup, and package contents.

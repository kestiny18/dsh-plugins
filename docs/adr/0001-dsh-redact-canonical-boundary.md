# ADR-0001: Tokenize tool output at the canonical post-execute boundary

- Status: Accepted
- Date: 2026-08-14

## Context

DeepSeek Harness exposes `tools/post-execute` after tool execution and before the final result reaches durable `tool/result` history. The hook can replace a successful canonical value, after which Harness validates the replacement against the tool's declared output schema and renders content again. Harness intentionally does not allow plugins to rewrite frozen tool arguments.

`dsh-redact` must prevent credentials in tool output from reaching the model or durable history, preserve structured JSON, remain observable without leaking values, and fail closed.

## Decision

Version 1 prepends a `tools/post-execute` wrapper. After downstream policy settles, it tokenizes the effective successful value and returns a value replacement. Failed or blocked content is tokenized as content because failures have no canonical value. Mapping is held in an Agent-scoped in-memory vault and destroyed on Agent disposal. Audit events contain only replacement counts and categories.

The plugin does not restore tokens into tool arguments and does not claim to protect secrets directly entered by users. Canonical model output remains tokenized. Restoration is an exported in-memory primitive for a future trusted presentation boundary only.

## Alternatives

1. Replace only rendered content. Rejected because the original canonical value could still reach execution-local consumers and violates the Harness confidentiality guidance.
2. Rewrite model tool calls or mutate `tools/pre-execute` arguments. Rejected because arguments are immutable and doing so would desynchronize audit history from execution.
3. Persist an encrypted mapping. Deferred because v1 needs no cross-process restoration and persistence increases key-management and breach complexity.

## Consequences

The provider and durable Session see only tokens, and schema-incompatible redaction fails safely. Tools that require a real secret cannot consume a model-returned token in v1. Tokens from a prior process cannot be restored after restart.

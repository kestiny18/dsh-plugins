# Changelog

All notable changes to `dsh-redact` are documented in this file.

## [0.1.0] - 2026-08-14

### Added

- Agent-scoped, memory-only token vault with stable opaque replacement tokens.
- Canonical `tools/post-execute` value replacement with Harness output-schema revalidation.
- Recursive password, secret, token, authorization, webhook, URL-query, private-key, PEM, and JSON-string handling derived from Noval's validated semantics.
- Source-code reference preservation and valid JSON serialization.
- Fail-closed handling for sanitizer faults and immutable sensitive failure fields.
- Privacy-minimal `redaction/applied` Session events containing only count and categories.

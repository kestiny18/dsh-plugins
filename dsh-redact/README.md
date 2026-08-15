# dsh-redact

Fail-closed canonical tool-output tokenization for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

`dsh-redact` replaces common credentials with opaque, Agent-scoped tokens before the final tool result reaches model context or durable Session history. It replaces the successful canonical value through `tools/post-execute`, so Harness validates the replacement against the tool's declared output schema and renders model content from the accepted value again.

```text
password=FAKE_PASSWORD

→ password=⟦dsh:redact:550e8400-e29b-41d4-a716-446655440000⟧
```

The token mapping exists only in process memory. Agent disposal clears it, and a restart makes old tokens intentionally unrestorable.

## Install

From a Harness environment:

```sh
dsh plugin --profile web add dsh-redact
dsh --profile web --dump-config
```

For local development, run the same command from this directory and replace the package name with `.`.

The bundle patch registers the plugin as `redact`; version 1 has no user configuration.

## Protected shapes

- password, passwd, and pwd fields;
- secret, API-key, app-key, access-key, and signature fields;
- token and access-token fields;
- authorization and bearer/basic headers;
- webhook and robot URL fields;
- private-key fields and PEM private-key bodies;
- credentials in URL query parameters;
- recursively nested arrays, objects, and JSON-encoded strings.

Source references such as environment-variable reads, function calls, type annotations, and declaration placeholders remain visible. JSON-encoded strings are parsed structurally and serialized back as valid JSON. Encoding deeper than 8 string layers is blocked instead of falling back to unsafe pass-through.

## Runtime guarantees

- The prepended `tools/post-execute` listener wraps later post policies and sanitizes their effective decision.
- Successful output is returned as a canonical value replacement. Harness output-schema validation remains authoritative.
- Failed results with sensitive immutable `error`, `meta`, or deferred context fields become safe blocked results instead of retaining the original structure.
- Sanitizer, vault, downstream-policy, and audit-append failures block with constant secret-free feedback.
- Tokens are stable for the same secret only within one live Agent. Different Agents never share a mapping.
- `redaction/applied` is appended only after a replacement and contains exactly a count and sorted category list:

```json
{
  "count": 2,
  "categories": ["password", "token"]
}
```

No original value, replacement token, tool name, arguments, or error detail enters that event.

## Deliberate exclusions

Version 1 does not:

- inspect or rewrite user messages before they enter the Session inbox;
- restore tokens into tool arguments or commands;
- persist or encrypt the token mapping;
- rewrite assistant messages—the model sees tokens, so canonical assistant output remains tokenized;
- guarantee sanitization of content a tool-owned `finalizeContent` callback introduces after `tools/post-execute`;
- emit a durable audit event for an Agentless, same-process `ToolRuntime.execute()` call.

Tools that need an original credential cannot consume a returned token in version 1. Tool definitions and plugins that run after the canonical boundary remain trusted code and must not synthesize secrets into later presentation content.

A successful downstream post policy that replaces only rendered `content` is superseded by the canonical value replacement, because retaining a raw canonical value would weaken the confidentiality boundary. Downstream security or spill policies should transform canonical values when they must compose with `dsh-redact`.

## Trusted presentation restoration

Restoration is available only as an explicit in-memory primitive; the default plugin does not reveal tokens. A trusted same-process host can retain its own policy instance:

```ts
import { RedactionPolicy, installRedactionPolicy } from 'dsh-redact'

const policy = new RedactionPolicy()
installRedactionPolicy(ctx, policy)

// Presentation only. Never append this value to the Session log.
const visible = policy.restore(agent, tokenizedText)
```

`restore()` replaces only tokens owned by that Agent's live vault. Unknown token-looking strings stay unchanged.

## Development

```sh
pnpm install --frozen-lockfile
pnpm --filter dsh-redact run check
pnpm --filter dsh-redact run pack:check
```

See the repository [security policy](../SECURITY.md) for vulnerability reporting.

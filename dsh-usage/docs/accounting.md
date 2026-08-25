# Accounting model

`dsh-usage` derives usage from the durable DeepSeek Harness session log. It does not create another event stream or usage database, so replay, resume, compaction, and Web clients observe the same source of truth.

## Token buckets

The plugin keeps four disjoint provider-reported buckets:

- uncached input;
- cache read;
- cache write;
- output.

The turn footer presents `Input` as uncached input plus cache-write input and `Cache` as provider-reported cache-read input. Reasoning tokens already included in output are never counted twice.

## Turn summaries

Every finalized turn with reported usage displays a compact line in the assistant action row:

`Total 133K tokens · Input 1.1K · Cache 132K · Output 725 · Cost $0.0003276 USD`

Values come from the durable whole-log `modelCost.byTurn` projection, not only the currently loaded messages. History paging and compaction therefore do not shrink an older turn's reading. If a provider reports no usage, the footer stays absent instead of presenting a misleading zero.

Cost appears only when every model call in the turn reports usage and matches a configured rate. A partial amount is never presented as the turn total.

## Settings → Usage

The independent Usage page starts in **All sessions** scope and provides:

- total, input, cache, and output tokens;
- model-call count and estimated cost;
- a keyboard-accessible 52-week UTC activity heatmap;
- provider/model totals;
- per-session totals, or per-turn totals after choosing a session.

The heatmap uses total token volume relative to the busiest visible day. Hover, focus, or click a day for exact Input, Cache, Output, and Cost. Daily buckets use UTC so replay stays stable across machines and time zones.

The page shows `--` for total cost whenever usage or pricing coverage is incomplete. The former `/cost` command is intentionally not registered because the turn footer and Usage page provide the same information without adding command rows to conversation history.

## Forks and sub-Agents

Forked and sub-Agent sessions are measured from their durable lineage boundary. Inherited seed events are subtracted, while every new child model call remains counted, including provider-reported cache reads.

Community retries send complete absolute snapshots with stable revision/digest semantics. Accepted newer snapshots replace older rows for the same device instead of being accumulated again.

## Coverage

The projection currently covers:

- ordinary agent-loop calls from `assistant/chunk` and `assistant/message` usage;
- successful compaction model calls from `compaction/summary` usage;
- model switches, effective-dated price changes, cache reads, and cache writes;
- calls with usage but no configured price, marked `unpriced`;
- entered agent steps and compactions without reported usage, marked `without usage`.

Harness session-title LLM events currently record the request route but not provider usage, so title-generation fees cannot be reconstructed. Calls made by plugins that neither attach usage to a durable event nor use the agent loop are also outside the projection.

## Design note

The provider-neutral accounting and activity view build on ideas previously explored in Noval. Its separate JSONL usage store and metered wrapper are not copied because Harness already owns durable events, replay projections, model routes, and Web extension slots.

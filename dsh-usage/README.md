# dsh-usage

Token usage, estimated model cost, and a 52-week activity heatmap for DeepSeek Harness Web.

[npm](https://www.npmjs.com/package/dsh-usage) · [Source](https://github.com/kestiny18/dsh-plugins/tree/main/dsh-usage) · [Discussion](https://github.com/deepseek-ai/deepseek-harness/discussions/1169)

`dsh-usage` adds:

- a compact `Total · Input · Cache · Output · Cost` summary below every completed turn;
- a full **Settings → Usage** page;
- totals by model, session, and turn;
- a GitHub-style 52-week activity heatmap;
- provider-neutral token accounting and optional estimated cost.

It reads Harness's durable session log and does not create a separate usage database. Any model or provider that reports standard usage data can contribute token totals. Cost is shown only when a matching price is configured.

## Quick start

Requirements: Node.js 22.18 or newer and an existing DeepSeek Harness Web profile.

### Using Harness through npx

Copy and run these commands from PowerShell, Command Prompt, or a terminal. No global `dsh` or pnpm installation is required:

```powershell
npx --yes --package=@deepseek-ai/dsh --package=pnpm@11.7.0 -- dsh plugin --profile web add dsh-usage
npx --yes @deepseek-ai/dsh --profile web --dump-config
npx --yes @deepseek-ai/dsh --profile web
```

Then open the Harness Web URL printed in the terminal. Complete one model response and check:

- the usage summary below the assistant response;
- **Settings → Usage** for totals and the 52-week heatmap.

The first installation requires restarting Harness so that its Web client discovers the plugin.

### Using a globally installed dsh

If both `dsh` and pnpm are available on your `PATH`, use the shorter commands from the [original announcement](https://github.com/deepseek-ai/deepseek-harness/discussions/1169):

```powershell
dsh plugin --profile web add dsh-usage
dsh --profile web --dump-config
dsh --profile web
```

### Running from a Harness source checkout

Run these commands inside the DeepSeek Harness repository:

```powershell
pnpm dsh plugin --profile web add dsh-usage
pnpm dsh --profile web --dump-config
pnpm dsh --profile web
```

### Upgrade

Run the same `plugin add` command again, then restart Harness:

```powershell
npx --yes --package=@deepseek-ai/dsh --package=pnpm@11.7.0 -- dsh plugin --profile web add dsh-usage
```

If `dsh` is not recognized, use the npx command above instead of the global-install form. If the Usage page does not appear after installation, stop and restart the running Harness process.

## Develop from this repository

Install dependencies from the monorepo root, then build and verify this package:

```powershell
pnpm install --frozen-lockfile
pnpm --filter dsh-usage run check
cd dsh-usage
npx --yes --package=@deepseek-ai/dsh --package=pnpm@11.7.0 -- dsh plugin --profile web add .
npx --yes @deepseek-ai/dsh --profile web --dump-config
npx --yes @deepseek-ai/dsh --profile web
```

Alternatively, run `pnpm dsh` from a Harness checkout and replace `.` with the path to your `dsh-usage` package directory. Do not copy a machine-specific absolute path from this README.

During browser development, Harness's `pnpm run dev:web` flow can HMR later source changes after the initial plugin discovery.

## How accounting works

The plugin prices four disjoint Harness usage buckets: uncached input, cache read, cache write, and output. Reasoning tokens are already included in output and are never charged twice. Price schedules are effective-dated, so replay uses the rate active when each event was recorded instead of rewriting historical cost with today's price.

The bundled `cordis.patch.yml` contains the USD prices published for `deepseek-v4-flash` and `deepseek-v4-pro` on 2026-04-24. DeepSeek can change prices; verify the [official pricing page](https://api-docs.deepseek.com/quick_start/pricing/) before relying on the estimate.

## Configure rates

Every rate is one currency unit per million tokens. Matching is exact on both the Harness provider route and provider-owned model id. Add another row with a later `effectiveFrom` when a price changes; do not edit the old row if historical replay matters.

```yaml
- id: usage
  name: dsh-usage
  config:
    currency: CNY
    rates:
      - provider: deepseek-official
        model: deepseek-v4-flash
        effectiveFrom: '2026-04-24T00:00:00.000Z'
        uncachedInput: 1
        cacheRead: 0.02
        cacheWrite: 1
        output: 2
      - provider: deepseek-official
        model: deepseek-v4-pro
        effectiveFrom: '2026-04-24T00:00:00.000Z'
        uncachedInput: 3
        cacheRead: 0.025
        cacheWrite: 3
        output: 6
```

Harness configuration layers replace a row's complete `config` value rather than deep-merging it, so a profile override must repeat both `currency` and the full `rates` list.

## Web turn footer

Every finalized turn displays one compact English-only line in the existing assistant action row:

`Total 133K tokens · Input 1.1K · Cache 132K · Output 725 · Cost $0.0003276 USD`

- `Total` is `Input + Cache + Output`;
- `Input` is uncached input plus cache-write input;
- `Cache` is provider-reported cache-read input;
- `Output` is provider-reported output, including reasoning tokens.

These values come from the durable whole-log `modelCost.byTurn` projection, not from the currently loaded page of messages, so history paging and compaction do not shrink an older turn's reading. If a provider reports no usage for a turn, the footer stays absent rather than presenting a misleading zero.

`Cost` appears only when every model call in that turn has provider usage and a matching configured rate. If either is missing, the token metrics remain visible and the cost segment is omitted; a partial amount is never presented as the turn total.

## Web Usage page

Open **Settings → Usage** to inspect replay-derived accounting. The independent page starts in **All sessions** scope and provides:

- total, input, cache, and output tokens;
- model-call count and estimated cost;
- a keyboard-accessible 52-week UTC activity heatmap with per-day token buckets and cost;
- provider/model totals;
- per-session totals, or per-turn totals after choosing one session.

The page updates from Harness's global session projection feed. Its total cost displays `--` whenever pricing or provider usage is incomplete, with an explanatory coverage note. This page is intentionally independent from **Models**: Models configures providers, while Usage observes calls across all configured providers.

The heatmap color encodes total token volume relative to the busiest visible day. Hover, focus, or click a day to inspect its exact Input, Cache, Output, and Cost. Daily buckets use UTC so replay remains stable across browsers and machines; future cells in the current week stay blank.

The former `/cost` command is intentionally not registered: the Web footer and Usage page cover its information without adding command rows to conversation history. Rows created by older local builds remain part of their durable session logs, but no new `/cost` execution is available.

## Accounting coverage

The projection is replay-derived and adds no new session event. It currently covers:

- ordinary agent-loop calls from `assistant/chunk` and `assistant/message` usage;
- successful compaction model calls from `compaction/summary` usage;
- model switches, price changes, cache reads, and cache writes;
- calls with reported usage but no configured price, shown as `unpriced`;
- entered agent steps and compactions without reported usage, shown as `without usage`.

Current Harness session-title LLM events record the request route but not provider usage, so title-generation fees cannot yet be reconstructed and are not included. Calls made by plugins that neither attach usage to an existing durable event nor use the agent loop are likewise outside the projection. A future Harness-wide usage event would remove this blind spot without changing the pricing model.

## Why this differs from Noval

Noval's useful ideas are retained: provider-neutral usage, side-channel accounting, model/purpose summaries, and a compact 52-week activity view. Its `JsonlUsageStore` and metered client wrapper are not copied because Harness already owns a durable event log, replay projections, model routes, and Web extension slots. Reusing those seams avoids a second persistence format and keeps compaction, resume, and Web clients consistent.

## Development

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run pack:check
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for source-checkout testing and pull-request expectations.

## Automated releases

This monorepo publishes from GitHub Releases through npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/); no npm write token is stored in GitHub.

After creating the GitHub repository and adding it as `origin`, run `pnpm repo:sync` from the monorepo root and commit the resulting package metadata. Then configure:

- a GitHub environment named `npm`;
- the npm package's GitHub Actions trusted publisher with this repository;
- workflow filename `publish.yml`;
- environment `npm`;
- allowed action `npm publish`.

To release, update the package version and changelog, run `pnpm --filter dsh-usage run release:check`, and publish a GitHub Release tagged exactly `dsh-usage-v<package-version>`. Normal releases use the npm `latest` tag; GitHub prereleases use `next`.

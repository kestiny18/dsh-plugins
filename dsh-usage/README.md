# dsh-usage

[![npm](https://img.shields.io/npm/v/dsh-usage?color=CB3837)](https://www.npmjs.com/package/dsh-usage)
[![CI](https://github.com/kestiny18/dsh-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/kestiny18/dsh-plugins/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**English** · [简体中文](https://github.com/kestiny18/dsh-plugins/blob/main/dsh-usage/README.zh-CN.md)

See where your tokens go. `dsh-usage` adds per-turn token summaries, estimated model cost, and a 52-week activity dashboard to DeepSeek Harness Web.

> Community plugin maintained independently from DeepSeek. Cost is an estimate, not a provider bill.

![Settings → Usage dashboard](https://github.com/user-attachments/assets/5f67e3d8-baab-4387-a778-01df8adb1dcd)

## What you get

- A compact `Total · Input · Cache · Output · Cost` summary below every completed turn.
- A dedicated **Settings → Usage** page with totals by model, session, and turn.
- A GitHub-style 52-week activity heatmap built from durable session history.
- Provider-neutral accounting: any model that reports standard usage can contribute token totals.
- Optional aggregate-only participation in [DSH Community](https://dshcommunity.com), disabled by default.

The plugin replays Harness's existing session log instead of creating another usage database. Local Usage remains independent from Community login and network availability.

## Install in 30 seconds

Requirements: Node.js 22.18 or newer and an existing DeepSeek Harness Web profile.

```powershell
npx --yes --package=@deepseek-ai/dsh --package=pnpm@11.9.0 -- dsh plugin --profile web add dsh-usage
npx --yes @deepseek-ai/dsh --profile web --dump-config
npx --yes @deepseek-ai/dsh --profile web
```

Open the Web URL printed in the terminal, complete one model response, then check the turn summary and **Settings → Usage**. Restart Harness after the first installation so the Web client discovers the plugin.

The commands deliberately pin the verified pnpm 11.9.0 installation baseline. pnpm 11.7.0 can fail while installing the plugin.

[Upgrade, global CLI, source-checkout, proxy, and troubleshooting guide](https://github.com/kestiny18/dsh-plugins/blob/main/dsh-usage/docs/installation.md)

## Join the Community — only if you choose

Connect GitHub and Community Sync are separate choices. Signing in identifies your public profile; it does **not** start an upload. Sync stays off until you explicitly enable it in **Settings → Usage**.

When enabled, the plugin uploads only aggregate daily/model request and token totals. It never uploads prompts, responses, session content, tool content, paths, hostnames, hardware identifiers, or cost. Unknown/private model routes are combined into `other` before the request is created. A failed sync never interrupts local Usage.

[Open the leaderboard and illustrated setup guide →](https://dshcommunity.com)

![DSH Community public leaderboard](https://raw.githubusercontent.com/kestiny18/dsh-plugins/main/dsh-usage/docs/images/community-leaderboard.png)

## Trustworthy accounting

Input, cache read, cache write, and output remain separate buckets. Reasoning tokens already reported as output are not counted twice. Forked and sub-Agent sessions subtract inherited seed events while retaining the child's new model calls, including provider-reported cache reads.

Cost appears only when every relevant call has provider usage and a matching effective-dated rate. Otherwise token totals remain visible and cost is omitted instead of showing a misleading partial amount.

- [Accounting model, coverage, and limitations](https://github.com/kestiny18/dsh-plugins/blob/main/dsh-usage/docs/accounting.md)
- [Price configuration](https://github.com/kestiny18/dsh-plugins/blob/main/dsh-usage/docs/pricing.md)

## Links

- [DSH Community](https://dshcommunity.com)
- [npm package](https://www.npmjs.com/package/dsh-usage)
- [Source repository](https://github.com/kestiny18/dsh-plugins/tree/main/dsh-usage)
- [Original discussion](https://github.com/deepseek-ai/deepseek-harness/discussions/1169)
- [Issues and feedback](https://github.com/kestiny18/dsh-plugins/issues)
- [Contributing](https://github.com/kestiny18/dsh-plugins/blob/main/CONTRIBUTING.md)

MIT licensed.

# Price configuration

Cost is optional. Token accounting works without configured prices.

Every rate is one currency unit per million tokens. Matching is exact on the Harness provider route and provider-owned model id. Rates are effective-dated so replay uses the price active when an event was recorded instead of rewriting historical cost with today's price.

The bundled `cordis.patch.yml` contains the USD prices published for `deepseek-v4-flash` and `deepseek-v4-pro` on 2026-04-24. Provider prices can change; verify the [official DeepSeek pricing page](https://api-docs.deepseek.com/quick_start/pricing/) before relying on an estimate.

## Example

```yaml
- id: usage
  name: dsh-usage
  config:
    currency: CNY
    communityUrl: https://dshcommunity.com
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

Add a new row with a later `effectiveFrom` when a price changes. Do not edit an old row if historical replay matters.

Harness configuration layers replace a row's complete `config` value rather than deep-merging it. A profile override must repeat both `currency` and the full `rates` list.

## Display rules

- Token totals remain visible without prices.
- Turn cost appears only when every call has usage and a matching rate.
- Page-level total cost displays `--` when coverage is incomplete.
- Community Sync never uploads cost.

All displayed cost is an estimate and does not replace the provider's bill.

# Installation and troubleshooting

## Requirements

- Node.js 22.18 or newer
- An existing DeepSeek Harness Web profile

## Recommended: run Harness through npx

No global `dsh` or pnpm installation is required. The command pins the verified pnpm 11.9.0 installation baseline; pnpm 11.7.0 can fail while installing the plugin.

```powershell
npx --yes --package=@deepseek-ai/dsh --package=pnpm@11.9.0 -- dsh plugin --profile web add dsh-usage
npx --yes @deepseek-ai/dsh --profile web --dump-config
npx --yes @deepseek-ai/dsh --profile web
```

Open the Web URL printed in the terminal. The first installation requires restarting Harness so its Web client discovers the plugin.

## Globally installed dsh

If both `dsh` and pnpm are on `PATH`:

```powershell
dsh plugin --profile web add dsh-usage
dsh --profile web --dump-config
dsh --profile web
```

## Harness source checkout

Run inside the DeepSeek Harness repository:

```powershell
pnpm dsh plugin --profile web add dsh-usage
pnpm dsh --profile web --dump-config
pnpm dsh --profile web
```

## Upgrade

Run the recommended `plugin add` command again, then restart Harness:

```powershell
npx --yes --package=@deepseek-ai/dsh --package=pnpm@11.9.0 -- dsh plugin --profile web add dsh-usage
```

## Test a source checkout

Install dependencies and verify the package from the monorepo root:

```powershell
pnpm install --frozen-lockfile
pnpm --filter dsh-usage run check
cd dsh-usage
npx --yes --package=@deepseek-ai/dsh --package=pnpm@11.9.0 -- dsh plugin --profile web add .
npx --yes @deepseek-ai/dsh --profile web --dump-config
npx --yes @deepseek-ai/dsh --profile web
```

Alternatively, run `pnpm dsh` from a Harness checkout and pass the path to the `dsh-usage` package directory. During browser development, Harness's `pnpm run dev:web` flow can HMR source changes after initial plugin discovery.

## Troubleshooting

### `dsh` is not recognized

Use the npx commands instead of the global CLI form.

### The Usage page does not appear

Stop and restart the running Harness process after installation. Then complete one model response and reopen **Settings → Usage**.

### Community requests cannot reach the network

Configure the proxy in the environment that launches DSH. Node.js 22.21+ and Node.js 24 can use standard `HTTP_PROXY` / `HTTPS_PROXY` variables when `NODE_USE_ENV_PROXY=1` is also set. The plugin does not read or change operating-system proxy settings.

Community failures never interrupt local Usage, heatmaps, turn summaries, or cost estimates.

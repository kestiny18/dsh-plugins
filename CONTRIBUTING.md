# Contributing

Thanks for improving the `dsh-plugins` monorepo.

## Prerequisites

- Node.js 22.18 or newer
- pnpm 11
- A DeepSeek Harness checkout for optional end-to-end plugin verification

## Local development

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run pack:check
```

To work on one package only:

```sh
pnpm --filter dsh-usage run check
```

To test a source package in Harness, run this from that package directory:

```sh
dsh plugin --profile web add .
dsh --profile web --dump-config
dsh --profile web
```

If the CLI is only available inside a Harness checkout, use `pnpm dsh` there and pass the path to this checkout instead of `.`.

## Pull requests

- Keep changes focused and include tests for affected plugin behavior.
- Run `pnpm run check` before opening a pull request.
- Update the affected package's `CHANGELOG.md` for user-visible changes.
- Never commit npm tokens, API keys, local Harness profiles, or generated output.

## Releases

Releases are published by `.github/workflows/publish.yml` through npm Trusted Publishing. Maintainers should:

1. update the package version and its `CHANGELOG.md`;
2. run `pnpm --filter <package> run release:check`;
3. merge the release commit to the default branch;
4. publish a GitHub Release whose tag is exactly `<package>-v<package-version>`.

The workflow publishes normal releases with the npm `latest` tag and prereleases with `next`. No npm write token belongs in GitHub Secrets.

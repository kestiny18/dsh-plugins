# dsh-plugins

Monorepo for independently published DeepSeek Harness plugins. The repository uses one Git history, one pnpm lockfile, and shared CI/release automation; every `dsh-*` directory remains its own npm package.

## Packages

| Package | Description |
| --- | --- |
| [`dsh-redact`](dsh-redact) | Fail-closed canonical tool-output tokenization before model and Session persistence |
| [`dsh-usage`](dsh-usage) | Replay-aware token usage and estimated model cost for the Harness Web UI |

## Applications

| Application | Description |
| --- | --- |
| [`dsh-community`](apps/dsh-community) | Cloudflare Worker + D1 public usage leaderboard and GitHub-linked profiles |

## Development

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run pack:check
```

Run a command for one plugin with a pnpm filter:

```sh
pnpm --filter dsh-usage run check
```

New plugins should be direct child directories named `dsh-*`. Give each package its own `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, source, tests, and `release:check` script. Do not create a nested `.git` directory or package lockfile.

## Releases

Packages are published independently from GitHub Releases through npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), without a long-lived npm token.

After adding the GitHub repository as `origin`, run `pnpm repo:sync` and commit the package metadata. Configure a GitHub environment named `npm`, then configure each npm package's trusted publisher with this repository, workflow `publish.yml`, environment `npm`, and allowed action `npm publish`.

Release tags are package-specific: `<package>-v<version>`, for example `dsh-usage-v0.1.1`. The workflow validates the tag against the selected package, runs that package's release checks, and publishes only that package. Normal releases use the npm `latest` tag; GitHub prereleases use `next`.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) for project policy.

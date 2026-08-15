# dsh-plugins monorepo

This repository is a pnpm workspace for independently published DeepSeek Harness plugins.

## Layout

- The workspace root owns the only `.git` directory, lockfile, shared documentation, and GitHub workflows.
- Each direct `dsh-*` child directory is one independently versioned and published npm package.
- Do not add nested Git repositories or per-package lockfiles.
- Name public packages and repositories with the `dsh-` prefix.

## Shared conventions

- Use pnpm and commit the single root `pnpm-lock.yaml`.
- Keep generated output, dependencies, local Harness profiles, screenshots, and credentials out of Git.
- Every package must provide `build`, `test`, `check`, and release-verification scripts.
- CI must use least-privilege permissions and a frozen lockfile.
- npm releases must use Trusted Publishing (OIDC); never commit or add a long-lived npm token to GitHub Secrets.
- Each plugin owns its README, LICENSE, changelog, source, and tests. Contribution, security, CI, and publishing policy live at the root.

## New npm package bootstrap

- Before creating the first GitHub Release for a new package, verify whether the package already exists on npm and is owned by the expected maintainer.
- npm Trusted Publishers are configured per existing package. A brand-new package cannot complete its first publication through OIDC alone because its npm settings do not exist yet.
- Bootstrap a new package once from an owner-controlled machine using interactive/web npm authentication and an isolated temporary user config. Never store that credential in this repository or in GitHub Secrets.
- Use a minimal `0.0.0` placeholder and publish it with the `bootstrap` dist-tag. npm may still create `latest: 0.0.0` for the first version; treat that as temporary and verify the real release replaces `latest`.
- After bootstrap, configure the package's npm Trusted Publisher for GitHub Actions with repository `kestiny18/dsh-plugins`, workflow filename `publish.yml`, environment `npm`, and only the required publish action.
- Publish the first real version only through the existing GitHub Release workflow. Completion requires a successful publish job and an npm registry check showing the intended version and `latest` dist-tag.
- After the real release is verified, deprecate the `0.0.0` placeholder and remove the `bootstrap` dist-tag when practical.

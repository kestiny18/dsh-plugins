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

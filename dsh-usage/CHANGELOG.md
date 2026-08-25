# Changelog

All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.5] - 2026-08-26

### Added

- Add a Simplified Chinese product README, Usage and Community screenshots, and focused installation, accounting, and pricing guides.

### Changed

- Streamline the default GitHub/npm README around product value, one recommended install path, privacy boundaries, and advanced-documentation links.
- Pin public npx installation examples to the verified pnpm 11.9.0 baseline instead of pnpm 11.7.0.
- Use a user-facing npm package description focused on the Usage dashboard and estimated cost.

## [0.2.4] - 2026-08-24

### Fixed

- Derive the Community protocol's plugin version from the installed package metadata instead of a release-specific string literal.

## [0.2.3] - 2026-08-24

### Added

- Add a Settings -> Usage sign-out action that revokes the current installation credential, clears its local GitHub identity, and disables Community Sync without deleting accepted Community data.

### Changed

- Open GitHub OAuth directly from the Connect GitHub action, while retaining the post-authentication device confirmation step.

## [0.2.2] - 2026-08-24

### Fixed

- Rewrite persisted Community profile links to the configured Community origin so users upgrading from 0.2.0 no longer see the legacy `workers.dev` profile URL.
- Report the current plugin version in Community aggregate snapshots.

## [0.2.1] - 2026-08-23

### Added

- A direct `dshcommunity.com` link in Settings -> Usage so the public leaderboard and setup guide are discoverable.
- Chinese and English Community settings copy selected from the host browser locale.
- A truthful unavailable state and Retry action when the local Community RPC cannot be reached.

### Changed

- The default Community Web and API origin is now `https://dshcommunity.com`.

## [0.2.0] - 2026-08-21

### Added

- Optional GitHub device linking and Community Sync controls on Settings → Usage.
- Fork-safe Host snapshots that subtract inherited seed events while retaining every child Agent's new provider-reported token usage.
- Versioned absolute aggregate uploads with stable retry revisions and SHA-256 snapshot digests.
- Local model taxonomy normalization that collapses unknown or private routes to `other` before network transmission.

### Changed

- Updated Harness peer packages to the `0.1.0-rc.6` service and RPC contracts.
- Community Sync defaults to off and remains failure-isolated from all local Usage features.

## [0.1.1] - 2026-08-14

### Added

- GitHub Actions CI for Node.js 22 and 24.
- npm Trusted Publishing workflow with provenance.
- Release verification and repository-metadata synchronization scripts.
- Repository contribution, security, license, and dependency-update configuration.

### Changed

- Reworked installation documentation to remove machine-specific paths.
- Added a user-focused quick start, upgrade instructions, troubleshooting, and copy-and-paste npx commands that do not require a globally installed `dsh` or pnpm.
- Raised the supported Node.js 22 baseline to 22.18 to match the build toolchain.
- Organized `dsh-usage` as an independently published package in the `dsh-plugins` monorepo.

## [0.1.0] - 2026-08-14

### Added

- Replay-derived token and estimated-cost accounting for Harness sessions.
- Compact per-turn usage metrics in the Web conversation footer.
- Settings Usage page with model/session breakdowns and a 52-week activity heatmap.

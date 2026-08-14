# Changelog

All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-08-14

### Added

- GitHub Actions CI for Node.js 22 and 24.
- npm Trusted Publishing workflow with provenance.
- Release verification and repository-metadata synchronization scripts.
- Repository contribution, security, license, and dependency-update configuration.

### Changed

- Reworked installation documentation to remove machine-specific paths.
- Added copy-and-paste npx installation commands that do not require a globally installed `dsh` or pnpm.
- Organized `dsh-usage` as an independently published package in the `dsh-plugins` monorepo.

## [0.1.0] - 2026-08-14

### Added

- Replay-derived token and estimated-cost accounting for Harness sessions.
- Compact per-turn usage metrics in the Web conversation footer.
- Settings Usage page with model/session breakdowns and a 52-week activity heatmap.

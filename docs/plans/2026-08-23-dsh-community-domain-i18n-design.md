# DSH Community custom domain and bilingual V1.1

## Decisions

- `https://dshcommunity.com` is the canonical Web and API origin.
- The existing `workers.dev` origin remains enabled for compatibility with `dsh-usage@0.2.0`.
- GitHub OAuth accepts callbacks from both origins during the migration.
- The Community Web app defaults to Chinese for Chinese browser locales, otherwise English, with a persistent header switch.
- The public home page remains readable without login and adds a three-step install, connect, and sync guide.
- `dsh-usage@0.2.1` uses the custom domain by default and always shows a direct Community website link in Settings -> Usage.
- A failed local Community RPC is shown as an unavailable state with Retry; it is never mislabeled as Private.

## Release boundary

No database schema, upload protocol, aggregate semantics, or deletion behavior changes in this release. The change is limited to origin migration, discoverability, localization, and truthful client status handling.

# dsh-community

Public DSH aggregate-usage leaderboard and GitHub-linked profile application. It is a private workspace app, not an npm package.

Production origin: [https://dshcommunity.com](https://dshcommunity.com). The `workers.dev` origin remains available as a compatibility endpoint for older plugin clients.

## V1 behavior

- `/` is public and defaults to the rolling 7-day UTC leaderboard.
- `/u/:githubLogin` is public after that user completes a successful non-zero sync.
- GitHub login personalizes the board and provides a fixed **Your standing** panel; login alone never starts uploading.
- Plugin device linking enters GitHub OAuth directly, then returns to the explicit device confirmation page.
- Signing out from the plugin revokes only that installation's credential and preserves its accepted aggregate rows.
- Device/day and device/provider/model keys use absolute replacement semantics. A matching revision and digest is idempotent, a matching revision with another digest conflicts, and older revisions are rejected.
- After a newer revision is accepted, day/model keys omitted from that device's complete snapshot are removed in the same D1 transaction. This protocol replacement is separate from a user-facing delete/Leave flow, which V1 does not provide.
- Rankings are explicitly self-reported. Cost, prompts, responses, session metadata, and private model routes are not accepted.

## Local setup (PowerShell)

From the repository root:

```powershell
Copy-Item apps/dsh-community/.dev.vars.example apps/dsh-community/.dev.vars
# Fill in GitHub OAuth credentials and a 32+ character SESSION_SECRET.
pnpm install --frozen-lockfile
pnpm --filter dsh-community run build
pnpm --filter dsh-community run db:migrate:local
pnpm --filter dsh-community exec wrangler dev
```

For UI hot reload in a second terminal:

```powershell
pnpm --filter dsh-community run dev
```

Create a GitHub OAuth App with:

- Application name: `DSH Community`.
- Homepage URL: the value of `BASE_URL` (`https://dshcommunity.com` in production).
- Application description: `Optional public aggregate Token usage for DeepSeek Harness. Reads public GitHub profile identity only; connecting does not enable data sync.`
- Authorization callback URL: `<BASE_URL>/auth/github/callback`.
- Device Flow: disabled.

The Worker uses OAuth state and PKCE, requests no additional OAuth scopes, stores only the short-lived attempt, fetches the public GitHub identity server-side, and does not retain the GitHub access token.

## Cloudflare deployment

1. The checked-in configuration targets the current `dsh-community` D1 deployment. For another Cloudflare account, create a database and replace its `database_id` in `wrangler.jsonc`.
2. Set `BASE_URL` to the final HTTPS origin.
3. Add Worker secrets:

```powershell
pnpm --filter dsh-community exec wrangler secret put GITHUB_CLIENT_ID
pnpm --filter dsh-community exec wrangler secret put GITHUB_CLIENT_SECRET
pnpm --filter dsh-community exec wrangler secret put SESSION_SECRET
```

4. Apply and deploy:

```powershell
pnpm --filter dsh-community run db:migrate:remote
pnpm --filter dsh-community run deploy
```

Cloudflare serves the Vite SPA assets and runs the Worker first for `/api/*` and `/auth/*`. D1 migrations are committed in `migrations/` and must be applied before the corresponding Worker release.

## Verification

```powershell
pnpm --filter dsh-community run check
pnpm --filter dsh-community run release:check
```

`.dev.vars`, Wrangler local state, build output, and credentials are ignored by Git.

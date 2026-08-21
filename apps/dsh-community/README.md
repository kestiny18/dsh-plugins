# dsh-community

Public DSH aggregate-usage leaderboard and GitHub-linked profile application. It is a private workspace app, not an npm package.

## V1 behavior

- `/` is public and defaults to the rolling 7-day UTC leaderboard.
- `/u/:githubLogin` is public after that user completes a successful non-zero sync.
- GitHub login personalizes the board and provides a fixed **Your standing** panel; login alone never starts uploading.
- Device/day and device/provider/model keys use absolute upsert semantics. A matching revision and digest is idempotent, a matching revision with another digest conflicts, and older revisions are rejected.
- Omitted keys are retained in V1. There is no remote delete/Leave flow yet.
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

- Homepage URL: the value of `BASE_URL`.
- Authorization callback URL: `<BASE_URL>/auth/github/callback`.

The Worker uses OAuth state and PKCE, stores only the short-lived attempt, fetches the GitHub identity server-side, and does not retain the GitHub access token.

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

import { fileURLToPath } from 'node:url'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

const packageRoot = fileURLToPath(new URL('.', import.meta.url))
const migrations = await readD1Migrations(fileURLToPath(new URL('./migrations', import.meta.url)))

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: `${packageRoot}wrangler.jsonc` },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          SESSION_SECRET: 'test-session-secret-at-least-thirty-two-characters',
          GITHUB_CLIENT_ID: 'test-github-client-id',
          GITHUB_CLIENT_SECRET: 'test-github-client-secret',
        },
      },
    }),
  ],
  test: {
    setupFiles: ['./tests/apply-migrations.ts'],
  },
})

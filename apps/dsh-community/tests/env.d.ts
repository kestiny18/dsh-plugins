import type { D1Migration } from '@cloudflare/vitest-plugin'
import type { Env as WorkerEnv } from '../src/worker/index.js'

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[]
    }
  }
}

export {}

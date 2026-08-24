import { createRequire } from 'node:module'

const manifest = createRequire(import.meta.url)('../package.json') as { version?: unknown }
if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(manifest.version)) {
  throw new Error('dsh-usage: package.json contains an invalid plugin version')
}

/** Installed package version used by the Community protocol. */
export const pluginVersion = manifest.version

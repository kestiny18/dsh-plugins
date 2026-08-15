/** Fail-closed canonical tool-output tokenization for DeepSeek Harness. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-tools'
import { installRedactionPolicy } from './plugin.js'

export type * from './types.js'
export type * from './redaction.js'
export type * from './plugin.js'
export { redactSensitiveValue } from './redaction.js'
export { SecretVault, TOKEN_PATTERN } from './vault.js'
export { installRedactionPolicy, RedactionPolicy } from './plugin.js'

export const name = 'redact'
export const inject = ['tools']

export function apply(ctx: Context): void {
  installRedactionPolicy(ctx)
}

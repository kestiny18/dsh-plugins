/** Browser half: per-turn token usage in the finalized assistant footer. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { TurnUsage } from './TurnUsage.js'
import { UsageSection } from './UsageSection.js'

export { displayUsage, formatTokenCount, turnForMessage, usageForMessage } from './turn-usage.js'
export type { TurnUsageDisplay } from './turn-usage.js'

export const inject = ['slots']

/** Register the always-visible turn usage entry. */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'dsh-usage-turn',
    order: 20,
  }, TurnUsage))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'usage',
    order: 20,
    label: 'Usage',
  }, UsageSection))
}

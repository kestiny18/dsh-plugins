import type { RedactionCategory } from './redaction.js'

/** Durable audit payload. It intentionally cannot carry values, tokens, or tool arguments. */
export interface RedactionAppliedEventData {
  count: number
  categories: RedactionCategory[]
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    'redaction/applied': RedactionAppliedEventData
  }
}

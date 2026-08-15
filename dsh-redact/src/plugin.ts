import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock, UserMessage } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import type {
  PostToolDecision,
  ToolExecution,
  ToolExecutionResult,
} from '@deepseek-ai/dsh-tools'
import {
  redactSensitiveValue,
  type RedactionCategory,
  type RedactionResult,
} from './redaction.js'
import type { RedactionAppliedEventData } from './types.js'
import { SecretVault } from './vault.js'

export type RedactFunction = (value: JsonValue, vault: SecretVault) => RedactionResult

export interface RedactionPolicyOptions {
  createVault?: () => SecretVault
  redact?: RedactFunction
}

interface RedactionSummary {
  count: number
  readonly categories: Set<RedactionCategory>
}

const FAILURE_TEXT = 'Error: dsh-redact blocked tool output because sanitization failed.'
const CONTEXT_FAILURE_TEXT = 'Error: dsh-redact blocked tool output because a tool context could not be replaced safely.'

/** Stateful post-execute policy with one memory-only vault per live Agent. */
export class RedactionPolicy {
  readonly #vaults = new WeakMap<Agent, SecretVault>()
  readonly #createVault: () => SecretVault
  readonly redact: RedactFunction

  constructor(options: RedactionPolicyOptions = {}) {
    this.#createVault = options.createVault ?? (() => new SecretVault())
    this.redact = options.redact ?? redactSensitiveValue
  }

  /** Wrap the remaining post-execute chain and sanitize its effective final decision. */
  async postExecute(
    exec: ToolExecution,
    result: Readonly<ToolExecutionResult>,
    next: () => Promise<PostToolDecision>,
  ): Promise<PostToolDecision> {
    try {
      const downstream = await next()
      const vault = exec.agent === undefined ? this.#createVault() : this.#vaultFor(exec.agent)
      const summary: RedactionSummary = { count: 0, categories: new Set() }
      const decision = this.#sanitizeDecision(result, downstream, vault, summary)
      this.#record(exec.agent, summary)
      return decision
    } catch {
      return failClosed(FAILURE_TEXT)
    }
  }

  /** Trusted, in-memory-only primitive for a future presentation boundary. */
  restore(agent: Agent, text: string): string {
    return this.#vaults.get(agent)?.restore(text) ?? text
  }

  /** Eagerly destroy the mapping when an Agent leaves the live registry. */
  disposeAgent(agent: Agent): void {
    const vault = this.#vaults.get(agent)
    vault?.clear()
    this.#vaults.delete(agent)
  }

  #sanitizeDecision(
    result: Readonly<ToolExecutionResult>,
    decision: PostToolDecision,
    vault: SecretVault,
    summary: RedactionSummary,
  ): PostToolDecision {
    const decisionContexts = this.#sanitizeMessages(
      decision.additionalContexts ?? [],
      vault,
      summary,
    )

    if (decision.kind === 'block') {
      const feedback = this.#sanitizeContent(decision.feedback, vault, summary)
      return {
        kind: 'block',
        feedback,
        ...(decisionContexts.length > 0 ? { additionalContexts: decisionContexts } : {}),
      }
    }

    if (result.isError) {
      if (Object.hasOwn(decision, 'value')) throw new TypeError('failed result cannot accept a value')
      const content = this.#sanitizeContent(
        decision.content ?? result.content,
        vault,
        summary,
      )
      const beforeHiddenFields = summary.count
      this.#sanitize(result.error as unknown as JsonValue, vault, summary)
      if (result.meta !== undefined) this.#sanitize(result.meta, vault, summary)
      const originalContexts = this.#sanitizeMessages(
        result.additionalContexts ?? [],
        vault,
        summary,
      )
      if (summary.count !== beforeHiddenFields) {
        return {
          kind: 'block',
          feedback: content,
          ...(originalContexts.length + decisionContexts.length > 0
            ? { additionalContexts: [...originalContexts, ...decisionContexts] }
            : {}),
        }
      }
      return {
        kind: 'accept',
        content,
        ...(decisionContexts.length > 0 ? { additionalContexts: decisionContexts } : {}),
      }
    }

    const sourceValue = Object.hasOwn(decision, 'value')
      ? (decision as { value: JsonValue }).value
      : result.value
    const value = this.#sanitize(sourceValue, vault, summary)

    const originalContexts = result.additionalContexts ?? []
    const beforeContexts = summary.count
    const sanitizedOriginalContexts = this.#sanitizeMessages(originalContexts, vault, summary)
    if (summary.count !== beforeContexts) {
      return {
        kind: 'block',
        feedback: [{ type: 'text', text: CONTEXT_FAILURE_TEXT }],
        additionalContexts: [...sanitizedOriginalContexts, ...decisionContexts],
      }
    }

    return {
      kind: 'accept',
      value,
      ...(decisionContexts.length > 0 ? { additionalContexts: decisionContexts } : {}),
    }
  }

  #sanitize(value: JsonValue, vault: SecretVault, summary: RedactionSummary): JsonValue {
    const redacted = this.redact(value, vault)
    summary.count += redacted.count
    for (const category of redacted.categories) summary.categories.add(category)
    return redacted.value
  }

  #sanitizeContent(
    content: readonly ContentBlock[],
    vault: SecretVault,
    summary: RedactionSummary,
  ): ContentBlock[] {
    return this.#sanitize(content as unknown as JsonValue, vault, summary) as unknown as ContentBlock[]
  }

  #sanitizeMessages(
    messages: readonly UserMessage[],
    vault: SecretVault,
    summary: RedactionSummary,
  ): UserMessage[] {
    return messages.map(message => (
      this.#sanitize(message as unknown as JsonValue, vault, summary) as unknown as UserMessage
    ))
  }

  #record(agent: Agent | undefined, summary: RedactionSummary): void {
    if (agent === undefined || summary.count === 0) return
    const event: RedactionAppliedEventData = {
      count: summary.count,
      categories: [...summary.categories].sort(),
    }
    agent.session.append('redaction/applied', event)
  }

  #vaultFor(agent: Agent): SecretVault {
    const existing = this.#vaults.get(agent)
    if (existing !== undefined) return existing
    const vault = this.#createVault()
    this.#vaults.set(agent, vault)
    return vault
  }
}

function failClosed(text: string): PostToolDecision {
  return {
    kind: 'block',
    feedback: [{ type: 'text', text }],
  }
}

/** Install canonical output tokenization and Agent-scoped vault cleanup. */
export function installRedactionPolicy(ctx: Context, policy = new RedactionPolicy()): void {
  ctx.on(
    'tools/post-execute',
    (exec, result, next) => policy.postExecute(exec, result, next),
    { prepend: true },
  )
  ctx.on('agent/disposed', ({ agent }) => policy.disposeAgent(agent))
}

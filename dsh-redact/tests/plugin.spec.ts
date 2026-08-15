import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {
  PostToolDecision,
  ToolExecution,
  ToolExecutionResult,
} from '@deepseek-ai/dsh-tools'
import { apply, inject, RedactionPolicy } from '../src/index.js'
import { redactSensitiveValue } from '../src/redaction.js'
import { SecretVault } from '../src/vault.js'

function fakeAgent(append = vi.fn()): Agent {
  return { session: { append } } as unknown as Agent
}

function execution(agent?: Agent): ToolExecution {
  return {
    name: 'fixture',
    agent,
    callId: 'call-1',
    rootCallId: 'call-1',
    arguments: {},
    signal: new AbortController().signal,
    token: Symbol('tool-execution'),
  } as unknown as ToolExecution
}

function success(value: ToolExecutionResult extends infer _T ? unknown : never): ToolExecutionResult {
  return {
    isError: false,
    value,
    content: [{ type: 'text', text: JSON.stringify(value) }],
  } as ToolExecutionResult
}

function deterministicPolicy(): RedactionPolicy {
  let id = 0
  return new RedactionPolicy({
    createVault: () => new SecretVault(
      () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    ),
  })
}

describe('RedactionPolicy', () => {
  it('replaces the final downstream canonical value and appends a private audit event', async () => {
    const append = vi.fn()
    const agent = fakeAgent(append)
    const policy = deterministicPolicy()
    const next = vi.fn<() => Promise<PostToolDecision>>().mockResolvedValue({
      kind: 'accept',
      value: { password: 'FAKE_DOWNSTREAM_PASSWORD', normal: 'visible' },
    })

    const decision = await policy.postExecute(
      execution(agent),
      success({ password: 'FAKE_BODY_PASSWORD' }),
      next,
    )

    expect(next).toHaveBeenCalledOnce()
    expect(decision.kind).toBe('accept')
    expect(JSON.stringify(decision)).not.toContain('FAKE_')
    expect(decision).toMatchObject({ kind: 'accept', value: { normal: 'visible' } })
    expect(append).toHaveBeenCalledOnce()
    expect(append).toHaveBeenCalledWith('redaction/applied', {
      count: 1,
      categories: ['password'],
    })
    expect(Object.keys(append.mock.calls[0]![1])).toEqual(['count', 'categories'])
  })

  it('sanitizes failed and blocked content without returning a success value', async () => {
    const agent = fakeAgent()
    const policy = deterministicPolicy()
    const result = {
      isError: true,
      error: { message: 'password=FAKE_ERROR_PASSWORD' },
      content: [{ type: 'text', text: 'password=FAKE_ERROR_PASSWORD' }],
    } as ToolExecutionResult

    const failed = await policy.postExecute(
      execution(agent),
      result,
      async () => ({ kind: 'accept' }),
    )
    const blocked = await policy.postExecute(
      execution(agent),
      result,
      async () => ({
        kind: 'block',
        feedback: [{ type: 'text', text: 'token=FAKE_BLOCK_TOKEN' }],
      }),
    )

    expect(failed.kind).toBe('block')
    expect(JSON.stringify(failed)).not.toContain('FAKE_ERROR_PASSWORD')
    expect(blocked.kind).toBe('block')
    expect(JSON.stringify(blocked)).not.toContain('FAKE_BLOCK_TOKEN')
  })

  it('blocks rather than retaining a raw tool-deferred context that needed redaction', async () => {
    const agent = fakeAgent()
    const policy = deterministicPolicy()
    const result = {
      ...success({ normal: 'visible' }),
      additionalContexts: [{
        id: 'message-1',
        role: 'user',
        content: [{ type: 'text', text: 'password=FAKE_CONTEXT_PASSWORD' }],
        source: { kind: 'plugin', plugin: 'fixture' },
      }],
    } as ToolExecutionResult

    const decision = await policy.postExecute(
      execution(agent),
      result,
      async () => ({ kind: 'accept' }),
    )

    expect(decision.kind).toBe('block')
    expect(JSON.stringify(decision)).not.toContain('FAKE_CONTEXT_PASSWORD')
    expect(decision).toMatchObject({
      additionalContexts: [{ content: [{ type: 'text' }] }],
    })
  })

  it('fails closed with constant feedback when the sanitizer throws', async () => {
    const policy = new RedactionPolicy({
      redact: () => { throw new Error('FAKE_SECRET_FROM_REDACTOR') },
    })

    const decision = await policy.postExecute(
      execution(fakeAgent()),
      success({ password: 'FAKE_BODY_PASSWORD' }),
      async () => ({ kind: 'accept' }),
    )

    expect(decision).toEqual({
      kind: 'block',
      feedback: [{
        type: 'text',
        text: 'Error: dsh-redact blocked tool output because sanitization failed.',
      }],
    })
    expect(JSON.stringify(decision)).not.toContain('FAKE_')
  })

  it('fails closed when the privacy-minimal audit event cannot be appended', async () => {
    const append = vi.fn(() => { throw new Error('FAKE_SECRET_FROM_APPEND') })
    const policy = deterministicPolicy()

    const decision = await policy.postExecute(
      execution(fakeAgent(append)),
      success({ password: 'FAKE_BODY_PASSWORD' }),
      async () => ({ kind: 'accept' }),
    )

    expect(decision).toEqual({
      kind: 'block',
      feedback: [{ type: 'text', text: 'Error: dsh-redact blocked tool output because sanitization failed.' }],
    })
    expect(JSON.stringify(decision)).not.toContain('FAKE_')
  })

  it('clears the Agent vault on disposal', async () => {
    const agent = fakeAgent()
    const policy = deterministicPolicy()
    const decision = await policy.postExecute(
      execution(agent),
      success({ password: 'FAKE_PASSWORD' }),
      async () => ({ kind: 'accept' }),
    )
    const tokenized = JSON.stringify(decision)

    expect(policy.restore(agent, tokenized)).toContain('FAKE_PASSWORD')
    policy.disposeAgent(agent)
    expect(policy.restore(agent, tokenized)).toBe(tokenized)
  })
})

describe('plugin registration', () => {
  it('prepends the post-execute policy and registers Agent cleanup', () => {
    const on = vi.fn()
    apply({ on } as unknown as Context)

    expect(inject).toEqual(['tools'])
    expect(on).toHaveBeenCalledWith('tools/post-execute', expect.any(Function), { prepend: true })
    expect(on).toHaveBeenCalledWith('agent/disposed', expect.any(Function))
  })

  it('uses the production redactor by default', () => {
    const policy = new RedactionPolicy()
    expect(policy.redact).toBe(redactSensitiveValue)
  })
})

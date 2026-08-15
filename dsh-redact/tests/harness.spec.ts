import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import { apply } from '../src/index.js'

describe('Harness output-schema integration', () => {
  it('lets ToolRuntime reject a schema-incompatible canonical replacement', async () => {
    const ctx = new Context()
    ctx.provide('systemPrompt', {
      tools: () => undefined,
      section: () => undefined,
    })
    const tools = new ToolRuntime(ctx)
    apply(ctx)
    tools.register(defineTool({
      name: 'numeric_password',
      description: 'Return a numeric fixture.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          properties: { password: { type: 'number', required: true } },
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      },
      async execute() {
        return { password: 12345 }
      },
    }))

    const result = await tools.execute({
      callId: CallId('call-1'),
      name: 'numeric_password',
      arguments: {},
      signal: new AbortController().signal,
    })

    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: expect.stringContaining('value.password') }])
    expect(JSON.stringify(result)).not.toContain('12345')
  })

  it('drops the original structured failure when its error message contains a secret', async () => {
    const ctx = new Context()
    ctx.provide('systemPrompt', {
      tools: () => undefined,
      section: () => undefined,
    })
    const tools = new ToolRuntime(ctx)
    apply(ctx)
    tools.register(defineTool({
      name: 'secret_failure',
      description: 'Throw a fixture error.',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute() {
        throw new Error('password=FAKE_FAILURE_PASSWORD')
      },
    }))

    const result = await tools.execute({
      callId: CallId('call-2'),
      name: 'secret_failure',
      arguments: {},
      signal: new AbortController().signal,
    })

    expect(result.isError).toBe(true)
    expect(JSON.stringify(result)).not.toContain('FAKE_FAILURE_PASSWORD')
    expect(result.content[0]).toMatchObject({ type: 'text' })
  })
})

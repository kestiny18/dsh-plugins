import { describe, expect, it } from 'vitest'
import { redactSensitiveValue } from '../src/redaction.js'
import { SecretVault, TOKEN_PATTERN } from '../src/vault.js'

function vault(): SecretVault {
  let id = 0
  return new SecretVault(() => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`)
}

describe('redactSensitiveValue', () => {
  it('recursively tokenizes sensitive structured fields and preserves ordinary values', () => {
    const secrets = vault()
    const input = {
      password: 'FAKE_PASSWORD',
      appSecret: 'FAKE_APP_SECRET',
      access_token: 'FAKE_ACCESS_TOKEN',
      authorization: 'Bearer FAKE_AUTH',
      robotUrl: 'https://example.invalid/hook/FAKE_WEBHOOK',
      private_key: 'FAKE_PRIVATE_KEY',
      nested: [{ api_key: 'FAKE_API_KEY', visible: true }],
      normal: 'visible',
    }

    const result = redactSensitiveValue(input, secrets)
    const output = result.value as Record<string, unknown>

    expect(result.count).toBe(7)
    expect(result.categories).toEqual([
      'authorization', 'password', 'private-key', 'secret', 'token', 'webhook',
    ])
    expect(output.normal).toBe('visible')
    expect(JSON.stringify(output)).not.toContain('FAKE_')
    expect(TOKEN_PATTERN.test(output.password as string)).toBe(true)
    expect(secrets.restore(JSON.stringify(output))).toContain('FAKE_PASSWORD')
  })

  it('tokenizes text credentials, authorization headers, URL query values, and PEM bodies', () => {
    const secrets = vault()
    const input = [
      'password=FAKE_PASSWORD',
      'Authorization: Bearer FAKE_BEARER',
      'https://example.invalid/run?token=FAKE_TOKEN&safe=yes&signature=FAKE_SIGNATURE',
      '-----BEGIN PRIVATE KEY-----\nFAKE_PEM_BODY\n-----END PRIVATE KEY-----',
      'normal.value=visible',
    ].join('\n')

    const result = redactSensitiveValue(input, secrets)
    const output = result.value as string

    expect(result.count).toBe(5)
    expect(result.categories).toEqual([
      'authorization', 'password', 'private-key', 'url-query',
    ])
    expect(output).not.toContain('FAKE_')
    expect(output).toContain('normal.value=visible')
    expect(output).toContain('-----BEGIN PRIVATE KEY-----')
    expect(output).toContain('-----END PRIVATE KEY-----')
    expect(secrets.restore(output)).toBe(input)
  })

  it('recursively parses JSON-encoded strings and keeps every JSON layer valid', () => {
    const secrets = vault()
    const inner = JSON.stringify({ password: 'FAKE_PASSWORD', normal: 'visible' })
    const encodedTwice = JSON.stringify(inner)
    const input = JSON.stringify({ payload: encodedTwice, token: 'FAKE_OUTER_TOKEN' })

    const result = redactSensitiveValue(input, secrets)
    const outer = JSON.parse(result.value as string) as { payload: string; token: string }
    const once = JSON.parse(outer.payload) as string
    const twice = JSON.parse(once) as { password: string; normal: string }

    expect(result.count).toBe(2)
    expect(TOKEN_PATTERN.test(outer.token)).toBe(true)
    expect(TOKEN_PATTERN.test(twice.password)).toBe(true)
    expect(twice.normal).toBe('visible')
    expect(secrets.restore(result.value as string)).toContain('FAKE_PASSWORD')
  })

  it('fails instead of passing through JSON strings beyond the parsing bound', () => {
    const secrets = vault()
    let input = JSON.stringify({ password: 'FAKE_DEEP_PASSWORD' })
    for (let index = 0; index < 8; index += 1) input = JSON.stringify(input)

    expect(() => redactSensitiveValue(input, secrets)).toThrow(
      'JSON string encoding exceeds 8 layers',
    )
  })

  it('preserves type annotations, declarations, env reads, and function calls', () => {
    const secrets = vault()
    const input = [
      'const access_token: string = ...',
      'password = input()',
      'token: TokenType',
      'api_key = os.getenv("API_KEY")',
      'actual_token=FAKE_ACTUAL_TOKEN',
    ].join('\n')

    const result = redactSensitiveValue(input, secrets)
    const output = result.value as string

    expect(output).toContain('const access_token: string = ...')
    expect(output).toContain('password = input()')
    expect(output).toContain('token: TokenType')
    expect(output).toContain('api_key = os.getenv("API_KEY")')
    expect(output).not.toContain('FAKE_ACTUAL_TOKEN')
    expect(result.count).toBe(1)
  })

  it('keeps an existing vault token stable instead of tokenizing it again', () => {
    const secrets = vault()
    const token = secrets.tokenize('FAKE_SECRET')

    const result = redactSensitiveValue({ password: token }, secrets)

    expect(result).toEqual({ value: { password: token }, count: 0, categories: [] })
    expect(secrets.size).toBe(1)
  })
})

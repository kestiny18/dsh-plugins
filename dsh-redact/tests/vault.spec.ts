import { describe, expect, it } from 'vitest'
import { SecretVault, TOKEN_PATTERN } from '../src/vault.js'

const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
]

describe('SecretVault', () => {
  it('creates stable, prefixed, unique tokens and restores exact matches', () => {
    let index = 0
    const vault = new SecretVault(() => IDS[index++]!)

    const first = vault.tokenize('FAKE_SECRET_ONE')
    const repeated = vault.tokenize('FAKE_SECRET_ONE')
    const second = vault.tokenize('FAKE_SECRET_TWO')

    expect(first).toBe('⟦dsh:redact:00000000-0000-4000-8000-000000000001⟧')
    expect(repeated).toBe(first)
    expect(second).not.toBe(first)
    expect(TOKEN_PATTERN.test(first)).toBe(true)
    expect(vault.restore(`one=${first}; two=${second}`)).toBe(
      'one=FAKE_SECRET_ONE; two=FAKE_SECRET_TWO',
    )
  })

  it('does not treat unknown token-looking text as a known token', () => {
    const vault = new SecretVault(() => IDS[0]!)
    const unknown = '⟦dsh:redact:00000000-0000-4000-8000-999999999999⟧'

    expect(vault.hasToken(unknown)).toBe(false)
    expect(vault.restore(unknown)).toBe(unknown)
  })

  it('forgets both directions on clear', () => {
    const vault = new SecretVault(() => IDS[0]!)
    const token = vault.tokenize('FAKE_SECRET')

    vault.clear()

    expect(vault.size).toBe(0)
    expect(vault.hasToken(token)).toBe(false)
    expect(vault.restore(token)).toBe(token)
  })
})

import { randomUUID } from 'node:crypto'

const TOKEN_SOURCE = String.raw`⟦dsh:redact:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}⟧`

/** Recognizes one complete dsh-redact token without accepting an arbitrary UUID. */
export const TOKEN_PATTERN = new RegExp(`^${TOKEN_SOURCE}$`, 'i')
const TOKENS_IN_TEXT = new RegExp(TOKEN_SOURCE, 'gi')

export type TokenFactory = () => string

/** Agent-scoped, memory-only bidirectional mapping between secrets and opaque tokens. */
export class SecretVault {
  readonly #secretToToken = new Map<string, string>()
  readonly #tokenToSecret = new Map<string, string>()

  constructor(private readonly createId: TokenFactory = randomUUID) {}

  get size(): number {
    return this.#tokenToSecret.size
  }

  /** Return a stable token for this vault without persisting the original value. */
  tokenize(secret: string): string {
    const existing = this.#secretToToken.get(secret)
    if (existing !== undefined) return existing

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const token = `⟦dsh:redact:${this.createId()}⟧`
      if (!TOKEN_PATTERN.test(token)) {
        throw new TypeError('dsh-redact token factory returned an invalid UUID')
      }
      if (this.#tokenToSecret.has(token)) continue
      this.#secretToToken.set(secret, token)
      this.#tokenToSecret.set(token, secret)
      return token
    }

    throw new Error('dsh-redact token factory could not produce a unique token')
  }

  /** Whether an exact token belongs to this live vault. */
  hasToken(token: string): boolean {
    return this.#tokenToSecret.has(token)
  }

  /** Restore only exact tokens owned by this vault; unknown token-looking text remains unchanged. */
  restore(text: string): string {
    return text.replace(TOKENS_IN_TEXT, token => this.#tokenToSecret.get(token) ?? token)
  }

  /** Destroy both mapping directions at the end of the owning Agent lifecycle. */
  clear(): void {
    this.#secretToToken.clear()
    this.#tokenToSecret.clear()
  }
}

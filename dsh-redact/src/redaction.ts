import type { JsonValue } from '@deepseek-ai/dsh-session'
import type { SecretVault } from './vault.js'

export type RedactionCategory =
  | 'authorization'
  | 'password'
  | 'private-key'
  | 'secret'
  | 'token'
  | 'url-query'
  | 'webhook'

export interface RedactionResult {
  value: JsonValue
  count: number
  categories: RedactionCategory[]
}

interface RedactionState {
  readonly vault: SecretVault
  count: number
  readonly categories: Set<RedactionCategory>
}

const PEM_PRIVATE_RE = /-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/g
const AUTH_RE = /^(\s*authorization\s*:\s*(?:bearer|basic)\s+)(\S+)/gim
const URL_QUERY_RE = /([?&])(?:key|token|access_token|secret|password|signature)=([^&\s"']+)/gi
const KEY_VALUE_RE = /^(\s*(?:Error:\s*)?([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|secretkey|appsecret|token|accesstoken|access_token|apikey|api_key|appkey|accesskey|access_key|privatekey|private_key|webhook|roboturl|authorization|signature)[A-Za-z0-9_.-]*)\s*[:=]\s*)([^\r\n#]+)/gim
const JSON_VALUE_RE = /("([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|secretkey|appsecret|token|accesstoken|access_token|apikey|api_key|appkey|accesskey|access_key|privatekey|private_key|webhook|roboturl|authorization|signature)[A-Za-z0-9_.-]*)"\s*:\s*)("(?:[^"\\]|\\.)*"|[^,\r\n}]+)/gi
const MAX_JSON_ENCODING_LAYERS = 8

/** Tokenize sensitive JSON data and text while preserving JSON-safe structure. */
export function redactSensitiveValue(value: JsonValue, vault: SecretVault): RedactionResult {
  const state: RedactionState = { vault, count: 0, categories: new Set() }
  const redacted = redactValue(value, state)
  return {
    value: redacted,
    count: state.count,
    categories: [...state.categories].sort(),
  }
}

function redactValue(value: JsonValue, state: RedactionState): JsonValue {
  if (Array.isArray(value)) return value.map(item => redactValue(item, state))
  if (value !== null && typeof value === 'object') {
    const output: Record<string, JsonValue> = {}
    for (const [key, item] of Object.entries(value)) {
      const category = sensitiveKeyCategory(key)
      output[key] = category === undefined
        ? redactValue(item, state)
        : redactSensitiveField(item, category, state)
    }
    return output
  }
  if (typeof value === 'string') return redactString(value, state)
  return value
}

function redactSensitiveField(
  value: JsonValue,
  category: RedactionCategory,
  state: RedactionState,
): JsonValue {
  if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
    return redactValue(value, state)
  }
  if (value === null) return null
  if (typeof value === 'string') {
    if (state.vault.hasToken(value) || looksLikeCodeReference(value)) return value
    return replacement(value, category, state)
  }
  return replacement(JSON.stringify(value), category, state)
}

function redactString(text: string, state: RedactionState): string {
  if (text.length === 0 || state.vault.hasToken(text)) return text

  const encodedJson = redactJsonEncodedString(text, state)
  if (encodedJson !== undefined) return encodedJson

  let redacted = text.replace(
    PEM_PRIVATE_RE,
    (match, label: string, body: string) => {
      if (body.length === 0) return match
      return `-----BEGIN ${label}-----${replacement(body, 'private-key', state)}-----END ${label}-----`
    },
  )

  redacted = redacted.replace(AUTH_RE, (match, prefix: string, secret: string) => {
    if (state.vault.hasToken(secret)) return match
    return prefix + replacement(secret, 'authorization', state)
  })

  redacted = redacted.replace(URL_QUERY_RE, (match, separator: string, secret: string) => {
    if (state.vault.hasToken(secret)) return match
    const equals = match.indexOf('=')
    const name = match.slice(separator.length, equals)
    return `${separator}${name}=${replacement(secret, 'url-query', state)}`
  })

  redacted = redacted.replace(
    KEY_VALUE_RE,
    (match, prefix: string, key: string, raw: string) => {
      const secret = raw.trim()
      if (state.vault.hasToken(secret) || looksLikeCodeReference(secret)) return match
      const category = sensitiveKeyCategory(key)
      if (category === undefined) return match
      if (category === 'authorization') {
        const credential = /^(?:bearer|basic)\s+(\S+)$/i.exec(secret)?.[1]
        if (credential !== undefined && state.vault.hasToken(credential)) return match
      }
      return prefix + replacement(secret, category, state)
    },
  )

  redacted = redacted.replace(
    JSON_VALUE_RE,
    (match, prefix: string, key: string, raw: string) => {
      const category = sensitiveKeyCategory(key)
      if (category === undefined) return match
      const trimmed = raw.trim()
      let secret = trimmed
      if (trimmed.startsWith('"')) {
        try {
          const parsed = JSON.parse(trimmed) as unknown
          if (typeof parsed !== 'string') return match
          secret = parsed
        } catch {
          return match
        }
      }
      if (state.vault.hasToken(secret) || looksLikeCodeReference(secret)) return match
      return prefix + JSON.stringify(replacement(secret, category, state))
    },
  )

  return redacted
}

/** Preserve the same number of JSON string-encoding layers around an object/array root. */
function redactJsonEncodedString(text: string, state: RedactionState): string | undefined {
  let candidate: unknown = text
  let layers = 0

  while (layers < MAX_JSON_ENCODING_LAYERS && typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate) as unknown
    } catch {
      return undefined
    }
    layers += 1
  }

  if (typeof candidate === 'string') {
    throw new RangeError(`JSON string encoding exceeds ${MAX_JSON_ENCODING_LAYERS} layers`)
  }
  if (candidate === null || typeof candidate !== 'object') return undefined
  if (!Array.isArray(candidate) && Object.getPrototypeOf(candidate) !== Object.prototype) return undefined

  let encoded = JSON.stringify(redactValue(candidate as JsonValue, state))
  for (let index = 1; index < layers; index += 1) encoded = JSON.stringify(encoded)
  return encoded
}

function replacement(
  secret: string,
  category: RedactionCategory,
  state: RedactionState,
): string {
  state.count += 1
  state.categories.add(category)
  return state.vault.tokenize(secret)
}

function sensitiveKeyCategory(key: string): RedactionCategory | undefined {
  const compact = key.toLowerCase().replace(/[_.-]/g, '')
  if (compact.includes('privatekey')) return 'private-key'
  if (compact.includes('authorization')) return 'authorization'
  if (compact.includes('webhook') || compact.includes('roboturl')) return 'webhook'
  if (compact.includes('password') || compact.includes('passwd') || compact.includes('pwd')) {
    return 'password'
  }
  if (compact.includes('token')) return 'token'
  if (
    compact.includes('secret')
    || compact.includes('apikey')
    || compact.includes('appkey')
    || compact.includes('accesskey')
    || compact.includes('signature')
  ) return 'secret'
  return undefined
}

/** Avoid blinding the model when it is reading source declarations rather than values. */
function looksLikeCodeReference(value: string): boolean {
  const candidate = value.trim().replace(/;$/, '')
  if (candidate.length === 0) return false
  if (candidate === '...' || candidate === 'None' || candidate === 'null' || candidate === 'undefined') {
    return true
  }
  if (/^\$[{(]?[A-Za-z_][A-Za-z0-9_]*[})]?$/.test(candidate)) return true
  if (/^%[A-Za-z_][A-Za-z0-9_]*%$/.test(candidate)) return true
  if (/^[A-Za-z_][A-Za-z0-9_.]*\([^)]*\)$/.test(candidate)) return true

  const typeAtom = '(?:string|str|int|float|bool|boolean|bytes|dict|list|set|tuple|Any|Optional|Union|Literal|[A-Z][A-Za-z0-9]*(?:\\.[A-Z][A-Za-z0-9]*)?)'
  const typeName = `${typeAtom}(?:\\[[^\\]]+\\])?`
  const typeExpression = `${typeName}(?:\\s*[|,]\\s*${typeName})*`
  if (new RegExp(`^${typeExpression}$`).test(candidate)) return true
  return new RegExp(`^${typeExpression}\\s*=\\s*(?:\\.\\.\\.|None|null|undefined)$`).test(candidate)
}

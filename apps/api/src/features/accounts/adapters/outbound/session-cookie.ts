const SECRET_MIN_BYTES = 32
const IV_BYTES = 12

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export type SessionPayload = Readonly<{
  accessToken: string
  refreshToken: string
  expiresAtMs: number
  tenantId?: string | undefined
}>

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<SessionPayload>

  return (
    typeof candidate.accessToken === 'string' &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === 'string' &&
    candidate.refreshToken.length > 0 &&
    Number.isSafeInteger(candidate.expiresAtMs) &&
    (candidate.expiresAtMs ?? 0) > 0 &&
    (candidate.tenantId === undefined || typeof candidate.tenantId === 'string')
  )
}

export class SessionCookieCodec {
  private readonly secret: string

  constructor(secret: string) {
    if (textEncoder.encode(secret).byteLength < SECRET_MIN_BYTES) {
      throw new RangeError(
        'session encryption secret must be at least 32 bytes',
      )
    }

    this.secret = secret
  }

  private async createKey(): Promise<CryptoKey> {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      textEncoder.encode(this.secret),
    )

    return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ])
  }

  async encode(payload: SessionPayload): Promise<string> {
    const key = await this.createKey()
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const encrypted = await crypto.subtle.encrypt(
      { iv, name: 'AES-GCM' },
      key,
      textEncoder.encode(JSON.stringify(payload)),
    )

    return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`
  }

  async decode(value: string): Promise<SessionPayload | null> {
    try {
      const [encodedIv, encodedPayload, extra] = value.split('.')

      if (!encodedIv || !encodedPayload || extra !== undefined) {
        return null
      }

      const key = await this.createKey()
      const decrypted = await crypto.subtle.decrypt(
        { iv: fromBase64Url(encodedIv), name: 'AES-GCM' },
        key,
        fromBase64Url(encodedPayload),
      )
      const parsed: unknown = JSON.parse(textDecoder.decode(decrypted))

      return isSessionPayload(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

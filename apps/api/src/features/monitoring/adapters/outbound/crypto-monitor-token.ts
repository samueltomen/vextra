const TOKEN_BYTES = 32
const PEPPER_MIN_BYTES = 32

const textEncoder = new TextEncoder()

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

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function assertPepper(pepper: string): void {
  if (textEncoder.encode(pepper).byteLength < PEPPER_MIN_BYTES) {
    throw new RangeError('heartbeat token pepper must be at least 32 bytes')
  }
}

export async function hashMonitorToken(
  token: string,
  pepper: string,
): Promise<string> {
  assertPepper(pepper)

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(pepper),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(token),
  )

  return toHex(signature)
}

export class WebCryptoMonitorTokenGenerator {
  constructor(private readonly pepper: string) {
    assertPepper(pepper)
  }

  async generate(): Promise<{
    token: string
    hash: string
    prefix: string
  }> {
    const randomBytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
    const token = toBase64Url(randomBytes)

    return {
      token,
      hash: await hashMonitorToken(token, this.pepper),
      prefix: token.slice(0, 8),
    }
  }
}

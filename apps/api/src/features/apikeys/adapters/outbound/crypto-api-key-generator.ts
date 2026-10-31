import { hashMonitorToken } from '../../../monitoring/adapters/outbound/crypto-monitor-token.ts'
import type {
  ApiKeyGeneratorPort,
  GeneratedApiKey,
} from '../../application/api-keys.ts'

const SECRET_BYTES = 32

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

export class CryptoApiKeyGenerator implements ApiKeyGeneratorPort {
  constructor(private readonly pepper: string) {}

  async generate(): Promise<GeneratedApiKey> {
    const key = `vx_${toBase64Url(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)))}`

    return { hash: await this.hash(key), key, prefix: key.slice(0, 10) }
  }

  hash(key: string): Promise<string> {
    return hashMonitorToken(key, this.pepper)
  }
}

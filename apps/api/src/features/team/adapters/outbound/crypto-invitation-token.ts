import { hashMonitorToken } from '../../../monitoring/adapters/outbound/crypto-monitor-token.ts'
import type { InvitationTokenPort } from '../../application/team.ts'

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

export class CryptoInvitationToken implements InvitationTokenPort {
  constructor(private readonly pepper: string) {}

  async generate() {
    const token = `vxi_${toBase64Url(crypto.getRandomValues(new Uint8Array(32)))}`

    return { hash: await this.hash(token), token }
  }

  hash(token: string): Promise<string> {
    return hashMonitorToken(token, this.pepper)
  }
}

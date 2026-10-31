import { createHash } from 'node:crypto'

const INLINE_SCRIPT = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/giu

/** SHA-256 hashes (CSP syntax) of the inline scripts of an HTML document. */
export function inlineScriptHashes(html: string): readonly string[] {
  return [...html.matchAll(INLINE_SCRIPT)]
    .map((match) => match[1] ?? '')
    .filter((script) => script.trim().length > 0)
    .map(
      (script) =>
        `'sha256-${createHash('sha256').update(script).digest('base64')}'`,
    )
}

/**
 * Content-Security-Policy for the single page application. Inline scripts are
 * allowed only by hash, so the theme bootstrap works but injected scripts do not.
 */
export function buildContentSecurityPolicy(indexHtml: string): string {
  const scriptSources = ["'self'", ...inlineScriptHashes(indexHtml)].join(' ')

  return [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export const STATIC_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

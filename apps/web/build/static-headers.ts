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
 * Content-Security-Policy of the single page application. Inline scripts are
 * allowed only by hash. Mirrors apps/api/src/node/static-security.ts, which
 * serves the same bundle in the self-hosted runtime.
 */
export function buildContentSecurityPolicy(indexHtml: string): string {
  return [
    "default-src 'self'",
    `script-src ${["'self'", ...inlineScriptHashes(indexHtml)].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ')
}

/** Content of the Cloudflare static assets `_headers` file. */
export function buildStaticHeaders(indexHtml: string): string {
  return [
    '/*',
    `  Content-Security-Policy: ${buildContentSecurityPolicy(indexHtml)}`,
    '  Referrer-Policy: no-referrer',
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
    '  Strict-Transport-Security: max-age=31536000; includeSubDomains',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n')
}

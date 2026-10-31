import { describe, expect, it } from 'vitest'

import {
  buildContentSecurityPolicy,
  buildStaticHeaders,
  inlineScriptHashes,
} from './static-headers.ts'

const HTML = `<!doctype html><html><head>
<script>document.documentElement.dataset.theme = 'dark'</script>
<script type="module" src="/assets/index.js"></script>
<script>   </script>
</head><body></body></html>`

describe('static headers', () => {
  it('hashes only non-empty inline scripts', () => {
    const hashes = inlineScriptHashes(HTML)

    expect(hashes).toHaveLength(1)
    expect(hashes[0]).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/)
  })

  it('builds a strict policy without unsafe script sources', () => {
    const policy = buildContentSecurityPolicy(HTML)

    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("base-uri 'none'")
    expect(policy).not.toMatch(/script-src[^;]*unsafe/)
    expect(policy).toContain(inlineScriptHashes(HTML)[0])
  })

  it('writes the headers for every path and caches fingerprinted assets', () => {
    const file = buildStaticHeaders(HTML)

    expect(file).toMatch(/^\/\*\n {2}Content-Security-Policy: /)
    expect(file).toContain('X-Frame-Options: DENY')
    expect(file).toContain('X-Content-Type-Options: nosniff')
    expect(file).toContain('Strict-Transport-Security:')
    expect(file).toContain(
      '/assets/*\n  Cache-Control: public, max-age=31536000, immutable',
    )
  })
})

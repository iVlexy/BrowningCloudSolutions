import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import type { Env, Variables } from '../types'

// Decode a base64url string to a Uint8Array
function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

// Validate a CF Access JWT using the team's public JWKS
async function validateCFToken(token: string, teamDomain: string): Promise<string | null> {
  try {
    // Decode the JWT header to get the key ID
    const [headerB64, payloadB64, sigB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !sigB64) return null

    const header = JSON.parse(new TextDecoder().decode(base64urlToBytes(headerB64)))
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)))

    // Fetch CF Access public keys
    const certsRes = await fetch(
      `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`
    )
    if (!certsRes.ok) return null

    const { keys } = await certsRes.json<{ keys: JsonWebKey[] }>()
    const jwk = (keys as (JsonWebKey & { kid?: string })[]).find((k) => k.kid === header.kid) ?? keys[0]
    if (!jwk) return null

    // Import the public key and verify signature
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const sig = base64urlToBytes(sigB64)
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data)

    if (!valid) return null

    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) return null

    return payload.email ?? null
  } catch {
    return null
  }
}

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const token =
      c.req.header('CF-Access-Jwt-Assertion') ??
      getCookie(c, 'CF_Authorization')

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const email = await validateCFToken(token, c.env.CF_TEAM_DOMAIN)
    if (!email) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    c.set('userEmail', email)
    await next()
  }
)

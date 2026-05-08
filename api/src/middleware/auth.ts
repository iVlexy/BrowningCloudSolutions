import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import type { Env, Variables } from '../types'

// Decode a base64url string to a Uint8Array
function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

// Module-level JWKS cache — persists for the lifetime of the Worker isolate
let jwksCache: (JsonWebKey & { kid?: string })[] | null = null
let jwksCachedAt = 0
const JWKS_TTL_MS = 10 * 60 * 1000 // 10 minutes

async function getJwks(teamDomain: string): Promise<(JsonWebKey & { kid?: string })[]> {
  const now = Date.now()
  if (jwksCache && now - jwksCachedAt < JWKS_TTL_MS) {
    return jwksCache
  }
  const res = await fetch(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`)
  if (!res.ok) {
    console.error('[auth] JWKS fetch failed:', res.status, res.statusText)
    // Return stale cache rather than failing, if we have one
    if (jwksCache) return jwksCache
    throw new Error(`JWKS fetch failed: ${res.status}`)
  }
  const { keys } = await res.json<{ keys: (JsonWebKey & { kid?: string })[] }>()
  jwksCache = keys
  jwksCachedAt = now
  return keys
}

// Validate a CF Access JWT using the team's public JWKS
async function validateCFToken(token: string, teamDomain: string): Promise<string | null> {
  try {
    // Decode the JWT header to get the key ID
    const [headerB64, payloadB64, sigB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !sigB64) {
      console.error('[auth] Token missing parts')
      return null
    }

    const header = JSON.parse(new TextDecoder().decode(base64urlToBytes(headerB64)))
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)))

    // Check expiry first (cheap, no network)
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      console.error('[auth] Token expired at', payload.exp, 'now', Math.floor(Date.now() / 1000))
      return null
    }

    const keys = await getJwks(teamDomain)
    const jwk = keys.find((k) => k.kid === header.kid) ?? keys[0]
    if (!jwk) {
      console.error('[auth] No matching JWK for kid', header.kid)
      return null
    }

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

    if (!valid) {
      console.error('[auth] Signature verification failed')
      return null
    }

    return payload.email ?? null
  } catch (err) {
    console.error('[auth] validateCFToken threw:', err)
    return null
  }
}

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const token =
      c.req.header('X-Auth-Jwt') ??
      c.req.header('CF-Access-Jwt-Assertion') ??
      getCookie(c, 'CF_Authorization')

    if (!token) {
      console.error('[auth] No token — CF-Access-Jwt-Assertion header and CF_Authorization cookie both absent')
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

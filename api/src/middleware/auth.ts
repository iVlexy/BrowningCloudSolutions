import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import type { Env, Variables } from '../types'

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const token =
      c.req.header('CF-Access-Jwt-Assertion') ??
      getCookie(c, 'CF_Authorization')

    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
      const identityRes = await fetch(
        `https://${c.env.CF_TEAM_DOMAIN}.cloudflareaccess.com/cdn-cgi/access/get-identity`,
        { headers: { 'CF-Access-Jwt-Assertion': token } }
      )

      if (!identityRes.ok) {
        return c.json({ error: 'Unauthorized' }, 401)
      }

      const identity = await identityRes.json<{ email: string }>()
      c.set('userEmail', identity.email)
    } catch {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    await next()
  }
)

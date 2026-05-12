import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'
import { getDb } from '../db'
import { clients, invoices, payments, supportTickets } from '../db/schema'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── CF JWT helpers ───────────────────────────────────────────────────────────
function base64urlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function getEmailFromCFToken(token: string, teamDomain: string): Promise<string | null> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !sigB64) return null
    const header = JSON.parse(new TextDecoder().decode(base64urlToBytes(headerB64)))
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)))
    const certsRes = await fetch(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`)
    if (!certsRes.ok) return null
    const { keys } = await certsRes.json<{ keys: JsonWebKey[] }>()
    const jwk = (keys as (JsonWebKey & { kid?: string })[]).find((k) => k.kid === header.kid) ?? keys[0]
    if (!jwk) return null
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const sig = base64urlToBytes(sigB64)
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data)
    if (!valid || (payload.exp && Date.now() / 1000 > payload.exp)) return null
    return payload.email ?? null
  } catch { return null }
}

// ─── Portal auth middleware — validates CF Zero Trust JWT ─────────────────────
async function portalAuth(c: any, next: () => Promise<void>) {
  const token = c.req.header('CF-Access-Jwt-Assertion') ?? getCookie(c, 'CF_Authorization')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const email = await getEmailFromCFToken(token, c.env.CF_TEAM_DOMAIN)
  if (!email) return c.json({ error: 'Unauthorized' }, 401)
  const db = getDb(c.env.DB)
  const client = await db.select().from(clients)
    .where(and(eq(clients.email, email.toLowerCase()), eq(clients.isDeleted, false))).get()
  if (!client) return c.json({ error: 'No client account found for this email' }, 403)
  c.set('portalClient', client)
  await next()
}

// ─── Helper: send email via SendGrid ─────────────────────────────────────────
async function sendEmail(env: Env, to: string, subject: string, html: string) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.FROM_EMAIL, name: env.COMPANY_NAME },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('SendGrid error:', err)
  }
}

// ─── GET /api/portal/me — current client + invoices + tickets ────────────────
router.get('/me', portalAuth, async (c) => {
  const client = c.get('portalClient')
  const db = getDb(c.env.DB)

  const clientInvoices = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.clientId, client.id), eq(invoices.isDeleted, false)))
    .orderBy(desc(invoices.createdAt))

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.clientId, client.id))
    .orderBy(desc(supportTickets.createdAt))

  const paidByInvoice: Record<string, number> = {}
  for (const inv of clientInvoices) {
    const ps = await db.select().from(payments).where(
      and(eq(payments.invoiceId, inv.id), eq(payments.status, 'completed'))
    )
    paidByInvoice[inv.id] = ps.reduce((s, p) => s + p.amount, 0)
  }

  const invoicesWithBalance = clientInvoices.map(inv => ({
    ...inv,
    amountPaid: paidByInvoice[inv.id] ?? 0,
    amountDue: Math.max(0, inv.total - (paidByInvoice[inv.id] ?? 0)),
  }))

  return c.json({ client, invoices: invoicesWithBalance, tickets })
})

// ─── POST /api/portal/tickets — submit support ticket ────────────────────────
router.post('/tickets', portalAuth, async (c) => {
  const client = c.get('portalClient')
  const { subject, message } = await c.req.json<{ subject: string; message: string }>()
  if (!subject || !message) return c.json({ error: 'Subject and message required' }, 400)

  const db = getDb(c.env.DB)
  const now = Math.floor(Date.now() / 1000)

  const ticket = {
    id: crypto.randomUUID(),
    clientId: client.id,
    subject,
    message,
    status: 'open' as const,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(supportTickets).values(ticket)

  const html = `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;padding:32px;">
  <h2>New Support Ticket</h2>
  <p><strong>From:</strong> ${client.name} (${client.email})</p>
  <p><strong>Subject:</strong> ${subject}</p>
  <p><strong>Message:</strong></p>
  <p style="background:#f5f5f5;padding:16px;border-radius:6px;">${message}</p>
</body></html>`
  await sendEmail(c.env, c.env.FROM_EMAIL, `Support ticket: ${subject}`, html)

  return c.json(ticket, 201)
})

export { router as portalRouter }

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { eq, and, like, sql } from 'drizzle-orm'
import { clientsRouter } from './routes/clients'
import { invoicesRouter } from './routes/invoices'
import { paymentsRouter } from './routes/payments'
import { servicesRouter } from './routes/services'
import { contactRouter } from './routes/contact'
import { stripeRouter } from './routes/stripe'
import { bugsRouter } from './routes/bugs'
import { authMiddleware } from './middleware/auth'
import { getDb } from './db'
import { clients, invoices, invoiceItems, bugs } from './db/schema'
import type { Env, Variables } from './types'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', logger())

app.use('*', cors({
  origin: (origin) => {
    const allowed = ['https://browningcloud.com', 'https://www.browningcloud.com']
    if (!origin || allowed.includes(origin) || origin.startsWith('http://localhost')) {
      return origin ?? '*'
    }
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
  credentials: true,
  maxAge: 86400,
}))

// ─── Public routes ────────────────────────────────────────────────────────────
// Stripe webhook — must be raw body; mount before auth
app.route('/api/stripe', stripeRouter)

// Services list (public GET)
app.route('/api/services', servicesRouter)

// Contact form submission (public POST)
app.route('/api/contact', contactRouter)

// Public invoice payment page data
app.get('/api/pay/:token', async (c) => {
  // Delegated to invoices router
  return invoicesRouter.fetch(
    new Request(`${new URL(c.req.url).origin}/pay/${c.req.param('token')}`, c.req.raw),
    c.env
  )
})

// ─── Auth check ───────────────────────────────────────────────────────────────
app.get('/api/auth/me', authMiddleware, (c) => {
  return c.json({ email: c.var.userEmail })
})

// ─── Protected routes ─────────────────────────────────────────────────────────
// Bug report — public endpoints (no auth needed for /report and /inbound-email)
app.route('/api/bugs', bugsRouter)

app.use('/api/clients/*', authMiddleware)
app.use('/api/invoices/*', authMiddleware)
app.use('/api/payments/*', authMiddleware)

app.route('/api/clients', clientsRouter)
app.route('/api/invoices', invoicesRouter)
app.route('/api/payments', paymentsRouter)

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }))

app.notFound((c) => c.json({ error: 'Not found' }, 404))

// ─── Monthly billing cron ─────────────────────────────────────────────────────
async function handleMonthlyBilling(env: Env) {
  const db = getDb(env.DB)
  const now = Math.floor(Date.now() / 1000)

  // Activate any manual-billing clients whose future start date has now arrived
  const pendingClients = await db
    .select()
    .from(clients)
    .where(and(
      eq(clients.billingMethod, 'manual'),
      eq(clients.recurringActive, false),
      eq(clients.isDeleted, false),
      sql`${clients.recurringStartDate} IS NOT NULL AND ${clients.recurringStartDate} <= ${now}`
    ))

  for (const client of pendingClients) {
    await db.update(clients).set({ recurringActive: true, updatedAt: now }).where(eq(clients.id, client.id))
  }

  const recurringClients = await db
    .select()
    .from(clients)
    .where(and(eq(clients.billingMethod, 'manual'), eq(clients.recurringActive, true), eq(clients.isDeleted, false)))

  const date = new Date()
  const monthName = date.toLocaleString('en-US', { month: 'long' })
  const year = date.getFullYear()
  const prefix = `INV-${year}-`

  for (const client of recurringClients) {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(like(invoices.invoiceNumber, `${prefix}%`))
    const nextNum = (countResult[0]?.count ?? 0) + 1
    const invoiceNumber = `${prefix}${String(nextNum).padStart(4, '0')}`
    const amount = client.monthlyAmount ?? 0

    const invoice = {
      id: crypto.randomUUID(),
      invoiceNumber,
      clientId: client.id,
      status: 'sent' as const,
      dueDate: null,
      notes: `Auto-generated monthly invoice for ${monthName} ${year}`,
      subtotal: amount,
      taxRate: 0,
      taxAmount: 0,
      total: amount,
      paymentToken: crypto.randomUUID().replace(/-/g, ''),
      sentAt: now,
      paidAt: null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(invoices).values(invoice)
    await db.insert(invoiceItems).values({
      id: crypto.randomUUID(),
      invoiceId: invoice.id,
      description: `Monthly Service Fee — ${monthName} ${year}`,
      quantity: 1,
      unitPrice: amount,
      amount,
      sortOrder: 0,
    })
  }
}

export default {
  fetch: app.fetch.bind(app),
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleMonthlyBilling(env))
  },
  async email(message: any, env: Env, _ctx: ExecutionContext) {
    console.log('email handler triggered, from:', message.from, 'to:', message.to)
    try {
      // Subject is directly available on headers without parsing raw email
      const subject = (message.headers?.get('subject') ?? '').trim() || 'Bug report via email'

      // Read body from the raw stream
      let body = '(no body)'
      try {
        const raw: string = await new Response(message.raw).text()
        // Find the header/body separator (double CRLF or LF)
        const sep = raw.indexOf('\r\n\r\n')
        const rawBody = sep !== -1 ? raw.slice(sep + 4).trim() : raw.trim()

        // Strip MIME part headers if multipart — grab first text/plain segment
        const plainMatch = rawBody.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\s*$)/i)
        body = (plainMatch ? plainMatch[1] : rawBody).trim() || '(no body)'
      } catch (e) {
        console.error('Body read error:', e)
      }

      const from: string = message.from ?? ''
      const emailMatch = from.match(/<([^>]+)>/)
      const submitterEmail = emailMatch ? emailMatch[1] : from.trim()
      const nameMatch = from.match(/^"?([^"<]+)"?\s*</)
      const submitterName = nameMatch ? nameMatch[1].trim() : null

      const db = getDb(env.DB)
      const now = Math.floor(Date.now() / 1000)
      await db.insert(bugs).values({
        id: crypto.randomUUID(),
        title: subject,
        description: body,
        status: 'open',
        priority: 'medium',
        source: 'email',
        submitterName,
        submitterEmail,
        notes: null,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })
      console.log('Bug created from email:', subject)
    } catch (err) {
      console.error('Email handler error:', err)
    }
  },
}

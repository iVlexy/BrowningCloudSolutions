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
import { portalRouter } from './routes/portal'
import dashboardRouter from './routes/dashboard'
import expensesRouter from './routes/expenses'
import timeEntriesRouter from './routes/time-entries'
import contractsRouter from './routes/contracts'
import proposalsRouter, { runProposalReminders } from './routes/proposals'
import notificationsRouter from './routes/notifications'
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
app.use('/api/dashboard/*', authMiddleware)
app.use('/api/expenses/*', authMiddleware)
app.use('/api/time-entries/*', authMiddleware)
app.use('/api/contracts/*', authMiddleware)
app.use('/api/notifications/*', authMiddleware)

app.route('/api/clients', clientsRouter)
app.route('/api/invoices', invoicesRouter)
app.route('/api/payments', paymentsRouter)
app.route('/api/dashboard', dashboardRouter)
app.route('/api/expenses', expensesRouter)
app.route('/api/time-entries', timeEntriesRouter)
app.route('/api/contracts', contractsRouter)
app.route('/api/proposals', proposalsRouter)
app.route('/api/notifications', notificationsRouter)

app.route('/api/portal', portalRouter)

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

// ─── Daily overdue invoice check ──────────────────────────────────────────────
async function handleOverdueInvoices(env: Env) {
  const db = getDb(env.DB)
  const now = Math.floor(Date.now() / 1000)

  // Find sent/partial invoices with a due date in the past
  const overdueInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.isDeleted, false),
        sql`${invoices.status} IN ('sent', 'partial')`,
        sql`${invoices.dueDate} IS NOT NULL AND ${invoices.dueDate} < ${now}`
      )
    )

  for (const invoice of overdueInvoices) {
    // Mark overdue
    await db.update(invoices).set({ status: 'overdue', updatedAt: now }).where(eq(invoices.id, invoice.id))

    // Get client
    const client = await db.select().from(clients).where(eq(clients.id, invoice.clientId)).get()
    if (!client) continue

    const paymentUrl = `${env.FRONTEND_URL}/pay/${invoice.paymentToken}`
    const dueStr = new Date(invoice.dueDate! * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:540px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#c62828;padding:28px 36px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">${env.COMPANY_NAME}</h1>
      <p style="margin:6px 0 0;color:#ef9a9a;font-size:13px;">Payment Reminder</p>
    </div>
    <div style="padding:36px;">
      <p style="margin:0 0 16px;">Hi ${client.name},</p>
      <p style="margin:0 0 20px;color:#555;">This is a friendly reminder that invoice <strong>${invoice.invoiceNumber}</strong> for <strong>$${invoice.total.toFixed(2)}</strong> was due on <strong>${dueStr}</strong> and is now overdue.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${paymentUrl}" style="display:inline-block;background:#c62828;color:#fff;padding:14px 36px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">Pay Now</a>
      </div>
      <p style="color:#888;font-size:13px;">If you have already sent payment, please disregard this email. Contact us at <a href="mailto:${env.FROM_EMAIL}" style="color:#1565C0;">${env.FROM_EMAIL}</a> with any questions.</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
      <p style="color:#aaa;font-size:12px;text-align:center;">Thank you for choosing ${env.COMPANY_NAME}</p>
    </div>
  </div>
</body>
</html>`

    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: client.email }] }],
        from: { email: env.FROM_EMAIL, name: env.COMPANY_NAME },
        subject: `Payment reminder — Invoice ${invoice.invoiceNumber} is overdue`,
        content: [{ type: 'text/html', value: html }],
      }),
    })
  }
}

export default {
  fetch: app.fetch.bind(app),
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cron = event.cron
    if (cron === '0 8 1 * *') {
      ctx.waitUntil(handleMonthlyBilling(env))
    } else if (cron === '0 9 * * *') {
      ctx.waitUntil(handleOverdueInvoices(env))
      ctx.waitUntil(runProposalReminders(env))
    }
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

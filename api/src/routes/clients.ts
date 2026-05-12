import { Hono } from 'hono'
import { eq, and, desc, sql, like, or } from 'drizzle-orm'
import { getDb } from '../db'
import { clients } from '../db/schema'
import type { Env, Variables } from '../types'
import Stripe from 'stripe'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

router.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const search = c.req.query('search')

  if (search) {
    const term = `%${search}%`
    const result = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.isDeleted, false),
          or(
            like(clients.name, term),
            like(clients.email, term),
            like(clients.company, term)
          )
        )
      )
      .orderBy(desc(clients.createdAt))
    return c.json(result)
  }

  const result = await db
    .select()
    .from(clients)
    .where(eq(clients.isDeleted, false))
    .orderBy(desc(clients.createdAt))
  return c.json(result)
})

router.get('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  const client = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.isDeleted, false)))
    .get()

  if (!client) return c.json({ error: 'Not found' }, 404)
  return c.json(client)
})

router.post('/', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    name: string
    email: string
    phone?: string
    company?: string
    address?: string
    notes?: string
  }>()

  const now = Math.floor(Date.now() / 1000)
  const client = {
    id: crypto.randomUUID(),
    name: body.name,
    email: body.email,
    phone: body.phone ?? null,
    company: body.company ?? null,
    address: body.address ?? null,
    notes: body.notes ?? null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(clients).values(client)
  return c.json(client, 201)
})

router.put('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    email?: string
    phone?: string | null
    company?: string | null
    address?: string | null
    notes?: string | null
  }>()

  await db
    .update(clients)
    .set({ ...body, updatedAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(clients.id, id), eq(clients.isDeleted, false)))

  const updated = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .get()

  return c.json(updated)
})

router.delete('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  await db
    .update(clients)
    .set({ isDeleted: true, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(clients.id, id))

  return c.json({ success: true })
})

// ─── Recurring billing ────────────────────────────────────────────────────────

router.post('/:id/recurring/setup', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<{ amount: number; method: 'stripe' | 'manual'; startDate?: string }>()

  const client = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.isDeleted, false)))
    .get()

  if (!client) return c.json({ error: 'Client not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  // startDate is an ISO date string (YYYY-MM-DD); null/undefined means start immediately
  const startTs = body.startDate ? Math.floor(new Date(body.startDate).getTime() / 1000) : null
  const isFuture = startTs && startTs > now

  if (body.method === 'manual') {
    await db
      .update(clients)
      .set({
        monthlyAmount: body.amount,
        billingMethod: 'manual',
        // If future start date, stay inactive until the cron reaches that month
        recurringActive: !isFuture,
        recurringStartDate: startTs,
        updatedAt: now,
      })
      .where(eq(clients.id, id))
    return c.json({ success: true })
  }

  // Stripe subscription — create Checkout Session
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() })

  let stripeCustomerId = client.stripeCustomerId
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ email: client.email, name: client.name })
    stripeCustomerId = customer.id
  }

  // Gross up to cover Stripe's 2.9% + $0.30 so we net exactly body.amount
  const grossedAmount = Math.round(((body.amount + 0.30) / 0.971) * 100) // cents

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'Monthly Service Fee' },
        unit_amount: grossedAmount,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    metadata: { clientId: id },
    success_url: `${c.env.FRONTEND_URL}/admin/clients/${id}?subscription=success`,
    cancel_url: `${c.env.FRONTEND_URL}/admin/clients/${id}`,
  }

  // Delay first charge by using trial_end = start date
  if (isFuture) {
    sessionParams.subscription_data = { trial_end: startTs }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  // Save config but leave recurringActive=false until webhook confirms
  await db
    .update(clients)
    .set({ monthlyAmount: body.amount, billingMethod: 'stripe', stripeCustomerId, recurringStartDate: startTs, updatedAt: now })
    .where(eq(clients.id, id))

  return c.json({ checkoutUrl: session.url })
})

router.post('/:id/recurring/send', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  const client = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.isDeleted, false)))
    .get()

  if (!client) return c.json({ error: 'Client not found' }, 404)
  if (client.billingMethod !== 'stripe') return c.json({ error: 'Not a Stripe billing client' }, 400)

  // Generate a fresh Checkout session
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() })

  let stripeCustomerId = client.stripeCustomerId
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ email: client.email, name: client.name })
    stripeCustomerId = customer.id
    await db.update(clients).set({ stripeCustomerId, updatedAt: Math.floor(Date.now() / 1000) }).where(eq(clients.id, id))
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'Monthly Service Fee' },
        unit_amount: Math.round((client.monthlyAmount ?? 0) * 100),
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    metadata: { clientId: id },
    success_url: `${c.env.FRONTEND_URL}/admin/clients/${id}?subscription=success`,
    cancel_url: `${c.env.FRONTEND_URL}/admin/clients/${id}`,
  })

  const checkoutUrl = session.url!
  const emailHtml = generateSubscriptionEmail({ client, checkoutUrl, companyName: c.env.COMPANY_NAME })

  const emailRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: client.email }] }],
      from: { email: c.env.FROM_EMAIL, name: c.env.COMPANY_NAME },
      subject: `Set up your monthly billing with ${c.env.COMPANY_NAME}`,
      content: [{ type: 'text/html', value: emailHtml }],
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.text()
    console.error('SendGrid error:', err)
    return c.json({ error: 'Failed to send email' }, 500)
  }

  return c.json({ success: true })
})

function generateSubscriptionEmail({
  client,
  checkoutUrl,
  companyName,
}: {
  client: { name: string; email: string }
  checkoutUrl: string
  companyName: string
}) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#1565C0;padding:30px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;">${companyName}</h1>
      <p style="margin:8px 0 0;color:#90CAF9;font-size:14px;">Monthly Billing Setup</p>
    </div>
    <div style="padding:40px;">
      <p style="margin:0 0 20px;">Hi ${client.name},</p>
      <p style="margin:0 0 24px;color:#555;">We've set up a monthly billing plan for you. Please click the button below to securely enter your payment details — it only takes a minute.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${checkoutUrl}" style="display:inline-block;background:#1565C0;color:#fff;padding:16px 40px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">Set Up Billing</a>
      </div>
      <p style="color:#888;font-size:13px;">Or copy this link: <a href="${checkoutUrl}" style="color:#1565C0;">${checkoutUrl}</a></p>
      <hr style="margin:32px 0;border:none;border-top:1px solid #eee;">
      <p style="color:#888;font-size:12px;text-align:center;">Thank you for choosing ${companyName}</p>
    </div>
  </div>
</body>
</html>`
}

router.delete('/:id/recurring', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  const client = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.isDeleted, false)))
    .get()

  if (!client) return c.json({ error: 'Client not found' }, 404)

  if (client.stripeSubscriptionId) {
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() })
    try {
      await stripe.subscriptions.cancel(client.stripeSubscriptionId)
    } catch { /* already cancelled */ }
  }

  const now = Math.floor(Date.now() / 1000)
  await db
    .update(clients)
    .set({ recurringActive: false, billingMethod: null, monthlyAmount: null, stripeSubscriptionId: null, updatedAt: now })
    .where(eq(clients.id, id))

  return c.json({ success: true })
})

export { router as clientsRouter }

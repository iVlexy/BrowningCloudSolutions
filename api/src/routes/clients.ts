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
  const body = await c.req.json<{ amount: number; method: 'stripe' | 'manual' }>()

  const client = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.isDeleted, false)))
    .get()

  if (!client) return c.json({ error: 'Client not found' }, 404)

  const now = Math.floor(Date.now() / 1000)

  if (body.method === 'manual') {
    await db
      .update(clients)
      .set({ monthlyAmount: body.amount, billingMethod: 'manual', recurringActive: true, updatedAt: now })
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

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'Monthly Service Fee' },
        unit_amount: Math.round(body.amount * 100),
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    metadata: { clientId: id },
    success_url: `${c.env.FRONTEND_URL}/admin/clients/${id}?subscription=success`,
    cancel_url: `${c.env.FRONTEND_URL}/admin/clients/${id}`,
  })

  // Save config but leave recurringActive=false until webhook confirms
  await db
    .update(clients)
    .set({ monthlyAmount: body.amount, billingMethod: 'stripe', stripeCustomerId, updatedAt: now })
    .where(eq(clients.id, id))

  return c.json({ checkoutUrl: session.url })
})

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

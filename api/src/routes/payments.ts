import { Hono } from 'hono'
import { eq, and, desc, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { payments, invoices } from '../db/schema'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

router.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const invoiceId = c.req.query('invoiceId')

  const query = db
    .select()
    .from(payments)
    .orderBy(desc(payments.createdAt))
    .$dynamic()

  const result = invoiceId
    ? await query.where(eq(payments.invoiceId, invoiceId))
    : await query

  return c.json(result)
})

router.post('/', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    invoiceId: string
    amount: number
    method: 'cash' | 'check' | 'bank_transfer'
    checkNumber?: string
    notes?: string
    paidAt?: number
  }>()

  const invoice = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, body.invoiceId), eq(invoices.isDeleted, false)))
    .get()

  if (!invoice) return c.json({ error: 'Invoice not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  const payment = {
    id: crypto.randomUUID(),
    invoiceId: body.invoiceId,
    amount: body.amount,
    method: body.method,
    status: 'completed' as const,
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    checkNumber: body.checkNumber ?? null,
    notes: body.notes ?? null,
    paidAt: body.paidAt ?? now,
    createdAt: now,
  }

  await db.insert(payments).values(payment)
  await updateInvoicePaymentStatus(db, body.invoiceId, invoice.total)

  return c.json(payment, 201)
})

router.delete('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  const payment = await db
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .get()

  if (!payment) return c.json({ error: 'Not found' }, 404)
  if (payment.status === 'refunded') return c.json({ error: 'Already refunded' }, 400)

  let stripeRefunded = false

  // If paid via Stripe, issue a refund before marking in DB
  if (payment.stripePaymentIntentId && c.env.STRIPE_SECRET_KEY) {
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `payment_intent=${payment.stripePaymentIntentId}`,
    })
    const data = await res.json<{ id?: string; error?: { message: string } }>()
    if (!res.ok || !data.id) {
      return c.json({ error: `Stripe refund failed: ${data.error?.message ?? 'unknown'}` }, 502)
    }
    stripeRefunded = true
  }

  await db.update(payments).set({ status: 'refunded' }).where(eq(payments.id, id))
  await updateInvoicePaymentStatus(db, payment.invoiceId, null)

  return c.json({ success: true, stripeRefunded })
})

async function updateInvoicePaymentStatus(
  db: ReturnType<typeof getDb>,
  invoiceId: string,
  invoiceTotal: number | null
) {
  const invoice = invoiceTotal === null
    ? await db.select().from(invoices).where(eq(invoices.id, invoiceId)).get()
    : { total: invoiceTotal }

  if (!invoice) return

  const result = await db
    .select({ total: sql<number>`coalesce(sum(amount), 0)` })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, 'completed')))

  const amountPaid = result[0]?.total ?? 0
  const now = Math.floor(Date.now() / 1000)

  let status: string
  if (amountPaid <= 0) status = 'sent'
  else if (amountPaid < invoice.total) status = 'partial'
  else status = 'paid'

  await db
    .update(invoices)
    .set({ status, paidAt: status === 'paid' ? now : null, updatedAt: now })
    .where(eq(invoices.id, invoiceId))
}

export { router as paymentsRouter, updateInvoicePaymentStatus }

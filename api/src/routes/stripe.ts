import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../db'
import { invoices, payments, clients } from '../db/schema'
import { updateInvoicePaymentStatus } from './payments'
import type { Env, Variables } from '../types'
import Stripe from 'stripe'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

// Create Stripe Checkout session for a public invoice payment
router.post('/checkout', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{ token: string }>()

  const invoice = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.paymentToken, body.token), eq(invoices.isDeleted, false)))
    .get()

  if (!invoice) return c.json({ error: 'Invoice not found' }, 404)
  if (invoice.status === 'paid') return c.json({ error: 'Invoice already paid' }, 400)

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: `Payment for invoice ${invoice.invoiceNumber}`,
          },
          unit_amount: Math.round(invoice.total * 100), // cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      paymentToken: body.token,
    },
    success_url: `${c.env.FRONTEND_URL}/pay/${body.token}?success=true`,
    cancel_url: `${c.env.FRONTEND_URL}/pay/${body.token}`,
  })

  return c.json({ url: session.url })
})

// Stripe webhook — handles checkout.session.completed
router.post('/webhook', async (c) => {
  const body = await c.req.text()
  const sig = c.req.header('stripe-signature')

  if (!sig) return c.json({ error: 'Missing signature' }, 400)

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, c.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return c.json({ error: 'Webhook signature verification failed' }, 400)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.mode === 'subscription') {
      // Subscription checkout completed — activate recurring billing for the client
      const clientId = session.metadata?.clientId
      if (clientId) {
        const db = getDb(c.env.DB)
        const now = Math.floor(Date.now() / 1000)
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
        await db
          .update(clients)
          .set({ recurringActive: true, stripeSubscriptionId: subscriptionId, updatedAt: now })
          .where(eq(clients.id, clientId))
      }
    } else {
      // One-time invoice payment
      const invoiceId = session.metadata?.invoiceId
      if (invoiceId && session.payment_status === 'paid') {
        const db = getDb(c.env.DB)
        const now = Math.floor(Date.now() / 1000)

        await db.insert(payments).values({
          id: crypto.randomUUID(),
          invoiceId,
          amount: (session.amount_total ?? 0) / 100,
          method: 'stripe',
          status: 'completed',
          stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          stripeCheckoutSessionId: session.id,
          checkNumber: null,
          notes: 'Paid via Stripe Checkout',
          paidAt: now,
          createdAt: now,
        })

        await updateInvoicePaymentStatus(db, invoiceId, null)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    // Stripe subscription cancelled (from Stripe side) — deactivate recurring billing
    const sub = event.data.object as Stripe.Subscription
    const db = getDb(c.env.DB)
    const now = Math.floor(Date.now() / 1000)
    await db
      .update(clients)
      .set({ recurringActive: false, stripeSubscriptionId: null, updatedAt: now })
      .where(eq(clients.stripeSubscriptionId, sub.id))
  }

  return c.json({ received: true })
})

export { router as stripeRouter }

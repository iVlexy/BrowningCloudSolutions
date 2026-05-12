import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../db'
import { invoices, invoiceItems, payments, clients } from '../db/schema'
import { updateInvoicePaymentStatus } from './payments'
import type { Env, Variables } from '../types'
import Stripe from 'stripe'

async function sendReceiptEmail(env: Env, invoice: any, client: any, items: any[], amountPaid: number) {
  const itemRows = items.map(i =>
    `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;">${i.description}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;text-align:right;">$${i.amount.toFixed(2)}</td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#2e7d32;padding:28px 36px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">${env.COMPANY_NAME}</h1>
      <p style="margin:6px 0 0;color:#a5d6a7;font-size:13px;">Payment Receipt</p>
    </div>
    <div style="padding:36px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
        <span style="font-size:32px;">✅</span>
        <div>
          <div style="font-size:18px;font-weight:700;color:#2e7d32;">Payment Received</div>
          <div style="color:#666;font-size:14px;">Invoice ${invoice.invoiceNumber}</div>
        </div>
      </div>
      <p style="margin:0 0 20px;">Hi ${client.name}, thank you for your payment of <strong>$${amountPaid.toFixed(2)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead><tr style="background:#f8f8f8;"><th style="padding:10px;text-align:left;font-size:12px;color:#888;">Description</th><th style="padding:10px;text-align:right;font-size:12px;color:#888;">Amount</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="text-align:right;">
        ${invoice.taxAmount > 0 ? `<p style="margin:4px 0;color:#555;font-size:13px;">Subtotal: $${invoice.subtotal.toFixed(2)}</p><p style="margin:4px 0;color:#555;font-size:13px;">Tax: $${invoice.taxAmount.toFixed(2)}</p>` : ''}
        <p style="margin:4px 0;font-weight:bold;font-size:15px;">Invoice Total: $${invoice.total.toFixed(2)}</p>
        <p style="margin:4px 0;color:#2e7d32;font-weight:bold;">You Paid: $${amountPaid.toFixed(2)}</p>
      </div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
      <p style="color:#888;font-size:12px;text-align:center;">Thank you for choosing ${env.COMPANY_NAME}</p>
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
      subject: `Payment received — Invoice ${invoice.invoiceNumber}`,
      content: [{ type: 'text/html', value: html }],
    }),
  })
}

// ─── Create Stripe Checkout session for a public invoice payment ──────────────
const router = new Hono<{ Bindings: Env; Variables: Variables }>()

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

  // Calculate remaining balance (account for any partial payments already made)
  const completedPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoice.id), eq(payments.status, 'completed')))
  const amountPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0)
  const amountDue = Math.max(0, invoice.total - amountPaid)

  if (amountDue <= 0) return c.json({ error: 'Invoice already paid' }, 400)

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  // Gross up to cover Stripe's 2.9% + $0.30 processing fee
  const grossedTotal = Math.round(((amountDue + 0.30) / 0.971) * 100) // cents

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Invoice ${invoice.invoiceNumber}`,
            description: amountPaid > 0
              ? `Balance due on invoice ${invoice.invoiceNumber} (includes 2.9% + $0.30 card processing fee)`
              : `Payment for invoice ${invoice.invoiceNumber} (includes 2.9% + $0.30 card processing fee)`,
          },
          unit_amount: grossedTotal,
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

        // Send receipt email
        try {
          const inv = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).get()
          const cl = inv ? await db.select().from(clients).where(eq(clients.id, inv.clientId)).get() : null
          const invItems = inv ? await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id)) : []
          if (inv && cl) await sendReceiptEmail(c.env, inv, cl, invItems, (session.amount_total ?? 0) / 100)
        } catch (e) {
          console.error('Receipt email error:', e)
        }
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

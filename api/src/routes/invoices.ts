import { Hono } from 'hono'
import { eq, and, desc, sql, like } from 'drizzle-orm'
import { getDb } from '../db'
import { invoices, invoiceItems, payments, clients } from '../db/schema'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── List ─────────────────────────────────────────────────────────────────────
router.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const clientId = c.req.query('clientId')
  const status = c.req.query('status')

  let query = db
    .select({
      invoice: invoices,
      clientName: clients.name,
      clientCompany: clients.company,
    })
    .from(invoices)
    .leftJoin(clients, eq(invoices.clientId, clients.id))
    .where(eq(invoices.isDeleted, false))
    .orderBy(desc(invoices.createdAt))
    .$dynamic()

  if (clientId) query = query.where(and(eq(invoices.isDeleted, false), eq(invoices.clientId, clientId)))
  if (status) query = query.where(and(eq(invoices.isDeleted, false), eq(invoices.status, status)))

  const rows = await query
  return c.json(rows.map(r => ({ ...r.invoice, clientName: r.clientName, clientCompany: r.clientCompany })))
})

// ─── Get one (with items + payments) ─────────────────────────────────────────
router.get('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  const invoice = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.isDeleted, false)))
    .get()

  if (!invoice) return c.json({ error: 'Not found' }, 404)

  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, invoice.clientId))
    .get()

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(invoiceItems.sortOrder)

  const invoicePayments = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(desc(payments.createdAt))

  return c.json({ ...invoice, client, items, payments: invoicePayments })
})

// ─── Create ───────────────────────────────────────────────────────────────────
router.post('/', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    clientId: string
    dueDate?: number | null
    notes?: string | null
    taxRate?: number
    items: Array<{ description: string; quantity: number; unitPrice: number }>
  }>()

  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(like(invoices.invoiceNumber, `${prefix}%`))
  const nextNum = (countResult[0]?.count ?? 0) + 1
  const invoiceNumber = `${prefix}${String(nextNum).padStart(4, '0')}`

  const taxRate = body.taxRate ?? 0
  const subtotal = body.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  const now = Math.floor(Date.now() / 1000)
  const invoice = {
    id: crypto.randomUUID(),
    invoiceNumber,
    clientId: body.clientId,
    status: 'draft' as const,
    dueDate: body.dueDate ?? null,
    notes: body.notes ?? null,
    subtotal,
    taxRate,
    taxAmount,
    total,
    paymentToken: crypto.randomUUID().replace(/-/g, ''),
    sentAt: null,
    paidAt: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(invoices).values(invoice)

  const itemRows = body.items.map((item, idx) => ({
    id: crypto.randomUUID(),
    invoiceId: invoice.id,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.quantity * item.unitPrice,
    sortOrder: idx,
  }))

  if (itemRows.length > 0) {
    await db.insert(invoiceItems).values(itemRows)
  }

  return c.json({ ...invoice, items: itemRows }, 201)
})

// ─── Update ───────────────────────────────────────────────────────────────────
router.put('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<{
    dueDate?: number | null
    notes?: string | null
    taxRate?: number
    items?: Array<{ id?: string; description: string; quantity: number; unitPrice: number }>
  }>()

  const now = Math.floor(Date.now() / 1000)
  const updates: Record<string, unknown> = { updatedAt: now }

  if (body.dueDate !== undefined) updates.dueDate = body.dueDate
  if (body.notes !== undefined) updates.notes = body.notes

  if (body.items !== undefined) {
    const taxRate = body.taxRate ?? 0
    const subtotal = body.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    const taxAmount = subtotal * (taxRate / 100)
    updates.subtotal = subtotal
    updates.taxRate = taxRate
    updates.taxAmount = taxAmount
    updates.total = subtotal + taxAmount

    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id))
    const itemRows = body.items.map((item, idx) => ({
      id: item.id ?? crypto.randomUUID(),
      invoiceId: id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.quantity * item.unitPrice,
      sortOrder: idx,
    }))
    if (itemRows.length > 0) {
      await db.insert(invoiceItems).values(itemRows)
    }
  }

  await db
    .update(invoices)
    .set(updates)
    .where(and(eq(invoices.id, id), eq(invoices.isDeleted, false)))

  return c.json({ success: true })
})

// ─── Send invoice (email + status update) ────────────────────────────────────
router.post('/:id/send', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  const invoice = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.isDeleted, false)))
    .get()

  if (!invoice) return c.json({ error: 'Not found' }, 404)

  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, invoice.clientId))
    .get()

  if (!client) return c.json({ error: 'Client not found' }, 404)

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(invoiceItems.sortOrder)

  const existingPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, id), eq(payments.status, 'completed')))
  const amountPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0)

  const paymentUrl = `${c.env.FRONTEND_URL}/pay/${invoice.paymentToken}`

  const emailHtml = generateInvoiceEmail({
    invoice,
    client,
    items,
    amountPaid,
    paymentUrl,
    companyName: c.env.COMPANY_NAME,
  })

  const emailRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: client.email }] }],
      from: { email: c.env.FROM_EMAIL, name: c.env.COMPANY_NAME },
      subject: `Invoice ${invoice.invoiceNumber} from ${c.env.COMPANY_NAME}`,
      content: [{ type: 'text/html', value: emailHtml }],
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.text()
    console.error('SendGrid error:', err)
    return c.json({ error: 'Failed to send email' }, 500)
  }

  const now = Math.floor(Date.now() / 1000)
  // Preserve 'partial' status — only move to 'sent' from draft
  const newStatus = invoice.status === 'draft' ? 'sent' : invoice.status
  await db
    .update(invoices)
    .set({ status: newStatus, sentAt: now, updatedAt: now })
    .where(eq(invoices.id, id))

  return c.json({ success: true })
})

// ─── Cancel / soft-delete ─────────────────────────────────────────────────────
router.delete('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  await db
    .update(invoices)
    .set({ isDeleted: true, status: 'cancelled', updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(invoices.id, id))

  return c.json({ success: true })
})

// ─── Public: get invoice by payment token ─────────────────────────────────────
router.get('/pay/:token', async (c) => {
  const db = getDb(c.env.DB)
  const token = c.req.param('token')

  const invoice = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.paymentToken, token), eq(invoices.isDeleted, false)))
    .get()

  if (!invoice) return c.json({ error: 'Not found' }, 404)

  const client = await db
    .select({ name: clients.name, company: clients.company })
    .from(clients)
    .where(eq(clients.id, invoice.clientId))
    .get()

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoice.id))
    .orderBy(invoiceItems.sortOrder)

  const invoicePayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.invoiceId, invoice.id), eq(payments.status, 'completed')))

  const amountPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0)

  return c.json({
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    dueDate: invoice.dueDate,
    subtotal: invoice.subtotal,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    amountPaid,
    amountDue: Math.max(0, invoice.total - amountPaid),
    client,
    items,
  })
})

// ─── Email template ───────────────────────────────────────────────────────────
function generateInvoiceEmail({
  invoice,
  client,
  items,
  amountPaid,
  paymentUrl,
  companyName,
}: {
  invoice: { invoiceNumber: string; dueDate: number | null; subtotal: number; taxAmount: number; total: number; notes: string | null }
  client: { name: string; email: string }
  items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>
  amountPaid: number
  paymentUrl: string
  companyName: string
}) {
  const amountDue = Math.max(0, invoice.total - amountPaid)
  const dueDateStr = invoice.dueDate
    ? new Date(invoice.dueDate * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Upon receipt'

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;">${item.description}</td>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:center;">${item.quantity}</td>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:right;">$${item.amount.toFixed(2)}</td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#1565C0;padding:30px 40px;">
      <h1 style="margin:0;color:#fff;font-size:24px;">${companyName}</h1>
      <p style="margin:8px 0 0;color:#90CAF9;font-size:14px;">Invoice ${invoice.invoiceNumber}</p>
    </div>
    <div style="padding:40px;">
      <p style="margin:0 0 20px;">Hi ${client.name},</p>
      <p style="margin:0 0 24px;color:#555;">Please find your invoice attached. You can pay online using the button below.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:12px 10px;text-align:left;font-size:13px;color:#666;">Description</th>
            <th style="padding:12px 10px;text-align:center;font-size:13px;color:#666;">Qty</th>
            <th style="padding:12px 10px;text-align:right;font-size:13px;color:#666;">Unit Price</th>
            <th style="padding:12px 10px;text-align:right;font-size:13px;color:#666;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="text-align:right;margin-bottom:24px;">
        ${invoice.taxAmount > 0 ? `<p style="margin:4px 0;color:#555;">Subtotal: $${invoice.subtotal.toFixed(2)}</p><p style="margin:4px 0;color:#555;">Tax: $${invoice.taxAmount.toFixed(2)}</p>` : ''}
        <p style="margin:8px 0 0;font-size:18px;font-weight:bold;color:#1a2332;">Invoice Total: $${invoice.total.toFixed(2)}</p>
        ${amountPaid > 0 ? `<p style="margin:6px 0;color:#2e7d32;font-size:15px;">Amount Paid: -$${amountPaid.toFixed(2)}</p><p style="margin:6px 0;font-size:20px;font-weight:bold;color:#1565C0;border-top:2px solid #1565C0;padding-top:8px;">Balance Due: $${amountDue.toFixed(2)}</p>` : `<p style="margin:6px 0;font-size:20px;font-weight:bold;color:#1565C0;">Amount Due: $${invoice.total.toFixed(2)}</p>`}
        <p style="margin:4px 0;color:#777;font-size:13px;">Due: ${dueDateStr}</p>
      </div>
      ${invoice.notes ? `<p style="padding:16px;background:#f9f9f9;border-radius:6px;color:#555;font-size:14px;">${invoice.notes}</p>` : ''}
      <div style="text-align:center;margin:32px 0;">
        <a href="${paymentUrl}" style="display:inline-block;background:#1565C0;color:#fff;padding:16px 40px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">Pay Invoice Online</a>
      </div>
      <p style="color:#888;font-size:13px;">Or copy this link: <a href="${paymentUrl}" style="color:#1565C0;">${paymentUrl}</a></p>
      <hr style="margin:32px 0;border:none;border-top:1px solid #eee;">
      <p style="color:#888;font-size:12px;text-align:center;">Thank you for choosing ${companyName}</p>
    </div>
  </div>
</body>
</html>`
}

export { router as invoicesRouter }

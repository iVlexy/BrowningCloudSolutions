import { Hono } from 'hono'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { timeEntries, invoices, invoiceItems, clients } from '../db/schema'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

router.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const clientId = c.req.query('clientId')
  const uninvoicedOnly = c.req.query('uninvoiced') === 'true'

  let where = sql`1=1`
  if (clientId) where = sql`${where} AND ${timeEntries.clientId} = ${clientId}`
  if (uninvoicedOnly) where = sql`${where} AND ${timeEntries.invoiced} = 0`

  const rows = await db
    .select({
      entry: timeEntries,
      clientName: clients.name,
    })
    .from(timeEntries)
    .leftJoin(clients, eq(timeEntries.clientId, clients.id))
    .where(where)
    .orderBy(desc(timeEntries.date))

  return c.json(rows.map((r) => ({ ...r.entry, clientName: r.clientName })))
})

router.post('/', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    clientId: string
    date: number
    hours: number
    description: string
    rate: number
  }>()

  const now = Math.floor(Date.now() / 1000)
  const entry = {
    id: crypto.randomUUID(),
    clientId: body.clientId,
    date: body.date,
    hours: body.hours,
    description: body.description,
    rate: body.rate,
    invoiced: false,
    invoiceId: null as string | null,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(timeEntries).values(entry)
  return c.json(entry, 201)
})

router.put('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<Partial<{ date: number; hours: number; description: string; rate: number }>>()

  const existing = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  const updated = { ...body, updatedAt: now }
  await db.update(timeEntries).set(updated).where(eq(timeEntries.id, id))
  return c.json({ ...existing, ...updated })
})

router.delete('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const existing = await db.select().from(timeEntries).where(eq(timeEntries.id, id)).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.invoiced) return c.json({ error: 'Cannot delete an invoiced time entry' }, 400)

  await db.delete(timeEntries).where(eq(timeEntries.id, id))
  return c.json({ ok: true })
})

// POST /api/time-entries/invoice — convert selected entries into an invoice
router.post('/invoice', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    entryIds: string[]
    clientId: string
    dueDate?: number
    notes?: string
    taxRate?: number
  }>()

  // Validate entries
  const entries = await db
    .select()
    .from(timeEntries)
    .where(and(inArray(timeEntries.id, body.entryIds), eq(timeEntries.invoiced, false)))

  if (entries.length === 0) return c.json({ error: 'No uninvoiced entries found' }, 400)
  if (entries.some((e) => e.clientId !== body.clientId))
    return c.json({ error: 'All entries must belong to the same client' }, 400)

  const now = Math.floor(Date.now() / 1000)
  const taxRate = body.taxRate ?? 0

  // Generate invoice number
  const countRow = await db.get<{ n: number }>(sql`SELECT COUNT(*) as n FROM ${invoices}`)
  const seq = (countRow?.n ?? 0) + 1
  const year = new Date().getUTCFullYear()
  const invoiceNumber = `INV-${year}-${String(seq).padStart(4, '0')}`

  const subtotal = entries.reduce((sum, e) => sum + e.hours * e.rate, 0)
  const taxAmount = (subtotal * taxRate) / 100
  const total = subtotal + taxAmount

  const paymentToken = crypto.randomUUID()
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
    paymentToken,
    sentAt: null as number | null,
    paidAt: null as number | null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(invoices).values(invoice)

  // Insert line items
  const items = entries.map((e, i) => ({
    id: crypto.randomUUID(),
    invoiceId: invoice.id,
    description: `${e.description} (${e.hours}h @ $${e.rate}/hr)`,
    quantity: 1,
    unitPrice: e.hours * e.rate,
    amount: e.hours * e.rate,
    sortOrder: i,
  }))
  await db.insert(invoiceItems).values(items)

  // Mark entries as invoiced
  await db
    .update(timeEntries)
    .set({ invoiced: true, invoiceId: invoice.id, updatedAt: now })
    .where(inArray(timeEntries.id, body.entryIds))

  return c.json({ invoice, items }, 201)
})

export default router

import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { expenses } from '../db/schema'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

router.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const clientId = c.req.query('clientId')
  const category = c.req.query('category')

  let query = db
    .select()
    .from(expenses)
    .where(eq(expenses.isDeleted, false))
    .orderBy(desc(expenses.date))
    .$dynamic()

  if (clientId) query = query.where(and(eq(expenses.isDeleted, false), eq(expenses.clientId, clientId)))
  if (category) query = query.where(and(eq(expenses.isDeleted, false), eq(expenses.category, category)))

  return c.json(await query)
})

router.post('/', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    category: string
    description: string
    amount: number
    date: number
    clientId?: string
    receiptUrl?: string
    notes?: string
  }>()

  const now = Math.floor(Date.now() / 1000)
  const expense = {
    id: crypto.randomUUID(),
    category: body.category,
    description: body.description,
    amount: body.amount,
    date: body.date,
    clientId: body.clientId ?? null,
    receiptUrl: body.receiptUrl ?? null,
    notes: body.notes ?? null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(expenses).values(expense)
  return c.json(expense, 201)
})

router.put('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<Partial<{
    category: string; description: string; amount: number
    date: number; clientId: string | null; receiptUrl: string | null; notes: string | null
  }>>()

  const existing = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  const updated = { ...body, updatedAt: now }
  await db.update(expenses).set(updated).where(eq(expenses.id, id))
  return c.json({ ...existing, ...updated })
})

router.delete('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const existing = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await db.update(expenses).set({ isDeleted: true, updatedAt: now }).where(eq(expenses.id, id))
  return c.json({ ok: true })
})

export default router

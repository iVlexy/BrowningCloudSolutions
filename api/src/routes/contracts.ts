import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { contracts, clients } from '../db/schema'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

router.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const clientId = c.req.query('clientId')

  const rows = await db
    .select({ contract: contracts, clientName: clients.name })
    .from(contracts)
    .leftJoin(clients, eq(contracts.clientId, clients.id))
    .where(and(eq(contracts.isDeleted, false), ...(clientId ? [eq(contracts.clientId, clientId)] : [])))
    .orderBy(desc(contracts.createdAt))

  return c.json(rows.map((r) => ({ ...r.contract, clientName: r.clientName })))
})

router.get('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const row = await db
    .select({ contract: contracts, clientName: clients.name })
    .from(contracts)
    .leftJoin(clients, eq(contracts.clientId, clients.id))
    .where(and(eq(contracts.id, c.req.param('id')), eq(contracts.isDeleted, false)))
    .get()

  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json({ ...row.contract, clientName: row.clientName })
})

router.post('/', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{ clientId: string; title: string; content: string }>()

  const now = Math.floor(Date.now() / 1000)
  const contract = {
    id: crypto.randomUUID(),
    clientId: body.clientId,
    title: body.title,
    content: body.content,
    status: 'draft' as const,
    signedAt: null as number | null,
    signedByName: null as string | null,
    signedByEmail: null as string | null,
    signToken: crypto.randomUUID(),
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(contracts).values(contract)
  return c.json(contract, 201)
})

router.put('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<Partial<{ title: string; content: string; status: string }>>()

  const existing = await db.select().from(contracts).where(and(eq(contracts.id, id), eq(contracts.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  const updated = { ...body, updatedAt: now }
  await db.update(contracts).set(updated).where(eq(contracts.id, id))
  return c.json({ ...existing, ...updated })
})

// PUT /api/contracts/:id/send — mark as sent
router.put('/:id/send', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const existing = await db.select().from(contracts).where(and(eq(contracts.id, id), eq(contracts.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await db.update(contracts).set({ status: 'sent', updatedAt: now }).where(eq(contracts.id, id))
  return c.json({ ...existing, status: 'sent', updatedAt: now })
})

// PUT /api/contracts/:id/sign — mark as signed (admin can manually record this)
router.put('/:id/sign', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<{ signedByName: string; signedByEmail: string }>()
  const existing = await db.select().from(contracts).where(and(eq(contracts.id, id), eq(contracts.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await db.update(contracts).set({
    status: 'signed',
    signedAt: now,
    signedByName: body.signedByName,
    signedByEmail: body.signedByEmail,
    updatedAt: now,
  }).where(eq(contracts.id, id))
  return c.json({ ...existing, status: 'signed', signedAt: now })
})

router.delete('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const existing = await db.select().from(contracts).where(and(eq(contracts.id, id), eq(contracts.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await db.update(contracts).set({ isDeleted: true, updatedAt: now }).where(eq(contracts.id, id))
  return c.json({ ok: true })
})

export default router

import { Hono } from 'hono'
import { eq, and, desc, sql, like, or } from 'drizzle-orm'
import { getDb } from '../db'
import { clients } from '../db/schema'
import type { Env, Variables } from '../types'

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

export { router as clientsRouter }

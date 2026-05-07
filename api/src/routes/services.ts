import { Hono } from 'hono'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '../db'
import { services } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

// Public — list active services
router.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const result = await db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.sortOrder))
  return c.json(result)
})

// Admin — list all services (including inactive)
router.get('/all', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const result = await db.select().from(services).orderBy(asc(services.sortOrder))
  return c.json(result)
})

// Admin — create
router.post('/', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    name: string
    description?: string
    basePrice?: number
    isActive?: boolean
    sortOrder?: number
  }>()

  const now = Math.floor(Date.now() / 1000)
  const service = {
    id: crypto.randomUUID(),
    name: body.name,
    description: body.description ?? null,
    basePrice: body.basePrice ?? null,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(services).values(service)
  return c.json(service, 201)
})

// Admin — update
router.put('/:id', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    description?: string | null
    basePrice?: number | null
    isActive?: boolean
    sortOrder?: number
  }>()

  await db
    .update(services)
    .set({ ...body, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(services.id, id))

  const updated = await db.select().from(services).where(eq(services.id, id)).get()
  return c.json(updated)
})

// Admin — delete
router.delete('/:id', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  await db.delete(services).where(eq(services.id, id))
  return c.json({ success: true })
})

export { router as servicesRouter }

import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { notifications } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

// GET /api/notifications — list recent notifications with unread count
router.get('/', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const list = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(50)

  const unreadCount = list.filter((n) => !n.isRead).length

  return c.json({ notifications: list, unreadCount })
})

// PUT /api/notifications/read-all — mark all as read (must be before /:id)
router.put('/read-all', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false))
  return c.json({ ok: true })
})

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, c.req.param('id')))
  return c.json({ ok: true })
})

// DELETE /api/notifications/:id — delete a notification
router.delete('/:id', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  await db.delete(notifications).where(eq(notifications.id, c.req.param('id')))
  return c.json({ ok: true })
})

export default router

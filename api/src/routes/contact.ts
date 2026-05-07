import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { contactRequests } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

// Public — submit contact form
router.post('/', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    name: string
    email: string
    phone?: string
    company?: string
    message: string
  }>()

  const request = {
    id: crypto.randomUUID(),
    name: body.name,
    email: body.email,
    phone: body.phone ?? null,
    company: body.company ?? null,
    message: body.message,
    isRead: false,
    createdAt: Math.floor(Date.now() / 1000),
  }

  await db.insert(contactRequests).values(request)

  // Notify via email (best-effort)
  if (c.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${c.env.COMPANY_NAME} <${c.env.FROM_EMAIL}>`,
        to: c.env.FROM_EMAIL,
        subject: `New contact request from ${body.name}`,
        html: `<p><strong>Name:</strong> ${body.name}</p>
               <p><strong>Email:</strong> ${body.email}</p>
               ${body.phone ? `<p><strong>Phone:</strong> ${body.phone}</p>` : ''}
               ${body.company ? `<p><strong>Company:</strong> ${body.company}</p>` : ''}
               <p><strong>Message:</strong></p><p>${body.message}</p>`,
      }),
    }).catch(() => {/* non-critical */})
  }

  return c.json({ success: true }, 201)
})

// Admin — list all contact requests
router.get('/', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const result = await db
    .select()
    .from(contactRequests)
    .orderBy(desc(contactRequests.createdAt))
  return c.json(result)
})

// Admin — mark as read
router.put('/:id/read', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  await db
    .update(contactRequests)
    .set({ isRead: true })
    .where(eq(contactRequests.id, id))
  return c.json({ success: true })
})

// Admin — delete
router.delete('/:id', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  await db.delete(contactRequests).where(eq(contactRequests.id, id))
  return c.json({ success: true })
})

export { router as contactRouter }

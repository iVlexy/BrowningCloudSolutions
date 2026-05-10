import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { bugs } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── Public: create bug via API endpoint ──────────────────────────────────────
router.post('/report', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    title: string
    description: string
    priority?: string
    submitterName?: string
    submitterEmail?: string
  }>()

  if (!body.title?.trim() || !body.description?.trim()) {
    return c.json({ error: 'title and description are required' }, 400)
  }

  const bug = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    description: body.description.trim(),
    status: 'open',
    priority: ['low', 'medium', 'high', 'critical'].includes(body.priority ?? '')
      ? body.priority!
      : 'medium',
    source: 'api' as const,
    submitterName: body.submitterName ?? null,
    submitterEmail: body.submitterEmail ?? null,
    notes: null,
    isDeleted: false,
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  }

  await db.insert(bugs).values(bug)
  return c.json(bug, 201)
})

// ─── Public: inbound email webhook (SendGrid Inbound Parse) ───────────────────
router.post('/inbound-email', async (c) => {
  const db = getDb(c.env.DB)

  let from = ''
  let subject = ''
  let text = ''

  const contentType = c.req.header('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await c.req.json<{ from?: string; subject?: string; text?: string }>()
    from = body.from ?? ''
    subject = body.subject ?? ''
    text = body.text ?? ''
  } else {
    // SendGrid sends multipart/form-data
    const formData = await c.req.formData()
    from = formData.get('from') as string ?? ''
    subject = formData.get('subject') as string ?? ''
    text = formData.get('text') as string ?? ''
  }

  // Parse "Name <email>" or plain email
  const emailMatch = from.match(/<([^>]+)>/)
  const submitterEmail = emailMatch ? emailMatch[1] : from.trim()
  const nameMatch = from.match(/^([^<]+)</)
  const submitterName = nameMatch ? nameMatch[1].trim() : null

  const title = subject?.trim() || 'Bug report via email'
  const description = text?.trim() || '(no body)'

  const bug = {
    id: crypto.randomUUID(),
    title,
    description,
    status: 'open',
    priority: 'medium',
    source: 'email' as const,
    submitterName,
    submitterEmail,
    notes: null,
    isDeleted: false,
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  }

  await db.insert(bugs).values(bug)
  return c.json({ success: true }, 201)
})

// ─── Admin: list all bugs ─────────────────────────────────────────────────────
router.get('/', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const result = await db
    .select()
    .from(bugs)
    .where(eq(bugs.isDeleted, false))
    .orderBy(desc(bugs.createdAt))
  return c.json(result)
})

// ─── Admin: create bug manually ───────────────────────────────────────────────
router.post('/', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    title: string
    description: string
    priority?: string
    submitterName?: string
    submitterEmail?: string
    notes?: string
  }>()

  if (!body.title?.trim() || !body.description?.trim()) {
    return c.json({ error: 'title and description are required' }, 400)
  }

  const bug = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    description: body.description.trim(),
    status: 'open',
    priority: ['low', 'medium', 'high', 'critical'].includes(body.priority ?? '')
      ? body.priority!
      : 'medium',
    source: 'manual' as const,
    submitterName: body.submitterName ?? null,
    submitterEmail: body.submitterEmail ?? null,
    notes: body.notes ?? null,
    isDeleted: false,
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  }

  await db.insert(bugs).values(bug)
  return c.json(bug, 201)
})

// ─── Admin: update bug (status, priority, notes) ──────────────────────────────
router.put('/:id', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<{
    status?: string
    priority?: string
    notes?: string
    title?: string
    description?: string
  }>()

  const updates: Record<string, unknown> = { updatedAt: Math.floor(Date.now() / 1000) }
  if (body.status) updates.status = body.status
  if (body.priority) updates.priority = body.priority
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.title) updates.title = body.title
  if (body.description) updates.description = body.description

  await db.update(bugs).set(updates).where(eq(bugs.id, id))
  const updated = await db.select().from(bugs).where(eq(bugs.id, id))
  return c.json(updated[0])
})

// ─── Admin: delete bug (soft) ─────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  await db.update(bugs).set({
    isDeleted: true,
    updatedAt: Math.floor(Date.now() / 1000),
  }).where(eq(bugs.id, id))
  return c.json({ success: true })
})

export { router as bugsRouter }

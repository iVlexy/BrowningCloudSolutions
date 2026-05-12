import { Hono } from 'hono'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { getDb } from '../db'
import { proposals, proposalLineItems, clients } from '../db/schema'
import { createNotification } from '../lib/notifications'
import { authMiddleware } from '../middleware/auth'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── Public: view proposal by token ─────────────────────────────────────────
router.get('/view/:token', async (c) => {
  const db = getDb(c.env.DB)
  const row = await db
    .select({ proposal: proposals, clientName: clients.name })
    .from(proposals)
    .leftJoin(clients, eq(proposals.clientId, clients.id))
    .where(and(eq(proposals.viewToken, c.req.param('token')), eq(proposals.isDeleted, false)))
    .get()

  if (!row) return c.json({ error: 'Not found' }, 404)

  const items = await db
    .select()
    .from(proposalLineItems)
    .where(eq(proposalLineItems.proposalId, row.proposal.id))

  return c.json({ ...row.proposal, clientName: row.clientName, lineItems: items })
})

// ─── Public: client responds (accept / decline) ───────────────────────────────
router.put('/respond/:token', async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{ decision: 'accepted' | 'declined' }>()

  if (!['accepted', 'declined'].includes(body.decision)) {
    return c.json({ error: 'decision must be accepted or declined' }, 400)
  }

  const proposal = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.viewToken, c.req.param('token')), eq(proposals.isDeleted, false)))
    .get()

  if (!proposal) return c.json({ error: 'Not found' }, 404)
  if (proposal.status !== 'sent') return c.json({ error: 'Proposal is not open for response' }, 400)

  const now = Math.floor(Date.now() / 1000)
  await db
    .update(proposals)
    .set({ status: body.decision, updatedAt: now })
    .where(eq(proposals.id, proposal.id))

  const client = await db.select().from(clients).where(eq(clients.id, proposal.clientId)).get()
  const verb = body.decision === 'accepted' ? 'accepted' : 'declined'
  await createNotification(
    db,
    'proposal_responded',
    `${client?.name ?? 'A client'} ${verb} proposal "${proposal.title}"`,
    `/admin/proposals`,
  )

  return c.json({ ok: true, status: body.decision })
})

// ─── Admin: generate narrative with AI ───────────────────────────────────────
router.post('/generate-narrative', authMiddleware, async (c) => {
  const body = await c.req.json<{ brief: string; clientName?: string }>()

  if (!body.brief?.trim()) return c.json({ error: 'brief is required' }, 400)

  const messages = [
    {
      role: 'system' as const,
      content:
        'You are a professional freelance web developer writing a client proposal. ' +
        'Write in first person with a professional but approachable tone. ' +
        'Be concise (2-3 paragraphs). No bullet points. No headers. No markdown formatting.',
    },
    {
      role: 'user' as const,
      content: `Write a proposal narrative${body.clientName ? ` for client "${body.clientName}"` : ''} based on this brief: ${body.brief}`,
    },
  ]

  const result = await (c.env.AI.run as any)('@cf/meta/llama-3.1-8b-instruct', { messages })
  return c.json({ narrative: result.response ?? '' })
})

// ─── Admin: list all proposals ────────────────────────────────────────────────
router.get('/', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const clientId = c.req.query('clientId')

  const rows = await db
    .select({ proposal: proposals, clientName: clients.name })
    .from(proposals)
    .leftJoin(clients, eq(proposals.clientId, clients.id))
    .where(and(eq(proposals.isDeleted, false), ...(clientId ? [eq(proposals.clientId, clientId)] : [])))
    .orderBy(desc(proposals.createdAt))

  // Load all line items for these proposals in one query
  const ids = rows.map((r) => r.proposal.id)
  const allItems = ids.length
    ? await db.select().from(proposalLineItems).where(inArray(proposalLineItems.proposalId, ids))
    : []

  return c.json(
    rows.map((r) => ({
      ...r.proposal,
      clientName: r.clientName,
      lineItems: allItems.filter((i) => i.proposalId === r.proposal.id),
      total: allItems
        .filter((i) => i.proposalId === r.proposal.id)
        .reduce((sum, i) => sum + i.qty * i.unitPrice, 0),
    })),
  )
})

// ─── Admin: get single proposal ───────────────────────────────────────────────
router.get('/:id', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const row = await db
    .select({ proposal: proposals, clientName: clients.name })
    .from(proposals)
    .leftJoin(clients, eq(proposals.clientId, clients.id))
    .where(and(eq(proposals.id, c.req.param('id')), eq(proposals.isDeleted, false)))
    .get()

  if (!row) return c.json({ error: 'Not found' }, 404)

  const items = await db
    .select()
    .from(proposalLineItems)
    .where(eq(proposalLineItems.proposalId, row.proposal.id))

  return c.json({ ...row.proposal, clientName: row.clientName, lineItems: items })
})

// ─── Admin: create proposal ───────────────────────────────────────────────────
router.post('/', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const body = await c.req.json<{
    clientId: string
    title: string
    narrative?: string
    notes?: string
    lineItems?: Array<{ description: string; qty: number; unitPrice: number }>
  }>()

  const now = Math.floor(Date.now() / 1000)
  const proposal = {
    id: crypto.randomUUID(),
    clientId: body.clientId,
    title: body.title,
    narrative: body.narrative ?? null,
    notes: body.notes ?? null,
    status: 'draft',
    viewToken: null,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(proposals).values(proposal)

  if (body.lineItems?.length) {
    await db.insert(proposalLineItems).values(
      body.lineItems.map((item) => ({
        id: crypto.randomUUID(),
        proposalId: proposal.id,
        description: item.description,
        qty: item.qty,
        unitPrice: item.unitPrice,
      })),
    )
  }

  return c.json(proposal, 201)
})

// ─── Admin: update proposal ───────────────────────────────────────────────────
router.put('/:id', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')
  const body = await c.req.json<{
    title?: string
    narrative?: string
    notes?: string
    lineItems?: Array<{ description: string; qty: number; unitPrice: number }>
  }>()

  const existing = await db.select().from(proposals).where(and(eq(proposals.id, id), eq(proposals.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await db.update(proposals).set({ title: body.title, narrative: body.narrative, notes: body.notes, updatedAt: now }).where(eq(proposals.id, id))

  if (body.lineItems !== undefined) {
    // Replace all line items
    await db.delete(proposalLineItems).where(eq(proposalLineItems.proposalId, id))
    if (body.lineItems.length) {
      await db.insert(proposalLineItems).values(
        body.lineItems.map((item) => ({
          id: crypto.randomUUID(),
          proposalId: id,
          description: item.description,
          qty: item.qty,
          unitPrice: item.unitPrice,
        })),
      )
    }
  }

  return c.json({ ok: true })
})

// ─── Admin: send proposal (generates public link) ────────────────────────────
router.put('/:id/send', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  const existing = await db.select().from(proposals).where(and(eq(proposals.id, id), eq(proposals.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  const viewToken = existing.viewToken ?? crypto.randomUUID()
  await db.update(proposals).set({ status: 'sent', viewToken, updatedAt: now }).where(eq(proposals.id, id))

  return c.json({ ...existing, status: 'sent', viewToken })
})

// ─── Admin: delete proposal ───────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  const existing = await db.select().from(proposals).where(and(eq(proposals.id, id), eq(proposals.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  await db.update(proposals).set({ isDeleted: true, updatedAt: now }).where(eq(proposals.id, id))
  return c.json({ ok: true })
})

export default router

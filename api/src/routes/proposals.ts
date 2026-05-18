import { Hono } from 'hono'
import { eq, and, desc, inArray, sql, like } from 'drizzle-orm'
import { getDb } from '../db'
import { proposals, proposalLineItems, clients, invoices, invoiceItems } from '../db/schema'
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

  let invoiceId: string | null = null
  if (body.decision === 'accepted') {
    const items = await db.select().from(proposalLineItems).where(eq(proposalLineItems.proposalId, proposal.id))

    const year = new Date().getFullYear()
    const prefix = `INV-${year}-`
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(like(invoices.invoiceNumber, `${prefix}%`))
    const nextNum = (countResult[0]?.count ?? 0) + 1
    const invoiceNumber = `${prefix}${String(nextNum).padStart(4, '0')}`

    const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
    invoiceId = crypto.randomUUID()
    const inv = {
      id: invoiceId,
      invoiceNumber,
      clientId: proposal.clientId,
      status: 'draft' as const,
      dueDate: null,
      notes: proposal.notes ?? null,
      subtotal,
      taxRate: 0,
      taxAmount: 0,
      total: subtotal,
      paymentToken: crypto.randomUUID().replace(/-/g, ''),
      sentAt: null,
      paidAt: null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(invoices).values(inv)

    if (items.length > 0) {
      await db.insert(invoiceItems).values(
        items.map((item, idx) => ({
          id: crypto.randomUUID(),
          invoiceId: invoiceId!,
          description: item.description,
          quantity: item.qty,
          unitPrice: item.unitPrice,
          amount: item.qty * item.unitPrice,
          sortOrder: idx,
        }))
      )
    }
  }

  await createNotification(
    db,
    'proposal_responded',
    `${client?.name ?? 'A client'} ${verb} proposal "${proposal.title}"${body.decision === 'accepted' ? ' — draft invoice created' : ''}`,
    invoiceId ? `/admin/invoices/${invoiceId}` : `/admin/proposals`,
  )

  return c.json({ ok: true, status: body.decision, invoiceId })
})

// ─── Admin: generate narrative with AI ───────────────────────────────────────
router.post('/generate-narrative', authMiddleware, async (c) => {
  const body = await c.req.json<{ brief: string; clientName?: string }>()

  if (!body.brief?.trim()) return c.json({ error: 'brief is required' }, 400)

  const clientStr = body.clientName ? ` for ${body.clientName}` : ''

  const messages = [
    {
      role: 'system' as const,
      content:
        'You are a professional freelance web developer writing the body of a client proposal. ' +
        'Rules you must follow exactly:\n' +
        '- Write exactly 2 short paragraphs, no more.\n' +
        '- First paragraph: briefly restate the project scope and what you will deliver.\n' +
        '- Second paragraph: explain your approach and why the client can trust you to deliver it.\n' +
        '- Do NOT include a greeting, sign-off, "Dear", "Hi", "Sincerely", "Best regards", your name, or any salutation.\n' +
        '- Do NOT use bullet points, headers, bold, or any markdown.\n' +
        '- Do NOT mention pricing — that appears separately.\n' +
        '- Write in first person, professional but approachable.\n' +
        '- Keep each paragraph to 2-3 sentences.',
    },
    {
      role: 'user' as const,
      content: `Project brief${clientStr}: ${body.brief}`,
    },
  ]

  const result = await (c.env.AI.run as any)('@cf/meta/llama-3.1-8b-instruct', { messages, max_tokens: 300 })
  return c.json({ narrative: (result.response ?? '').trim() })
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

// ─── Admin: send proposal (generates public link + emails client) ────────────
router.put('/:id/send', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const id = c.req.param('id')

  const existing = await db.select().from(proposals).where(and(eq(proposals.id, id), eq(proposals.isDeleted, false))).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const client = await db.select().from(clients).where(eq(clients.id, existing.clientId)).get()
  if (!client) return c.json({ error: 'Client not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  const viewToken = existing.viewToken ?? crypto.randomUUID()
  // Preserve original sentAt so reminder timing is based on first send
  const sentAt = (existing as any).sentAt ?? now
  await db.update(proposals).set({ status: 'sent', viewToken, sentAt, updatedAt: now }).where(eq(proposals.id, id))

  const proposalUrl = `${c.env.FRONTEND_URL}/proposal/${viewToken}`
  const items = await db.select().from(proposalLineItems).where(eq(proposalLineItems.proposalId, id))
  const total = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)

  const emailHtml = generateProposalEmail({
    proposal: { ...existing, viewToken },
    client,
    items,
    total,
    proposalUrl,
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
      subject: `Proposal: ${existing.title} — ${c.env.COMPANY_NAME}`,
      content: [{ type: 'text/html', value: emailHtml }],
    }),
  })

  if (!emailRes.ok) {
    const err = await emailRes.text()
    console.error('SendGrid error:', err)
    return c.json({ error: 'Failed to send email' }, 500)
  }

  return c.json({ ...existing, status: 'sent', viewToken })
})

function generateProposalEmail({
  proposal,
  client,
  items,
  total,
  proposalUrl,
  companyName,
}: {
  proposal: { title: string; narrative: string | null; notes: string | null }
  client: { name: string; email: string }
  items: Array<{ description: string; qty: number; unitPrice: number }>
  total: number
  proposalUrl: string
  companyName: string
}) {
  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;">${item.description}</td>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:center;">${item.qty}</td>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:right;">$${(item.qty * item.unitPrice).toFixed(2)}</td>
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
      <p style="margin:8px 0 0;color:#90CAF9;font-size:14px;">Project Proposal</p>
    </div>
    <div style="padding:40px;">
      <p style="margin:0 0 8px;">Hi ${client.name},</p>
      <p style="margin:0 0 24px;color:#555;">I've prepared a proposal for <strong>${proposal.title}</strong>. Please review it using the link below and let me know if you'd like to move forward.</p>
      ${proposal.narrative ? `<div style="background:#f9f9f9;border-left:4px solid #1565C0;padding:20px 24px;border-radius:0 6px 6px 0;margin-bottom:28px;color:#444;line-height:1.7;font-size:15px;">${proposal.narrative.replace(/\n/g, '<br>')}</div>` : ''}
      ${items.length > 0 ? `
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
      <div style="text-align:right;margin-bottom:28px;">
        <p style="margin:0;font-size:18px;font-weight:bold;color:#1a2332;">Estimated Total: $${total.toFixed(2)}</p>
      </div>` : ''}
      ${proposal.notes ? `<p style="padding:16px;background:#f9f9f9;border-radius:6px;color:#555;font-size:14px;">${proposal.notes}</p>` : ''}
      <div style="text-align:center;margin:32px 0;">
        <a href="${proposalUrl}" style="display:inline-block;background:#1565C0;color:#fff;padding:16px 40px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">Review &amp; Respond to Proposal</a>
      </div>
      <p style="color:#888;font-size:13px;text-align:center;">Or copy this link: <a href="${proposalUrl}" style="color:#1565C0;">${proposalUrl}</a></p>
      <hr style="margin:32px 0;border:none;border-top:1px solid #eee;">
      <p style="color:#888;font-size:12px;text-align:center;">Thank you for considering ${companyName}</p>
    </div>
  </div>
</body>
</html>`
}

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

// ─── Shared: run proposal reminders (used by cron + manual endpoint) ─────────
export async function runProposalReminders(env: Env): Promise<number> {
  const db = getDb(env.DB)
  const now = Math.floor(Date.now() / 1000)
  const threeDaysAgo = now - 3 * 86400

  // Find sent proposals with no reminder yet, sent 3+ days ago (or sentAt unknown)
  const pending = await db
    .select({ proposal: proposals, clientName: clients.name, clientEmail: clients.email })
    .from(proposals)
    .leftJoin(clients, eq(proposals.clientId, clients.id))
    .where(
      and(
        eq(proposals.status, 'sent'),
        eq(proposals.isDeleted, false),
        sql`${proposals.reminderSentAt} IS NULL`,
        sql`(${proposals.sentAt} IS NULL OR ${proposals.sentAt} <= ${threeDaysAgo})`
      )
    )

  let count = 0
  for (const row of pending) {
    if (!row.clientEmail) continue
    const sentAt = (row.proposal as any).sentAt as number | null
    const daysSinceSent = sentAt ? Math.floor((now - sentAt) / 86400) : 3
    const proposalUrl = `${env.FRONTEND_URL}/proposal/${row.proposal.viewToken}`

    const html = generateProposalReminderEmail({
      clientName: row.clientName ?? 'there',
      proposalTitle: row.proposal.title,
      daysSinceSent,
      proposalUrl,
      companyName: env.COMPANY_NAME,
    })

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: row.clientEmail }] }],
        from: { email: env.FROM_EMAIL, name: env.COMPANY_NAME },
        subject: `Reminder: Your proposal from ${env.COMPANY_NAME} is awaiting your response`,
        content: [{ type: 'text/html', value: html }],
      }),
    })

    if (res.ok) {
      await db
        .update(proposals)
        .set({ reminderSentAt: now, updatedAt: now } as any)
        .where(eq(proposals.id, row.proposal.id))
      count++
    } else {
      console.error('Reminder email failed for proposal', row.proposal.id, await res.text())
    }
  }
  return count
}

// ─── Admin: manually trigger proposal reminders ─────────────────────────────
router.post('/send-reminders', authMiddleware, async (c) => {
  const count = await runProposalReminders(c.env)
  return c.json({ ok: true, reminded: count })
})

export function generateProposalReminderEmail({
  clientName,
  proposalTitle,
  daysSinceSent,
  proposalUrl,
  companyName,
}: {
  clientName: string
  proposalTitle: string
  daysSinceSent: number
  proposalUrl: string
  companyName: string
}) {
  const dayStr = daysSinceSent === 1 ? '1 day' : `${daysSinceSent} days`
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#1565C0;padding:24px 40px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">${companyName}</h1>
      <p style="margin:6px 0 0;color:#90CAF9;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Automated Reminder</p>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:14px;color:#333;">Hi ${clientName},</p>
      <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Pending Response</p>
      <div style="border:1px solid #e0e0e0;border-radius:6px;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1a2332;">${proposalTitle}</p>
        <p style="margin:0;font-size:13px;color:#888;">Sent ${dayStr} ago &mdash; no response recorded</p>
      </div>
      <p style="margin:0 0 28px;color:#555;font-size:14px;line-height:1.6;">
        This is an automated reminder that the proposal above is still awaiting your response.
        Use the link below to review and respond at your convenience.
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${proposalUrl}"
           style="display:inline-block;background:#1565C0;color:#fff;padding:14px 36px;
                  text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
          Review Proposal
        </a>
      </div>
      <hr style="margin:28px 0;border:none;border-top:1px solid #eee;">
      <p style="color:#aaa;font-size:12px;text-align:center;margin:0;">
        This is an automated message. Do not reply to this email.<br>
        Questions? Contact <a href="mailto:${companyName.toLowerCase().replace(/\s+/g, '')}@browningcloud.com" style="color:#1565C0;">${companyName}</a> directly.
      </p>
    </div>
  </div>
</body>
</html>`
}

export default router

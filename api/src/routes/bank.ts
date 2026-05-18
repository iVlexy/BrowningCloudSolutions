import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { bankConnections, expenses } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── GET /api/bank/status ────────────────────────────────────────────────────
router.get('/status', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const conn = await db.select({
    institutionName: bankConnections.institutionName,
    connectedAt: bankConnections.connectedAt,
  }).from(bankConnections).get()
  return c.json({ connected: !!conn, institution: conn?.institutionName ?? null, connectedAt: conn?.connectedAt ?? null })
})

// ─── POST /api/bank/link-token ───────────────────────────────────────────────
router.post('/link-token', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const redirectUri = (body as any).redirectUri as string | undefined

  const resp = await fetch(`${c.env.PLAID_BASE_URL}/link/token/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: c.env.PLAID_CLIENT_ID,
      secret: c.env.PLAID_SECRET,
      user: { client_user_id: 'admin' },
      client_name: c.env.COMPANY_NAME,
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    }),
  })
  const data = await resp.json() as any
  if (!resp.ok) return c.json({ error: data.error_message ?? 'Plaid error' }, 500)
  return c.json({ linkToken: data.link_token })
})

// ─── POST /api/bank/connect ──────────────────────────────────────────────────
router.post('/connect', authMiddleware, async (c) => {
  const { publicToken, institutionName } = await c.req.json()
  const resp = await fetch(`${c.env.PLAID_BASE_URL}/item/public_token/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: c.env.PLAID_CLIENT_ID,
      secret: c.env.PLAID_SECRET,
      public_token: publicToken,
    }),
  })
  const data = await resp.json() as any
  if (!resp.ok) return c.json({ error: data.error_message ?? 'Plaid error' }, 500)

  const db = getDb(c.env.DB)
  // Only one connection at a time
  await db.delete(bankConnections)
  await db.insert(bankConnections).values({
    id: crypto.randomUUID(),
    accessToken: data.access_token,
    itemId: data.item_id,
    institutionName: institutionName ?? 'Bank',
    connectedAt: Math.floor(Date.now() / 1000),
  })
  return c.json({ ok: true })
})

// ─── DELETE /api/bank/disconnect ─────────────────────────────────────────────
router.delete('/disconnect', authMiddleware, async (c) => {
  const db = getDb(c.env.DB)
  const conn = await db.select().from(bankConnections).get()
  if (conn) {
    await fetch(`${c.env.PLAID_BASE_URL}/item/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: c.env.PLAID_CLIENT_ID,
        secret: c.env.PLAID_SECRET,
        access_token: conn.accessToken,
      }),
    }).catch(() => {}) // best-effort removal from Plaid
    await db.delete(bankConnections)
  }
  return c.json({ ok: true })
})

// ─── POST /api/bank/sync ─────────────────────────────────────────────────────
router.post('/sync', authMiddleware, async (c) => {
  const count = await syncBankTransactions(c.env)
  return c.json({ ok: true, imported: count })
})

// ─── Shared: sync bank transactions (cron + manual trigger) ──────────────────
export async function syncBankTransactions(env: Env): Promise<number> {
  const db = getDb(env.DB)
  const conn = await db.select().from(bankConnections).get()
  if (!conn) return 0

  let cursor: string | undefined = conn.cursor ?? undefined
  let hasMore = true
  let imported = 0

  while (hasMore) {
    const resp = await fetch(`${env.PLAID_BASE_URL}/transactions/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.PLAID_CLIENT_ID,
        secret: env.PLAID_SECRET,
        access_token: conn.accessToken,
        cursor,
        count: 100,
      }),
    })
    if (!resp.ok) {
      console.error('Plaid sync error:', await resp.text())
      break
    }
    const data = await resp.json() as any
    const now = Math.floor(Date.now() / 1000)

    // Import new transactions (debits only — positive amount = money out)
    for (const txn of data.added ?? []) {
      if (txn.amount <= 0) continue // skip credits/income
      try {
        await db.insert(expenses).values({
          id: crypto.randomUUID(),
          plaidTransactionId: txn.transaction_id,
          category: mapPlaidCategory(txn.personal_finance_category?.primary ?? ''),
          description: txn.name,
          amount: Math.abs(txn.amount),
          date: Math.floor(new Date(txn.date).getTime() / 1000),
          notes: `Auto-imported from ${conn.institutionName}`,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoNothing()
        imported++
      } catch (e) {
        console.error('Failed to insert expense:', txn.transaction_id, e)
      }
    }

    // Update modified transactions
    for (const txn of data.modified ?? []) {
      if (txn.amount <= 0) continue
      await db.update(expenses)
        .set({ amount: Math.abs(txn.amount), description: txn.name, updatedAt: now })
        .where(eq(expenses.plaidTransactionId, txn.transaction_id))
    }

    // Soft-delete removed transactions
    for (const txn of data.removed ?? []) {
      await db.update(expenses)
        .set({ isDeleted: true, updatedAt: now })
        .where(eq(expenses.plaidTransactionId, txn.transaction_id))
    }

    cursor = data.next_cursor
    hasMore = data.has_more

    // Persist cursor after each page
    await db.update(bankConnections)
      .set({ cursor })
      .where(eq(bankConnections.id, conn.id))
  }

  return imported
}

function mapPlaidCategory(primary: string): string {
  const map: Record<string, string> = {
    TRAVEL: 'travel',
    TRANSPORTATION: 'travel',
    RENT_AND_UTILITIES: 'utilities',
    GENERAL_SERVICES: 'other',
    HOME_IMPROVEMENT: 'other',
    FOOD_AND_DRINK: 'other',
    GENERAL_MERCHANDISE: 'other',
    ENTERTAINMENT: 'other',
    MEDICAL: 'other',
    PERSONAL_CARE: 'other',
    LOAN_PAYMENTS: 'other',
    BANK_FEES: 'other',
    TRANSFER_IN: 'other',
    TRANSFER_OUT: 'other',
    GOVERNMENT_AND_NON_PROFIT: 'other',
  }
  return map[primary] ?? 'other'
}

export default router

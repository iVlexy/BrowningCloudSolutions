import { Hono } from 'hono'
import { eq, and, gte, inArray, sql, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { payments, invoices, clients, invoiceItems } from '../db/schema'
import type { Env, Variables } from '../types'

const router = new Hono<{ Bindings: Env; Variables: Variables }>()

router.get('/', async (c) => {
  const db = getDb(c.env.DB)
  const now = Math.floor(Date.now() / 1000)

  // Start of current year (UTC)
  const yearStart = Math.floor(new Date(new Date().getUTCFullYear(), 0, 1).getTime() / 1000)

  // Start of rolling 12-month window
  const twelveMonthsAgo = Math.floor(new Date(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth() - 11,
    1
  ).getTime() / 1000)

  const [
    ytdResult,
    monthlyResult,
    recentPayments,
    overdueCount,
    outstandingResult,
  ] = await Promise.all([
    // YTD revenue
    db
      .select({ total: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .where(and(eq(payments.status, 'completed'), gte(payments.paidAt, yearStart)))
      .get(),

    // Monthly revenue — last 12 months, grouped by YYYY-MM
    db.all<{ month: string; total: number }>(
      sql`SELECT strftime('%Y-%m', datetime(${payments.paidAt}, 'unixepoch')) as month,
                 COALESCE(SUM(${payments.amount}), 0) as total
          FROM ${payments}
          WHERE ${payments.status} = 'completed'
            AND ${payments.paidAt} >= ${twelveMonthsAgo}
          GROUP BY month
          ORDER BY month`
    ),

    // Recent payments (last 10) with client name + invoice number
    db.all<{
      id: string; amount: number; method: string; paidAt: number
      invoiceNumber: string; clientName: string
    }>(
      sql`SELECT p.id, p.amount, p.method, p.paid_at as paidAt,
                 i.invoice_number as invoiceNumber, cl.name as clientName
          FROM ${payments} p
          JOIN ${invoices} i ON i.id = p.invoice_id
          JOIN ${clients} cl ON cl.id = i.client_id
          WHERE p.status = 'completed'
          ORDER BY p.paid_at DESC
          LIMIT 10`
    ),

    // Overdue invoice count
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(invoices)
      .where(and(eq(invoices.status, 'overdue'), eq(invoices.isDeleted, false)))
      .get(),

    // Outstanding balance (total owed on unpaid invoices)
    db.get<{ outstanding: number }>(
      sql`SELECT COALESCE(SUM(
            i.total - COALESCE((
              SELECT SUM(p2.amount) FROM ${payments} p2
              WHERE p2.invoice_id = i.id AND p2.status = 'completed'
            ), 0)
          ), 0) as outstanding
          FROM ${invoices} i
          WHERE i.status NOT IN ('paid', 'cancelled')
            AND i.is_deleted = 0`
    ),
  ])

  // Fill in any missing months in the last 12 with zero
  const monthlyMap = new Map(monthlyResult.map((r) => [r.month, r.total]))
  const monthlyRevenue: { month: string; total: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setUTCMonth(d.getUTCMonth() - i, 1)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    monthlyRevenue.push({ month: key, total: monthlyMap.get(key) ?? 0 })
  }

  return c.json({
    ytdRevenue: ytdResult?.total ?? 0,
    outstandingBalance: outstandingResult?.outstanding ?? 0,
    overdueCount: overdueCount?.count ?? 0,
    monthlyRevenue,
    recentPayments,
  })
})

export default router

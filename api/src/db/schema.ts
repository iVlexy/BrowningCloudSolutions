import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Clients ─────────────────────────────────────────────────────────────────
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  company: text('company'),
  address: text('address'),
  notes: text('notes'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull(),
})

// ─── Services ────────────────────────────────────────────────────────────────
export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  basePrice: real('base_price'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull(),
})

// ─── Invoices ─────────────────────────────────────────────────────────────────
// status: draft | sent | partial | paid | overdue | cancelled
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  clientId: text('client_id').notNull().references(() => clients.id),
  status: text('status').default('draft').notNull(),
  dueDate: integer('due_date'),
  notes: text('notes'),
  subtotal: real('subtotal').default(0).notNull(),
  taxRate: real('tax_rate').default(0).notNull(),
  taxAmount: real('tax_amount').default(0).notNull(),
  total: real('total').default(0).notNull(),
  paymentToken: text('payment_token').unique(),
  sentAt: integer('sent_at'),
  paidAt: integer('paid_at'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull(),
})

// ─── Invoice Items ────────────────────────────────────────────────────────────
export const invoiceItems = sqliteTable('invoice_items', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  description: text('description').notNull(),
  quantity: real('quantity').default(1).notNull(),
  unitPrice: real('unit_price').default(0).notNull(),
  amount: real('amount').default(0).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
})

// ─── Payments ─────────────────────────────────────────────────────────────────
// method: stripe | cash | check | bank_transfer
// status: pending | completed | failed | refunded
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  amount: real('amount').notNull(),
  method: text('method').notNull(),
  status: text('status').default('completed').notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  checkNumber: text('check_number'),
  notes: text('notes'),
  paidAt: integer('paid_at').default(sql`(unixepoch())`).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
})

// ─── Contact Requests ─────────────────────────────────────────────────────────
export const contactRequests = sqliteTable('contact_requests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  company: text('company'),
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
})

// ─── Types ────────────────────────────────────────────────────────────────────
export type Client = typeof clients.$inferSelect
export type NewClient = typeof clients.$inferInsert
export type Service = typeof services.$inferSelect
export type NewService = typeof services.$inferInsert
export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type InvoiceItem = typeof invoiceItems.$inferSelect
export type Payment = typeof payments.$inferSelect
export type ContactRequest = typeof contactRequests.$inferSelect

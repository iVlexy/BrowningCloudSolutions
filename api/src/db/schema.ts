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
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),  // ─── Recurring billing ──────────────────────────────────────────────────────
  monthlyAmount: real('monthly_amount'),
  billingMethod: text('billing_method'), // 'stripe' | 'manual' | null
  recurringActive: integer('recurring_active', { mode: 'boolean' }).default(false).notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  recurringStartDate: integer('recurring_start_date'), // unix timestamp, null = start immediately
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

// ─── Bugs ─────────────────────────────────────────────────────────────────────
// status: open | in_progress | resolved | closed
// priority: low | medium | high | critical
// source: manual | email | api
export const bugs = sqliteTable('bugs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').default('open').notNull(),
  priority: text('priority').default('medium').notNull(),
  source: text('source').default('manual').notNull(),
  submitterName: text('submitter_name'),
  submitterEmail: text('submitter_email'),
  notes: text('notes'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull(),
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

// ─── Client Sessions (portal magic-link auth) ────────────────────────────────
export const clientSessions = sqliteTable('client_sessions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
})

// ─── Support Tickets ─────────────────────────────────────────────────────────
export const supportTickets = sqliteTable('support_tickets', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').default('open').notNull(), // open | in_progress | resolved | closed
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull(),
})

// ─── Expenses ─────────────────────────────────────────────────────────────────
// category: software | hardware | marketing | travel | labor | utilities | other
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  date: integer('date').notNull(),
  clientId: text('client_id').references(() => clients.id),
  receiptUrl: text('receipt_url'),
  notes: text('notes'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull(),
})

// ─── Time Entries ─────────────────────────────────────────────────────────────
export const timeEntries = sqliteTable('time_entries', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id),
  date: integer('date').notNull(),
  hours: real('hours').notNull(),
  description: text('description').notNull(),
  rate: real('rate').notNull(),
  invoiced: integer('invoiced', { mode: 'boolean' }).default(false).notNull(),
  invoiceId: text('invoice_id').references(() => invoices.id),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull(),
})

// ─── Contracts ────────────────────────────────────────────────────────────────
// status: draft | sent | signed | declined
export const contracts = sqliteTable('contracts', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  status: text('status').default('draft').notNull(),
  signedAt: integer('signed_at'),
  signedByName: text('signed_by_name'),
  signedByEmail: text('signed_by_email'),
  signToken: text('sign_token').unique(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull(),
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
export type Bug = typeof bugs.$inferSelect
export type NewBug = typeof bugs.$inferInsert
export type ClientSession = typeof clientSessions.$inferSelect
export type SupportTicket = typeof supportTickets.$inferSelect
export type Expense = typeof expenses.$inferSelect
export type NewExpense = typeof expenses.$inferInsert
export type TimeEntry = typeof timeEntries.$inferSelect
export type NewTimeEntry = typeof timeEntries.$inferInsert
export type Contract = typeof contracts.$inferSelect
export type NewContract = typeof contracts.$inferInsert

// ─── Proposals ───────────────────────────────────────────────────────────────────────────────
// status: draft | sent | accepted | declined
export const proposals = sqliteTable('proposals', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id),
  title: text('title').notNull(),
  narrative: text('narrative'),
  status: text('status').default('draft').notNull(),
  viewToken: text('view_token').unique(),
  notes: text('notes'),
  sentAt: integer('sent_at'),
  reminderSentAt: integer('reminder_sent_at'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`).notNull(),
})

export const proposalLineItems = sqliteTable('proposal_line_items', {
  id: text('id').primaryKey(),
  proposalId: text('proposal_id').notNull().references(() => proposals.id),
  description: text('description').notNull(),
  qty: real('qty').notNull().default(1),
  unitPrice: real('unit_price').notNull(),
})

// ─── Notifications ────────────────────────────────────────────────────────────────────────────
// type: contact_request | bug_report | invoice_paid | proposal_responded | contract_signed
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  link: text('link'),
  isRead: integer('is_read', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`).notNull(),
})

export type Proposal = typeof proposals.$inferSelect
export type NewProposal = typeof proposals.$inferInsert
export type ProposalLineItem = typeof proposalLineItems.$inferSelect
export type Notification = typeof notifications.$inferSelect

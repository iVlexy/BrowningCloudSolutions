// ─── Client ───────────────────────────────────────────────────────────────────
export interface Client {
  id: string
  name: string
  email: string
  phone?: string | null
  company?: string | null
  address?: string | null
  notes?: string | null
  monthlyAmount?: number | null
  billingMethod?: 'stripe' | 'manual' | null
  recurringActive?: boolean
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  recurringStartDate?: number | null
  createdAt: number
  updatedAt: number
}

// ─── Service ──────────────────────────────────────────────────────────────────
export interface Service {
  id: string
  name: string
  description?: string | null
  basePrice?: number | null
  isActive: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled'

export interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string
  clientName?: string
  clientCompany?: string | null
  client?: Client
  status: InvoiceStatus
  dueDate?: number | null
  notes?: string | null
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  paymentToken?: string
  items?: InvoiceItem[]
  payments?: Payment[]
  sentAt?: number | null
  paidAt?: number | null
  createdAt: number
  updatedAt: number
}

export interface InvoiceItem {
  id: string
  invoiceId: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  sortOrder: number
}

// ─── Payment ──────────────────────────────────────────────────────────────────
export type PaymentMethod = 'stripe' | 'cash' | 'check' | 'bank_transfer'
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  stripePaymentIntentId?: string | null
  stripeCheckoutSessionId?: string | null
  checkNumber?: string | null
  notes?: string | null
  paidAt: number
  createdAt: number
}

// ─── Contact Request ──────────────────────────────────────────────────────────
export interface ContactRequest {
  id: string
  name: string
  email: string
  phone?: string | null
  company?: string | null
  message: string
  isRead: boolean
  createdAt: number
}

// ─── Public Invoice (payment page) ───────────────────────────────────────────
export interface PublicInvoice {
  invoiceNumber: string
  status: InvoiceStatus
  dueDate?: number | null
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  amountPaid: number
  amountDue: number
  client: { name: string; company?: string | null }
  items: InvoiceItem[]
}

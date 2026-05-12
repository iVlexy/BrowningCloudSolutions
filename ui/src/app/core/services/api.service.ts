import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable } from 'rxjs'
import { environment } from '../../../environments/environment'
import type {
  Client,
  Service,
  Invoice,
  Payment,
  ContactRequest,
  PublicInvoice,
  Bug,
} from '../../shared/models'

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient)
  private base = environment.apiUrl

  // ─── Clients ────────────────────────────────────────────────────────────────
  getClients(search?: string): Observable<Client[]> {
    let params = new HttpParams()
    if (search) params = params.set('search', search)
    return this.http.get<Client[]>(`${this.base}/api/clients`, { params })
  }

  getClient(id: string): Observable<Client> {
    return this.http.get<Client>(`${this.base}/api/clients/${id}`)
  }

  createClient(data: Partial<Client>): Observable<Client> {
    return this.http.post<Client>(`${this.base}/api/clients`, data)
  }

  updateClient(id: string, data: Partial<Client>): Observable<Client> {
    return this.http.put<Client>(`${this.base}/api/clients/${id}`, data)
  }

  deleteClient(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/api/clients/${id}`)
  }

  setupRecurring(clientId: string, data: { amount: number; method: 'stripe' | 'manual'; startDate?: string }): Observable<{ success?: boolean; checkoutUrl?: string }> {
    return this.http.post<{ success?: boolean; checkoutUrl?: string }>(`${this.base}/api/clients/${clientId}/recurring/setup`, data)
  }

  sendRecurringSetupEmail(clientId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/api/clients/${clientId}/recurring/send`, {})
  }

  cancelRecurring(clientId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/api/clients/${clientId}/recurring`)
  }

  // ─── Invoices ────────────────────────────────────────────────────────────────
  getInvoices(params?: { clientId?: string; status?: string }): Observable<Invoice[]> {
    let httpParams = new HttpParams()
    if (params?.clientId) httpParams = httpParams.set('clientId', params.clientId)
    if (params?.status) httpParams = httpParams.set('status', params.status)
    return this.http.get<Invoice[]>(`${this.base}/api/invoices`, { params: httpParams })
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/api/invoices/${id}`)
  }

  createInvoice(data: {
    clientId: string
    dueDate?: number | null
    notes?: string | null
    taxRate?: number
    items: Array<{ description: string; quantity: number; unitPrice: number }>
  }): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/api/invoices`, data)
  }

  updateInvoice(
    id: string,
    data: {
      dueDate?: number | null
      notes?: string | null
      taxRate?: number
      items?: Array<{ id?: string; description: string; quantity: number; unitPrice: number }>
    }
  ): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.base}/api/invoices/${id}`, data)
  }

  sendInvoice(id: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/api/invoices/${id}/send`, {})
  }

  deleteInvoice(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/api/invoices/${id}`)
  }

  // ─── Payments ────────────────────────────────────────────────────────────────
  getPayments(invoiceId?: string): Observable<Payment[]> {
    let params = new HttpParams()
    if (invoiceId) params = params.set('invoiceId', invoiceId)
    return this.http.get<Payment[]>(`${this.base}/api/payments`, { params })
  }

  recordPayment(data: {
    invoiceId: string
    amount: number
    method: 'cash' | 'check' | 'bank_transfer'
    checkNumber?: string
    notes?: string
    paidAt?: number
  }): Observable<Payment> {
    return this.http.post<Payment>(`${this.base}/api/payments`, data)
  }

  deletePayment(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/api/payments/${id}`)
  }

  // ─── Services ────────────────────────────────────────────────────────────────
  getServices(): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.base}/api/services`)
  }

  getAllServices(): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.base}/api/services/all`)
  }

  createService(data: Partial<Service>): Observable<Service> {
    return this.http.post<Service>(`${this.base}/api/services`, data)
  }

  updateService(id: string, data: Partial<Service>): Observable<Service> {
    return this.http.put<Service>(`${this.base}/api/services/${id}`, data)
  }

  deleteService(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/api/services/${id}`)
  }

  // ─── Contact ─────────────────────────────────────────────────────────────────
  submitContact(data: {
    name: string
    email: string
    phone?: string
    company?: string
    message: string
  }): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/api/contact`, data)
  }

  getContactRequests(): Observable<ContactRequest[]> {
    return this.http.get<ContactRequest[]>(`${this.base}/api/contact`)
  }

  markContactRead(id: string): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.base}/api/contact/${id}/read`, {})
  }

  deleteContactRequest(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/api/contact/${id}`)
  }

  // ─── Public invoice / payment ─────────────────────────────────────────────
  getPublicInvoice(token: string): Observable<PublicInvoice> {
    return this.http.get<PublicInvoice>(`${this.base}/api/pay/${token}`)
  }

  createStripeCheckout(token: string): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.base}/api/stripe/checkout`, { token })
  }

  // ─── Bugs ──────────────────────────────────────────────────────────────────────
  getBugs(): Observable<Bug[]> {
    return this.http.get<Bug[]>(`${this.base}/api/bugs`)
  }

  createBug(data: {
    title: string
    description: string
    priority?: string
    submitterName?: string
    submitterEmail?: string
    notes?: string
  }): Observable<Bug> {
    return this.http.post<Bug>(`${this.base}/api/bugs`, data)
  }

  updateBug(id: string, data: {
    status?: string
    priority?: string
    notes?: string
    title?: string
    description?: string
  }): Observable<Bug> {
    return this.http.put<Bug>(`${this.base}/api/bugs/${id}`, data)
  }

  deleteBug(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/api/bugs/${id}`)
  }

  // --- Portal ---
  portalMe(): Observable<any> {
    return this.http.get<any>(`${this.base}/api/portal/me`)
  }

  portalSubmitTicket(data: { subject: string; message: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/api/portal/tickets`, data)
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  getDashboard(): Observable<any> {
    return this.http.get<any>(`${this.base}/api/dashboard`)
  }

  // ─── Expenses ───────────────────────────────────────────────────────────────
  getExpenses(clientId?: string): Observable<any[]> {
    let params = new HttpParams()
    if (clientId) params = params.set('clientId', clientId)
    return this.http.get<any[]>(`${this.base}/api/expenses`, { params })
  }

  createExpense(data: any): Observable<any> {
    return this.http.post<any>(`${this.base}/api/expenses`, data)
  }

  deleteExpense(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/api/expenses/${id}`)
  }

  // ─── Time Entries ────────────────────────────────────────────────────────────
  getTimeEntries(clientId?: string): Observable<any[]> {
    let params = new HttpParams()
    if (clientId) params = params.set('clientId', clientId)
    return this.http.get<any[]>(`${this.base}/api/time-entries`, { params })
  }

  createTimeEntry(data: any): Observable<any> {
    return this.http.post<any>(`${this.base}/api/time-entries`, data)
  }

  deleteTimeEntry(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/api/time-entries/${id}`)
  }

  invoiceTimeEntries(data: { entryIds: string[]; clientId: string; dueDate?: number; notes?: string; taxRate?: number }): Observable<any> {
    return this.http.post<any>(`${this.base}/api/time-entries/invoice`, data)
  }

  // ─── Contracts ───────────────────────────────────────────────────────────────
  getContracts(clientId?: string): Observable<any[]> {
    let params = new HttpParams()
    if (clientId) params = params.set('clientId', clientId)
    return this.http.get<any[]>(`${this.base}/api/contracts`, { params })
  }

  createContract(data: { clientId: string; title: string; content: string }): Observable<any> {
    return this.http.post<any>(`${this.base}/api/contracts`, data)
  }

  updateContract(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.base}/api/contracts/${id}`, data)
  }

  sendContract(id: string): Observable<any> {
    return this.http.put<any>(`${this.base}/api/contracts/${id}/send`, {})
  }

  signContract(id: string, data: { signedByName: string; signedByEmail: string }): Observable<any> {
    return this.http.put<any>(`${this.base}/api/contracts/${id}/sign`, data)
  }

  deleteContract(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/api/contracts/${id}`)
  }

  // ─── Proposals ───────────────────────────────────────────────────────────────
  getProposals(clientId?: string): Observable<any[]> {
    let params = new HttpParams()
    if (clientId) params = params.set('clientId', clientId)
    return this.http.get<any[]>(`${this.base}/api/proposals`, { params })
  }

  getProposalByToken(token: string): Observable<any> {
    return this.http.get<any>(`${this.base}/api/proposals/view/${token}`)
  }

  createProposal(data: any): Observable<any> {
    return this.http.post<any>(`${this.base}/api/proposals`, data)
  }

  updateProposal(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.base}/api/proposals/${id}`, data)
  }

  sendProposal(id: string): Observable<any> {
    return this.http.put<any>(`${this.base}/api/proposals/${id}/send`, {})
  }

  deleteProposal(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/api/proposals/${id}`)
  }

  respondToProposal(token: string, decision: 'accepted' | 'declined'): Observable<any> {
    return this.http.put<any>(`${this.base}/api/proposals/respond/${token}`, { decision })
  }

  generateProposalNarrative(brief: string, clientName?: string): Observable<{ narrative: string }> {
    return this.http.post<{ narrative: string }>(`${this.base}/api/proposals/generate-narrative`, { brief, clientName })
  }

  // ─── Notifications ────────────────────────────────────────────────────────────
  getNotifications(): Observable<{ notifications: any[]; unreadCount: number }> {
    return this.http.get<{ notifications: any[]; unreadCount: number }>(`${this.base}/api/notifications`)
  }

  markNotificationRead(id: string): Observable<any> {
    return this.http.put<any>(`${this.base}/api/notifications/${id}/read`, {})
  }

  markAllNotificationsRead(): Observable<any> {
    return this.http.put<any>(`${this.base}/api/notifications/read-all`, {})
  }

  deleteNotification(id: string): Observable<any> {
    return this.http.delete<any>(`${this.base}/api/notifications/${id}`)
  }
}

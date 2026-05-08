import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatCardModule } from '@angular/material/card'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatDialogModule, MatDialog } from '@angular/material/dialog'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { MatMenuModule } from '@angular/material/menu'
import { MatDividerModule } from '@angular/material/divider'
import { DatePipe, DecimalPipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { Invoice } from '../../../shared/models'

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [
    RouterLink, DatePipe, DecimalPipe,
    MatButtonModule, MatIconModule, MatCardModule,
    MatProgressSpinnerModule, MatDialogModule, MatSnackBarModule,
    MatMenuModule, MatDividerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="breadcrumb">
          <a routerLink="/admin/invoices">Invoices</a>
          <mat-icon>chevron_right</mat-icon>
          <span>{{ invoice()?.invoiceNumber ?? 'Loading...' }}</span>
        </div>
        @if (invoice()) {
          <div class="header-actions">
            @if (invoice()!.status === 'draft') {
              <button mat-stroked-button (click)="sendInvoice()">
                <mat-icon>send</mat-icon>Send Invoice
              </button>
            }
            @if (['draft','sent','partial','overdue'].includes(invoice()!.status)) {
              <button mat-stroked-button (click)="recordPayment()">
                <mat-icon>payments</mat-icon>Record Payment
              </button>
            }
            <button mat-icon-button [matMenuTriggerFor]="menu">
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #menu>
              <button mat-menu-item class="danger-item" (click)="cancelInvoice()">
                <mat-icon>cancel</mat-icon>Cancel Invoice
              </button>
            </mat-menu>
          </div>
        }
      </div>

      @if (loading()) {
        <div class="loading-row"><mat-spinner diameter="32" /></div>
      } @else if (invoice()) {
        <div class="detail-grid">
          <!-- Main invoice card -->
          <div class="main-col">
            <div class="invoice-card">
              <div class="invoice-top">
                <div class="invoice-meta">
                  <div class="inv-label">Invoice</div>
                  <div class="inv-number">{{ invoice()!.invoiceNumber }}</div>
                  <span class="status-chip {{ invoice()!.status }}">{{ invoice()!.status }}</span>
                </div>
                <div class="invoice-dates">
                  <div class="date-item">
                    <span class="date-label">Created</span>
                    <span>{{ invoice()!.createdAt * 1000 | date:'mediumDate' }}</span>
                  </div>
                  @if (invoice()!.dueDate) {
                    <div class="date-item">
                      <span class="date-label">Due</span>
                      <span>{{ invoice()!.dueDate! * 1000 | date:'mediumDate' }}</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Client info -->
              @if (invoice()!.client) {
                <div class="client-section">
                  <div class="client-label">Billed To</div>
                  <div class="client-name">{{ invoice()!.client!.name }}</div>
                  @if (invoice()!.client!.company) { <div class="client-company">{{ invoice()!.client!.company }}</div> }
                  <div class="client-email">{{ invoice()!.client!.email }}</div>
                </div>
              }

              <mat-divider />

              <!-- Items -->
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th class="num-col">Qty</th>
                    <th class="num-col">Unit Price</th>
                    <th class="num-col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of invoice()!.items; track item.id) {
                    <tr>
                      <td>{{ item.description }}</td>
                      <td class="num-col">{{ item.quantity }}</td>
                      <td class="num-col">\${{ item.unitPrice | number:'1.2-2' }}</td>
                      <td class="num-col">\${{ item.amount | number:'1.2-2' }}</td>
                    </tr>
                  }
                </tbody>
              </table>

              <mat-divider />

              <!-- Totals -->
              <div class="totals">
                <div class="total-row">
                  <span>Subtotal</span>
                  <span>\${{ invoice()!.subtotal | number:'1.2-2' }}</span>
                </div>
                @if (invoice()!.taxRate > 0) {
                  <div class="total-row">
                    <span>Tax ({{ invoice()!.taxRate }}%)</span>
                    <span>\${{ invoice()!.taxAmount | number:'1.2-2' }}</span>
                  </div>
                }
                <div class="total-row grand-total">
                  <span>Total</span>
                  <span>\${{ invoice()!.total | number:'1.2-2' }}</span>
                </div>
              </div>

              @if (invoice()!.notes) {
                <div class="notes-section">
                  <div class="notes-label">Notes</div>
                  <p>{{ invoice()!.notes }}</p>
                </div>
              }

              <!-- Payment link -->
              @if (invoice()!.paymentToken && invoice()!.status !== 'paid' && invoice()!.status !== 'cancelled') {
                <div class="payment-link-section">
                  <mat-icon>link</mat-icon>
                  <div>
                    <div class="link-label">Client payment link</div>
                    <a class="link-value" [href]="getPaymentUrl(invoice()!)" target="_blank">
                      {{ getPaymentUrl(invoice()!) }}
                    </a>
                  </div>
                  <button mat-icon-button (click)="copyLink()">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                </div>
              }
            </div>
          </div>

          <!-- Payments sidebar -->
          <div class="sidebar">
            <div class="payments-card">
              <h3>Payment History</h3>
              @if (!invoice()!.payments || invoice()!.payments!.length === 0) {
                <div class="empty-payments">No payments recorded yet.</div>
              } @else {
                @for (p of invoice()!.payments; track p.id) {
                  <div class="payment-row">
                    <div>
                      <span class="method-chip {{ p.method }}">{{ p.method }}</span>
                      <div class="payment-date">{{ p.paidAt * 1000 | date:'mediumDate' }}</div>
                      @if (p.checkNumber) { <div class="payment-detail">Check #{{ p.checkNumber }}</div> }
                    </div>
                    <div class="payment-amount {{ p.status === 'refunded' ? 'refunded' : '' }}">
                      {{ p.status === 'refunded' ? '-' : '' }}\${{ p.amount | number:'1.2-2' }}
                    </div>
                  </div>
                }

                <mat-divider />
                <div class="payment-summary">
                  <span>Total Paid</span>
                  <strong>\${{ totalPaid() | number:'1.2-2' }}</strong>
                </div>
              }

              @if (['draft','sent','partial','overdue'].includes(invoice()!.status)) {
                <button mat-flat-button class="record-btn" (click)="recordPayment()">
                  <mat-icon>add</mat-icon>Record Payment
                </button>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
    }

    .breadcrumb {
      display: flex; align-items: center; gap: 4px; font-size: 14px;
      a { color: #1565C0; text-decoration: none; }
      mat-icon { font-size: 18px; color: #aaa; }
      span { font-weight: 600; }
    }

    .header-actions { display: flex; gap: 8px; align-items: center; }
    .loading-row { display: flex; justify-content: center; padding: 48px; }

    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 20px;
      align-items: start;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .invoice-card {
      background: #fff; border-radius: 12px; border: 1px solid #e8edf2; overflow: hidden;
    }

    .invoice-top {
      padding: 24px 28px;
      display: flex; justify-content: space-between; align-items: flex-start;
    }

    .inv-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    .inv-number { font-size: 22px; font-weight: 700; margin: 4px 0 8px; }

    .date-item { display: flex; gap: 8px; font-size: 13px; margin-bottom: 4px; }
    .date-label { color: #888; }

    .client-section { padding: 20px 28px; background: #f8fafc; }
    .client-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .client-name { font-size: 16px; font-weight: 600; }
    .client-company { font-size: 14px; color: #666; }
    .client-email { font-size: 13px; color: #1565C0; }

    .items-table {
      width: 100%; border-collapse: collapse;
      th {
        padding: 12px 16px; background: #f8fafc;
        font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;
        text-align: left;
      }
      td { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
      .num-col { text-align: right; }
    }

    .totals {
      padding: 20px 28px;
      max-width: 280px; margin-left: auto;
    }

    .total-row {
      display: flex; justify-content: space-between;
      padding: 6px 0; font-size: 14px; color: #555;
    }

    .grand-total {
      border-top: 2px solid #1a2332; margin-top: 8px; padding-top: 10px;
      font-size: 18px; font-weight: 700; color: #1a2332;
    }

    .notes-section {
      padding: 16px 28px; background: #f8fafc; border-top: 1px solid #f0f0f0;
      .notes-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
      p { margin: 0; font-size: 14px; color: #555; }
    }

    .payment-link-section {
      padding: 16px 28px; display: flex; align-items: center; gap: 12px;
      border-top: 1px solid #f0f0f0;
      mat-icon { color: #1565C0; }
      .link-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
      .link-value { font-size: 12px; color: #1565C0; word-break: break-all; }
    }

    .payments-card {
      background: #fff; border-radius: 12px; border: 1px solid #e8edf2; padding: 20px;
      h3 { margin: 0 0 16px; font-size: 15px; font-weight: 600; }
    }

    .empty-payments { font-size: 13px; color: #aaa; text-align: center; padding: 16px 0; }

    .payment-row {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 10px 0; border-bottom: 1px solid #f0f0f0;
    }

    .payment-date { font-size: 12px; color: #888; margin-top: 4px; }
    .payment-detail { font-size: 12px; color: #555; }
    .payment-amount { font-weight: 600; font-size: 15px; &.refunded { color: #c62828; } }

    .payment-summary {
      display: flex; justify-content: space-between;
      padding: 12px 0; font-size: 14px;
    }

    .record-btn {
      width: 100%; background: #1565C0 !important; color: #fff !important; margin-top: 12px;
    }

    .danger-item { color: #c62828 !important; mat-icon { color: #c62828 !important; } }
  `],
})
export class InvoiceDetailComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)

  id = ''
  invoice = signal<Invoice | null>(null)
  loading = signal(true)

  totalPaid = () => (this.invoice()?.payments ?? [])
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0)

  getPaymentUrl = (inv: Invoice) =>
    `${window.location.origin}/pay/${inv.paymentToken}`

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') ?? ''
    this.load()
  }

  load() {
    this.loading.set(true)
    this.api.getInvoice(this.id).subscribe({
      next: (data) => { this.invoice.set(data); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  sendInvoice() {
    this.api.sendInvoice(this.id).subscribe({
      next: () => {
        this.snack.open('Invoice sent to client!', '', { duration: 3000 })
        this.load()
      },
      error: () => this.snack.open('Failed to send invoice. Check Resend API key.', 'Dismiss', { duration: 4000 }),
    })
  }

  recordPayment() {
    import('./record-payment-dialog.component').then(({ RecordPaymentDialogComponent }) => {
      const ref = this.dialog.open(RecordPaymentDialogComponent, {
        width: '480px',
        data: { invoice: this.invoice() },
      })
      ref.afterClosed().subscribe((saved) => { if (saved) this.load() })
    })
  }

  cancelInvoice() {
    if (!confirm('Cancel this invoice?')) return
    this.api.deleteInvoice(this.id).subscribe({
      next: () => { this.snack.open('Invoice cancelled', '', { duration: 2500 }); this.load() },
      error: () => this.snack.open('Failed to cancel', 'Dismiss', { duration: 3000 }),
    })
  }

  copyLink() {
    if (this.invoice()?.paymentToken) {
      navigator.clipboard.writeText(this.getPaymentUrl(this.invoice()!))
      this.snack.open('Payment link copied!', '', { duration: 2000 })
    }
  }
}

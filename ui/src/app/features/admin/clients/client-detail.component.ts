import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatCardModule } from '@angular/material/card'
import { MatTableModule } from '@angular/material/table'
import { MatChipsModule } from '@angular/material/chips'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatDialog } from '@angular/material/dialog'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatSelectModule } from '@angular/material/select'
import { MatDatepickerModule } from '@angular/material/datepicker'
import { MatNativeDateModule } from '@angular/material/core'
import { DatePipe, DecimalPipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { Client, Invoice } from '../../../shared/models'

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatCardModule,
    MatTableModule, MatChipsModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="breadcrumb">
          <a routerLink="/admin/clients">Clients</a>
          <mat-icon>chevron_right</mat-icon>
          <span>{{ client()?.name ?? 'Loading...' }}</span>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="editClient()">
            <mat-icon>edit</mat-icon>Edit
          </button>
          <a mat-flat-button [routerLink]="['/admin/invoices/new']" [queryParams]="{ clientId: id }" class="add-btn">
            <mat-icon>receipt_long</mat-icon>New Invoice
          </a>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-row"><mat-spinner diameter="32" /></div>
      } @else if (client()) {
        <div class="detail-grid">
          <!-- Client info card -->
          <mat-card class="info-card">
            <mat-card-header>
              <div mat-card-avatar class="client-avatar">{{ initials() }}</div>
              <mat-card-title>{{ client()!.name }}</mat-card-title>
              @if (client()!.company) { <mat-card-subtitle>{{ client()!.company }}</mat-card-subtitle> }
            </mat-card-header>
            <mat-card-content>
              <div class="info-list">
                <div class="info-row"><mat-icon>email</mat-icon><span>{{ client()!.email }}</span></div>
                @if (client()!.phone) { <div class="info-row"><mat-icon>phone</mat-icon><span>{{ client()!.phone }}</span></div> }
                @if (client()!.address) { <div class="info-row"><mat-icon>location_on</mat-icon><span>{{ client()!.address }}</span></div> }
                @if (client()!.notes) { <div class="info-row"><mat-icon>notes</mat-icon><span>{{ client()!.notes }}</span></div> }
              </div>
              <div class="added-date">Added {{ client()!.createdAt * 1000 | date:'mediumDate' }}</div>
            </mat-card-content>
          </mat-card>

          <!-- Invoices -->
          <div class="right-col">

          <!-- Recurring billing card -->
          <mat-card class="recurring-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon class="card-icon">autorenew</mat-icon>
                Recurring Billing
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>

              @if (client()!.recurringActive) {
                <!-- Active -->
                <div class="recurring-active">
                  <div class="recurring-status active">
                    <mat-icon>check_circle</mat-icon>
                    <span>Active</span>
                  </div>
                  <div class="recurring-details">
                    <span class="recurring-amount">\${{ client()!.monthlyAmount | number:'1.2-2' }}/mo</span>
                    <span class="recurring-method {{ client()!.billingMethod }}">
                      {{ client()!.billingMethod === 'stripe' ? 'Stripe auto-charge' : 'Manual invoice' }}
                    </span>
                  </div>
                  <button mat-stroked-button color="warn" (click)="cancelRecurring()" class="cancel-btn">
                    <mat-icon>cancel</mat-icon>Cancel recurring
                  </button>
                </div>

              } @else if (client()!.billingMethod === 'stripe' && !client()!.recurringActive) {
                <!-- Stripe setup pending -->
                <div class="recurring-pending">
                  <div class="recurring-status pending">
                    <mat-icon>hourglass_empty</mat-icon>
                    <span>Awaiting customer card setup</span>
                  </div>
                  <p class="pending-hint">Share the Stripe checkout link with the customer to complete setup.</p>
                  <div class="pending-actions">
                    <button mat-flat-button class="email-btn" (click)="emailStripeSetup()" [disabled]="savingRecurring()">
                      <mat-icon>email</mat-icon>Email setup link
                    </button>
                    <button mat-stroked-button (click)="copyStripeSetupLink()">
                      <mat-icon>content_copy</mat-icon>Copy link
                    </button>
                    <button mat-stroked-button color="warn" (click)="cancelRecurring()">
                      <mat-icon>close</mat-icon>Cancel
                    </button>
                  </div>
                </div>

              } @else {
                <!-- Setup form -->
                <form [formGroup]="recurringForm" (ngSubmit)="setupRecurring()" class="recurring-form">
                  <mat-form-field appearance="outline" class="amount-field">
                    <mat-label>Monthly amount ($)</mat-label>
                    <input matInput type="number" min="1" step="0.01" formControlName="amount" placeholder="99.00" />
                    @if (recurringForm.value.method === 'stripe' && recurringForm.value.amount && recurringForm.value.amount > 0) {
                      <mat-hint>Customer charged \${{ grossedAmount() | number:'1.2-2' }}/mo &mdash; you net \${{ recurringForm.value.amount | number:'1.2-2' }}</mat-hint>
                    }
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="method-field">
                    <mat-label>Billing method</mat-label>
                    <mat-select formControlName="method">
                      <mat-option value="manual">Manual (generate invoice monthly)</mat-option>
                      <mat-option value="stripe">Stripe (auto-charge card on file)</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="start-date-field">
                    <mat-label>Start date (optional)</mat-label>
                    <input matInput [matDatepicker]="picker" formControlName="startDate" [min]="tomorrow" placeholder="Start immediately" />
                    <mat-hint>Leave blank to start immediately</mat-hint>
                    <mat-datepicker-toggle matIconSuffix [for]="picker" />
                    <mat-datepicker #picker />
                  </mat-form-field>

                  <button mat-flat-button type="submit" class="setup-btn" [disabled]="recurringForm.invalid || savingRecurring()">
                    @if (savingRecurring()) { <mat-spinner diameter="18" /> }
                    @else { <mat-icon>play_circle</mat-icon> }
                    {{ recurringForm.value.method === 'stripe' ? 'Get Stripe setup link' : 'Activate' }}
                  </button>
                </form>
              }

            </mat-card-content>
          </mat-card>

          <!-- Invoices -->
          <div class="invoices-section">
            <h2>Invoices</h2>
            @if (invoices().length === 0) {
              <div class="empty-state">
                <mat-icon>receipt_long</mat-icon>
                <p>No invoices yet for this client.</p>
              </div>
            } @else {
              <div class="invoice-list">
                @for (inv of invoices(); track inv.id) {
                  <a [routerLink]="['/admin/invoices', inv.id]" class="invoice-row">
                    <div>
                      <div class="inv-number">{{ inv.invoiceNumber }}</div>
                      <div class="inv-date">{{ inv.createdAt * 1000 | date:'mediumDate' }}</div>
                    </div>
                    <div class="inv-right">
                      <span class="status-chip {{ inv.status }}">{{ inv.status }}</span>
                      <div class="inv-total">\${{ inv.total | number:'1.2-2' }}</div>
                    </div>
                  </a>
                }
              </div>
            }
          </div>
          </div><!-- /right-col -->
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
      a { color: #1565C0; text-decoration: none; &:hover { text-decoration: underline; } }
      mat-icon { font-size: 18px; color: #aaa; }
      span { font-weight: 600; }
    }

    .header-actions { display: flex; gap: 8px; }
    .add-btn { background: #1565C0 !important; color: #fff !important; }

    .loading-row { display: flex; justify-content: center; padding: 48px; }

    .detail-grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 24px;
      align-items: start;
      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    .right-col { display: flex; flex-direction: column; gap: 24px; }

    .info-card { border: 1px solid #e8edf2 !important; }

    .client-avatar {
      background: #1565C0 !important;
      color: #fff !important;
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .info-list { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
    .info-row {
      display: flex; align-items: flex-start; gap: 10px;
      mat-icon { color: #1565C0; font-size: 18px; flex-shrink: 0; }
      span { font-size: 14px; color: #444; }
    }

    .added-date { font-size: 12px; color: #aaa; margin-top: 16px; }

    .invoices-section h2 { margin: 0 0 16px; font-size: 18px; font-weight: 700; }

    .empty-state {
      text-align: center; padding: 48px; background: #fff; border-radius: 12px;
      border: 1px solid #e8edf2;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #ccc; }
      p { color: #888; margin: 8px 0 0; }
    }

    .invoice-list {
      display: flex; flex-direction: column; gap: 8px;
    }

    .invoice-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 20px;
      background: #fff; border-radius: 10px; border: 1px solid #e8edf2;
      text-decoration: none; color: inherit;
      transition: box-shadow 0.15s;

      &:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    }

    .inv-number { font-weight: 600; font-size: 15px; color: #1565C0; }
    .inv-date { font-size: 12px; color: #888; margin-top: 2px; }
    .inv-right { text-align: right; }
    .inv-total { font-weight: 600; font-size: 15px; margin-top: 4px; }

    /* ── Recurring billing card ─────────────────────────────────── */
    .recurring-card {
      border: 1px solid #e8edf2 !important;
      mat-card-title { display: flex; align-items: center; gap: 8px; font-size: 16px; }
      .card-icon { color: #1565C0; }
    }

    .recurring-form {
      display: flex; flex-direction: column; gap: 12px; padding-top: 8px;
      .amount-field, .method-field, .start-date-field { width: 100%; }
      .setup-btn {
        background: #1565C0 !important; color: #fff !important;
        display: flex; align-items: center; gap: 6px; align-self: flex-start;
        mat-spinner { display: inline-block; }
      }
    }

    .recurring-active, .recurring-pending { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }

    .recurring-status {
      display: flex; align-items: center; gap: 6px; font-weight: 600;
      &.active { color: #2e7d32; }
      &.pending { color: #e65100; }
    }

    .recurring-details { display: flex; align-items: center; gap: 12px; }
    .recurring-amount { font-size: 20px; font-weight: 700; }
    .recurring-method {
      font-size: 12px; padding: 2px 8px; border-radius: 12px; font-weight: 500;
      &.stripe { background: #ede7f6; color: #6772e5; }
      &.manual { background: #e8f5e9; color: #2e7d32; }
    }

    .cancel-btn { align-self: flex-start; }
    .pending-hint { font-size: 13px; color: #666; margin: 0; }
    .pending-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .email-btn { background: #1565C0 !important; color: #fff !important; display: flex; align-items: center; gap: 6px; }
  `],
})
export class ClientDetailComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)
  private fb = inject(FormBuilder)

  id = ''
  client = signal<Client | null>(null)
  invoices = signal<Invoice[]>([])
  loading = signal(true)
  savingRecurring = signal(false)

  recurringForm = this.fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    method: ['manual' as 'stripe' | 'manual', Validators.required],
    startDate: [null as Date | null],
  })

  grossedAmount = () => {
    const amt = this.recurringForm.value.amount ?? 0
    return Math.round(((amt + 0.30) / 0.971) * 100) / 100
  }

  tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0,0,0,0); return d })()

  initials = () => {
    const name = this.client()?.name ?? ''
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') ?? ''
    // Check if returning from Stripe subscription setup
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscription') === 'success') {
      this.snack.open('Stripe subscription activated!', '', { duration: 4000 })
      window.history.replaceState({}, '', window.location.pathname)
    }
    this.loadClient()
    this.loadInvoices()
  }

  loadClient() {
    this.api.getClient(this.id).subscribe({
      next: (c) => { this.client.set(c); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  loadInvoices() {
    this.api.getInvoices({ clientId: this.id }).subscribe({
      next: (data) => this.invoices.set(data),
      error: () => {},
    })
  }

  setupRecurring() {
    if (this.recurringForm.invalid) return
    const { amount, method, startDate } = this.recurringForm.value
    // Format date as YYYY-MM-DD for the backend
    const startDateStr = startDate ? (startDate as Date).toISOString().slice(0, 10) : undefined
    this.savingRecurring.set(true)
    this.api.setupRecurring(this.id, { amount: amount!, method: method!, startDate: startDateStr }).subscribe({
      next: (res) => {
        this.savingRecurring.set(false)
        if (res.checkoutUrl) {
          navigator.clipboard.writeText(res.checkoutUrl).catch(() => {})
          this.snack.open('Stripe setup link copied — send it to the customer to enter their card', '', { duration: 6000 })
          this.loadClient()
        } else {
          this.snack.open('Recurring billing activated', '', { duration: 3000 })
          this.loadClient()
        }
      },
      error: () => { this.savingRecurring.set(false); this.snack.open('Failed to set up recurring billing', 'Dismiss', { duration: 4000 }) },
    })
  }

  emailStripeSetup() {
    this.savingRecurring.set(true)
    this.api.sendRecurringSetupEmail(this.id).subscribe({
      next: () => { this.savingRecurring.set(false); this.snack.open(`Setup email sent to ${this.client()?.email}`, '', { duration: 4000 }) },
      error: () => { this.savingRecurring.set(false); this.snack.open('Failed to send email', 'Dismiss', { duration: 4000 }) },
    })
  }

  copyStripeSetupLink() {
    // Generate a fresh link and copy it
    const amount = this.client()?.monthlyAmount
    if (!amount) return
    this.savingRecurring.set(true)
    this.api.setupRecurring(this.id, { amount, method: 'stripe' }).subscribe({
      next: (res) => {
        this.savingRecurring.set(false)
        if (res.checkoutUrl) {
          navigator.clipboard.writeText(res.checkoutUrl).catch(() => {})
          this.snack.open('Setup link copied to clipboard', '', { duration: 4000 })
        }
      },
      error: () => { this.savingRecurring.set(false) },
    })
  }

  cancelRecurring() {
    if (!confirm('Cancel recurring billing for this client?')) return
    this.api.cancelRecurring(this.id).subscribe({
      next: () => { this.snack.open('Recurring billing cancelled', '', { duration: 3000 }); this.loadClient() },
      error: () => this.snack.open('Failed to cancel recurring billing', 'Dismiss', { duration: 4000 }),
    })
  }

  editClient() {
    import('./client-dialog.component').then(({ ClientDialogComponent }) => {
      const ref = this.dialog.open(ClientDialogComponent, {
        width: '560px',
        data: this.client(),
      })
      ref.afterClosed().subscribe((saved) => { if (saved) this.loadClient() })
    })
  }
}

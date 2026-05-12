import { Component, inject, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatCardModule } from '@angular/material/card'
import { MatDividerModule } from '@angular/material/divider'
import { MatChipsModule } from '@angular/material/chips'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { MatTabsModule } from '@angular/material/tabs'
import { DecimalPipe, DatePipe } from '@angular/common'
import { ApiService } from '../../core/services/api.service'

@Component({
  selector: 'app-portal-dashboard',
  standalone: true,
  imports: [
    FormsModule, DecimalPipe, DatePipe,
    MatButtonModule, MatIconModule, MatCardModule, MatDividerModule,
    MatChipsModule, MatProgressSpinnerModule, MatFormFieldModule,
    MatInputModule, MatSnackBarModule, MatTabsModule,
  ],
  template: `
    <div class="portal-page">
      <!-- Header -->
      <div class="portal-header">
        <div class="brand">
          <mat-icon>cloud</mat-icon>
          <span>Browning Cloud Solutions — Client Portal</span>
        </div>
        <a href="https://browningcloudsolutions.cloudflareaccess.com/cdn-cgi/access/logout"
           mat-stroked-button class="signout-btn">
          <mat-icon>logout</mat-icon> Sign Out
        </a>
      </div>

      @if (loading()) {
        <div class="loading"><mat-spinner diameter="40" /></div>
      } @else if (error()) {
        <div class="portal-content">
          <div class="error-state">
            <mat-icon>error_outline</mat-icon>
            <p>{{ error() }}</p>
            <p style="color:#888;font-size:13px;">Your email must be registered as a client to access the portal.</p>
          </div>
        </div>
      } @else if (data()) {
        <div class="portal-content">
          <div class="welcome">
            <h1>Welcome, {{ data()!.client.name }}</h1>
            @if (data()!.client.company) { <p class="company">{{ data()!.client.company }}</p> }
          </div>

          <mat-tab-group>
            <!-- Invoices Tab -->
            <mat-tab label="Invoices ({{ data()!.invoices.length }})">
              <div class="tab-body">
                @if (data()!.invoices.length === 0) {
                  <div class="empty-state">
                    <mat-icon>receipt_long</mat-icon>
                    <p>No invoices yet.</p>
                  </div>
                } @else {
                  @for (inv of data()!.invoices; track inv.id) {
                    <div class="invoice-row" (click)="openInvoice(inv)">
                      <div class="inv-left">
                        <div class="inv-number">{{ inv.invoiceNumber }}</div>
                        <span class="status-chip {{ inv.status }}">{{ inv.status }}</span>
                        @if (inv.dueDate) {
                          <span class="due-date">Due {{ inv.dueDate * 1000 | date:'mediumDate' }}</span>
                        }
                      </div>
                      <div class="inv-right">
                        @if (inv.amountPaid > 0 && inv.status !== 'paid') {
                          <div class="paid-hint">\${{ inv.amountPaid | number:'1.2-2' }} paid</div>
                        }
                        <div class="inv-amount {{ inv.status === 'paid' ? 'paid' : '' }}">
                          {{ inv.status === 'paid' ? 'Paid' : 'Due' }} \${{ inv.amountDue | number:'1.2-2' }}
                        </div>
                        @if (inv.status !== 'paid' && inv.status !== 'cancelled') {
                          <button mat-flat-button class="pay-btn" (click)="goToPayment(inv, $event)">
                            <mat-icon>credit_card</mat-icon> Pay Now
                          </button>
                        }
                      </div>
                    </div>
                  }
                }
              </div>
            </mat-tab>

            <!-- Support Tickets Tab -->
            <mat-tab label="Support ({{ data()!.tickets.length }})">
              <div class="tab-body">
                <div class="ticket-form">
                  <h3>Submit a Support Request</h3>
                  <mat-form-field appearance="outline" class="full-field">
                    <mat-label>Subject</mat-label>
                    <input matInput [(ngModel)]="ticketSubject" placeholder="Brief description of your issue" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-field">
                    <mat-label>Message</mat-label>
                    <textarea matInput [(ngModel)]="ticketMessage" rows="4" placeholder="Describe your issue in detail..."></textarea>
                  </mat-form-field>
                  <button mat-flat-button class="submit-ticket-btn" (click)="submitTicket()" [disabled]="!ticketSubject || !ticketMessage || submittingTicket()">
                    @if (submittingTicket()) { <mat-spinner diameter="18" /> } @else { <mat-icon>send</mat-icon> }
                    Submit Ticket
                  </button>
                </div>

                @if (data()!.tickets.length > 0) {
                  <mat-divider style="margin: 24px 0;" />
                  <h3 style="margin: 0 0 12px;">Your Tickets</h3>
                  @for (ticket of data()!.tickets; track ticket.id) {
                    <div class="ticket-row">
                      <div class="ticket-info">
                        <div class="ticket-subject">{{ ticket.subject }}</div>
                        <div class="ticket-date">{{ ticket.createdAt * 1000 | date:'mediumDate' }}</div>
                      </div>
                      <span class="ticket-status {{ ticket.status }}">{{ ticket.status.replace('_', ' ') }}</span>
                    </div>
                  }
                }
              </div>
            </mat-tab>
          </mat-tab-group>
        </div>
      }
    </div>
  `,
  styles: [`
    .portal-page {
      min-height: 100vh;
      background: #f8fafc;
    }

    .portal-header {
      background: #1565C0;
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        mat-icon { color: #90CAF9; }
      }
    }

    .signout-btn { color: #fff !important; border-color: rgba(255,255,255,0.4) !important; text-decoration: none; }
    .loading { display: flex; justify-content: center; padding: 80px; }

    .error-state {
      text-align: center; padding: 64px;
      mat-icon { font-size: 48px; width: 48px; height: 48px; display: block; margin: 0 auto 12px; color: #e53935; }
      p { margin: 8px 0; color: #333; }
    }

    .portal-content { max-width: 820px; margin: 0 auto; padding: 32px 16px; }

    .welcome {
      margin-bottom: 24px;
      h1 { margin: 0 0 4px; font-size: 22px; }
      .company { margin: 0; color: #666; font-size: 14px; }
    }

    .tab-body { padding: 24px 0; }

    .empty-state {
      text-align: center;
      padding: 48px;
      color: #aaa;
      mat-icon { font-size: 40px; width: 40px; height: 40px; display: block; margin: 0 auto 8px; }
    }

    .invoice-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #fff;
      border-radius: 10px;
      border: 1px solid #e8edf2;
      margin-bottom: 10px;
      cursor: pointer;
      transition: box-shadow 0.15s;
      &:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    }

    .inv-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .inv-number { font-weight: 700; font-size: 15px; }
    .due-date { font-size: 12px; color: #888; }

    .inv-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .paid-hint { font-size: 12px; color: #2e7d32; }
    .inv-amount { font-weight: 700; font-size: 16px; &.paid { color: #2e7d32; } }

    .pay-btn {
      background: #1565C0 !important;
      color: #fff !important;
      height: 36px !important;
      font-size: 13px !important;
      display: flex !important;
      align-items: center;
      gap: 4px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .ticket-form {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e8edf2;
      padding: 24px;
      h3 { margin: 0 0 16px; font-size: 16px; }
    }

    .full-field { width: 100%; margin-bottom: 8px; }

    .submit-ticket-btn {
      background: #1565C0 !important;
      color: #fff !important;
      height: 44px;
      display: flex !important;
      align-items: center;
      gap: 8px;
    }

    .ticket-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e8edf2;
      margin-bottom: 8px;
    }

    .ticket-subject { font-weight: 500; font-size: 14px; }
    .ticket-date { font-size: 12px; color: #888; margin-top: 2px; }

    .ticket-status {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      &.open { background: #fff3e0; color: #e65100; }
      &.in_progress { background: #e3f2fd; color: #1565C0; }
      &.resolved, &.closed { background: #e8f5e9; color: #2e7d32; }
    }

    .status-chip {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      &.draft { background: #f5f5f5; color: #666; }
      &.sent { background: #e3f2fd; color: #1565C0; }
      &.partial { background: #fff8e1; color: #f57f17; }
      &.paid { background: #e8f5e9; color: #2e7d32; }
      &.overdue { background: #fce4ec; color: #c62828; }
      &.cancelled { background: #fafafa; color: #999; }
    }
  `],
})
export class PortalDashboardComponent implements OnInit {
  private api = inject(ApiService)
  private snack = inject(MatSnackBar)

  loading = signal(true)
  data = signal<any>(null)
  error = signal<string | null>(null)
  ticketSubject = ''
  ticketMessage = ''
  submittingTicket = signal(false)

  ngOnInit() {
    this.load()
  }

  load() {
    this.loading.set(true)
    this.error.set(null)
    this.api.portalMe().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false) },
      error: (err) => {
        this.loading.set(false)
        if (err.status === 403) {
          this.error.set('Your email is not registered as a client.')
        } else {
          this.error.set('Failed to load portal data.')
        }
      },
    })
  }

  goToPayment(inv: any, event: Event) {
    event.stopPropagation()
    window.open(`/pay/${inv.paymentToken}`, '_blank')
  }

  openInvoice(inv: any) {
    if (inv.status !== 'paid' && inv.status !== 'cancelled') {
      window.open(`/pay/${inv.paymentToken}`, '_blank')
    }
  }

  submitTicket() {
    if (!this.ticketSubject || !this.ticketMessage) return
    this.submittingTicket.set(true)
    this.api.portalSubmitTicket({ subject: this.ticketSubject, message: this.ticketMessage }).subscribe({
      next: () => {
        this.submittingTicket.set(false)
        this.ticketSubject = ''
        this.ticketMessage = ''
        this.snack.open('Ticket submitted! We\'ll be in touch soon.', '', { duration: 4000 })
        this.load()
      },
      error: () => { this.submittingTicket.set(false); this.snack.open('Failed to submit ticket', 'Dismiss', { duration: 3000 }) },
    })
  }


}

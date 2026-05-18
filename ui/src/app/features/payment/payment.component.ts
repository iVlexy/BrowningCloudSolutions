import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatDividerModule } from '@angular/material/divider'
import { DecimalPipe, DatePipe } from '@angular/common'
import { ApiService } from '../../core/services/api.service'
import type { PublicInvoice } from '../../shared/models'

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatDividerModule, DecimalPipe, DatePipe],
  template: `
    <div class="payment-page">
      <div class="payment-header">
        <mat-icon class="brand-icon">cloud</mat-icon>
        <span class="brand-name">Browning Cloud Solutions</span>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="40" />
          <p>Loading invoice...</p>
        </div>
      } @else if (error()) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <h2>Invoice not found</h2>
          <p>This link may have expired or is invalid.</p>
          <a mat-flat-button routerLink="/">Go Home</a>
        </div>
      } @else if (invoice()) {
        <div class="invoice-card">
          <!-- Success banner -->
          @if (success()) {
            <div class="success-banner">
              <mat-icon>check_circle</mat-icon>
              Payment received! Thank you.
            </div>
          }

          <!-- Invoice header -->
          <div class="invoice-top">
            <div>
              <div class="invoice-label">Invoice</div>
              <div class="invoice-number">{{ invoice()!.invoiceNumber }}</div>
              <div class="client-name">{{ invoice()!.client.name }}
                @if (invoice()!.client.company) { · {{ invoice()!.client.company }} }
              </div>
            </div>
            <div class="status-col">
              <span class="status-chip {{ invoice()!.status }}">{{ invoice()!.status }}</span>
              @if (invoice()!.dueDate) {
                <div class="due-date">Due {{ invoice()!.dueDate! * 1000 | date:'mediumDate' }}</div>
              }
            </div>
          </div>

          <mat-divider />

          <!-- Line items -->
          <table class="items-table">
            <thead>
              <tr>
                <th class="desc-col">Description</th>
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
            @if (invoice()!.amountPaid > 0) {
              <div class="total-row paid-row">
                <span>Paid</span>
                <span>-\${{ invoice()!.amountPaid | number:'1.2-2' }}</span>
              </div>
            }
            <div class="total-row grand-total">
              <span>Amount Due</span>
              <span>\${{ invoice()!.amountDue | number:'1.2-2' }}</span>
            </div>
          </div>

          <!-- Payment actions -->
          @if (invoice()!.status !== 'paid' && invoice()!.status !== 'cancelled' && !success()) {
            <div class="payment-actions">
              <h3>Pay This Invoice</h3>
              @if (invoice()!.amountPaid === 0) {
                <div class="payment-options">
                  <button mat-flat-button class="stripe-btn deposit-btn" (click)="payWithCard(true)" [disabled]="paying() !== null">
                    <mat-icon>credit_card</mat-icon>
                    @if (paying() === 'half') { Processing... } @else { Pay 50% Deposit — \${{ invoice()!.amountDue / 2 | number:'1.2-2' }} }
                  </button>
                  <button mat-flat-button class="stripe-btn" (click)="payWithCard(false)" [disabled]="paying() !== null">
                    <mat-icon>payments</mat-icon>
                    @if (paying() === 'full') { Processing... } @else { Pay in Full — \${{ invoice()!.amountDue | number:'1.2-2' }} }
                  </button>
                </div>
                <p class="deposit-note">Choose a 50% deposit now and pay the remaining balance after project completion, or pay the full amount today.</p>
              } @else {
                <button mat-flat-button class="stripe-btn" (click)="payWithCard(false)" [disabled]="paying() !== null">
                  <mat-icon>credit_card</mat-icon>
                  @if (paying() === 'full') { Processing... } @else { Pay Remaining Balance — \${{ invoice()!.amountDue | number:'1.2-2' }} }
                </button>
              }

              <div class="alt-payment">
                <p><strong>Pay by Check:</strong> Make payable to "Browning Cloud Solutions" and mail to our address, referencing invoice {{ invoice()!.invoiceNumber }}.</p>
                <p><strong>Pay by Cash / Bank Transfer:</strong> Contact us at <a href="mailto:billing&#64;browningcloud.com">billing&#64;browningcloud.com</a> to arrange.</p>
              </div>
            </div>
          }

          @if (invoice()!.status === 'paid') {
            <div class="paid-state">
              <mat-icon>check_circle</mat-icon>
              <span>This invoice has been paid in full. Thank you!</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .payment-page {
      min-height: 100vh;
      background: #f8fafc;
      padding: 24px 16px;
    }

    .payment-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 32px;

      .brand-icon { color: #1565C0; font-size: 28px; }
      .brand-name { font-size: 18px; font-weight: 700; color: #1a2332; }
    }

    .loading-state, .error-state {
      text-align: center;
      padding: 80px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;

      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #e53935; }
      h2 { margin: 0; }
      p { color: #666; margin: 0; }
    }

    .invoice-card {
      max-width: 720px;
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      overflow: hidden;
    }

    .success-banner {
      background: #e8f5e9;
      color: #2e7d32;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      mat-icon { color: #2e7d32; }
    }

    .invoice-top {
      padding: 28px 32px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;

      .invoice-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
      .invoice-number { font-size: 24px; font-weight: 700; color: #1a2332; margin: 4px 0; }
      .client-name { color: #555; font-size: 15px; }
    }

    .status-col { text-align: right; }
    .due-date { font-size: 13px; color: #888; margin-top: 6px; }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;

      th {
        padding: 12px 16px;
        font-size: 12px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        background: #f8fafc;
        font-weight: 600;
        text-align: left;
      }

      td {
        padding: 14px 16px;
        border-bottom: 1px solid #f0f0f0;
        font-size: 14px;
      }

      .num-col { text-align: right; }
    }

    .totals {
      padding: 20px 32px;
      max-width: 320px;
      margin-left: auto;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 14px;
      color: #555;
    }

    .paid-row { color: #2e7d32; }

    .grand-total {
      border-top: 2px solid #1a2332;
      margin-top: 8px;
      padding-top: 10px;
      font-size: 18px;
      font-weight: 700;
      color: #1a2332;
    }

    .payment-actions {
      padding: 28px 32px;
      border-top: 1px solid #f0f0f0;

      h3 { margin: 0 0 16px; font-size: 16px; }
    }

    .payment-options {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 12px;
    }

    .deposit-note {
      font-size: 13px;
      color: #888;
      margin: 0 0 20px;
      line-height: 1.5;
    }

    .stripe-btn {
      background: #1565C0 !important;
      color: #fff !important;
      height: 52px;
      padding: 0 32px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      display: flex !important;
      align-items: center;
      gap: 8px;
    }

    .deposit-btn {
      background: #2e7d32 !important;
    }

    .alt-payment {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;

      p { font-size: 14px; color: #555; margin: 0 0 8px; line-height: 1.6; &:last-child { margin: 0; } }
      a { color: #1565C0; }
    }

    .paid-state {
      padding: 24px 32px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: #e8f5e9;
      color: #2e7d32;
      font-weight: 500;
      mat-icon { color: #2e7d32; }
    }
  `],
})
export class PaymentComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private api = inject(ApiService)

  invoice = signal<PublicInvoice | null>(null)
  loading = signal(true)
  error = signal(false)
  paying = signal<'full' | 'half' | null>(null)
  success = signal(false)

  private token = ''

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? ''
    this.success.set(this.route.snapshot.queryParamMap.get('success') === 'true')

    this.api.getPublicInvoice(this.token).subscribe({
      next: (data) => { this.invoice.set(data); this.loading.set(false) },
      error: () => { this.error.set(true); this.loading.set(false) },
    })
  }

  payWithCard(payHalf: boolean) {
    this.paying.set(payHalf ? 'half' : 'full')
    this.api.createStripeCheckout(this.token, payHalf).subscribe({
      next: ({ url }) => { window.location.href = url },
      error: () => this.paying.set(null),
    })
  }
}

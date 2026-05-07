import { Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MatTableModule } from '@angular/material/table'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { DatePipe, DecimalPipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { Payment } from '../../../shared/models'

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    RouterLink, DatePipe, DecimalPipe,
    MatTableModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Payments</h1>
          <p class="page-sub">All recorded payments across invoices</p>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-row"><mat-spinner diameter="32" /></div>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="payments()">
            <ng-container matColumnDef="invoice">
              <th mat-header-cell *matHeaderCellDef>Invoice</th>
              <td mat-cell *matCellDef="let p">
                <a [routerLink]="['/admin/invoices', p.invoiceId]" class="inv-link">View Invoice</a>
              </td>
            </ng-container>

            <ng-container matColumnDef="method">
              <th mat-header-cell *matHeaderCellDef>Method</th>
              <td mat-cell *matCellDef="let p">
                <span class="method-chip {{ p.method }}">{{ p.method }}</span>
                @if (p.checkNumber) { <div class="sub-text">Check #{{ p.checkNumber }}</div> }
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let p">
                <span class="status-chip {{ p.status === 'completed' ? 'paid' : p.status === 'refunded' ? 'cancelled' : 'sent' }}">
                  {{ p.status }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef class="num-col">Amount</th>
              <td mat-cell *matCellDef="let p" class="num-col amount-cell {{ p.status === 'refunded' ? 'refunded' : '' }}">
                {{ p.status === 'refunded' ? '-' : '' }}\${{ p.amount | number:'1.2-2' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="paidAt">
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let p">{{ p.paidAt * 1000 | date:'mediumDate' }}</td>
            </ng-container>

            <ng-container matColumnDef="notes">
              <th mat-header-cell *matHeaderCellDef>Notes</th>
              <td mat-cell *matCellDef="let p">{{ p.notes || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let p">
                @if (p.status === 'completed') {
                  <button mat-icon-button color="warn" (click)="voidPayment(p)"
                    title="Void/Refund">
                    <mat-icon>undo</mat-icon>
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols;"></tr>
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell no-data" [attr.colspan]="cols.length">No payments yet.</td>
            </tr>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;
      h1 { margin: 0; font-size: 24px; font-weight: 700; }
      .page-sub { margin: 4px 0 0; color: #666; font-size: 14px; }
    }

    .loading-row { display: flex; justify-content: center; padding: 48px; }
    .table-card { background: #fff; border-radius: 12px; border: 1px solid #e8edf2; overflow: hidden; }
    .inv-link { color: #1565C0; text-decoration: none; font-weight: 500; &:hover { text-decoration: underline; } }
    .sub-text { font-size: 12px; color: #888; }
    .num-col { text-align: right; }
    .amount-cell { font-weight: 600; &.refunded { color: #c62828; } }
    .no-data { text-align: center; padding: 48px !important; color: #888; }
  `],
})
export class PaymentsComponent implements OnInit {
  private api = inject(ApiService)
  private snack = inject(MatSnackBar)

  payments = signal<Payment[]>([])
  loading = signal(true)
  cols = ['invoice', 'method', 'status', 'amount', 'paidAt', 'notes', 'actions']

  ngOnInit() { this.load() }

  load() {
    this.loading.set(true)
    this.api.getPayments().subscribe({
      next: (data) => { this.payments.set(data); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  voidPayment(payment: Payment) {
    if (!confirm('Mark this payment as refunded/voided?')) return
    this.api.deletePayment(payment.id).subscribe({
      next: () => { this.snack.open('Payment voided', '', { duration: 2500 }); this.load() },
      error: () => this.snack.open('Failed to void payment', 'Dismiss', { duration: 3000 }),
    })
  }
}

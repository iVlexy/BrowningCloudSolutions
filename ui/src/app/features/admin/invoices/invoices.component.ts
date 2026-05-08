import { Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MatTableModule } from '@angular/material/table'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatSelectModule } from '@angular/material/select'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatMenuModule } from '@angular/material/menu'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { DatePipe, DecimalPipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { Invoice, InvoiceStatus } from '../../../shared/models'

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [
    RouterLink, DatePipe, DecimalPipe,
    MatTableModule, MatButtonModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatProgressSpinnerModule, MatMenuModule, MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Invoices</h1>
          <p class="page-sub">Create, send, and track invoices</p>
        </div>
        <a mat-flat-button routerLink="/admin/invoices/new" class="add-btn">
          <mat-icon>add</mat-icon>New Invoice
        </a>
      </div>

      <div class="filter-row">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Filter by status</mat-label>
          <mat-select [(value)]="statusFilter" (selectionChange)="load()">
            <mat-option value="">All</mat-option>
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ s }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <div class="loading-row"><mat-spinner diameter="32" /></div>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="invoices()">
            <ng-container matColumnDef="number">
              <th mat-header-cell *matHeaderCellDef>Invoice #</th>
              <td mat-cell *matCellDef="let inv">
                <a [routerLink]="['/admin/invoices', inv.id]" class="inv-link">{{ inv.invoiceNumber }}</a>
              </td>
            </ng-container>

            <ng-container matColumnDef="client">
              <th mat-header-cell *matHeaderCellDef>Client</th>
              <td mat-cell *matCellDef="let inv">
                {{ inv.clientName }}
                @if (inv.clientCompany) { <div class="sub-text">{{ inv.clientCompany }}</div> }
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let inv">
                <span class="status-chip {{ inv.status }}">{{ inv.status }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="dueDate">
              <th mat-header-cell *matHeaderCellDef>Due</th>
              <td mat-cell *matCellDef="let inv">
                {{ inv.dueDate ? (inv.dueDate * 1000 | date:'mediumDate') : '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef class="num-col">Total</th>
              <td mat-cell *matCellDef="let inv" class="num-col">
                \${{ inv.total | number:'1.2-2' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let inv">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu>
                  <a mat-menu-item [routerLink]="['/admin/invoices', inv.id]">
                    <mat-icon>visibility</mat-icon>View
                  </a>
                  @if (inv.status === 'draft') {
                    <button mat-menu-item (click)="sendInvoice(inv)">
                      <mat-icon>send</mat-icon>Send
                    </button>
                  }
                  <button mat-menu-item class="danger-item" (click)="deleteInvoice(inv)">
                    <mat-icon>cancel</mat-icon>Cancel
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols;"></tr>
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell no-data" [attr.colspan]="cols.length">No invoices found.</td>
            </tr>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .add-btn { background: #1565C0 !important; color: #fff !important; }

    .filter-row { margin-bottom: 20px; }
    .filter-field { width: 220px; max-width: 100%; }

    .loading-row { display: flex; justify-content: center; padding: 48px; }

    .table-card {
      background: #fff; border-radius: 12px; border: 1px solid #e8edf2; overflow-x: auto;
    }

    .inv-link { color: #1565C0; font-weight: 600; text-decoration: none; &:hover { text-decoration: underline; } }
    .sub-text { font-size: 12px; color: #888; }
    .num-col { text-align: right; }
    .no-data { text-align: center; padding: 48px !important; color: #888; }
    .danger-item { color: #c62828 !important; mat-icon { color: #c62828 !important; } }

    @media (max-width: 600px) {
      .filter-field { width: 100%; }
      .mat-column-dueDate { display: none; }
    }
  `],
})
export class InvoicesComponent implements OnInit {
  private api = inject(ApiService)
  private snack = inject(MatSnackBar)

  invoices = signal<Invoice[]>([])
  loading = signal(true)
  statusFilter = ''
  statuses: InvoiceStatus[] = ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled']
  cols = ['number', 'client', 'status', 'dueDate', 'total', 'actions']

  ngOnInit() { this.load() }

  load() {
    this.loading.set(true)
    this.api.getInvoices(this.statusFilter ? { status: this.statusFilter } : undefined).subscribe({
      next: (data) => { this.invoices.set(data); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  sendInvoice(inv: Invoice) {
    this.api.sendInvoice(inv.id).subscribe({
      next: () => { this.snack.open(`Invoice ${inv.invoiceNumber} sent!`, '', { duration: 3000 }); this.load() },
      error: () => this.snack.open('Failed to send invoice', 'Dismiss', { duration: 3000 }),
    })
  }

  deleteInvoice(inv: Invoice) {
    if (!confirm(`Cancel invoice ${inv.invoiceNumber}?`)) return
    this.api.deleteInvoice(inv.id).subscribe({
      next: () => { this.snack.open('Invoice cancelled', '', { duration: 2500 }); this.load() },
      error: () => this.snack.open('Failed to cancel invoice', 'Dismiss', { duration: 3000 }),
    })
  }
}

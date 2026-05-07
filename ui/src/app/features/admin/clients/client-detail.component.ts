import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatCardModule } from '@angular/material/card'
import { MatTableModule } from '@angular/material/table'
import { MatChipsModule } from '@angular/material/chips'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatDialog } from '@angular/material/dialog'
import { MatSnackBar } from '@angular/material/snack-bar'
import { DatePipe, DecimalPipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { Client, Invoice } from '../../../shared/models'

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    RouterLink, DatePipe, DecimalPipe,
    MatButtonModule, MatIconModule, MatCardModule,
    MatTableModule, MatChipsModule, MatProgressSpinnerModule,
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
  `],
})
export class ClientDetailComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)

  id = ''
  client = signal<Client | null>(null)
  invoices = signal<Invoice[]>([])
  loading = signal(true)

  initials = () => {
    const name = this.client()?.name ?? ''
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') ?? ''
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

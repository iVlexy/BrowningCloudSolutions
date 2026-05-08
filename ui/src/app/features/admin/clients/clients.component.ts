import { Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'
import { MatTableModule } from '@angular/material/table'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatDialogModule, MatDialog } from '@angular/material/dialog'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatMenuModule } from '@angular/material/menu'
import { DatePipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { Client } from '../../../shared/models'

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule, DatePipe,
    MatTableModule, MatButtonModule, MatIconModule, MatInputModule,
    MatFormFieldModule, MatDialogModule, MatSnackBarModule,
    MatProgressSpinnerModule, MatMenuModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Clients</h1>
          <p class="page-sub">Manage your client accounts</p>
        </div>
        <button mat-flat-button class="add-btn" (click)="openDialog()">
          <mat-icon>add</mat-icon>
          New Client
        </button>
      </div>

      <div class="search-row">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search clients</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput #searchInput (input)="onSearch(searchInput.value)" placeholder="Name, email, or company" />
        </mat-form-field>
      </div>

      @if (loading()) {
        <div class="loading-row"><mat-spinner diameter="32" /></div>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="clients()" class="mat-elevation-z0">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let c">
                <a [routerLink]="['/admin/clients', c.id]" class="client-link">{{ c.name }}</a>
                @if (c.company) { <div class="sub-text">{{ c.company }}</div> }
              </td>
            </ng-container>

            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let c">{{ c.email }}</td>
            </ng-container>

            <ng-container matColumnDef="phone">
              <th mat-header-cell *matHeaderCellDef>Phone</th>
              <td mat-cell *matCellDef="let c">{{ c.phone || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef>Added</th>
              <td mat-cell *matCellDef="let c">{{ c.createdAt * 1000 | date:'mediumDate' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let c">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu>
                  <a mat-menu-item [routerLink]="['/admin/clients', c.id]">
                    <mat-icon>visibility</mat-icon>View
                  </a>
                  <a mat-menu-item [routerLink]="['/admin/invoices/new']" [queryParams]="{ clientId: c.id }">
                    <mat-icon>receipt_long</mat-icon>New Invoice
                  </a>
                  <button mat-menu-item (click)="openDialog(c)">
                    <mat-icon>edit</mat-icon>Edit
                  </button>
                  <button mat-menu-item class="danger-item" (click)="deleteClient(c)">
                    <mat-icon>delete</mat-icon>Delete
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols;"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell no-data" [attr.colspan]="cols.length">No clients found.</td>
            </tr>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .add-btn { background: #1565C0 !important; color: #fff !important; }

    .search-row { margin-bottom: 20px; }
    .search-field { width: 360px; max-width: 100%; }

    .loading-row { display: flex; justify-content: center; padding: 48px; }

    .table-card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e8edf2;
      overflow-x: auto;
    }

    .client-link { color: #1565C0; font-weight: 500; text-decoration: none; &:hover { text-decoration: underline; } }
    .sub-text { font-size: 12px; color: #888; }
    .no-data { text-align: center; padding: 48px !important; color: #888; }
    .danger-item { color: #c62828 !important; mat-icon { color: #c62828 !important; } }

    @media (max-width: 600px) {
      .search-field { width: 100%; }
      .mat-column-phone, .mat-column-createdAt { display: none; }
    }
  `],
})
export class ClientsComponent implements OnInit {
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)

  clients = signal<Client[]>([])
  loading = signal(true)
  cols = ['name', 'email', 'phone', 'createdAt', 'actions']

  ngOnInit() { this.load() }

  load(search?: string) {
    this.loading.set(true)
    this.api.getClients(search).subscribe({
      next: (data) => { this.clients.set(data); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  onSearch(value: string) {
    clearTimeout((this as any)._searchTimer)
    ;(this as any)._searchTimer = setTimeout(() => this.load(value || undefined), 350)
  }

  openDialog(client?: Client) {
    import('./client-dialog.component').then(({ ClientDialogComponent }) => {
      const ref = this.dialog.open(ClientDialogComponent, {
        width: '560px',
        data: client ?? null,
      })
      ref.afterClosed().subscribe((saved) => { if (saved) this.load() })
    })
  }

  deleteClient(client: Client) {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return
    this.api.deleteClient(client.id).subscribe({
      next: () => { this.snack.open('Client deleted', '', { duration: 2500 }); this.load() },
      error: () => this.snack.open('Failed to delete client', 'Dismiss', { duration: 3000 }),
    })
  }
}

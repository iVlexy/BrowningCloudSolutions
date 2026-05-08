import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core'
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { MatTableModule } from '@angular/material/table'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatDialogModule, MatDialog } from '@angular/material/dialog'
import { MatInputModule } from '@angular/material/input'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { DecimalPipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { Service } from '../../../shared/models'

@Component({
  selector: 'app-admin-services',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    MatTableModule, MatButtonModule, MatIconModule, MatDialogModule,
    MatInputModule, MatFormFieldModule, MatSlideToggleModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Services</h1>
          <p class="page-sub">Manage the services shown on your public website</p>
        </div>
        <button mat-flat-button class="add-btn" (click)="openDialog()">
          <mat-icon>add</mat-icon>New Service
        </button>
      </div>

      @if (loading() && services().length === 0) {
        <div class="loading-row"><mat-spinner diameter="32" /></div>
      } @else if (error() && services().length === 0) {
        <div class="error-row">
          <mat-icon>error_outline</mat-icon>
          <span>Failed to load. Check your connection.</span>
          <button mat-stroked-button (click)="load()">Retry</button>
        </div>
      } @else {
        <div class="table-card">
          <table mat-table [dataSource]="services()">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let s">
                <strong>{{ s.name }}</strong>
                @if (s.description) { <div class="sub-text">{{ s.description }}</div> }
              </td>
            </ng-container>

            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef>Starting Price</th>
              <td mat-cell *matCellDef="let s">
                {{ s.basePrice ? ('$' + (s.basePrice | number:'1.0-0')) : '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="active">
              <th mat-header-cell *matHeaderCellDef>Active</th>
              <td mat-cell *matCellDef="let s">
                <mat-slide-toggle
                  [checked]="s.isActive"
                  (change)="toggleActive(s, $event.checked)"
                  color="primary">
                </mat-slide-toggle>
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let s">
                <button mat-icon-button (click)="openDialog(s)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="deleteService(s)"><mat-icon>delete</mat-icon></button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols;"></tr>
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell no-data" [attr.colspan]="cols.length">No services yet.</td>
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

    .add-btn { background: #1565C0 !important; color: #fff !important; }
    .loading-row { display: flex; justify-content: center; padding: 48px; }
    .error-row { display: flex; align-items: center; gap: 12px; padding: 48px; justify-content: center; color: #c62828; button { margin-left: 8px; } }
    .table-card { background: #fff; border-radius: 12px; border: 1px solid #e8edf2; overflow: hidden; }
    .sub-text { font-size: 12px; color: #888; max-width: 400px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .no-data { text-align: center; padding: 48px !important; color: #888; }
  `],
})
export class AdminServicesComponent implements OnInit {
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)
  private destroyRef = inject(DestroyRef)

  services = signal<Service[]>([])
  loading = signal(true)
  error = signal(false)
  cols = ['name', 'price', 'active', 'actions']

  ngOnInit() { this.load() }

  load() {
    this.loading.set(true)
    this.error.set(false)
    this.api.getAllServices().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => { this.services.set(data); this.loading.set(false) },
      error: () => { this.loading.set(false); this.error.set(true) },
    })
  }

  toggleActive(service: Service, isActive: boolean) {
    this.api.updateService(service.id, { isActive }).subscribe({
      next: () => this.load(),
      error: () => this.snack.open('Failed to update', 'Dismiss', { duration: 3000 }),
    })
  }

  openDialog(service?: Service) {
    import('./service-dialog.component').then(({ ServiceDialogComponent }) => {
      const ref = this.dialog.open(ServiceDialogComponent, {
        width: '520px',
        data: service ?? null,
      })
      ref.afterClosed().subscribe((saved) => { if (saved) this.load() })
    })
  }

  deleteService(service: Service) {
    if (!confirm(`Delete "${service.name}"?`)) return
    this.api.deleteService(service.id).subscribe({
      next: () => { this.snack.open('Service deleted', '', { duration: 2500 }); this.load() },
      error: () => this.snack.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    })
  }
}

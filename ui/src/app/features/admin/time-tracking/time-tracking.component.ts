import { Component, inject, OnInit, signal, computed } from '@angular/core'
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { RouterLink } from '@angular/router'import { MatCardModule } from '@angular/material/card'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatTableModule } from '@angular/material/table'
import { MatCheckboxModule } from '@angular/material/checkbox'
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { MatTooltipModule } from '@angular/material/tooltip'
import { SelectionModel } from '@angular/cdk/collections'
import { ApiService } from '../../../core/services/api.service'

@Component({
  selector: 'app-time-entry-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Log Time</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Client</mat-label>
          <mat-select formControlName="clientId">
            @for (cl of clients; track cl.id) {
              <mat-option [value]="cl.id">{{ cl.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date</mat-label>
          <input matInput type="date" formControlName="dateStr" />
        </mat-form-field>

        <div class="row-fields">
          <mat-form-field appearance="outline">
            <mat-label>Hours</mat-label>
            <input matInput type="number" step="0.25" min="0.25" formControlName="hours" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Rate ($/hr)</mat-label>
            <input matInput type="number" step="1" min="0" formControlName="rate" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
        </mat-form-field>

        <div class="subtotal" *ngIf="form.value.hours && form.value.rate">
          Subtotal: <strong>{{ (form.value.hours! * form.value.rate!) | currency }}</strong>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: 380px; padding-top: 8px; }
    .row-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .subtotal { font-size: 14px; color: #444; padding: 4px 0; }
  `],
})
export class TimeEntryDialogComponent {
  clients: any[] = []

  form = inject(FormBuilder).group({
    clientId: ['', Validators.required],
    dateStr: [new Date().toISOString().slice(0, 10), Validators.required],
    hours: [null as number | null, [Validators.required, Validators.min(0.25)]],
    rate: [null as number | null, [Validators.required, Validators.min(0)]],
    description: ['', Validators.required],
  })

  private dialogRef = inject(MatDialogRef<TimeEntryDialogComponent>)

  submit() {
    if (this.form.invalid) return
    const v = this.form.value
    const date = Math.floor(new Date(v.dateStr!).getTime() / 1000)
    this.dialogRef.close({ clientId: v.clientId, date, hours: v.hours, rate: v.rate, description: v.description })
  }
}

@Component({
  selector: 'app-time-tracking',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatTableModule, MatCheckboxModule,
    MatDialogModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Time Tracking</h1>
        <div class="header-actions">
          @if (selection.selected.length > 0) {
            <button mat-stroked-button color="primary" (click)="generateInvoice()" matTooltip="Create invoice from selected entries">
              <mat-icon>receipt_long</mat-icon> Invoice {{ selection.selected.length }} entries ({{ selectionTotal() | currency }})
            </button>
          }
          <button mat-flat-button color="primary" (click)="openAdd()">
            <mat-icon>add</mat-icon> Log Time
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="center-spinner"><mat-spinner diameter="40" /></div>
      } @else {
        <mat-card>
          <mat-card-content>
            <table mat-table [dataSource]="entries()" class="full-width-table">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef>
                  <mat-checkbox
                    [checked]="isAllUnbilledSelected()"
                    [indeterminate]="selection.selected.length > 0 && !isAllUnbilledSelected()"
                    (change)="toggleAll()">
                  </mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let e">
                  <mat-checkbox *ngIf="!e.invoiced"
                    [checked]="selection.isSelected(e)"
                    (change)="selection.toggle(e)">
                  </mat-checkbox>
                </td>
              </ng-container>
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let e">{{ e.date * 1000 | date:'MMM d, y' }}</td>
              </ng-container>
              <ng-container matColumnDef="client">
                <th mat-header-cell *matHeaderCellDef>Client</th>
                <td mat-cell *matCellDef="let e">{{ e.clientName }}</td>
              </ng-container>
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Description</th>
                <td mat-cell *matCellDef="let e">{{ e.description }}</td>
              </ng-container>
              <ng-container matColumnDef="hours">
                <th mat-header-cell *matHeaderCellDef class="num-col">Hours</th>
                <td mat-cell *matCellDef="let e" class="num-col">{{ e.hours }}</td>
              </ng-container>
              <ng-container matColumnDef="rate">
                <th mat-header-cell *matHeaderCellDef class="num-col">Rate</th>
                <td mat-cell *matCellDef="let e" class="num-col">{{ e.rate | currency }}/hr</td>
              </ng-container>
              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef class="num-col">Amount</th>
                <td mat-cell *matCellDef="let e" class="num-col"><strong>{{ e.hours * e.rate | currency }}</strong></td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let e">
                  @if (e.invoiced) {
                    <span class="status-chip invoiced">Invoiced</span>
                  } @else {
                    <span class="status-chip unbilled">Unbilled</span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let e">
                  <button mat-icon-button color="warn" *ngIf="!e.invoiced" (click)="delete(e)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols;" [class.invoiced-row]="row.invoiced"></tr>
            </table>
            @if (entries().length === 0) {
              <p class="empty-state">No time entries yet. Log time to get started.</p>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 600; margin: 0; color: #1a2332; }
    .header-actions { display: flex; gap: 12px; align-items: center; }
    .center-spinner { display: flex; justify-content: center; padding: 60px; }
    .full-width-table { width: 100%; }
    .num-col { text-align: right !important; }
    .status-chip { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .status-chip.invoiced { background: #e8f5e9; color: #2e7d32; }
    .status-chip.unbilled { background: #fff8e1; color: #f57f17; }
    .invoiced-row { opacity: 0.6; }
    .empty-state { color: #999; text-align: center; padding: 32px; }
  `],
})
export class TimeTrackingComponent implements OnInit {
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)

  loading = signal(true)
  entries = signal<any[]>([])
  clients = signal<any[]>([])
  selection = new SelectionModel<any>(true, [])
  cols = ['select', 'date', 'client', 'description', 'hours', 'rate', 'amount', 'status', 'actions']

  selectionTotal = computed(() => this.selection.selected.reduce((s, e) => s + e.hours * e.rate, 0))

  unbilledEntries = computed(() => this.entries().filter((e) => !e.invoiced))

  isAllUnbilledSelected() {
    const unbilled = this.unbilledEntries()
    return unbilled.length > 0 && unbilled.every((e) => this.selection.isSelected(e))
  }

  toggleAll() {
    if (this.isAllUnbilledSelected()) {
      this.selection.clear()
    } else {
      this.unbilledEntries().forEach((e) => this.selection.select(e))
    }
  }

  ngOnInit() {
    this.api.getClients().subscribe((list) => this.clients.set(list))
    this.load()
  }

  load() {
    this.api.getTimeEntries().subscribe({
      next: (list) => { this.entries.set(list); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  openAdd() {
    const ref = this.dialog.open(TimeEntryDialogComponent, { width: '440px' })
    const instance = ref.componentInstance
    instance.clients = this.clients()
    ref.afterClosed().subscribe((result) => {
      if (!result) return
      this.api.createTimeEntry(result).subscribe(() => {
        this.snack.open('Time logged', 'OK', { duration: 2500 })
        this.load()
      })
    })
  }

  generateInvoice() {
    const selected = this.selection.selected
    if (selected.length === 0) return
    const clientId = selected[0].clientId
    if (selected.some((e) => e.clientId !== clientId)) {
      this.snack.open('Select entries from a single client', 'OK', { duration: 3000 })
      return
    }
    const entryIds = selected.map((e) => e.id)
    this.api.invoiceTimeEntries({ entryIds, clientId }).subscribe({
      next: (res: any) => {
        this.snack.open(`Invoice ${res.invoice.invoiceNumber} created`, 'View', { duration: 4000 })
        this.selection.clear()
        this.load()
      },
      error: () => this.snack.open('Failed to create invoice', 'OK', { duration: 3000 }),
    })
  }

  delete(entry: any) {
    if (!confirm('Delete this time entry?')) return
    this.api.deleteTimeEntry(entry.id).subscribe(() => {
      this.snack.open('Deleted', 'OK', { duration: 2000 })
      this.entries.update((list) => list.filter((e) => e.id !== entry.id))
    })
  }
}

import { Component, inject, Inject } from '@angular/core'
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatButtonModule } from '@angular/material/button'
import { MatDatepickerModule } from '@angular/material/datepicker'
import { MatNativeDateModule } from '@angular/material/core'
import { MatSnackBar } from '@angular/material/snack-bar'
import { DecimalPipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { Invoice } from '../../../shared/models'

@Component({
  selector: 'app-record-payment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule,
  ],
  template: `
    <h2 mat-dialog-title>Record Payment</h2>
    <mat-dialog-content>
      <div class="invoice-info">
        Invoice {{ data.invoice.invoiceNumber }} — Total \${{ data.invoice.total | number:'1.2-2' }}
      </div>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Amount *</mat-label>
            <span matTextPrefix>$ </span>
            <input matInput formControlName="amount" type="number" min="0.01" step="0.01" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Method *</mat-label>
            <mat-select formControlName="method">
              <mat-option value="cash">Cash</mat-option>
              <mat-option value="check">Check</mat-option>
              <mat-option value="bank_transfer">Bank Transfer</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        @if (form.get('method')?.value === 'check') {
          <mat-form-field appearance="outline" class="full">
            <mat-label>Check Number</mat-label>
            <input matInput formControlName="checkNumber" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="full">
          <mat-label>Payment Date</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="paidAt" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Notes</mat-label>
          <input matInput formControlName="notes" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="form.invalid || saving" class="save-btn">
        {{ saving ? 'Saving...' : 'Record Payment' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .invoice-info {
      background: #e3f2fd; color: #1565C0; border-radius: 8px;
      padding: 10px 14px; margin-bottom: 16px; font-weight: 500; font-size: 14px;
    }
    .dialog-form { display: flex; flex-direction: column; gap: 4px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full { width: 100%; }
    mat-form-field { width: 100%; }
    .save-btn { background: #1565C0 !important; color: #fff !important; }
  `],
})
export class RecordPaymentDialogComponent {
  private api = inject(ApiService)
  private snack = inject(MatSnackBar)
  private fb = inject(FormBuilder)
  private ref = inject(MatDialogRef<RecordPaymentDialogComponent>)
  data: { invoice: Invoice } = inject(MAT_DIALOG_DATA)

  saving = false

  form = this.fb.group({
    amount:      [this.data.invoice.total, [Validators.required, Validators.min(0.01)]],
    method:      ['cash', Validators.required],
    checkNumber: [''],
    paidAt:      [new Date()],
    notes:       [''],
  })

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return }
    this.saving = true

    const v = this.form.value
    this.api.recordPayment({
      invoiceId:   this.data.invoice.id,
      amount:      Number(v.amount),
      method:      v.method as 'cash' | 'check' | 'bank_transfer',
      checkNumber: v.method === 'check' && v.checkNumber ? v.checkNumber : undefined,
      notes:       v.notes || undefined,
      paidAt:      v.paidAt ? Math.floor(new Date(v.paidAt).getTime() / 1000) : undefined,
    }).subscribe({
      next: () => { this.saving = false; this.ref.close(true) },
      error: () => {
        this.saving = false
        this.snack.open('Failed to record payment', 'Dismiss', { duration: 3000 })
      },
    })
  }
}

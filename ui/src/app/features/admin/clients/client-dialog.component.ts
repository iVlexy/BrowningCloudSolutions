import { Component, inject, Inject } from '@angular/core'
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatButtonModule } from '@angular/material/button'
import { MatSnackBar } from '@angular/material/snack-bar'
import { ApiService } from '../../../core/services/api.service'
import type { Client } from '../../../shared/models'

@Component({
  selector: 'app-client-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit' : 'New' }} Client</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Name *</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email *</mat-label>
            <input matInput formControlName="email" type="email" />
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Phone</mat-label>
            <input matInput formControlName="phone" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Company</mat-label>
            <input matInput formControlName="company" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Address</mat-label>
          <input matInput formControlName="address" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Notes</mat-label>
          <textarea matInput formControlName="notes" rows="3"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="save()" [disabled]="form.invalid || saving" class="save-btn">
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full { width: 100%; }
    mat-form-field { width: 100%; }
    .save-btn { background: #1565C0 !important; color: #fff !important; }
  `],
})
export class ClientDialogComponent {
  private api = inject(ApiService)
  private snack = inject(MatSnackBar)
  private fb = inject(FormBuilder)
  private ref = inject(MatDialogRef<ClientDialogComponent>)
  data: Client | null = inject(MAT_DIALOG_DATA)

  saving = false

  form = this.fb.group({
    name:    [this.data?.name ?? '', Validators.required],
    email:   [this.data?.email ?? '', [Validators.required, Validators.email]],
    phone:   [this.data?.phone ?? ''],
    company: [this.data?.company ?? ''],
    address: [this.data?.address ?? ''],
    notes:   [this.data?.notes ?? ''],
  })

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return }
    this.saving = true

    const op = this.data
      ? this.api.updateClient(this.data.id, this.form.value as Partial<Client>)
      : this.api.createClient(this.form.value as Partial<Client>)

    op.subscribe({
      next: () => { this.saving = false; this.ref.close(true) },
      error: () => {
        this.saving = false
        this.snack.open('Failed to save client', 'Dismiss', { duration: 3000 })
      },
    })
  }
}

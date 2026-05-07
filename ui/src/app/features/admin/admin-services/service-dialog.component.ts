import { Component, inject, Inject } from '@angular/core'
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatButtonModule } from '@angular/material/button'
import { MatSlideToggleModule } from '@angular/material/slide-toggle'
import { MatSnackBar } from '@angular/material/snack-bar'
import { ApiService } from '../../../core/services/api.service'
import type { Service } from '../../../shared/models'

@Component({
  selector: 'app-service-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit' : 'New' }} Service</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Service Name *</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
        </mat-form-field>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Starting Price ($)</mat-label>
            <input matInput formControlName="basePrice" type="number" min="0" step="0.01" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Sort Order</mat-label>
            <input matInput formControlName="sortOrder" type="number" min="0" />
          </mat-form-field>
        </div>
        <mat-slide-toggle formControlName="isActive" color="primary">Show on website</mat-slide-toggle>
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
    .dialog-form { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full { width: 100%; }
    mat-form-field { width: 100%; }
    .save-btn { background: #1565C0 !important; color: #fff !important; }
  `],
})
export class ServiceDialogComponent {
  private api = inject(ApiService)
  private snack = inject(MatSnackBar)
  private fb = inject(FormBuilder)
  private ref = inject(MatDialogRef<ServiceDialogComponent>)
  data: Service | null = inject(MAT_DIALOG_DATA)

  saving = false

  form = this.fb.group({
    name:        [this.data?.name ?? '', Validators.required],
    description: [this.data?.description ?? ''],
    basePrice:   [this.data?.basePrice ?? null],
    sortOrder:   [this.data?.sortOrder ?? 0],
    isActive:    [this.data?.isActive ?? true],
  })

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return }
    this.saving = true

    const op = this.data
      ? this.api.updateService(this.data.id, this.form.value as Partial<Service>)
      : this.api.createService(this.form.value as Partial<Service>)

    op.subscribe({
      next: () => { this.saving = false; this.ref.close(true) },
      error: () => {
        this.saving = false
        this.snack.open('Failed to save service', 'Dismiss', { duration: 3000 })
      },
    })
  }
}

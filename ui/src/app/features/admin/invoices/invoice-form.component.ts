import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatSelectModule } from '@angular/material/select'
import { MatDatepickerModule } from '@angular/material/datepicker'
import { MatNativeDateModule } from '@angular/material/core'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { DecimalPipe } from '@angular/common'
import { ApiService } from '../../../core/services/api.service'
import type { Client } from '../../../shared/models'

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [
    RouterLink, ReactiveFormsModule, DecimalPipe,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="breadcrumb">
          <a routerLink="/admin/invoices">Invoices</a>
          <mat-icon>chevron_right</mat-icon>
          <span>New Invoice</span>
        </div>
      </div>

      @if (loadingClients()) {
        <div class="loading-row"><mat-spinner diameter="32" /></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" class="invoice-form">
          <div class="form-card">
            <h3 class="section-label">Invoice Details</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Client *</mat-label>
                <mat-select formControlName="clientId">
                  @for (c of clients(); track c.id) {
                    <mat-option [value]="c.id">{{ c.name }}{{ c.company ? ' — ' + c.company : '' }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Due Date</mat-label>
                <input matInput [matDatepicker]="picker" formControlName="dueDate" />
                <mat-datepicker-toggle matIconSuffix [for]="picker" />
                <mat-datepicker #picker />
              </mat-form-field>

              <mat-form-field appearance="outline" class="span-2">
                <mat-label>Notes</mat-label>
                <textarea matInput formControlName="notes" rows="2"></textarea>
              </mat-form-field>
            </div>
          </div>

          <!-- Line items -->
          <div class="form-card">
            <div class="section-header">
              <h3 class="section-label">Line Items</h3>
              <button mat-stroked-button type="button" (click)="addItem()">
                <mat-icon>add</mat-icon>Add Item
              </button>
            </div>

            <div formArrayName="items">
              @for (item of itemsArray.controls; track $index) {
                <div class="line-item" [formGroupName]="$index">
                  <mat-form-field appearance="outline" class="desc-field">
                    <mat-label>Description</mat-label>
                    <input matInput formControlName="description" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="qty-field">
                    <mat-label>Qty</mat-label>
                    <input matInput formControlName="quantity" type="number" min="0.01" step="0.01"
                      (input)="recalc()" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="price-field">
                    <mat-label>Unit Price</mat-label>
                    <span matTextPrefix>$ </span>
                    <input matInput formControlName="unitPrice" type="number" min="0" step="0.01"
                      (input)="recalc()" />
                  </mat-form-field>
                  <div class="amount-col">\${{ getItemAmount($index) | number:'1.2-2' }}</div>
                  <button mat-icon-button type="button" color="warn" (click)="removeItem($index)"
                    [disabled]="itemsArray.length === 1">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              }
            </div>

            <!-- Totals -->
            <div class="totals-section">
              <div class="tax-row">
                <mat-form-field appearance="outline" class="tax-field">
                  <mat-label>Tax Rate (%)</mat-label>
                  <input matInput formControlName="taxRate" type="number" min="0" max="100" step="0.1"
                    (input)="recalc()" />
                </mat-form-field>
              </div>
              <div class="totals">
                <div class="total-row">
                  <span>Subtotal</span>
                  <span>\${{ subtotal() | number:'1.2-2' }}</span>
                </div>
                @if (taxAmount() > 0) {
                  <div class="total-row">
                    <span>Tax</span>
                    <span>\${{ taxAmount() | number:'1.2-2' }}</span>
                  </div>
                }
                <div class="total-row grand-total">
                  <span>Total</span>
                  <span>\${{ total() | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <a mat-stroked-button routerLink="/admin/invoices">Cancel</a>
            <button mat-flat-button type="submit" [disabled]="form.invalid || saving()" class="save-btn">
              {{ saving() ? 'Creating...' : 'Create Invoice' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    .page-header { margin-bottom: 24px; }
    .breadcrumb {
      display: flex; align-items: center; gap: 4px; font-size: 14px;
      a { color: #1565C0; text-decoration: none; }
      mat-icon { font-size: 18px; color: #aaa; }
      span { font-weight: 600; }
    }

    .loading-row { display: flex; justify-content: center; padding: 48px; }

    .invoice-form { display: flex; flex-direction: column; gap: 20px; }

    .form-card {
      background: #fff; border-radius: 12px; border: 1px solid #e8edf2; padding: 24px;
    }

    .section-label { margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #1a2332; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      mat-form-field { width: 100%; }
      .span-2 { grid-column: 1 / -1; }
    }

    .line-item {
      display: grid;
      grid-template-columns: 1fr 80px 140px 100px 40px;
      gap: 12px;
      align-items: center;
      margin-bottom: 8px;
      mat-form-field { width: 100%; }
    }

    .desc-field {}
    .qty-field {}
    .price-field {}
    .amount-col { font-weight: 600; text-align: right; font-size: 15px; }

    .totals-section {
      border-top: 1px solid #f0f0f0;
      margin-top: 16px;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .tax-field { width: 180px; }

    .totals { min-width: 240px; }

    .total-row {
      display: flex; justify-content: space-between;
      padding: 6px 0; font-size: 14px; color: #555;
    }

    .grand-total {
      border-top: 2px solid #1a2332;
      margin-top: 6px; padding-top: 8px;
      font-size: 18px; font-weight: 700; color: #1a2332;
    }

    .form-actions {
      display: flex; gap: 12px; justify-content: flex-end;
    }

    .save-btn { background: #1565C0 !important; color: #fff !important; }
  `],
})
export class InvoiceFormComponent implements OnInit {
  private api = inject(ApiService)
  private router = inject(Router)
  private route = inject(ActivatedRoute)
  private snack = inject(MatSnackBar)
  private fb = inject(FormBuilder)

  clients = signal<Client[]>([])
  loadingClients = signal(true)
  saving = signal(false)
  subtotal = signal(0)
  taxAmount = signal(0)
  total = signal(0)

  form = this.fb.group({
    clientId: ['', Validators.required],
    dueDate: [null as Date | null],
    notes: [''],
    taxRate: [0],
    items: this.fb.array([this.createItemGroup()]),
  })

  get itemsArray() { return this.form.get('items') as FormArray }

  ngOnInit() {
    const preselectedClientId = this.route.snapshot.queryParamMap.get('clientId')

    this.api.getClients().subscribe({
      next: (data) => {
        this.clients.set(data)
        this.loadingClients.set(false)
        if (preselectedClientId) {
          this.form.get('clientId')!.setValue(preselectedClientId)
        }
      },
      error: () => this.loadingClients.set(false),
    })
  }

  createItemGroup() {
    return this.fb.group({
      description: ['', Validators.required],
      quantity:    [1, [Validators.required, Validators.min(0.01)]],
      unitPrice:   [0, [Validators.required, Validators.min(0)]],
    })
  }

  addItem() { this.itemsArray.push(this.createItemGroup()) }

  removeItem(i: number) {
    if (this.itemsArray.length > 1) this.itemsArray.removeAt(i)
  }

  getItemAmount(i: number): number {
    const item = this.itemsArray.at(i).value
    return (item.quantity ?? 0) * (item.unitPrice ?? 0)
  }

  recalc() {
    const sub = this.itemsArray.controls.reduce((sum, ctrl) => {
      const v = ctrl.value
      return sum + (v.quantity ?? 0) * (v.unitPrice ?? 0)
    }, 0)
    const tax = sub * ((this.form.value.taxRate ?? 0) / 100)
    this.subtotal.set(sub)
    this.taxAmount.set(tax)
    this.total.set(sub + tax)
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return }
    this.saving.set(true)

    const v = this.form.value
    const dueDate = v.dueDate ? Math.floor(new Date(v.dueDate).getTime() / 1000) : null

    this.api.createInvoice({
      clientId: v.clientId!,
      dueDate,
      notes: v.notes || null,
      taxRate: v.taxRate ?? 0,
      items: v.items!.map((i: any) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
    }).subscribe({
      next: (inv) => {
        this.saving.set(false)
        this.snack.open('Invoice created!', '', { duration: 2500 })
        this.router.navigate(['/admin/invoices', inv.id])
      },
      error: () => {
        this.saving.set(false)
        this.snack.open('Failed to create invoice', 'Dismiss', { duration: 3000 })
      },
    })
  }
}

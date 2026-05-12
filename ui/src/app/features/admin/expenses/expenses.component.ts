import { Component, inject, OnInit, signal, computed } from '@angular/core'
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatTableModule } from '@angular/material/table'
import { MatChipsModule } from '@angular/material/chips'
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { ApiService } from '../../../core/services/api.service'

const CATEGORIES = ['software', 'hardware', 'marketing', 'travel', 'labor', 'utilities', 'other']

const CATEGORY_COLORS: Record<string, string> = {
  software: '#e3f2fd', hardware: '#f3e5f5', marketing: '#fff8e1',
  travel: '#e8f5e9', labor: '#fce4ec', utilities: '#e0f2f1', other: '#f5f5f5',
}

@Component({
  selector: 'app-expense-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.expense ? 'Edit Expense' : 'Add Expense' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category">
            @for (cat of categories; track cat) {
              <mat-option [value]="cat">{{ cat | titlecase }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <input matInput formControlName="description" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Amount ($)</mat-label>
          <input matInput type="number" step="0.01" min="0" formControlName="amount" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Date</mat-label>
          <input matInput type="date" formControlName="dateStr" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Notes (optional)</mat-label>
          <textarea matInput rows="2" formControlName="notes"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: 360px; padding-top: 8px; }`],
})
export class ExpenseDialogComponent {
  categories = CATEGORIES
  data: any = inject(MatDialog)
  private dialogRef = inject(MatDialogRef<ExpenseDialogComponent>)

  constructor() {
    // Injected via dialog data
  }

  form = inject(FormBuilder).group({
    category: ['software', Validators.required],
    description: ['', Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    dateStr: [new Date().toISOString().slice(0, 10), Validators.required],
    notes: [''],
  })

  submit() {
    if (this.form.invalid) return
    const v = this.form.value
    const date = Math.floor(new Date(v.dateStr!).getTime() / 1000)
    this.dialogRef.close({ ...v, date })
  }
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatChipsModule, MatDialogModule, MatProgressSpinnerModule, MatSnackBarModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Expenses</h1>
        <button mat-flat-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> Add Expense
        </button>
      </div>

      <!-- Category summary -->
      <div class="summary-row">
        @for (cat of categorySummary(); track cat.name) {
          <mat-card class="summary-card">
            <mat-card-content>
              <div class="sum-label">{{ cat.name | titlecase }}</div>
              <div class="sum-value">{{ cat.total | currency }}</div>
            </mat-card-content>
          </mat-card>
        }
        <mat-card class="summary-card summary-total">
          <mat-card-content>
            <div class="sum-label">Total</div>
            <div class="sum-value">{{ grandTotal() | currency }}</div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (loading()) {
        <div class="center-spinner"><mat-spinner diameter="40" /></div>
      } @else {
        <mat-card>
          <mat-card-content>
            <table mat-table [dataSource]="expenses()" class="full-width-table">
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let e">{{ e.date * 1000 | date:'MMM d, y' }}</td>
              </ng-container>
              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef>Category</th>
                <td mat-cell *matCellDef="let e">
                  <span class="cat-chip" [style.background]="catColor(e.category)">{{ e.category | titlecase }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Description</th>
                <td mat-cell *matCellDef="let e">{{ e.description }}</td>
              </ng-container>
              <ng-container matColumnDef="notes">
                <th mat-header-cell *matHeaderCellDef>Notes</th>
                <td mat-cell *matCellDef="let e" class="notes-cell">{{ e.notes }}</td>
              </ng-container>
              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef class="amount-col">Amount</th>
                <td mat-cell *matCellDef="let e" class="amount-col"><strong>{{ e.amount | currency }}</strong></td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let e">
                  <button mat-icon-button color="warn" (click)="delete(e)"><mat-icon>delete</mat-icon></button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols;"></tr>
            </table>
            @if (expenses().length === 0) {
              <p class="empty-state">No expenses recorded yet.</p>
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
    .center-spinner { display: flex; justify-content: center; padding: 60px; }

    .summary-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    .summary-card { min-width: 120px; }
    .summary-card mat-card-content { padding: 12px 16px !important; }
    .sum-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
    .sum-value { font-size: 18px; font-weight: 700; color: #1a2332; }
    .summary-total { background: #1a2332 !important; .sum-label { color: #90caf9; } .sum-value { color: #fff; } }

    .full-width-table { width: 100%; }
    .cat-chip { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .amount-col { text-align: right !important; }
    .notes-cell { font-size: 12px; color: #888; max-width: 200px; }
    .empty-state { color: #999; text-align: center; padding: 32px; }
  `],
})
export class ExpensesComponent implements OnInit {
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)

  loading = signal(true)
  expenses = signal<any[]>([])
  cols = ['date', 'category', 'description', 'notes', 'amount', 'actions']

  categorySummary = computed(() => {
    const map = new Map<string, number>()
    for (const e of this.expenses()) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total)
  })

  grandTotal = computed(() => this.expenses().reduce((s, e) => s + e.amount, 0))

  ngOnInit() { this.load() }

  load() {
    this.api.getExpenses().subscribe({
      next: (list) => { this.expenses.set(list); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  catColor(cat: string) { return CATEGORY_COLORS[cat] ?? '#f5f5f5' }

  openAdd() {
    import('@angular/material/dialog').then(({ MatDialog }) => {
      const ref = this.dialog.open(ExpenseDialogComponent, { width: '420px' })
      ref.afterClosed().subscribe((result) => {
        if (!result) return
        this.api.createExpense(result).subscribe(() => {
          this.snack.open('Expense added', 'OK', { duration: 2500 })
          this.load()
        })
      })
    })
  }

  delete(expense: any) {
    if (!confirm(`Delete "${expense.description}"?`)) return
    this.api.deleteExpense(expense.id).subscribe(() => {
      this.snack.open('Deleted', 'OK', { duration: 2000 })
      this.expenses.update((list) => list.filter((e) => e.id !== expense.id))
    })
  }
}

import { Component, inject, OnInit, signal } from '@angular/core'
import { CommonModule, DatePipe } from '@angular/common'
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatTableModule } from '@angular/material/table'
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { MatTooltipModule } from '@angular/material/tooltip'
import { ApiService } from '../../../core/services/api.service'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:    { bg: '#f5f5f5',  color: '#616161' },
  sent:     { bg: '#e3f2fd',  color: '#1565c0' },
  signed:   { bg: '#e8f5e9',  color: '#2e7d32' },
  declined: { bg: '#ffebee',  color: '#c62828' },
}

@Component({
  selector: 'app-contract-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ contract ? 'Edit Contract' : 'New Contract' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" *ngIf="!contract">
          <mat-label>Client</mat-label>
          <mat-select formControlName="clientId">
            @for (cl of clients; track cl.id) {
              <mat-option [value]="cl.id">{{ cl.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Contract Title</mat-label>
          <input matInput formControlName="title" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Content</mat-label>
          <textarea matInput rows="12" formControlName="content" placeholder="Paste or type the contract text here..."></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: 500px; padding-top: 8px; }`],
})
export class ContractDialogComponent {
  contract: any = null
  clients: any[] = []

  form = inject(FormBuilder).group({
    clientId: ['', Validators.required],
    title: ['', Validators.required],
    content: ['', Validators.required],
  })

  private dialogRef = inject(MatDialogRef<ContractDialogComponent>)

  ngOnInit() {
    if (this.contract) {
      this.form.patchValue({ title: this.contract.title, content: this.contract.content })
      this.form.get('clientId')?.clearValidators()
    }
  }

  submit() {
    if (this.form.invalid) return
    this.dialogRef.close(this.form.value)
  }
}

@Component({
  selector: 'app-mark-signed-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Mark as Signed</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Signed By (Name)</mat-label>
          <input matInput formControlName="signedByName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Signed By (Email)</mat-label>
          <input matInput type="email" formControlName="signedByEmail" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">Confirm</button>
    </mat-dialog-actions>
  `,
  styles: [`.dialog-form { display: flex; flex-direction: column; gap: 4px; min-width: 360px; padding-top: 8px; }`],
})
export class MarkSignedDialogComponent {
  form = inject(FormBuilder).group({
    signedByName: ['', Validators.required],
    signedByEmail: ['', [Validators.required, Validators.email]],
  })
  private dialogRef = inject(MatDialogRef<MarkSignedDialogComponent>)
  submit() { if (!this.form.invalid) this.dialogRef.close(this.form.value) }
}

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CommonModule, DatePipe, MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatDialogModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Contracts</h1>
        <button mat-flat-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon> New Contract
        </button>
      </div>

      @if (loading()) {
        <div class="center-spinner"><mat-spinner diameter="40" /></div>
      } @else {
        <mat-card>
          <mat-card-content>
            <table mat-table [dataSource]="contracts()" class="full-width-table">
              <ng-container matColumnDef="client">
                <th mat-header-cell *matHeaderCellDef>Client</th>
                <td mat-cell *matCellDef="let c">{{ c.clientName }}</td>
              </ng-container>
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Title</th>
                <td mat-cell *matCellDef="let c"><strong>{{ c.title }}</strong></td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let c">
                  <span class="status-chip"
                    [style.background]="statusStyle(c.status).bg"
                    [style.color]="statusStyle(c.status).color">
                    {{ c.status | titlecase }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="signed">
                <th mat-header-cell *matHeaderCellDef>Signed By</th>
                <td mat-cell *matCellDef="let c">
                  @if (c.signedByName) {
                    <span>{{ c.signedByName }}<br><small>{{ c.signedAt * 1000 | date:'MMM d, y' }}</small></span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="created">
                <th mat-header-cell *matHeaderCellDef>Created</th>
                <td mat-cell *matCellDef="let c">{{ c.createdAt * 1000 | date:'MMM d, y' }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let c">
                  <button mat-icon-button (click)="viewContent(c)" matTooltip="View content"><mat-icon>visibility</mat-icon></button>
                  @if (c.status === 'draft') {
                    <button mat-icon-button (click)="markSent(c)" matTooltip="Mark as Sent"><mat-icon>send</mat-icon></button>
                    <button mat-icon-button (click)="openEdit(c)" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
                  }
                  @if (c.status === 'sent') {
                    <button mat-icon-button color="primary" (click)="markSigned(c)" matTooltip="Record Signature"><mat-icon>draw</mat-icon></button>
                  }
                  @if (c.status !== 'signed') {
                    <button mat-icon-button color="warn" (click)="delete(c)" matTooltip="Delete"><mat-icon>delete</mat-icon></button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols;"></tr>
            </table>
            @if (contracts().length === 0) {
              <p class="empty-state">No contracts yet.</p>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>

    <!-- Content viewer overlay -->
    @if (viewingContract()) {
      <div class="content-overlay" (click)="viewingContract.set(null)">
        <div class="content-panel" (click)="$event.stopPropagation()">
          <div class="content-panel-header">
            <h2>{{ viewingContract()!.title }}</h2>
            <button mat-icon-button (click)="viewingContract.set(null)"><mat-icon>close</mat-icon></button>
          </div>
          <pre class="contract-text">{{ viewingContract()!.content }}</pre>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 600; margin: 0; color: #1a2332; }
    .center-spinner { display: flex; justify-content: center; padding: 60px; }
    .full-width-table { width: 100%; }
    .status-chip { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .empty-state { color: #999; text-align: center; padding: 32px; }

    .content-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
    }
    .content-panel {
      background: #fff; border-radius: 8px; width: 640px; max-width: 90vw;
      max-height: 80vh; display: flex; flex-direction: column; overflow: hidden;
    }
    .content-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid #eee;
      h2 { margin: 0; font-size: 18px; }
    }
    .contract-text {
      flex: 1; overflow: auto; padding: 20px;
      font-family: inherit; font-size: 14px; line-height: 1.6; white-space: pre-wrap;
      margin: 0; color: #333;
    }
  `],
})
export class ContractsComponent implements OnInit {
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)

  loading = signal(true)
  contracts = signal<any[]>([])
  clients = signal<any[]>([])
  viewingContract = signal<any | null>(null)
  cols = ['client', 'title', 'status', 'signed', 'created', 'actions']

  ngOnInit() {
    this.api.getClients().subscribe((list) => this.clients.set(list))
    this.load()
  }

  load() {
    this.api.getContracts().subscribe({
      next: (list) => { this.contracts.set(list); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  statusStyle(status: string) {
    return STATUS_COLORS[status] ?? STATUS_COLORS['draft']
  }

  viewContent(contract: any) { this.viewingContract.set(contract) }

  openCreate() {
    const ref = this.dialog.open(ContractDialogComponent, { width: '560px' })
    ref.componentInstance.clients = this.clients()
    ref.afterClosed().subscribe((result) => {
      if (!result) return
      this.api.createContract(result).subscribe(() => {
        this.snack.open('Contract created', 'OK', { duration: 2500 })
        this.load()
      })
    })
  }

  openEdit(contract: any) {
    const ref = this.dialog.open(ContractDialogComponent, { width: '560px' })
    ref.componentInstance.contract = contract
    ref.componentInstance.clients = this.clients()
    ref.afterClosed().subscribe((result) => {
      if (!result) return
      this.api.updateContract(contract.id, result).subscribe(() => {
        this.snack.open('Saved', 'OK', { duration: 2000 })
        this.load()
      })
    })
  }

  markSent(contract: any) {
    this.api.sendContract(contract.id).subscribe(() => {
      this.snack.open('Marked as sent', 'OK', { duration: 2000 })
      this.contracts.update((list) => list.map((c) => c.id === contract.id ? { ...c, status: 'sent' } : c))
    })
  }

  markSigned(contract: any) {
    const ref = this.dialog.open(MarkSignedDialogComponent, { width: '400px' })
    ref.afterClosed().subscribe((result) => {
      if (!result) return
      this.api.signContract(contract.id, result).subscribe(() => {
        this.snack.open('Contract marked as signed', 'OK', { duration: 2500 })
        this.load()
      })
    })
  }

  delete(contract: any) {
    if (!confirm(`Delete "${contract.title}"?`)) return
    this.api.deleteContract(contract.id).subscribe(() => {
      this.snack.open('Deleted', 'OK', { duration: 2000 })
      this.contracts.update((list) => list.filter((c) => c.id !== contract.id))
    })
  }
}

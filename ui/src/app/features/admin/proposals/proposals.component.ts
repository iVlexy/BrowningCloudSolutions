import { Component, inject, OnInit, signal } from '@angular/core'
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common'
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatCardModule } from '@angular/material/card'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatTableModule } from '@angular/material/table'
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatDividerModule } from '@angular/material/divider'
import { ApiService } from '../../../core/services/api.service'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft:    { bg: '#f5f5f5',  color: '#616161' },
  sent:     { bg: '#e3f2fd',  color: '#1565c0' },
  accepted: { bg: '#e8f5e9',  color: '#2e7d32' },
  declined: { bg: '#ffebee',  color: '#c62828' },
}

// ─── Proposal Dialog ──────────────────────────────────────────────────────────
@Component({
  selector: 'app-proposal-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatDividerModule,
    MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit Proposal' : 'New Proposal' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">

        @if (!data?.id) {
          <mat-form-field appearance="outline">
            <mat-label>Client</mat-label>
            <mat-select formControlName="clientId">
              @for (cl of clients; track cl.id) {
                <mat-option [value]="cl.id">{{ cl.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Proposal Title</mat-label>
          <input matInput formControlName="title" />
        </mat-form-field>

        <div class="narrative-section">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Narrative / Overview</mat-label>
            <textarea matInput rows="6" formControlName="narrative"
              placeholder="Describe the project scope and your approach..."></textarea>
          </mat-form-field>

          <div class="ai-section">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>AI Brief (describe the project in a few words)</mat-label>
              <input matInput [formControl]="aiBrief" placeholder="e.g. redesign e-commerce site with payment integration" />
            </mat-form-field>
            <button mat-stroked-button type="button" [disabled]="aiLoading()" (click)="generateNarrative()">
              @if (aiLoading()) {
                <mat-spinner diameter="16" style="display:inline-block;margin-right:8px"></mat-spinner>
              } @else {
                <mat-icon>auto_awesome</mat-icon>
              }
              {{ aiLoading() ? 'Generating...' : 'Generate with AI' }}
            </button>
          </div>
        </div>

        <mat-divider style="margin: 8px 0 16px"></mat-divider>

        <h3 class="section-title">Line Items</h3>
        <div formArrayName="lineItems" class="line-items">
          @for (item of lineItems.controls; track $index) {
            <div [formGroupName]="$index" class="line-item-row">
              <mat-form-field appearance="outline" class="item-desc">
                <mat-label>Description</mat-label>
                <input matInput formControlName="description" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="item-qty">
                <mat-label>Qty</mat-label>
                <input matInput type="number" formControlName="qty" />
              </mat-form-field>
              <mat-form-field appearance="outline" class="item-price">
                <mat-label>Unit Price</mat-label>
                <input matInput type="number" formControlName="unitPrice" />
              </mat-form-field>
              <button mat-icon-button type="button" (click)="removeItem($index)" color="warn">
                <mat-icon>remove_circle_outline</mat-icon>
              </button>
            </div>
          }
        </div>
        <button mat-button type="button" (click)="addItem()">
          <mat-icon>add</mat-icon> Add Line Item
        </button>

        <div class="total-row">
          <strong>Total: {{ total() | currency }}</strong>
        </div>

        <mat-form-field appearance="outline" class="full-width" style="margin-top:12px">
          <mat-label>Internal Notes (optional)</mat-label>
          <textarea matInput rows="2" formControlName="notes"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form { display: flex; flex-direction: column; gap: 4px; width: 100%; padding-top: 8px; }
    .full-width { width: 100%; }
    .narrative-section { display: flex; flex-direction: column; gap: 4px; }
    .ai-section { display: flex; gap: 8px; align-items: flex-start; }
    .ai-section mat-form-field { flex: 1; }
    .ai-section button { margin-top: 4px; }
    .section-title { font-size: 14px; font-weight: 600; color: #555; margin: 0 0 8px; }
    .line-items { display: flex; flex-direction: column; gap: 4px; }
    .line-item-row { display: flex; gap: 8px; align-items: flex-start; }
    .item-desc { flex: 3; }
    .item-qty { flex: 1; }
    .item-price { flex: 1.5; }
    .total-row { text-align: right; padding: 4px 0; color: #2e7d32; font-size: 15px; }
  `],
})
export class ProposalDialogComponent implements OnInit {
  data = inject<any>(MAT_DIALOG_DATA)
  private dialogRef = inject(MatDialogRef<ProposalDialogComponent>)
  private api = inject(ApiService)
  private fb = inject(FormBuilder)

  clients: any[] = []
  aiLoading = signal(false)
  aiBrief = this.fb.control('')

  form = this.fb.group({
    clientId: ['', Validators.required],
    title: ['', Validators.required],
    narrative: [''],
    notes: [''],
    lineItems: this.fb.array([]),
  })

  get lineItems() { return this.form.get('lineItems') as FormArray }

  total = signal(0)

  private calcTotal() {
    return this.lineItems.controls.reduce((sum, ctrl) => {
      const v = ctrl.value
      return sum + (Number(v.qty) || 0) * (Number(v.unitPrice) || 0)
    }, 0)
  }

  ngOnInit() {
    this.lineItems.valueChanges.subscribe(() => this.total.set(this.calcTotal()))
    if (this.data?.id) {
      this.form.get('clientId')?.clearValidators()
      this.form.patchValue({ title: this.data.title, narrative: this.data.narrative ?? '', notes: this.data.notes ?? '' })
      ;(this.data.lineItems ?? []).forEach((item: any) => this.addItem(item))
    }
  }

  addItem(item?: any) {
    this.lineItems.push(this.fb.group({
      description: [item?.description ?? '', Validators.required],
      qty: [item?.qty ?? 1, [Validators.required, Validators.min(0)]],
      unitPrice: [item?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
    }))
  }

  removeItem(index: number) { this.lineItems.removeAt(index) }

  generateNarrative() {
    const brief = this.aiBrief.value?.trim()
    if (!brief) return
    const clientId = this.form.get('clientId')?.value || this.data?.clientId
    const clientName = this.clients.find((c) => c.id === clientId)?.name
    this.aiLoading.set(true)
    this.api.generateProposalNarrative(brief, clientName).subscribe({
      next: (res) => { this.form.patchValue({ narrative: res.narrative }); this.aiLoading.set(false) },
      error: () => this.aiLoading.set(false),
    })
  }

  submit() {
    if (this.form.invalid) return
    this.dialogRef.close(this.form.value)
  }
}

// ─── Proposals List Component ─────────────────────────────────────────────────
@Component({
  selector: 'app-proposals',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, MatCardModule, MatButtonModule, MatIconModule,
    MatTableModule, MatDialogModule, MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Proposals</h1>
        <button mat-flat-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon> New Proposal
        </button>
      </div>

      @if (loading()) {
        <div class="center-spinner"><mat-spinner diameter="40" /></div>
      } @else {
        <mat-card>
          <mat-card-content>
            <table mat-table [dataSource]="proposals()" class="full-width-table">
              <ng-container matColumnDef="client">
                <th mat-header-cell *matHeaderCellDef>Client</th>
                <td mat-cell *matCellDef="let p">{{ p.clientName }}</td>
              </ng-container>
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Title</th>
                <td mat-cell *matCellDef="let p"><strong>{{ p.title }}</strong></td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let p">
                  <span class="status-chip"
                    [style.background]="statusStyle(p.status).bg"
                    [style.color]="statusStyle(p.status).color">
                    {{ p.status | titlecase }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="total">
                <th mat-header-cell *matHeaderCellDef>Total</th>
                <td mat-cell *matCellDef="let p">{{ p.total | currency }}</td>
              </ng-container>
              <ng-container matColumnDef="created">
                <th mat-header-cell *matHeaderCellDef>Created</th>
                <td mat-cell *matCellDef="let p">{{ p.createdAt * 1000 | date:'MMM d, y' }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let p" class="actions-cell">
                  <button mat-icon-button (click)="viewProposal(p)" matTooltip="Preview"><mat-icon>visibility</mat-icon></button>
                  @if (p.status === 'draft') {
                    <button mat-icon-button (click)="openEdit(p)" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
                    <button mat-icon-button color="primary" (click)="send(p)" matTooltip="Send (generate link)"><mat-icon>send</mat-icon></button>
                  }
                  @if (p.status === 'sent') {
                    <button mat-icon-button (click)="copyLink(p)" matTooltip="Copy client link"><mat-icon>link</mat-icon></button>
                  }
                  @if (p.status !== 'accepted') {
                    <button mat-icon-button color="warn" (click)="delete(p)" matTooltip="Delete"><mat-icon>delete</mat-icon></button>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols;"></tr>
            </table>
            @if (proposals().length === 0) {
              <p class="empty-state">No proposals yet.</p>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>

    <!-- Preview overlay -->
    @if (previewProposal()) {
      <div class="overlay" (click)="previewProposal.set(null)">
        <div class="preview-panel" (click)="$event.stopPropagation()">
          <div class="preview-header">
            <div>
              <h2>{{ previewProposal()!.title }}</h2>
              <span class="status-chip"
                [style.background]="statusStyle(previewProposal()!.status).bg"
                [style.color]="statusStyle(previewProposal()!.status).color">
                {{ previewProposal()!.status | titlecase }}
              </span>
            </div>
            <button mat-icon-button (click)="previewProposal.set(null)"><mat-icon>close</mat-icon></button>
          </div>
          @if (previewProposal()!.narrative) {
            <p class="narrative-text">{{ previewProposal()!.narrative }}</p>
          }
          @if (previewProposal()!.lineItems?.length) {
            <table class="preview-table">
              <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
              <tbody>
                @for (item of previewProposal()!.lineItems; track item.id) {
                  <tr>
                    <td>{{ item.description }}</td>
                    <td>{{ item.qty }}</td>
                    <td>{{ item.unitPrice | currency }}</td>
                    <td>{{ item.qty * item.unitPrice | currency }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr><td colspan="3"><strong>Total</strong></td><td><strong>{{ previewProposal()!.total | currency }}</strong></td></tr>
              </tfoot>
            </table>
          }
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
    .actions-cell { white-space: nowrap; }
    .empty-state { color: #999; text-align: center; padding: 32px; }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .preview-panel { background: #fff; border-radius: 8px; width: 700px; max-width: 90vw; max-height: 80vh; overflow-y: auto; padding: 28px; }
    .preview-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; h2 { margin: 0 0 6px; } }
    .narrative-text { white-space: pre-wrap; line-height: 1.7; color: #333; margin-bottom: 24px; }
    .preview-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .preview-table th, .preview-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
    .preview-table thead tr { background: #f8f8f8; }
    .preview-table tfoot tr { background: #f0f7f0; }
    .preview-table th:last-child, .preview-table td:last-child { text-align: right; }
  `],
})
export class ProposalsComponent implements OnInit {
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)

  loading = signal(true)
  proposals = signal<any[]>([])
  clients = signal<any[]>([])
  previewProposal = signal<any | null>(null)
  cols = ['client', 'title', 'status', 'total', 'created', 'actions']

  ngOnInit() {
    this.api.getClients().subscribe((list) => this.clients.set(list))
    this.load()
  }

  load() {
    this.api.getProposals().subscribe({
      next: (list) => { this.proposals.set(list); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  statusStyle(status: string) { return STATUS_COLORS[status] ?? STATUS_COLORS['draft'] }

  viewProposal(p: any) { this.previewProposal.set(p) }

  openCreate() {
    const ref = this.dialog.open(ProposalDialogComponent, { width: '720px', maxWidth: '95vw', data: null })
    ref.componentInstance.clients = this.clients()
    ref.afterClosed().subscribe((result) => {
      if (!result) return
      this.api.createProposal(result).subscribe(() => {
        this.snack.open('Proposal created', 'OK', { duration: 2500 })
        this.load()
      })
    })
  }

  openEdit(p: any) {
    const ref = this.dialog.open(ProposalDialogComponent, { width: '720px', maxWidth: '95vw', data: p })
    ref.componentInstance.clients = this.clients()
    ref.afterClosed().subscribe((result) => {
      if (!result) return
      this.api.updateProposal(p.id, result).subscribe(() => {
        this.snack.open('Saved', 'OK', { duration: 2000 })
        this.load()
      })
    })
  }

  send(p: any) {
    this.api.sendProposal(p.id).subscribe((updated) => {
      this.snack.open('Proposal marked as sent', 'OK', { duration: 2500 })
      this.proposals.update((list) => list.map((item) => item.id === p.id ? { ...item, ...updated } : item))
      const link = `${window.location.origin}/proposal/${updated.viewToken}`
      navigator.clipboard?.writeText(link)
      this.snack.open('Client link copied to clipboard', 'OK', { duration: 3000 })
    })
  }

  copyLink(p: any) {
    const link = `${window.location.origin}/proposal/${p.viewToken}`
    navigator.clipboard?.writeText(link)
    this.snack.open('Link copied', 'OK', { duration: 2000 })
  }

  delete(p: any) {
    if (!confirm(`Delete "${p.title}"?`)) return
    this.api.deleteProposal(p.id).subscribe(() => {
      this.snack.open('Deleted', 'OK', { duration: 2000 })
      this.proposals.update((list) => list.filter((item) => item.id !== p.id))
    })
  }
}

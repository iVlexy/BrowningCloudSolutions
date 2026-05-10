import { Component, inject, signal, computed, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'
import { MatTableModule } from '@angular/material/table'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatChipsModule } from '@angular/material/chips'
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { MatMenuModule } from '@angular/material/menu'
import { MatTooltipModule } from '@angular/material/tooltip'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { MatDividerModule } from '@angular/material/divider'
import { ApiService } from '../../../core/services/api.service'
import type { Bug, BugStatus } from '../../../shared/models'

// ─── View Dialog ──────────────────────────────────────────────────────────────
@Component({
  selector: 'app-bug-view-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, MatChipsModule, MatDividerModule],
  template: `
    <h2 mat-dialog-title style="display:flex;align-items:center;gap:10px">
      <mat-icon style="color:#64748b">bug_report</mat-icon>
      {{ bug.title }}
    </h2>
    <mat-dialog-content class="view-content">
      <div class="meta-row">
        <mat-chip [ngClass]="'priority-' + bug.priority" class="chip">{{ bug.priority | titlecase }}</mat-chip>
        <mat-chip [ngClass]="'status-' + bug.status" class="chip">{{ statusLabel(bug.status) }}</mat-chip>
        <span class="source-label">
          <mat-icon class="source-icon">{{ sourceIcon(bug.source) }}</mat-icon>
          {{ bug.source | titlecase }}
        </span>
        <span class="date">{{ bug.createdAt * 1000 | date:'MMM d, y, h:mm a' }}</span>
      </div>

      <mat-divider style="margin: 12px 0" />

      <div class="section-label">Description</div>
      <div class="description-box">{{ bug.description }}</div>

      @if (bug.submitterName || bug.submitterEmail) {
        <mat-divider style="margin: 12px 0" />
        <div class="section-label">Submitter</div>
        <div class="submitter-info">
          @if (bug.submitterName) { <div>{{ bug.submitterName }}</div> }
          @if (bug.submitterEmail) { <div class="muted">{{ bug.submitterEmail }}</div> }
        </div>
      }

      @if (bug.notes) {
        <mat-divider style="margin: 12px 0" />
        <div class="section-label">Internal Notes</div>
        <div class="notes-box">{{ bug.notes }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
      <button mat-flat-button color="primary" [mat-dialog-close]="'edit'">
        <mat-icon>edit</mat-icon> Edit
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .view-content { min-width: 520px; padding-top: 4px; }
    .meta-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .chip { font-size: 11px !important; height: 22px !important; padding: 0 8px !important; }
    .source-label { display: flex; align-items: center; gap: 4px; color: #64748b; font-size: 13px; }
    .source-icon { font-size: 16px; width: 16px; height: 16px; }
    .date { margin-left: auto; color: #94a3b8; font-size: 12px; }
    .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 6px; }
    .description-box { white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #1e293b; background: #f8fafc; border-radius: 6px; padding: 12px; }
    .notes-box { white-space: pre-wrap; font-size: 13px; line-height: 1.5; color: #475569; background: #fffbeb; border-radius: 6px; padding: 10px; }
    .submitter-info { font-size: 14px; }
    .muted { color: #64748b; font-size: 13px; }
    .priority-low    { background: #dcfce7 !important; color: #166534 !important; }
    .priority-medium { background: #fef9c3 !important; color: #854d0e !important; }
    .priority-high   { background: #fed7aa !important; color: #9a3412 !important; }
    .priority-critical { background: #fee2e2 !important; color: #991b1b !important; }
    .status-open        { background: #dbeafe !important; color: #1e40af !important; }
    .status-in_progress { background: #ede9fe !important; color: #5b21b6 !important; }
    .status-resolved    { background: #dcfce7 !important; color: #166534 !important; }
    .status-closed      { background: #f1f5f9 !important; color: #475569 !important; }
    @media (max-width: 600px) { .view-content { min-width: unset; } }
  `],
})
export class BugViewDialogComponent {
  bug: Bug = inject(MAT_DIALOG_DATA)

  statusLabel(status: string): string {
    const labels: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' }
    return labels[status] ?? status
  }
  sourceIcon(source: string): string {
    const icons: Record<string, string> = { manual: 'edit_note', email: 'email', api: 'api' }
    return icons[source] ?? 'help'
  }
}

// ─── Create/Edit Dialog ───────────────────────────────────────────────────────
@Component({
  selector: 'app-bug-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatDialogModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit Bug' : 'New Bug Report' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="bug-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" placeholder="Short description of the bug" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="4"
                    placeholder="Steps to reproduce, expected vs actual behavior…"></textarea>
        </mat-form-field>

        <div class="row-fields">
          <mat-form-field appearance="outline">
            <mat-label>Priority</mat-label>
            <mat-select formControlName="priority">
              <mat-option value="low">Low</mat-option>
              <mat-option value="medium">Medium</mat-option>
              <mat-option value="high">High</mat-option>
              <mat-option value="critical">Critical</mat-option>
            </mat-select>
          </mat-form-field>

          @if (data) {
            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="open">Open</mat-option>
                <mat-option value="in_progress">In Progress</mat-option>
                <mat-option value="resolved">Resolved</mat-option>
                <mat-option value="closed">Closed</mat-option>
              </mat-select>
            </mat-form-field>
          }
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Submitter Name (optional)</mat-label>
          <input matInput formControlName="submitterName" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Submitter Email (optional)</mat-label>
          <input matInput formControlName="submitterEmail" type="email" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Internal Notes (optional)</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="submit()">
        {{ data ? 'Save Changes' : 'Create Bug' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .bug-form { display: flex; flex-direction: column; gap: 4px; min-width: 520px; padding-top: 8px; }
    .full-width { width: 100%; }
    .row-fields { display: flex; gap: 16px; }
    .row-fields mat-form-field { flex: 1; }
    @media (max-width: 600px) { .bug-form { min-width: unset; } }
  `],
})
export class BugDialogComponent implements OnInit {
  private fb = inject(FormBuilder)

  data: Bug | null = null  // injected by parent

  form = this.fb.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    priority: ['medium', Validators.required],
    status: ['open'],
    submitterName: [''],
    submitterEmail: [''],
    notes: [''],
  })

  ngOnInit() {
    if (this.data) {
      this.form.patchValue({
        title: this.data.title,
        description: this.data.description,
        priority: this.data.priority,
        status: this.data.status,
        submitterName: this.data.submitterName ?? '',
        submitterEmail: this.data.submitterEmail ?? '',
        notes: this.data.notes ?? '',
      })
    }
  }

  submit() {
    if (this.form.invalid) return
  }
}

// ─── Bugs List Component ──────────────────────────────────────────────────────
@Component({
  selector: 'app-bugs',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatDialogModule, MatMenuModule,
    MatTooltipModule, MatProgressSpinnerModule, MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Bug Reports</h1>
          <p class="subtitle">{{ bugs().length }} total &nbsp;·&nbsp; {{ openCount() }} open</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="load()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
          <button mat-flat-button color="primary" (click)="openCreate()">
            <mat-icon>add</mat-icon> New Bug
          </button>
        </div>
      </div>

      <!-- API endpoint callout -->
      <div class="callout">
        <mat-icon class="callout-icon">api</mat-icon>
        <div>
          <strong>Public API endpoint</strong> — anyone can submit a bug via:
          <code>POST {{ apiBase }}/api/bugs/report</code>
          with <code>&#123; title, description, priority?, submitterName?, submitterEmail? &#125;</code>
        </div>
      </div>

      <!-- Email callout -->
      <div class="callout callout-email">
        <mat-icon class="callout-icon">email</mat-icon>
        <div>
          <strong>Email submission</strong> — send bug reports to
          <strong>bugs&#64;browningcloud.com</strong>. Configure SendGrid Inbound Parse to
          POST to <code>{{ apiBase }}/api/bugs/inbound-email</code>.
        </div>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="40" /></div>
      } @else {
        <div class="table-container">
          <table mat-table [dataSource]="bugs()" class="bugs-table">

            <ng-container matColumnDef="priority">
              <th mat-header-cell *matHeaderCellDef>Priority</th>
              <td mat-cell *matCellDef="let bug">
                <mat-chip [ngClass]="'priority-' + bug.priority" class="priority-chip">
                  {{ bug.priority | titlecase }}
                </mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Title</th>
              <td mat-cell *matCellDef="let bug">
                <div class="bug-title">{{ bug.title }}</div>
                <div class="bug-desc">{{ bug.description | slice:0:120 }}{{ bug.description.length > 120 ? '…' : '' }}</div>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let bug">
                <mat-chip [ngClass]="'status-' + bug.status" class="status-chip">
                  {{ statusLabel(bug.status) }}
                </mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="source">
              <th mat-header-cell *matHeaderCellDef>Source</th>
              <td mat-cell *matCellDef="let bug">
                <mat-icon [matTooltip]="bug.source | titlecase" class="source-icon">
                  {{ sourceIcon(bug.source) }}
                </mat-icon>
              </td>
            </ng-container>

            <ng-container matColumnDef="submitter">
              <th mat-header-cell *matHeaderCellDef>Submitter</th>
              <td mat-cell *matCellDef="let bug">
                @if (bug.submitterName || bug.submitterEmail) {
                  <div class="submitter-name">{{ bug.submitterName }}</div>
                  <div class="submitter-email">{{ bug.submitterEmail }}</div>
                } @else {
                  <span class="muted">—</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef>Reported</th>
              <td mat-cell *matCellDef="let bug" class="date-cell">
                {{ bug.createdAt * 1000 | date:'MMM d, y' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let bug" (click)="$event.stopPropagation()">
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu>
                  <button mat-menu-item (click)="openEdit(bug)">
                    <mat-icon>edit</mat-icon> Edit
                  </button>
                  <button mat-menu-item (click)="setStatus(bug, 'in_progress')" [disabled]="bug.status === 'in_progress'">
                    <mat-icon>pending</mat-icon> Mark In Progress
                  </button>
                  <button mat-menu-item (click)="setStatus(bug, 'resolved')" [disabled]="bug.status === 'resolved'">
                    <mat-icon>check_circle</mat-icon> Mark Resolved
                  </button>
                  <button mat-menu-item (click)="setStatus(bug, 'closed')" [disabled]="bug.status === 'closed'">
                    <mat-icon>cancel</mat-icon> Close
                  </button>
                  <button mat-menu-item class="delete-item" (click)="deleteBug(bug)">
                    <mat-icon>delete</mat-icon> Delete
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;" class="clickable-row" (click)="openView(row)"></tr>

            <tr class="mat-row" *matNoDataRow>
              <td [colSpan]="columns.length" class="no-data">No bug reports yet.</td>
            </tr>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 1200px; margin: 0 auto; }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      flex-wrap: wrap; gap: 12px; margin-bottom: 20px;
    }
    h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .subtitle { margin: 4px 0 0; color: #64748b; font-size: 14px; }
    .header-actions { display: flex; gap: 8px; }

    .callout {
      display: flex; align-items: flex-start; gap: 12px;
      background: #e8f4fd; border-left: 4px solid #1976d2;
      border-radius: 4px; padding: 12px 16px; margin-bottom: 12px;
      font-size: 13px; line-height: 1.5;
    }
    .callout-email { background: #f0fdf4; border-left-color: #16a34a; }
    .callout-icon { color: #1976d2; flex-shrink: 0; margin-top: 2px; }
    .callout-email .callout-icon { color: #16a34a; }
    code { background: rgba(0,0,0,0.07); padding: 1px 5px; border-radius: 3px; font-size: 12px; }

    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
    .table-container { border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1); margin-top: 8px; }

    .bugs-table { width: 100%; }
    table { background: #fff; }

    .bug-title { font-weight: 500; font-size: 14px; }
    .bug-desc { font-size: 12px; color: #64748b; margin-top: 2px; }

    .priority-chip, .status-chip { font-size: 11px !important; height: 22px !important; padding: 0 8px !important; }

    .priority-low    { background: #dcfce7 !important; color: #166534 !important; }
    .priority-medium { background: #fef9c3 !important; color: #854d0e !important; }
    .priority-high   { background: #fed7aa !important; color: #9a3412 !important; }
    .priority-critical { background: #fee2e2 !important; color: #991b1b !important; }

    .status-open        { background: #dbeafe !important; color: #1e40af !important; }
    .status-in_progress { background: #ede9fe !important; color: #5b21b6 !important; }
    .status-resolved    { background: #dcfce7 !important; color: #166534 !important; }
    .status-closed      { background: #f1f5f9 !important; color: #475569 !important; }

    .source-icon { font-size: 20px; color: #94a3b8; vertical-align: middle; }
    .submitter-name { font-size: 13px; font-weight: 500; }
    .submitter-email { font-size: 12px; color: #64748b; }
    .muted { color: #cbd5e1; }
    .date-cell { white-space: nowrap; font-size: 13px; color: #64748b; }
    .no-data { text-align: center; padding: 48px; color: #94a3b8; }
    .delete-item { color: #dc2626; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: #f1f5f9; }
  `],
})
export class BugsComponent implements OnInit {
  private api = inject(ApiService)
  private dialog = inject(MatDialog)
  private snack = inject(MatSnackBar)

  readonly apiBase = 'https://bcs-api.browningethan23.workers.dev'

  bugs = signal<Bug[]>([])
  loading = signal(false)

  openCount = computed(() => this.bugs().filter(b => b.status === 'open').length)

  columns = ['priority', 'title', 'status', 'source', 'submitter', 'date', 'actions']

  ngOnInit() {
    this.load()
  }

  load() {
    this.loading.set(true)
    this.api.getBugs().subscribe({
      next: (data) => { this.bugs.set(data); this.loading.set(false) },
      error: () => { this.snack.open('Failed to load bugs', 'Dismiss', { duration: 3000 }); this.loading.set(false) },
    })
  }

  openView(bug: Bug) {
    const ref = this.dialog.open(BugViewDialogComponent, {
      width: '580px',
      maxWidth: '95vw',
      data: bug,
    })
    ref.afterClosed().subscribe((result) => {
      if (result === 'edit') this.openEdit(bug)
    })
  }

  openCreate() {
    const ref = this.dialog.open(BugDialogComponent, { width: '560px', maxWidth: '95vw' })
    ref.componentInstance.data = null
    ref.componentInstance.submit = () => {
      if (ref.componentInstance.form.invalid) return
      ref.close(ref.componentInstance.form.value)
    }
    ref.afterClosed().subscribe((result) => {
      if (!result) return
      this.api.createBug(result).subscribe({
        next: (bug) => { this.bugs.update(list => [bug, ...list]); this.snack.open('Bug created', 'OK', { duration: 2500 }) },
        error: () => this.snack.open('Failed to create bug', 'Dismiss', { duration: 3000 }),
      })
    })
  }

  openEdit(bug: Bug) {
    const ref = this.dialog.open(BugDialogComponent, { width: '560px', maxWidth: '95vw' })
    ref.componentInstance.data = bug
    // Wait a tick for ngOnInit to run
    setTimeout(() => {
      ref.componentInstance.submit = () => {
        if (ref.componentInstance.form.invalid) return
        ref.close(ref.componentInstance.form.value)
      }
    })
    ref.afterClosed().subscribe((result) => {
      if (!result) return
      this.api.updateBug(bug.id, result).subscribe({
        next: (updated) => {
          this.bugs.update(list => list.map(b => b.id === bug.id ? updated : b))
          this.snack.open('Bug updated', 'OK', { duration: 2500 })
        },
        error: () => this.snack.open('Failed to update bug', 'Dismiss', { duration: 3000 }),
      })
    })
  }

  setStatus(bug: Bug, status: BugStatus) {
    this.api.updateBug(bug.id, { status }).subscribe({
      next: (updated) => {
        this.bugs.update(list => list.map(b => b.id === bug.id ? updated : b))
        this.snack.open(`Marked ${this.statusLabel(status)}`, 'OK', { duration: 2000 })
      },
      error: () => this.snack.open('Failed to update status', 'Dismiss', { duration: 3000 }),
    })
  }

  deleteBug(bug: Bug) {
    if (!confirm(`Delete bug "${bug.title}"?`)) return
    this.api.deleteBug(bug.id).subscribe({
      next: () => {
        this.bugs.update(list => list.filter(b => b.id !== bug.id))
        this.snack.open('Bug deleted', 'OK', { duration: 2500 })
      },
      error: () => this.snack.open('Failed to delete bug', 'Dismiss', { duration: 3000 }),
    })
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
    }
    return labels[status] ?? status
  }

  sourceIcon(source: string): string {
    const icons: Record<string, string> = { manual: 'edit_note', email: 'email', api: 'api' }
    return icons[source] ?? 'help'
  }
}

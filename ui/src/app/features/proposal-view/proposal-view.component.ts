import { Component, inject, OnInit, signal } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common'
import { MatButtonModule } from '@angular/material/button'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatIconModule } from '@angular/material/icon'
import { ApiService } from '../../core/services/api.service'

@Component({
  selector: 'app-proposal-view',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, MatButtonModule, MatProgressSpinnerModule, MatIconModule],
  template: `
    <div class="proposal-page">
      <div class="proposal-header-bar">
        <mat-icon class="brand-icon">cloud</mat-icon>
        <span class="brand-name">Browning Cloud Solutions</span>
      </div>

      @if (loading()) {
        <div class="center-spinner"><mat-spinner diameter="48" /></div>
      } @else if (error()) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <h2>Proposal not found</h2>
          <p>This link may have expired or already been responded to.</p>
        </div>
      } @else if (proposal()) {
        <div class="proposal-card">
          <!-- Status banner -->
          @if (proposal()!.status === 'accepted') {
            <div class="status-banner accepted">
              <mat-icon>check_circle</mat-icon> You accepted this proposal
            </div>
          }
          @if (proposal()!.status === 'declined') {
            <div class="status-banner declined">
              <mat-icon>cancel</mat-icon> You declined this proposal
            </div>
          }

          <h1 class="proposal-title">{{ proposal()!.title }}</h1>
          <p class="proposal-meta">
            Prepared for <strong>{{ proposal()!.clientName }}</strong> &middot;
            {{ proposal()!.createdAt * 1000 | date:'MMMM d, y' }}
          </p>

          @if (proposal()!.narrative) {
            <div class="narrative-section">
              <h2 class="section-heading">Overview</h2>
              <p class="narrative-text">{{ proposal()!.narrative }}</p>
            </div>
          }

          @if (proposal()!.lineItems?.length) {
            <div class="scope-section">
              <h2 class="section-heading">Scope &amp; Pricing</h2>
              <table class="scope-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of proposal()!.lineItems; track item.id) {
                    <tr>
                      <td>{{ item.description }}</td>
                      <td>{{ item.qty }}</td>
                      <td>{{ item.unitPrice | currency }}</td>
                      <td>{{ item.qty * item.unitPrice | currency }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="total-row">
                    <td colspan="3">Total</td>
                    <td>{{ proposalTotal() | currency }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }

          @if (proposal()!.notes) {
            <div class="notes-section">
              <h2 class="section-heading">Additional Notes</h2>
              <p class="notes-text">{{ proposal()!.notes }}</p>
            </div>
          }

          @if (proposal()!.status === 'sent') {
            <div class="action-section">
              <p class="action-prompt">Please review this proposal and let us know if you'd like to proceed.</p>
              <div class="action-buttons">
                <button mat-flat-button color="primary" [disabled]="responding()" (click)="respond('accepted')">
                  <mat-icon>check</mat-icon> Accept Proposal
                </button>
                <button mat-stroked-button [disabled]="responding()" (click)="respond('declined')">
                  <mat-icon>close</mat-icon> Decline
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .proposal-page {
      min-height: 100vh;
      background: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .proposal-header-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 32px;
      background: #1a2332;
      color: #fff;
      mat-icon { color: #64b5f6; font-size: 28px; width: 28px; height: 28px; }
      .brand-name { font-size: 18px; font-weight: 700; }
    }

    .center-spinner { display: flex; justify-content: center; padding: 80px; }

    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 80px 24px;
      color: #555;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #bbb; margin-bottom: 12px; }
      h2 { margin: 0 0 8px; }
      p { margin: 0; color: #888; }
    }

    .proposal-card {
      max-width: 760px;
      margin: 40px auto;
      padding: 40px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.08);
    }

    .status-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 600;
      &.accepted { background: #e8f5e9; color: #2e7d32; }
      &.declined { background: #ffebee; color: #c62828; }
    }

    .proposal-title { font-size: 28px; font-weight: 700; color: #1a2332; margin: 0 0 8px; }
    .proposal-meta { color: #777; font-size: 14px; margin-bottom: 32px; }

    .section-heading {
      font-size: 16px;
      font-weight: 600;
      color: #1a2332;
      margin: 0 0 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e3f2fd;
    }

    .narrative-section, .scope-section, .notes-section {
      margin-bottom: 32px;
    }

    .narrative-text {
      white-space: pre-wrap;
      line-height: 1.8;
      color: #444;
      font-size: 15px;
      margin: 0;
    }

    .notes-text { color: #555; font-size: 14px; line-height: 1.6; margin: 0; }

    .scope-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; }
      thead tr { background: #f8fafc; }
      th:last-child, td:last-child { text-align: right; }
      .total-row td { font-weight: 700; background: #f0f7f0; color: #2e7d32; }
    }

    .action-section {
      border-top: 1px solid #eee;
      padding-top: 28px;
      margin-top: 8px;
    }
    .action-prompt { color: #555; margin-bottom: 20px; font-size: 15px; }
    .action-buttons { display: flex; gap: 12px; }

    @media (max-width: 640px) {
      .proposal-card { margin: 20px 12px; padding: 24px 20px; }
    }
  `],
})
export class ProposalViewComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private api = inject(ApiService)

  loading = signal(true)
  error = signal(false)
  responding = signal(false)
  proposal = signal<any | null>(null)

  proposalTotal() {
    return (this.proposal()?.lineItems ?? []).reduce(
      (sum: number, i: any) => sum + i.qty * i.unitPrice, 0
    )
  }

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token')!
    this.api.getProposalByToken(token).subscribe({
      next: (data) => { this.proposal.set(data); this.loading.set(false) },
      error: () => { this.error.set(true); this.loading.set(false) },
    })
  }

  respond(decision: 'accepted' | 'declined') {
    const token = this.route.snapshot.paramMap.get('token')!
    this.responding.set(true)
    this.api.respondToProposal(token, decision).subscribe({
      next: () => {
        this.proposal.update((p) => ({ ...p, status: decision }))
        this.responding.set(false)
      },
      error: () => this.responding.set(false),
    })
  }
}

import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule, DatePipe } from '@angular/common'
import { ActivatedRoute } from '@angular/router'
import { MatCardModule } from '@angular/material/card'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { MatDividerModule } from '@angular/material/divider'
import { ApiService } from '../../../core/services/api.service'

declare const Plaid: any

const REDIRECT_URI = 'https://browningcloud.com/admin/bank'
const LINK_TOKEN_KEY = 'plaid_link_token'

@Component({
  selector: 'app-bank',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatDividerModule,
  ],
  template: `
    <div class="page-container">
      <h2 class="page-title">Bank Connection</h2>
      <p class="page-subtitle">
        Connect your Bank OZK business checking account to automatically import transactions as expenses.
        New transactions are synced daily at 9 AM.
      </p>

      @if (loading()) {
        <div class="center-spin"><mat-spinner diameter="40" /></div>
      } @else if (status()?.connected) {
        <mat-card class="connected-card">
          <mat-card-content>
            <div class="status-row">
              <mat-icon class="connected-icon">account_balance</mat-icon>
              <div class="status-info">
                <div class="institution-name">{{ status()?.institution }}</div>
                <div class="connected-since">
                  Connected {{ status()?.connectedAt | date:'mediumDate' }}
                </div>
              </div>
              <span class="connected-badge">Connected</span>
            </div>

            <mat-divider style="margin: 20px 0" />

            <div class="action-row">
              <button mat-raised-button color="primary" (click)="syncNow()" [disabled]="syncing()">
                <mat-icon>sync</mat-icon>
                {{ syncing() ? 'Syncing…' : 'Sync Now' }}
              </button>
              @if (lastImport() !== null) {
                <span class="sync-result">
                  ✓ {{ lastImport() }} transaction{{ lastImport() === 1 ? '' : 's' }} imported
                </span>
              }
              <button mat-stroked-button color="warn" class="disconnect-btn" (click)="disconnect()" [disabled]="syncing()">
                Disconnect
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card class="connect-card">
          <mat-card-content>
            <div class="not-connected">
              <mat-icon class="bank-icon">account_balance</mat-icon>
              <p>No bank account connected.</p>
              <button mat-raised-button color="primary" (click)="connectBank()" [disabled]="connecting()">
                <mat-icon>link</mat-icon>
                {{ connecting() ? 'Opening…' : 'Connect Bank Account' }}
              </button>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .page-container { max-width: 640px; margin: 32px auto; padding: 0 16px; }
    .page-title { font-size: 24px; font-weight: 600; margin: 0 0 8px; }
    .page-subtitle { color: #666; margin: 0 0 24px; line-height: 1.5; }
    .center-spin { display: flex; justify-content: center; padding: 60px 0; }

    .connected-card, .connect-card { border-radius: 12px; }

    .status-row { display: flex; align-items: center; gap: 16px; }
    .connected-icon { font-size: 40px; width: 40px; height: 40px; color: #1565C0; }
    .status-info { flex: 1; }
    .institution-name { font-size: 18px; font-weight: 600; }
    .connected-since { font-size: 13px; color: #888; margin-top: 2px; }
    .connected-badge {
      background: #e8f5e9; color: #2e7d32; padding: 4px 12px;
      border-radius: 12px; font-size: 12px; font-weight: 600;
    }

    .action-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .sync-result { color: #2e7d32; font-size: 14px; }
    .disconnect-btn { margin-left: auto; }

    .not-connected {
      display: flex; flex-direction: column; align-items: center;
      gap: 16px; padding: 24px 0; color: #888;
    }
    .bank-icon { font-size: 56px; width: 56px; height: 56px; color: #bbb; }
  `],
})
export class BankComponent implements OnInit {
  private api = inject(ApiService)
  private snack = inject(MatSnackBar)
  private route = inject(ActivatedRoute)

  status = signal<{ connected: boolean; institution: string | null; connectedAt: number | null } | null>(null)
  loading = signal(true)
  connecting = signal(false)
  syncing = signal(false)
  lastImport = signal<number | null>(null)

  ngOnInit() {
    this.loadStatus()

    // Handle OAuth redirect back from bank (e.g. Bank OZK)
    const params = this.route.snapshot.queryParamMap
    if (params.has('oauth_state_id')) {
      const storedToken = sessionStorage.getItem(LINK_TOKEN_KEY)
      if (storedToken) {
        this.connecting.set(true)
        this.loadPlaidScript().then(() => {
          const handler = Plaid.create({
            token: storedToken,
            receivedRedirectUri: window.location.href,
            onSuccess: (publicToken: string, metadata: any) => {
              sessionStorage.removeItem(LINK_TOKEN_KEY)
              const institutionName = metadata?.institution?.name ?? 'Bank OZK'
              this.api.connectBank(publicToken, institutionName).subscribe({
                next: () => {
                  this.connecting.set(false)
                  this.snack.open(`${institutionName} connected!`, 'Close', { duration: 3000 })
                  this.loadStatus()
                },
                error: () => {
                  this.connecting.set(false)
                  this.snack.open('Connection failed', 'Close', { duration: 4000 })
                },
              })
            },
            onExit: () => {
              sessionStorage.removeItem(LINK_TOKEN_KEY)
              this.connecting.set(false)
            },
          })
          handler.open()
        })
      }
    }
  }

  loadStatus() {
    this.loading.set(true)
    this.api.getBankStatus().subscribe({
      next: (s) => { this.status.set(s); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  async connectBank() {
    this.connecting.set(true)
    this.api.getBankLinkToken(REDIRECT_URI).subscribe({
      next: async ({ linkToken }) => {
        // Store token so we can resume after OAuth redirect
        sessionStorage.setItem(LINK_TOKEN_KEY, linkToken)
        await this.loadPlaidScript()
        const handler = Plaid.create({
          token: linkToken,
          onSuccess: (publicToken: string, metadata: any) => {
            sessionStorage.removeItem(LINK_TOKEN_KEY)
            const institutionName = metadata?.institution?.name ?? 'Bank OZK'
            this.api.connectBank(publicToken, institutionName).subscribe({
              next: () => {
                this.connecting.set(false)
                this.snack.open(`${institutionName} connected!`, 'Close', { duration: 3000 })
                this.loadStatus()
              },
              error: () => {
                this.connecting.set(false)
                this.snack.open('Connection failed', 'Close', { duration: 4000 })
              },
            })
          },
          onExit: () => {
            sessionStorage.removeItem(LINK_TOKEN_KEY)
            this.connecting.set(false)
          },
        })
        handler.open()
      },
      error: () => {
        this.connecting.set(false)
        this.snack.open('Failed to start bank connection', 'Close', { duration: 4000 })
      },
    })
  }

  syncNow() {
    this.syncing.set(true)
    this.lastImport.set(null)
    this.api.syncBank().subscribe({
      next: (res) => {
        this.syncing.set(false)
        this.lastImport.set(res.imported)
        this.snack.open(`Sync complete — ${res.imported} transaction${res.imported === 1 ? '' : 's'} imported`, 'Close', { duration: 4000 })
      },
      error: () => {
        this.syncing.set(false)
        this.snack.open('Sync failed', 'Close', { duration: 4000 })
      },
    })
  }

  disconnect() {
    if (!confirm('Disconnect your bank account? Existing imported expenses will remain.')) return
    this.api.disconnectBank().subscribe({
      next: () => {
        this.snack.open('Bank disconnected', 'Close', { duration: 3000 })
        this.loadStatus()
      },
    })
  }

  private loadPlaidScript(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof Plaid !== 'undefined') { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
      script.onload = () => resolve()
      document.head.appendChild(script)
    })
  }
}

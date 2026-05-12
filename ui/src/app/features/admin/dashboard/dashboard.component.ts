import { Component, inject, OnInit, signal } from '@angular/core'
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common'
import { RouterLink } from '@angular/router'
import { MatCardModule } from '@angular/material/card'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'
import { ApiService } from '../../../core/services/api.service'

interface DashboardData {
  ytdRevenue: number
  outstandingBalance: number
  overdueCount: number
  monthlyRevenue: { month: string; total: number }[]
  recentPayments: {
    id: string; amount: number; method: string; paidAt: number
    invoiceNumber: string; clientName: string
  }[]
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, CurrencyPipe, DatePipe],
  template: `
    <div class="page-container">
      <h1 class="page-title">Dashboard</h1>

      @if (loading()) {
        <div class="center-spinner"><mat-spinner diameter="48" /></div>
      } @else if (data()) {
        <!-- KPI Cards -->
        <div class="kpi-row">
          <mat-card class="kpi-card kpi-green">
            <mat-card-content>
              <div class="kpi-label">YTD Revenue</div>
              <div class="kpi-value">{{ data()!.ytdRevenue | currency }}</div>
              <mat-icon class="kpi-icon">trending_up</mat-icon>
            </mat-card-content>
          </mat-card>

          <mat-card class="kpi-card kpi-blue">
            <mat-card-content>
              <div class="kpi-label">Outstanding Balance</div>
              <div class="kpi-value">{{ data()!.outstandingBalance | currency }}</div>
              <mat-icon class="kpi-icon">account_balance_wallet</mat-icon>
            </mat-card-content>
          </mat-card>

          <mat-card class="kpi-card" [class.kpi-red]="data()!.overdueCount > 0" [class.kpi-gray]="data()!.overdueCount === 0">
            <mat-card-content>
              <div class="kpi-label">Overdue Invoices</div>
              <div class="kpi-value">{{ data()!.overdueCount }}</div>
              <mat-icon class="kpi-icon">warning</mat-icon>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Revenue Chart -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>Monthly Revenue (Last 12 Months)</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="bar-chart">
              @for (item of data()!.monthlyRevenue; track item.month) {
                <div class="bar-col">
                  <div class="bar-amount">{{ item.total | currency:'USD':'symbol':'1.0-0' }}</div>
                  <div class="bar-wrap">
                    <div class="bar-fill" [style.height.%]="barHeight(item.total)"></div>
                  </div>
                  <div class="bar-label">{{ formatMonth(item.month) }}</div>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Recent Payments -->
        <mat-card class="recent-card">
          <mat-card-header>
            <mat-card-title>Recent Payments</mat-card-title>
            <div class="card-header-action">
              <a mat-button color="primary" routerLink="/admin/payments">View All</a>
            </div>
          </mat-card-header>
          <mat-card-content>
            @if (data()!.recentPayments.length === 0) {
              <p class="empty-state">No payments recorded yet.</p>
            } @else {
              <div class="payments-list">
                @for (p of data()!.recentPayments; track p.id) {
                  <div class="payment-row">
                    <div class="payment-info">
                      <span class="payment-client">{{ p.clientName }}</span>
                      <span class="payment-invoice">{{ p.invoiceNumber }}</span>
                    </div>
                    <div class="payment-right">
                      <span class="payment-method">{{ p.method }}</span>
                      <span class="payment-amount">{{ p.amount | currency }}</span>
                      <span class="payment-date">{{ p.paidAt * 1000 | date:'MMM d' }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-title { font-size: 24px; font-weight: 600; margin: 0 0 24px; color: #1a2332; }
    .center-spinner { display: flex; justify-content: center; padding: 80px; }

    .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    @media (max-width: 768px) { .kpi-row { grid-template-columns: 1fr; } }

    .kpi-card { position: relative; overflow: hidden; }
    .kpi-card mat-card-content { padding: 20px 24px !important; }
    .kpi-label { font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .kpi-value { font-size: 32px; font-weight: 700; }
    .kpi-icon { position: absolute; right: 20px; top: 50%; transform: translateY(-50%); font-size: 48px; width: 48px; height: 48px; opacity: 0.15; }

    .kpi-green { background: #e8f5e9; .kpi-label { color: #2e7d32; } .kpi-value { color: #1b5e20; } }
    .kpi-blue  { background: #e3f2fd; .kpi-label { color: #1565c0; } .kpi-value { color: #0d47a1; } }
    .kpi-red   { background: #ffebee; .kpi-label { color: #c62828; } .kpi-value { color: #b71c1c; } }
    .kpi-gray  { background: #f5f5f5; .kpi-label { color: #616161; } .kpi-value { color: #424242; } }

    .chart-card { margin-bottom: 24px; }
    .bar-chart {
      display: flex; align-items: flex-end; gap: 8px;
      height: 180px; padding: 16px 0 0;
      overflow-x: auto;
    }
    .bar-col { display: flex; flex-direction: column; align-items: center; flex: 1; min-width: 44px; }
    .bar-amount { font-size: 10px; color: #666; margin-bottom: 4px; white-space: nowrap; }
    .bar-wrap { width: 100%; height: 120px; display: flex; align-items: flex-end; }
    .bar-fill { width: 100%; background: #1565c0; border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.3s; }
    .bar-label { font-size: 10px; color: #888; margin-top: 4px; white-space: nowrap; }

    .recent-card { margin-bottom: 24px; }
    mat-card-header { display: flex; align-items: center; justify-content: space-between; }
    .card-header-action { margin-left: auto; }

    .payments-list { display: flex; flex-direction: column; gap: 0; }
    .payment-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 0; border-bottom: 1px solid #f0f0f0;
      &:last-child { border-bottom: none; }
    }
    .payment-info { display: flex; flex-direction: column; gap: 2px; }
    .payment-client { font-weight: 600; font-size: 14px; color: #1a2332; }
    .payment-invoice { font-size: 12px; color: #888; }
    .payment-right { display: flex; align-items: center; gap: 12px; }
    .payment-method { font-size: 12px; background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 10px; text-transform: capitalize; }
    .payment-amount { font-weight: 700; color: #2e7d32; }
    .payment-date { font-size: 12px; color: #888; }
    .empty-state { color: #999; padding: 16px 0; text-align: center; }
  `],
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService)

  loading = signal(true)
  data = signal<DashboardData | null>(null)

  ngOnInit() {
    this.api.getDashboard().subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  get maxRevenue(): number {
    return Math.max(...(this.data()?.monthlyRevenue.map((m) => m.total) ?? [1]), 1)
  }

  barHeight(total: number): number {
    return Math.max((total / this.maxRevenue) * 100, total > 0 ? 3 : 0)
  }

  formatMonth(ym: string): string {
    const [y, m] = ym.split('-')
    return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
}

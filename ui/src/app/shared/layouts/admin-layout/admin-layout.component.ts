import { Component, inject, viewChild, signal, OnInit } from '@angular/core'
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router'
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatListModule } from '@angular/material/list'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { MatBadgeModule } from '@angular/material/badge'
import { BreakpointObserver } from '@angular/cdk/layout'
import { toSignal } from '@angular/core/rxjs-interop'
import { map } from 'rxjs'
import { CommonModule, DatePipe } from '@angular/common'
import { AuthService } from '../../../core/services/auth.service'
import { NotificationsService } from '../../../core/services/notifications.service'

interface NavItem {
  label: string
  icon: string
  route: string
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe,
    MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatBadgeModule,
  ],
  template: `
    <mat-sidenav-container class="admin-container">
      <!-- Sidebar -->
      <mat-sidenav #sidenav
                   [mode]="isMobile() ? 'over' : 'side'"
                   [opened]="!isMobile()"
                   class="admin-sidenav">
        <div class="sidenav-header">
          <mat-icon class="brand-icon">cloud</mat-icon>
          <div class="brand-info">
            <div class="brand-name">BCS Admin</div>
            <div class="user-email">{{ auth.user()?.email }}</div>
          </div>
          <button mat-icon-button class="bell-btn" (click)="toggleNotifPanel()">
            <mat-icon
              [matBadge]="notifService.unreadCount() || null"
              matBadgeColor="warn"
              matBadgeSize="small">
              notifications
            </mat-icon>
          </button>
        </div>

        <mat-nav-list class="nav-list">
          @for (item of navItems; track item.route) {
            <a mat-list-item
               [routerLink]="['/admin', item.route]"
               routerLinkActive="active-nav-item"
               class="nav-item"
               (click)="closeOnMobile()">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>

        <div class="sidenav-footer">
          <a mat-list-item routerLink="/" class="nav-item" (click)="closeOnMobile()">
            <mat-icon matListItemIcon>open_in_new</mat-icon>
            <span matListItemTitle>View Site</span>
          </a>
        </div>
      </mat-sidenav>

      <!-- Content area -->
      <mat-sidenav-content class="admin-content">
        @if (isMobile()) {
          <div class="mobile-toolbar">
            <button mat-icon-button class="menu-btn" (click)="sidenavRef().toggle()">
              <mat-icon>menu</mat-icon>
            </button>
            <mat-icon class="mobile-brand-icon">cloud</mat-icon>
            <span class="mobile-brand-name">BCS Admin</span>
          </div>
        }
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>

    <!-- Notification panel overlay -->
    @if (showNotifPanel()) {
      <div class="notif-backdrop" (click)="showNotifPanel.set(false)"></div>
      <div class="notif-panel">
        <div class="notif-panel-header">
          <span>Notifications</span>
          <button mat-button class="mark-all-btn" (click)="notifService.markAllRead()">Mark all read</button>
          <button mat-icon-button (click)="showNotifPanel.set(false)"><mat-icon>close</mat-icon></button>
        </div>
        @if (notifService.notifications().length === 0) {
          <p class="notif-empty">No notifications</p>
        }
        @for (n of notifService.notifications(); track n.id) {
          <div class="notif-item" [class.unread]="!n.isRead" (click)="openNotif(n)">
            <mat-icon class="notif-icon" [style.color]="notifIconColor(n.type)">{{ notifIcon(n.type) }}</mat-icon>
            <div class="notif-body">
              <div class="notif-message">{{ n.message }}</div>
              <div class="notif-time">{{ n.createdAt * 1000 | date:'MMM d, h:mm a' }}</div>
            </div>
            <button mat-icon-button class="notif-delete" (click)="$event.stopPropagation(); notifService.delete(n.id)">
              <mat-icon style="font-size:16px">close</mat-icon>
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .admin-container { height: 100vh; }

    .admin-sidenav {
      width: 240px;
      background: #1a2332;
      display: flex;
      flex-direction: column;
    }

    .sidenav-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);

      .brand-icon { color: #64b5f6; font-size: 32px; width: 32px; height: 32px; }
      .brand-info { flex: 1; min-width: 0; }
      .brand-name { font-size: 16px; font-weight: 700; color: #fff; }
      .user-email {
        font-size: 11px; color: #90caf9;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;
      }
      .bell-btn { color: rgba(255,255,255,0.75); flex-shrink: 0; }
    }

    .nav-list { flex: 1; padding-top: 8px; }

    .nav-item {
      color: rgba(255,255,255,0.75) !important;
      border-radius: 0 24px 24px 0 !important;
      margin-right: 12px !important;
      margin-bottom: 2px !important;
      mat-icon { color: rgba(255,255,255,0.6) !important; }
      ::ng-deep .mdc-list-item__primary-text { color: rgba(255,255,255,0.75) !important; }
    }

    .nav-item:hover {
      background: rgba(255,255,255,0.08) !important;
      color: #fff !important;
    }

    :host ::ng-deep .active-nav-item {
      background: rgba(100,181,246,0.2) !important;
      color: #90caf9 !important;
      mat-icon { color: #90caf9 !important; }
      .mdc-list-item__primary-text { color: #90caf9 !important; }
    }

    .sidenav-footer { border-top: 1px solid rgba(255,255,255,0.1); padding: 8px 0; }

    .admin-content { background: #f8fafc; }

    .mobile-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px 8px 4px;
      background: #1a2332;
      position: sticky;
      top: 0;
      z-index: 100;

      .menu-btn { color: #fff; }
      .mobile-brand-icon { color: #64b5f6; font-size: 24px; width: 24px; height: 24px; }
      .mobile-brand-name { font-size: 16px; font-weight: 700; color: #fff; }
    }

    .notif-backdrop {
      position: fixed; inset: 0; z-index: 200;
    }

    .notif-panel {
      position: fixed;
      top: 0; right: 0;
      width: 360px; max-width: 95vw;
      height: 100vh;
      background: #fff;
      box-shadow: -4px 0 20px rgba(0,0,0,0.15);
      z-index: 201;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .notif-panel-header {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid #eee;
      font-weight: 600;
      font-size: 15px;
      background: #1a2332;
      color: #fff;
      gap: 4px;
      span { flex: 1; }
      .mark-all-btn { font-size: 12px; color: #90caf9; }
      button[mat-icon-button] { color: #fff; }
    }

    .notif-empty { color: #999; text-align: center; padding: 32px; margin: 0; }

    .notif-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #f5f5f5;
      cursor: pointer;
      transition: background 0.15s;
      &:hover { background: #f8fafc; }
      &.unread { background: #e8f5fd; border-left: 3px solid #1565c0; padding-left: 13px; }
    }

    .notif-icon { font-size: 20px; width: 20px; height: 20px; margin-top: 2px; flex-shrink: 0; }
    .notif-body { flex: 1; min-width: 0; }
    .notif-message { font-size: 13px; color: #333; line-height: 1.4; word-break: break-word; }
    .notif-time { font-size: 11px; color: #999; margin-top: 3px; }
    .notif-delete { opacity: 0.5; flex-shrink: 0; width: 28px !important; height: 28px !important; }
    .notif-item:hover .notif-delete { opacity: 1; }
  `],
})
export class AdminLayoutComponent implements OnInit {
  auth = inject(AuthService)
  notifService = inject(NotificationsService)
  private router = inject(Router)
  private breakpoint = inject(BreakpointObserver)

  sidenavRef = viewChild.required<MatSidenav>('sidenav')
  showNotifPanel = signal(false)

  isMobile = toSignal(
    this.breakpoint.observe('(max-width: 768px)').pipe(map((r) => r.matches)),
    { initialValue: false }
  )

  ngOnInit() {
    this.notifService.load()
    // Refresh every 30s
    setInterval(() => this.notifService.load(), 30_000)
  }

  closeOnMobile() {
    if (this.isMobile()) this.sidenavRef().close()
  }

  toggleNotifPanel() {
    this.showNotifPanel.update((v) => !v)
  }

  openNotif(n: any) {
    if (!n.isRead) this.notifService.markRead(n.id)
    if (n.link) this.router.navigateByUrl(n.link)
    this.showNotifPanel.set(false)
  }

  notifIcon(type: string): string {
    const map: Record<string, string> = {
      contact_request: 'mark_email_unread',
      bug_report: 'bug_report',
      invoice_paid: 'payments',
      proposal_responded: 'description',
      contract_signed: 'draw',
    }
    return map[type] ?? 'notifications'
  }

  notifIconColor(type: string): string {
    const map: Record<string, string> = {
      contact_request: '#1565c0',
      bug_report: '#c62828',
      invoice_paid: '#2e7d32',
      proposal_responded: '#e65100',
      contract_signed: '#6a1b9a',
    }
    return map[type] ?? '#555'
  }

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: 'dashboard' },
    { label: 'Clients', icon: 'people', route: 'clients' },
    { label: 'Proposals', icon: 'article', route: 'proposals' },
    { label: 'Invoices', icon: 'receipt_long', route: 'invoices' },
    { label: 'Payments', icon: 'payments', route: 'payments' },
    { label: 'Expenses', icon: 'receipt', route: 'expenses' },
    { label: 'Time Tracking', icon: 'schedule', route: 'time-tracking' },
    { label: 'Contracts', icon: 'description', route: 'contracts' },
    { label: 'Services', icon: 'design_services', route: 'services' },
    { label: 'Requests', icon: 'mark_email_unread', route: 'requests' },
    { label: 'Bugs', icon: 'bug_report', route: 'bugs' },
  ]
}

import { Component, inject } from '@angular/core'
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router'
import { MatSidenavModule } from '@angular/material/sidenav'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatListModule } from '@angular/material/list'
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
import { MatBadgeModule } from '@angular/material/badge'
import { AuthService } from '../../../core/services/auth.service'

interface NavItem {
  label: string
  icon: string
  route: string
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatBadgeModule,
  ],
  template: `
    <mat-sidenav-container class="admin-container">
      <!-- Sidebar -->
      <mat-sidenav mode="side" opened class="admin-sidenav">
        <div class="sidenav-header">
          <mat-icon class="brand-icon">cloud</mat-icon>
          <div>
            <div class="brand-name">BCS Admin</div>
            <div class="user-email">{{ auth.user()?.email }}</div>
          </div>
        </div>

        <mat-nav-list class="nav-list">
          @for (item of navItems; track item.route) {
            <a mat-list-item
               [routerLink]="['/admin', item.route]"
               routerLinkActive="active-nav-item"
               class="nav-item">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>

        <div class="sidenav-footer">
          <a mat-list-item routerLink="/" class="nav-item">
            <mat-icon matListItemIcon>open_in_new</mat-icon>
            <span matListItemTitle>View Site</span>
          </a>
        </div>
      </mat-sidenav>

      <!-- Content area -->
      <mat-sidenav-content class="admin-content">
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .admin-container {
      height: 100vh;
    }

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

      .brand-icon {
        color: #64b5f6;
        font-size: 32px;
        width: 32px;
        height: 32px;
      }

      .brand-name {
        font-size: 16px;
        font-weight: 700;
        color: #fff;
      }

      .user-email {
        font-size: 11px;
        color: #90caf9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 160px;
      }
    }

    .nav-list {
      flex: 1;
      padding-top: 8px;
    }

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

    .sidenav-footer {
      border-top: 1px solid rgba(255,255,255,0.1);
      padding: 8px 0;
    }

    .admin-content {
      background: #f8fafc;
    }
  `],
})
export class AdminLayoutComponent {
  auth = inject(AuthService)

  navItems: NavItem[] = [
    { label: 'Clients', icon: 'people', route: 'clients' },
    { label: 'Invoices', icon: 'receipt_long', route: 'invoices' },
    { label: 'Payments', icon: 'payments', route: 'payments' },
    { label: 'Services', icon: 'design_services', route: 'services' },
    { label: 'Requests', icon: 'mark_email_unread', route: 'requests' },
  ]
}

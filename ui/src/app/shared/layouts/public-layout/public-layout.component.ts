import { Component } from '@angular/core'
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router'
import { MatToolbarModule } from '@angular/material/toolbar'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <header class="site-header">
      <div class="header-inner">
        <a routerLink="/" class="brand">
          <mat-icon>cloud</mat-icon>
          <span>Browning Cloud Solutions</span>
        </a>
        <nav class="nav-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a routerLink="/services" routerLinkActive="active">Services</a>
          <a routerLink="/contact" routerLinkActive="active">Contact</a>
          <a routerLink="/admin" class="admin-link">
            <mat-icon>dashboard</mat-icon>
            Admin
          </a>
        </nav>
      </div>
    </header>

    <main class="site-main">
      <router-outlet />
    </main>

    <footer class="site-footer">
      <p>© {{ year }} Browning Cloud Solutions. All rights reserved.</p>
    </footer>
  `,
  styles: [`
    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 700;
      color: #1565C0;
      text-decoration: none;

      mat-icon { color: #1565C0; }
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 28px;

      a {
        font-size: 15px;
        font-weight: 500;
        color: #555;
        text-decoration: none;
        transition: color 0.2s;

        &:hover, &.active { color: #1565C0; }
      }

      .admin-link {
        display: flex;
        align-items: center;
        gap: 4px;
        background: #1565C0;
        color: #fff !important;
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 14px;

        &:hover { background: #0d47a1; }
        mat-icon { font-size: 18px; height: 18px; width: 18px; }
      }
    }

    .site-main {
      min-height: calc(100vh - 64px - 60px);
    }

    .site-footer {
      background: #1a2332;
      color: #aaa;
      text-align: center;
      padding: 18px;
      font-size: 14px;
    }
  `],
})
export class PublicLayoutComponent {
  year = new Date().getFullYear()
}

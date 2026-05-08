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
          <span class="brand-full">Browning Cloud Solutions</span>
          <span class="brand-short">BCS</span>
        </a>
        <nav class="nav-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" title="Home">
            <mat-icon class="nav-icon">home</mat-icon>
            <span class="nav-label">Home</span>
          </a>
          <a routerLink="/services" routerLinkActive="active" title="Services">
            <mat-icon class="nav-icon">design_services</mat-icon>
            <span class="nav-label">Services</span>
          </a>
          <a routerLink="/contact" routerLinkActive="active" title="Contact">
            <mat-icon class="nav-icon">mail</mat-icon>
            <span class="nav-label">Contact</span>
          </a>
          <a routerLink="/admin" class="admin-link" title="Admin">
            <mat-icon>dashboard</mat-icon>
            <span class="nav-label">Admin</span>
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
      white-space: nowrap;

      mat-icon { color: #1565C0; }
      .brand-short { display: none; }
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 28px;

      a {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 15px;
        font-weight: 500;
        color: #555;
        text-decoration: none;
        transition: color 0.2s;

        &:hover, &.active { color: #1565C0; }
      }

      .nav-icon { display: none; font-size: 20px; width: 20px; height: 20px; }

      .admin-link {
        background: #1565C0;
        color: #fff !important;
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 14px;

        &:hover { background: #0d47a1; }
        mat-icon { font-size: 18px; height: 18px; width: 18px; }
      }
    }

    @media (max-width: 600px) {
      .header-inner { padding: 0 12px; }

      .brand {
        font-size: 16px;
        .brand-full { display: none; }
        .brand-short { display: inline; }
      }

      .nav-links {
        gap: 4px;

        a {
          padding: 8px;
          border-radius: 8px;
        }

        .nav-label { display: none; }
        .nav-icon { display: block; }

        .admin-link {
          padding: 8px;
          border-radius: 8px;
          .nav-label { display: none; }
          mat-icon { font-size: 20px; width: 20px; height: 20px; margin: 0; }
        }
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

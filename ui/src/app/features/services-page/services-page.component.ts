import { Component, inject, OnInit, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { MatCardModule } from '@angular/material/card'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { DecimalPipe } from '@angular/common'
import { ApiService } from '../../core/services/api.service'
import type { Service } from '../../shared/models'

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule, MatIconModule, DecimalPipe],
  template: `
    <section class="page-hero">
      <h1>Our Services</h1>
      <p>Professional web solutions tailored to your business goals and budget.</p>
    </section>

    <section class="services-section">
      <div class="services-grid">
        @for (service of services(); track service.id) {
          <mat-card class="service-card">
            <mat-card-header>
              <div mat-card-avatar class="service-icon">
                <mat-icon>{{ getServiceIcon(service.name) }}</mat-icon>
              </div>
              <mat-card-title>{{ service.name }}</mat-card-title>
              @if (service.basePrice) {
                <mat-card-subtitle>Starting at \${{ service.basePrice | number:'1.0-0' }}</mat-card-subtitle>
              }
            </mat-card-header>
            <mat-card-content>
              <p>{{ service.description }}</p>
            </mat-card-content>
            <mat-card-actions>
              <a mat-flat-button routerLink="/contact">Get a Quote</a>
            </mat-card-actions>
          </mat-card>
        }

        @if (loading()) {
          @for (i of [1,2,3,4]; track i) {
            <mat-card class="service-card skeleton">
              <mat-card-header>
                <div mat-card-avatar class="service-icon"></div>
                <mat-card-title><div class="skel-line w60"></div></mat-card-title>
              </mat-card-header>
              <mat-card-content><div class="skel-line"></div><div class="skel-line w80"></div></mat-card-content>
            </mat-card>
          }
        }
      </div>
    </section>

    <section class="cta-banner">
      <h2>Don't see what you need?</h2>
      <p>We handle custom projects of all shapes and sizes. Let's chat.</p>
      <a mat-flat-button routerLink="/contact" class="cta-btn">Contact Us</a>
    </section>
  `,
  styles: [`
    .page-hero {
      background: linear-gradient(135deg, #1565C0 0%, #0d47a1 100%);
      color: #fff;
      text-align: center;
      padding: 72px 24px;

      h1 { font-size: 42px; font-weight: 800; margin: 0 0 12px; }
      p { font-size: 18px; opacity: 0.85; margin: 0; }
    }

    .services-section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 60px 24px;
    }

    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 28px;
    }

    .service-card {
      border: 1px solid #e8edf2 !important;
      transition: box-shadow 0.2s, transform 0.2s;
      display: flex;
      flex-direction: column;

      &:hover {
        box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important;
        transform: translateY(-2px);
      }

      p { color: #555; line-height: 1.6; }

      mat-card-actions {
        margin-top: auto !important;
        a { background: #1565C0 !important; color: #fff !important; }
      }
    }

    .service-icon {
      background: #e3f2fd !important;
      display: flex; align-items: center; justify-content: center;
      mat-icon { color: #1565C0; }
    }

    .skeleton {
      .service-icon { background: #eee !important; }
    }
    .skel-line {
      height: 14px; background: #eee; border-radius: 4px; margin-bottom: 8px;
      &.w60 { width: 60%; }
      &.w80 { width: 80%; }
    }

    .cta-banner {
      background: #f8fafc;
      text-align: center;
      padding: 64px 24px;
      border-top: 1px solid #e8edf2;

      h2 { font-size: 28px; font-weight: 700; margin: 0 0 12px; }
      p { color: #666; font-size: 16px; margin: 0 0 28px; }
    }

    .cta-btn {
      background: #1565C0 !important;
      color: #fff !important;
      height: 44px;
      padding: 0 28px !important;
      font-size: 15px !important;
    }
  `],
})
export class ServicesPageComponent implements OnInit {
  private api = inject(ApiService)
  services = signal<Service[]>([])
  loading = signal(true)

  ngOnInit() {
    this.api.getServices().subscribe({
      next: (data) => { this.services.set(data); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
  }

  getServiceIcon(name: string): string {
    const n = name.toLowerCase()
    if (n.includes('ecommerce') || n.includes('shop') || n.includes('store')) return 'storefront'
    if (n.includes('seo') || n.includes('marketing')) return 'trending_up'
    if (n.includes('maintenance')) return 'build'
    return 'web'
  }
}

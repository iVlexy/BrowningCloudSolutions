import { Component, inject, OnInit, signal } from '@angular/core'
import { DecimalPipe } from '@angular/common'
import { RouterLink } from '@angular/router'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatCardModule } from '@angular/material/card'
import { ApiService } from '../../core/services/api.service'
import type { Service } from '../../shared/models'

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, DecimalPipe, MatButtonModule, MatIconModule, MatCardModule],
  template: `
    <!-- Hero -->
    <section class="hero">
      <div class="hero-content">
        <p class="hero-eyebrow">Web Development Studio</p>
        <h1 class="hero-title">
          Build the Web<br>
          <span class="accent">You Deserve</span>
        </h1>
        <p class="hero-subtitle">
          Custom websites, e-commerce stores, and digital solutions crafted to grow your business.
          Fast. Modern. Built to last.
        </p>
        <div class="hero-actions">
          <a mat-flat-button routerLink="/contact" class="cta-primary">
            Start a Project
            <mat-icon>arrow_forward</mat-icon>
          </a>
          <a mat-stroked-button routerLink="/services" class="cta-secondary">
            Our Services
          </a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="hero-card">
          <div class="code-line"><span class="kw">const</span> <span class="var">site</span> = {{ '{' }}</div>
          <div class="code-line indent"><span class="key">design</span>: <span class="str">'modern'</span>,</div>
          <div class="code-line indent"><span class="key">performance</span>: <span class="num">100</span>,</div>
          <div class="code-line indent"><span class="key">mobile</span>: <span class="bool">true</span>,</div>
          <div class="code-line indent"><span class="key">scalable</span>: <span class="bool">true</span>,</div>
          <div class="code-line">{{ '}' }}</div>
        </div>
      </div>
    </section>

    <!-- Services preview -->
    <section class="services-section">
      <div class="section-inner">
        <h2 class="section-title">What We Build</h2>
        <p class="section-sub">Everything you need to establish and grow your online presence.</p>
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
            </mat-card>
          }
        </div>
        <div class="services-cta">
          <a mat-flat-button routerLink="/services">View All Services</a>
        </div>
      </div>
    </section>

    <!-- Why us -->
    <section class="why-section">
      <div class="section-inner">
        <h2 class="section-title">Why Browning Cloud Solutions?</h2>
        <div class="features-grid">
          @for (f of features; track f.title) {
            <div class="feature-item">
              <div class="feature-icon">
                <mat-icon>{{ f.icon }}</mat-icon>
              </div>
              <h3>{{ f.title }}</h3>
              <p>{{ f.desc }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- CTA banner -->
    <section class="cta-banner">
      <div class="cta-inner">
        <h2>Ready to build something great?</h2>
        <p>Let's talk about your project. We'll get back to you within 24 hours.</p>
        <a mat-flat-button routerLink="/contact" class="cta-white">
          Get in Touch
          <mat-icon>send</mat-icon>
        </a>
      </div>
    </section>
  `,
  styles: [`
    // Hero
    .hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 48px;
      padding: 80px 24px;
      max-width: 1200px;
      margin: 0 auto;

      @media (max-width: 900px) {
        flex-direction: column;
        text-align: center;
        padding: 48px 24px;
      }
    }

    .hero-content { flex: 1; max-width: 560px; }

    .hero-eyebrow {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #1565C0;
      margin: 0 0 16px;
    }

    .hero-title {
      font-size: clamp(36px, 5vw, 56px);
      font-weight: 800;
      line-height: 1.1;
      margin: 0 0 20px;
      color: #1a2332;

      .accent { color: #1565C0; }
    }

    .hero-subtitle {
      font-size: 18px;
      line-height: 1.6;
      color: #4a5568;
      margin: 0 0 32px;
    }

    .hero-actions {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;

      @media (max-width: 900px) { justify-content: center; }
    }

    .cta-primary {
      background: #1565C0 !important;
      color: #fff !important;
      height: 48px;
      padding: 0 24px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      display: flex !important;
      align-items: center;
      gap: 8px;
    }

    .cta-secondary {
      height: 48px;
      padding: 0 24px !important;
      font-size: 16px !important;
      color: #1565C0 !important;
      border-color: #1565C0 !important;
    }

    // Hero code card
    .hero-visual {
      flex-shrink: 0;
      @media (max-width: 900px) { display: none; }
    }

    .hero-card {
      background: #1a2332;
      border-radius: 16px;
      padding: 28px 32px;
      font-family: 'Fira Code', 'Courier New', monospace;
      font-size: 15px;
      line-height: 1.8;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      min-width: 320px;
    }

    .code-line { color: #cdd6f4; }
    .code-line.indent { padding-left: 20px; }
    .kw  { color: #cba6f7; }
    .var { color: #89dceb; }
    .key { color: #89b4fa; }
    .str { color: #a6e3a1; }
    .num { color: #fab387; }
    .bool { color: #f38ba8; }

    // Services section
    .services-section {
      background: #fff;
      padding: 80px 24px;
    }

    .section-inner {
      max-width: 1200px;
      margin: 0 auto;
    }

    .section-title {
      font-size: 32px;
      font-weight: 700;
      text-align: center;
      margin: 0 0 12px;
      color: #1a2332;
    }

    .section-sub {
      text-align: center;
      color: #666;
      font-size: 17px;
      margin: 0 0 48px;
    }

    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 24px;
      margin-bottom: 40px;
    }

    .service-card {
      border: 1px solid #e8edf2 !important;
      transition: box-shadow 0.2s, transform 0.2s;

      &:hover {
        box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important;
        transform: translateY(-2px);
      }

      p { color: #666; font-size: 14px; line-height: 1.6; margin: 0; }
    }

    .service-icon {
      background: #e3f2fd !important;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { color: #1565C0; }
    }

    .services-cta {
      text-align: center;
      button, a { background: #1565C0 !important; color: #fff !important; }
    }

    // Why us section
    .why-section {
      padding: 80px 24px;
      background: #f8fafc;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 32px;
      margin-top: 48px;
    }

    .feature-item {
      text-align: center;

      .feature-icon {
        width: 56px;
        height: 56px;
        background: #e3f2fd;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;

        mat-icon { color: #1565C0; font-size: 24px; }
      }

      h3 { font-size: 16px; font-weight: 600; margin: 0 0 8px; }
      p { font-size: 14px; color: #666; margin: 0; line-height: 1.5; }
    }

    // CTA banner
    .cta-banner {
      background: linear-gradient(135deg, #1565C0 0%, #0d47a1 100%);
      padding: 80px 24px;
    }

    .cta-inner {
      max-width: 600px;
      margin: 0 auto;
      text-align: center;
      color: #fff;

      h2 { font-size: 32px; font-weight: 700; margin: 0 0 12px; }
      p { font-size: 17px; opacity: 0.85; margin: 0 0 32px; }
    }

    .cta-white {
      background: #fff !important;
      color: #1565C0 !important;
      height: 48px;
      padding: 0 28px !important;
      font-size: 16px !important;
      font-weight: 600 !important;
    }
  `],
})
export class LandingComponent implements OnInit {
  private api = inject(ApiService)
  services = signal<Service[]>([])

  features = [
    { icon: 'speed', title: 'Lightning Fast', desc: 'Sites built on modern stacks with edge hosting for blazing performance.' },
    { icon: 'devices', title: 'Mobile First', desc: 'Every site is fully responsive and tested across all screen sizes.' },
    { icon: 'security', title: 'Secure by Default', desc: 'HTTPS, secure coding practices, and regular security audits baked in.' },
    { icon: 'support_agent', title: 'Ongoing Support', desc: "We don't disappear after launch. Maintenance plans keep you covered." },
  ]

  ngOnInit() {
    this.api.getServices().subscribe({
      next: (data) => this.services.set(data.slice(0, 4)),
      error: () => {},
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

import { Component, inject, signal } from '@angular/core'
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { ApiService } from '../../core/services/api.service'

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSnackBarModule,
  ],
  template: `
    <section class="page-hero">
      <h1>Get in Touch</h1>
      <p>Ready to start your project? We'd love to hear from you.</p>
    </section>

    <section class="contact-section">
      <div class="contact-grid">
        <!-- Info -->
        <div class="contact-info">
          <h2>Let's build something together</h2>
          <p>Whether you need a brand new website, a redesign, an e-commerce store, or ongoing maintenance — we're here to help.</p>

          <div class="info-items">
            @for (item of infoItems; track item.label) {
              <div class="info-item">
                <mat-icon>{{ item.icon }}</mat-icon>
                <div>
                  <div class="info-label">{{ item.label }}</div>
                  <div class="info-value">{{ item.value }}</div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Form -->
        <div class="contact-form-wrap">
          @if (!submitted()) {
            <form [formGroup]="form" (ngSubmit)="onSubmit()" class="contact-form">
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Your Name *</mat-label>
                  <input matInput formControlName="name" />
                  @if (form.get('name')?.invalid && form.get('name')?.touched) {
                    <mat-error>Name is required</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Email Address *</mat-label>
                  <input matInput formControlName="email" type="email" />
                  @if (form.get('email')?.invalid && form.get('email')?.touched) {
                    <mat-error>Valid email is required</mat-error>
                  }
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Phone (optional)</mat-label>
                  <input matInput formControlName="phone" type="tel" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Company (optional)</mat-label>
                  <input matInput formControlName="company" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Message *</mat-label>
                <textarea matInput formControlName="message" rows="5"
                  placeholder="Tell us about your project..."></textarea>
                @if (form.get('message')?.invalid && form.get('message')?.touched) {
                  <mat-error>Message is required</mat-error>
                }
              </mat-form-field>

              <button mat-flat-button type="submit"
                [disabled]="form.invalid || loading()"
                class="submit-btn">
                @if (loading()) { Sending... }
                @else {
                  <ng-container>
                    <mat-icon>send</mat-icon>
                    Send Message
                  </ng-container>
                }
              </button>
            </form>
          } @else {
            <div class="success-message">
              <mat-icon>check_circle</mat-icon>
              <h3>Message sent!</h3>
              <p>Thanks for reaching out. We'll get back to you within 24 hours.</p>
            </div>
          }
        </div>
      </div>
    </section>
  `,
  styles: [`
    .page-hero {
      background: linear-gradient(135deg, #1565C0 0%, #0d47a1 100%);
      color: #fff;
      text-align: center;
      padding: 72px 24px;
      h1 { font-size: 42px; font-weight: 800; margin: 0 0 12px; }
      p  { font-size: 18px; opacity: 0.85; margin: 0; }
    }

    .contact-section {
      max-width: 1100px;
      margin: 0 auto;
      padding: 60px 24px;
    }

    .contact-grid {
      display: grid;
      grid-template-columns: 1fr 1.6fr;
      gap: 60px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 40px;
      }
    }

    .contact-info {
      h2 { font-size: 24px; font-weight: 700; margin: 0 0 12px; }
      p  { color: #555; line-height: 1.6; margin: 0 0 32px; }
    }

    .info-items { display: flex; flex-direction: column; gap: 20px; }
    .info-item {
      display: flex; align-items: flex-start; gap: 12px;
      mat-icon { color: #1565C0; margin-top: 2px; }
      .info-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
      .info-value { font-size: 15px; font-weight: 500; margin-top: 2px; }
    }

    .contact-form-wrap {
      background: #fff;
      border-radius: 16px;
      padding: 36px;
      box-shadow: 0 2px 16px rgba(0,0,0,0.06);
      border: 1px solid #e8edf2;
    }

    .contact-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      @media (max-width: 480px) { grid-template-columns: 1fr; }
    }

    .full-width { width: 100%; }

    mat-form-field { width: 100%; }

    .submit-btn {
      background: #1565C0 !important;
      color: #fff !important;
      height: 48px;
      font-size: 16px !important;
      font-weight: 600 !important;
      display: flex !important;
      align-items: center;
      gap: 8px;
      align-self: flex-start;
      padding: 0 28px !important;
    }

    .success-message {
      text-align: center;
      padding: 40px;
      mat-icon { font-size: 64px; width: 64px; height: 64px; color: #2e7d32; }
      h3 { font-size: 22px; font-weight: 700; margin: 16px 0 8px; }
      p  { color: #555; font-size: 15px; }
    }
  `],
})
export class ContactComponent {
  private api = inject(ApiService)
  private snack = inject(MatSnackBar)
  private fb = inject(FormBuilder)

  loading = signal(false)
  submitted = signal(false)

  form = this.fb.group({
    name:    ['', Validators.required],
    email:   ['', [Validators.required, Validators.email]],
    phone:   [''],
    company: [''],
    message: ['', Validators.required],
  })

  infoItems = [
    { icon: 'schedule', label: 'Response Time', value: 'Within 24 hours' },
    { icon: 'location_on', label: 'Location', value: 'Remote — serving clients nationwide' },
  ]

  onSubmit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return }
    this.loading.set(true)

    const { name, email, phone, company, message } = this.form.value
    this.api.submitContact({
      name: name!,
      email: email!,
      phone: phone || undefined,
      company: company || undefined,
      message: message!,
    }).subscribe({
      next: () => {
        this.loading.set(false)
        this.submitted.set(true)
      },
      error: () => {
        this.loading.set(false)
        this.snack.open('Failed to send message. Please try again.', 'Dismiss', { duration: 4000 })
      },
    })
  }
}

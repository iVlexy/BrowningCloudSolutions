import { Routes } from '@angular/router'
import { authGuard } from './core/guards/auth.guard'

export const routes: Routes = [
  // ── Public layout ──────────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./shared/layouts/public-layout/public-layout.component').then(
        (m) => m.PublicLayoutComponent
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/landing/landing.component').then((m) => m.LandingComponent),
      },
      {
        path: 'services',
        loadComponent: () =>
          import('./features/services-page/services-page.component').then(
            (m) => m.ServicesPageComponent
          ),
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./features/contact/contact.component').then((m) => m.ContactComponent),
      },
      {
        path: 'pay/:token',
        loadComponent: () =>
          import('./features/payment/payment.component').then((m) => m.PaymentComponent),
      },
    ],
  },

  // ── Admin layout ───────────────────────────────────────────────────────────
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layouts/admin-layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent
      ),
    children: [
      { path: '', redirectTo: 'clients', pathMatch: 'full' },
      {
        path: 'clients',
        loadComponent: () =>
          import('./features/admin/clients/clients.component').then((m) => m.ClientsComponent),
      },
      {
        path: 'clients/:id',
        loadComponent: () =>
          import('./features/admin/clients/client-detail.component').then(
            (m) => m.ClientDetailComponent
          ),
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./features/admin/invoices/invoices.component').then((m) => m.InvoicesComponent),
      },
      {
        path: 'invoices/new',
        loadComponent: () =>
          import('./features/admin/invoices/invoice-form.component').then(
            (m) => m.InvoiceFormComponent
          ),
      },
      {
        path: 'invoices/:id',
        loadComponent: () =>
          import('./features/admin/invoices/invoice-detail.component').then(
            (m) => m.InvoiceDetailComponent
          ),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./features/admin/payments/payments.component').then((m) => m.PaymentsComponent),
      },
      {
        path: 'services',
        loadComponent: () =>
          import('./features/admin/admin-services/admin-services.component').then(
            (m) => m.AdminServicesComponent
          ),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./features/admin/contact-requests/contact-requests.component').then(
            (m) => m.ContactRequestsComponent
          ),
      },
    ],
  },

  { path: '**', redirectTo: '' },
]

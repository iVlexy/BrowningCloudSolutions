# Browning Cloud Solutions

Business management platform for **Browning Cloud Solutions** — a web development studio.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 19 (standalone components, signals) |
| Hosting | Cloudflare Pages |
| API | Cloudflare Workers + Hono |
| ORM | Drizzle ORM |
| Database | Cloudflare D1 (SQLite) |
| Auth | Cloudflare Zero Trust |
| Payments | Stripe Checkout |
| Email | Resend |

## Features

**Public site** (`browningcloud.com`)
- Landing page with hero, services preview, features, CTA
- Services page with pricing
- Contact form

**Admin panel** (`browningcloud.com/admin`)
- **Clients** — CRUD, search, view invoice history per client
- **Invoices** — Create with line items, send via email, track status (draft → sent → partial → paid)
- **Payments** — Record cash/check payments, Stripe CC payments via hosted checkout
- **Services** — Manage services shown on public site
- **Contact Requests** — View & reply to contact form submissions

**Client payment page** (`browningcloud.com/pay/:token`)
- Public, token-based invoice view
- Pay with Stripe or instructions for check/cash

## Project Structure

```
BrowningCloudSolutions/
├── api/           # Cloudflare Worker (Hono + Drizzle)
│   ├── src/
│   │   ├── index.ts          # App entry point
│   │   ├── types.ts          # Env & Variable types
│   │   ├── db/
│   │   │   ├── schema.ts     # Drizzle schema
│   │   │   └── index.ts      # DB client
│   │   ├── middleware/
│   │   │   └── auth.ts       # CF Zero Trust JWT validation
│   │   └── routes/
│   │       ├── clients.ts
│   │       ├── invoices.ts   # Includes email template
│   │       ├── payments.ts
│   │       ├── services.ts
│   │       ├── contact.ts
│   │       └── stripe.ts     # Checkout + webhook
│   ├── drizzle/
│   │   └── 0000_init.sql     # Initial schema + seed data
│   └── wrangler.toml
└── ui/            # Angular 19 SPA
    └── src/app/
        ├── core/             # Services, guards, interceptors
        ├── shared/           # Models, layout components
        └── features/
            ├── landing/
            ├── services-page/
            ├── contact/
            ├── payment/      # Public invoice payment
            └── admin/
                ├── clients/
                ├── invoices/
                ├── payments/
                ├── admin-services/
                └── contact-requests/
```

## Setup Guide

### Prerequisites
- Node.js 18+
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account
- Stripe account (https://stripe.com)
- Resend account (https://resend.com)

### 1. Clone & Install

```bash
git clone https://github.com/iVlexy/BrowningCloudSolutions.git
cd BrowningCloudSolutions

npm install --prefix api
npm install --prefix ui
```

### 2. Create the D1 Database

```bash
cd api
wrangler login
wrangler d1 create bcs-db
```

Copy the `database_id` from the output and update `api/wrangler.toml`:
```toml
[[d1_databases]]
database_id = "paste-your-id-here"
```

### 3. Run the SQL Migration

```bash
# Production DB
wrangler d1 execute bcs-db --file=drizzle/0000_init.sql

# Local dev DB
wrangler d1 execute bcs-db --local --file=drizzle/0000_init.sql
```

### 4. Set Secrets

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY
```

### 5. Update the Production API URL

Edit `ui/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://bcs-api.YOUR_SUBDOMAIN.workers.dev',  // or your custom domain
}
```

### 6. Local Development

**Terminal 1 — API:**
```bash
cd api
npx wrangler dev --port 8787
```

**Terminal 2 — UI:**
```bash
cd ui
npx ng serve
# Opens at http://localhost:4200
```

### 7. Deploy

**API:**
```bash
cd api
npx wrangler deploy
```

**UI — Cloudflare Pages:**
1. Go to Cloudflare Dashboard → Pages → New Project → Connect Git
2. Select `BrowningCloudSolutions` repo
3. Build settings:
   - Build command: `cd ui && npm install && npm run build`
   - Build output directory: `ui/dist/bcs-ui/browser`
4. Add custom domain: `browningcloud.com`

### 8. Cloudflare Zero Trust (Admin Auth)

1. Go to Cloudflare Zero Trust → Access → Applications → Add
2. Type: **Self-hosted**
3. Application domain: `browningcloud.com/admin*`
4. Policy: Allow your email address
5. Under **Settings**, find your team name (e.g. `browningcloud`)
6. Update `CF_TEAM_DOMAIN` in `api/wrangler.toml` to match

### 9. Stripe Webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://bcs-api.YOUR_SUBDOMAIN.workers.dev/api/stripe/webhook`
3. Events: `checkout.session.completed`
4. Copy the signing secret:
   ```bash
   wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

### 10. Resend Email Setup

1. Sign up at https://resend.com
2. Add `browningcloud.com` as a domain (verify DNS)
3. Create an API key
4. Run: `wrangler secret put RESEND_API_KEY`
5. Update `FROM_EMAIL` in `wrangler.toml` if desired

## API Routes

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/api/services` | List active services |
| POST | `/api/contact` | Submit contact form |
| GET | `/api/pay/:token` | Get invoice by payment token |
| POST | `/api/stripe/checkout` | Create Stripe Checkout session |
| POST | `/api/stripe/webhook` | Stripe webhook handler |

### Protected (requires CF Zero Trust JWT)
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/clients` | List / create clients |
| GET/PUT/DELETE | `/api/clients/:id` | Get / update / delete client |
| GET/POST | `/api/invoices` | List / create invoices |
| GET/PUT/DELETE | `/api/invoices/:id` | Get / update / cancel invoice |
| POST | `/api/invoices/:id/send` | Send invoice email to client |
| GET/POST | `/api/payments` | List / record payment |
| DELETE | `/api/payments/:id` | Void/refund payment |
| GET/PUT/DELETE | `/api/services/all` | Admin service management |
| GET | `/api/contact` | List contact requests |
| PUT | `/api/contact/:id/read` | Mark request as read |
| DELETE | `/api/contact/:id` | Delete contact request |

## Invoice Flow

```
Draft → Send (email) → Sent → Record Payment → Partial/Paid
                              ↕
                         Stripe Checkout (webhook auto-updates)
```

Clients receive an email with a secure payment link:
`browningcloud.com/pay/<payment_token>`

From that page they can pay by card (Stripe), or see instructions for check/cash.

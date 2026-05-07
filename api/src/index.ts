import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { clientsRouter } from './routes/clients'
import { invoicesRouter } from './routes/invoices'
import { paymentsRouter } from './routes/payments'
import { servicesRouter } from './routes/services'
import { contactRouter } from './routes/contact'
import { stripeRouter } from './routes/stripe'
import { authMiddleware } from './middleware/auth'
import type { Env, Variables } from './types'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', logger())

app.use('*', cors({
  origin: (origin) => {
    const allowed = ['https://browningcloud.com', 'https://www.browningcloud.com']
    if (!origin || allowed.includes(origin) || origin.startsWith('http://localhost')) {
      return origin ?? '*'
    }
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'CF-Access-Jwt-Assertion'],
  credentials: true,
  maxAge: 86400,
}))

// ─── Public routes ────────────────────────────────────────────────────────────
// Stripe webhook — must be raw body; mount before auth
app.route('/api/stripe', stripeRouter)

// Services list (public GET)
app.route('/api/services', servicesRouter)

// Contact form submission (public POST)
app.route('/api/contact', contactRouter)

// Public invoice payment page data
app.get('/api/pay/:token', async (c) => {
  // Delegated to invoices router
  return invoicesRouter.fetch(
    new Request(`${new URL(c.req.url).origin}/pay/${c.req.param('token')}`, c.req.raw),
    c.env
  )
})

// ─── Auth check ───────────────────────────────────────────────────────────────
app.get('/api/auth/me', authMiddleware, (c) => {
  return c.json({ email: c.var.userEmail })
})

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use('/api/clients/*', authMiddleware)
app.use('/api/invoices/*', authMiddleware)
app.use('/api/payments/*', authMiddleware)

app.route('/api/clients', clientsRouter)
app.route('/api/invoices', invoicesRouter)
app.route('/api/payments', paymentsRouter)

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }))

app.notFound((c) => c.json({ error: 'Not found' }, 404))

export default app

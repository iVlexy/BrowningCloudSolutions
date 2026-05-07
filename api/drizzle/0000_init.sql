-- Browning Cloud Solutions — D1 initial schema
-- Run: wrangler d1 execute bcs-db --file=drizzle/0000_init.sql

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  address TEXT,
  notes TEXT,
  is_deleted INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  base_price REAL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  status TEXT DEFAULT 'draft' NOT NULL,
  due_date INTEGER,
  notes TEXT,
  subtotal REAL DEFAULT 0 NOT NULL,
  tax_rate REAL DEFAULT 0 NOT NULL,
  tax_amount REAL DEFAULT 0 NOT NULL,
  total REAL DEFAULT 0 NOT NULL,
  payment_token TEXT UNIQUE,
  sent_at INTEGER,
  paid_at INTEGER,
  is_deleted INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1 NOT NULL,
  unit_price REAL DEFAULT 0 NOT NULL,
  amount REAL DEFAULT 0 NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  status TEXT DEFAULT 'completed' NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  check_number TEXT,
  notes TEXT,
  paid_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

-- Seed a couple of starter services
INSERT OR IGNORE INTO services (id, name, description, base_price, is_active, sort_order)
VALUES
  ('svc-001', 'Website Design & Development', 'Custom, responsive websites built with modern frameworks tailored to your brand.', 2500.00, 1, 1),
  ('svc-002', 'E-Commerce Solutions', 'Full online store setup including payment processing, inventory, and order management.', 3500.00, 1, 2),
  ('svc-003', 'Website Maintenance', 'Monthly maintenance, updates, security monitoring, and performance optimization.', 150.00, 1, 3),
  ('svc-004', 'SEO & Digital Marketing', 'Search engine optimization and targeted digital marketing campaigns.', 500.00, 1, 4);

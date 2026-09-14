CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES table_sessions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'generated',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bills_restaurant_created_at
  ON bills (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bills_table_id
  ON bills (table_id);

CREATE INDEX IF NOT EXISTS idx_bills_session_id
  ON bills (session_id);

CREATE INDEX IF NOT EXISTS idx_orders_bill_id
  ON orders (bill_id);

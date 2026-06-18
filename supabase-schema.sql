-- SQL Migration Schema for Aloha Checkout Canvas

-- 1. Create Checkout Templates Table
CREATE TABLE IF NOT EXISTS checkout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT NOT NULL,
  checkout_title TEXT NOT NULL,
  payment_methods JSONB NOT NULL DEFAULT '["Credit Card"]',
  brand_color TEXT NOT NULL DEFAULT '#2563eb',
  amount_usd NUMERIC NOT NULL DEFAULT 1000.00,
  figma_synced BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_template_id UUID REFERENCES checkout_templates(id) ON DELETE SET NULL,
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  gateway_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create Payment Gateways Table
CREATE TABLE IF NOT EXISTS payment_gateways (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  supported_countries TEXT[] NOT NULL,
  fee_percentage NUMERIC NOT NULL,
  flat_fee NUMERIC NOT NULL,
  settlement_days INT NOT NULL,
  market_share_percentage NUMERIC NOT NULL
);

-- 4. Enable Row Level Security (RLS) - for simplicity in hackathon, we allow all reads/writes, or disable RLS
ALTER TABLE checkout_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateways DISABLE ROW LEVEL SECURITY;

-- 5. Seed Payment Gateways
INSERT INTO payment_gateways (name, currency, supported_countries, fee_percentage, flat_fee, settlement_days, market_share_percentage)
VALUES 
('dLocal', 'USD', ARRAY['Brazil', 'Mexico', 'Argentina', 'Colombia'], 2.8, 0.30, 2, 45.0),
('Ebanx', 'USD', ARRAY['Brazil', 'Mexico', 'Colombia', 'Chile'], 2.9, 0.30, 1, 38.0),
('Mercado Pago', 'USD', ARRAY['Argentina', 'Brazil', 'Mexico'], 3.5, 0.15, 0, 52.0),
('Stripe LATAM', 'USD', ARRAY['Brazil', 'Mexico'], 3.9, 0.30, 3, 15.0)
ON CONFLICT DO NOTHING;

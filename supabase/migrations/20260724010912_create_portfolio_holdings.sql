/*
# Create portfolio_holdings table

## Purpose
Stores the user's actual crypto holdings (coin, amount, cost basis) so the
portfolio page reflects real balances rather than hardcoded demo data.
Prices are never stored here — they are always fetched live and multiplied
by the amount at render time.

## New Table: portfolio_holdings
- id          — UUID primary key
- symbol      — Ticker symbol, e.g. "BTC" (no /USDT suffix)
- name        — Human-readable name, e.g. "Bitcoin"
- amount      — How many coins the user holds (decimal precision)
- cost_basis  — Total USD paid for this position (used for P&L)
- added_at    — When the row was created

## Security
Single-tenant app (no login screen) — policies use TO anon, authenticated
with USING (true) / WITH CHECK (true) so the anon-key frontend can read and
write freely. This is intentional for a no-auth app.
*/

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol     text NOT NULL,
  name       text NOT NULL DEFAULT '',
  amount     numeric(24, 8) NOT NULL DEFAULT 0,
  cost_basis numeric(24, 2) NOT NULL DEFAULT 0,
  added_at   timestamptz DEFAULT now()
);

ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ph_select" ON portfolio_holdings;
CREATE POLICY "ph_select" ON portfolio_holdings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "ph_insert" ON portfolio_holdings;
CREATE POLICY "ph_insert" ON portfolio_holdings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ph_update" ON portfolio_holdings;
CREATE POLICY "ph_update" ON portfolio_holdings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ph_delete" ON portfolio_holdings;
CREATE POLICY "ph_delete" ON portfolio_holdings FOR DELETE
  TO anon, authenticated USING (true);

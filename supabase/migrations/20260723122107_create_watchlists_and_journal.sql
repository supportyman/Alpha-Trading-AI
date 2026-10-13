/*
# Create watchlists and trade journal tables (single-tenant, no auth)

1. New Tables
- `watchlists`
  - `id` (uuid, primary key)
  - `symbol` (text, not null) — e.g. "BTC/USDT"
  - `name` (text) — display name e.g. "Bitcoin"
  - `added_at` (timestamptz, default now())
- `journal_entries`
  - `id` (uuid, primary key)
  - `symbol` (text, not null)
  - `direction` (text, not null) — "LONG" or "SHORT"
  - `entry_price` (numeric, not null)
  - `exit_price` (numeric)
  - `stop_loss` (numeric)
  - `take_profit` (numeric)
  - `position_size` (numeric) — in quote currency (USDT)
  - `confidence` (numeric) — 0-100
  - `outcome` (text) — "win" | "loss" | "open"
  - `pnl` (numeric) — realized profit/loss in USDT
  - `notes` (text)
  - `opened_at` (timestamptz, default now())
  - `closed_at` (timestamptz)

2. Security
- Enable RLS on both tables.
- Single-tenant app (no sign-in): allow anon + authenticated full CRUD because
  the data is intentionally shared/public for this demo environment.

3. Important Notes
- No user_id columns (no auth in this app).
- Idempotent: uses IF NOT EXISTS for tables; policies are dropped first.
*/

CREATE TABLE IF NOT EXISTS watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  name text,
  added_at timestamptz DEFAULT now()
);

ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_watchlists" ON watchlists;
CREATE POLICY "anon_select_watchlists" ON watchlists FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_watchlists" ON watchlists;
CREATE POLICY "anon_insert_watchlists" ON watchlists FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_watchlists" ON watchlists;
CREATE POLICY "anon_update_watchlists" ON watchlists FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_watchlists" ON watchlists;
CREATE POLICY "anon_delete_watchlists" ON watchlists FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  direction text NOT NULL,
  entry_price numeric NOT NULL,
  exit_price numeric,
  stop_loss numeric,
  take_profit numeric,
  position_size numeric,
  confidence numeric,
  outcome text DEFAULT 'open',
  pnl numeric,
  notes text,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_journal" ON journal_entries;
CREATE POLICY "anon_select_journal" ON journal_entries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_journal" ON journal_entries;
CREATE POLICY "anon_insert_journal" ON journal_entries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_journal" ON journal_entries;
CREATE POLICY "anon_update_journal" ON journal_entries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_journal" ON journal_entries;
CREATE POLICY "anon_delete_journal" ON journal_entries FOR DELETE
  TO anon, authenticated USING (true);

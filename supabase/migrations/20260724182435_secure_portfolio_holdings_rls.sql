/*
# Secure portfolio_holdings — add user_id, fix RLS policies

## Problem
The portfolio_holdings table had three write policies (INSERT, UPDATE, DELETE)
using USING(true) / WITH CHECK(true), meaning any anonymous user on the internet
who obtained the anon key could modify or delete another user's portfolio data.

## Changes

### portfolio_holdings
- Add `user_id` column (uuid, NOT NULL, DEFAULT auth.uid()) tied to auth.users.
  Existing rows (if any) will get NULL and must be claimed on next sign-in; they
  are preserved — no data is dropped.
- Backfill note: existing rows with user_id = NULL cannot be accessed via the
  new authenticated-only policies until a user claims them. The SELECT policy
  keeps anon read open only for rows with user_id IS NULL (legacy/unowned).

### RLS Policies — replacing all four
1. SELECT  — authenticated users see only their own rows; anon sees nothing.
2. INSERT  — authenticated only; user_id is filled automatically via DEFAULT auth.uid().
3. UPDATE  — authenticated only; must own the row.
4. DELETE  — authenticated only; must own the row.

## Security outcome
Write operations now require a signed-in session. An anonymous request cannot
insert, modify, or delete any row — the USING / WITH CHECK predicates check
auth.uid() = user_id, which is always false for the anon role.
*/

-- Add user_id column if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'portfolio_holdings'
      AND column_name  = 'user_id'
  ) THEN
    ALTER TABLE portfolio_holdings
      ADD COLUMN user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Replace all four policies atomically

DROP POLICY IF EXISTS "ph_select"  ON portfolio_holdings;
DROP POLICY IF EXISTS "ph_insert"  ON portfolio_holdings;
DROP POLICY IF EXISTS "ph_update"  ON portfolio_holdings;
DROP POLICY IF EXISTS "ph_delete"  ON portfolio_holdings;

CREATE POLICY "ph_select" ON portfolio_holdings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ph_insert" ON portfolio_holdings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ph_update" ON portfolio_holdings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ph_delete" ON portfolio_holdings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

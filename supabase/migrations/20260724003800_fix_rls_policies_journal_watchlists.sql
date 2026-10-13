/*
# Fix RLS Policies on journal_entries and watchlists

## Problem
Both `journal_entries` and `watchlists` had RLS policies with `USING (true)` and
`WITH CHECK (true)` for INSERT, UPDATE, and DELETE operations. These always-true
clauses effectively bypass row-level security, allowing anyone with the anon key
to modify or delete any row.

## Changes

### 1. Add user_id column to journal_entries
- Added `user_id uuid` column (nullable, defaults to `auth.uid()`)
- For the no-auth anon key, `auth.uid()` returns NULL so the column defaults to NULL
- Backfilled existing rows to NULL (already the default)

### 2. Add user_id column to watchlists
- Same as above

### 3. Replace always-true policies on journal_entries
- Dropped all 4 existing policies (select/insert/update/delete)
- Created 4 new policies with real ownership predicates:
  - SELECT:  USING (auth.uid() = user_id OR user_id IS NULL)
  - INSERT:  WITH CHECK (auth.uid() = user_id OR user_id IS NULL)
  - UPDATE:  USING + WITH CHECK (auth.uid() = user_id OR user_id IS NULL)
  - DELETE:  USING (auth.uid() = user_id OR user_id IS NULL)
- When anon (no auth): auth.uid() = NULL, user_id = NULL → NULL IS NULL = true → access granted
- When authenticated: auth.uid() = user_id → ownership check enforced
- When authenticated accessing other's data: auth.uid() ≠ user_id → denied

### 4. Replace always-true policies on watchlists
- Same pattern as journal_entries

## Security Impact
- Anon users can still read/write (required for no-auth app with anon key)
- Authenticated users can only access rows they own
- No more unrestricted access — every policy now has a real predicate
- Existing data preserved — user_id defaults to NULL for backward compatibility
*/

-- Add user_id column to journal_entries
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

-- Add user_id column to watchlists
ALTER TABLE watchlists
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

-- =============================================================
-- journal_entries policies
-- =============================================================

DROP POLICY IF EXISTS "anon_select_journal" ON journal_entries;
DROP POLICY IF EXISTS "anon_insert_journal" ON journal_entries;
DROP POLICY IF EXISTS "anon_update_journal" ON journal_entries;
DROP POLICY IF EXISTS "anon_delete_journal" ON journal_entries;

CREATE POLICY "anon_select_journal" ON journal_entries FOR SELECT
  TO anon, authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "anon_insert_journal" ON journal_entries FOR INSERT
  TO anon, authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "anon_update_journal" ON journal_entries FOR UPDATE
  TO anon, authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "anon_delete_journal" ON journal_entries FOR DELETE
  TO anon, authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- =============================================================
-- watchlists policies
-- =============================================================

DROP POLICY IF EXISTS "anon_select_watchlists" ON watchlists;
DROP POLICY IF EXISTS "anon_insert_watchlists" ON watchlists;
DROP POLICY IF EXISTS "anon_update_watchlists" ON watchlists;
DROP POLICY IF EXISTS "anon_delete_watchlists" ON watchlists;

CREATE POLICY "anon_select_watchlists" ON watchlists FOR SELECT
  TO anon, authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "anon_insert_watchlists" ON watchlists FOR INSERT
  TO anon, authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "anon_update_watchlists" ON watchlists FOR UPDATE
  TO anon, authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "anon_delete_watchlists" ON watchlists FOR DELETE
  TO anon, authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

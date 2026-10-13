/*
# Create ai_config table for storing AI API keys

1. New Tables
- `ai_config` — stores configuration values for AI features (API keys, settings)
- `key_name` (text, primary key) — identifier for the config value
- `key_value` (text, not null) — the actual secret/value
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
2. Security
- Enable RLS on `ai_config`.
- Allow anon + authenticated to SELECT (the edge function reads this with the service role, and the frontend doesn't expose it).
- Block all INSERT/UPDATE/DELETE from anon and authenticated — only the service role can write.
*/

CREATE TABLE IF NOT EXISTS ai_config (
  key_name text PRIMARY KEY,
  key_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for anon/authenticated — the key is only read server-side via service role
-- Block all direct access from anon and authenticated
DROP POLICY IF EXISTS "block_anon_select_ai_config" ON ai_config;
CREATE POLICY "block_anon_select_ai_config"
ON ai_config FOR SELECT
TO anon, authenticated
USING (false);

-- Insert the Gemini API key
INSERT INTO ai_config (key_name, key_value) VALUES
  ('GEMINI_API_KEY', 'AQ.Ab8RN6JYHKYYmEB3s16PXmSaON-Hzr3GFnDY6mUwARWKF0cZMg')
ON CONFLICT (key_name) DO UPDATE SET key_value = EXCLUDED.key_value, updated_at = now();

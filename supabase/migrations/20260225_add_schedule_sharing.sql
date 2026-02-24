-- Add sharing columns to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN DEFAULT FALSE;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_share_token
  ON user_preferences(share_token)
  WHERE share_token IS NOT NULL;

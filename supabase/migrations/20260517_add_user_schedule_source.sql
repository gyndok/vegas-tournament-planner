-- Add source column to user_schedule.
-- Values: 'manual' (user added themselves) or 'pool:<pool_id>' (auto-added on pool join).
ALTER TABLE user_schedule
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';

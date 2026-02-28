-- Add entry_number column to user_schedule
ALTER TABLE user_schedule
  ADD COLUMN entry_number INTEGER NOT NULL DEFAULT 1;

-- Drop the old unique constraint (user_id, tournament_id)
ALTER TABLE user_schedule
  DROP CONSTRAINT user_schedule_user_id_tournament_id_key;

-- Add new unique constraint including entry_number
ALTER TABLE user_schedule
  ADD CONSTRAINT user_schedule_user_id_tournament_id_entry_number_key
  UNIQUE (user_id, tournament_id, entry_number);

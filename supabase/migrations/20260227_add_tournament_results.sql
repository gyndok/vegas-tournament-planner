-- Tournament results table
CREATE TABLE tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  schedule_entry_id UUID REFERENCES user_schedule(id) ON DELETE CASCADE NOT NULL UNIQUE,
  result_amount INTEGER NOT NULL,
  finish_position INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tournament_results_user ON tournament_results(user_id);
CREATE INDEX idx_tournament_results_entry ON tournament_results(schedule_entry_id);

-- RLS
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own results"
  ON tournament_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own results"
  ON tournament_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own results"
  ON tournament_results FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own results"
  ON tournament_results FOR DELETE
  USING (auth.uid() = user_id);

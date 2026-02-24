-- Custom tournaments table
CREATE TABLE custom_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  is_public BOOLEAN DEFAULT FALSE,
  approved_tournament_id UUID REFERENCES tournaments(id),

  name TEXT NOT NULL,
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  buy_in INTEGER NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'NLH',
  format TEXT NOT NULL DEFAULT 'Re-entry',
  table_size INTEGER NOT NULL DEFAULT 9,
  venue_name TEXT NOT NULL,
  guaranteed_prize INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_tournaments_created_by ON custom_tournaments(created_by);
CREATE INDEX idx_custom_tournaments_status ON custom_tournaments(status) WHERE status = 'pending';

-- RLS
ALTER TABLE custom_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own custom tournaments"
  ON custom_tournaments FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users insert own custom tournaments"
  ON custom_tournaments FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users update own custom tournaments"
  ON custom_tournaments FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users delete own custom tournaments"
  ON custom_tournaments FOR DELETE
  USING (auth.uid() = created_by);

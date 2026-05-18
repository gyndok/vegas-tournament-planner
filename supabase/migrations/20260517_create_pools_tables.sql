-- =====================================================================
-- Last Longer Pools — schema, indexes, RLS
-- =====================================================================

-- pool_members must exist BEFORE pools.winner_member_id FK is added.
-- The FK is added at the end of the file via ALTER TABLE.

-- ---------------------------------------------------------------------
-- pool_members (created first; pool_id FK added after pools exists)
-- ---------------------------------------------------------------------
CREATE TABLE pool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL,                                 -- FK added below
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  display_name TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,

  status TEXT NOT NULL DEFAULT 'alive'
    CHECK (status IN ('alive', 'busted', 'no_show')),
  busted_at TIMESTAMPTZ,
  current_chips BIGINT,

  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (pool_id, user_id)
);

CREATE INDEX idx_pool_members_pool ON pool_members(pool_id);
CREATE INDEX idx_pool_members_user ON pool_members(user_id);
CREATE INDEX idx_pool_members_alive ON pool_members(pool_id) WHERE status = 'alive';
CREATE INDEX idx_pool_members_busted ON pool_members(pool_id, busted_at) WHERE status = 'busted';

-- ---------------------------------------------------------------------
-- pools
-- ---------------------------------------------------------------------
CREATE TABLE pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  custom_tournament_id UUID REFERENCES custom_tournaments(id) ON DELETE SET NULL,
  pool_type TEXT NOT NULL DEFAULT 'official'
    CHECK (pool_type IN ('official', 'home_game')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'locked', 'live', 'ended', 'cancelled')),

  reentries_keep_alive BOOLEAN NOT NULL DEFAULT TRUE,
  start_after_reentry_period BOOLEAN NOT NULL DEFAULT FALSE,
  multiflight_out_rule TEXT NOT NULL DEFAULT 'last_flight'
    CHECK (multiflight_out_rule IN ('first_flight', 'last_flight')),

  invite_token TEXT NOT NULL UNIQUE,
  winner_member_id UUID,                                 -- FK added below
  ended_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pool_has_one_tournament CHECK (
    (tournament_id IS NOT NULL)::int + (custom_tournament_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT pool_type_matches_fk CHECK (
    (pool_type = 'official' AND tournament_id IS NOT NULL) OR
    (pool_type = 'home_game' AND custom_tournament_id IS NOT NULL)
  )
);

CREATE INDEX idx_pools_organizer ON pools(organizer_id);
CREATE INDEX idx_pools_tournament ON pools(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX idx_pools_invite_token ON pools(invite_token);

-- Now add the FKs that close the cycle.
ALTER TABLE pool_members
  ADD CONSTRAINT pool_members_pool_id_fkey
  FOREIGN KEY (pool_id) REFERENCES pools(id) ON DELETE CASCADE;

ALTER TABLE pools
  ADD CONSTRAINT pools_winner_member_id_fkey
  FOREIGN KEY (winner_member_id) REFERENCES pool_members(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- pool_audit_log
-- ---------------------------------------------------------------------
CREATE TABLE pool_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  member_id UUID REFERENCES pool_members(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'joined', 'verified', 'unverified', 'busted', 'unbusted', 'no_show',
    'pool_locked', 'pool_started', 'pool_ended', 'pool_cancelled',
    'winner_declared'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_pool ON pool_audit_log(pool_id, created_at DESC);

-- =====================================================================
-- RLS
-- =====================================================================

ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_audit_log ENABLE ROW LEVEL SECURITY;

-- A user is a member of a pool if they have a row in pool_members for that pool.
-- We use a helper function to keep policies readable and avoid recursion.
CREATE OR REPLACE FUNCTION is_pool_member(_pool_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM pool_members
    WHERE pool_id = _pool_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION is_pool_organizer(_pool_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM pools
    WHERE id = _pool_id AND organizer_id = _user_id
  );
$$;

-- ---- pools ----
CREATE POLICY "members read their pools" ON pools
  FOR SELECT USING (is_pool_member(id, auth.uid()));

CREATE POLICY "organizer writes pool" ON pools
  FOR UPDATE USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "anyone inserts as organizer" ON pools
  FOR INSERT WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "organizer deletes pool" ON pools
  FOR DELETE USING (organizer_id = auth.uid());

-- ---- pool_members ----
CREATE POLICY "members read fellow members" ON pool_members
  FOR SELECT USING (is_pool_member(pool_id, auth.uid()));

CREATE POLICY "self insert as member" ON pool_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "self update own status/chips/name" ON pool_members
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "organizer updates any member" ON pool_members
  FOR UPDATE USING (is_pool_organizer(pool_id, auth.uid()))
  WITH CHECK (is_pool_organizer(pool_id, auth.uid()));

CREATE POLICY "self or organizer deletes member" ON pool_members
  FOR DELETE USING (user_id = auth.uid() OR is_pool_organizer(pool_id, auth.uid()));

-- ---- pool_audit_log ----
-- All members can read; no client-side inserts (use service role).
CREATE POLICY "members read audit log" ON pool_audit_log
  FOR SELECT USING (is_pool_member(pool_id, auth.uid()));

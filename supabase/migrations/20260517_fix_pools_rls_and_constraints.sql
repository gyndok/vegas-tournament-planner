-- Corrections to 20260517_create_pools_tables.sql identified in code review.
-- See plan: docs/superpowers/plans/2026-05-17-last-longer-pools-plan.md Task 1.

-- (1) Make RLS helpers SECURITY DEFINER so their internal SELECT bypasses
-- the very RLS policy that called them. Without this, the pool_members
-- SELECT policy recurses infinitely.
CREATE OR REPLACE FUNCTION is_pool_member(_pool_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pool_members
    WHERE pool_id = _pool_id AND user_id = _user_id
  );
$$;
REVOKE EXECUTE ON FUNCTION is_pool_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_pool_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION is_pool_organizer(_pool_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pools
    WHERE id = _pool_id AND organizer_id = _user_id
  );
$$;
REVOKE EXECUTE ON FUNCTION is_pool_organizer(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_pool_organizer(UUID, UUID) TO authenticated;

-- (2) Allow the organizer to read their own pool even before they are
-- inserted into pool_members. The current policy filters them out.
DROP POLICY IF EXISTS "members read their pools" ON pools;
CREATE POLICY "members read their pools" ON pools
  FOR SELECT USING (is_pool_member(id, auth.uid()) OR organizer_id = auth.uid());

-- (3) Change tournament FKs from ON DELETE SET NULL to ON DELETE RESTRICT.
-- SET NULL would null out tournament_id on parent delete, which then
-- violates pool_type_matches_fk and errors out anyway. RESTRICT makes the
-- intent explicit: a tournament cannot be deleted while a pool references it.
ALTER TABLE pools DROP CONSTRAINT IF EXISTS pools_tournament_id_fkey;
ALTER TABLE pools
  ADD CONSTRAINT pools_tournament_id_fkey
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE RESTRICT;

ALTER TABLE pools DROP CONSTRAINT IF EXISTS pools_custom_tournament_id_fkey;
ALTER TABLE pools
  ADD CONSTRAINT pools_custom_tournament_id_fkey
  FOREIGN KEY (custom_tournament_id) REFERENCES custom_tournaments(id) ON DELETE RESTRICT;

-- (4) updated_at trigger on pools.
CREATE OR REPLACE FUNCTION pools_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pools_updated_at ON pools;
CREATE TRIGGER pools_updated_at
  BEFORE UPDATE ON pools
  FOR EACH ROW
  EXECUTE FUNCTION pools_set_updated_at();

-- (5) Non-negative current_chips.
ALTER TABLE pool_members
  ADD CONSTRAINT pool_members_current_chips_nonneg
  CHECK (current_chips IS NULL OR current_chips >= 0);

-- (6) Drop redundant index that duplicates the UNIQUE constraint.
DROP INDEX IF EXISTS idx_pools_invite_token;

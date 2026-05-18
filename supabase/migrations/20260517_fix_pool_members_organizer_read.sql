-- The original pool_members SELECT policy only allowed pool members to read
-- fellow members. Organizers who never joined their own pool were locked
-- out of their own leaderboard, declare-winner picker, and audit log.
-- This mirrors the fix we applied to the pools SELECT policy in
-- 20260517_fix_pools_rls_and_constraints.sql.

DROP POLICY IF EXISTS "members read fellow members" ON pool_members;
CREATE POLICY "members read fellow members" ON pool_members
  FOR SELECT USING (
    is_pool_member(pool_id, auth.uid())
    OR is_pool_organizer(pool_id, auth.uid())
  );

DROP POLICY IF EXISTS "members read audit log" ON pool_audit_log;
CREATE POLICY "members read audit log" ON pool_audit_log
  FOR SELECT USING (
    is_pool_member(pool_id, auth.uid())
    OR is_pool_organizer(pool_id, auth.uid())
  );

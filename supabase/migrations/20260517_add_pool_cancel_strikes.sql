-- Add a safety gate against transient scrape failures: a pool is only
-- auto-cancelled after its tournament has been missing from the scrape for
-- N consecutive runs (threshold defined in app code).
ALTER TABLE pools
  ADD COLUMN cancel_strikes INT NOT NULL DEFAULT 0,
  ADD COLUMN last_missing_at TIMESTAMPTZ;

COMMENT ON COLUMN pools.cancel_strikes IS
  'Consecutive scrape-monitor runs the underlying tournament was missing. Reset to 0 when it reappears. Triggers auto-cancel at threshold (see processPoolStrikes).';
COMMENT ON COLUMN pools.last_missing_at IS
  'Timestamp of the most recent run where the underlying tournament was missing.';

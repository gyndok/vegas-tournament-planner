-- Per-day rollup of AI Advisor (Anthropic) usage. One row per day. Used to
-- gate against a daily cost cap (CHAT_DAILY_COST_CAP_USD) and surface usage
-- in the admin dashboard.

CREATE TABLE chat_usage (
  date DATE PRIMARY KEY,
  request_count INT NOT NULL DEFAULT 0,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  cache_creation_input_tokens BIGINT NOT NULL DEFAULT 0,
  cache_read_input_tokens BIGINT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE chat_usage IS
  'Per-day rollup of AI Advisor (Anthropic) usage. One row per day. Used to gate against a daily cost cap and surface usage in the admin dashboard.';

ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;
-- No policies means no client access; service role bypasses RLS.

-- Atomic increment so concurrent chat requests don't lose updates. Service
-- role only; called from the /api/chat route after each Anthropic response.
CREATE OR REPLACE FUNCTION record_chat_usage(
  p_input_tokens BIGINT,
  p_output_tokens BIGINT,
  p_cache_creation BIGINT,
  p_cache_read BIGINT,
  p_cost_usd NUMERIC
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO chat_usage (
    date, request_count, input_tokens, output_tokens,
    cache_creation_input_tokens, cache_read_input_tokens, cost_usd, updated_at
  )
  VALUES (
    CURRENT_DATE, 1, p_input_tokens, p_output_tokens,
    p_cache_creation, p_cache_read, p_cost_usd, NOW()
  )
  ON CONFLICT (date) DO UPDATE SET
    request_count = chat_usage.request_count + 1,
    input_tokens = chat_usage.input_tokens + EXCLUDED.input_tokens,
    output_tokens = chat_usage.output_tokens + EXCLUDED.output_tokens,
    cache_creation_input_tokens = chat_usage.cache_creation_input_tokens + EXCLUDED.cache_creation_input_tokens,
    cache_read_input_tokens = chat_usage.cache_read_input_tokens + EXCLUDED.cache_read_input_tokens,
    cost_usd = chat_usage.cost_usd + EXCLUDED.cost_usd,
    updated_at = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION record_chat_usage FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_chat_usage TO service_role;

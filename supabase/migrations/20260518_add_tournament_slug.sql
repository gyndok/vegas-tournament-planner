-- Slug URLs for tournaments. Each tournament gets a stable URL-safe
-- identifier so /tournament/<slug> ranks better in search and shares
-- show a readable URL instead of a UUID.

CREATE OR REPLACE FUNCTION slugify(p_text TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(
    trim(both '-' from
      regexp_replace(
        regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g'),
        '-+', '-', 'g'
      )
    ),
    ''
  );
$$;

ALTER TABLE tournaments ADD COLUMN slug TEXT;

-- Backfill. Duplicate base slugs get a numeric suffix on all but the first.
WITH base AS (
  SELECT id, coalesce(slugify(name), 'event') || '-' || date::text AS base_slug
  FROM tournaments
),
ranked AS (
  SELECT id, base_slug,
    row_number() OVER (PARTITION BY base_slug ORDER BY id) AS rn
  FROM base
)
UPDATE tournaments t
SET slug = CASE WHEN r.rn = 1 THEN r.base_slug ELSE r.base_slug || '-' || r.rn::text END
FROM ranked r
WHERE t.id = r.id;

ALTER TABLE tournaments ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX tournaments_slug_idx ON tournaments(slug);

COMMENT ON COLUMN tournaments.slug IS
  'URL-safe identifier derived from name + date. Stable once assigned. Resolves at /tournament/<slug>. UUIDs still resolve and redirect to the slug.';

-- Trigger: derive a slug on insert when missing. We do NOT regenerate when
-- name or date is edited — slugs must stay stable to avoid breaking shared
-- links and Google's index. Admin can override by setting slug explicitly.
CREATE OR REPLACE FUNCTION ensure_tournament_slug() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base TEXT;
  v_candidate TEXT;
  v_n INT := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    v_base := coalesce(slugify(NEW.name), 'event') || '-' || NEW.date::text;
    v_candidate := v_base;
    WHILE EXISTS (SELECT 1 FROM tournaments WHERE slug = v_candidate AND id <> NEW.id) LOOP
      v_n := v_n + 1;
      v_candidate := v_base || '-' || v_n::text;
    END LOOP;
    NEW.slug := v_candidate;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournaments_ensure_slug
  BEFORE INSERT OR UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION ensure_tournament_slug();

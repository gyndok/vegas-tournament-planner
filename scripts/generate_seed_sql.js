#!/usr/bin/env node
// Generates supabase/seed.sql from wsop_2026_full_schedule.json

const fs = require('fs');
const path = require('path');

const data = require('./wsop_2026_full_schedule.json');

const SERIES_ID = 'a0000000-0000-0000-0000-000000000001';

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + str.replace(/'/g, "''") + "'";
}

let sql = `-- WSOP 2026 Seed Data
-- Generated from scripts/wsop_2026_full_schedule.json
-- ${data.length} tournaments across 100 bracelet events

-- Clear existing data (safe for dev/staging)
DELETE FROM user_schedule;
DELETE FROM tournaments;
DELETE FROM series;

-- Insert the 2026 WSOP series
INSERT INTO series (id, name, venue, start_date, end_date, website_url)
VALUES (
  '${SERIES_ID}',
  '2026 World Series of Poker',
  'Horseshoe & Paris Las Vegas',
  '2026-05-26',
  '2026-07-15',
  'https://www.wsop.com/tournaments/2026-57th-annual-world-series-of-poker/'
);

-- Insert all tournaments
INSERT INTO tournaments (
  series_id,
  event_number,
  name,
  date,
  day_of_week,
  start_time,
  buy_in,
  game_type,
  format,
  table_size,
  is_flight,
  flight_label,
  parent_event_number,
  notes
) VALUES
`;

const valueRows = data.map((t, i) => {
  const flightLabel = t.flight_label ? escapeSQL(t.flight_label) : 'NULL';
  const parentEvent = t.parent_event_number !== null ? t.parent_event_number : 'NULL';
  const notes = t.notes ? escapeSQL(t.notes) : 'NULL';

  return `(
  '${SERIES_ID}',
  ${t.event_number},
  ${escapeSQL(t.name)},
  '${t.date}',
  '${t.day_of_week}',
  '${t.start_time}',
  ${t.buy_in},
  ${escapeSQL(t.game_type)},
  ${escapeSQL(t.format)},
  ${t.table_size},
  ${t.is_flight},
  ${flightLabel},
  ${parentEvent},
  ${notes}
)`;
});

sql += valueRows.join(',\n');
sql += ';\n';

const outPath = path.join(__dirname, '..', 'supabase', 'seed.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Written ${data.length} tournament INSERTs to ${outPath}`);

// Imports wsop_2026_side_events_schedule.json into Supabase.
// Safe to re-run: aborts if the series already exists with tournaments attached,
// unless --overwrite is passed (in which case existing rows for the series are deleted first).
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const key = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];
const supabase = createClient("https://ecultkmiqtdwkbtixjbk.supabase.co", key);

// Side events are now stored under the unified "2026 World Series of Poker" series
// with event_category = 'side' (bracelets are 'bracelet'). The series row is
// pre-existing; this script only inserts/replaces the side-event tournament rows.
const WSOP_SERIES_ID = "a0000000-0000-0000-0000-000000000001";

const OVERWRITE = process.argv.includes("--overwrite");

function convertTime(t) {
  const parts = t.trim().split(" ");
  const tp = parts[0].split(":");
  let h = parseInt(tp[0]);
  const m = parseInt(tp[1]);
  const ampm = parts[1];
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":00";
}

async function run() {
  // 1) Verify the WSOP series exists, then count existing side events
  const { data: series, error: fe } = await supabase
    .from("series")
    .select("id, name")
    .eq("id", WSOP_SERIES_ID)
    .maybeSingle();
  if (fe) { console.error("Series lookup error:", fe.message); process.exit(1); }
  if (!series) { console.error(`WSOP series row ${WSOP_SERIES_ID} not found.`); process.exit(1); }

  const { count } = await supabase
    .from("tournaments")
    .select("*", { count: "exact", head: true })
    .eq("series_id", WSOP_SERIES_ID)
    .eq("event_category", "side");
  if (count && count > 0) {
    if (!OVERWRITE) {
      console.error(`WSOP already has ${count} side-event tournaments. Re-run with --overwrite to replace.`);
      process.exit(1);
    }
    const { error: de } = await supabase
      .from("tournaments")
      .delete()
      .eq("series_id", WSOP_SERIES_ID)
      .eq("event_category", "side");
    if (de) { console.error("Delete error:", de.message); process.exit(1); }
    console.log(`Deleted ${count} existing side-event tournaments for overwrite.`);
  }

  // 2) Load and map events
  const events = JSON.parse(fs.readFileSync("wsop_2026_side_events_schedule.json", "utf8")).events;
  const payload = events.map(t => ({
    series_id: WSOP_SERIES_ID,
    event_category: "side",
    event_number: parseInt(t.event_number) || 0,
    name: t.name,
    date: t.date,
    day_of_week: t.day_of_week || "",
    start_time: convertTime(t.start_time),
    buy_in: t.buy_in,
    game_type: t.game_type,
    format: t.format || "",
    table_size: 9,
    guaranteed_prize: t.guarantee || null,
    is_flight: t.is_flight || false,
    flight_label: t.flight_label || null,
    notes: t.notes || null
  }));

  // 3) Insert in chunks of 500 to avoid payload limits
  let inserted = 0;
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const { data, error } = await supabase.from("tournaments").insert(chunk).select("id");
    if (error) { console.error("Insert error:", error.message); process.exit(1); }
    inserted += data.length;
  }
  console.log("Inserted tournaments:", inserted);
}
run();

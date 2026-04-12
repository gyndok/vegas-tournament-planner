// Imports wsop_2026_side_events_schedule.json into Supabase.
// Safe to re-run: aborts if the series already exists with tournaments attached,
// unless --overwrite is passed (in which case existing rows for the series are deleted first).
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const key = fs.readFileSync(".env.local", "utf8").match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];
const supabase = createClient("https://ecultkmiqtdwkbtixjbk.supabase.co", key);

const SERIES_NAME = "2026 WSOP - Side Events";
const VENUE = "Horseshoe Las Vegas";
const START_DATE = "2026-05-26";
const END_DATE = "2026-07-14";
const WEBSITE = "https://www.wsop.com/tournaments/2026-57th-annual-world-series-of-poker/";

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
  // 1) Find or create series
  const { data: existing, error: fe } = await supabase
    .from("series")
    .select("id")
    .eq("name", SERIES_NAME)
    .maybeSingle();
  if (fe) { console.error("Series lookup error:", fe.message); process.exit(1); }

  let seriesId;
  if (existing) {
    seriesId = existing.id;
    const { count } = await supabase
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("series_id", seriesId);
    if (count && count > 0) {
      if (!OVERWRITE) {
        console.error(`Series "${SERIES_NAME}" already has ${count} tournaments. Re-run with --overwrite to replace.`);
        process.exit(1);
      }
      const { error: de } = await supabase.from("tournaments").delete().eq("series_id", seriesId);
      if (de) { console.error("Delete error:", de.message); process.exit(1); }
      console.log(`Deleted ${count} existing tournaments for overwrite.`);
    }
    console.log("Reusing existing series:", seriesId);
  } else {
    const { data: s, error: se } = await supabase.from("series").insert({
      name: SERIES_NAME,
      venue: VENUE,
      start_date: START_DATE,
      end_date: END_DATE,
      website_url: WEBSITE
    }).select("id").single();
    if (se) { console.error("Series create error:", se.message); process.exit(1); }
    seriesId = s.id;
    console.log("Created series:", seriesId);
  }

  // 2) Load and map events
  const events = JSON.parse(fs.readFileSync("wsop_2026_side_events_schedule.json", "utf8")).events;
  const payload = events.map(t => ({
    series_id: seriesId,
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

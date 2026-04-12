# WSOP 2026 Side Events Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the Supabase `tournaments` table with ~365 WSOP 2026 side event rows (daily deepstacks + mega satellites) under a new "2026 WSOP - Side Events" series.

**Architecture:** A Node.js generator builds a JSON schedule file from declarative rules (daily/weekly recurrences + one-off events), then a lightweight import script mirrors the existing `import_wsop.js` pattern to create the series and bulk-insert tournament rows.

**Tech Stack:** Node.js, `@supabase/supabase-js`, plain JSON files. Mirrors existing codebase conventions (no tests on import scripts — same as existing `import_wsop.js`, `import_wynn.js`, `import_pokergo.js`).

---

## File Structure

- **Create:** `generate_wsop_side_events_json.js` at repo root — Node.js script that emits the JSON file deterministically from recurrence rules
- **Create:** `wsop_2026_side_events_schedule.json` at repo root — data file produced by the generator (checked into git for auditability, same pattern as existing `wsop_circuit_schedule.json`)
- **Create:** `import_wsop_side_events.js` at repo root — import script modeled on `import_wsop.js`

Spec reference: `docs/superpowers/specs/2026-04-12-wsop-2026-side-events-design.md`

---

### Task 1: Create the JSON generator script

**Files:**
- Create: `generate_wsop_side_events_json.js`

- [ ] **Step 1: Create the generator file with helper utilities**

Create `generate_wsop_side_events_json.js`:

```js
// Generates wsop_2026_side_events_schedule.json from recurrence rules.
// Run with: node generate_wsop_side_events_json.js
const fs = require("fs");

const DISCLAIMER = "Projected from 2025 WSOP side events schedule - verify when WSOP publishes 2026 side events.";

const DAYS_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// Inclusive date range expander. Dates are YYYY-MM-DD.
function datesBetween(startIso, endIso, filterWeekday) {
  const out = [];
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay(); // 0=Sun..6=Sat
    if (filterWeekday != null && wd !== filterWeekday) continue;
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, day_of_week: DAYS_OF_WEEK[wd] });
  }
  return out;
}

function event(base) {
  // Ensure required fields have defaults
  return {
    event_number: null,
    format: "",
    guarantee: null,
    is_flight: false,
    flight_label: null,
    notes: DISCLAIMER,
    ...base,
    notes: (base.notes ? base.notes + " " : "") + DISCLAIMER
  };
}

const events = [];
```

- [ ] **Step 2: Add daily NLH deepstacks**

Append to `generate_wsop_side_events_json.js`:

```js
// Daily NLH Deepstacks — every day May 26 – Jul 14
for (const d of datesBetween("2026-05-26", "2026-07-14")) {
  events.push(event({
    name: "$250 No-Limit Hold'em Deepstack",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "1:00 PM", buy_in: 250, game_type: "NLH", format: "Deepstack"
  }));
  events.push(event({
    name: "$400 No-Limit Hold'em Deepstack (Accelerated)",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "4:00 PM", buy_in: 400, game_type: "NLH", format: "Deepstack - Accelerated"
  }));
  events.push(event({
    name: "$200 No-Limit Hold'em Deepstack (Accelerated)",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "8:00 PM", buy_in: 200, game_type: "NLH", format: "Deepstack - Accelerated"
  }));
}
```

- [ ] **Step 3: Add weekly deepstacks (HORSE, PLO, Seniors)**

Append:

```js
// HORSE Deepstack — Tuesdays Jun 2 – Jul 14 (weekday 2)
for (const d of datesBetween("2026-06-02", "2026-07-14", 2)) {
  events.push(event({
    name: "$250 H.O.R.S.E. Deepstack",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "3:00 PM", buy_in: 250, game_type: "HORSE", format: "Deepstack"
  }));
}

// PLO Deepstack — Wednesdays Jun 3 – Jul 8 (weekday 3)
for (const d of datesBetween("2026-06-03", "2026-07-08", 3)) {
  events.push(event({
    name: "$250 Pot-Limit Omaha Deepstack",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "3:00 PM", buy_in: 250, game_type: "PLO", format: "Deepstack"
  }));
}

// Seniors NLH Deepstack — Thursdays May 28 – Jul 9 (weekday 4)
for (const d of datesBetween("2026-05-28", "2026-07-09", 4)) {
  events.push(event({
    name: "$250 Seniors No-Limit Hold'em Deepstack",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "9:00 AM", buy_in: 250, game_type: "NLH", format: "Deepstack",
    notes: "Seniors only (50+)."
  }));
}

// Ladies Warm Up — June 23 (one-off)
events.push(event({
  name: "Ladies Warm Up No-Limit Hold'em",
  date: "2026-06-23", day_of_week: "Tuesday",
  start_time: "6:00 PM", buy_in: 1500, game_type: "NLH", format: "Tournament",
  notes: "Ladies discounted buy-in: $150. Open to all but marketed to women."
}));
```

- [ ] **Step 4: Add landmark mega satellites (Mystery Millions, Colossus, Gladiators, Daily)**

Append:

```js
// Mystery Millions Megas — May 26-29, $135 @ 12pm and $240 @ 4pm
for (const d of datesBetween("2026-05-26", "2026-05-29")) {
  events.push(event({
    name: "$135 Mystery Millions Mega Satellite",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "12:00 PM", buy_in: 135, game_type: "NLH", format: "Satellite",
    notes: "Net prize pool = multiples of $1,000 entries into Mystery Millions."
  }));
  events.push(event({
    name: "$240 Mystery Millions Mega Satellite",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "4:00 PM", buy_in: 240, game_type: "NLH", format: "Satellite",
    notes: "Net prize pool = multiples of $1,000 entries into Mystery Millions."
  }));
}

// Colossus Megas — Jun 2-5, $70 @ 12pm
for (const d of datesBetween("2026-06-02", "2026-06-05")) {
  events.push(event({
    name: "$70 Colossus Mega Satellite",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "12:00 PM", buy_in: 70, game_type: "NLH", format: "Satellite",
    notes: "Net prize pool = multiples of $500 entries into Colossus."
  }));
}

// Gladiators Megas — Jun 23-26, $50 @ 12pm
for (const d of datesBetween("2026-06-23", "2026-06-26")) {
  events.push(event({
    name: "$50 Gladiators of Poker Mega Satellite",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "12:00 PM", buy_in: 50, game_type: "NLH", format: "Satellite",
    notes: "Net prize pool = multiples of $300 entries into Gladiators of Poker."
  }));
}

// Daily Landmark Megas — May 26 – Jul 13, three times daily
for (const d of datesBetween("2026-05-26", "2026-07-13")) {
  events.push(event({
    name: "$240 Daily Landmark Mega Satellite",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "3:00 PM", buy_in: 240, game_type: "NLH", format: "Satellite",
    notes: "Net prize pool = multiples of $2,000 paid in casino value chips."
  }));
  events.push(event({
    name: "$580 Daily Landmark Mega Satellite",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "7:00 PM", buy_in: 580, game_type: "NLH", format: "Satellite",
    notes: "Net prize pool = multiples of $5,000 paid in casino value chips. $1,100 direct-entry option available for $10,000 chips."
  }));
  events.push(event({
    name: "$135 Daily Landmark Mega Satellite",
    date: d.date, day_of_week: d.day_of_week,
    start_time: "10:00 PM", buy_in: 135, game_type: "NLH", format: "Satellite",
    notes: "Net prize pool = multiples of $1,000 paid in casino value chips."
  }));
}
```

- [ ] **Step 5: Add specialty 7pm megas**

Append:

```js
// Specialty 7pm Megas — feed into next day's $5k/$10k bracelet event
// Entries dated 2026 (2025 dates shifted -1 day).
const SPECIALTY_7PM = [
  { date: "2026-05-26", dow: "Tuesday",    name: "$580 Specialty Mega — feeds $5K NLH 8-Handed",      buy_in: 580,   game: "NLH",          feed: "$5K NLH 8-Handed" },
  { date: "2026-05-27", dow: "Wednesday",  name: "$580 Specialty Mega — feeds $5K Pot-Limit Omaha",   buy_in: 580,   game: "PLO",          feed: "$5K Pot-Limit Omaha" },
  { date: "2026-05-29", dow: "Friday",     name: "$1,100 Specialty Mega — feeds $10K Omaha Hi-Lo 8",   buy_in: 1100,  game: "Omaha Hi-Lo",  feed: "$10K Omaha Hi-Lo 8 or Better" },
  { date: "2026-05-30", dow: "Saturday",   name: "$1,100 Specialty Mega — feeds $10K NLH (Mystery Bounty)", buy_in: 1100, game: "NLH",    feed: "$10K NLH (Mystery Bounty)" },
  { date: "2026-06-01", dow: "Monday",     name: "$1,100 Specialty Mega — feeds $10K Dealers Choice", buy_in: 1100,  game: "Dealers Choice", feed: "$10K Dealers Choice" },
  { date: "2026-06-04", dow: "Thursday",   name: "$1,100 Specialty Mega — feeds $10K Seven Card Stud", buy_in: 1100, game: "Seven Card Stud", feed: "$10K Seven Card Stud" },
  { date: "2026-06-06", dow: "Saturday",   name: "$1,100 Specialty Mega — feeds $10K NL 2-7 Lowball Draw", buy_in: 1100, game: "2-7 Lowball", feed: "$10K NL 2-7 Lowball Draw" },
  { date: "2026-06-08", dow: "Monday",     name: "$1,100 Specialty Mega — feeds $10K PLO Hi-Lo Split 8", buy_in: 1100, game: "PLO Hi-Lo", feed: "$10K Pot-Limit Omaha Hi-Lo 8 or Better" },
  { date: "2026-06-10", dow: "Wednesday",  name: "$1,100 Specialty Mega — feeds $10K Limit Hold'em",  buy_in: 1100,  game: "Limit Hold'em", feed: "$10K Limit Hold'em" },
  { date: "2026-06-12", dow: "Friday",     name: "$1,100 Specialty Mega — feeds $10K Big O",          buy_in: 1100,  game: "Big O",        feed: "$10K Big O" },
  { date: "2026-06-14", dow: "Sunday",     name: "$1,100 Specialty Mega — feeds $10K Razz",            buy_in: 1100,  game: "Razz",         feed: "$10K Razz" },
  { date: "2026-06-16", dow: "Tuesday",    name: "$1,100 Specialty Mega — feeds $10K H.O.R.S.E.",     buy_in: 1100,  game: "HORSE",        feed: "$10K H.O.R.S.E." },
  { date: "2026-06-21", dow: "Sunday",     name: "$580 Specialty Mega — feeds $5K NLH 6-Handed",      buy_in: 580,   game: "NLH",          feed: "$5K NLH 6-Handed" },
  { date: "2026-06-24", dow: "Wednesday",  name: "$1,100 Specialty Mega — feeds $10K 2-7 Triple Draw Lowball", buy_in: 1100, game: "2-7 Triple Draw", feed: "$10K 2-7 Triple Draw Lowball" },
  { date: "2026-06-25", dow: "Thursday",   name: "$1,100 Specialty Mega — feeds $10K NLH (Super Turbo Bounty)", buy_in: 1100, game: "NLH", feed: "$10K NLH (Super Turbo Bounty)" },
  { date: "2026-06-26", dow: "Friday",     name: "$1,100 Specialty Mega — feeds $10K Pot-Limit Omaha", buy_in: 1100, game: "PLO",          feed: "$10K Pot-Limit Omaha" },
  { date: "2026-06-28", dow: "Sunday",     name: "$1,100 Specialty Mega — feeds $10K Seven Card Stud Hi-Lo 8", buy_in: 1100, game: "Stud Hi-Lo", feed: "$10K Seven Card Stud Hi-Lo 8 or Better" },
  { date: "2026-06-30", dow: "Tuesday",    name: "$1,100 Specialty Mega — feeds $10K 8-Game Mixed",    buy_in: 1100, game: "8-Game Mixed", feed: "$10K 8-Game Mixed" },
  { date: "2026-07-06", dow: "Monday",     name: "$580 Specialty Mega — feeds $5K NLH (Super Turbo Bounty)", buy_in: 580, game: "NLH",    feed: "$5K NLH (Super Turbo Bounty)" },
  { date: "2026-07-10", dow: "Friday",     name: "$1,100 Specialty Mega — feeds $10K NLH 6-Handed",   buy_in: 1100, game: "NLH",          feed: "$10K NLH 6-Handed" },
  { date: "2026-07-13", dow: "Monday",     name: "$580 Specialty Mega — feeds $5K NLH 8-Handed",      buy_in: 580,   game: "NLH",          feed: "$5K NLH 8-Handed" },
];
for (const s of SPECIALTY_7PM) {
  events.push(event({
    name: s.name,
    date: s.date, day_of_week: s.dow,
    start_time: "7:00 PM", buy_in: s.buy_in, game_type: s.game, format: "Satellite - Specialty",
    notes: "Feeds into next day's " + s.feed + " bracelet event."
  }));
}
```

- [ ] **Step 6: Add high-roller megas**

Append:

```js
// High Roller Megas (specific dates, adapted -1 day)
const HR_MEGAS = [
  // $25K Heads-Up May 28
  { date: "2026-05-28", dow: "Thursday",   name: "$2,700 Heads-Up NLH Mega Satellite", buy_in: 2700, time: "6:00 PM", game: "NLH",      feed: "$25K Heads-Up NLH" },
  // $25K HR PLO/NLH May 31
  { date: "2026-05-31", dow: "Sunday",     name: "$2,700 High Roller PLO/NLH Mega Satellite", buy_in: 2700, time: "6:00 PM", game: "Mixed", feed: "$25K HR PLO/NLH" },
  // $25K HR 6-Handed NLH Jun 3
  { date: "2026-06-03", dow: "Wednesday",  name: "$2,700 High Roller 6-Handed NLH Mega Satellite", buy_in: 2700, time: "11:00 AM", game: "NLH", feed: "$25K HR 6-Handed NLH" },
  // $25K HR NLH Jun 5
  { date: "2026-06-05", dow: "Friday",     name: "$2,700 High Roller NLH Mega Satellite", buy_in: 2700, time: "6:00 PM", game: "NLH",    feed: "$25K HR NLH" },
  // $50K HR NLH Jun 7
  { date: "2026-06-07", dow: "Sunday",     name: "$625 High Roller NLH Mega Satellite (into 6pm Mega)", buy_in: 625, time: "3:00 PM", game: "NLH", feed: "$50K HR NLH (via 6pm mega)" },
  { date: "2026-06-07", dow: "Sunday",     name: "$5,300 High Roller NLH Landmark Mega Satellite", buy_in: 5300, time: "6:00 PM", game: "NLH", feed: "$50K HR NLH" },
  // $100K HR NLH Jun 9
  { date: "2026-06-09", dow: "Tuesday",    name: "$120 High Roller NLH Mega Satellite (into 3pm Mega)", buy_in: 120, time: "12:00 PM", game: "NLH", feed: "$100K HR NLH (via 3pm mega)" },
  { date: "2026-06-09", dow: "Tuesday",    name: "$850 High Roller NLH Mega Satellite (into 6pm Mega)", buy_in: 850, time: "3:00 PM", game: "NLH", feed: "$100K HR NLH (via 6pm mega)" },
  { date: "2026-06-09", dow: "Tuesday",    name: "$7,500 High Roller NLH Landmark Mega Satellite", buy_in: 7500, time: "6:00 PM", game: "NLH", feed: "$100K HR NLH" },
];
for (const s of HR_MEGAS) {
  events.push(event({
    name: s.name,
    date: s.date, day_of_week: s.dow,
    start_time: s.time, buy_in: s.buy_in, game_type: s.game, format: "Satellite - High Roller",
    notes: "Feeds into " + s.feed + "."
  }));
}
```

- [ ] **Step 7: Write the JSON file and emit summary**

Append:

```js
events.sort((a, b) => {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.start_time < b.start_time ? -1 : 1;
});

const out = {
  metadata: {
    series: "2026 WSOP - Side Events",
    venue: "Horseshoe Las Vegas",
    dates: "May 26 - July 14, 2026",
    source: DISCLAIMER,
    total_events: events.length,
    extracted_date: new Date().toISOString().slice(0, 10)
  },
  events
};

fs.writeFileSync("wsop_2026_side_events_schedule.json", JSON.stringify(out, null, 2));
console.log("Wrote wsop_2026_side_events_schedule.json with " + events.length + " events.");

// Sanity checks
const byFormat = {};
for (const e of events) byFormat[e.format] = (byFormat[e.format] || 0) + 1;
console.log("By format:", byFormat);
```

- [ ] **Step 8: Run the generator and verify counts**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && node generate_wsop_side_events_json.js`

Expected output: A line like `Wrote wsop_2026_side_events_schedule.json with 3XX events.` and a format breakdown. The total should be between 350 and 400. Approximate targets:

- Deepstack: ~171 (150 daily NLH + 7 HORSE + 6 PLO + 7 Seniors + 1 Ladies is actually "Tournament", not Deepstack; count is 150+7+6+7 = 170)
- Satellite: ~163 (8 Mystery Millions + 4 Colossus + 4 Gladiators + 147 Daily Landmark = 163)
- Satellite - Specialty: 21
- Satellite - High Roller: 9
- Tournament: 1 (Ladies Warm Up)

**Total expected ≈ 364.**

If the total is way off, inspect counts by format and fix the generator.

- [ ] **Step 9: Spot-check the JSON**

Run: `head -40 /Users/gyndok/Developer/vegas-tournament-planner/wsop_2026_side_events_schedule.json`

Verify: metadata block is present, first event has the projection disclaimer in notes, dates start at 2026-05-26.

Run: `grep -c '"date": "2026-05-26"' /Users/gyndok/Developer/vegas-tournament-planner/wsop_2026_side_events_schedule.json`

Expected: at least 7 events on opening day (3 daily NLH + Mystery Millions x2 + Daily Landmark x3 = 8).

- [ ] **Step 10: Commit**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner
git add generate_wsop_side_events_json.js wsop_2026_side_events_schedule.json
git commit -m "Add WSOP 2026 side events schedule generator and JSON

Generates ~365 side event rows (daily deepstacks + mega satellites)
projected from the 2025 schedule with dates shifted -1 day.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create the import script

**Files:**
- Create: `import_wsop_side_events.js`

- [ ] **Step 1: Write the import script**

Create `import_wsop_side_events.js` at repo root:

```js
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
    event_number: t.event_number || null,
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
```

- [ ] **Step 2: Dry-run by reading the script to double-check it uses the same Supabase URL as existing imports**

Run: `grep -h "ecultkmiqtdwkbtixjbk" /Users/gyndok/Developer/vegas-tournament-planner/import_wsop.js /Users/gyndok/Developer/vegas-tournament-planner/import_wsop_side_events.js`

Expected: both files reference the same URL `https://ecultkmiqtdwkbtixjbk.supabase.co`. If they don't match, fix `import_wsop_side_events.js`.

- [ ] **Step 3: Commit the import script**

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner
git add import_wsop_side_events.js
git commit -m "Add WSOP 2026 side events import script

Mirrors import_wsop.js pattern but creates/reuses the
'2026 WSOP - Side Events' series and supports --overwrite.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Run the import against Supabase

**Files:** (none modified — DB-only)

- [ ] **Step 1: Run the import**

Run: `cd /Users/gyndok/Developer/vegas-tournament-planner && node import_wsop_side_events.js`

Expected output:
```
Created series: <uuid>
Inserted tournaments: 364  (or whatever the generator's final count was)
```

If the script aborts with "already has N tournaments", re-run with:
`node import_wsop_side_events.js --overwrite`

- [ ] **Step 2: Verify in database via a quick query script**

Run:

```bash
cd /Users/gyndok/Developer/vegas-tournament-planner && node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const key = fs.readFileSync('.env.local','utf8').match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];
const sb = createClient('https://ecultkmiqtdwkbtixjbk.supabase.co', key);
(async () => {
  const { data: s } = await sb.from('series').select('id,name').eq('name','2026 WSOP - Side Events').single();
  const { count } = await sb.from('tournaments').select('*', { count: 'exact', head: true }).eq('series_id', s.id);
  console.log('Series:', s.name, s.id);
  console.log('Tournament count:', count);
  const { data: sample } = await sb.from('tournaments').select('name,date,start_time,buy_in,format').eq('series_id', s.id).order('date').limit(5);
  console.log('First 5:', JSON.stringify(sample, null, 2));
})();
"
```

Expected: Tournament count matches the generator output. First 5 sample rows are all dated 2026-05-26 and include the three daily NLH deepstacks.

---

### Task 4: Smoke-test in the app UI

**Files:** (none)

- [ ] **Step 1: Start the dev server**

Run (in a new terminal or with `run_in_background`): `cd /Users/gyndok/Developer/vegas-tournament-planner && npm run dev`

Wait for: `Ready in ...` log line.

- [ ] **Step 2: Open the browse page and filter to the new series**

Open `http://localhost:3000/browse` in a browser.

Verify:
- The "2026 WSOP - Side Events" series appears in any series filter / dropdown.
- Selecting a date like 2026-05-26 shows at least the 3 daily deepstacks + Mystery Millions mega satellites.
- Clicking a tournament shows the projection disclaimer in its notes.

If any of these fail: debug the specific issue (likely a UI filter that assumed one WSOP series only). Report findings rather than silently moving on.

- [ ] **Step 3: Stop the dev server**

Kill the `npm run dev` process.

---

## Summary

At the end of this plan:
- `generate_wsop_side_events_json.js` is checked in and reproducible.
- `wsop_2026_side_events_schedule.json` contains ~364 events.
- `import_wsop_side_events.js` can be re-run safely with `--overwrite`.
- The Supabase `tournaments` table has ~364 new rows tied to a new "2026 WSOP - Side Events" series at Horseshoe.
- Every row has a `notes` disclaimer so users know this is projected 2025 → 2026 data.
- The app UI surfaces the new events on the browse page.

When WSOP publishes the official 2026 side events, the generator's SPECIALTY_7PM / HR_MEGAS / date ranges can be edited and the import re-run with `--overwrite` to refresh the data.

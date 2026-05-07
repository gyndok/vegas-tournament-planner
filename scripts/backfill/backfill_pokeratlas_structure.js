// Backfill starting_stack and blind_levels_minutes for an existing series.
//
// Usage:
//   node scripts/backfill/backfill_pokeratlas_structure.js <series_id> <markdown_file> [--dry-run]
//
// The markdown file should be a Firecrawl scrape of a PokerAtlas
// "poker-tournament-series" page. Each event renders as a numbered block
// containing the date/time, buy-in, and "- N,NNN chips" / "- N min levels"
// detail lines. We parse those, match scraped events against DB rows by
// (date, start_time, buy_in), and UPDATE structure fields where missing.

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const positional = args.filter((a) => !a.startsWith("--"));
const SERIES_ID = positional[0];
const MARKDOWN_PATH = positional[1];
const YEAR = 2026;

if (!SERIES_ID || !MARKDOWN_PATH) {
  console.error("Usage: node backfill_pokeratlas_structure.js <series_id> <markdown_file> [--dry-run]");
  process.exit(1);
}

const key = fs
  .readFileSync(".env.local", "utf8")
  .match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1]
  .trim();
const supabase = createClient("https://ecultkmiqtdwkbtixjbk.supabase.co", key);

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function parseDate(raw) {
  // "May27" or "May 27"
  const m = raw.match(/^([A-Z][a-z]{2})\s*(\d{1,2})$/);
  if (!m) return null;
  const month = MONTHS[m[1]];
  const day = parseInt(m[2], 10);
  if (!month) return null;
  return `${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTime(raw) {
  // "10:00am" / "1:00pm"
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toLowerCase();
  if (ap === "pm" && h !== 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

function parseBuyIn(raw) {
  if (!raw) return null;
  const m = raw.replace(/[$,]/g, "").match(/^(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function parseBlocks(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^(\d{1,3})\.\s*\[/.test(lines[i])) starts.push(i);
  }
  for (let b = 0; b < starts.length; b++) {
    const start = starts[b];
    const end = b + 1 < starts.length ? starts[b + 1] : lines.length;
    const blockText = lines.slice(start, end).join("\n");
    const parsed = parseBlock(blockText);
    if (parsed) blocks.push(parsed);
  }
  return blocks;
}

function parseBlock(blockText) {
  // Date + day-of-week + time on the bracketed line:
  //   "01. [May27\\\n\\\nWednesday10:00am](url)"
  const linkMatch = blockText.match(
    /\d+\.\s*\[((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{1,2})[\s\\]*(?:\n[\s\\]*)*\w+?(\d{1,2}:\d{2}\s*(?:am|pm))\]/i
  );
  if (!linkMatch) return null;

  const date = parseDate(linkMatch[1].replace(/\s+/g, ""));
  const start_time = parseTime(linkMatch[2].replace(/\s+/g, ""));
  if (!date || !start_time) return null;

  // Buy-in: a standalone line "$300" or embedded in event-name like "$300 NLH ..."
  const buyInMatch = blockText.match(/(?:^|\n)\s*\$([\d,]+)(?:\s|$)/);
  const buy_in = buyInMatch ? parseBuyIn(buyInMatch[1]) : null;

  // Starting stack from "- 20,000 chips" or "- 50000 starting"
  const stackMatch = blockText.match(/-\s*([\d,]+)\s*(?:chips|starting)/i);
  const starting_stack = stackMatch ? parseInt(stackMatch[1].replace(/,/g, ""), 10) : null;

  // Blind level duration from "- 15 min levels" or "- 30-min"
  const blindsMatch = blockText.match(/-\s*(\d+)\s*[-]?\s*min/i);
  const blind_levels_minutes = blindsMatch ? parseInt(blindsMatch[1], 10) : null;

  return { date, start_time, buy_in, starting_stack, blind_levels_minutes };
}

async function run() {
  const md = fs.readFileSync(MARKDOWN_PATH, "utf8");
  const scraped = parseBlocks(md);
  console.log(`Parsed ${scraped.length} events from markdown.`);
  const withStructure = scraped.filter((s) => s.starting_stack || s.blind_levels_minutes);
  console.log(`  ${withStructure.length} have structure data (stack and/or blinds).`);

  const { data: dbRows, error } = await supabase
    .from("tournaments")
    .select("id, date, start_time, buy_in, starting_stack, blind_levels_minutes")
    .eq("series_id", SERIES_ID);
  if (error) {
    console.error("DB query error:", error.message);
    process.exit(1);
  }
  console.log(`Loaded ${dbRows.length} DB tournaments for series ${SERIES_ID}.`);

  // Index DB rows by composite key. There may be multiple (e.g., flights of the
  // same event), so use a list per key.
  const dbByKey = new Map();
  for (const r of dbRows) {
    const k = `${r.date}|${r.start_time}|${r.buy_in}`;
    const list = dbByKey.get(k) || [];
    list.push(r);
    dbByKey.set(k, list);
  }

  let matched = 0;
  let updates = 0;
  let alreadySet = 0;
  let scrapedUnmatched = 0;
  const updates_to_apply = [];

  for (const s of scraped) {
    if (!s.buy_in) continue;
    const k = `${s.date}|${s.start_time}|${s.buy_in}`;
    const candidates = dbByKey.get(k);
    if (!candidates || candidates.length === 0) {
      scrapedUnmatched++;
      continue;
    }
    matched += candidates.length;

    for (const c of candidates) {
      const update = {};
      if (s.starting_stack && c.starting_stack == null) update.starting_stack = s.starting_stack;
      if (s.blind_levels_minutes && c.blind_levels_minutes == null) update.blind_levels_minutes = s.blind_levels_minutes;
      if (Object.keys(update).length === 0) {
        if (c.starting_stack || c.blind_levels_minutes) alreadySet++;
        continue;
      }
      updates_to_apply.push({ id: c.id, ...update });
      updates++;
    }
  }

  console.log("\n--- MATCH REPORT ---");
  console.log(`Scraped events that matched a DB row:  ${matched}`);
  console.log(`Updates needed (will apply):           ${updates_to_apply.length}`);
  console.log(`Already had structure (skipped):       ${alreadySet}`);
  console.log(`Scraped events with no DB match:       ${scrapedUnmatched}`);
  console.log(`DB rows total:                          ${dbRows.length}`);

  if (DRY_RUN) {
    console.log("\nDry run — no writes performed. First 5 planned updates:");
    for (const u of updates_to_apply.slice(0, 5)) console.log("  ", u);
    return;
  }

  if (updates_to_apply.length === 0) {
    console.log("Nothing to update.");
    return;
  }

  // Apply updates one-by-one (Supabase doesn't bulk-update with different
  // values per row in a single call without an upsert pattern).
  let ok = 0,
    fail = 0;
  for (const u of updates_to_apply) {
    const { id, ...fields } = u;
    const { error: upErr } = await supabase.from("tournaments").update(fields).eq("id", id);
    if (upErr) {
      fail++;
      console.error(`  Update failed for ${id}:`, upErr.message);
    } else ok++;
  }
  console.log(`\nApplied ${ok} updates. ${fail} failures.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

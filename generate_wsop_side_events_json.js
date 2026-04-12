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

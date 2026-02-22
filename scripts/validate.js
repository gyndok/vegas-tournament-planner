const d = require('./wsop_2026_full_schedule.json');

// Check game type distribution
const gt = {};
d.forEach(t => { gt[t.game_type] = (gt[t.game_type]||0)+1; });
console.log('Game types:', gt);

// Check format distribution
const fmt = {};
d.forEach(t => { fmt[t.format] = (fmt[t.format]||0)+1; });
console.log('Formats:', fmt);

// Check table sizes
const ts = {};
d.forEach(t => { ts[t.table_size] = (ts[t.table_size]||0)+1; });
console.log('Table sizes:', ts);

// Check flights
const flights = d.filter(t => t.is_flight);
console.log('Flights:', flights.length);
console.log('Non-flights:', d.length - flights.length);

// Spot check specific events
const checks = [
  { ev: 7, label: 'Heads Up', expect: { game: 'NLH', size: 2 }},
  { ev: 14, label: 'Mixed PLO Hi-Lo', expect: { game: 'Mixed' }},
  { ev: 28, label: 'NLH/PLO Mixed', expect: { game: 'Mixed' }},
  { ev: 37, label: 'HORSE', expect: { game: 'Mixed' }},
  { ev: 42, label: 'Big O', expect: { game: 'Big O' }},
  { ev: 60, label: 'PPC', expect: { game: 'Mixed' }},
  { ev: 64, label: 'PLO/NLH Mixed', expect: { game: 'Mixed' }},
  { ev: 71, label: 'Mixed Big Bet 7-Handed', expect: { game: 'Mixed', size: 7 }},
  { ev: 77, label: 'Mixed Triple Draw', expect: { game: '2-7 Triple Draw' }},
  { ev: 83, label: 'Double Board Bomb Pot', expect: { game: 'PLO' }},
  { ev: 92, label: 'TORSE', expect: { game: 'Mixed' }},
  { ev: 30, label: 'Limit Holdem', expect: { game: "Limit Hold'em" }},
  { ev: 87, label: 'PLO Mystery Bounty', expect: { game: 'PLO', format: 'Mystery Bounty' }},
  { ev: 31, label: 'Super Turbo Bounty', expect: { format: 'Bounty' }},
  { ev: 44, label: 'Super Turbo Bounty 2', expect: { format: 'Bounty' }},
  { ev: 100, label: 'Super Turbo', expect: { format: 'Turbo' }},
  { ev: 8, label: 'Badugi', expect: { game: 'Badugi' }},
  { ev: 40, label: 'Razz', expect: { game: 'Razz' }},
  { ev: 9, label: 'Omaha Hi-Lo Championship', expect: { game: 'PLO8' }},
  { ev: 69, label: 'Stud Hi-Lo', expect: { game: 'Stud8' }},
  { ev: 6, label: 'Seven Card Stud', expect: { game: 'Stud' }},
  { ev: 12, label: '2-7 Draw', expect: { game: '2-7 Draw' }},
  { ev: 58, label: 'Limit 2-7 Triple Draw', expect: { game: '2-7 Triple Draw' }},
  { ev: 53, label: 'Five Card PLO', expect: { game: 'PLO' }},
  { ev: 91, label: 'Pick Your PLO', expect: { game: 'PLO' }},
  { ev: 10, label: 'Deepstack', expect: { format: 'Deepstack' }},
  { ev: 25, label: 'Freezeout', expect: { format: 'Freezeout' }},
  { ev: 1, label: 'Mystery Millions', expect: { format: 'Mystery Bounty' }},
  { ev: 51, label: 'Mystery Bounty', expect: { format: 'Mystery Bounty' }},
  { ev: 18, label: 'Monster Stack', expect: { format: 'Deepstack' }},
  { ev: 86, label: 'Ultra Stack', expect: { format: 'Deepstack' }},
  { ev: 24, label: '6-Handed HR', expect: { size: 6 }},
  { ev: 99, label: '8-Handed', expect: { size: 8 }},
  { ev: 74, label: '8-Game Mixed', expect: { game: 'Mixed' }},
  { ev: 52, label: 'Nine Game Mix', expect: { game: 'Mixed' }},
  { ev: 22, label: 'Big O Flight', expect: { game: 'Big O' }},
  { ev: 21, label: 'PLO Hi-Lo', expect: { game: 'PLO8' }},
  { ev: 33, label: 'PLO Hi-Lo Championship', expect: { game: 'PLO8' }},
  { ev: 45, label: 'Mixed Omaha/Stud Hi-Lo', expect: { game: 'Mixed' }},
];

let allOk = true;
for (const c of checks) {
  const t = d.find(x => x.event_number === c.ev && (x.is_flight === false || x.flight_label === 'Flight A'));
  if (!t) { console.log('NOT FOUND:', c.ev, c.label); allOk = false; continue; }
  let ok = true;
  if (c.expect.game && t.game_type !== c.expect.game) { ok = false; console.log('GAME MISMATCH:', c.label, 'expected', c.expect.game, 'got', t.game_type); }
  if (c.expect.size && t.table_size !== c.expect.size) { ok = false; console.log('SIZE MISMATCH:', c.label, 'expected', c.expect.size, 'got', t.table_size); }
  if (c.expect.format && t.format !== c.expect.format) { ok = false; console.log('FORMAT MISMATCH:', c.label, 'expected', c.expect.format, 'got', t.format); }
  if (ok) console.log('OK:', c.label);
  else allOk = false;
}

if (allOk) console.log('\nAll checks passed!');
else console.log('\nSome checks failed!');

// Check date range
const dates = d.map(t => t.date).sort();
console.log('Date range:', dates[0], 'to', dates[dates.length-1]);

// Check unique event numbers
const uniqueEvents = [...new Set(d.map(t => t.event_number))];
console.log('Unique event numbers:', uniqueEvents.length, '(1 to', Math.max(...uniqueEvents) + ')');

#!/usr/bin/env node
// Generates wsop_2026_full_schedule.json from raw tournament data

const rawData = `May 26 12:00PM Event#1 $550 No-Limit Hold'em Mini Mystery Millions - Flight A
May 26 02:00PM Event#2 $5,000 No-Limit Hold'em 8-Handed
May 27 10:00AM Event#1 $550 No-Limit Hold'em Mini Mystery Millions - Flight B
May 27 12:00PM Event#3 $500 No-Limit Hold'em Employees
May 27 02:00PM Event#4 $1,500 Omaha Hi-Lo 8 or Better
May 28 10:00AM Event#1 $550 No-Limit Hold'em Mini Mystery Millions - Flight C
May 28 12:00PM Event#5 $5,000 Pot-Limit Omaha
May 28 02:00PM Event#6 $1,500 Seven Card Stud
May 29 10:00AM Event#1 $550 No-Limit Hold'em Mini Mystery Millions - Flight D
May 29 12:00PM Event#7 $25,000 No-Limit Hold'em Heads Up Championship - Flight A
May 29 02:00PM Event#8 $1,500 Badugi
May 30 10:00AM Event#1 $550 No-Limit Hold'em Mini Mystery Millions - Flight E
May 30 12:00PM Event#7 $25,000 No-Limit Hold'em Heads Up Championship - Flight B
May 30 02:00PM Event#9 $10,000 Omaha Hi-Lo 8 or Better Championship
May 30 06:00PM Event#1 $550 No-Limit Hold'em Mini Mystery Millions - Flight F
May 31 10:00AM Event#10 $600 No-Limit Hold'em Deepstack
May 31 10:00AM Event#11 $10,000 GGMillion$ No-Limit Hold'em High Roller - Flight A
May 31 02:00PM Event#12 $1,500 No-Limit 2-7 Lowball Draw
Jun 01 10:00AM Event#13 $1,500 No-Limit Hold'em 6-Handed
Jun 01 12:00PM Event#11 $10,000 GGMillion$ No-Limit Hold'em High Roller - Flight B
Jun 01 02:00PM Event#14 $1,500 Mixed: PLO Hi-Lo 8 or Better, Omaha Hi-Lo 8 or Better, Big O
Jun 02 10:00AM Event#15 $600 Pot-Limit Omaha Deepstack
Jun 02 12:00PM Event#16 $1,700 No-Limit Hold'em U.S. WSOP Circuit Championship
Jun 02 02:00PM Event#17 $10,000 No-Limit 2-7 Lowball Draw Championship
Jun 03 10:00AM Event#18 $1,500 No-Limit Hold'em Monster Stack - Flight A
Jun 03 12:00PM Event#19 $25,000 No-Limit Hold'em High Roller - Flight A
Jun 03 02:00PM Event#20 $1,500 Dealers Choice
Jun 04 10:00AM Event#18 $1,500 No-Limit Hold'em Monster Stack - Flight B
Jun 04 12:00PM Event#19 $25,000 No-Limit Hold'em High Roller - Flight B
Jun 04 02:00PM Event#21 $1,500 Pot-Limit Omaha Hi-Lo 8 or Better
Jun 05 10:00AM Event#18 $1,500 No-Limit Hold'em Monster Stack - Flight C
Jun 05 12:00PM Event#22 $1,500 Big O - Flight A
Jun 05 02:00PM Event#23 $10,000 Seven Card Stud Championship
Jun 06 10:00AM Event#18 $1,500 No-Limit Hold'em Monster Stack - Flight D
Jun 06 12:00PM Event#24 $25,000 No-Limit Hold'em High Roller 6-Handed
Jun 06 02:00PM Event#22 $1,500 Big O - Flight B
Jun 07 10:00AM Event#25 $500 No-Limit Hold'em Freezeout
Jun 07 12:00PM Event#26 $2,000 No-Limit Hold'em
Jun 07 02:00PM Event#27 $10,000 Dealers Choice Championship
Jun 08 10:00AM Event#28 $600 No-Limit Hold'em/Pot-Limit Omaha Mixed Deepstack
Jun 08 12:00PM Event#29 $50,000 No-Limit Hold'em High Roller
Jun 08 02:00PM Event#30 $1,500 Limit Hold'em
Jun 09 10:00AM Event#31 $1,500 No-Limit Hold'em Super Turbo Bounty
Jun 09 12:00PM Event#32 $3,000 No-Limit Hold'em
Jun 09 02:00PM Event#33 $10,000 Pot-Limit Omaha Hi-Lo 8 or Better Championship
Jun 10 10:00AM Event#34 $500 No-Limit Hold'em Colossus - Flight A
Jun 10 12:00PM Event#35 $1,500 Pot-Limit Omaha - Flight A
Jun 10 01:00PM Event#36 $100,000 No-Limit Hold'em High Roller
Jun 10 02:00PM Event#37 $1,500 HORSE
Jun 11 10:00AM Event#34 $500 No-Limit Hold'em Colossus - Flight B
Jun 11 12:00PM Event#35 $1,500 Pot-Limit Omaha - Flight B
Jun 11 02:00PM Event#38 $10,000 Limit Hold'em Championship
Jun 12 10:00AM Event#34 $500 No-Limit Hold'em Colossus - Flight C
Jun 12 12:00PM Event#39 $5,000 No-Limit Hold'em Seniors High Roller
Jun 12 02:00PM Event#40 $1,500 Razz
Jun 13 10:00AM Event#34 $500 No-Limit Hold'em Colossus - Flight D
Jun 13 12:00PM Event#41 $250,000 No-Limit Hold'em Super High Roller
Jun 13 02:00PM Event#42 $10,000 Big O Championship
Jun 14 10:00AM Event#43 $800 No-Limit Hold'em Deepstack 8-Handed
Jun 14 12:00PM Event#44 $10,000 No-Limit Hold'em Super Turbo Bounty
Jun 14 02:00PM Event#45 $2,500 Mixed Omaha Hi-Lo 8 or Better, Seven Card Stud Hi-Lo 8 or Better
Jun 15 10:00AM Event#46 $1,000 No-Limit Hold'em Seniors Championship - Flight A
Jun 15 12:00PM Event#47 $25,000 Pot-Limit Omaha High Roller - Flight A
Jun 15 02:00PM Event#48 $10,000 Razz Championship
Jun 16 10:00AM Event#46 $1,000 No-Limit Hold'em Seniors Championship - Flight B
Jun 16 12:00PM Event#47 $25,000 Pot-Limit Omaha High Roller - Flight B
Jun 16 02:00PM Event#49 $2,500 No-Limit Hold'em Freezeout
Jun 17 10:00AM Event#50 $1,500 No-Limit Hold'em Millionaire Maker - Flight A
Jun 17 12:00PM Event#51 $10,000 No-Limit Hold'em Mystery Bounty
Jun 17 02:00PM Event#52 $3,000 Nine Game Mix
Jun 18 10:00AM Event#50 $1,500 No-Limit Hold'em Millionaire Maker - Flight B
Jun 18 12:00PM Event#53 $1,500 Five Card Pot-Limit Omaha
Jun 18 02:00PM Event#54 $10,000 HORSE Championship
Jun 19 10:00AM Event#50 $1,500 No-Limit Hold'em Millionaire Maker - Flight C
Jun 19 12:00PM Event#55 $50,000 Pot-Limit Omaha High Roller
Jun 19 02:00PM Event#56 $3,000 No-Limit Hold'em 6-Handed
Jun 20 10:00AM Event#50 $1,500 No-Limit Hold'em Millionaire Maker - Flight D
Jun 20 12:00PM Event#57 $1,000 Pot-Limit Omaha - Flight A
Jun 20 02:00PM Event#58 $1,500 Limit 2-7 Lowball Triple Draw
Jun 21 10:00AM Event#59 $500 No-Limit Hold'em Salute To Warriors
Jun 21 12:00PM Event#57 $1,000 Pot-Limit Omaha - Flight B
Jun 21 02:00PM Event#60 $50,000 Poker Players Championship
Jun 22 10:00AM Event#61 $1,000 No-Limit Hold'em Super Seniors
Jun 22 12:00PM Event#57 $1,000 Pot-Limit Omaha - Flight C
Jun 22 02:00PM Event#62 $2,500 No-Limit Hold'em
Jun 23 10:00AM Event#63 $1,000 No-Limit Hold'em Mystery Millions - Flight A
Jun 23 12:00PM Event#64 $25,000 PLO/NLH Mixed High Roller
Jun 23 02:00PM Event#65 $1,500 No-Limit Hold'em Freezeout
Jun 24 10:00AM Event#63 $1,000 No-Limit Hold'em Mystery Millions - Flight B
Jun 24 12:00PM Event#66 $1,000 No-Limit Hold'em Tag Team
Jun 24 02:00PM Event#67 $10,000 Limit 2-7 Lowball Triple Draw Championship
Jun 25 10:00AM Event#63 $1,000 No-Limit Hold'em Mystery Millions - Flight C
Jun 25 12:00PM Event#68 $1,000 No-Limit Hold'em Ladies Championship
Jun 25 02:00PM Event#69 $1,500 Seven Card Stud Hi-Lo 8 or Better
Jun 26 10:00AM Event#63 $1,000 No-Limit Hold'em Mystery Millions - Flight D
Jun 26 02:00PM Event#70 $10,000 Pot-Limit Omaha Championship
Jun 27 10:00AM Event#63 $1,000 No-Limit Hold'em Mystery Millions - Flight E
Jun 27 02:00PM Event#71 $2,500 Mixed Big Bet 7-Handed
Jun 27 06:00PM Event#63 $1,000 No-Limit Hold'em Mystery Millions - Flight F
Jun 28 10:00AM Event#72 $1,000 No-Limit Hold'em Mini Main Event - Flight A
Jun 28 12:00PM Event#73 $5,000 No-Limit Hold'em 6-Handed
Jun 28 02:00PM Event#74 $1,500 8-Game Mixed
Jun 29 10:00AM Event#72 $1,000 No-Limit Hold'em Mini Main Event - Flight B
Jun 29 02:00PM Event#75 $10,000 Seven Card Stud Hi-Lo 8 or Better Championship
Jun 30 10:00AM Event#72 $1,000 No-Limit Hold'em Mini Main Event - Flight C
Jun 30 12:00PM Event#76 $100,000 Pot-Limit Omaha High Roller
Jun 30 02:00PM Event#77 $2,500 Mixed Triple Draw Lowball
Jul 01 10:00AM Event#78 $600 No-Limit Hold'em Deepstack Championship
Jul 01 12:00PM Event#79 $3,000 No-Limit Hold'em Freezeout
Jul 01 02:00PM Event#80 $10,000 8-Game Mixed Championship
Jul 02 10:00AM Event#81 $800 No-Limit Hold'em Summer Celebration - Flight A
Jul 02 11:00AM Event#82 $10,000 WSOP No-Limit Hold'em Main Event - Flight A
Jul 02 02:00PM Event#83 $1,500 Pot-Limit Omaha Double Board Bomb Pot
Jul 03 10:00AM Event#81 $800 No-Limit Hold'em Summer Celebration - Flight B
Jul 03 11:00AM Event#82 $10,000 WSOP No-Limit Hold'em Main Event - Flight B
Jul 03 02:00PM Event#84 $5,000 No-Limit Hold'em Super Turbo Bounty
Jul 04 10:00AM Event#85 $1,000 No-Limit Hold'em
Jul 04 11:00AM Event#82 $10,000 WSOP No-Limit Hold'em Main Event - Flight C
Jul 05 10:00AM Event#86 $600 No-Limit Hold'em Ultra Stack - Flight A
Jul 05 11:00AM Event#82 $10,000 WSOP No-Limit Hold'em Main Event - Flight D
Jul 06 10:00AM Event#86 $600 No-Limit Hold'em Ultra Stack - Flight B
Jul 07 10:00AM Event#86 $600 No-Limit Hold'em Ultra Stack - Flight C
Jul 07 02:00PM Event#87 $1,000 Pot-Limit Omaha Mystery Bounty - Flight A
Jul 08 10:00AM Event#88 $300 No-Limit Hold'em Gladiators of Poker - Flight A
Jul 08 12:00PM Event#89 $3,000 No-Limit Hold'em Mid-Stakes Championship - Flight A
Jul 08 02:00PM Event#87 $1,000 Pot-Limit Omaha Mystery Bounty - Flight B
Jul 09 10:00AM Event#88 $300 No-Limit Hold'em Gladiators of Poker - Flight B
Jul 09 12:00PM Event#89 $3,000 No-Limit Hold'em Mid-Stakes Championship - Flight B
Jul 09 01:00PM Event#90 $50,000 No-Limit Hold'em High Roller
Jul 09 02:00PM Event#91 $1,500 Pick Your PLO
Jul 10 10:00AM Event#88 $300 No-Limit Hold'em Gladiators of Poker - Flight C
Jul 10 12:00PM Event#89 $3,000 No-Limit Hold'em Mid-Stakes Championship - Flight C
Jul 10 02:00PM Event#92 $3,000 TORSE
Jul 11 10:00AM Event#88 $300 No-Limit Hold'em Gladiators of Poker - Flight D
Jul 11 12:00PM Event#93 $1,500 No-Limit Hold'em The Closer - Flight A
Jul 11 02:00PM Event#94 $10,000 No-Limit Hold'em 6-Handed Championship
Jul 12 10:00AM Event#95 $500 No-Limit Hold'em Summer Saver - Flight A
Jul 12 12:00PM Event#93 $1,500 No-Limit Hold'em The Closer - Flight B
Jul 12 02:00PM Event#96 $3,000 Pot-Limit Omaha 6-Handed
Jul 13 10:00AM Event#95 $500 No-Limit Hold'em Summer Saver - Flight B
Jul 13 02:00PM Event#97 $25,000 HORSE High Roller
Jul 14 10:00AM Event#98 $800 No-Limit Hold'em Deepstack
Jul 14 02:00PM Event#99 $5,000 No-Limit Hold'em 8-Handed
Jul 15 10:00AM Event#100 $1,000 No-Limit Hold'em Super Turbo`;

const lines = rawData.trim().split('\n');
const monthMap = { 'May': '05', 'Jun': '06', 'Jul': '07' };
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseTime(timeStr) {
  // e.g. "12:00PM" -> "12:00:00", "02:00PM" -> "14:00:00", "10:00AM" -> "10:00:00"
  const match = timeStr.match(/^(\d{2}):(\d{2})(AM|PM)$/);
  if (!match) throw new Error('Bad time: ' + timeStr);
  let h = parseInt(match[1]);
  const m = match[2];
  const ampm = match[3];
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + m + ':00';
}

function getGameType(name) {
  // Order matters: check more specific patterns first

  // Mixed/multi-game formats first (before component game checks)
  if (/PLO\/NLH Mixed/i.test(name)) return 'Mixed';
  if (/No-Limit Hold'em\/Pot-Limit Omaha Mixed/i.test(name)) return 'Mixed';
  if (/HORSE/i.test(name)) return 'Mixed';
  if (/TORSE/i.test(name)) return 'Mixed';
  if (/Dealers Choice/i.test(name) || /Dealer's Choice/i.test(name)) return 'Mixed';
  if (/Nine Game Mix/i.test(name)) return 'Mixed';
  if (/8-Game Mixed/i.test(name)) return 'Mixed';
  if (/Mixed Big Bet/i.test(name)) return 'Mixed';
  if (/Mixed Triple Draw/i.test(name)) return '2-7 Triple Draw';
  if (/Mixed.*Omaha Hi-Lo/i.test(name)) return 'Mixed';
  if (/Mixed.*PLO Hi-Lo/i.test(name)) return 'Mixed';
  if (/Poker Players Championship/i.test(name)) return 'Mixed';

  // Hi-Lo variants (before base game checks)
  if (/Omaha Hi-Lo/i.test(name)) return 'PLO8';
  if (/PLO Hi-Lo/i.test(name)) return 'PLO8';
  if (/Pot-Limit Omaha Hi-Lo/i.test(name)) return 'PLO8';

  // Stud variants
  if (/Seven Card Stud Hi-Lo/i.test(name)) return 'Stud8';
  if (/Seven Card Stud/i.test(name)) return 'Stud';

  // Draw games
  if (/Limit 2-7 Lowball Triple Draw/i.test(name)) return '2-7 Triple Draw';
  if (/2-7 Lowball Draw/i.test(name)) return '2-7 Draw';
  if (/2-7 Draw/i.test(name)) return '2-7 Draw';

  // Big O (before PLO check)
  if (/\bBig O\b/i.test(name)) return 'Big O';

  // PLO variants
  if (/Pick Your PLO/i.test(name)) return 'PLO';
  if (/Five Card Pot-Limit Omaha/i.test(name)) return 'PLO';
  if (/Double Board Bomb Pot/i.test(name)) return 'PLO';
  if (/Pot-Limit Omaha/i.test(name)) return 'PLO';

  // Other games
  if (/Razz/i.test(name)) return 'Razz';
  if (/Badugi/i.test(name)) return 'Badugi';
  if (/Limit Hold'em/i.test(name) && !/No-Limit/i.test(name)) return 'Limit Hold\'em';

  // NLH (most common, check last among hold'em)
  if (/No-Limit Hold'em/i.test(name) || /\bNLH\b/i.test(name)) return 'NLH';

  throw new Error('Unknown game type: ' + name);
}

function getFormat(name) {
  // Mystery Bounty / Mystery Millions first
  if (/Mystery Millions/i.test(name)) return 'Mystery Bounty';
  if (/Mystery Bounty/i.test(name)) return 'Mystery Bounty';

  // Super Turbo Bounty -> Bounty
  if (/Super Turbo Bounty/i.test(name)) return 'Bounty';

  // Other bounty
  if (/Bounty/i.test(name)) return 'Bounty';

  // Freezeout
  if (/Freezeout/i.test(name)) return 'Freezeout';

  // Stack variants -> Deepstack
  if (/Deepstack/i.test(name) || /Deep Stack/i.test(name)) return 'Deepstack';
  if (/Monster Stack/i.test(name)) return 'Deepstack';
  if (/Ultra Stack/i.test(name)) return 'Deepstack';

  // Turbo (but not "Super Turbo Bounty" which was caught above)
  if (/Super Turbo/i.test(name) || /Turbo/i.test(name)) return 'Turbo';

  return 'Re-entry';
}

function getTableSize(name) {
  if (/Heads Up/i.test(name)) return 2;
  if (/6-Handed/i.test(name) || /6-Max/i.test(name)) return 6;
  if (/7-Handed/i.test(name)) return 7;
  if (/8-Handed/i.test(name)) return 8;
  return 9;
}

function getFlight(name) {
  const match = name.match(/Flight ([A-F])/i);
  if (match) {
    return { is_flight: true, flight_label: 'Flight ' + match[1] };
  }
  return { is_flight: false, flight_label: null };
}

const tournaments = [];

for (const line of lines) {
  // Parse: "May 26 12:00PM Event#1 $550 No-Limit Hold'em Mini Mystery Millions - Flight A"
  const regex = /^(\w+) (\d+) (\d{2}:\d{2}(?:AM|PM)) Event#(\d+) \$([0-9,]+) (.+)$/;
  const m = line.match(regex);
  if (!m) {
    console.error('FAILED TO PARSE:', line);
    continue;
  }

  const month = monthMap[m[1]];
  const day = m[2].padStart(2, '0');
  const dateStr = `2026-${month}-${day}`;
  const timeStr = parseTime(m[3]);
  const eventNum = parseInt(m[4]);
  const buyIn = parseInt(m[5].replace(/,/g, ''));
  const tournamentName = m[6];

  const dt = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = dayNames[dt.getUTCDay()];

  const flight = getFlight(tournamentName);

  const fullName = `WSOP Event #${eventNum}: $${buyIn.toLocaleString()} ${tournamentName}`;

  const entry = {
    event_number: eventNum,
    name: fullName,
    date: dateStr,
    day_of_week: dayOfWeek,
    start_time: timeStr,
    buy_in: buyIn,
    game_type: getGameType(tournamentName),
    format: getFormat(tournamentName),
    table_size: getTableSize(tournamentName),
    is_flight: flight.is_flight,
    flight_label: flight.flight_label,
    parent_event_number: flight.is_flight ? eventNum : null,
    notes: null
  };

  tournaments.push(entry);
}

console.log(JSON.stringify(tournaments, null, 2));
console.error(`\nTotal: ${tournaments.length} tournaments`);

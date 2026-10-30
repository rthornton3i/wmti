// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// Gamer mini games (F101b): the pure rules of the short games, original designs (the Arcade's light games, Money
// Sudoku, Grow It, Bigger Pile and Prize Wheel, are at the end). No DOM and no clock; the app
// (52-games.js) draws the screens and passes a seed. Every game is three rounds; stars are the rounds answered right,
// at least 1 for finishing. Numbers come from the fixed law data in appInfo (`law`), from the person's benefitTables
// rows, or are generic and static here; no other user data enters a game. Runs in Node for the tests.
(function (root) {
  "use strict";

  const ROUNDS = 3;
  const NOT_ADVICE = "Illustrative, not advice.";
  const GAMES = [
    { id: "bracket", title: "Bracket Climber",
      remember: "Only the dollars inside a bracket pay its rate; your average rate stays below your top rate." },
    { id: "claim", title: "Claim Age Showdown",
      remember: "Claiming later pays more each month; it catches up only if you live past the break-even age." },
    { id: "receipts", title: "Receipt Sort",
      remember: "Each tax-favored account pays for its own kind of cost; the rest comes from regular money." },
    { id: "decade", title: "The Bad Decade",
      remember: "The same returns in a different order can end far apart once you are withdrawing." },
    { id: "seesaw", title: "Drift Seesaw",
      remember: "Rebalancing sells what grew and buys what lagged, so your risk stays where you chose it." },
    { id: "leaks", title: "Plug the Leaks",
      remember: "A small yearly fee is a large share of what you keep after decades; the biggest drips matter most." },
    { id: "snowball", title: "Early Bird Snowball",
      remember: "Time in the market does more than the amount: starting earlier can beat saving double later." },
    { id: "sudoku", title: "Money Sudoku",
      remember: "Like a budget, every bill has one place: fill the sure squares first and the rest follow." },
    { id: "grow", title: "Grow It",
      remember: "Growth compounds: at 7% a year money roughly doubles every 10 years (72 divided by the rate)." },
    { id: "bigger", title: "Bigger Pile",
      remember: "Compare money at the same point in time: growth and timing can beat a bigger headline number." },
    { id: "wheel", title: "Prize Wheel",
      remember: "A spin is luck; a plan is not. The stars here are just for fun." },
  ];
  const GAME_IDS = GAMES.map((game) => game.id);

  // A small seeded random number generator (mulberry32): the same seed gives the same rounds.
  function rng(seed) {
    let state = (Number(seed) >>> 0) || 1;
    return function next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let mixed = state;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(random, list) {
    return list[Math.floor(random() * list.length)];
  }

  function shuffled(random, list) {
    const copy = list.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  const roundTo = (value, step) => Math.round(value / step) * step;

  // Stars for a finished game: the rounds answered right (an array of booleans or a count), at least 1, at most 3.
  function starsOf(results) {
    const right = Array.isArray(results) ? results.filter(Boolean).length : Number(results) || 0;
    return Math.max(1, Math.min(ROUNDS, right));
  }

  // ---- Bracket Climber (marginal versus average tax) ----
  // `brackets` are appInfo().law.brackets[key]: ascending {rate, from, to}, the last `to` null.

  function bracketAt(brackets, income) {
    const taxable = Math.max(0, Number(income) || 0);
    let tax = 0;
    let marginal = brackets[0].rate;
    for (const row of brackets) {
      if (taxable < row.from) break;
      const top = row.to === null ? taxable : Math.min(taxable, row.to);
      tax += (top - row.from) * row.rate;
      if (row.to === null || taxable < row.to) {
        marginal = row.rate;
        break;
      }
    }
    return { tax, marginal, average: taxable > 0 ? tax / taxable : 0 };
  }

  // An income on a $1,000 step inside a bracket that leaves the next $1,000 in the same bracket.
  function incomeInside(random, row) {
    const low = Math.ceil(row.from / 1000) * 1000;
    const high = Math.floor((row.to === null ? row.from * 2 + 50000 : row.to) / 1000) * 1000 - 1000;
    return low + 1000 * Math.floor(random() * (Math.max(0, high - low) / 1000 + 1));
  }

  function bracketRounds(law, key, seed) {
    const brackets = law.brackets[key];
    const random = rng(seed);
    const rates = brackets.map((row) => row.rate);
    const nextRow = brackets[Math.floor(random() * Math.max(1, brackets.length - 1))];
    const nextIncome = incomeInside(random, nextRow);
    const second = brackets[Math.min(1, brackets.length - 1)];
    const target = roundTo(second.from + (((second.to === null ? second.from * 2 : second.to) - second.from)
      * (0.25 + random() * 0.5)), 1000);
    const averageRow = brackets[Math.min(brackets.length - 1, 2 + Math.floor(random() * 2))];
    const averageIncome = incomeInside(random, averageRow);
    const found = bracketAt(brackets, averageIncome);
    const average = roundTo(found.average, 0.001);
    const averageChoices = shuffled(random, [average, roundTo(found.average / 2, 0.001),
      roundTo((found.average + found.marginal) / 2, 0.001), found.marginal]);
    return [
      { kind: "next", income: nextIncome, choices: rates, answer: bracketAt(brackets, nextIncome + 1).marginal },
      { kind: "target", target, tolerance: 500, low: second.from, high: second.to },
      { kind: "average", income: averageIncome, choices: averageChoices, answer: average, marginal: found.marginal },
    ];
  }

  // `answer` is a rate for "next" and "average", a taxable income for "target".
  function gradeBracket(round, answer) {
    const value = Number(answer);
    if (!Number.isFinite(value)) return false;
    if (round.kind === "target") {
      const inside = value >= round.low && (round.high === null || value < round.high);
      return inside && Math.abs(value - round.target) <= round.tolerance;
    }
    return Math.abs(value - round.answer) < 1e-9;
  }

  // ---- Claim Age Showdown (break-even) ----
  // `rows` are [{age, used}] (`used` the monthly benefit in today's dollars) from a benefitTables table.

  const FULL_AGE = 67;  // the full retirement age row for anyone born in 1960 or later
  const LIFESPANS = [76, 80, 84, 88, 92];  // the life spans round 2 asks about

  // The usable rows of a benefitTables `table` ({columns, data}): rows with no `used` benefit are skipped.
  function claimRows(table) {
    if (!table || !Array.isArray(table.columns) || !Array.isArray(table.data)) return [];
    const ageAt = table.columns.indexOf("age");
    const usedAt = table.columns.indexOf("used");
    if (ageAt < 0 || usedAt < 0) return [];
    return table.data
      .map((row) => ({ age: Number(row[ageAt]), used: row[usedAt] === null ? null : Number(row[usedAt]) }))
      .filter((row) => Number.isFinite(row.age) && row.used !== null && Number.isFinite(row.used))
      .sort((one, two) => one.age - two.age);
  }

  function rowAt(rows, age) {
    return rows.find((row) => row.age === age) || null;
  }

  // The three claimants: the earliest age, the full retirement age row and the latest; null with fewer than 2 rows.
  function claimants(rows) {
    if (rows.length < 2) return null;
    const early = rows[0].age;
    const late = rows[rows.length - 1].age;
    const middle = rows.filter((row) => row.age > early && row.age < late);
    const full = middle.length ? middle.reduce((best, row) =>
      (Math.abs(row.age - FULL_AGE) < Math.abs(best.age - FULL_AGE) ? row : best)).age : null;
    return { early, full, late };
  }

  // Benefits collected from the claim age up to an age, in today's dollars (simple sums, no investing, no taxes).
  function cumulative(rows, claimAge, upToAge) {
    const row = rowAt(rows, claimAge);
    if (!row) return null;
    return row.used * 12 * Math.max(0, upToAge - claimAge);
  }

  // The age at which claiming late has collected as much as claiming early; null when it never catches up.
  function breakEvenAge(rows, early, late) {
    const first = rowAt(rows, early);
    const second = rowAt(rows, late);
    if (!first || !second || late <= early || second.used <= first.used) return null;
    return (second.used * late - first.used * early) / (second.used - first.used);
  }

  // The claimant who has collected the most by an age (the earlier claimant on a tie).
  function leaderAt(rows, ages, upToAge) {
    return ages.reduce((best, age) => (cumulative(rows, age, upToAge) > cumulative(rows, best, upToAge) ? age : best));
  }

  function claimRounds(rows, seed) {
    const people = claimants(rows);
    if (!people) return null;
    const random = rng(seed);
    const base = people.full === null ? people.early : people.full;
    const exact = breakEvenAge(rows, base, people.late);
    const answer = exact === null ? null : Math.round(exact);
    const choices = answer === null ? [null, people.late + 5, people.late + 10, people.late + 15]
      : shuffled(random, [answer - 6, answer - 3, answer, answer + 4]);
    const ages = [people.early, people.full, people.late].filter((age) => age !== null);
    const lifespan = pick(random, LIFESPANS);
    return [
      { kind: "breakEven", early: base, late: people.late, exact, answer, choices },
      { kind: "lifespan", ages, lifespan, answer: leaderAt(rows, ages, lifespan), min: people.late, max: 100 },
      { kind: "pick", ages: rows.map((row) => row.age) },
    ];
  }

  // Round 3 has no right claim age: any age on offer counts.
  function gradeClaim(round, answer) {
    if (round.kind === "pick") return round.ages.includes(Number(answer));
    if (round.kind === "breakEven" && round.answer === null) return answer === null;
    return Number(answer) === round.answer;
  }

  // Round 3 read back as a sentence.
  function claimSentence(rows, age, lifespan) {
    const row = rowAt(rows, age);
    if (!row) return "";
    const monthly = Math.round(row.used).toLocaleString("en-US");
    const total = Math.round(cumulative(rows, age, lifespan)).toLocaleString("en-US");
    return `Claiming at ${age} pays about $${monthly} a month in today's dollars, about $${total} in all by age ${lifespan}.`;
  }

  // ---- Receipt Sort (which account pays for what) ----

  const BINS = [
    { id: "hsa", label: "HSA" },
    { id: "dcfsa", label: "Dependent care FSA" },
    { id: "529", label: "529 plan" },
    { id: "regular", label: "Regular money" },
  ];
  const RECEIPTS = [
    { id: "glasses", text: "Prescription eyeglasses", bin: "hsa",
      why: "Vision care is generally a qualified medical expense an HSA can pay." },
    { id: "copay", text: "Doctor visit copay", bin: "hsa",
      why: "A copay for medical care is generally a qualified medical expense." },
    { id: "dental", text: "Dental cleaning", bin: "hsa",
      why: "Dental care is generally a qualified medical expense." },
    { id: "afterschool", text: "After-school care for a 9-year-old while you work", bin: "dcfsa",
      why: "Care for a child under 13 so you can work generally qualifies as dependent care." },
    { id: "daycamp", text: "Summer day camp for a 7-year-old while you work", bin: "dcfsa",
      why: "Day camp while you work is generally dependent care; overnight camp is not." },
    { id: "daycare", text: "Daycare for a toddler", bin: "dcfsa",
      why: "Daycare so you can work is generally dependent care." },
    { id: "tuition", text: "College tuition", bin: "529",
      why: "College tuition is generally a qualified education expense for a 529 plan." },
    { id: "textbooks", text: "Required college textbooks", bin: "529",
      why: "Books a course requires are generally qualified education expenses." },
    { id: "gym", text: "Gym membership", bin: "regular",
      why: "General fitness is generally not a medical expense, so regular money pays it." },
    { id: "overnight", text: "Overnight summer camp", bin: "regular",
      why: "Overnight camp is generally not dependent care, so regular money pays it." },
  ];
  const RECEIPT_SCREENS = [4, 3, 3];

  function receiptRounds(seed) {
    const order = shuffled(rng(seed), RECEIPTS.map((receipt) => receipt.id));
    let start = 0;
    return RECEIPT_SCREENS.map((count) => {
      const cards = order.slice(start, start + count);
      start += count;
      return { kind: "receipts", cards };
    });
  }

  // One card: whether the bin is right and the one-line reason.
  function receiptCheck(id, bin) {
    const receipt = RECEIPTS.find((item) => item.id === id);
    if (!receipt) return { correct: false, why: "" };
    return { correct: receipt.bin === bin, bin: receipt.bin, why: receipt.why };
  }

  // A screen is right when every card on it went to its bin; `answers` maps card id to bin id.
  function gradeReceipts(round, answers) {
    return round.cards.every((id) => answers && receiptCheck(id, answers[id]).correct);
  }

  // ---- The Bad Decade (order of returns) ----
  // Two retirees, the same start and withdrawal, the same ten yearly returns in opposite order. Illustrative returns,
  // not a forecast: "first" meets the losses early, "second" meets them late.

  const RETURNS = [-0.18, -0.1, 0.04, -0.06, 0.12, 0.09, 0.15, 0.07, 0.11, 0.1];
  const START = 1000000;
  const SPEND = 40000;
  const TRIM = 0.1;  // spending trimmed by this share in a year after a down year
  const SPEND_STEP = 5000;
  const SPEND_MAX = 80000;

  // One path: each year the spending comes out at the start, then the rest earns that year's return.
  function decadePath(start, spends, returns) {
    const balances = [start];
    let balance = start;
    returns.forEach((rate, year) => {
      balance = Math.max(0, balance - spends[year]) * (1 + rate);
      balances.push(balance);
    });
    return balances;
  }

  function pairOf(start, spendsOf, returns) {
    const later = returns.slice().reverse();
    const firstSpends = spendsOf(returns);
    const secondSpends = spendsOf(later);
    const first = decadePath(start, firstSpends, returns);
    const second = decadePath(start, secondSpends, later);
    return { returns: { first: returns.slice(), second: later }, spends: { first: firstSpends, second: secondSpends },
      first, second, ends: { first: first[first.length - 1], second: second[second.length - 1] } };
  }

  function decadePair(start = START, spend = SPEND, returns = RETURNS) {
    return pairOf(start, (list) => list.map(() => spend), returns);
  }

  // The trim rule: in a year after a negative return, spending is cut by `trim`.
  function trimmedPair(start = START, spend = SPEND, returns = RETURNS, trim = TRIM) {
    return pairOf(start, (list) => list.map((_, year) => (year > 0 && list[year - 1] < 0 ? spend * (1 - trim) : spend)),
      returns);
  }

  // "first", "second" or "equal" (within a dollar).
  function higherOf(ends) {
    if (Math.abs(ends.first - ends.second) < 1) return "equal";
    return ends.first > ends.second ? "first" : "second";
  }

  function decadeRounds(seed) {
    const random = rng(seed);
    const spend = pick(random, [0, 20000, 60000]);
    const plain = decadePair();
    const trimmed = trimmedPair();
    const gains = { first: trimmed.ends.first - plain.ends.first, second: trimmed.ends.second - plain.ends.second };
    const choices = ["first", "second", "equal"];
    return [
      { kind: "predict", choices, answer: higherOf(plain.ends) },
      { kind: "withdraw", spend, step: SPEND_STEP, max: SPEND_MAX, choices,
        answer: higherOf(decadePair(START, spend).ends) },
      { kind: "trim", choices: ["first", "second"], answer: gains.first >= gains.second ? "first" : "second" },
    ];
  }

  function gradeDecade(round, answer) {
    return answer === round.answer;
  }

  // ---- Drift Seesaw (rebalancing) ----
  // A 60% stock mix drifts with twelve seeded monthly stock returns (bonds earn a fixed 0.3% a month). A rebalance
  // after month k puts the share back to 60% before month k+1. Each round offers four schedules of at most three
  // rebalances; the right one keeps the share inside the 55 to 65% band the most months, and is always unique.
  const SEESAW = deepFreezeGames({ target: 0.6, low: 0.55, high: 0.65, bond: 0.003, months: 12, worst: -0.05,
    best: 0.11, leaveFrom: 4, leaveTo: 7, tries: 50 });
  // The schedules of each round (months after which to rebalance; [] is never).
  const SEESAW_SETS = deepFreezeGames([
    [[], [6], [4, 8], [3, 6, 9]],
    [[], [3], [5, 10], [2, 6, 10]],
    [[], [9], [3, 9], [4, 7, 10]],
  ]);
  // Returns used when no seeded draw within `tries` gives a fair round (checked by the tests).
  const SEESAW_FALLBACK = deepFreezeGames([-0.03, 0.06, 0.04, 0.1, 0.03, -0.04, 0.1, 0.07, 0.11, -0.03, 0.01, -0.04]);

  function deepFreezeGames(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(deepFreezeGames);
      Object.freeze(value);
    }
    return value;
  }

  // The stock share at the end of each month (before any rebalance that month), `months` the rebalance months.
  function driftPath(returns, months = []) {
    const path = [];
    let share = SEESAW.target;
    returns.forEach((rate, index) => {
      const stocks = share * (1 + rate);
      const bonds = (1 - share) * (1 + SEESAW.bond);
      share = stocks / (stocks + bonds);
      path.push(share);
      if (months.includes(index + 1)) share = SEESAW.target;
    });
    return path;
  }

  function monthsInBand(path) {
    return path.filter((share) => share >= SEESAW.low - 1e-9 && share <= SEESAW.high + 1e-9).length;
  }

  function seesawLabel(months) {
    if (!months.length) return "Never";
    if (months.length === 1) return "After month " + months[0];
    return "After months " + months.slice(0, -1).join(", ") + " and " + months[months.length - 1];
  }

  // The four options of a round: `{id, months, label, inBand}`.
  function seesawOptions(returns, set) {
    return set.map((months) => ({ id: months.length ? "m" + months.join("-") : "none", months: months.slice(),
      label: seesawLabel(months), inBand: monthsInBand(driftPath(returns, months)) }));
  }

  // Whether a round is fair: the plain path leaves the band in months 4 to 7 and one option is best.
  function seesawFair(returns, set) {
    const left = driftPath(returns).findIndex((share) => share < SEESAW.low || share > SEESAW.high) + 1;
    if (left < SEESAW.leaveFrom || left > SEESAW.leaveTo) return false;
    const counts = seesawOptions(returns, set).map((option) => option.inBand);
    return counts.filter((count) => count === Math.max(...counts)).length === 1;
  }

  function seesawRounds(seed) {
    const random = rng(seed);
    return SEESAW_SETS.map((set) => {
      let returns = null;
      for (let attempt = 0; attempt < SEESAW.tries && !returns; attempt += 1) {
        const draw = Array.from({ length: SEESAW.months },
          () => roundTo(SEESAW.worst + random() * (SEESAW.best - SEESAW.worst), 0.001));
        if (seesawFair(draw, set)) returns = draw;
      }
      if (!returns) returns = SEESAW_FALLBACK.slice();
      const options = seesawOptions(returns, set);
      const best = options.reduce((top, option) => (option.inBand > top.inBand ? option : top));
      return { kind: "seesaw", returns, options: shuffled(random, options), answer: best.id };
    });
  }

  function gradeSeesaw(round, answer) {
    return answer === round.answer;
  }

  // ---- Plug the Leaks (fees) ----
  // $100,000 grows 30 years at 6% a year less the yearly fees. Rounds 1 and 2: plug one of four leaks (round 2 with
  // sizes next to each other); round 3: plug two (four pairs). Every fee differs, so the best is unique.
  const LEAKS = deepFreezeGames({ start: 100000, growth: 0.06, years: 30 });
  const LEAK_POOL = deepFreezeGames([
    { id: "expense", label: "Fund expense ratio", fee: 0.0075 },
    { id: "advisory", label: "Advisory fee", fee: 0.01 },
    { id: "trading", label: "Trading costs", fee: 0.003 },
    { id: "account", label: "Account fee", fee: 0.0015 },
    { id: "shareClass", label: "High-fee share class", fee: 0.005 },
    { id: "load", label: "Sales load, spread out", fee: 0.0025 },
    { id: "wrap", label: "Wrap fee", fee: 0.004 },
    { id: "cash", label: "Idle cash drag", fee: 0.002 },
    { id: "marketing", label: "Marketing (12b-1) fee", fee: 0.0035 },
    { id: "platform", label: "Platform fee", fee: 0.001 },
  ]);

  function leakPool() {
    return LEAK_POOL;
  }

  // The yearly fee of leak ids together.
  function leakFee(ids) {
    return ids.reduce((sum, id) => sum + LEAK_POOL.find((leak) => leak.id === id).fee, 0);
  }

  // What the start grows to with `fee` a year taken off the growth.
  function leakValue(fee) {
    return LEAKS.start * (1 + LEAKS.growth - fee) ** LEAKS.years;
  }

  function leakRounds(seed) {
    const random = rng(seed);
    const one = (leaks) => leaks.map((id) => ({ id, plugs: [id] }));
    const bestOf = (leaks, options) => options.reduce((top, option) => (leakFee(option.plugs) > leakFee(top.plugs)
      ? option : top)).id;
    const first = shuffled(random, LEAK_POOL.map((leak) => leak.id)).slice(0, 4);
    const sorted = LEAK_POOL.slice().sort((one, two) => one.fee - two.fee).map((leak) => leak.id);
    const from = Math.floor(random() * (sorted.length - 3));
    const second = shuffled(random, sorted.slice(from, from + 4));
    const third = shuffled(random, LEAK_POOL.map((leak) => leak.id)).slice(0, 4);
    const pairs = [];
    for (let left = 0; left < third.length; left += 1) {
      for (let right = left + 1; right < third.length; right += 1) pairs.push([third[left], third[right]]);
    }
    pairs.sort((one, two) => leakFee(two) - leakFee(one));
    const chosen = [pairs[0], ...shuffled(random, pairs.slice(1)).slice(0, 3)];
    const pairOptions = shuffled(random, chosen.map((plugs) => ({ id: plugs.join("+"), plugs })));
    return [
      { kind: "one", leaks: first, options: one(first), answer: bestOf(first, one(first)) },
      { kind: "one", leaks: second, options: one(second), answer: bestOf(second, one(second)) },
      { kind: "pair", leaks: third, options: pairOptions, answer: pairOptions.reduce((top, option) =>
        (leakFee(option.plugs) > leakFee(top.plugs) ? option : top)).id },
    ];
  }

  function gradeLeaks(round, answer) {
    return answer === round.answer;
  }

  // ---- Early Bird Snowball (starting early) ----
  // A rival saves a monthly amount from a start age to 65 at 7% a year; you save half as much. What is the latest
  // age you can start and still end with more? The answer is found by scanning SNOW_MIN to SNOW_MAX.
  const SNOW_MIN = 16;
  const SNOW_MAX = 45;
  const SNOW_END = 65;
  const SNOW_RATE = 0.07;
  const SNOW_PRESETS = deepFreezeGames([
    { rival: 600, rivalStart: 35, you: 300 },
    { rival: 500, rivalStart: 40, you: 250 },
    { rival: 800, rivalStart: 30, you: 400 },
  ]);
  const SNOW_STEPS = [-2, 0, 2, 5, 9];  // the options around the answer

  // What `monthly` saved from `startAge` to 65 grows to at 7% a year.
  function snowballValue(monthly, startAge) {
    const years = Math.max(0, SNOW_END - startAge);
    return monthly * 12 * ((1 + SNOW_RATE) ** years - 1) / SNOW_RATE;
  }

  // The latest start age from which you end with more than the rival, or null when none does.
  function latestWinningStart(preset) {
    const rival = snowballValue(preset.rival, preset.rivalStart);
    for (let age = SNOW_MAX; age >= SNOW_MIN; age -= 1) if (snowballValue(preset.you, age) > rival) return age;
    return null;
  }

  function snowballRounds(seed) {
    const random = rng(seed);
    return shuffled(random, SNOW_PRESETS.map((preset, index) => index)).map((index) => {
      const preset = SNOW_PRESETS[index];
      const answer = latestWinningStart(preset);
      const ages = [...new Set(SNOW_STEPS.map((step) => Math.min(SNOW_MAX, Math.max(SNOW_MIN, answer + step))))];
      return { kind: "snowball", preset, answer, choices: shuffled(random, ages) };
    });
  }

  function gradeSnowball(round, answer) {
    return Number(answer) === round.answer;
  }

  // ---- Money Sudoku (the Arcade's light puzzle) ----
  // A 4 by 4 grid of four bills: each row, column and 2 by 2 box holds each bill once. A cell holds 0 to 3, the index
  // of its bill in SUDOKU_BILLS; a grid is 16 cells, row by row. Each round blanks more cells; any grid that keeps the
  // given cells and the rule counts, so a puzzle with more than one answer is never marked wrong.
  const SUDOKU_BILLS = ["$1", "$5", "$10", "$20"];
  const SUDOKU_BLANKS = [5, 7, 9];  // the blank cells of rounds 1 to 3
  const SUDOKU_BASE = [0, 1, 2, 3, 2, 3, 0, 1, 1, 0, 3, 2, 3, 2, 1, 0];  // a valid grid the rounds shuffle

  // Whether a 16-cell grid of 0 to 3 keeps the rule in every row, column and box.
  function sudokuValid(grid) {
    if (!Array.isArray(grid) || grid.length !== 16 || !grid.every((cell) => [0, 1, 2, 3].includes(cell))) return false;
    const groups = [];
    for (let line = 0; line < 4; line += 1) {
      groups.push([0, 1, 2, 3].map((at) => line * 4 + at), [0, 1, 2, 3].map((at) => at * 4 + line));
      const top = Math.floor(line / 2) * 8 + (line % 2) * 2;
      groups.push([top, top + 1, top + 4, top + 5]);
    }
    return groups.every((cells) => new Set(cells.map((at) => grid[at])).size === 4);
  }

  // A shuffled valid grid: the bills renamed, rows swapped within each band and the bands swapped, the same for columns.
  function sudokuSolution(random) {
    const names = shuffled(random, [0, 1, 2, 3]);
    const order = () => shuffled(random, [0, 1]).flatMap((band) => shuffled(random, [0, 1]).map((at) => band * 2 + at));
    const rows = order();
    const columns = order();
    return rows.flatMap((row) => columns.map((column) => names[SUDOKU_BASE[row * 4 + column]]));
  }

  function sudokuRounds(seed) {
    const random = rng(seed);
    return SUDOKU_BLANKS.map((count) => {
      const solution = sudokuSolution(random);
      const blanks = shuffled(random, solution.map((cell, at) => at)).slice(0, count).sort((one, two) => one - two);
      return { kind: "sudoku", solution, blanks };
    });
  }

  // `answer` maps each blank cell's index to the bill chosen there (0 to 3).
  function gradeSudoku(round, answer) {
    if (!answer || typeof answer !== "object") return false;
    const grid = round.solution.slice();
    for (const at of round.blanks) grid[at] = Number(answer[at]);
    return sudokuValid(grid);
  }

  // ---- Grow It (compound growth) ----
  // What a sum grows to: about the compound value, against simple interest, double and half of it.
  const GROW_PRESETS = Object.freeze([
    { start: 10000, rate: 0.07, years: 30 }, { start: 5000, rate: 0.06, years: 24 },
    { start: 20000, rate: 0.08, years: 18 }, { start: 1000, rate: 0.1, years: 36 },
    { start: 50000, rate: 0.05, years: 14 },
  ]);

  const growValue = (start, rate, years) => start * (1 + rate) ** years;

  function growRounds(seed) {
    const random = rng(seed);
    return shuffled(random, GROW_PRESETS).slice(0, ROUNDS).map((preset) => {
      const exact = growValue(preset.start, preset.rate, preset.years);
      const answer = roundTo(exact, 100);
      const simple = roundTo(preset.start * (1 + preset.rate * preset.years), 100);
      return { kind: "grow", ...preset, exact, answer,
        choices: shuffled(random, [answer, simple, roundTo(exact * 2, 100), roundTo(exact / 2, 100)]) };
    });
  }

  function gradeGrow(round, answer) {
    return Number(answer) === round.answer;
  }

  // ---- Bigger Pile (which is bigger) ----
  // Two sums of money; each preset's values are worked out here, and the two sides swap at random.
  const saveValue = (amount, rate, years) => amount * ((1 + rate) ** years - 1) / rate;  // saved at each year's end
  const BIGGER_PRESETS = Object.freeze([
    [["$10,000 today, grown 7% a year for 10 years", growValue(10000, 0.07, 10)],
      ["$18,000 paid to you in 10 years", 18000]],
    [["$200 a month for 10 years, kept in cash", 200 * 12 * 10],
      ["$15,000 today, grown 6% a year for 10 years", growValue(15000, 0.06, 10)]],
    [["$1,000 a year for 30 years, growing 7% a year", saveValue(1000, 0.07, 30)],
      ["$100,000 in 30 years", 100000]],
    [["$100,000 grown 6% a year for 20 years", growValue(100000, 0.06, 20)],
      ["$100,000 grown 7% a year for 20 years, less a 0.5% yearly fee", growValue(100000, 0.065, 20)]],
    [["$5,000 a year from age 25 to 35, then left to grow 7% a year until 65",
      saveValue(5000, 0.07, 10) * 1.07 ** 30],
      ["$5,000 a year from age 35 to 65, growing 7% a year", saveValue(5000, 0.07, 30)]],
    [["$50 a week for a year", 50 * 52], ["$2,500 once", 2500]],
  ].map((pair) => Object.freeze(pair.map(([text, value]) => Object.freeze({ text, value })))));

  function biggerRounds(seed) {
    const random = rng(seed);
    return shuffled(random, BIGGER_PRESETS).slice(0, ROUNDS).map((pair) => {
      const [a, b] = random() < 0.5 ? pair : [pair[1], pair[0]];
      return { kind: "bigger", a, b, answer: a.value > b.value ? "a" : "b" };
    });
  }

  function gradeBigger(round, answer) {
    return answer === round.answer;
  }

  // ---- Prize Wheel (one spin for a few stars) ----
  // Eight segments; the spin's stars are its segment's. Luck only: no question, nothing to get wrong.
  const WHEEL_PRIZES = Object.freeze([1, 2, 1, 3, 1, 2, 1, 2].map((stars) => Object.freeze({ stars,
    label: stars === 3 ? "Jackpot: 3 stars" : stars + (stars === 1 ? " star" : " stars") })));

  function wheelRounds(seed) {
    const random = rng(seed);
    const index = Math.floor(random() * WHEEL_PRIZES.length);
    return [{ kind: "spin", index, prize: WHEEL_PRIZES[index], turns: 3 + Math.floor(random() * 3) }];
  }

  function gradeWheel() {
    return true;
  }

  const api = { ROUNDS, NOT_ADVICE, GAMES, GAME_IDS, rng, starsOf,
    bracketAt, bracketRounds, gradeBracket,
    FULL_AGE, LIFESPANS, claimRows, claimants, cumulative, breakEvenAge, leaderAt, claimRounds, gradeClaim, claimSentence,
    BINS, RECEIPTS, RECEIPT_SCREENS, receiptRounds, receiptCheck, gradeReceipts,
    RETURNS, START, SPEND, TRIM, SPEND_STEP, SPEND_MAX, decadePair, trimmedPair, higherOf, decadeRounds, gradeDecade,
    SEESAW, SEESAW_SETS, SEESAW_FALLBACK, seesawFair, driftPath, monthsInBand, seesawOptions, seesawRounds, gradeSeesaw,
    leakPool, leakFee, leakValue, leakRounds, gradeLeaks,
    SNOW_MIN, SNOW_MAX, SNOW_PRESETS, snowballValue, latestWinningStart, snowballRounds, gradeSnowball,
    SUDOKU_BILLS, sudokuValid, sudokuRounds, gradeSudoku, GROW_PRESETS, growValue, growRounds, gradeGrow,
    BIGGER_PRESETS, biggerRounds, gradeBigger, WHEEL_PRIZES, wheelRounds, gradeWheel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WmtiGames = api;
})(typeof self !== "undefined" ? self : this);

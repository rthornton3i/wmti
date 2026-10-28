// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// Gamer mini games (F101b): the pure rules of the four short games, original designs. No DOM and no clock; the app
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

  const api = { ROUNDS, NOT_ADVICE, GAMES, GAME_IDS, rng, starsOf,
    bracketAt, bracketRounds, gradeBracket,
    FULL_AGE, LIFESPANS, claimRows, claimants, cumulative, breakEvenAge, leaderAt, claimRounds, gradeClaim, claimSentence,
    BINS, RECEIPTS, RECEIPT_SCREENS, receiptRounds, receiptCheck, gradeReceipts,
    RETURNS, START, SPEND, TRIM, SPEND_STEP, SPEND_MAX, decadePair, trimmedPair, higherOf, decadeRounds, gradeDecade };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WmtiGames = api;
})(typeof self !== "undefined" ? self : this);

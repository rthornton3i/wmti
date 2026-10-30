// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// Gamer style rules: levels, XP, quests and awards, worked out from what the user has done and compared, never from
// an outcome (a success share, a balance). Progress is a small ledger saved in the scenario (experience.progress.game):
// the day each rule key was first met. XP is never stored; it is the sum of the earned keys' table values. Every
// function is pure: no DOM, no clock (the caller passes `today` as a day number) and no argument is changed. The app's
// Gamer part (app.js) and the tests use it; it runs in Node for the tests.
(function (root) {
  "use strict";

  const VERSION = 1;  // the ledger's version; any other is dropped for an empty ledger
  const MAX_KEYS = 200;  // entries kept per ledger list
  const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;  // a question, quest, award or view id
  const EFFORT_RANK = { low: 0, medium: 1, high: 2 };
  const EFFORT_NAMES = { low: "Low", medium: "Medium", high: "High" };
  const SEEN_VIEWS = ["summary", "plots", "compare", "optimize"];  // the result views the explorer award counts
  const GAME_IDS = ["bracket", "claim", "receipts", "decade", "seesaw", "leaks", "snowball", "sudoku", "grow", "bigger",
    "wheel"];  // games.js GAME_IDS
  const ORIGINAL_GAME_IDS = ["bracket", "claim", "receipts", "decade"];  // the four games All-rounder asks for
  const MAX_STARS = 3;

  // Levels by the XP they start at.
  const LEVELS = deepFreeze([
    { level: 1, name: "Starter", xp: 0 }, { level: 2, name: "Saver", xp: 25 }, { level: 3, name: "Planner", xp: 60 },
    { level: 4, name: "Strategist", xp: 110 }, { level: 5, name: "Navigator", xp: 170 },
    { level: 6, name: "Veteran", xp: 240 }, { level: 7, name: "Master", xp: 320 }, { level: 8, name: "Legend", xp: 410 },
  ]);

  // XP per rule key: `walk.answer.<questionId>` for a walkthrough question answered (not skipped); `quest.<id>` the
  // quest's own `xp`; `game.<id>.done` a mini game finished and `game.<id>.stars` it finished with all 3 stars.
  // Awards give none.
  const XP = deepFreeze({ walkAnswer: 2, gameDone: 15, gameStars: 10 });

  // Quests in the order the Awards view lists them. `tier`: the lowest effort that offers it. `show`: where Show me
  // goes (`walk`, `view:<id>` or `field:<dotted input path>`).
  const QUESTS = deepFreeze([
    { id: "basics", tier: "low", xp: 25, title: "Fill in the basics",
      how: "Enter your age, monthly spending, savings and pay (or mark yourself retired).", show: "field:you.salary" },
    { id: "walk", tier: "low", xp: 25, title: "Finish the walkthrough",
      how: "Answer or skip every question of Walk me through it.", show: "walk" },
    { id: "work_savings", tier: "low", xp: 10, title: "Look at saving at work",
      how: "Turn on the 401k plan, or answer the 401k question in the walkthrough.", show: "field:contributions.enabled" },
    { id: "medical", tier: "low", xp: 10, title: "Look at your medical plan",
      how: "Turn on the medical plan, or answer its question in the walkthrough.",
      show: "field:premiums.medicalPlanEnabled" },
    { id: "first_run", tier: "low", xp: 15, title: "Run the simulation",
      how: "Run a Monte Carlo simulation of this plan.", show: "view:summary" },
    { id: "plots", tier: "low", xp: 10, title: "Open the plots", how: "Open Outputs, then Plots.", show: "view:plots" },
    { id: "compare", tier: "low", xp: 20, title: "Compare two plans", how: "Run a comparison in Strategy, Compare.",
      show: "view:compare" },
    { id: "optimize", tier: "low", xp: 20, title: "Search for a strategy",
      how: "Run a strategy search in Strategy, Optimize.", show: "view:optimize" },
    { id: "match", tier: "medium", xp: 15, title: "Count an employer match",
      how: "Turn on the employer match for someone whose employer pays one.", show: "field:you.employerMatch.enabled" },
    { id: "claim", tier: "medium", xp: 15, title: "Pick a claim age",
      how: "Answer the Social Security claim age question in the walkthrough, or finish Claim Age Showdown.",
      show: "walk" },
    { id: "play", tier: "low", xp: 15, title: "Play a mini game", how: "Finish any mini game in Arcade, Games.",
      show: "view:games" },
  ]);

  // Awards (no XP), each earned by one condition: a quest earned, every view of `seen` opened, or a level reached.
  const AWARDS = deepFreeze([
    { id: "first_steps", title: "First steps", how: "Finish the quest Fill in the basics.", quest: "basics" },
    { id: "navigator", title: "Navigator", how: "Finish the walkthrough.", quest: "walk" },
    { id: "simulator", title: "Simulator", how: "Run the simulation.", quest: "first_run" },
    { id: "match_maker", title: "Match maker", how: "Count an employer match.", quest: "match" },
    { id: "comparer", title: "Comparer", how: "Compare two plans.", quest: "compare" },
    { id: "explorer", title: "Explorer", how: "Open Summary, Plots, Compare and Optimize.", seen: SEEN_VIEWS },
    { id: "level_4", title: "Level 4", how: "Reach level 4, Strategist.", level: 4 },
    { id: "level_8", title: "Level 8", how: "Reach level 8, Legend.", level: 8 },
    { id: "claim_scholar", title: "Claim scholar", how: "Finish Claim Age Showdown.", keys: ["game.claim.done"] },
    { id: "bracket_climber", title: "Bracket climber", how: "Finish Bracket Climber with 3 stars.",
      keys: ["game.bracket.stars"] },
    { id: "receipt_sorter", title: "Receipt sorter", how: "Finish Receipt Sort.", keys: ["game.receipts.done"] },
    { id: "decade_survivor", title: "Decade survivor", how: "Finish The Bad Decade.", keys: ["game.decade.done"] },
    { id: "all_rounder", title: "All-rounder", how: "Finish all four mini games.",
      keys: ORIGINAL_GAME_IDS.map((id) => "game." + id + ".done") },
    { id: "puzzler", title: "Puzzler", how: "Finish Money Sudoku with 3 stars.", keys: ["game.sudoku.stars"] },
    { id: "growth_guru", title: "Growth guru", how: "Finish Grow It.", keys: ["game.grow.done"] },
    { id: "sharp_eye", title: "Sharp eye", how: "Finish Bigger Pile with 3 stars.", keys: ["game.bigger.stars"] },
    { id: "lucky_spin", title: "Lucky spin", how: "Spin the Prize Wheel.", keys: ["game.wheel.done"] },
    { id: "jackpot", title: "Jackpot", how: "Land the Prize Wheel's jackpot.", keys: ["game.wheel.stars"] },
  ]);

  const QUEST_BY_ID = new Map(QUESTS.map((quest) => [quest.id, quest]));
  const AWARD_BY_ID = new Map(AWARDS.map((award) => [award.id, award]));
  const QUEST_PREFIX = "quest.";
  const WALK_PREFIX = "walk.answer.";
  const GAME_PREFIX = "game.";
  const AWARD_PREFIX = "award.";  // an award's key in `silenced` (its `awards` entry is keyed by the bare id)

  function deepFreeze(value) {
    if (value && typeof value === "object") {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  }

  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const isDay = (value) => Number.isInteger(value) && value >= 0;
  const dayOf = (value) => (isDay(value) ? value : 0);
  const effortRank = (effort) => (effort in EFFORT_RANK ? EFFORT_RANK[effort] : EFFORT_RANK.high);
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

  // A rule key's XP, or null when the key is not one of the rules.
  function keyXp(key) {
    if (typeof key !== "string") return null;
    if (key.startsWith(QUEST_PREFIX)) {
      const quest = QUEST_BY_ID.get(key.slice(QUEST_PREFIX.length));
      return quest ? quest.xp : null;
    }
    if (key.startsWith(WALK_PREFIX)) return KEY_PATTERN.test(key.slice(WALK_PREFIX.length)) ? XP.walkAnswer : null;
    if (key.startsWith(GAME_PREFIX)) {
      const [id, kind, ...rest] = key.slice(GAME_PREFIX.length).split(".");
      if (rest.length || !GAME_IDS.includes(id)) return null;
      return kind === "done" ? XP.gameDone : kind === "stars" ? XP.gameStars : null;
    }
    return null;
  }

  function knownSilenced(key) {
    if (typeof key !== "string") return false;
    if (key.startsWith(AWARD_PREFIX)) return AWARD_BY_ID.has(key.slice(AWARD_PREFIX.length));
    return keyXp(key) !== null;
  }

  // A {key: day} table with only the keys `keep` accepts and whole-number days, at most MAX_KEYS entries.
  function cleanDays(raw, keep) {
    const out = {};
    if (!isRecord(raw)) return out;
    let count = 0;
    for (const [key, day] of Object.entries(raw)) {
      if (count >= MAX_KEYS) break;
      if (!keep(key) || !isDay(day)) continue;
      out[key] = day;
      count += 1;
    }
    return out;
  }

  // The games table: per known game, `{plays, stars}` as whole numbers (stars the best, 0 to 3).
  function cleanGames(raw) {
    const out = {};
    if (!isRecord(raw)) return out;
    for (const id of GAME_IDS) {
      const entry = raw[id];
      if (!isRecord(entry) || !isDay(entry.plays) || entry.plays < 1) continue;
      out[id] = { plays: entry.plays, stars: isDay(entry.stars) ? Math.min(MAX_STARS, entry.stars) : 0 };
    }
    return out;
  }

  // An empty ledger: nothing earned, seen or silenced, no resets.
  function emptyLedger() {
    return { v: VERSION, earned: {}, awards: {}, seen: {}, games: {}, silenced: [], resetAt: 0 };
  }

  /**
   * Return a clean copy of a stored ledger; never throws.
   *
   * A ledger of another version, or anything that is not one (including a JSON text that does not parse), gives an
   * empty ledger. Unknown or malformed keys and days that are not whole numbers are dropped, each list is cut to
   * MAX_KEYS entries, and the games table keeps only the known mini games' whole-number plays and best stars.
   *
   * @param {*} raw - The stored ledger, as an object or its JSON text.
   * @returns {object} A ledger `{v, earned, awards, seen, games, silenced, resetAt}`.
   */
  function cleanLedger(raw) {
    let data = raw;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (error) { data = null; }
    }
    if (!isRecord(data) || data.v !== VERSION) return emptyLedger();
    const silenced = Array.isArray(data.silenced)
      ? [...new Set(data.silenced.filter(knownSilenced))].slice(0, MAX_KEYS) : [];
    return {
      v: VERSION,
      earned: cleanDays(data.earned, (key) => keyXp(key) !== null),
      awards: cleanDays(data.awards, (key) => AWARD_BY_ID.has(key)),
      seen: cleanDays(data.seen, (key) => KEY_PATTERN.test(key)),
      games: cleanGames(data.games),
      silenced,
      resetAt: dayOf(data.resetAt),
    };
  }

  /**
   * Join the ledgers of two open tabs.
   *
   * The ledger with the higher reset count (`resetAt`) wins outright: everything the other holds was earned before
   * that reset. With equal counts the lists are joined, each key keeping its earlier day and each game its most plays
   * and best stars; a key stays silenced only
   * while both still hold it (both silenced it at the same reset, and a key only ever leaves the set after that).
   *
   * @param {*} first - One ledger (cleaned first).
   * @param {*} second - The other ledger (cleaned first).
   * @returns {object} The joined ledger.
   */
  function mergeLedgers(first, second) {
    const one = cleanLedger(first);
    const two = cleanLedger(second);
    if (one.resetAt !== two.resetAt) return one.resetAt > two.resetAt ? one : two;
    const join = (left, right) => {
      const out = { ...left };
      for (const [key, day] of Object.entries(right)) out[key] = key in out ? Math.min(out[key], day) : day;
      return out;
    };
    return cleanLedger({
      v: VERSION, earned: join(one.earned, two.earned), awards: join(one.awards, two.awards),
      seen: join(one.seen, two.seen), games: joinGames(one.games, two.games), silenced: one.silenced.filter((key) => two.silenced.includes(key)),
      resetAt: one.resetAt,
    });
  }

  function joinGames(left, right) {
    const out = { ...left };
    for (const [id, entry] of Object.entries(right)) {
      const mine = out[id];
      out[id] = mine ? { plays: Math.max(mine.plays, entry.plays), stars: Math.max(mine.stars, entry.stars) } : entry;
    }
    return out;
  }

  // The XP of a ledger: the sum of its earned keys' table values.
  function xpOf(ledger) {
    const earned = cleanLedger(ledger).earned;
    return Object.keys(earned).reduce((sum, key) => sum + keyXp(key), 0);
  }

  // The level at `xp`: its number and name, the XP into it and the XP from its start to the next level's (null at the
  // top level).
  function levelOf(xp) {
    const points = Math.max(0, number(xp));
    let index = 0;
    while (index + 1 < LEVELS.length && points >= LEVELS[index + 1].xp) index += 1;
    const here = LEVELS[index];
    const above = LEVELS[index + 1];
    return { level: here.level, name: here.name, into: points - here.xp, next: above ? above.xp - here.xp : null };
  }

  /**
   * Work out the facts the rules read from the app's state.
   *
   * Input-based facts (the basics, the 401k plan, the medical plan, an employer match) count only in a scenario that
   * is not the unedited example; the walkthrough answers count everywhere.
   *
   * @param {object} source - The state to read.
   * @param {object} source.inputs - The open scenario's inputs.
   * @param {object} source.experience - Its experience block (`walk.status`, `walk.answers`).
   * @param {string} source.effort - The effort, one of low, medium, high.
   * @param {boolean} source.isExample - True for the unedited example household.
   * @param {object} source.results - `{mc, compare, optimize}`: each the result, or null when there is none.
   * @param {object} source.seen - The ledger's `seen` table (view id to day).
   * @param {object} source.games - The ledger's `games` table (game id to `{plays, stars}`).
   * @returns {object} `{effort, answered, seen, games, quests}`: the answered question ids, the result views opened
   *     (view id to true or false), each mini game's `{done, stars}` (finished; finished with all 3 stars) and each
   *     quest id's fact (true or false).
   */
  function gamifyFacts(source) {
    const { inputs, experience, effort, isExample, results, seen, games } = isRecord(source) ? source : {};
    const plan = isRecord(inputs) ? inputs : {};
    const walk = isRecord(experience) && isRecord(experience.walk) ? experience.walk : {};
    const answers = isRecord(walk.answers) ? walk.answers : {};
    const answered = Object.keys(answers)
      .filter((id) => KEY_PATTERN.test(id) && isRecord(answers[id]) && answers[id].status === "answered");
    const done = isRecord(results) ? results : {};
    const opened = isRecord(seen) ? seen : {};
    const seenViews = Object.fromEntries(SEEN_VIEWS.map((view) => [view, isDay(opened[view])]));
    const played = cleanGames(games);
    const gameFacts = Object.fromEntries(GAME_IDS.map((id) => [id,
      { done: id in played, stars: id in played && played[id].stars >= MAX_STARS }]));
    const own = isExample !== true;
    const you = isRecord(plan.you) ? plan.you : {};
    const people = [plan.you, plan.partner].filter(isRecord);
    const sum = (list, name) => (Array.isArray(list) ? list : [])
      .reduce((total, item) => total + (isRecord(item) ? number(item[name]) : 0), 0);
    const paySettled = people.some((person) => number(person.salary) > 0) || you.retired === true
      || answered.includes("salary");
    const basics = own && number(you.currentAge) > 0 && sum(plan.expenses, "amount") > 0
      && sum(plan.accounts, "startingValue") > 0 && paySettled;
    const switchOn = (group, name) => isRecord(plan[group]) && plan[group][name] === true;
    const quests = {
      basics,
      walk: walk.status === "done",
      work_savings: (own && switchOn("contributions", "enabled")) || answered.includes("plan401k"),
      medical: (own && switchOn("premiums", "medicalPlanEnabled")) || answered.includes("medicalPlan"),
      first_run: Boolean(done.mc),
      plots: seenViews.plots,
      compare: Boolean(done.compare),
      optimize: Boolean(done.optimize),
      match: own && people.some((person) => isRecord(person.employerMatch) && person.employerMatch.enabled === true),
      claim: answered.includes("ssAge") || gameFacts.claim.done,
      play: GAME_IDS.some((id) => gameFacts[id].done),
    };
    return { effort: effort in EFFORT_RANK ? effort : "high", answered, seen: seenViews, games: gameFacts, quests };
  }

  /**
   * Return each quest's state for the Awards view, in table order.
   *
   * A quest the ledger holds is `done` in every scenario; otherwise it is `locked` when its tier is above the effort,
   * `pending` when its fact is true now and it is not silenced (it is granted on the next evaluation), else `open`.
   *
   * @param {object} facts - From `gamifyFacts`.
   * @param {object} ledger - The ledger.
   * @param {string} effort - The effort, one of low, medium, high.
   * @returns {object[]} `{id, title, how, show, tier, xp, state, day, lockText}` per quest: `day` the day it was
   *     earned (null when not), `lockText` "Unlocks at Medium" style text (null unless locked).
   */
  function questStatus(facts, ledger, effort) {
    const { earned, silenced } = cleanLedger(ledger);
    const now = isRecord(facts) && isRecord(facts.quests) ? facts.quests : {};
    return QUESTS.map((quest) => {
      const key = QUEST_PREFIX + quest.id;
      const locked = effortRank(quest.tier) > effortRank(effort);
      const ready = now[quest.id] === true && !silenced.includes(key);
      const state = key in earned ? "done" : locked ? "locked" : ready ? "pending" : "open";
      return { id: quest.id, title: quest.title, how: quest.how, show: quest.show, tier: quest.tier, xp: quest.xp,
        state, day: key in earned ? earned[key] : null,
        lockText: state === "locked" ? "Unlocks at " + EFFORT_NAMES[quest.tier] : null };
    });
  }

  // Each rule key with its fact now and whether the effort lets it grant: the quests and the answered questions.
  function ruleFacts(facts, effort) {
    const now = isRecord(facts) && isRecord(facts.quests) ? facts.quests : {};
    const rules = QUESTS.map((quest) => ({ key: QUEST_PREFIX + quest.id, kind: "quest", id: quest.id,
      fact: now[quest.id] === true, allowed: effortRank(quest.tier) <= effortRank(effort), xp: quest.xp,
      title: quest.title }));
    const answered = isRecord(facts) && Array.isArray(facts.answered) ? facts.answered : [];
    for (const id of new Set(answered)) {
      if (KEY_PATTERN.test(id)) rules.push({ key: WALK_PREFIX + id, kind: "answer", id, fact: true, allowed: true,
        xp: XP.walkAnswer, title: null });
    }
    const games = isRecord(facts) && isRecord(facts.games) ? facts.games : {};
    for (const id of GAME_IDS) {
      const fact = isRecord(games[id]) ? games[id] : {};
      rules.push({ key: GAME_PREFIX + id + ".done", kind: "game", id, fact: fact.done === true, allowed: true,
        xp: XP.gameDone, title: null });
      rules.push({ key: GAME_PREFIX + id + ".stars", kind: "game", id, fact: fact.stars === true, allowed: true,
        xp: XP.gameStars, title: null });
    }
    return rules;
  }

  function awardMet(award, earned, facts) {
    if (award.quest) return QUEST_PREFIX + award.quest in earned;
    if (award.keys) return award.keys.every((key) => key in earned);
    if (award.seen) return award.seen.every((view) => isRecord(facts && facts.seen) && facts.seen[view] === true);
    const xp = Object.keys(earned).reduce((sum, key) => sum + keyXp(key), 0);
    return levelOf(xp).level >= award.level;
  }

  /**
   * Grant every rule met now that the ledger does not hold yet; idempotent.
   *
   * A silenced key (see `resetLedger`) is skipped while its fact holds and leaves the silenced set when its fact is
   * false, so the next time it holds it grants. A quest above the effort does not grant. Awards are worked out after
   * the quests, on the new earned set.
   *
   * @param {object} facts - From `gamifyFacts`.
   * @param {object} ledger - The ledger (not changed).
   * @param {object} options - `{effort, today}`: the effort and today's day number.
   * @returns {object} `{ledger, grants}`: the new ledger and the grants, each `{kind, key, id, title, xp}` (kind
   *     `quest`, `answer`, `award` or `level`; a level grant has `level` and `name`).
   */
  function evaluate(facts, ledger, options) {
    const { effort, today } = isRecord(options) ? options : {};
    const day = dayOf(today);
    const next = cleanLedger(ledger);
    const silenced = new Set(next.silenced);
    const grants = [];
    const levelBefore = levelOf(xpOf(next)).level;
    for (const rule of ruleFacts(facts, effort)) {
      if (silenced.has(rule.key)) {
        if (!rule.fact) silenced.delete(rule.key);
        continue;
      }
      if (rule.fact && rule.allowed && !(rule.key in next.earned)) {
        next.earned[rule.key] = day;
        grants.push({ kind: rule.kind, key: rule.key, id: rule.id, title: rule.title, xp: rule.xp });
      }
    }
    const known = new Set(ruleFacts(facts, effort).map((rule) => rule.key));
    for (const key of [...silenced]) {
      if (!key.startsWith(AWARD_PREFIX) && !known.has(key)) silenced.delete(key);  // its fact is gone: false
    }
    for (const award of AWARDS) {
      const key = AWARD_PREFIX + award.id;
      const met = awardMet(award, next.earned, facts);
      if (silenced.has(key)) {
        if (!met) silenced.delete(key);
        continue;
      }
      if (met && !(award.id in next.awards)) {
        next.awards[award.id] = day;
        grants.push({ kind: "award", key, id: award.id, title: award.title, xp: 0 });
      }
    }
    const reached = levelOf(xpOf(next));
    if (reached.level > levelBefore) {
      grants.push({ kind: "level", key: "level." + reached.level, id: String(reached.level), title: reached.name,
        xp: 0, level: reached.level, name: reached.name });
    }
    next.silenced = [...silenced];
    return { ledger: cleanLedger(next), grants };
  }

  /**
   * Reset progress: clear what was earned and seen, and silence every rule met now so nothing is granted back.
   *
   * The silenced set is every key `evaluate` would grant with the current facts on an empty ledger at any effort
   * (the grants are discarded); the reset count goes up by one so another tab's older ledger loses on merge.
   *
   * @param {object} facts - From `gamifyFacts`, at the moment of the reset.
   * @param {object} ledger - The ledger (not changed).
   * @returns {object} The reset ledger.
   */
  function resetLedger(facts, ledger) {
    const resetAt = cleanLedger(ledger).resetAt + 1;
    const baseline = evaluate(facts, emptyLedger(), { effort: "high", today: 0 }).ledger;
    const silenced = [...Object.keys(baseline.earned), ...Object.keys(baseline.awards).map((id) => AWARD_PREFIX + id)];
    return cleanLedger({ ...emptyLedger(), silenced, resetAt });
  }

  // One short line for the toast: the quests and awards gained, the XP and a new level; "" when there is nothing.
  function grantsText(grants) {
    const list = Array.isArray(grants) ? grants.filter(isRecord) : [];
    const quests = list.filter((grant) => grant.kind === "quest").map((grant) => grant.title);
    const awards = list.filter((grant) => grant.kind === "award").map((grant) => grant.title);
    const xp = list.reduce((sum, grant) => sum + number(grant.xp), 0);
    const level = list.find((grant) => grant.kind === "level");
    const parts = [];
    if (quests.length) parts.push((quests.length === 1 ? "Quest done: " : "Quests done: ") + quests.join(", "));
    if (awards.length) parts.push((awards.length === 1 ? "Award: " : "Awards: ") + awards.join(", "));
    if (xp > 0) parts.push("+" + xp + " XP");
    if (level) parts.push("Level " + level.level + ": " + level.name);
    return parts.length ? parts.join(". ") + "." : "";
  }

  // ---- Glass Garden ----
  // The Garden tab's rules. A bed is a walkthrough topic and opens at its level; its soil is the share of the topic's
  // questions filled in (answered in the walkthrough, or an input that differs from the example household); the plants
  // grow with the latest simulation's chance of success; the season follows a plan year. Nothing here is stored: the
  // app draws the garden from the plan, the answers and the ledger every time. Display only; no XP rule reads it.

  // Beds in level order: `topic` the walkthrough topic id, `level` the level it opens at. Level 8 opens nothing new.
  const BEDS = deepFreeze([
    { id: "aboutYou", title: "About you", level: 1 },
    { id: "workAndPay", title: "Work and pay", level: 2 },
    { id: "saved", title: "Savings", level: 2 },
    { id: "livingCosts", title: "Spending", level: 3 },
    { id: "retiring", title: "Retirement", level: 4 },
    { id: "medicareCover", title: "Medicare", level: 5 },
    { id: "healthCosts", title: "Health", level: 6 },
    { id: "taxStrategies", title: "Tax strategies", level: 7, optional: true },
  ].map((bed) => ({ ...bed, topic: bed.id })));
  // The input lists a question without fields writes, by its action: it is filled when that list differs.
  const ACTION_PATHS = deepFreeze({ partner: ["partner"], count: ["children"], childAges: ["children"],
    carCount: ["cars"], carCosts: ["cars"], homeCount: ["homes"], total: ["expenses"], balances: ["accounts"] });
  const SEASONS = deepFreeze(["Spring", "Summer", "Autumn", "Winter"]);
  // Growth stages by the chance of success: below each `below` share (null: no simulation yet).
  const GROWTH = deepFreeze([
    { stage: 1, name: "sprouting", below: 0.5 }, { stage: 2, name: "leafy", below: 0.75 },
    { stage: 3, name: "budding", below: 0.9 }, { stage: 4, name: "in bloom", below: Infinity },
  ]);
  const MAX_STEPS = 3;  // the level-up card's "what earned it" lines
  // The Garden's tools, each opening one mini game at its level (all reachable without the tool games' own XP).
  const TOOLS = deepFreeze([
    { id: "can", title: "Watering can", game: "seesaw", level: 3 },
    { id: "shears", title: "Shears", game: "leaks", level: 5 },
    { id: "pouch", title: "Seed pouch", game: "snowball", level: 6 },
  ]);

  // The beds open at `level`, in table order (their ids).
  function bedsOpen(level) {
    return BEDS.filter((bed) => bed.level <= number(level)).map((bed) => bed.id);
  }

  // The tools open at `level`, in table order (their ids).
  function toolsOpen(level) {
    return TOOLS.filter((tool) => tool.level <= number(level)).map((tool) => tool.id);
  }

  // The tool that opens game `gameId`, or null for a game that needs none.
  function toolOf(gameId) {
    return TOOLS.find((tool) => tool.game === gameId) || null;
  }

  // What opens at `level` (or, with `fromLevel`, at every level above it up to `level`): beds then tools, each
  // `{kind, id, title, level}` (a tool also has its `game`).
  function unlocksAt(level, fromLevel) {
    const top = number(level);
    const low = fromLevel == null ? top - 1 : number(fromLevel);
    const within = (item) => item.level > low && item.level <= top;
    return [...BEDS.filter(within).map((bed) => ({ kind: "bed", id: bed.id, title: bed.title, level: bed.level })),
      ...TOOLS.filter(within).map((tool) => ({ kind: "tool", id: tool.id, title: tool.title, level: tool.level,
        game: tool.game }))];
  }

  /**
   * Count each bed's questions and the ones filled in.
   *
   * A bed counts its topic's top-level questions asked at the effort (Low asks from the Medium list); a conditional
   * question is left out of the total but counts as filled when it is. Filled: answered (not skipped) in the
   * walkthrough, or one of its fields (else the input list its action writes) differs from the example household.
   * A bed with no question at the effort, or an optional topic not opened in the walkthrough with nothing filled, is
   * a rest bed.
   *
   * @param {object} tree - The walkthrough tree (`topics`, each with `questions`).
   * @param {object} ctx - `{answers, opened, inputs, defaults, effort, tierShown, valueAt, same}`: the saved answers
   *     and opened ids, the scenario's inputs, the example's, the effort, and the app's helpers (whether a tier is
   *     shown at an effort; the value at a field path of some data; whether two values are the same).
   * @returns {object[]} `{id, topic, title, level, filled, total, rest}` per bed, in table order.
   */
  function bedCounts(tree, ctx) {
    const topics = isRecord(tree) && Array.isArray(tree.topics) ? tree.topics : [];
    const { answers, opened, inputs, defaults, effort, tierShown, valueAt, same } = isRecord(ctx) ? ctx : {};
    const saved = isRecord(answers) ? answers : {};
    const openedIds = Array.isArray(opened) ? opened : [];
    const asked = effort === "low" ? "medium" : effort;
    const differs = (path) => !same(valueAt(inputs, path), valueAt(defaults, path));
    const filledOf = (node) => {
      const answer = saved[node.id];
      if (isRecord(answer) && answer.status === "answered") return true;
      if (!isRecord(inputs) || !isRecord(defaults)) return false;
      const fields = Array.isArray(node.fields) ? node.fields : [];
      if (fields.length) return fields.some((field) => isRecord(field) && differs(field.path));
      return (ACTION_PATHS[node.action] || []).some(differs);
    };
    return BEDS.map((bed) => {
      const topic = topics.find((item) => isRecord(item) && item.id === bed.topic);
      const shown = (topic && Array.isArray(topic.questions) ? topic.questions : [])
        .filter((node) => isRecord(node) && tierShown(node.tier, asked));
      const total = shown.filter((node) => !node.conditional).length;
      const filled = Math.min(total, shown.filter(filledOf).length);
      const unopened = bed.optional === true && !openedIds.includes(bed.topic) && filled === 0;
      return { id: bed.id, topic: bed.topic, title: bed.title, level: bed.level, filled, total,
        rest: total === 0 || unopened };
    });
  }

  // The soil share of the open beds (ids in `open`, every bed when absent), rest beds left out: filled over total.
  function soilOf(counts, open) {
    const list = (Array.isArray(counts) ? counts : [])
      .filter((bed) => isRecord(bed) && !bed.rest && (!Array.isArray(open) || open.includes(bed.id)));
    const total = list.reduce((sum, bed) => sum + number(bed.total), 0);
    const filled = list.reduce((sum, bed) => sum + Math.min(number(bed.filled), number(bed.total)), 0);
    return total > 0 ? filled / total : 0;
  }

  // The plants' stage for a chance of success: 0 "seedlings" without a simulation, then 1 to 4 ("in bloom").
  function growthStage(share) {
    if (share == null || !Number.isFinite(Number(share))) return { stage: 0, name: "seedlings" };
    const found = GROWTH.find((row) => Number(share) < row.below);
    return { stage: found.stage, name: found.name };
  }

  // The season `yearsIn` plan years after the start: each year Spring, Summer, Autumn, Winter in quarters.
  function seasonAt(yearsIn) {
    const value = Math.max(0, number(yearsIn));
    const year = Math.floor(value);
    const season = Math.min(SEASONS.length - 1, Math.floor((value - year) * SEASONS.length));
    return { season, name: SEASONS[season], year };
  }

  /**
   * The level-up card for one evaluation's grants, or null when no level was reached.
   *
   * @param {object[]} grants - From `evaluate` (not changed).
   * @param {function} nameOf - The app's name of a grant for the "what earned it" lines.
   * @param {number} [fromLevel] - The level before the grants (default the reached level less one).
   * @returns {object|null} `{level, name, steps, more, unlocks}`: up to three steps `{text, xp}`, largest XP first;
   *     `more` the count of the rest; `unlocks` the names of what opened (one line saying all is open at the top).
   */
  function levelUpCard(grants, nameOf, fromLevel) {
    const list = Array.isArray(grants) ? grants.filter(isRecord) : [];
    const reached = list.find((grant) => grant.kind === "level");
    if (!reached) return null;
    const name = typeof nameOf === "function" ? nameOf : (grant) => grant.title || grant.key;
    const earned = list.filter((grant) => grant.kind !== "level" && grant.kind !== "award" && number(grant.xp) > 0)
      .map((grant, position) => ({ grant, position }))
      .sort((one, two) => number(two.grant.xp) - number(one.grant.xp) || one.position - two.position)
      .map(({ grant }) => ({ text: String(name(grant)), xp: number(grant.xp) }));
    const opened = unlocksAt(reached.level, fromLevel).map((item) => (item.kind === "tool"
      ? item.title + " tool" : item.title + " bed"));
    const top = reached.level >= LEVELS[LEVELS.length - 1].level;
    return { level: reached.level, name: reached.name, steps: earned.slice(0, MAX_STEPS),
      more: Math.max(0, earned.length - MAX_STEPS), unlocks: opened.length ? opened : top ? ["Every bed and tool is open"] : [] };
  }

  const api = { VERSION, MAX_KEYS, GAME_IDS, LEVELS, XP, QUESTS, AWARDS, emptyLedger, cleanLedger, mergeLedgers, xpOf, levelOf,
    gamifyFacts, questStatus, evaluate, resetLedger, grantsText,
    ORIGINAL_GAME_IDS, TOOLS, toolsOpen, toolOf,
    BEDS, ACTION_PATHS, SEASONS, bedsOpen, unlocksAt, bedCounts, soilOf, growthStage, seasonAt, levelUpCard };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WmtiGamify = api;
})(typeof self !== "undefined" ? self : this);

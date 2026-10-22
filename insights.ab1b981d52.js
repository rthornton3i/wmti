// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// Insights: warnings and opportunities drawn by rules from a finished Monte Carlo result and the inputs it ran on.
// Every rule is a small pure function with named thresholds; it returns one item ({id, age, text} plus a severity or
// a dollar size to rank by) or null when the data does not show it. Opportunities use simple, labelled arithmetic:
// compound growth at the plan's own expected real return, never a new simulation. Wording is factual ("would add
// about"), and every number is rounded. Both the report (report.js) and the app's Outputs > Summary card use
// `insights`; it runs in Node for the tests.
(function (root) {
  "use strict";

  const shared = typeof module !== "undefined" && module.exports ? require("./shared.js") : root.WmtiShared;
  const { fullMoney, percent } = shared;

  const MAX_ITEMS = 5;  // warnings, and opportunities, shown at most
  const NOTE = "Estimates from this plan's own numbers; not financial advice.";
  const EMPTY_BALANCE = 1;  // a balance or amount at or below this many dollars counts as zero
  const FALLING_YEARS = 3;  // the median balance falling this many years in a row is a warning
  const LIQUID_YEARS = 2;  // the median balance below this many years of spending is a warning
  const WITHDRAWAL_RATE = 0.05;  // a year's withdrawals above this share of the balance before it is a warning
  const RUN_OUT_SHARE = 0.1;  // a chance of running out above this is a warning
  const TAX_JUMP_SHARE = 0.5;  // a one-year rise in total taxes of at least half the year before...
  const TAX_JUMP_FLOOR = 5000;  // ...and at least this many dollars is a warning
  const CUT_SHARE = 0.1;  // the cut in the largest expense category the opportunity prices
  const SAVED_YEARLY = 1000;  // the yearly saving the "each $1,000" opportunity grows
  const TOP_CATEGORIES = 3;  // expense categories named by size
  const RESERVE_MONTHS = 6;  // months of today's spending kept as an emergency reserve in cash
  const CASH_FLOOR = 1000;  // cash above the reserve smaller than this is not worth an item
  const CASH_KINDS = ["Checking", "Savings", "CD & Bonds"];
  const INVESTMENT_KIND = "Investments";
  const FIGURES = 2;  // significant figures money is rounded to
  // Fixed severities for ranking warnings (the chance of running out ranks by the chance itself, from 0.1 to 1).
  const SEVERITY = { unpaid: 0.9, lowLiquid: 0.6, withdrawalRate: 0.5, falling: 0.4, drainedEarly: 0.3, taxJump: 0.2 };

  // ---- data helpers ----

  const isEmpty = (value) => !(Number(value) > EMPTY_BALANCE);
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

  // Money rounded to `FIGURES` significant figures: $1,234,567 -> $1,200,000, $3,456 -> $3,500.
  function roundMoney(value) {
    const size = Math.abs(number(value));
    if (size < 1) return 0;
    const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(size)) - FIGURES + 1));
    return Math.sign(value) * Math.round(size / step) * step;
  }
  const money = (value) => fullMoney(roundMoney(value));

  const chartOf = (monteCarlo, id) => ((monteCarlo && monteCarlo.charts) || []).find((spec) => spec.id === id) || null;
  const agesOf = (spec) => (spec && spec.x && spec.x.values) || [];
  const seriesNamed = (spec, name) => ((spec && spec.series) || []).find((item) => item.name === name) || null;
  const totals = (spec) => agesOf(spec).map((unused, position) => ((spec && spec.series) || []).reduce((sum, item) =>
    sum + number(item.values[position]), 0));

  // A column of the yearly table (the summary frame) lined up with `ages` (your age); zeros when it is missing.
  function yearlyColumn(monteCarlo, name, ages) {
    const summary = monteCarlo && monteCarlo.tables && monteCarlo.tables.summary;
    const column = summary ? summary.columns.indexOf(name) : -1;
    const ageColumn = summary ? summary.columns.indexOf("Age (you)") : -1;
    if (column < 0 || ageColumn < 0) return ages.map(() => 0);
    const byAge = new Map(summary.data.map((row) => [row[ageColumn], number(row[column])]));
    return ages.map((age) => (byAge.has(age) ? byAge.get(age) : 0));
  }

  // The first position where a series that held money reaches zero, or -1.
  function emptiesAt(values) {
    for (let position = 1; position < values.length; position += 1) {
      if (isEmpty(values[position]) && values.slice(0, position).some((value) => !isEmpty(value))) return position;
    }
    return -1;
  }

  // ---- growth arithmetic ----

  // The plan's expected return: the accounts' expected returns weighted by today's balances (a plain average when
  // every balance is zero), and the real return after the expected inflation (the mean of its minimum, mode and
  // maximum). Null when no account has an expected return.
  function expectedReturn(inputs) {
    const accounts = ((inputs && inputs.accounts) || []).filter((account) => Number.isFinite(account.meanReturn));
    if (!accounts.length) return null;
    const weight = accounts.reduce((sum, account) => sum + Math.max(0, number(account.startingValue)), 0);
    const nominal = weight > 0
      ? accounts.reduce((sum, account) => sum + account.meanReturn * Math.max(0, number(account.startingValue)), 0) / weight
      : accounts.reduce((sum, account) => sum + account.meanReturn, 0) / accounts.length;
    const band = (inputs && inputs.inflation) || {};
    const parts = [band.minimum, band.mode, band.maximum].filter(Number.isFinite);
    const inflation = parts.length ? parts.reduce((sum, value) => sum + value, 0) / parts.length : 0;
    return { nominal, inflation, real: (1 + nominal) / (1 + inflation) - 1 };
  }

  const realOf = (rate, inflation) => (1 + rate) / (1 + inflation) - 1;
  // What `amount` a year for `years` years grows to at `rate`, each year's amount added at the year's end.
  const yearlyGrowth = (amount, rate, years) => (years <= 0 ? 0
    : Math.abs(rate) < 1e-9 ? amount * years : amount * (Math.pow(1 + rate, years) - 1) / rate);

  // The age the opportunities grow to: your retirement (the age your pay ends) while you work and it is ahead, else
  // the plan's last age; with the years from now and how to name it.
  function horizon(inputs, ages) {
    const you = (inputs && inputs.you) || {};
    const now = Number.isFinite(you.currentAge) ? you.currentAge : ages[0];
    const working = !you.retired && number(you.salary) > 0 && Number.isFinite(you.salaryEndAge) && you.salaryEndAge > now;
    if (working) return { age: you.salaryEndAge, years: you.salaryEndAge - now, working, label: "by retirement at age "
      + you.salaryEndAge };
    const last = ages.length ? ages[ages.length - 1] : now;
    return { age: last, years: last - now + 1, working, label: "by age " + last + ", the end of the plan" };
  }

  const rateText = (rate) => percent(rate, 1);

  // ---- warnings ----

  // The median balance falling `FALLING_YEARS` or more years in a row: the longest such run (the larger fall on a
  // tie), from the year before the first fall to the last fall.
  function fallingWorth(monteCarlo) {
    const spec = chartOf(monteCarlo, "bands");
    const ages = agesOf(spec);
    const values = spec ? spec.series[0].values.map(number) : [];
    let start = -1;
    let best = null;
    for (let position = 1; position <= values.length; position += 1) {
      const falls = position < values.length && values[position] < values[position - 1] - EMPTY_BALANCE
        && !isEmpty(values[position - 1]);
      if (falls && start < 0) start = position;
      if (!falls && start >= 0) {
        const run = { start, end: position - 1, years: position - start, fall: values[start - 1] - values[position - 1] };
        if (run.years >= FALLING_YEARS && (!best || run.years > best.years
          || (run.years === best.years && run.fall > best.fall))) best = run;
        start = -1;
      }
    }
    if (!best) return null;
    return { id: "falling", age: ages[best.start], severity: SEVERITY.falling,
      text: "The median balance falls " + best.years + " years in a row, from age " + ages[best.start - 1] + " to age "
        + ages[best.end] + " (about " + money(values[best.start - 1]) + " to " + money(values[best.end]) + ")." };
  }

  // The median balance of the accounts (homes and cars are not in it) below `LIQUID_YEARS` years of that year's
  // spending, in a year without pay (pay covers spending while working): the first such year.
  function lowLiquid(monteCarlo) {
    const bands = chartOf(monteCarlo, "bands");
    const spending = totals(chartOf(monteCarlo, "expenses"));
    const pay = seriesNamed(chartOf(monteCarlo, "cashFlow"), "Paycheck");
    const ages = agesOf(bands);
    if (!bands || !spending.length) return null;
    const values = bands.series[0].values.map(number);
    const position = ages.findIndex((age, index) => spending[index] > EMPTY_BALANCE
      && values[index] < LIQUID_YEARS * spending[index] && !(pay && !isEmpty(pay.values[index])));
    if (position < 0) return null;
    return { id: "lowLiquid", age: ages[position], severity: SEVERITY.lowLiquid,
      text: "From age " + ages[position] + (pay ? ", with no pay," : "") + " the median balance of the accounts (homes "
        + "and cars left out), about "
        + money(values[position]) + ", covers less than " + LIQUID_YEARS + " years of spending (about "
        + money(spending[position]) + " that year)." };
  }

  // A year's withdrawals above `WITHDRAWAL_RATE` of the accounts' balance at the end of the year before, in a year
  // without pay (withdrawals while working pay for one-off costs): the first such year, with its rate.
  function withdrawalRate(monteCarlo) {
    const cashFlow = chartOf(monteCarlo, "cashFlow");
    const flows = seriesNamed(cashFlow, "Withdrawals");
    const pay = seriesNamed(cashFlow, "Paycheck");
    const balances = chartOf(monteCarlo, "balances");
    const ages = agesOf(balances);
    if (!flows || !balances) return null;
    const total = totals(balances);
    for (let position = 1; position < ages.length; position += 1) {
      if (isEmpty(total[position - 1]) || (pay && !isEmpty(pay.values[position]))) continue;
      const rate = Math.abs(number(flows.values[position])) / total[position - 1];
      if (rate > WITHDRAWAL_RATE) {
        return { id: "withdrawalRate", age: ages[position], severity: SEVERITY.withdrawalRate,
          text: "At age " + ages[position] + (pay ? ", with no pay," : "") + " withdrawals reach about " + percent(rate, 0) + " of the accounts' "
            + "balance (" + money(Math.abs(flows.values[position])) + " of about " + money(total[position - 1])
            + "), above a " + percent(WITHDRAWAL_RATE, 0) + " rate." };
      }
    }
    return null;
  }

  // The chance of running out above `RUN_OUT_SHARE`, with the age the median (or else the low band) runs out.
  function runOutChance(monteCarlo) {
    const item = ((monteCarlo && monteCarlo.headlines) || []).find((headline) => headline.label === "Chance of running out");
    if (!item || !(item.value > RUN_OUT_SHARE)) return null;
    const spec = chartOf(monteCarlo, "bands");
    const ages = agesOf(spec);
    const series = spec ? spec.series[0] : null;
    const [low] = (spec && spec.percentiles) || [10, 90];
    const median = series ? emptiesAt(series.values) : -1;
    const lowOut = series && series.low ? emptiesAt(series.low) : -1;
    const when = median >= 0 ? "; the median run runs out at age " + ages[median]
      : lowOut >= 0 ? "; at the " + low + "th percentile the money runs out at age " + ages[lowOut] : "";
    const age = median >= 0 ? ages[median] : lowOut >= 0 ? ages[lowOut] : null;
    return { id: "runOut", age, severity: Math.min(1, item.value),
      text: percent(item.value, 0) + " of the runs run out of money before the plan ends" + when + "." };
  }

  // What the yearly table shows beginning in the year at `position` as the cause of a tax rise: a home sale's gain,
  // a sale's proceeds, Roth conversions or required minimum distributions starting; null when none does.
  function taxCause(monteCarlo, ages, position) {
    const column = (name) => yearlyColumn(monteCarlo, name, ages);
    const begins = (values) => !isEmpty(values[position]) && (position === 0 || isEmpty(values[position - 1]));
    if (!isEmpty(column("Home Sale Gain")[position])) return "the home sale's gain";
    if (begins(column("Asset Sale Proceeds"))) return "a sale that year";
    if (begins(column("Roth Conversion"))) return "Roth conversions starting";
    if (begins(column("Required Withdrawal"))) return "required minimum distributions starting";
    return null;
  }

  // The largest one-year rise in total taxes of at least `TAX_JUMP_SHARE` of the year before and `TAX_JUMP_FLOOR`
  // dollars (a rise from zero passes the share), with its cause when the yearly table shows one.
  function taxJump(monteCarlo) {
    const spec = chartOf(monteCarlo, "taxes");
    const ages = agesOf(spec);
    const total = totals(spec);
    let found = -1;
    let size = 0;
    for (let position = 1; position < total.length; position += 1) {
      const rise = total[position] - total[position - 1];
      if (rise < TAX_JUMP_FLOOR || rise <= size) continue;
      if (total[position - 1] > EMPTY_BALANCE && rise / total[position - 1] < TAX_JUMP_SHARE) continue;
      found = position;
      size = rise;
    }
    if (found < 0) return null;
    const cause = taxCause(monteCarlo, ages, found);
    return { id: "taxJump", age: ages[found], severity: SEVERITY.taxJump,
      text: "Taxes jump by about " + money(size) + " at age " + ages[found] + " (about " + money(total[found - 1])
        + " to " + money(total[found]) + ")" + (cause ? ", from " + cause : "") + "." };
  }

  // An account drained earlier than the withdrawal order suggests: by priority (the accounts in row order), one that
  // empties while an account before it still holds money; taken proportionally, one that empties while another still
  // holds money. The first such account.
  function drainedEarly(monteCarlo, inputs) {
    const spec = chartOf(monteCarlo, "balances");
    const ages = agesOf(spec);
    if (!spec) return null;
    const proportional = String((inputs && inputs.withdrawalStrategy) || "PRIORITY").toUpperCase() === "PROPORTIONAL";
    const drained = spec.series.map((item, order) => ({ name: item.name, order, at: emptiesAt(item.values) }))
      .filter((item) => item.at >= 0).sort((left, right) => left.at - right.at || left.order - right.order);
    for (const item of drained) {
      const others = spec.series.filter((other, order) => (proportional ? order !== item.order : order < item.order))
        .filter((other) => !isEmpty(other.values[item.at]));
      if (!others.length) continue;
      return { id: "drainedEarly", age: ages[item.at], severity: SEVERITY.drainedEarly,
        text: item.name + " is drained at age " + ages[item.at] + " while " + others[0].name + " still holds about "
          + money(others[0].values[item.at]) + (proportional ? ", though withdrawals are taken from every account in "
          + "proportion." : ", though it comes earlier in the withdrawal order.") };
    }
    return null;
  }

  // Years where spending and taxes exceed income plus withdrawals, so some goes unpaid (the yearly Shortfall).
  function unpaidSpending(monteCarlo) {
    const spec = chartOf(monteCarlo, "cashFlow");
    const series = seriesNamed(spec, "Shortfall (unpaid)");
    const ages = agesOf(spec);
    if (!series) return null;
    const values = series.values.map((value) => Math.abs(number(value)));
    const years = values.filter((value) => !isEmpty(value)).length;
    if (!years) return null;
    const first = values.findIndex((value) => !isEmpty(value));
    const worst = values.reduce((best, value, position) => (value > values[best] ? position : best), first);
    return { id: "unpaid", age: ages[first], severity: SEVERITY.unpaid,
      text: "Spending and taxes exceed income plus withdrawals in " + years + (years === 1 ? " year" : " years")
        + " of the plan, from age " + ages[first] + "; the most left unpaid is about " + money(values[worst])
        + ", at age " + ages[worst] + "." };
  }

  // ---- opportunities ----

  // Today's (the first year's) amount of each expense category, largest first; categories at zero left out.
  function categoriesToday(monteCarlo) {
    const spec = chartOf(monteCarlo, "expenses");
    if (!spec || !agesOf(spec).length) return [];
    return spec.series.map((item) => ({ name: item.name, amount: number(item.values[0]) }))
      .filter((item) => !isEmpty(item.amount)).sort((left, right) => right.amount - left.amount);
  }

  // Cutting the largest category by `CUT_SHARE` from today, the yearly saving invested at the real return.
  function cutLargest(monteCarlo, inputs, growth, reach) {
    const [largest] = categoriesToday(monteCarlo);
    if (!largest || !growth || reach.years <= 0) return null;
    const saved = largest.amount * CUT_SHARE;
    const size = yearlyGrowth(saved, growth.real, reach.years);
    if (isEmpty(roundMoney(size))) return null;
    return { id: "cutLargest", age: reach.age, size,
      text: "Cutting your largest expense category (" + largest.name + ", about " + money(largest.amount)
        + " a year today) by " + percent(CUT_SHARE, 0) + " from today would add about " + money(size)
        + " to net worth " + reach.label + ", if the " + money(saved) + " a year saved were invested at the plan's "
        + "expected real return of " + rateText(growth.real) + " (today's value)." };
  }

  // Each `SAVED_YEARLY` a year saved before retirement, grown at the real return.
  function savedYearly(inputs, growth, reach) {
    if (!growth || !reach.working || reach.years <= 0) return null;
    const size = yearlyGrowth(SAVED_YEARLY, growth.real, reach.years);
    return { id: "savedYearly", age: reach.age, size,
      text: "Each " + fullMoney(SAVED_YEARLY) + " a year saved before retirement would grow to about " + money(size)
        + " " + reach.label + " at the plan's expected real return of " + rateText(growth.real) + " (today's value)." };
  }

  // The `TOP_CATEGORIES` largest expense categories today and their share of today's spending.
  function largestCategories(monteCarlo) {
    const categories = categoriesToday(monteCarlo);
    if (!categories.length) return null;
    const total = categories.reduce((sum, item) => sum + item.amount, 0);
    const named = categories.slice(0, TOP_CATEGORIES).map((item) => item.name + " (about " + money(item.amount)
      + " a year, " + percent(item.amount / total, 0) + ")");
    const list = named.length > 1 ? named.slice(0, -1).join(", ") + " and " + named[named.length - 1] : named[0];
    return { id: "largestCategories", age: null, size: 0,
      text: (named.length > 1 ? "Your largest expense categories today are " : "Your only expense category today is ")
        + list + "." };
  }

  // An employer match not fully used: the person deposits less of their pay than the employer matches up to. The
  // extra match a year at today's pay, grown at the real return to the year their pay ends. One item per person.
  function unusedMatch(inputs, growth) {
    const plan = (inputs && inputs.contributions) || {};
    const share = plan.enabled ? number(plan.traditionalShare) : 0;
    const items = [];
    for (const [role, whose] of [["you", "Your"], ["partner", "Your partner's"]]) {
      const person = inputs && inputs[role];
      const match = person && person.employerMatch;
      if (!person || person.retired || !match || !match.enabled || !(match.rate > 0) || !(match.cap > share)) continue;
      const salary = number(person.salary);
      const years = number(person.salaryEndAge) - number(person.currentAge);
      if (salary <= 0 || years <= 0) continue;
      const extra = (match.cap - share) * salary * match.rate;
      const size = growth ? yearlyGrowth(extra, growth.real, years) : extra * years;
      items.push({ id: "unusedMatch-" + role, age: person.salaryEndAge, size,
        text: whose + " employer matches deposits up to " + percent(match.cap, 1) + " of pay, and the plan deposits "
          + percent(share, 1) + "; depositing the difference would bring about " + money(extra) + " a year more in "
          + "match at today's pay, about " + money(size) + " by the time that pay ends"
          + (growth ? " at the plan's expected real return of " + rateText(growth.real) : "") + " (today's value)." });
    }
    return items;
  }

  // Cash above a `RESERVE_MONTHS` reserve of today's spending that is expected to earn less than the investments do:
  // the difference the two returns make by the horizon.
  function idleCash(monteCarlo, inputs, growth, reach) {
    const accounts = (inputs && inputs.accounts) || [];
    const cash = accounts.filter((account) => CASH_KINDS.includes(account.kind));
    const invest = accounts.filter((account) => account.kind === INVESTMENT_KIND && Number.isFinite(account.meanReturn));
    const spending = categoriesToday(monteCarlo).reduce((sum, item) => sum + item.amount, 0);
    if (!cash.length || !invest.length || !growth || reach.years <= 0) return null;
    const held = cash.reduce((sum, account) => sum + Math.max(0, number(account.startingValue)), 0);
    const reserve = spending / 12 * RESERVE_MONTHS;
    const excess = held - reserve;
    if (excess < CASH_FLOOR) return null;
    const cashRate = cash.reduce((sum, account) => sum + number(account.meanReturn) * Math.max(0,
      number(account.startingValue)), 0) / held;
    const best = invest.reduce((top, account) => (account.meanReturn > top.meanReturn ? account : top));
    if (!(best.meanReturn > cashRate)) return null;
    const size = excess * (Math.pow(1 + realOf(best.meanReturn, growth.inflation), reach.years)
      - Math.pow(1 + realOf(cashRate, growth.inflation), reach.years));
    if (isEmpty(roundMoney(size))) return null;
    return { id: "idleCash", age: reach.age, size,
      text: "About " + money(excess) + " of cash sits above a " + RESERVE_MONTHS + "-month reserve (about "
        + money(reserve) + ") and is expected to earn " + rateText(cashRate) + " against " + rateText(best.meanReturn)
        + " for " + best.name + "; at those returns, less inflation, the difference would be about " + money(size)
        + " " + reach.label + " (today's value), with the larger swings investments carry." };
  }

  // ---- all of it ----

  const bySeverity = (left, right) => right.severity - left.severity || (left.age == null) - (right.age == null)
    || (left.age || 0) - (right.age || 0);
  const bySize = (left, right) => right.size - left.size;

  // The insights of a finished Monte Carlo result and the inputs it ran on: {warnings, opportunities, note}, each list
  // ranked (warnings by severity, opportunities by dollar size) and at most `MAX_ITEMS` long; an empty list for a
  // kind with nothing to say.
  function insights(inputs, monteCarlo) {
    if (!monteCarlo || !monteCarlo.charts) return { warnings: [], opportunities: [], note: NOTE };
    const warnings = [unpaidSpending(monteCarlo), runOutChance(monteCarlo), lowLiquid(monteCarlo),
      withdrawalRate(monteCarlo), fallingWorth(monteCarlo), drainedEarly(monteCarlo, inputs), taxJump(monteCarlo)]
      .filter(Boolean).sort(bySeverity).slice(0, MAX_ITEMS);
    const growth = expectedReturn(inputs);
    const reach = horizon(inputs, agesOf(chartOf(monteCarlo, "bands")));
    const opportunities = [cutLargest(monteCarlo, inputs, growth, reach), savedYearly(inputs, growth, reach),
      ...unusedMatch(inputs, growth), idleCash(monteCarlo, inputs, growth, reach), largestCategories(monteCarlo)]
      .filter(Boolean).sort(bySize).slice(0, MAX_ITEMS);
    return { warnings, opportunities, note: NOTE };
  }

  // The insights as plain text lines: a heading per kind with items, then the note.
  function insightLines(found) {
    const lines = [];
    if (found.warnings.length) lines.push("Warnings", ...found.warnings.map((item) => "- " + item.text));
    if (found.opportunities.length) lines.push("Opportunities", ...found.opportunities.map((item) => "- " + item.text));
    if (lines.length) lines.push(found.note);
    return lines;
  }

  const api = { MAX_ITEMS, NOTE, EMPTY_BALANCE, FALLING_YEARS, LIQUID_YEARS, WITHDRAWAL_RATE, RUN_OUT_SHARE,
    TAX_JUMP_SHARE, TAX_JUMP_FLOOR, CUT_SHARE, SAVED_YEARLY, TOP_CATEGORIES, RESERVE_MONTHS, CASH_FLOOR, SEVERITY,
    roundMoney, expectedReturn, yearlyGrowth, horizon, fallingWorth, lowLiquid, withdrawalRate, runOutChance, taxJump,
    drainedEarly, unpaidSpending, categoriesToday, cutLargest, savedYearly, largestCategories, unusedMatch, idleCash,
    insights, insightLines };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WmtiInsights = api;
})(typeof self !== "undefined" ? self : this);

// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// Small pure helpers shared by the page, the charts and the Node tests: text escaping, number formats, the
// scenario name rule, dotted-path access into the inputs JSON, the list-item sheet layout, the Compare pair and the
// tab route of a hash or saved tab name, and the About window's update-check wording.
// No financial rule lives here: the categories and kinds the sheet rules use come from appInfo().sheetRules.
(function (root) {
  "use strict";

  const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

  function escapeText(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ESCAPES[character]);
  }

  // Same text as wmti.dashboard.style.compactMoney: $1.50M, $12.00k or $950.
  function compactMoney(value) {
    if (value == null || !isFinite(value)) return "n/a";
    const sign = value < 0 ? "-" : "";
    const size = Math.abs(value);
    if (size >= 1e6) return sign + "$" + groupDigits((size / 1e6).toFixed(2)) + "M";
    if (size >= 1e3) return sign + "$" + groupDigits((size / 1e3).toFixed(2)) + "k";
    return sign + "$" + groupDigits(size.toFixed(0));
  }

  function groupDigits(text) {
    const [whole, fraction] = text.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fraction === undefined ? grouped : grouped + "." + fraction;
  }

  function fullMoney(value) {
    if (value == null || !isFinite(value)) return "n/a";
    const sign = value < 0 ? "-" : "";
    return sign + "$" + groupDigits(Math.abs(value).toFixed(0));
  }

  // Short axis ticks: $0, $250k, $1.5M.
  function tickMoney(value) {
    const size = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (size >= 1e6) return sign + "$" + trimZeros((size / 1e6).toFixed(2)) + "M";
    if (size >= 1e3) return sign + "$" + trimZeros((size / 1e3).toFixed(1)) + "k";
    return sign + "$" + size.toFixed(0);
  }

  function trimZeros(text) {
    return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
  }

  function percent(value, digits) {
    if (value == null || !isFinite(value)) return "n/a";
    return trimZeros((value * 100).toFixed(digits == null ? 1 : digits)) + "%";
  }

  function formatValue(value, unit) {
    if (value == null) return "n/a";
    if (typeof value !== "number") return String(value);
    if (unit === "money") return fullMoney(value);
    if (unit === "percent") return percent(value, 2);
    return groupDigits(String(Math.round(value * 1000) / 1000));
  }

  // The scenario name rule, from wmti.inputs.scenarios.scenarioNameRules (sent by appInfo). Returns
  // {ok, name} with the trimmed name, or {ok: false, error} naming the rules.
  function checkScenarioName(name, rules) {
    let trimmed = String(name == null ? "" : name);
    if (rules.trim) {
      trimmed = trimmed.trim();
      if (trimmed.toLowerCase().endsWith(".json")) trimmed = trimmed.slice(0, -5);
    }
    const objectKeys = rules.objectKeys || [];
    const deviceNames = rules.deviceNames || [];
    const reserved = rules.reserved.concat(objectKeys).map((item) => item.toLowerCase());
    const valid = trimmed.length > 0 && new RegExp(rules.pattern).test(trimmed)
      && !(rules.noLeadingDot && trimmed.startsWith("."))
      && !(rules.noTrailingDotOrSpace && (trimmed.endsWith(".") || trimmed.endsWith(" ")))
      && !reserved.includes(trimmed.toLowerCase())
      && !deviceNames.includes(trimmed.split(".")[0].trimEnd().toUpperCase());
    if (valid) return { ok: true, name: trimmed };
    return { ok: false, error: "Use letters, digits, spaces, '-', '_' or '.', do not start with '.' or end with '.' "
      + "or a space, and avoid " + rules.reserved.map((item) => "'" + item + "'").join(" and ")
      + (objectKeys.length ? ", " + objectKeys.map((item) => "'" + item + "'").join(", ") : "")
      + (deviceNames.length ? " and Windows device names such as CON, NUL, COM1 or LPT1" : "") + "." };
  }

  // The first list or table longer than its limit in a scenario file's parsed JSON: the loader's own rule and message
  // (the size check of wmti.inputs.retirementInputs._checkFiniteAndSized, limits from appInfo().listLimits), so the
  // page refuses an oversized file before the worker reads it. Null when there is none; the worker checks the rest.
  function scenarioFileProblem(data, limits) {
    const visit = (value, where, field) => {
      if (value === null || typeof value !== "object") return null;
      const isList = Array.isArray(value);
      const keys = isList ? null : Object.keys(value);
      const size = isList ? value.length : keys.length;
      const limit = Object.prototype.hasOwnProperty.call(limits.byField, field) ? limits.byField[field] : limits.other;
      if (size > limit) {
        return where + ": " + size + " rows is too many; a scenario holds at most " + limit + ", so remove some";
      }
      if (!isList) {
        for (const key of keys) {
          const path = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? where + "." + key : where + "[" + key + "]";
          const problem = visit(value[key], path, key);
          if (problem) return problem;
        }
        return null;
      }
      for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        const name = item && typeof item === "object" && !Array.isArray(item) ? item.name : undefined;
        const problem = visit(item, where + "[" + (typeof name === "string" ? name : index) + "]", "");
        if (problem) return problem;
      }
      return null;
    };
    return visit(data, "inputs", "");
  }

  function getPath(data, path) {
    return path.split(".").reduce((value, part) => (value == null ? undefined : value[part]), data);
  }

  function setPath(data, path, value) {
    const parts = path.split(".");
    let target = data;
    for (const part of parts.slice(0, -1)) target = target[part];
    target[parts[parts.length - 1]] = value;
  }

  // Sheet layouts: the order a list item's fields are drawn in and the group a field sits in. Fields a layout does
  // not name follow in schema order, so a new input is never dropped from its sheet.
  const SHEET_LAYOUTS = {
    Account: {
      order: ["name", "kind", "owner", "startingValue", "meanReturn", "returnStdDev", "costBasis", "iraBasis",
        "surplusShare"],
      groups: { meanReturn: "returns", returnStdDev: "returns", costBasis: "returns", iraBasis: "returns" },
    },
    // Drawn in titled sections by each field's schema group (Value, Loan, Commute, Running costs, Replacement, Lease);
    // the miles per year close the Commute section, after the commute figures its switch shows. The purchase and sale
    // are set on the timeline (`timelineManaged`), so their sections are not drawn.
    Car: {
      order: ["name", "driver", "valueToday", "depreciationRate", "hasLoan", "loanBalance", "loanRate", "loanMonthsLeft",
        "loanExtraMonthly", "commutes", "commuteMilesOneWay", "commuteDaysPerYear", "commuteTollsPerDay",
        "otherMilesPerYear", "milesPerGallon", "insurancePerYear", "registrationPerYear", "maintenancePerYear",
        "replaceEveryYears", "replaceInYears", "replacementPrice", "leases", "leaseMonthly", "buysLater", "purchaseAge", "purchasePrice",
        "downPaymentRate", "salesTaxRate", "purchaseFees", "sellsLater", "saleAge", "salePrice", "sellingCostRate",
        "sellingFees", "prepayPenaltyRate"],
      groups: {},
      sections: true,
    },
    // The loan's own figures first, then its Starts later and Pay off early sections, each opened by its switch.
    Loan: {
      order: ["name", "kind", "balance", "annualRate", "remainingMonths", "extraMonthly", "refinance", "forgiveAtMonth",
        "paymentsInExpenses", "startsLater", "startYear", "paysOffEarly", "payoffAge", "prepayPenaltyRate"],
      groups: {},
      sections: true,
    },
    // Drawn in titled sections by each field's schema group (Basics, Mortgage, Property tax and insurance, Purchase,
    // Sale), in schema order; each switch opens its section.
    Home: { order: [], groups: {}, sections: true },
  };

  // Why a field is left off an item's sheet, or null when it is shown. `rules` is appInfo().sheetRules. The switches
  // the ownership timeline sets (a home's or car's purchase and sale: `timelineManaged`) and their figures are left to
  // the timeline, and so is a car's lane. The figures behind an item's other switches (a car's loan, commute and lease;
  // a home's mortgage; a loan's later start and early payoff: `itemSwitches`) show only while it is on, and the figures
  // a switch replaces (a car bought later has no value or balance today, a leased one no value, loan or replacement:
  // `itemSwitchReplaces`) only while it is off.
  function hiddenReason(typeName, name, item, rules) {
    const managed = (rules.timelineManaged || {})[typeName] || [];
    const switches = (rules.itemSwitches || {})[typeName] || {};
    if (managed.some((toggle) => toggle === name || (switches[toggle] || []).includes(name))) return "set on the timeline";
    if (typeName === "Car" && name === "lane") return "set by the timeline";
    for (const [toggle, names] of Object.entries((rules.itemSwitches || {})[typeName] || {})) {
      if (names.includes(name) && !item[toggle]) return "shown while its " + toggle + " switch is on";
    }
    for (const [toggle, names] of Object.entries((rules.itemSwitchReplaces || {})[typeName] || {})) {
      if (names.includes(name) && item[toggle]) return "not used while its " + toggle + " switch is on";
    }
    if (typeName === "Account") {
      if (name === "deposit") return "set per account on the Benefits page";
      if (name === "autoCreated") return "set by the Roth conversion switch";
      if (name === "costBasis" && item.kind !== rules.costBasisKind) return rules.costBasisKind + " accounts only";
      if (name === "iraBasis" && item.kind !== rules.iraBasisKind) return rules.iraBasisKind + " accounts only";
    }
    if (typeName === "ExpenseItem") {
      if ((name === "year" || name === "toAge") && item.category === rules.charityCategory) {
        return "not for " + rules.charityCategory + " rows";
      }
      // Child-year, education and child care costs are entered on Children and Benefits; a row's tag is kept as is.
      if (name === "child" || name === "education" || name === "dependentCare") {
        return "entered on the Children and Benefits pages";
      }
      if (name === "deduction" && item.category === rules.charityCategory) {
        return "always " + rules.charityCategory + " for " + rules.charityCategory + " rows";
      }
    }
    return null;
  }

  // The label a field takes on an item's sheet instead of its schema label, or null: a commuting car's miles per year
  // are the extra miles beyond the commute, and a figure takes its `switchLabels` label while that switch is on (a car
  // bought later shows its loan term).
  function sheetLabel(typeName, name, item, rules) {
    if (typeName === "Car" && name === "otherMilesPerYear" && item && item.commutes) return rules.carExtraMilesLabel;
    for (const [toggle, labels] of Object.entries((rules.switchLabels || {})[typeName] || {})) {
      if (item && item[toggle] && labels[name]) return labels[name];
    }
    return null;
  }

  // The switches on an item's sheet that show or hide other fields, so changing one redraws the sheet (the timeline's
  // switches are not on the sheet).
  function sheetSwitches(typeName, rules) {
    const managed = (rules.timelineManaged || {})[typeName] || [];
    return Object.keys((rules.itemSwitches || {})[typeName] || {}).filter((toggle) => !managed.includes(toggle));
  }

  // The fields of one list item's sheet: `shown` ({name, group}) in drawing order, `hidden` (name to reason) and
  // `sections`, true when the sheet is drawn in titled sections by schema group. `fields` are the schema fields of the
  // item's type.
  function sheetFields(typeName, item, fields, rules) {
    const names = fields.map((field) => field.name);
    const layout = SHEET_LAYOUTS[typeName] || { order: [], groups: {} };
    const ordered = layout.order.filter((name) => names.includes(name))
      .concat(names.filter((name) => !layout.order.includes(name)));
    const shown = [];
    const hidden = {};
    for (const name of ordered) {
      const reason = hiddenReason(typeName, name, item, rules);
      if (reason) hidden[name] = reason;
      else shown.push({ name, group: layout.groups[name] || null });
    }
    return { shown, hidden, sections: Boolean(layout.sections) };
  }

  // The values a change of `field` (already set on `item`) clears so the loader accepts the item: a Charity row is
  // paid every year (no ages), never a child cost, education or dependent care and always deducted as Charity; only the cost-basis kind keeps a cost basis, only the IRA-basis kind an IRA basis and only the 401k and IRA
  // kinds a deposit. Returns {field: value} for the fields that need clearing.
  function clearedOnChange(typeName, field, item, rules) {
    const cleared = {};
    if (typeName === "ExpenseItem" && field === "category" && item.category === rules.charityCategory) {
      if (item.year != null) cleared.year = null;
      if (item.toAge != null) cleared.toAge = null;
      if (item.child) cleared.child = false;
      if (item.deduction != null) cleared.deduction = null;
      if (item.education) cleared.education = false;
      if (item.dependentCare) cleared.dependentCare = false;
    }
    if (typeName === "Account" && field === "kind") {
      if (item.kind !== rules.costBasisKind && item.costBasis != null) cleared.costBasis = null;
      if (item.kind !== rules.iraBasisKind && item.iraBasis != null) cleared.iraBasis = null;
      if (!rules.depositKinds.includes(item.kind) && item.deposit != null) cleared.deposit = null;
    }
    return cleared;
  }

  // The returns an account takes from its kind (wmti.dashboard.editing.fillKindReturns): each of the mean return and
  // standard deviation that is blank, or still the previous kind's usual value, becomes the new kind's; a return the
  // user changed is kept. `previousKind` is null for a new account; `usual` is appInfo().usualReturns.
  function kindReturnsFilled(item, previousKind, usual) {
    const filled = {};
    const fresh = usual[item.kind];
    if (!fresh) return filled;
    const previous = previousKind != null ? usual[previousKind] : null;
    ["meanReturn", "returnStdDev"].forEach((name, position) => {
      const value = item[name];
      if (value == null || (previous && Number(value) === previous[position])) {
        if (value !== fresh[position]) filled[name] = fresh[position];
      }
    });
    return filled;
  }

  // The collapsed returns header of an account sheet, as the desktop's: "Return 6.0% · std dev 12.0%".
  function returnsSummary(meanReturn, returnStdDev) {
    return "Return " + (meanReturn * 100).toFixed(1) + "% · std dev " + (returnStdDev * 100).toFixed(1) + "%";
  }

  // The ages part of an expense card: "ages 50 to 60", "from age 50" ("at age 50" for a Major Spending row paid
  // once), "to age 60", or "" when the row has no ages.
  function expenseAgesText(item, rules) {
    const from = item.year, to = item.toAge;
    if (from != null && to != null) return "ages " + from + " to " + to;
    if (from != null) return (item.category === rules.majorCategory ? "at age " : "from age ") + from;
    if (to != null) return "to age " + to;
    return "";
  }

  // Config A and Config B from the stored choice (a list; older pages kept up to four names): a name no longer on
  // offer is replaced, and B is never A. A side with nothing left to offer is null.
  function normalPair(options, stored) {
    const list = Array.isArray(stored) ? stored : [];
    const first = options.includes(list[0]) ? list[0] : options[0];
    const second = options.includes(list[1]) && list[1] !== first ? list[1]
      : options.find((name) => name !== first);
    return [first === undefined ? null : first, second === undefined ? null : second];
  }

  // Where a tab name from the URL hash or saved prefs leads: {tab, view} with the bottom-bar tab (setup, inputs or
  // outputs) and, for Outputs, the view (summary, plots or compare; null keeps the current view). Takes the names of
  // the older five-tab page too (results, plots, settings, compare, more). Household and settings lead to Setup,
  // where the Household & run settings are. Savings and benefits lead to the Benefits chip of Inputs (`chip`);
  // healthcare to the Healthcare chip; retirement, medicare and the Social Security names to the Retirement chip, which
  // holds Social Security and Medicare. Unknown names give null.
  const ROUTES = {
    setup: ["setup", null], inputs: ["inputs", null], outputs: ["outputs", null],
    summary: ["outputs", "summary"], plots: ["outputs", "plots"], compare: ["outputs", "compare"],
    results: ["outputs", "summary"], settings: ["setup", null], household: ["setup", null], config: ["inputs", null],
    more: ["setup", null], benefits: ["inputs", null, "savings"], savings: ["inputs", null, "savings"],
    healthcare: ["inputs", null, "healthcare"], retirement: ["inputs", null, "retirement"],
    medicare: ["inputs", null, "retirement"], socialsecurity: ["inputs", null, "retirement"],
    "social-security": ["inputs", null, "retirement"], ss: ["inputs", null, "retirement"],
  };

  function tabRoute(name) {
    if (typeof name !== "string") return null;
    const key = name.replace(/^#/, "");
    if (!Object.prototype.hasOwnProperty.call(ROUTES, key)) return null;
    const [tab, view, chip] = ROUTES[key];
    return chip ? { tab, view, chip } : { tab, view };
  }

  // The Inputs chip to show: the stored one when Inputs still offers it, else the first chip (saved prefs of the
  // older page may hold "household", which is now on Setup; a stored "retirement" from the older Retirement expenses
  // chip opens the Retirement chip, which holds the household AGI under Medicare). Null when Inputs offers no chip.
  // A stored chip id that was renamed maps to its new id here; none is renamed now.
  const CHIP_ALIASES = {};

  function inputsChip(chipIds, stored) {
    if (!Array.isArray(chipIds) || chipIds.length === 0) return null;
    const chip = Object.prototype.hasOwnProperty.call(CHIP_ALIASES, stored) ? CHIP_ALIASES[stored] : stored;
    return chipIds.includes(chip) ? chip : chipIds[0];
  }

  // The schema field a panel lists by name: a top-level field, or `field.child` for one field of a top-level object
  // split between panels. Null when there is none.
  function panelField(schema, name) {
    const [parent, child] = String(name).split(".");
    const field = (schema.types[schema.root] || []).find((item) => item.name === parent);
    if (!field || child === undefined) return field || null;
    return (schema.types[field.type] || []).find((item) => item.name === child) || null;
  }

  // Whether two settings values are the same: numbers, text, switches, lists and objects compared in depth.
  function sameValue(left, right) {
    if (left === right) return true;
    if (left == null || right == null || typeof left !== "object" || typeof right !== "object") return false;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => sameValue(left[key], right[key]));
  }

  // The shipped value of each figure of a Reset to defaults group (`schema.resetGroups[root]`), from the schema.
  function shippedFigures(schema, root) {
    const group = schema.resetGroups[root];
    const fields = schema.types[panelField(schema, root).type] || [];
    const values = {};
    for (const name of group.fields) values[name] = fields.find((item) => item.name === name).default;
    return values;
  }

  // Turn off each group's on-defaults switch once one of its figures differs from the shipped value, as the desktop
  // does; the switch comes back on only through Reset to defaults. Returns whether a switch changed.
  function syncResetFlags(schema, inputs) {
    let changed = false;
    for (const root of Object.keys(schema.resetGroups || {})) {
      const group = schema.resetGroups[root];
      const settings = inputs[root];
      if (!settings || !settings[group.flag]) continue;
      const shipped = shippedFigures(schema, root);
      if (!group.fields.every((name) => sameValue(settings[name], shipped[name]))) {
        settings[group.flag] = false;
        changed = true;
      }
    }
    return changed;
  }

  // Put a group's shipped figures back and turn its on-defaults switch on.
  function resetGroup(schema, inputs, root) {
    const shipped = shippedFigures(schema, root);
    for (const name of Object.keys(shipped)) inputs[root][name] = JSON.parse(JSON.stringify(shipped[name]));
    inputs[root][schema.resetGroups[root].flag] = true;
  }

  // Same points as wmti.dashboard.curves.normalCurve: evenly spaced x from low to high and the normal density at
  // each, scaled to a peak of 1; with no spread, 1 at the point nearest the mean and 0 elsewhere.
  function normalCurvePoints(mean, stdDev, low, high, points = 61) {
    const xs = [];
    for (let index = 0; index < points; index += 1) xs.push(low + (high - low) * index / (points - 1));
    if (!(stdDev > 0)) {
      let nearest = 0;
      xs.forEach((x, index) => { if (Math.abs(x - mean) < Math.abs(xs[nearest] - mean)) nearest = index; });
      return { xs, ys: xs.map((x, index) => (index === nearest ? 1 : 0)) };
    }
    return { xs, ys: xs.map((x) => Math.exp(-0.5 * ((x - mean) / stdDev) ** 2)) };
  }

  // A panel's list filter ({field: [allowed values]}, from the schema panel's `filters`): whether an item matches it
  // (always, with no filter), the full-list positions of the matching items, and the values a new item starts with
  // (the first allowed value of each field).
  function itemMatches(item, filter) {
    if (!filter) return true;
    return Object.keys(filter).every((name) => item != null && filter[name].includes(item[name]));
  }

  function filteredPositions(items, filter) {
    const positions = [];
    (items || []).forEach((item, position) => { if (itemMatches(item, filter)) positions.push(position); });
    return positions;
  }

  // Ordered lists (accounts, loans, children, expenses or any other list): the selected items move one place among the
  // shown positions (a filtered list moves within its matches) as a block that stops at the ends, or are deleted, or one
  // item moves to another shown position (a drag). `selected` and `shown` are full-list positions; the items change in
  // place and each returns the selected items' new positions, in order.
  function allPositions(items) {
    return items.map((item, position) => position);
  }

  function moveSelected(items, selected, offset, shown) {
    const order = shown || allPositions(items);
    const picked = new Set(selected || []);
    const ticked = order.map((position, index) => index).filter((index) => picked.has(order[index]));
    const taken = new Set(ticked);
    for (const index of offset < 0 ? ticked : ticked.slice().reverse()) {
      const target = index + offset;
      if (target < 0 || target >= order.length || taken.has(target)) continue;
      [items[order[index]], items[order[target]]] = [items[order[target]], items[order[index]]];
      taken.delete(index);
      taken.add(target);
    }
    return order.filter((position, index) => taken.has(index));
  }

  function deleteSelected(items, selected) {
    [...new Set(selected || [])].sort((a, b) => b - a).forEach((position) => {
      if (position >= 0 && position < items.length) items.splice(position, 1);
    });
    return [];
  }

  function moveItem(items, from, to, selected, shown) {
    const order = shown || allPositions(items);
    const marked = (selected || []).map((position) => items[position]);
    let index = order.indexOf(from);
    const target = order.indexOf(to);
    if (index < 0 || target < 0) return (selected || []).slice();
    while (index !== target) {
      const next = index + (target > index ? 1 : -1);
      [items[order[index]], items[order[next]]] = [items[order[next]], items[order[index]]];
      index = next;
    }
    return marked.map((item) => items.indexOf(item)).filter((position) => position >= 0).sort((a, b) => a - b);
  }

  // The monthly totals under the expense lists, as the desktop shows them: `rows`, one per monthly category, and
  // `total`, their sum per month; `annual`, Major Spending and Charity as monthly equivalents (the yearly amounts of
  // the rows paid in the year you are `age`, the first year of the plan, divided by 12); and `combined`, the total per
  // month of both. The input is the saved expense rows; with no age every annual row counts.
  const ANNUAL_EXPENSE_CATEGORIES = ["Major Spending", "Charity"];

  // Whether an expense row is paid in the year you are `age` (wmti.inputs.retirementInputs.expenseActiveAt).
  function expenseActiveAt(item, age) {
    if (item.category === "Charity") return true;
    if (item.category === "Major Spending") {
      if (item.year == null) return false;
      return item.year <= age && age <= (item.toAge == null ? item.year : item.toAge);
    }
    return (item.year == null || age >= item.year) && (item.toAge == null || age <= item.toAge);
  }

  function expenseSummary(expenses, categories, age) {
    const sum = (items) => items.reduce((total, item) => total + (Number(item.amount) || 0), 0);
    const monthly = (categories || []).filter((name) => !ANNUAL_EXPENSE_CATEGORIES.includes(name));
    const rows = monthly.map((category) => ({ category, total: sum((expenses || [])
      .filter((item) => item.category === category)) }));
    const annual = ANNUAL_EXPENSE_CATEGORIES.filter((name) => (categories || []).includes(name)).map((category) => ({
      category, total: sum((expenses || []).filter((item) => item.category === category
        && (age == null || expenseActiveAt(item, age)))) / 12 }));
    const total = rows.reduce((value, row) => value + row.total, 0);
    return { rows, total, annual, combined: total + annual.reduce((value, row) => value + row.total, 0) };
  }

  // The one summary at the bottom of the Expenses chip, per month (wmti.dashboard.breakdown.expenseTotals, in whole
  // dollars as the phone shows them): `entered`, the rows of an `expenseSummary` (each monthly category, then Major
  // Spending and Charity per year / 12); and `total`, the one "Total expenses" row: the entered rows plus the read-only
  // rows other tabs charge (the settings notes' `alreadyCounted` rows; the note row, with no amount, is left out), or
  // null before the notes arrive. Each amount is rounded to the dollar before it is added, so the total is exactly the
  // entered monthly expenses plus the counted ones.
  function expenseTotals(summary, countedRows) {
    const whole = (value) => Math.round(Number(value) || 0);
    const add = (rows) => rows.reduce((sum, row) => sum + row.monthly, 0);
    const entered = [...summary.rows.map((row) => [row.category, row.total]),
      ...summary.annual.map((row) => [row.category + " (per year ÷ 12)", row.total])]
      .map(([item, monthly]) => ({ item, monthly: whole(monthly) }));
    if (!countedRows) return { entered, total: null };
    const counted = countedRows.filter((row) => row.monthly != null).map((row) => ({ monthly: whole(row.monthly) }));
    return { entered, total: { item: "Total expenses", monthly: add(entered) + add(counted) } };
  }

  // When a car or home is bought and sold, or a loan starts and is paid off, as your ages: "buys at 55 · sells at 60"
  // (a loan: "starts at 53 · paid off at 56"), each part only while its switch is on; "" when neither is. As
  // wmti.assets.ownership.activeSpan; a loan's start is your age today plus its start year.
  function spanText(item, currentAge) {
    const parts = [];
    if ("startsLater" in item) {
      if (item.startsLater && item.startYear > 0) parts.push("starts at " + (currentAge + item.startYear));
      if (item.paysOffEarly && item.payoffAge != null) parts.push("paid off at " + item.payoffAge);
    } else {
      if (item.buysLater && item.purchaseAge != null) parts.push("buys at " + item.purchaseAge);
      if (item.sellsLater && item.saleAge != null) parts.push("sells at " + item.saleAge);
    }
    return parts.join(" · ");
  }

  // A car's card on the Cars chip: its name, the driver, "loan" while it charges one, the replacement cycle when one is
  // on (a cycle and a price above 0), when it is bought and sold (`spanText`), and its value today (its price when
  // bought later).
  function carSummary(car, currentAge) {
    const replaced = car.replaceEveryYears > 0 && car.replacementPrice > 0;
    const span = spanText(car, currentAge);
    return { name: car.name, detail: car.driver + (hasCarLoan(car) ? " · loan" : "")
      + (replaced ? " · replaced every " + car.replaceEveryYears + " years" : "") + (span ? " · " + span : ""),
    value: compactMoney(car.buysLater ? car.purchasePrice : car.valueToday) };
  }

  // A home's card: its name, "primary residence" or "second home", "mortgage" while its mortgage counts, when it is
  // bought and sold (`spanText`), and its value today (its price when bought later).
  function homeSummary(home, currentAge) {
    const owed = home.buysLater ? home.purchasePrice * (1 - home.downPaymentRate) : home.mortgageBalance;
    const mortgage = home.hasMortgage && owed > 0;
    const span = spanText(home, currentAge);
    return { name: home.name, detail: (home.primaryResidence ? "primary residence" : "second home")
      + (mortgage ? " · mortgage" : "") + (span ? " · " + span : ""),
    value: compactMoney(home.buysLater ? home.purchasePrice : home.valueToday) };
  }

  // The ages a home is held, from its purchase age (or always) to its sale age (or always), as
  // wmti.homes.homes.primaryPeriods; and whether two such periods share a year other than a move year (one's sale age
  // is the other's purchase age), as periodsOverlap.
  function primaryPeriod(home) {
    return [home.buysLater && home.purchaseAge != null ? home.purchaseAge : -Infinity,
      home.sellsLater && home.saleAge != null ? home.saleAge : Infinity];
  }

  function periodsOverlap(first, second) {
    const shared = first[0] <= second[1] && second[0] <= first[1];
    const move = first[1] === second[0] || second[1] === first[0];
    return shared && !(move && Math.min(first[1], second[1]) === Math.max(first[0], second[0]));
  }

  // After the primary residence switch of the home at `position` changed: ticked, it is a primary and every other
  // primary held in the same years is unticked (with no purchase or sale, every other home); unticked, it stays off
  // while another primary is left, else it is ticked again. Changes the list in place and returns it.
  function choosePrimary(homes, position) {
    const chosen = homes[position];
    if (!chosen.primaryResidence && homes.some((home, index) => index !== position && home.primaryResidence)) return homes;
    chosen.primaryResidence = true;
    homes.forEach((home, index) => {
      if (index !== position && home.primaryResidence && periodsOverlap(primaryPeriod(home), primaryPeriod(chosen))) {
        home.primaryResidence = false;
      }
    });
    return homes;
  }

  // Keep a primary residence in a non-empty list with no two primaries overlapping in time, as
  // wmti.homes.homes.normalizedPrimary: none ticked makes the first home primary; of several, each in list order is
  // kept unless it overlaps one already kept (with no purchase or sale, only the first ticked). Changes the list in
  // place and returns it.
  function ensureOnePrimary(homes) {
    if (!homes || !homes.length) return homes;
    if (!homes.some((home) => home.primaryResidence)) {
      homes.forEach((home, index) => { home.primaryResidence = index === 0; });
      return homes;
    }
    const kept = [];
    homes.forEach((home) => {
      if (!home.primaryResidence) return;
      if (kept.some((other) => periodsOverlap(primaryPeriod(other), primaryPeriod(home)))) home.primaryResidence = false;
      else kept.push(home);
    });
    return homes;
  }

  // Whether a car charges a loan (wmti hasCarLoan): its Loan switch on and a balance above 0 (bought later: the price
  // less the down payment above 0); a leased car never does.
  function hasCarLoan(car) {
    const owed = car.buysLater ? car.purchasePrice * (1 - car.downPaymentRate) : car.loanBalance;
    return !car.leases && Boolean(car.hasLoan) && owed > 0;
  }

  // The calendar year in which you are `age`, and your age in a calendar year, as wmti.assets.timeline.yearOfAge and
  // ageOfYear: the law's tax year (appInfo().lawTaxYear) is the year you are `currentAge`.
  function yearOfAge(age, currentAge, lawYear) {
    return lawYear + age - currentAge;
  }

  function ageOfYear(year, currentAge, lawYear) {
    return currentAge + year - lawYear;
  }

  // The ownership timeline's bars, one row per lane in lane order: each segment of timelineView (owned, rented, leased
  // or no car) as its share of the run from `low` to `high` (your ages; an open segment runs to `high`), for CSS widths.
  // Returns [{lane, bars: [{mode, name, text, position, left, width}]}], left and width in percent.
  function timelineBars(segments, low, high) {
    const span = high - low + 1;
    const lanes = [];
    for (const segment of segments) {
      let row = lanes.find((entry) => entry.lane === segment.lane);
      if (!row) {
        row = { lane: segment.lane, bars: [] };
        lanes.push(row);
      }
      const end = segment.endAge == null ? high : segment.endAge;
      row.bars.push({ mode: segment.mode, name: segment.name, text: segment.text, position: segment.position,
        left: ((segment.startAge - low) / span) * 100, width: ((end - segment.startAge + 1) / span) * 100 });
    }
    return lanes.sort((first, second) => first.lane - second.lane);
  }

  function filterStartValues(filter) {
    const values = {};
    for (const name of Object.keys(filter || {})) values[name] = filter[name][0];
    return values;
  }

  // ---- The guided walkthrough (the tree, plan and answers come from wmti.dashboard.walkthrough) ----
  const WALK_SELECTOR = /^(\w+)\[([^\]]+)\]$/;

  // The value at a walkthrough field path: an input path or an account selector `accounts[Savings].startingValue`
  // (the first account of that kind); undefined when a part is missing.
  function walkRead(data, path) {
    let target = data;
    for (const part of path.split(".")) {
      if (target == null) return undefined;
      const selector = WALK_SELECTOR.exec(part);
      target = selector ? (target[selector[1]] || []).find((item) => item && item.kind === selector[2]) : target[part];
    }
    return target;
  }

  // A number as the walkthrough's messages write it (as wmti.dashboard.walkthrough._number): 10%, $1,500 or 67.
  function walkNumber(value, unit) {
    if (unit === "percent") return trimZeros(String(Number((value * 100).toPrecision(12)))) + "%";
    if (unit === "money") return fullMoney(value);
    return String(value);
  }

  // The message for a number outside a resolved field's bounds (the same text as apply's), or null when inside.
  // `floor` is a further lower bound (the field's minimumFrom value), or null.
  function walkBoundsError(field, value, floor) {
    let low = field.minimum;
    const high = field.maximum;
    if (floor != null) low = low == null ? floor : Math.max(low, floor);
    if (value == null || !((low != null && value < low) || (high != null && value > high))) return null;
    const text = (bound) => walkNumber(bound, field.unit);
    if (low != null && high != null) return field.label + " must be between " + text(low) + " and " + text(high) + ".";
    if (low != null) return field.label + " must be " + text(low) + " or more.";
    return field.label + " must be " + text(high) + " or less.";
  }

  // A hint template of the tree (Python format fields such as {endAge} and ${monthlySpending:,.0f}) filled from facts.
  function walkHint(template, facts) {
    return template.replace(/\{(\w+)(?::,\.0f)?\}/g, (whole, name) => {
      const value = facts ? facts[name] : undefined;
      if (value == null) return whole;
      return whole.includes(":,.0f") ? groupDigits(Number(value).toFixed(0)) : String(value);
    });
  }

  // Every question of the tree by id: the node, its topic and its parent id (null at the top level).
  function walkIndex(tree) {
    const found = {};
    const visit = (topic, node, parent) => {
      found[node.id] = { node, topic, parent };
      for (const child of node.deeper || []) visit(topic, child, node.id);
    };
    for (const topic of tree.topics) for (const node of topic.questions) visit(topic, node, null);
    return found;
  }

  // A question's short name in the Trail: its field's label, a fixed name for the shape-changing answers, else its
  // prompt.
  const WALK_ACTION_LABELS = { partner: "Partner", count: "Children", carCount: "Cars", homeCount: "Homes",
    total: "Monthly spending", balances: "Savings balances" };
  // The list each count question sets the length of: the children, the cars or the homes.
  const WALK_COUNT_LISTS = { count: "children", carCount: "cars", homeCount: "homes" };
  function walkLabel(node) {
    if (node.control === "handoff") return node.prompt;
    if (WALK_ACTION_LABELS[node.action]) return WALK_ACTION_LABELS[node.action];
    return node.fields.length === 1 ? node.fields[0].label : node.prompt;
  }

  // The status of one question in saved progress: "now" for the current one, "skipped" or "answered" (any other saved
  // status, from an older walkthrough too) once reached, or "todo" when not reached yet.
  function walkStatus(saved, id, currentId) {
    if (id === currentId) return "now";
    const answer = saved && saved.answers ? saved.answers[id] : null;
    if (!answer) return "todo";
    return answer.status === "skipped" ? "skipped" : "answered";
  }

  const WALK_TAGS = { now: "Now", answered: "Answered", skipped: "Skipped", todo: "Not yet" };

  // The question number, total and progress segments for the current screen. `rows` are plan().questions; the number
  // counts the top-level questions of the topics that are not optional (a deeper question shows its parent's number),
  // and each segment is one such topic: "done", "current" or "todo".
  function walkProgress(tree, rows, currentId) {
    const optional = new Set(tree.topics.filter((topic) => topic.optional).map((topic) => topic.id));
    const basic = rows.filter((row) => row.depth === 0 && !optional.has(row.topic));
    const byId = {};
    for (const row of rows) byId[row.id] = row;
    let top = byId[currentId];
    while (top && top.parent) top = byId[top.parent];
    const number = top ? basic.findIndex((row) => row.id === top.id) + 1 : 0;
    const topics = tree.topics.filter((topic) => !optional.has(topic.id) && basic.some((row) => row.topic === topic.id));
    const reached = currentId === "review" ? topics.length : top ? topics.findIndex((topic) => topic.id === top.topic) : -1;
    const segments = topics.map((topic, index) => ({ id: topic.id, title: topic.title,
      state: index < reached ? "done" : index === reached ? "current" : "todo" }));
    return { number, total: basic.length, topic: top ? top.topicTitle : null, segments };
  }

  // The Trail: one group per topic in tree order with its questions as plan() lists them (depth kept), each with its
  // status, and after each question whose deeper questions are not opened an "offer" row; an optional topic that is
  // not opened is one offer group. `index` is walkIndex(tree).
  function walkTrail(tree, index, rows, saved, currentId) {
    const opened = new Set((saved && saved.opened) || []);
    return tree.topics.map((topic) => {
      const items = [];
      for (const row of rows.filter((item) => item.topic === topic.id)) {
        const node = index[row.id].node;
        items.push({ kind: "question", id: row.id, depth: row.depth, label: walkLabel(node),
          status: walkStatus(saved, row.id, currentId), handoff: row.control === "handoff" });
        if (row.hasDeeper && node.offer && !opened.has(row.id)) {
          items.push({ kind: "offer", id: row.id, depth: row.depth + 1, label: node.offer });
        }
      }
      const offerTopic = topic.optional && !items.length;
      return { id: topic.id, title: topic.title, optional: topic.optional, offer: offerTopic, items };
    }).filter((group) => group.items.length || group.offer);
  }

  // "forward" or "back": the direction from one screen to another in plan order (the first step, the welcome, the
  // questions, then the review).
  function walkDirection(rows, fromId, toId) {
    const at = (id) => (id === "start" ? -2 : id === "welcome" ? -1 : id === "review" ? rows.length : rows.findIndex((row) => row.id === id));
    return at(toId) < at(fromId) ? "back" : "forward";
  }

  // Saved progress cleaned for this tree: ids the tree does not know (saved by an older tree) dropped from the
  // answers, the opened list and the visited trail; a current screen that is no longer known becomes null.
  function walkClean(saved, index, topicIds) {
    const known = (id) => Object.prototype.hasOwnProperty.call(index, id);
    const answers = {};
    for (const [id, answer] of Object.entries((saved && saved.answers) || {})) if (known(id)) answers[id] = answer;
    const screens = (id) => id === "start" || id === "welcome" || id === "review" || known(id);
    return { ...saved, answers, opened: ((saved && saved.opened) || []).filter((id) => known(id) || topicIds.includes(id)),
      trail: ((saved && saved.trail) || []).filter(screens),
      current: saved && screens(saved.current) ? saved.current : null };
  }

  // A question's answer as Trail and Review text, read from the current inputs.
  function answerText(node, data, facts) {
    if (node.control === "handoff") return "On the " + (node.handoff ? node.handoff.label : "") + " page";
    if (node.action === "partner") return data.partner != null ? "Yes" : "No";
    if (WALK_COUNT_LISTS[node.action]) return String((data[WALK_COUNT_LISTS[node.action]] || []).length);
    if (node.action === "total") return facts ? fullMoney(facts.monthlySpending) + " a month" : "";
    return node.fields.map((field) => {
      const value = walkRead(data, field.path);
      let text;
      if (field.years) {
        const amounts = (facts && facts.recentEarnings && facts.recentEarnings[field.path]) || {};
        text = field.years.filter((year) => amounts[year] != null)
          .map((year) => year + " " + fullMoney(amounts[year])).join(", ");
      } else if (field.kind === "toggle") text = value ? (field.yes || "Yes") : (field.no || "No");
      else if (field.kind === "map") {
        const count = Object.keys(value || {}).length;
        text = count ? count + " " + (field.keyUnit === "age" ? "ages" : "years") : "None";
      } else if (field.choiceLabels && value != null && field.choiceLabels[String(value)]) {
        text = field.choiceLabels[String(value)];
      } else if (value == null) text = node.action === "balances" ? "$0" : "Blank";
      else text = formatValue(value, field.unit);
      return node.fields.length > 1 ? field.label + " " + text : text;
    }).join(", ");
  }

  // A legal document's markdown as plain blocks to draw (no markdown library): `#` lines become headings (level 1 to
  // 3), a table becomes one paragraph per row with its cells joined by commas (the |---| rule left out), and other
  // runs of lines become paragraphs; bold, code and link markers are dropped.
  function legalBlocks(text) {
    const plain = (line) => line.replace(/\*\*|`/g, "").replace(/<(https?:[^>]+)>/g, "$1").trim();
    const blocks = [];
    for (const chunk of String(text || "").replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
      const lines = chunk.split("\n").filter((line) => line.trim());
      if (!lines.length) continue;
      const heading = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
      if (heading && lines.length === 1) {
        blocks.push({ kind: "heading", level: Math.min(heading[1].length, 3), text: plain(heading[2]) });
      } else if (lines.every((line) => line.trim().startsWith("|"))) {
        for (const line of lines) {
          const cells = line.trim().replace(/^\||\|$/g, "").split("|").map(plain);
          if (!cells.every((cell) => /^:?-+:?$/.test(cell))) blocks.push({ kind: "paragraph", text: cells.join(", ") });
        }
      } else blocks.push({ kind: "paragraph", text: lines.map(plain).join(" ") });
    }
    return blocks;
  }

  // True when a stored Terms acceptance (the text kept under wmti.terms.v1) is for this Terms version.
  function termsAccepted(storedText, version) {
    try {
      const stored = JSON.parse(storedText);
      return stored != null && typeof stored === "object" && stored.version === version && Boolean(stored.acceptedAt);
    } catch (error) {
      return false;
    }
  }

  // Move what this device kept under the keys from before the rename ("fpt.<name>") to "wmti.<name>", once: each old
  // key is copied when its new key is still empty, then removed. The Terms acceptance (termsKey) carries over only
  // when its textHash is this build's Terms text hash; otherwise the Terms are asked again. `storage` is localStorage
  // (or anything with length, key, getItem, setItem and removeItem). Returns the new keys written.
  function migrateLegacyStorage(storage, termsKey, textHash) {
    const oldKeys = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (typeof key === "string" && key.startsWith("fpt.")) oldKeys.push(key);
    }
    const written = [];
    for (const oldKey of oldKeys) {
      const newKey = "wmti." + oldKey.slice("fpt.".length);
      const value = storage.getItem(oldKey);
      let keep = value != null && storage.getItem(newKey) == null;
      if (keep && newKey === termsKey) {
        try { keep = JSON.parse(value).textHash === textHash && Boolean(textHash); } catch (error) { keep = false; }
      }
      if (keep) { storage.setItem(newKey, value); written.push(newKey); }
      storage.removeItem(oldKey);
    }
    return written;
  }

  // The short line About shows after "Check for updates": "current" (no newer build), "ready" (a newer build is
  // waiting) or "offline" (the host could not be asked). Anything else gives an empty line.
  const UPDATE_TEXTS = { current: "You're up to date", ready: "New version ready", offline: "Offline: couldn't check" };

  function updateCheckText(outcome) {
    return Object.prototype.hasOwnProperty.call(UPDATE_TEXTS, outcome) ? UPDATE_TEXTS[outcome] : "";
  }

  // A brand-new scenario's settings: nothing filled in, not the example household, yet valid so the model runs and the
  // walkthrough can write each answer. Built from the settings schema: lists and maps empty, switches off, numbers
  // zero (or their schema minimum when that is above zero), a select's first choice and optional parts left out.
  // The input checker then needs four things a blank cannot give: filing SINGLE (there is no partner), one account
  // (a blank one), and a Social Security claim age that is in its (zero) benefit table.
  const BLANK_ACCOUNT_NAME = "Account";
  const BLANK_CLAIM_AGE = "67";  // the full retirement age for anyone born in 1960 or later

  function blankValue(schema, field) {
    if (field.kind === "list") return [];
    if (field.kind === "map") return {};
    if (field.nullable && field.kind !== "toggle") return null;
    if (field.kind === "object") return blankObject(schema, field.type);
    if (field.kind === "toggle") return false;
    if (field.kind === "select") return field.choices && field.choices.length ? field.choices[0] : null;
    if (field.kind === "triangular") return { minimum: 0, mode: 0, maximum: 0 };
    if (field.kind === "normal") return { mean: 0, stdDev: 0 };
    if (field.kind === "text") return "";
    return field.minimum != null && field.minimum > 0 ? field.minimum : 0;
  }

  function blankObject(schema, typeName) {
    const value = {};
    for (const field of schema.types[typeName] || []) value[field.name] = blankValue(schema, field);
    return value;
  }

  function blankInputs(schema) {
    const inputs = { schemaVersion: schema.inputsSchemaVersion, ...blankObject(schema, schema.root) };
    inputs.filingStatus = "SINGLE";
    inputs.accounts = [{ ...blankObject(schema, "Account"), name: BLANK_ACCOUNT_NAME }];
    inputs.you.socialSecurityByAge = { [BLANK_CLAIM_AGE]: 0 };
    inputs.you.socialSecurityAge = Number(BLANK_CLAIM_AGE);
    return inputs;
  }

  // Whether settings still lack what a result needs: your age (blank in a new scenario) is not filled in yet.
  function needsSetup(inputs) {
    return !inputs || !inputs.you || !(Number(inputs.you.currentAge) > 0);
  }

  // Other scenarios on Setup: the saved names and the example household (unless it was deleted from the list),
  // except the open scenario, sorted.
  function otherScenarioNames(savedNames, openName, exampleName, exampleHidden) {
    const names = savedNames.slice();
    if (!exampleHidden && !names.includes(exampleName)) names.push(exampleName);
    return names.filter((name) => name !== openName).sort((left, right) => left.localeCompare(right));
  }

  // A name not yet taken: `base` itself, else "base 2", "base 3" and so on.
  function freeName(base, taken) {
    const used = new Set(taken.map((name) => name.toLowerCase()));
    if (!used.has(base.toLowerCase())) return base;
    let number = 2;
    while (used.has((base + " " + number).toLowerCase())) number += 1;
    return base + " " + number;
  }

  // A copy's scenario name: `name` with any trailing "_<number>" taken off, then "_1", "_2" and so on, the lowest number
  // that no name in `taken` uses (letter case ignored). With `bare` true the base itself is used while it is free (a
  // New scenario); a Duplicate always gets a number.
  function numberedName(name, taken, bare) {
    const base = String(name).replace(/_\d+$/, "");
    const used = new Set(taken.map((item) => item.toLowerCase()));
    if (bare && !used.has(base.toLowerCase())) return base;
    let number = 1;
    while (used.has((base + "_" + number).toLowerCase())) number += 1;
    return base + "_" + number;
  }

  // The undo history of the open scenario: `current` (the settled settings as JSON text) and `stack` (earlier settled
  // states, oldest first, at most `limit`). Recording the text already current changes nothing.
  function undoRecord(history, text, limit) {
    if (history.current == null || history.current === text) return { stack: history.stack.slice(), current: text };
    return { stack: history.stack.concat([history.current]).slice(-limit), current: text };
  }

  // Step back once: the latest earlier state becomes current. Null when there is nothing to undo.
  function undoStep(history) {
    if (!history.stack.length) return null;
    return { stack: history.stack.slice(0, -1), current: history.stack[history.stack.length - 1] };
  }

  const api = { escapeText, compactMoney, fullMoney, tickMoney, percent, formatValue, groupDigits,
    checkScenarioName, scenarioFileProblem, getPath, setPath, sheetFields, sheetLabel, sheetSwitches, clearedOnChange, kindReturnsFilled, returnsSummary, expenseAgesText, expenseActiveAt, expenseSummary, expenseTotals, carSummary, homeSummary, spanText, hasCarLoan, yearOfAge, ageOfYear, timelineBars, primaryPeriod, periodsOverlap, choosePrimary, ensureOnePrimary, normalPair, tabRoute, inputsChip,
    normalCurvePoints, itemMatches, filteredPositions, filterStartValues, moveSelected, deleteSelected, moveItem, panelField, sameValue, syncResetFlags,
    resetGroup, walkRead, walkNumber, walkBoundsError, walkHint, walkIndex, walkLabel, walkStatus, WALK_TAGS, WALK_ACTION_LABELS, WALK_COUNT_LISTS,
    walkProgress, walkTrail, walkDirection, walkClean, answerText, legalBlocks, termsAccepted, migrateLegacyStorage, updateCheckText,
    blankInputs, needsSetup, otherScenarioNames, freeName, numberedName, undoRecord, undoStep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WmtiShared = api;
})(typeof self !== "undefined" ? self : this);

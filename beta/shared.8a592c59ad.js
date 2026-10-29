// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// Small pure helpers shared by the page, the charts and the Node tests: text escaping, number formats, the
// scenario name rule, dotted-path access into the inputs JSON, the list-item sheet layout, the Compare pair and the
// tab route of a hash or saved tab name, the About window's update-check wording and the wide layout's split.
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
        "rothBasis"],
      groups: { meanReturn: "returns", returnStdDev: "returns", costBasis: "returns", iraBasis: "returns",
        rothBasis: "returns" },
    },
    // Drawn in titled sections by each field's schema group: Basics, Value, How it is paid, Replacement, Commute,
    // Running costs. A car owned today opens its Value with the price paid, the year bought and the two depreciation
    // rates that feed its one value today (the estimate gray until a value is entered, see SHEET_DEFAULTS). How it is
    // paid is one Cash / Finance / Lease control (`payMethod`, which sets the Loan and Lease switches, never drawn)
    // followed by the loan figures or the lease payment. The miles per year close the Commute section, after the
    // commute figures its switch shows. The purchase and sale are set on the timeline (`timelineManaged`), so their
    // sections are not drawn.
    Car: {
      order: ["name", "driver", "purchasePrice", "purchaseYear", "firstYearDrop", "depreciationRate", "valueToday",
        "payMethod", "hasLoan", "loanBalance", "loanRate", "loanMonthsLeft", "loanExtraMonthly", "leases", "leaseMonthly",
        "replaceBy", "replaceEveryYears", "replaceInYears", "replaceEveryMiles", "odometerToday", "replacementPrice",
        "replacementPayMethod", "replacementLoanRate", "replacementLoanMonths", "replacementDownPaymentRate",
        "replacementLeaseMonthly", "replacementLeaseMonths", "replacementLeaseFee",
        "commutes", "commuteMilesOneWay", "commuteDaysPerYear", "commuteTollsPerDay", "otherMilesPerYear",
        "milesPerGallon", "insurancePerYear", "registrationPerYear", "maintenancePerYear",
        "buysLater", "purchaseAge", "downPaymentRate", "salesTaxRate", "purchaseFees",
        "sellsLater", "saleAge", "salePrice", "sellingCostRate", "sellingFees", "prepayPenaltyRate"],
      groups: {},
      sections: true,
    },
    // The loan's own figures first, then its Starts later and Pay off early sections, each opened by its switch.
    Loan: {
      order: ["name", "kind", "improvesHome", "balance", "annualRate", "remainingMonths", "extraMonthly", "refinance",
        "forgiveAtMonth", "paymentsInExpenses", "startsLater", "startYear", "paysOffEarly", "payoffAge",
        "prepayPenaltyRate"],
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
  // `itemSwitchReplaces`) only while it is off. A car's Loan and Lease switches are set by its How it is paid
  // (`carPaidBySwitches`), never drawn. A switch the item's plan rules out is hidden while off (`switchRuledOut`).
  function hiddenReason(typeName, name, item, rules) {
    if (typeName === "Car") {
      const reason = carHiddenReason(name, item, rules);
      if (reason !== undefined) return reason;
    }
    const ruledOut = switchRuledOut(typeName, name, item, rules);
    if (ruledOut) return ruledOut;
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
    // Used on this home only matters for a loan secured by a home (a home's own loans, or a Mortgage loan on Loans).
    if (typeName === "Loan" && name === "improvesHome" && !(rules.homeLoanKinds || []).includes(item.kind)) {
      return "for a loan secured by a home only";
    }
    if (typeName === "Account") {
      if (name === "deposit") return "set per account on the Benefits page";
      if (name === "surplusShare") return "set under Where surplus cash goes on the Accounts page";
      if (name === "autoCreated") return "set by the Roth conversion switch";
      if (name === "costBasis" && item.kind !== rules.costBasisKind) return rules.costBasisKind + " accounts only";
      if (name === "iraBasis" && item.kind !== rules.iraBasisKind) return rules.iraBasisKind + " accounts only";
      if (name === "rothBasis" && !(rules.rothBasisKinds || []).includes(item.kind)) {
        return (rules.rothBasisKinds || []).join(" and ") + " accounts only";
      }
    }
    if (typeName === "Heir") {
      if (name === "share") return "set under Split among beneficiaries, below the list";
      if (name === "child") return "set by Add children as beneficiaries";
    }
    if (typeName === "ExpenseItem") {
      if ((name === "year" || name === "toAge") && item.category === rules.charityCategory) {
        return "not for " + rules.charityCategory + " rows";
      }
      // Child-year, education and child care costs are entered on Children and Benefits; a row's tag is kept as is.
      if (name === "child" || name === "education" || name === "dependentCare") {
        return "entered on the Children and Benefits pages";
      }
      if (name === "retirementChange") return "set on the Retirement page";  // Spending in retirement, Per expense
      if (name === "priceType") return "set on the suggested rows";
      if (name === "taxable" && item.category === rules.charityCategory) return "not for " + rules.charityCategory + " rows";
      if (name === "deduction" && item.category === rules.charityCategory) {
        return "always " + rules.charityCategory + " for " + rules.charityCategory + " rows";
      }
    }
    return null;
  }

  // Why a switch is left off an item's sheet because the item's plan rules it out (`itemSwitchHiddenBy`: the switches
  // that do while on and, for a car, the replacement pay methods that do), or null. A switch that is on stays shown so
  // it can be turned off.
  function switchRuledOut(typeName, name, item, rules) {
    const by = ((rules.itemSwitchHiddenBy || {})[typeName] || {})[name];
    if (!by || item[name]) return null;
    const on = (by.switches || []).find((toggle) => item[toggle]);
    if (on) return "not used while its " + on + " switch is on";
    const method = typeName === "Car" && carReplaceRuleOn(item) ? carReplacementMethodOf(item) : null;
    if (method && (by.replacementPayMethods || []).includes(method)) {
      return "not used while replacements are paid by " + method;
    }
    return null;
  }

  // Why a car's pay or replacement rule figure is left off its sheet: null when shown, undefined when the general rules
  // decide. The Loan and Lease switches are set by How it is paid (`carPaidBySwitches`); the loan figures show only
  // while it is Finance (`carPaidBy`). A rule's figures show only while Replace by selects that rule
  // (`carReplaceRules`). A car owned today shows its purchase price (the price paid, which sets its estimated value and
  // which a blank replacement price follows) unless it is leased, and its replacement pay figures only while a
  // replacement rule is on and it is not leased; the loan figures of a replacement only while the replacements are
  // financed, the lease figures only while they are leased (`carReplacementPayFields`).
  function carHiddenReason(name, item, rules) {
    if ((rules.carPaidBySwitches || []).includes(name)) return "set by How it is paid";
    if ((((rules.itemSwitches || {}).Car || {}).hasLoan || []).includes(name)) {
      if (carPaidBy(item) !== "finance") return "shown while How it is paid is Finance";
      return item.buysLater && name === "loanBalance" ? undefined : null;
    }
    for (const [rule, entry] of Object.entries(rules.carReplaceRules || {})) {
      if (entry.fields.includes(name) && !item.leases && !carReplaceRulesOf(item)[rule]) {
        return "shown while Replace by is " + (rule === "years" ? "Years" : "Miles") + " or Both";
      }
    }
    const ruleOn = carReplaceRuleOn(item);
    if (name === "purchasePrice" && !item.buysLater) {
      return item.leases ? "not used while its leases switch is on" : null;
    }
    const payFields = rules.carReplacementPayFields || {};
    const methodFields = Object.values(payFields).flat();
    if (name !== "replacementPayMethod" && !methodFields.includes(name)) return undefined;
    if (item.leases) return undefined;
    if (!ruleOn) return "shown while a replacement rule is on";
    for (const [method, names] of Object.entries(payFields)) {
      if (names.includes(name) && carReplacementMethodOf(item) !== method) {
        return "shown while replacements are paid by " + method;
      }
    }
    return undefined;
  }

  // Which replacement rules count for a car (wmti Car.replaceBy): {years, miles}; a car without the setting replaces
  // by years.
  function carReplaceRulesOf(car) {
    const by = car.replaceBy || "years";
    return { years: by === "years" || by === "both", miles: by === "miles" || by === "both" };
  }

  // Whether a rule that counts for the car has a figure above 0, so the car is replaced (given a price).
  function carReplaceRuleOn(car) {
    const on = carReplaceRulesOf(car);
    return (on.years && car.replaceEveryYears > 0) || (on.miles && car.replaceEveryMiles > 0);
  }

  // The group of a car's replacement rule field on its sheet: "replaceRule" for Replace by, "replaceRule.<rule>" for a
  // rule's figures (`carReplaceRules`), else null.
  function carRuleGroup(name, rules) {
    if (name === "replaceBy") return "replaceRule";
    for (const [rule, entry] of Object.entries(rules.carReplaceRules || {})) {
      if (entry.fields.includes(name)) return "replaceRule." + rule;
    }
    return null;
  }

  // How a car is paid as its How it is paid control shows it: what the model does with the car, so the control never
  // disagrees with the results. Leased: lease; bought later: its pay method (carPayMethodOf); owned today: finance
  // while its Loan switch is on (wmti hasCarLoan), else cash.
  function carPaidBy(car) {
    if (car.leases) return "lease";
    if (car.buysLater) return carPayMethodOf(car);
    return car.hasLoan ? "finance" : "cash";
  }

  // How a car is paid and how its replacements are (wmti payMethodOf and replacementMethodOf): a blank pay method
  // follows the Lease and Loan switches; a blank replacement pay method follows the car's.
  function carPayMethodOf(car) {
    if (car.leases) return "lease";
    if (car.payMethod) return car.payMethod;
    return car.hasLoan ? "finance" : "cash";
  }

  function carReplacementMethodOf(car) {
    return car.replacementPayMethod || carPayMethodOf(car);
  }

  // The blank sheet figures that show another figure's value until edited, by item type: each field's source and the
  // value it holds while blank (wmti.cars.cars falls back the same way, so what is shown is what the model uses).
  // `shown` may read the sheet rules (an expense row's sales tax default by its name, `rules.taxableDefaults`).
  // `prompt` (optional) is the placeholder an empty box shows while the blank has no source value (`sheetPrompt`).
  const SHEET_DEFAULTS = {
    Car: {
      // A blank or 0 value today shows the estimate from the price paid and the year bought (wmti valueTodayOf); a
      // value entered overrides it. Without a year bought the box stays empty with `carValue.estimateNone`.
      valueToday: { blank: 0,
        shown: (car, rules) => (car.buysLater || car.leases ? null : carEstimatedValue(car, rules)),
        prompt: (rules) => (rules.carValue ? rules.carValue.estimateNone : null) },
      replacementPrice: { blank: 0, shown: (car) => (car.purchasePrice > 0 ? car.purchasePrice : null) },
      // A blank first-year drop shows the usual one (`carValue.firstYearDrop`, from .config/carDepreciation.json).
      firstYearDrop: { blank: null, shown: (car, rules) => (rules.carValue ? rules.carValue.firstYearDrop : null) },
      replacementPayMethod: { blank: "", shown: (car) => carPayMethodOf(car) },
      replacementLoanRate: { blank: null, shown: (car) => car.loanRate },
      replacementLoanMonths: { blank: null, shown: (car) => car.loanMonthsLeft },
      replacementDownPaymentRate: { blank: null, shown: (car) => car.downPaymentRate },
    },
    // A suggested row not filled in yet shows its amount 0 as a default until a figure is typed.
    ExpenseItem: {
      amount: { blank: 0, shown: (item) => (unfilledSuggestion(item) ? 0 : null) },
      // A blank Taxable shows the row's default (wmti salesTaxClass): its suggested row's, or taxable for a row added
      // by hand; a row taxed by the state's own rule (Groceries, Clothing) shows Default.
      taxable: { blank: null, shown: (item, rules) => taxableDefaultOf(item, rules) },
    },
  };

  // Whether an expense row is a suggested category not filled in yet: it has a price type (custom rows have none)
  // and no amount. Such a row counts for nothing and is left out of the report.
  function unfilledSuggestion(item) {
    return Boolean(item && item.priceType != null && !(Number(item.amount) > 0));
  }

  // What a sheet field shows while it is blank: {value, blank} with the source's value and the stored blank value, or
  // null when the field has no source or holds a value of its own (an edit sticks; clearing it shows the source again).
  function sheetDefault(typeName, name, item, rules) {
    const rule = (SHEET_DEFAULTS[typeName] || {})[name];
    if (!rule || !item) return null;
    const stored = item[name];
    if (!(stored === rule.blank || stored == null)) return null;
    const value = rule.shown(item, rules || {});
    return value == null ? null : { value, blank: rule.blank };
  }

  // What an empty sheet field says while it holds its blank and its source shows nothing: {text, blank} with the
  // rule's prompt and the stored blank, or null (no prompt, a value of its own, or a source value to show instead).
  function sheetPrompt(typeName, name, item, rules) {
    const rule = (SHEET_DEFAULTS[typeName] || {})[name];
    if (!rule || !rule.prompt || !item) return null;
    const stored = item[name];
    if (!(stored === rule.blank || stored == null) || rule.shown(item, rules || {}) != null) return null;
    const text = rule.prompt(rules || {});
    return text == null ? null : { text, blank: rule.blank };
  }

  // Whether a sheet field shows its source's value (styled as a default, `.is-default`) rather than one entered.
  function showsDefault(typeName, name, item, rules) {
    return sheetDefault(typeName, name, item, rules) !== null;
  }

  // What a sheet field's reset button puts back, edited or not: {value, blank} with the value its source shows once
  // the field holds its blank again and that blank, or null when the field has no source or the source shows nothing.
  function sheetResetTarget(typeName, name, item, rules) {
    const rule = (SHEET_DEFAULTS[typeName] || {})[name];
    if (!rule || !item) return null;
    const value = rule.shown({ ...item, [name]: rule.blank }, rules || {});
    return value == null ? null : { value, blank: rule.blank };
  }

  // What a sheet field with a default stores when cleared (its rule's blank, which shows the source's value again),
  // whatever the field showed when drawn; undefined for a field with no default (a blank is then refused or null).
  function sheetBlank(typeName, name) {
    const rule = (SHEET_DEFAULTS[typeName] || {})[name];
    return rule ? rule.blank : undefined;
  }

  // An expense row's sales tax default: true or false, or null for a row taxed by its state's own rule.
  function taxableDefaultOf(item, rules) {
    const defaults = (rules && rules.taxableDefaults) || {};
    const key = String(item.name || "").trim().toLowerCase();
    const value = Object.prototype.hasOwnProperty.call(defaults, key) ? defaults[key] : true;
    return typeof value === "boolean" ? value : null;
  }

  // The blank panel figures that show the value the model uses until edited, by path: the move age of
  // Strategies > Relocation is your Social Security claim age, else with no benefit the age your pay stops (today's
  // age when retired), as wmti moveYear reads it (defaultSpendingStartAge).
  // A blank Years to simulate runs until you are 100 (yearsToAge100). A blank Leave the 401k employer at age is that
  // person's retirement age (today's age when retired), as wmti separationAgeOf reads it (salaryStopAge).
  const PANEL_DEFAULTS = {
    "strategies.relocation.moveAge": (inputs) => {
      const you = inputs && inputs.you;
      if (!you) return null;
      return defaultSpendingStartAge(you);
    },
    years: (inputs) => (inputs && inputs.you ? yearsToAge100(inputs.you.currentAge) : null),
    "you.separationAge": (inputs) => salaryStopAgeOf(inputs && inputs.you),
    "partner.separationAge": (inputs) => salaryStopAgeOf(inputs && inputs.partner),
  };

  // The age a person's pay stops (wmti salaryStopAge): today's age when retired, else the retirement age; null with
  // no person.
  function salaryStopAgeOf(person) {
    if (!person) return null;
    return person.retired ? person.currentAge : person.salaryEndAge;
  }

  // The panel fields a blank panel figure follows (PANEL_DEFAULTS), so editing one redraws the form and the gray
  // figure keeps up: each person's age and retirement age.
  const PANEL_SOURCES = ["you.currentAge", "you.salaryEndAge", "partner.currentAge", "partner.salaryEndAge"];
  function isPanelSource(path) {
    return PANEL_SOURCES.includes(path);
  }

  // The run length of a blank Years to simulate, as wmti yearsToAge100 reads it: the years until you are
  // PLAN_END_AGE (the last year is the one you are 99), at least 1.
  const PLAN_END_AGE = 100;
  function yearsToAge100(currentAge) {
    return Math.max(1, PLAN_END_AGE - (Number(currentAge) || 0));
  }

  // The settings' run length: `years`, or for a blank one the years until you are 100 (wmti planYears).
  function planYears(inputs) {
    if (!inputs) return null;
    return inputs.years == null ? yearsToAge100(inputs.you && inputs.you.currentAge) : inputs.years;
  }

  // What a panel field shows while it is blank: {value, blank: null}, or null when it has no default rule or holds a
  // value of its own.
  function panelDefault(path, inputs) {
    const rule = PANEL_DEFAULTS[path];
    if (!rule || getPath(inputs, path) != null) return null;
    const value = rule(inputs);
    return value == null ? null : { value, blank: null };
  }

  // What a panel field's reset button puts back, edited or not: {value, blank: null}, or null as panelDefault.
  function panelResetTarget(path, inputs) {
    const rule = PANEL_DEFAULTS[path];
    if (!rule) return null;
    const value = rule(inputs);
    return value == null ? null : { value, blank: null };
  }

  // A number or select field's shipped default from the settings schema (the dataclass default), or null when it has
  // none to show: a blank (null) default, a switch, text, a list or object, or a figure derived from others. A field
  // holding it is drawn grey (`.is-default`) and one that differs gets a reset button that puts it back.
  const DEFAULT_KINDS = ["number", "integer", "select"];
  function fieldDefault(field) {
    if (!field || !DEFAULT_KINDS.includes(field.kind) || field.replaces) return null;
    const value = field.default;
    return typeof value === "number" || typeof value === "string" ? value : null;
  }

  // Whether `value` is a field's shipped default (fieldDefault); numbers match within rounding (20% typed is 0.2).
  const DEFAULT_TOLERANCE = 1e-9;
  function atFieldDefault(field, value) {
    const target = fieldDefault(field);
    if (target == null || value == null) return false;
    if (typeof target === "number") return typeof value === "number" && Math.abs(value - target) <= DEFAULT_TOLERANCE;
    return value === target;
  }

  // ---- Beneficiaries (Benefits > Beneficiaries; stored as `strategies.heirs`, a list whose shares total 1) ----
  const SHARE_TOLERANCE = 1e-6;  // as wmti.strategies.plans.HEIR_SHARE_TOLERANCE

  // The sum of the beneficiaries' shares, and whether it is 100% (within the model's tolerance).
  function heirShareTotal(heirs) {
    const total = (heirs || []).reduce((sum, heir) => sum + (Number(heir.share) || 0), 0);
    return { total, ok: Math.abs(total - 1) <= SHARE_TOLERANCE };
  }

  // The values a beneficiary at `position` of `count` starts with: the schema's Heir defaults, named "Beneficiary
  // <n>", with an equal share.
  function heirDefaults(heirFields, position, count) {
    const item = {};
    for (const field of heirFields || []) item[field.name] = field.default === undefined ? null : field.default;
    item.name = "Beneficiary " + (position + 1);
    item.share = 1 / count;
    return item;
  }

  // The shares scaled to total 100% (equal when they total 0); shares already at 100% are left exactly as they are.
  function scaleHeirShares(heirs) {
    const { total, ok } = heirShareTotal(heirs);
    if (ok) return heirs;
    return heirs.map((heir) => ({ ...heir, share: total > 0 ? (Number(heir.share) || 0) / total : 1 / heirs.length }));
  }

  // The beneficiaries with a new one added ("Beneficiary <n>", the schema defaults): it takes an equal part, 1 / (n
  // + 1), and the others keep their split of the rest, so an equal split stays equal.
  function addHeir(heirs, heirFields) {
    const count = heirs.length + 1;
    return heirs.map((heir) => ({ ...heir, share: (Number(heir.share) || 0) * (count - 1) / count }))
      .concat([heirDefaults(heirFields, heirs.length, count)]);
  }

  // Whether a beneficiary differs from what `defaults` gave it, other than its name and share.
  function heirTermsEdited(heir, defaults) {
    return Object.keys(defaults).some((name) => !["name", "share", "child"].includes(name)
      && (heir[name] === undefined ? null : heir[name]) !== defaults[name]);
  }

  // Whether a child's beneficiary was edited: a name other than the child's, an unequal share of the `count`
  // beneficiaries, or any other field off the schema default.
  function childHeirEdited(heir, heirFields, count) {
    return heir.name !== heir.child || Math.abs(Number(heir.share) - 1 / count) > SHARE_TOLERANCE
      || heirTermsEdited(heir, heirDefaults(heirFields, 0, 1));
  }

  // The untouched beneficiary a new plan starts with ("Beneficiary 1" with every default), which the children replace.
  function isStartHeir(heir, heirFields) {
    return heir.child == null && heir.name === "Beneficiary 1" && !heirTermsEdited(heir, heirDefaults(heirFields, 0, 1));
  }

  // Keep the beneficiaries in step with the children (Children, Add children as beneficiaries; `child` names the child
  // a beneficiary was added for). While the switch is on, each child has one: matched by the child's name, else in
  // order (a renamed child; an unedited name follows it), and a new child gets one with the defaults, an equal part
  // and Same as household. A child's beneficiary left without its child (the child removed, or the switch off) is
  // removed unless edited (`childHeirEdited`); an edited one is kept as your own and named in `kept`. The start
  // beneficiary gives way to the first children. The shares always total 100% (`scaleHeirShares`) and the list is
  // never empty. `addFor` (child names) limits which children without one get one and which of your own named as a
  // child are relinked; left out, every child. Returns {heirs, changed, kept}; the inputs are not changed.
  function syncChildHeirs(inputs, heirFields, maximum, addFor) {
    const strategies = (inputs && inputs.strategies) || {};
    const before = strategies.heirs || [];
    const count = before.length;
    const children = strategies.childrenAsHeirs ? (inputs.children || []).map((child) => String(child.name)) : [];
    const free = children.map((_, position) => position);
    const adds = (name) => addFor == null || addFor.includes(name);
    const copies = before.map((heir) => ({ ...heir }));
    const pairs = new Map();
    const pair = (heir, test) => {
      const at = free.findIndex((position) => test(children[position]));
      if (at >= 0) pairs.set(heir, free.splice(at, 1)[0]);
    };
    for (const heir of copies) if (heir.child != null) pair(heir, (name) => name === heir.child);
    // One of your own named as a child that has none (kept when the switch went off) is that child's again.
    for (const heir of copies) {
      if (heir.child != null) continue;
      pair(heir, (name) => name === heir.name && adds(name));
      if (pairs.has(heir)) heir.child = heir.name;
    }
    for (const heir of copies) if (heir.child != null && !pairs.has(heir) && free.length) pairs.set(heir, free.shift());
    const kept = [];
    let heirs = copies.filter((heir) => {
      if (heir.child == null) return true;
      if (pairs.has(heir)) {
        const name = children[pairs.get(heir)];
        if (heir.name === heir.child) heir.name = name;
        heir.child = name;
        return true;
      }
      if (!childHeirEdited(heir, heirFields, count)) return false;
      kept.push(heir.name);
      heir.child = null;
      return true;
    });
    const adding = free.filter((position) => adds(children[position]));
    if (adding.length && heirs.length === 1 && isStartHeir(heirs[0], heirFields)) heirs = [];
    heirs = scaleHeirShares(heirs);
    for (const position of adding) {
      if (maximum != null && heirs.length >= maximum) break;
      heirs = addHeir(heirs, heirFields);
      Object.assign(heirs[heirs.length - 1], { name: children[position], child: children[position] });
    }
    if (!heirs.length) heirs = [heirDefaults(heirFields, 0, 1)];
    heirs = scaleHeirShares(heirs);
    return { heirs, changed: JSON.stringify(heirs) !== JSON.stringify(before), kept };
  }

  // The children with no beneficiary added for them (no `child` of their name), each with the beneficiaries of your
  // own whose name matches theirs, ignoring case and spaces at the ends: [{child, matches: [positions]}].
  function missingChildHeirs(inputs) {
    const heirs = (inputs && inputs.strategies && inputs.strategies.heirs) || [];
    const key = (name) => String(name == null ? "" : name).trim().toLowerCase();
    return ((inputs && inputs.children) || []).map((child) => String(child.name))
      .filter((name) => !heirs.some((heir) => heir.child === name))
      .map((child) => ({ child, matches: heirs.map((heir, position) => [heir, position])
        .filter(([heir]) => heir.child == null && key(heir.name) === key(child)).map(([, position]) => position) }));
  }

  // Add children as beneficiaries (Benefits' Add children button): each child without one gets a beneficiary added
  // for them (an equal part, the others keep their split of the rest, Same as household). A child whose name matches
  // one of your own (`missingChildHeirs`) follows `onMatch`: "link" makes that one the child's, "add" adds a second
  // beside it, "skip" leaves the child without one. Returns the inputs' new strategies with Add children as
  // beneficiaries on; the inputs are not changed.
  function addChildHeirs(inputs, heirFields, maximum, onMatch) {
    const strategies = { ...((inputs && inputs.strategies) || {}), childrenAsHeirs: true };
    let heirs = (strategies.heirs || []).map((heir) => ({ ...heir }));
    const names = [];
    for (const { child, matches } of missingChildHeirs(inputs)) {
      if (!matches.length || onMatch === "add") names.push(child);
      else if (onMatch === "link") heirs[matches[0]].child = child;
    }
    if (names.length && heirs.length === 1 && isStartHeir(heirs[0], heirFields)) heirs = [];
    for (const name of names) {
      if (maximum != null && heirs.length >= maximum) break;
      heirs = addHeir(scaleHeirShares(heirs), heirFields);
      Object.assign(heirs[heirs.length - 1], { name, child: name });
    }
    strategies.heirs = syncChildHeirs({ ...inputs, strategies: { ...strategies, heirs } }, heirFields, maximum, []).heirs;
    return strategies;
  }

  // The mean of the inflation range (triangular: the average of its three points), the rate the model takes out of
  // returns, interest and raises in today's dollars; null without a range.
  function meanInflation(inputs) {
    const range = inputs && inputs.inflation;
    if (!range) return null;
    const points = [range.minimum, range.mode, range.maximum].map(Number);
    return points.every(Number.isFinite) ? (points[0] + points[1] + points[2]) / 3 : null;
  }

  // The line that says what the results' dollars are, by the result's `dollars` ("future" when inflation adjusted)
  // and the inputs it ran on (for the average inflation).
  function dollarsNote(inputs, dollars) {
    const mean = meanInflation(inputs);
    const average = mean == null ? "" : " (" + percent(mean, 1) + ")";
    if (dollars === "future") {
      return "Amounts are inflation adjusted: each year's dollars, with inflation drawn from its range (average"
        + (mean == null ? "" : " " + percent(mean, 1)) + ").";
    }
    return "Amounts are in today's dollars. Average inflation" + average + " is taken out of market returns, interest, "
      + "raises and other growth rates.";
  }

  // What the after-tax caption says the beneficiaries' payout is while no flat rate is set.
  function beneficiaryPayoutText(inputs) {
    const heirs = (inputs && inputs.strategies && inputs.strategies.heirs) || [];
    const payouts = new Set(heirs.map((heir) => heir.payout));
    if (payouts.size === 1 && payouts.has("lump")) {
      return "Beneficiaries' one-year withdrawal of everything taxed at their brackets.";
    }
    if (payouts.size > 1) return "Each beneficiary's payout taxed at their brackets.";
    return "Beneficiaries' 10-year drawdown taxed at their brackets.";
  }

  // The text a select shows for a choice: its label from the schema's `choiceLabels` (a state shows "NJ - New
  // Jersey"), else `nullLabel` (or "None") for a blank, else the choice itself.
  function choiceLabel(field, choice, nullLabel) {
    const labels = (field && field.choiceLabels) || {};
    if (labels[String(choice)] != null) return labels[String(choice)];
    return choice == null ? nullLabel || "None" : String(choice);
  }

  // The choices of a long select that match what is typed in its search box: each word must start a word of the
  // choice's label, ignoring case ("new j" and "nj" find "NJ - New Jersey"); a blank search keeps every choice.
  function filterChoices(field, choices, query) {
    const words = String(query || "").toLowerCase().split(/[\s-]+/).filter(Boolean);
    if (!words.length) return choices.slice();
    return choices.filter((choice) => {
      const parts = choiceLabel(field, choice).toLowerCase().split(/[\s-]+/).filter(Boolean);
      return words.every((word) => parts.some((part) => part.startsWith(word)));
    });
  }

  // The choices a state combobox lists for what is typed in it (`options`: {value, label} in the select's order, the
  // blank choice's value ""): every choice for a blank box, else the matches of `filterChoices` (the blank choice is
  // offered to a blank box only).
  function comboOptions(options, query) {
    if (!String(query || "").trim()) return options.slice();
    const field = { choiceLabels: Object.fromEntries(options.map((option) => [option.value, option.label])) };
    const kept = new Set(filterChoices(field, options.filter((option) => option.value !== "")
      .map((option) => option.value), query));
    return options.filter((option) => kept.has(option.value));
  }

  // Where a key moves a combobox's highlight in a list of `count` choices (-1: none): the arrows go round the list,
  // Home and End jump to its ends, any other key leaves it.
  function comboMove(count, active, key) {
    if (!count) return -1;
    if (key === "ArrowDown") return active < 0 || active >= count - 1 ? 0 : active + 1;
    if (key === "ArrowUp") return active <= 0 ? count - 1 : active - 1;
    if (key === "Home") return 0;
    if (key === "End") return count - 1;
    return active;
  }

  // The value Enter picks in a combobox listing `listed` with `active` highlighted after `query` was typed: the
  // highlighted choice, else the only match, else for a cleared box the blank choice where the list has one; null
  // keeps the value it had.
  function comboPick(listed, active, query) {
    if (active >= 0 && active < listed.length) return listed[active].value;
    if (!String(query || "").trim()) return listed.some((option) => option.value === "") ? "" : null;
    return listed.length === 1 ? listed[0].value : null;
  }

  // The fields of an item type whose change redraws an open sheet: the sources of the blank figures and the
  // replacement rules, which decide what the sheet shows.
  function sheetSources(typeName) {
    return typeName === "Car" ? ["purchasePrice", "loanRate", "loanMonthsLeft", "downPaymentRate", "replaceEveryYears",
      "replaceEveryMiles", "replaceBy", "purchaseYear", "firstYearDrop", "depreciationRate", "valueToday"] : [];
  }

  // The section a field is drawn in on an item's sheet instead of its schema group, or null: a car owned today's
  // purchase price opens its Value section (`carValue.group`).
  function sheetGroup(typeName, name, item, rules) {
    if (typeName === "Car" && name === "purchasePrice" && item && !item.buysLater && rules.carValue) {
      return rules.carValue.group;
    }
    return null;
  }

  // A car owned's value in today's dollars as the depreciation calculator sees it (wmti estimatedValueToday): the price paid less
  // the first-year drop (its own, else `carValue.firstYearDrop`), then the yearly rate for each later year owned up to
  // `carValue.thisYear`; a car bought this year or later is at its price. null without a year bought or the rules.
  function carEstimatedValue(car, rules) {
    const value = rules && rules.carValue;
    if (!value || !car || car.purchaseYear == null || car.purchaseYear === "") return null;
    const years = Math.max(0, value.thisYear - Number(car.purchaseYear));
    const price = Number(car.purchasePrice) || 0;
    if (years === 0) return price;
    const drop = car.firstYearDrop == null ? value.firstYearDrop : Number(car.firstYearDrop);
    return price * (1 - drop) * Math.pow(1 - (Number(car.depreciationRate) || 0), years - 1);
  }

  // A car's value today (wmti valueTodayOf): 0 for a leased car, which is not owned; the value entered (an override)
  // when above 0, else for a car owned today (not bought later) its estimate (`carEstimatedValue`), else 0.
  function carValueToday(car, rules) {
    if (car.leases) return 0;
    if (Number(car.valueToday) > 0 || car.buysLater) return Number(car.valueToday) || 0;
    return carEstimatedValue(car, rules) || 0;
  }

  // The label a field takes on an item's sheet instead of its schema label, or null: a commuting car's miles per year
  // are the extra miles beyond the commute, a car owned today's purchase price is the price paid, and a figure takes
  // its `switchLabels` label while that switch is on (a car bought later shows its loan term).
  function sheetLabel(typeName, name, item, rules) {
    // An expense's amount says only how often: per year for Major Spending and Charity rows, per month for the rest.
    if (typeName === "ExpenseItem" && name === "amount" && item) {
      return [rules.majorCategory, rules.charityCategory].includes(item.category) ? "Annually" : "Monthly";
    }
    // Its From and To ages are one slider: two knobs, or one for a Major Spending row paid in one year.
    if (typeName === "ExpenseItem" && name === "year" && item) {
      return item.category === rules.majorCategory ? "Age paid" : "Ages";
    }
    if (typeName === "Car" && name === "otherMilesPerYear" && item && item.commutes) return rules.carExtraMilesLabel;
    if (typeName === "Car" && name === "purchasePrice" && item && !item.buysLater && rules.carPricePaidLabel) {
      return rules.carPricePaidLabel;
    }
    for (const [toggle, labels] of Object.entries((rules.switchLabels || {})[typeName] || {})) {
      if (item && item[toggle] && labels[name]) return labels[name];
    }
    return null;
  }

  // The switches on an item's sheet that show or hide other fields, so changing one redraws the sheet (the timeline's
  // switches and the car switches How it is paid sets are not on the sheet; How it is paid is).
  function sheetSwitches(typeName, rules) {
    const managed = ((rules.timelineManaged || {})[typeName] || [])
      .concat(typeName === "Car" ? rules.carPaidBySwitches || [] : []);
    const switches = Object.keys((rules.itemSwitches || {})[typeName] || {}).filter((toggle) => !managed.includes(toggle));
    return typeName === "Car" ? switches.concat(["payMethod", "replacementPayMethod"]) : switches;
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
      else shown.push({ name, group: layout.groups[name] || (typeName === "Car" ? carRuleGroup(name, rules) : null) });
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
      if (!(rules.rothBasisKinds || []).includes(item.kind) && item.rothBasis != null) cleared.rothBasis = null;
      if (!rules.depositKinds.includes(item.kind) && item.deposit != null) cleared.deposit = null;
    }
    // A car's How it is paid sets its Loan and Lease switches: Finance turns the Loan switch on, Lease the Lease
    // switch, Cash both off.
    if (typeName === "Car" && field === "payMethod" && item.payMethod) {
      const financed = item.payMethod === "finance";
      const leased = item.payMethod === "lease";
      if (Boolean(item.hasLoan) !== financed) cleared.hasLoan = financed;
      if (Boolean(item.leases) !== leased) cleared.leases = leased;
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

  // The owner an account takes from its kind (wmti.inputs.retirementInputs.defaultOwner): Joint for cash, Investments
  // and 529, You for a 401k or IRA. A blank owner, one still the previous kind's default, or Joint on a kind one person
  // holds becomes the new kind's; an owner the user chose otherwise is kept. `defaults` is appInfo().defaultOwners.
  function kindOwnerFilled(item, previousKind, defaults) {
    const fresh = defaults && defaults[item.kind];
    if (!fresh) return {};
    const previous = previousKind != null ? defaults[previousKind] : null;
    const follows = item.owner == null || item.owner === previous || (item.owner === "JOINT" && fresh !== "JOINT");
    return follows && item.owner !== fresh ? { owner: fresh } : {};
  }

  // The collapsed returns header of an account sheet: "Return 6.0% · std dev 12.0%".
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

  // The knobs of an expense row's ages slider on a track from `low` (your age today) to `high` (your age in the
  // run's last year). A Major Spending row has one knob (`at`: its From age, else your age today with `set` false, as
  // a row with no From age is never paid); any other row two (`from`, `to`: a blank From age sits at the start, a blank
  // To age at the end). A stored age outside the track shows at its nearest end (`outside` true) and is not rewritten.
  // `text` reads the ages shown: "Age 40 to 65", "Age 52", or "No age yet: not paid".
  function expenseAgeKnobs(item, low, high, rules) {
    const clamp = (age) => Math.min(high, Math.max(low, Number(age)));
    const away = (age) => age != null && (Number(age) < low || Number(age) > high);
    const outside = away(item.year) || away(item.toAge);
    if (item.category === rules.majorCategory) {
      const set = item.year != null;
      const at = set ? clamp(item.year) : low;
      const until = set && item.toAge != null ? clamp(item.toAge) : at;
      const text = !set ? "No age yet: not paid" : until > at ? "Age " + at + " to " + until : "Age " + at;
      return { major: true, at, set, outside, text };
    }
    const from = item.year == null ? low : clamp(item.year);
    const to = Math.max(from, item.toAge == null ? high : clamp(item.toAge));
    return { major: false, from, to, set: true, outside, text: to > from ? "Age " + from + " to " + to : "Age " + from };
  }

  // What a knob of the ages slider moved to `age` stores ({field: value}): a Major Spending row's one knob its From
  // age, paid once (a blank To age); the From knob at the start of the track a blank From age (the start of the run),
  // the To knob at the end a blank To age (the end), else the age.
  function expenseAgeStored(knob, age, low, high) {
    if (knob === "at") return { year: age, toAge: null };
    if (knob === "from") return { year: age <= low ? null : age };
    return { toAge: age >= high ? null : age };
  }

  // The knobs of the Roth conversion's ages slider on a track from `low` to `high`: `from` its start age, `to` its end
  // age (never before `from`). The ages are never blank. A stored age outside the track shows at its nearest end
  // (`outside` true) and is not rewritten. `text` reads "Age 60 to 74", or "Age 60" for one year.
  function rothAgeKnobs(plan, low, high) {
    const clamp = (age) => Math.min(high, Math.max(low, Number(age)));
    const away = (age) => Number(age) < low || Number(age) > high;
    const from = clamp(plan.startAge);
    const to = Math.max(from, clamp(plan.endAge));
    return { from, to, outside: away(plan.startAge) || away(plan.endAge),
      text: to > from ? "Age " + from + " to " + to : "Age " + from };
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
  // where the Household settings are. Savings and benefits lead to the Benefits chip of Inputs (`chip`);
  // healthcare to the Healthcare chip; retirement, medicare and the Social Security names to the Retirement chip, which
  // holds Social Security and Medicare. Unknown names give null.
  const ROUTES = {
    setup: ["setup", null], inputs: ["inputs", null], outputs: ["outputs", null],
    summary: ["outputs", "summary"], plots: ["outputs", "plots"], compare: ["outputs", "compare"],
    optimize: ["outputs", "optimize"], awards: ["awards", null],
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

  // Turn off each group's on-defaults switch once one of its figures differs from the shipped value;
  // the switch comes back on only through Reset to defaults. Returns whether a switch changed.
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

  // The monthly totals under the expense lists: `rows`, one per monthly category, and
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

  // Spending in retirement (wmti.inputs.retirementInputs.spendingStartAge and spendingFactor): from the start age
  // (blank: your Social Security claim age, or with no benefit entered the age you stop working, today's age when
  // retired; see defaultSpendingStartAge) a row's amount is multiplied by 1 + its percent: in
  // Equal change the one `equalChange` for the monthly rows (Bills, Planned Spending, Other Spending) only, in Per
  // expense each row's own `retirementChange`.
  const MONTHLY_EXPENSE_CATEGORIES = ["Bills", "Planned Spending", "Other Spending"];

  // Whether a person has a Social Security benefit (wmti hasSocialSecurity): the "earnings" basis, or an entered
  // amount above 0.
  function hasSocialSecurity(person) {
    return person.socialSecurityBasis === "earnings"
      || Object.values(person.socialSecurityByAge || {}).some((amount) => Number(amount) > 0);
  }

  // The age a blank start age means (wmti defaultSpendingStartAge): the claim age, else the age pay stops.
  function defaultSpendingStartAge(person) {
    if (hasSocialSecurity(person)) return Number(person.socialSecurityAge);
    return person.retired ? person.currentAge : person.salaryEndAge;
  }

  function spendingStartAge(inputs) {
    const start = ((inputs || {}).retirementSpending || {}).startAge;
    if (start != null) return start;
    return defaultSpendingStartAge(inputs.you);
  }

  function spendingFactor(inputs, item, age) {
    const plan = inputs.retirementSpending || {};
    if (!plan.enabled || age < spendingStartAge(inputs)) return 1;
    if (plan.mode === "equal") {
      return MONTHLY_EXPENSE_CATEGORIES.includes(item.category) ? 1 + (Number(plan.equalChange) || 0) : 1;
    }
    return 1 + (Number(item.retirementChange) || 0);
  }

  // Whether the change alters any row (wmti spendingChangeActive): switched on and a percent the mode reads is not 0.
  function spendingChangeActive(inputs) {
    const plan = inputs.retirementSpending || {};
    const expenses = inputs.expenses || [];
    if (!plan.enabled) return false;
    if (plan.mode === "equal") {
      return Number(plan.equalChange) !== 0 && expenses.some((item) => MONTHLY_EXPENSE_CATEGORIES.includes(item.category));
    }
    return expenses.some((item) => Number(item.retirementChange) !== 0);
  }

  // Every Expenses row as the Per expense list shows it (wmti.dashboard.editing.spendingChangeRows): name, category,
  // amount, its own `change`, the amount `after` the change from the start age, and `unit` ("month" or "year").
  function spendingChangeRows(inputs) {
    const start = spendingStartAge(inputs);
    return (inputs.expenses || []).map((item) => ({ name: item.name, category: item.category,
      amount: Number(item.amount) || 0, change: Number(item.retirementChange) || 0,
      after: (Number(item.amount) || 0) * spendingFactor(inputs, item, start),
      unit: MONTHLY_EXPENSE_CATEGORIES.includes(item.category) ? "month" : "year" }));
  }

  // The monthly rows charged at the start age before and after the change, today's dollars (wmti spendingChangePreview):
  // {startAge, before, after, fromFirstYear}, or null while the change is off or changes nothing.
  function spendingChangePreview(inputs) {
    if (!spendingChangeActive(inputs)) return null;
    const start = spendingStartAge(inputs);
    const monthly = (inputs.expenses || []).filter((item) => MONTHLY_EXPENSE_CATEGORIES.includes(item.category)
      && expenseActiveAt(item, start));
    return { startAge: start, before: monthly.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      after: monthly.reduce((sum, item) => sum + (Number(item.amount) || 0) * spendingFactor(inputs, item, start), 0),
      fromFirstYear: start <= inputs.you.currentAge };
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
  // dollars as the app shows them): `entered`, the rows of an `expenseSummary` (each monthly category, then Major
  // Spending and Charity per year / 12); `counted`, the one "Bills - Other" row: the sum of the read-only rows other
  // tabs charge (the settings notes' `alreadyCounted` rows; the note row, with no amount, is left out), or null when
  // there are none or before the notes arrive; and `total`, the one "Total expenses" row: the entered rows plus the
  // counted ones, or null before the notes arrive. Each amount is rounded to the dollar before it is added, so the total
  // is exactly the entered rows plus the Bills - Other row.
  function expenseTotals(summary, countedRows) {
    const whole = (value) => Math.round(Number(value) || 0);
    const add = (rows) => rows.reduce((sum, row) => sum + row.monthly, 0);
    const entered = [...summary.rows.map((row) => [row.category, row.total]),
      ...summary.annual.map((row) => [row.category + " (per year ÷ 12)", row.total])]
      .map(([item, monthly]) => ({ item, monthly: whole(monthly) }));
    if (!countedRows) return { entered, counted: null, total: null };
    const counted = countedRows.filter((row) => row.monthly != null).map((row) => ({ monthly: whole(row.monthly) }));
    return { entered, counted: counted.length ? { item: "Bills - Other", monthly: add(counted) } : null,
      total: { item: "Total expenses", monthly: add(entered) + add(counted) } };
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
  // on (every so many years or miles, each only while Replace by selects it, and a price above 0: the purchase price of a car bought later when blank), when
  // it is bought and sold (`spanText`), and its value today (its price when bought later; see `carValueToday`). The
  // driver shows as `driverField`'s choice label ("You") when the schema field is given, else as stored.
  function carSummary(car, currentAge, sheetRules, driverField) {
    const price = car.replacementPrice > 0 ? car.replacementPrice : (car.purchasePrice || 0);
    const method = carReplacementMethodOf(car);
    const rules = [];
    const on = carReplaceRulesOf(car);
    if (on.years && car.replaceEveryYears > 0) rules.push(car.replaceEveryYears + " years");
    if (on.miles && car.replaceEveryMiles > 0) rules.push(Number(car.replaceEveryMiles).toLocaleString("en-US") + " miles");
    const replaced = !car.leases && (price > 0 || method === "lease") && rules.length > 0;
    const how = { finance: ", financed", lease: ", leased" }[method] || "";
    const span = spanText(car, currentAge);
    return { name: car.name, detail: choiceLabel(driverField, car.driver) + (hasCarLoan(car) ? " · loan" : "")
      + (replaced ? " · replaced every " + rules.join(" or ") + how : "") + (span ? " · " + span : ""),
    value: compactMoney(car.buysLater && !car.leases ? car.purchasePrice : carValueToday(car, sheetRules)) };
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
  // is the other's purchase age: the new home counts for that year), as periodsOverlap.
  function primaryPeriod(home) {
    return [home.buysLater && home.purchaseAge != null ? home.purchaseAge : -Infinity,
      home.sellsLater && home.saleAge != null ? home.saleAge : Infinity];
  }

  function periodsOverlap(first, second) {
    const shared = first[0] <= second[1] && second[0] <= first[1];
    const move = first[1] === second[0] || second[1] === first[0];
    return shared && !(move && Math.min(first[1], second[1]) === Math.max(first[0], second[0]));
  }

  // The ages a rent period is rented, from its start age (or always) to its end age (or always), as
  // wmti.homes.homes.rentPeriods.
  function rentPeriod(rent) {
    return [rent.startAge != null ? rent.startAge : -Infinity, rent.endAge != null ? rent.endAge : Infinity];
  }

  // After the primary residence switch of the home at `position` changed: ticked, it is a primary and every other
  // primary held in the same years is unticked (with no purchase or sale, every other home); unticked, it stays off
  // while another primary is left, else it is ticked again. A home held while a rent period (`rents`) is rented,
  // other than in a shared move year, cannot be ticked: one primary residence at a time, the rent periods included,
  // as wmti.homes.homes._checkPrimaryLane. Changes the list in place and returns it.
  function choosePrimary(homes, position, rents) {
    const chosen = homes[position];
    if (chosen.primaryResidence && (rents || []).some((rent) => periodsOverlap(rentPeriod(rent), primaryPeriod(chosen)))) {
      chosen.primaryResidence = false;
      return homes;
    }
    if (!chosen.primaryResidence && homes.some((home, index) => index !== position && home.primaryResidence)) return homes;
    chosen.primaryResidence = true;
    homes.forEach((home, index) => {
      if (index !== position && home.primaryResidence && periodsOverlap(primaryPeriod(home), primaryPeriod(chosen))) {
        home.primaryResidence = false;
      }
    });
    return homes;
  }

  // Why a home cannot be ticked primary (choosePrimary refuses it), as a sentence for the sheet: each rent period it
  // overlaps, in start order, with the ages and calendar years they share (an open end clamped to the run, `low` to
  // `high`, your ages; `lawYear` the year you are `low`); null when it overlaps none. The rule is
  // wmti.homes.homes._checkPrimaryLane's.
  function primaryClashText(home, rents, low, high, lawYear) {
    const held = primaryPeriod(home);
    const clashes = (rents || []).map((rent) => ({ rent, period: rentPeriod(rent) }))
      .filter((entry) => periodsOverlap(entry.period, held))
      .map((entry) => ({ name: entry.rent.name, first: Math.min(Math.max(entry.period[0], held[0], low), high),
        last: Math.max(Math.min(entry.period[1], held[1], high), low) }))
      .sort((first, second) => first.first - second.first);
    if (!clashes.length) return null;
    const parts = clashes.map((clash) => "the rent period " + clash.name + " at ages " + clash.first + " to "
      + clash.last + " (" + yearOfAge(clash.first, low, lawYear) + " to " + yearOfAge(clash.last, low, lawYear) + ")");
    const listed = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
    return home.name + " cannot be the primary residence: it overlaps " + listed + ". One primary residence at a time: "
      + "on the Timeline, sell the home or end the rent first.";
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

  // Whether a car charges its own loan (wmti hasCarLoan): owned today, its Loan switch on and a balance above 0;
  // bought later, financed (carPayMethodOf) with the price less the down payment above 0; a leased car never does.
  function hasCarLoan(car) {
    if (car.leases) return false;
    if (car.buysLater) return carPayMethodOf(car) === "finance" && car.purchasePrice * (1 - car.downPaymentRate) > 0;
    return Boolean(car.hasLoan) && car.loanBalance > 0;
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
  // A car's replacements (the segment's `replacements`, the years wmti's model replaces it: timelineView) each become
  // a calculated stretch of its bar, from the replacement to the year before the next one or the bar's end; one at or
  // past the bar's end is left out. A home's bar carries its segment's `primary` (the primary residence lane), `state`
  // and `isCalculated` (the Relocation strategy's home or rent, drawn gray over its lane; timelineView's `calculated`).
  // Returns [{lane, segments, bars: [{mode, name, text, position, left, width, primary, state, isCalculated,
  // calculated: [{age, year, rule, label, method, left, width}]}]}], left and width in percent, `segments` the lane's
  // segments in order.
  function timelineBars(segments, low, high) {
    const span = high - low + 1;
    const lanes = [];
    for (const segment of segments) {
      let row = lanes.find((entry) => entry.lane === segment.lane);
      if (!row) {
        row = { lane: segment.lane, segments: [], bars: [] };
        lanes.push(row);
      }
      row.segments.push(segment);
      // A segment that hands its end year to the next one is drawn up to the year before; the next one fills it.
      const end = segment.endAge == null ? high : segment.endAge - (segment.handsOver ? 1 : 0);
      const marks = (segment.replacements || []).filter((mark) => mark.age <= end);
      const calculated = marks.map((mark, index) => {
        const to = index + 1 < marks.length ? marks[index + 1].age - 1 : end;
        return { ...mark, left: ((mark.age - low) / span) * 100, width: ((to - mark.age + 1) / span) * 100 };
      });
      row.bars.push({ mode: segment.mode, name: segment.name, text: segment.text, position: segment.position,
        left: ((segment.startAge - low) / span) * 100, width: ((end - segment.startAge + 1) / span) * 100, calculated,
        primary: Boolean(segment.primary), state: segment.state || null, isCalculated: Boolean(segment.calculated) });
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

  // A person's employer match as the one share of pay the forms show, rate x cap (50% up to 6% is 3%), and the rate
  // and cap an entered share is stored as: rate 1 and the share as the cap, or the stored terms when the share is
  // unchanged (wmti.accounts.contributions.matchPercent and matchTermsFromPercent).
  const MATCH_PERCENT_FIELD = "percent";
  const MATCH_PERCENT_TOLERANCE = 1e-9;

  function matchPercent(match) {
    return match == null ? undefined : match.rate * match.cap;
  }

  function matchTermsFromPercent(share, match) {
    if (Math.abs(share - matchPercent(match)) <= MATCH_PERCENT_TOLERANCE) return { rate: match.rate, cap: match.cap };
    return { rate: 1, cap: share };
  }

  // The value at a walkthrough field path: an input path, an account selector `accounts[Savings].startingValue`
  // (the first account of that kind) or the home selector `homes[primary].valueToday` (the primary residence, as
  // wmti.dashboard.walkthrough._selected); undefined when a part is missing. A person's `employerMatch.percent` is
  // read as rate x cap.
  function walkRead(data, path) {
    if (path === "years" && data && data.years == null) return planYears(data);  // blank: the years to age 100
    if (path.endsWith("employerMatch." + MATCH_PERCENT_FIELD)) {
      return matchPercent(walkRead(data, path.slice(0, -(MATCH_PERCENT_FIELD.length + 1))));
    }
    let target = data;
    for (const part of path.split(".")) {
      if (target == null) return undefined;
      const selector = WALK_SELECTOR.exec(part);
      if (!selector) {
        target = target[part];
        continue;
      }
      const pick = selector[1] === "homes" ? (item) => item && item.primaryResidence === true
        : (item) => item && item.kind === selector[2];
      target = (target[selector[1]] || []).find(pick);
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
    total: "Monthly spending", balances: "Savings balances", carCosts: "Car value and loans",
    childAges: "Children's ages" };
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
  // and each segment is one such topic: "done", "current" or "todo". A question of an optional topic is `extra`: it has
  // no number (0) and every segment is done, as the basic questions are behind it.
  function walkProgress(tree, rows, currentId) {
    const optional = new Set(tree.topics.filter((topic) => topic.optional).map((topic) => topic.id));
    const basic = rows.filter((row) => row.depth === 0 && !optional.has(row.topic));
    const byId = {};
    for (const row of rows) byId[row.id] = row;
    let top = byId[currentId];
    while (top && top.parent) top = byId[top.parent];
    const extra = Boolean(top && optional.has(top.topic));
    const number = top && !extra ? basic.findIndex((row) => row.id === top.id) + 1 : 0;
    const topics = tree.topics.filter((topic) => !optional.has(topic.id) && basic.some((row) => row.topic === topic.id));
    const reached = currentId === "review" || extra ? topics.length
      : top ? topics.findIndex((topic) => topic.id === top.topic) : -1;
    const segments = topics.map((topic, index) => ({ id: topic.id, title: topic.title,
      state: index < reached ? "done" : index === reached ? "current" : "todo" }));
    return { number, total: basic.length, topic: top ? top.topicTitle : null, extra, segments };
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

  // What the cars are worth today and what their loans still owe, all together (as
  // wmti.dashboard.walkthrough.carTotals): { value, loan }, each car's value today by `carValueToday` (`rules`: the
  // sheet rules, for the estimate), a loan counted only while it is on.
  function carTotalsOf(data, rules) {
    const cars = (data && data.cars) || [];
    return { value: cars.reduce((sum, car) => sum + carValueToday(car, rules), 0),
      loan: cars.reduce((sum, car) => sum + (car.hasLoan ? car.loanBalance || 0 : 0), 0) };
  }

  // The parts of the inputs the walkthrough does not set in full that still hold the example household's figures:
  // [panel, label, count, unit] each. A whole list (children, expense rows, cars, loans, homes) equal to the
  // example's; else, within a changed list, the example's one-off (Major Spending) rows still there and the children
  // still born at the example's ages; and each Social Security benefit table still the example's (a benefit estimated
  // from pay is not listed).
  function exampleLeftoverList(inputs, defaults) {
    if (!inputs || !defaults) return [];
    const same = (key) => sameValue(inputs[key], defaults[key]);
    const items = [["children", "Children", (inputs.children || []).length, "children"],
      ["expenses", "Expense rows", (inputs.expenses || []).length, "rows"],
      ["cars", "Cars", (inputs.cars || []).length, "cars"],
      ["loans", "Loans", (inputs.loans || []).length, "loans"],
      ["home", "Homes", (inputs.homes || []).length, "homes"]].filter((item) => item[2] > 0
        && same(item[0] === "home" ? "homes" : item[0]));
    if (!same("expenses")) {
      const major = (rows) => (rows || []).filter((row) => row.category === "Major Spending");
      const kept = major(inputs.expenses).filter((row) => major(defaults.expenses).some((old) => sameValue(old, row)));
      if (kept.length) items.push(["expenses", "One-off costs (college, daycare, repairs)", kept.length, "rows"]);
    }
    if (!same("children")) {
      const born = (inputs.children || []).filter((child, index) => defaults.children && defaults.children[index]
        && child.yourAgeAtBirth === defaults.children[index].yourAgeAtBirth);
      if (born.length) items.push(["children", "Children's ages", born.length, "children"]);
    }
    for (const [role, label] of [["you", "Your Social Security benefit"], ["partner", "Partner's Social Security benefit"]]) {
      const person = inputs[role];
      const example = defaults[role];
      if (person && example && person.socialSecurityBasis === "table"
        && sameValue(person.socialSecurityByAge, example.socialSecurityByAge)) {
        items.push(["income", label, Object.keys(person.socialSecurityByAge || {}).length, "ages"]);
      }
    }
    return items;
  }

  // A question's answer as Trail and Review text, read from the current inputs (`rules`: the sheet rules, for a car's
  // estimated value).
  function answerText(node, data, facts, rules) {
    if (node.control === "handoff") return "On the " + (node.handoff ? node.handoff.label : "") + " page";
    if (node.action === "partner") return data.partner != null ? "Yes" : "No";
    if (WALK_COUNT_LISTS[node.action]) return String((data[WALK_COUNT_LISTS[node.action]] || []).length);
    if (node.action === "total") return facts ? fullMoney(facts.monthlySpending) + " a month" : "";
    if (node.action === "carCosts") {
      const cars = carTotalsOf(data, rules);
      return "Worth " + fullMoney(cars.value) + ", loans " + fullMoney(cars.loan);
    }
    if (node.action === "childAges") {
      const age = data.you ? data.you.currentAge : 0;
      return (data.children || []).map((child) => String(age - child.yourAgeAtBirth)).join(", ") || "None";
    }
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

  // The publish channel (window.WMTI_BUILD.channel, set by build.py): "beta" for the beta app published under beta/,
  // anything else is the stable app. Both share one origin, so the beta keeps its own localStorage keys and offline
  // caches, and never writes the stable app's.
  const STABLE_STORAGE_PREFIX = "wmti.";
  const BETA_STORAGE_PREFIX = "wmti.beta.";

  function isBetaChannel(channel) {
    return channel === "beta";
  }

  // The start of every localStorage key this channel keeps ("wmti." or "wmti.beta.").
  function storagePrefix(channel) {
    return isBetaChannel(channel) ? BETA_STORAGE_PREFIX : STABLE_STORAGE_PREFIX;
  }

  // The starts of the cache names this channel's service worker keeps (sw.js): the offline copy and the saved
  // documentation pages. Clear all data deletes only these.
  function channelCachePrefixes(channel) {
    return isBetaChannel(channel) ? ["wmti-beta:", "wmti-beta-docs:"] : ["wmti:", "wmti-docs:"];
  }

  // The beta's first run starts from what the stable app keeps on this device: each stable key ("wmti.<name>", for
  // each <name> in `names`) is copied to its beta key ("wmti.beta.<name>") when the beta key is empty, once (the
  // `markerName` key is then set and no copy runs again). Stable keys are only read, never written or removed.
  // `storage` is localStorage (or anything with getItem and setItem). Returns the beta keys written.
  function copyStableStorage(storage, names, markerName) {
    const marker = BETA_STORAGE_PREFIX + markerName;
    if (storage.getItem(marker) != null) return [];
    const written = [];
    for (const name of names) {
      const value = storage.getItem(STABLE_STORAGE_PREFIX + name);
      const betaKey = BETA_STORAGE_PREFIX + name;
      if (value != null && storage.getItem(betaKey) == null) { storage.setItem(betaKey, value); written.push(betaKey); }
    }
    storage.setItem(marker, "done");
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
  // The input checker then needs five things a blank cannot give: filing SINGLE (there is no partner), one account
  // (a blank one), a Social Security claim age that is in its (zero) benefit table, and one beneficiary with the whole
  // estate (the schema's defaults).
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
    // The suggested category rows (settings schema `suggestedExpenses`, from .config/expenseCategories.json), blank.
    inputs.expenses = (schema.suggestedExpenses || []).map((row) => ({ ...blankObject(schema, "ExpenseItem"), ...row }));
    inputs.strategies.heirs = [heirDefaults(schema.types.Heir, 0, 1)];
    inputs.years = null;  // until you are 100 (yearsToAge100), following your age
    // The child inflation factor keeps its shipped default (20% per child): a blank 0 would make children cost nothing.
    const childFactor = (schema.types[schema.root] || []).find((field) => field.name === "childFactorPerChild");
    if (fieldDefault(childFactor) != null) inputs.childFactorPerChild = fieldDefault(childFactor);
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

  // The system-managed accounts the Benefits tab feeds, as wmti.inputs.retirementInputs.managedAccounts adds them to
  // a run: the HSA while it counts (on, with the medical plan on) with its starting balance, return and owner, then the
  // dependent care FSA while it is on (empty at the start, no return). Each is named "HSA" or "Dependent care FSA",
  // numbered from 2 when an account of the inputs already has that name (letter case counts, as in the model).
  function benefitAccounts(inputs) {
    const taken = new Set(((inputs && inputs.accounts) || []).map((account) => account.name));
    const name = (base) => {
      let candidate = base;
      for (let number = 2; taken.has(candidate); number += 1) candidate = base + " " + number;
      taken.add(candidate);
      return candidate;
    };
    const hsa = (inputs && inputs.hsa) || {};
    const accounts = [];
    if (hsa.enabled && inputs.premiums && inputs.premiums.medicalPlanEnabled) {
      accounts.push({ kind: "hsa", name: name("HSA"), value: hsa.startingBalance || 0, meanReturn: hsa.meanReturn,
        returnStdDev: hsa.returnStdDev, owner: hsa.owner || "YOU", sizing: hsa.sizing || "needed" });
    }
    if (inputs && inputs.dependentCareFsa && inputs.dependentCareFsa.enabled) {
      accounts.push({ kind: "fsa", name: name("Dependent care FSA"), value: 0, meanReturn: 0, returnStdDev: 0,
        owner: inputs.partner != null ? "JOINT" : "YOU", sizing: null });
    }
    return accounts;
  }

  // A name not yet taken: `base` itself, else "base 2", "base 3" and so on.
  function freeName(base, taken) {
    const used = new Set(taken.map((name) => name.toLowerCase()));
    if (!used.has(base.toLowerCase())) return base;
    let number = 2;
    while (used.has((base + " " + number).toLowerCase())) number += 1;
    return base + " " + number;
  }

  // A numbered scenario name, the lowest number that no name in `taken` uses (letter case ignored). A Duplicate
  // (`bare` false): `name` with any trailing "_Copy<number>" taken off, then "_Copy1", "_Copy2" and so on; other
  // suffixes stay ("Q4_2025" gives "Q4_2025_Copy1"). A New scenario (`bare` true): the base itself while it is free,
  // else "_1", "_2" and so on after any trailing "_<number>" is taken off.
  function numberedName(name, taken, bare) {
    const suffix = bare ? "_" : "_Copy";
    const base = String(name).replace(bare ? /_\d+$/ : /_Copy\d+$/i, "");
    const used = new Set(taken.map((item) => item.toLowerCase()));
    if (bare && !used.has(base.toLowerCase())) return base;
    let number = 1;
    while (used.has((base + suffix + number).toLowerCase())) number += 1;
    return base + suffix + number;
  }

  // The name an imported scenario opens under: `name` (the file's), unless Auto-save is on for it (not in
  // `autoSaveOff`) and `saved` (name to saved settings) holds different settings under it; then the next free
  // "_1", "_2" (numberedName, `taken` the names in use), so the save that follows at once never writes over them.
  // The settings alone are compared: an experience block (effort, style, walkthrough progress) on either side, or
  // missing from one, never makes a copy.
  function importedName(name, inputs, saved, autoSaveOff, taken) {
    const copy = Object.prototype.hasOwnProperty.call(saved, name) ? saved[name] : null;
    if (copy == null || autoSaveOff.includes(name)
      || sameValue(splitExperience(copy).inputs, splitExperience(inputs).inputs)) return name;
    return numberedName(name, taken, true);
  }

  // The app's experience block (wmti.inputs.retirementInputs.Experience: effort, style, riskComfort, progress,
  // tierOverrides, walk) travels with a saved scenario but is never part of the settings the model runs on.
  // `splitExperience` takes it off: {inputs (a copy without the key), experience (the block as found, or null)}.
  function splitExperience(data) {
    if (data == null || typeof data !== "object" || Array.isArray(data)) return { inputs: data, experience: null };
    const inputs = {};
    for (const key of Object.keys(data)) if (key !== "experience") inputs[key] = data[key];
    const block = data.experience;
    return { inputs, experience: block != null && typeof block === "object" && !Array.isArray(block) ? block : null };
  }

  // Settings with an experience block put back on, last (a null block leaves the settings unchanged).
  function joinExperience(inputs, experience) {
    if (experience == null || inputs == null) return inputs;
    return { ...splitExperience(inputs).inputs, experience };
  }

  // The block of a scenario saved before the effort and style pickers: High and Accountant, nothing else kept.
  function defaultExperience() {
    return { effort: "high", style: "accountant", riskComfort: null, progress: {}, tierOverrides: {}, walk: null };
  }

  // The block as a saved scenario or a file keeps it: the walkthrough's `before` (a full copy of the settings, for
  // its Undo) stays in the draft on this device only.
  function storedExperience(experience) {
    if (experience == null) return null;
    const copy = JSON.parse(JSON.stringify(experience));
    if (copy.walk != null && typeof copy.walk === "object") delete copy.walk.before;
    return copy;
  }

  // An effort's place in low < medium < high (wmti.inputs.retirementInputs.EFFORTS); anything else counts as high.
  const EFFORT_ORDER = ["low", "medium", "high"];
  function effortRank(effort) {
    const rank = EFFORT_ORDER.indexOf(effort);
    return rank < 0 ? EFFORT_ORDER.length - 1 : rank;
  }

  // Whether an input or a question of `tier` is shown at `effort`: its tier is not above the effort.
  function tierShown(tier, effort) {
    return effortRank(tier) <= effortRank(effort);
  }

  // A tier override's rank (low 0, medium 1, high 2), or -1 for a missing or non-tier value.
  function overrideRank(value) {
    return typeof value === "string" ? EFFORT_ORDER.indexOf(value) : -1;
  }

  // A table's own value at `key` (never one inherited from its prototype, such as `__proto__`), else undefined.
  function ownValue(table, key) {
    if (table == null || typeof table !== "object" || key == null) return undefined;
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
  }

  // Whether an input of `tier` is drawn at `effort` with the scenario's `experience.tierOverrides`: at Medium the
  // pane's `pane.<paneId>` override and the input's own `Type.field` override raise how far it shows; at Low and High
  // the effort alone decides (the Low page ignores overrides). A null `paneId` or `key` reads no override.
  function detailShown(tier, effort, overrides, paneId, key) {
    if (effortRank(effort) !== EFFORT_ORDER.indexOf("medium")) return tierShown(tier, effort);
    const paneOverride = paneId == null ? undefined : ownValue(overrides, "pane." + paneId);
    const reach = Math.max(effortRank(effort), overrideRank(paneOverride), overrideRank(ownValue(overrides, key)));
    return effortRank(tier) <= reach;
  }

  // The fields a form draws for an object of `typeName`: its stored fields, a derived field (the employer match
  // percent) in place of the first stored field it replaces.
  function objectFields(schema, typeName) {
    const derived = (schema.derivedFields || {})[typeName] || [];
    return ((schema.types || {})[typeName] || []).flatMap((child) => {
      const replacing = derived.filter((entry) => entry.replaces.includes(child.name));
      if (!replacing.length) return [child];
      return replacing.filter((entry) => entry.replaces[0] === child.name);
    });
  }

  // The schema field a `Type.field` key names (a stored or a derived field), or null.
  function keyField(schema, key) {
    if (typeof key !== "string" || !key.includes(".")) return null;
    const [typeName, name] = key.split(".");
    return objectFields(schema, typeName).find((field) => field.name === name)
      || ((schema.derivedFields || {})[typeName] || []).find((field) => field.name === name) || null;
  }

  // The tier of the option a shown field holds, when that option is offered only above the field's tier
  // (`schema.optionTiers`, such as the Social Security basis's earnings estimate at High), else undefined.
  function optionTierOf(schema, key, value) {
    if (value == null || typeof value === "object") return undefined;
    return ownValue(ownValue(schema.optionTiers, key), String(value));
  }

  // Whether a field's choice `value` is offered at `effort` with the overrides (see detailShown): an option of
  // `schema.optionTiers` above the effort is not (Medium offers the Social Security basis's entered table only).
  function optionShown(schema, key, value, effort, overrides, paneId) {
    const optionTier = schema ? optionTierOf(schema, key, value) : undefined;
    return optionTier === undefined || detailShown(optionTier, effort, overrides, paneId, key);
  }

  // What a panel's Add detail would show at `effort`: the panel entries and the object children (a child a panel
  // lists by its own `field.child` name counts there only; an object that is null in `inputs` has none) that the
  // effort and the input overrides hide, ignoring the panel's own `pane.<id>` override, and each shown field that holds
  // an option offered only above the effort (its value is kept and counts as a set hidden input). Returns `hidden`
  // (how many), `changed` (how many of them differ from `defaults`, every held option counted) and `labels` (theirs,
  // in drawing order).
  function detailHidden(schema, panel, effort, overrides, inputs, defaults) {
    const result = { hidden: 0, changed: 0, labels: [] };
    if (!schema || !panel) return result;
    const placed = new Set((schema.panels || []).flatMap((item) => item.fields || []));
    const note = (label, path, set = false) => {
      result.hidden += 1;
      result.labels.push(label);
      if (set || (inputs && defaults && !sameValue(getPath(inputs, path), getPath(defaults, path)))) result.changed += 1;
    };
    const shown = (field, key, path, label) => {
      const optionTier = inputs ? optionTierOf(schema, key, getPath(inputs, path)) : undefined;
      if (optionTier !== undefined && !detailShown(optionTier, effort, overrides, null, key)) note(label, path, true);
      visit(field, path);
    };
    const visit = (field, path) => {
      if (!field || field.kind !== "object" || !field.type) return;
      if (inputs && getPath(inputs, path) == null) return;
      for (const child of objectFields(schema, field.type)) {
        const childPath = path + "." + child.name;
        const childKey = field.type + "." + child.name;
        if (placed.has(childPath)) continue;
        if (detailShown(child.tier, effort, overrides, null, childKey)) shown(child, childKey, childPath, child.label);
        else note(child.label, childPath);
      }
    };
    for (const name of panel.fields || []) {
      const key = ownValue(panel.keys, name);
      const tier = ownValue(panel.tiers, name);
      const field = keyField(schema, key);
      const label = ownValue(panel.labels, name) || (field && field.label) || name;
      if (tier === undefined || detailShown(tier, effort, overrides, null, key)) shown(field, key, name, label);
      else note(label, name);
    }
    return result;
  }

  // A copy of `overrides` with the pane's Add detail on (`pane.<paneId>` set to high) or off (removed); never
  // changes `overrides`.
  function paneDetailOverrides(overrides, paneId, on) {
    const paneKey = "pane." + paneId;
    const entries = Object.entries(overrides && typeof overrides === "object" ? overrides : {})
      .filter(([key]) => key !== paneKey);
    if (on) entries.push([paneKey, "high"]);
    return Object.fromEntries(entries);
  }

  // The `tierOverrides` additions that show one lever's inputs at `effort`: `targets` is the lever's list in
  // `schema.surface` (each a `surfaceChain`: `chain` keys from the input up to its panel entry, their `tiers` and the
  // `panel`), and each chain key not already shown maps to its own tier. Empty at High.
  function surfaceOverrides(targets, effort, overrides) {
    const additions = {};
    for (const target of targets || []) {
      (target.chain || []).forEach((key, index) => {
        const tier = (target.tiers || [])[index];
        if (tier === undefined || Object.prototype.hasOwnProperty.call(additions, key)) return;
        if (!detailShown(tier, effort, overrides, target.panel, key)) Object.defineProperty(additions, key,
          { value: tier, enumerable: true, writable: true, configurable: true });
      });
    }
    return additions;
  }

  // The input path one surfacing target (a `surfaceChain` of `schema.surface`) draws: its panel `entry`, then the
  // field name of each chain key from the holder below the entry down to the input. `itemPath` (such as `children.0`)
  // names the list item to use when the entry is a list; without it the path names the list's field and no item.
  function surfacePath(target, itemPath) {
    if (!target || typeof target.entry !== "string") return null;
    const chain = Array.isArray(target.chain) ? target.chain : [];
    const prefix = typeof itemPath === "string" && new RegExp("^" + target.entry.replace(/[.[\]]/g, "\\$&")
      + "\\.\\d+$").test(itemPath) ? itemPath : target.entry;
    const names = chain.slice(0, -1).reverse().map((key) => key.slice(key.indexOf(".") + 1));
    return [prefix, ...names].join(".");
  }

  // A walkthrough field path (`accounts[Savings].balance`, `homes[primary].value`) with each list selector replaced by
  // the position of the item it picks in `data` (as walkRead picks it); null when a selector picks no item.
  function walkIndexedPath(data, path) {
    const parts = [];
    let target = data;
    for (const part of String(path).split(".")) {
      const selector = WALK_SELECTOR.exec(part);
      if (!selector) {
        parts.push(part);
        target = target == null ? undefined : target[part];
        continue;
      }
      const items = target == null ? [] : target[selector[1]] || [];
      const pick = selector[1] === "homes" ? (item) => item && item.primaryResidence === true
        : (item) => item && item.kind === selector[2];
      const position = items.findIndex(pick);
      if (position < 0) return null;
      parts.push(selector[1], String(position));
      target = items[position];
    }
    return parts.join(".");
  }

  // The scenario's `tierOverrides` as the Effort and style dialog lists them, in their stored order: each key with a
  // label (a pane's `pane.<id>` is "<Panel>: every input"; an input's `Type.field` its field's label, else the key).
  function overrideList(schema, overrides) {
    const panels = (schema && schema.panels) || [];
    const fieldLabel = (key) => {
      const [typeName, name] = [key.slice(0, key.indexOf(".")), key.slice(key.indexOf(".") + 1)];
      const types = (schema && schema.types) || {};
      const derived = (schema && schema.derivedFields) || {};
      const lists = [hasOwnKey(types, typeName) ? types[typeName] : [], hasOwnKey(derived, typeName) ? derived[typeName]
        : []];
      for (const list of lists) {
        const found = (list || []).find((child) => child.name === name);
        if (found && found.label) return found.label;
      }
      return key;
    };
    return Object.keys(overrides && typeof overrides === "object" ? overrides : {}).map((key) => {
      const panel = key.startsWith("pane.") && panels.find((item) => "pane." + item.id === key);
      return { key, label: panel ? panel.label + ": every input" : key.includes(".") ? fieldLabel(key) : key };
    });
  }

  function hasOwnKey(holder, key) {
    return Object.prototype.hasOwnProperty.call(holder, key);
  }

  // ---- Coach: the Next steps card (f100) ----
  const COACH_DISMISS_PREFIX = "coach.dismissed.";  // a dismissed gap's key in `experience.progress`
  const DEFAULT_RISK_PRESET = "balanced";  // the score preset while risk comfort is unset or unknown

  // The `experience.progress` key that marks gap `gapId` dismissed (Not now).
  function coachDismissKey(gapId) {
    return COACH_DISMISS_PREFIX + String(gapId);
  }

  // The gap ids dismissed in `progress` (the experience block's free table), in its stored order.
  function coachDismissed(progress) {
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) return [];
    return Object.keys(progress).filter((key) => key.startsWith(COACH_DISMISS_PREFIX) && progress[key])
      .map((key) => key.slice(COACH_DISMISS_PREFIX.length));
  }

  // The gaps (coachGaps' list, in its order) the card draws: at Low only those with a `lowGuide`, then those not in
  // `dismissed`, cut to `max`. `hidden` is the dismissed ones the effort would show, for "Show N hidden".
  function coachGapsShown(gaps, { effort, dismissed, max } = {}) {
    const offered = (Array.isArray(gaps) ? gaps : []).filter((gap) => gap && (effort !== "low" || gap.lowGuide));
    const away = new Set(Array.isArray(dismissed) ? dismissed : []);
    const kept = offered.filter((gap) => !away.has(gap.id));
    return { shown: max >= 0 ? kept.slice(0, max) : kept, hidden: offered.filter((gap) => away.has(gap.id)) };
  }

  // The key a sweep result is kept under: the inputs text it ran on, the sweep, the person, the score preset and the
  // seed; any of them changing makes the result stale.
  function coachSweepKey(inputsText, sweepId, who, preset, seed) {
    return JSON.stringify([inputsText, sweepId, who == null ? null : who, preset, seed]);
  }

  // The score preset for risk comfort `value` (appInfo().experience.riskComforts `list`); unset or unknown values
  // use DEFAULT_RISK_PRESET.
  // A check row's change in the typical outcome (dollars) as the card writes money: signed, whole dollars ("+$70,486",
  // "-$1,200", "+$0"); "" for no number.
  function coachChangeText(change) {
    if (typeof change !== "number" || !Number.isFinite(change)) return "";
    const whole = Math.round(change);
    return (whole < 0 ? "-" : "+") + fullMoney(Math.abs(whole));
  }

  function riskPresetOf(list, value) {
    const found = (Array.isArray(list) ? list : []).find((item) => item && item.id === value);
    return found && found.preset ? found.preset : DEFAULT_RISK_PRESET;
  }

  // How many inputs are left at the example household's values because the effort does not show them: the panel
  // entries (each schema panel's `fields`, tiered in its `tiers`, keyed in its `keys`) above `effort`, and not shown by
  // `overrides` (the scenario's `tierOverrides`, see detailShown), whose value in `inputs` equals the one in
  // `defaults`. None at High.
  function defaultedInputCount(schema, inputs, defaults, effort, overrides = {}) {
    if (!schema || !inputs || !defaults) return 0;
    let count = 0;
    for (const panel of schema.panels || []) {
      const tiers = panel.tiers || {};
      for (const name of panel.fields || []) {
        if (!Object.prototype.hasOwnProperty.call(tiers, name)
          || detailShown(tiers[name], effort, overrides, panel.id, ownValue(panel.keys, name))) continue;
        if (sameValue(getPath(inputs, name), getPath(defaults, name))) count += 1;
      }
    }
    return count;
  }

  // The first walkthrough question (a `walkthroughPlan` row, which carries its `tier`) that raising the effort from
  // `previous` to `effort` unlocked: shown now, not shown before. Null when the raise unlocked none.
  function firstUnlocked(rows, previous, effort) {
    const row = (rows || []).find((item) => tierShown(item.tier, effort) && !tierShown(item.tier, previous));
    return row ? row.id : null;
  }

  // A new scenario's block: the same effort, style, risk comfort and tier overrides, no progress and no walkthrough.
  function carriedExperience(experience) {
    const base = { ...defaultExperience(), ...(experience || {}) };
    return { effort: base.effort, style: base.style, riskComfort: base.riskComfort,
      progress: {}, tierOverrides: JSON.parse(JSON.stringify(base.tierOverrides || {})), walk: null };
  }

  // Whether a scenario's experience block (`found`) holds an effort and a style both offered (`offered`:
  // appInfo().experience) and either differs from `current` ({effort, style}): only then is the user asked which to
  // keep when it opens.
  function experienceDiffers(found, current, offered) {
    if (!found || typeof found !== "object" || Array.isArray(found)) return false;
    const known = offered.efforts.some((item) => item.id === found.effort)
      && offered.styles.some((item) => item.id === found.style);
    return known && (found.effort !== current.effort || found.style !== current.style);
  }

  // The block to adopt: the scenario's own (`found`), or with Keep mine its effort and style replaced by `current`.
  function experienceChoice(found, current, keepMine) {
    return keepMine ? { ...found, effort: current.effort, style: current.style } : found;
  }

  // An {effort, style} in words, from the offered labels: "High effort, Accountant style".
  function experienceWords(experience, offered) {
    const label = (items, id) => (items.find((item) => item.id === id) || { label: id }).label;
    return label(offered.efforts, experience.effort) + " effort, " + label(offered.styles, experience.style) + " style";
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

  // The settings paths whose values differ between two settings states, in the order of their keys: dotted, with
  // list positions as numbers ("expenses.3.amount"), the settings forms' path keys. A list whose length changed, or a
  // value that is an object on one side only (an optional part set or cleared), is one path for the whole of it.
  function changedPaths(before, after, prefix = "") {
    if (sameValue(before, after)) return [];
    const isObject = (value) => value != null && typeof value === "object";
    if (!isObject(before) || !isObject(after) || Array.isArray(before) !== Array.isArray(after)
      || (Array.isArray(after) && after.length !== before.length)) return prefix ? [prefix] : [];
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.flatMap((key) => changedPaths(before[key], after[key], prefix ? prefix + "." + key : key));
  }

  // The app's Compare merge undo: entries oldest first, at most `limit`. Push returns a new stack.
  function mergeUndoPush(stack, entry, limit) {
    return stack.concat([entry]).slice(-limit);
  }

  // Take the latest merge off the stack: the entry and the shorter stack, or null when there is nothing to undo.
  function mergeUndoPop(stack) {
    if (!stack.length) return null;
    return { entry: stack[stack.length - 1], stack: stack.slice(0, -1) };
  }

  // The strategy search's progress line (as wmti.dashboard.optimizing.progressText): the step, the settings
  // tried, the runs and, once a run has been timed, the seconds left (`optimizeSecondsLeft`).
  function optimizeStepText(detail) {
    if (!detail) return "Starting the search";
    const head = detail.phase === "recheck" ? "Re-checking the best settings on fresh draws"
      : detail.step ? "Step " + detail.step + " of " + detail.steps + ": " + detail.label : detail.label;
    const left = optimizeSecondsLeft(detail);
    return head + ". " + detail.tried + " settings tried, " + detail.runs + " runs"
      + (left == null ? "" : "; about " + Math.round(left) + " s left") + ".";
  }

  // The search's seconds left (as wmti.dashboard.optimizing.secondsLeft): the time per run measured so far times the
  // runs the remaining steps are expected to take (`expected`), the search's part held under the time cap while it
  // searches; null before the first run.
  function optimizeSecondsLeft(detail) {
    if (!detail || !detail.runs) return null;
    const perRun = detail.elapsed / detail.runs;
    let left = perRun * Math.max(0, detail.expected - detail.runs);
    if (detail.timeCap != null && detail.phase === "search") {
      left = Math.min(left, Math.max(0, detail.timeCap - detail.elapsed) + perRun * detail.expectedRecheck);
    }
    return isFinite(left) ? left : null;
  }

  // What `count` picked states add to a search (as wmti.dashboard.optimizing.statesEstimateText): the most runs and,
  // with the seconds per run measured on this device (null until known), their time, said as "up to 672 more runs, up
  // to 2 minutes more (estimate)". `effort` is an `optimizeInfo` effort.
  function optimizeStatesEstimate(effort, count, secondsPerRun) {
    const runs = effort.stateCosts.runs * count;
    let text = "up to " + runs.toLocaleString("en-US") + " more runs";
    if (secondsPerRun != null) {
      const seconds = runs * secondsPerRun;
      text += ", up to " + (seconds < 90 ? roundHalfEven(seconds) + " s" : roundHalfEven(seconds / 60) + " minutes")
        + " more (estimate)";
    }
    return text;
  }

  // Round as Python's round does: a half goes to the even neighbour (2.5 to 2, 3.5 to 4).
  function roundHalfEven(value) {
    const floor = Math.floor(value);
    if (value - floor !== 0.5) return Math.round(value);
    return floor % 2 === 0 ? floor : floor + 1;
  }

  // The key an interrupted strategy search is kept under: an FNV-1a hash (8 hex digits) of the inputs text, the
  // options text, the seed and the build id, so a reload offers to resume it only for the same settings on the same
  // build (an app update starts afresh).
  function optimizeCheckpointKey(inputsText, optionsText, seed, buildId) {
    const text = JSON.stringify([inputsText, optionsText, seed, buildId]);
    let hash = 0x811c9dc5;
    for (let position = 0; position < text.length; position += 1) {
      hash ^= text.charCodeAt(position);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  // ---- The user documentation (menu, Documentation; the "See this state's rules" links) ----
  // The address of one docs page from the build's docs location (window.WMTI_BUILD.docs): a folder ending in "/" gets
  // the page appended ("./docs/" + "law/nj.html"); any other address (the docs artifact) is the docs home for every
  // page, since its pages cannot be linked one by one. A blank location gives "".
  function docsLink(base, page) {
    const text = String(base == null ? "" : base);
    if (!text.endsWith("/")) return text;
    return text + String(page == null ? "" : page).replace(/^\/+/, "");
  }

  // The words of the link under a state select: "See this state's rules" where the docs location is a folder (a
  // state's own page can be linked), else "Open the documentation" (the docs artifact opens at its home).
  function stateRulesText(base) {
    return String(base == null ? "" : base).endsWith("/") ? "See this state's rules" : "Open the documentation";
  }

  // ---- The wide layout's divider between Inputs and Outputs (app.js wireSplit) ----
  // A split is Inputs' share of the room the two columns have between them: 0 shows only Outputs, 1 only Inputs, 0.5
  // halves it. Every open column keeps at least `minimum` px; a room too narrow for two of them halves it.

  // The share for an Inputs column dragged to `width` px: a side dragged under half the minimum closes (snaps shut),
  // else each side keeps the minimum.
  function splitShare(width, room, minimum) {
    if (!(room > 0)) return 0.5;
    if (width < minimum / 2) return 0;
    if (room - width < minimum / 2) return 1;
    return splitFit(width / room, room, minimum);
  }

  // The share drawn for a kept `share` in the room there is now: 0 and 1 stay shut, any other is held to the minimums.
  function splitFit(share, room, minimum) {
    if (share <= 0 || share >= 1) return share <= 0 ? 0 : 1;
    if (!(room > 0) || room < 2 * minimum) return 0.5;
    return Math.min(Math.max(share, minimum / room), 1 - minimum / room);
  }

  // The share after an arrow key (`direction` -1 toward Outputs only, 1 toward Inputs only) moves it by `step` of the
  // room: arrows never shut a side (Home and End do); from a shut side the first press opens it at the minimum.
  function splitStep(share, direction, room, minimum, step) {
    if (share <= 0 && direction < 0) return 0;
    if (share >= 1 && direction > 0) return 1;
    if (!(room > 0) || room < 2 * minimum) return 0.5;
    const low = minimum / room;
    if (share <= 0) return low;
    if (share >= 1) return 1 - low;
    return Math.min(Math.max(share + direction * step, low), 1 - low);
  }

  // A kept split read back from storage text: a number from 0 to 1, else the equal split.
  function splitRead(text) {
    const share = text == null || text === "" ? NaN : Number(text);
    return isFinite(share) && share >= 0 && share <= 1 ? share : 0.5;
  }

  // The divider's spoken value: which columns show and, when both, each one's percent.
  function splitText(share) {
    if (share <= 0) return "Only Outputs";
    if (share >= 1) return "Only Inputs";
    const inputs = Math.round(share * 100);
    return "Inputs " + inputs + "%, Outputs " + (100 - inputs) + "%";
  }

  // ---- The effort and style picker's energy bar (s420) ----
  // The level (0 = the lowest) a drag released at `fraction` of the bar's height (0 bottom, 1 top) chooses: the one
  // whose equal share of the bar holds it, so a third each for `count` 3. Out-of-range fractions clamp.
  function pickerLevelAt(fraction, count) {
    if (!(count > 0)) return 0;
    const level = Math.floor((isFinite(fraction) ? fraction : 0) * count);
    return Math.min(count - 1, Math.max(0, level));
  }

  // The level after `key` on the bar at level `index` of `count`: Arrow Up or Right one up, Arrow Down or Left one
  // down, Home the lowest, End the highest, never past either end; null for any other key.
  function pickerKeyLevel(index, key, count) {
    const top = Math.max(0, count - 1);
    if (key === "ArrowUp" || key === "ArrowRight") return Math.min(top, index + 1);
    if (key === "ArrowDown" || key === "ArrowLeft") return Math.max(0, index - 1);
    if (key === "Home") return 0;
    if (key === "End") return top;
    return null;
  }

  // ---- Accountant extras: the run diff and the source notes switch ----
  // How the shown Monte Carlo compares with the other kept one (cache entries {key, scenario, seq, value}, key the
  // JSON text of [inputs, runs, seed]): null when either is missing, a key does not parse, or the two belong to other
  // scenarios (a missing scenario counts as other). `direction` is "earlier" when the kept run started before the
  // shown one, else "later" (Undo shows the older cached result).
  function runChangePlan(shown, kept) {
    if (!shown || !kept || !shown.scenario || !kept.scenario || shown.scenario !== kept.scenario) return null;
    let current;
    let previous;
    try {
      current = JSON.parse(shown.key);
      previous = JSON.parse(kept.key);
    } catch (error) {
      return null;
    }
    if (!Array.isArray(current) || !Array.isArray(previous) || current.length < 3 || previous.length < 3) return null;
    const currentInputsText = JSON.stringify(current[0]);
    const previousInputsText = JSON.stringify(previous[0]);
    const dollarsOf = (entry) => (entry.value ? entry.value.dollars : undefined);
    return { previousInputsText, currentInputsText, direction: Number(kept.seq) < Number(shown.seq) ? "earlier" : "later",
      sameInputs: previousInputsText === currentInputsText, seedChanged: previous[2] !== current[2],
      runsChanged: previous[1] !== current[1], dollarsChanged: dollarsOf(kept) !== dollarsOf(shown) };
  }

  // The headline movement from `previousHeadlines` to `currentHeadlines`, matched by label (a label missing on either
  // side, or without a number, is skipped): {label, unit, before, after, change}; `change` is the signed amount, or
  // percentage points for a percent, and null below half a dollar or 0.05 points.
  function runChangeRows(previousHeadlines, currentHeadlines) {
    const before = new Map((Array.isArray(previousHeadlines) ? previousHeadlines : []).filter((item) => item)
      .map((item) => [item.label, item]));
    const rows = [];
    for (const item of Array.isArray(currentHeadlines) ? currentHeadlines : []) {
      const old = item && before.get(item.label);
      if (!old || typeof item.value !== "number" || typeof old.value !== "number") continue;
      const percentUnit = item.unit === "percent";
      const change = percentUnit ? (item.value - old.value) * 100 : item.value - old.value;
      rows.push({ label: item.label, unit: item.unit, before: old.value, after: item.value,
        change: Math.abs(change) < (percentUnit ? 0.05 : 0.5) ? null : change });
    }
    return rows;
  }

  // compareDifferences items as one line each, "Section › label: before → after", at most `max` (8 by default);
  // `more` counts the rest. The detail rows (`lines`) are left out.
  function differenceLines(differences, max = 8) {
    const items = Array.isArray(differences) ? differences.filter((item) => item) : [];
    const text = (value) => (value == null || value === "" ? "none" : String(value));
    const lines = items.slice(0, max).map((item) => (item.section ? item.section + " › " : "") + item.label + ": "
      + text(item.a) + " → " + text(item.b));
    return { lines, more: Math.max(0, items.length - max) };
  }

  // Whether the source notes and estimates show: on unless the stored text is "off".
  function extrasOn(stored) {
    return stored !== "off";
  }

  const api = { escapeText, compactMoney, fullMoney, tickMoney, percent, formatValue, groupDigits,
    checkScenarioName, scenarioFileProblem, getPath, setPath, sheetFields, hiddenReason, sheetLabel, sheetSwitches, clearedOnChange, kindReturnsFilled, kindOwnerFilled, returnsSummary, expenseAgesText, expenseAgeKnobs, expenseAgeStored, rothAgeKnobs, expenseActiveAt, expenseSummary, expenseTotals, carSummary, homeSummary, spanText, hasCarLoan, carEstimatedValue, carValueToday, sheetGroup, sheetPrompt, carPaidBy, carPayMethodOf, carReplacementMethodOf, carReplaceRulesOf, sheetDefault, sheetResetTarget, sheetBlank, panelResetTarget, fieldDefault, atFieldDefault, showsDefault, unfilledSuggestion, panelDefault, isPanelSource, choiceLabel, filterChoices, comboOptions, comboMove, comboPick, sheetSources, yearOfAge, ageOfYear, timelineBars, primaryPeriod, periodsOverlap, choosePrimary, rentPeriod, primaryClashText, ensureOnePrimary, normalPair, tabRoute, inputsChip, heirShareTotal, heirDefaults, scaleHeirShares, addHeir, childHeirEdited, syncChildHeirs, missingChildHeirs, addChildHeirs, meanInflation, dollarsNote, beneficiaryPayoutText,
    normalCurvePoints, itemMatches, filteredPositions, filterStartValues, moveSelected, deleteSelected, moveItem, panelField, sameValue, syncResetFlags,
    resetGroup, matchPercent, matchTermsFromPercent, walkRead, walkNumber, walkBoundsError, walkHint, walkIndex, walkLabel, walkStatus, WALK_TAGS, WALK_ACTION_LABELS, WALK_COUNT_LISTS,
    walkProgress, walkTrail, walkDirection, walkClean, answerText, carTotalsOf, exampleLeftoverList, legalBlocks, termsAccepted, migrateLegacyStorage, updateCheckText,
    storagePrefix, channelCachePrefixes, copyStableStorage, isBetaChannel,
    blankInputs, needsSetup, otherScenarioNames, benefitAccounts, freeName, numberedName, importedName,
    splitExperience, joinExperience, defaultExperience, storedExperience, carriedExperience, experienceDiffers, experienceChoice, experienceWords,
    effortRank, tierShown, overrideRank, detailShown, optionShown, detailHidden, paneDetailOverrides, surfaceOverrides,
    surfacePath, walkIndexedPath, overrideList, defaultedInputCount, firstUnlocked, yearsToAge100, planYears, undoRecord, undoStep, mergeUndoPush, mergeUndoPop,
    changedPaths, optimizeStepText, optimizeSecondsLeft, optimizeStatesEstimate, optimizeCheckpointKey, hasSocialSecurity, defaultSpendingStartAge, spendingStartAge, spendingFactor, spendingChangeActive, spendingChangeRows, spendingChangePreview,
    docsLink, stateRulesText, splitShare, splitFit, splitStep, splitRead, splitText,
    pickerLevelAt, pickerKeyLevel, coachDismissKey, coachDismissed, coachGapsShown, coachSweepKey, riskPresetOf, coachChangeText,
    runChangePlan, runChangeRows, differenceLines, extrasOn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WmtiShared = api;
})(typeof self !== "undefined" ? self : this);

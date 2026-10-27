// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// The final report (PDF): buildReport turns the current scenario's results (and any saved scenarios run beside it)
// into plain report data, and drawReport draws that data with a jsPDF document. The body holds the headline figures,
// four key results, the insights (warnings and opportunities, insights.js) and the charts, each with a one-line caption and a short summary built by rules from the run's
// data; the addendum holds every table at the full page width, in small type with the header row repeated on each
// page, grouped under section headings and subheadings, each table under its title and a one or two sentence brief.
// The settings tables leave out the fields the app hides. buildReport and the helpers run in Node for the tests;
// drawReport needs only the jsPDF object it is given, and the page rasterizes the charts (standaloneSvg) before
// calling it.
(function (root) {
  "use strict";

  const shared = typeof module !== "undefined" && module.exports ? require("./shared.js") : root.WmtiShared;
  const insightRules = typeof module !== "undefined" && module.exports ? require("./insights.js") : root.WmtiInsights;
  const { fullMoney, percent, formatValue, getPath, hiddenReason, unfilledSuggestion, dollarsNote } = shared;

  const MAX_SAVED = 4;  // saved scenarios the report can compare with the current settings
  // The body's charts, in order, by the Monte Carlo result's chart ids; one-line captions.
  const PLOTS = [
    { id: "bands", caption: "Median run (line) and 10th to 90th percentile (shaded) of the total balance; the dot past "
      + "the last year is what beneficiaries keep (median)." },
    { id: "histogram", caption: "How the runs' final values spread; the extreme runs are left out." },
    { id: "balances", caption: "Each account's balance by year; middle half average of the runs." },
    { id: "cashFlow", caption: "Cash in above zero, cash out below; middle half average of the runs." },
    { id: "taxes", caption: "Taxes by kind and year; middle half average of the runs. Hatched: sales tax, already in "
      + "expenses, shown for records." },
    { id: "expenses", caption: "Spending by category and year; middle half average of the runs." },
  ];
  const COMPARE_CAPTION = "Median (line) and 10th to 90th percentile (shaded) per configuration; same runs and seed.";
  // The app's own wording (the Setup notice): estimates for education, not advice.
  const NOTICE = "Estimates for education only; not financial, tax or legal advice.";
  const AFTER_TAX_LABEL = "What beneficiaries keep";  // wmti.dashboard.web.AFTER_TAX_LABEL
  // The light scheme's chart tokens (the plain :root block of styles.css) and its series palette, slots 0 to 9.
  const LIGHT = { line: "#D6E2E4", muted: "#4F6772", surface: "#ffffff", ink: "#0B3A4F", ink2: "#2E5566" };
  const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948", "#8c5a2e",
    "#0b8f9c"];
  const IMAGE_SIZE = { width: 640, height: 240 };  // the viewBox a chart is drawn on for the report
  const TURN_FIELDS = 9;  // a short list whose items fill more fields than this is drawn turned (a row per field)
  const TURN_ITEMS = 4;  // a list of at most this many items is short
  // The fields the app hides beyond the settings schema's rules, by input type: [fields, test of the object] (app.js:
  // the I'm retired switch, the earnings history mode and the Social Security basis).
  const APP_HIDDEN = {
    Person: [[["salary", "salaryEndAge"], (person) => Boolean(person.retired)],
      [["lastSalary", "lastSalaryYear", "salaryOverrides"], (person) => person.earningsHistoryMode !== "lastSalary"],
      [["salaryHistory"], (person) => person.earningsHistoryMode === "lastSalary"],
      [["socialSecurityByAge"], (person) => person.socialSecurityBasis === "earnings"]],
  };
  // List item fields the app's sheet leaves to another page; the report still lists them with the item.
  const SHOWN_ELSEWHERE = { Account: ["deposit", "surplusShare"],
    ExpenseItem: ["child", "education", "dependentCare", "retirementChange"] };
  // An item switch whose balance is 0 owes nothing, so its figures are not needed: switch -> balance field, by type.
  const ZERO_BALANCE_SWITCHES = { Car: { hasLoan: "loanBalance" }, Home: { hasMortgage: "mortgageBalance" } };
  // Titles of the input lists; any other list is titled from its key.
  const LIST_TITLES = { expenses: "Expenses", accounts: "Accounts and balances", loans: "Loans and mortgages",
    homes: "Homes", cars: "Cars", children: "Children and education", rents: "Rents", visits: "Healthcare visits",
    premiums: "Health premiums", salaryHistory: "Salary history", retirementSpending: "Retirement spending" };
  // The yearly table's column groups, first match wins; the rest go under Other.
  // Each group: [title, column pattern, the first sentence of its addendum brief].
  const YEARLY_GROUPS = [
    ["Income sources", /^(Paycheck|Interest|Social Security$|Asset Sale|Employer Match|Home Sale|Gross Income|Net Earnings)/,
      "Money coming in each year by source: pay, interest, Social Security, employer match and sales."],
    ["Taxes, deductions and withholding", /(Tax|Federal|State|MAGI|AGI|Deduction|Itemized|Dependents|HSA|FSA|Property|Medicare|Capital Gains|^Medical$|^Taxable)/,
      "Each year's taxes by kind and the income and deduction figures they are worked out from."],
    ["Deposits and withdrawals", /(Deposit|Withdraw|QCD|Conversion|Investment Gains|Shortfall)/,
      "Money put into and taken out of the accounts each year, with Roth conversions, investment gains and any "
      + "spending left unpaid."],
    ["Loans, homes and cars", /(Loan|Home Value|Car Value)/,
      "What is still owed on loans and what homes and cars are worth at each year."],
    ["Expenses", /(Bills|Spending|College|Healthcare|Supplement|Premium|IRMAA|Car |Charitable|Asset Purchases|Selling Costs|Tagged)/,
      "Spending each year by kind: bills, healthcare and premiums, college, cars, gifts and purchases."],
    ["Other", /./, "The other yearly figures, such as the inflation rate used each year."],
  ];
  // The first sentence of the brief over each "Settings: <group>" table, by the group's settings key ("" for the
  // single settings at the top level); a group not listed gets a general sentence.
  const GROUP_BRIEFS = {
    "": "Settings that apply to the whole plan, such as the years planned, filing status, home state and withdrawal "
      + "order.",
    you: "Your own settings: age, pay and raises, Social Security and employer match.",
    partner: "Your partner's settings: age, pay and raises, Social Security and employer match.",
    inflation: "The range the runs draw each year's inflation rate from: the lowest, most likely and highest rate.",
    randomMajorExpense: "The range the runs draw an unplanned large expense from: the lowest, most likely and highest "
      + "amount.",
    contributions: "How new savings are deposited: whether deposits are on, the share that goes to Traditional "
      + "accounts and the Roth deposit.",
    healthcare: "How healthcare costs are worked out: from doctor visits, or as one flat amount a year.",
    visits: "The doctor visits, their cost and the health plan's cost sharing, used when healthcare costs come from "
      + "visits.",
    premiums: "Health plan and Medicare premiums, and the age Medicare starts.",
    supplement: "The Medicare supplement plan: whether it is on, its monthly cost and its cost sharing.",
    strategies: "Tax strategies and end-of-plan settings: Roth conversions, backdoor Roth, gifts to charity from an "
      + "IRA, the tax rate on what is left, and relocation.",
    home: "The home's monthly utility bills.",
    hsa: "The health savings account: whether it is on, how deposits are sized, the starting balance and returns.",
    dependentCareFsa: "The dependent care flexible spending account: whether it is on and its yearly cap.",
    retirementSpending: "How spending changes once you retire, and the age the change starts.",
  };
  // Group titles that read better than the key spelled out.
  const GROUP_TITLES = { hsa: "Health savings account (HSA)", dependentCareFsa: "Dependent care FSA" };
  // The brief over each list table, by the list's key; a list not listed gets a general sentence.
  const LIST_BRIEFS = {
    expenses: "Each planned expense with its amount, category and years; suggested rows not filled in are left out.",
    accounts: "Each account with its kind, owner, starting balance and expected return.",
    loans: "Each loan and mortgage with its balance, rate and payment.",
    homes: "Each home with its value, costs, mortgage and any purchase or sale.",
    cars: "Each car with its price, running costs, loan and when it is bought or sold.",
    children: "Each child with the ages and costs used for childcare and college.",
    rents: "Each rent with its amount and the years it is paid.",
    visits: "The doctor visits a year used to work out healthcare costs.",
    salaryHistory: "Past pay by year, used to estimate Social Security from earnings.",
    socialSecurityByAge: "The yearly Social Security benefit by the age it is claimed, as entered.",
    salaryOverrides: "Pay set by hand for given years, in place of the raise rules.",
    heirs: "Who inherits what is left at the end of the plan: each one's share, other income and filing status, and "
      + "how the payout is taken.",
  };
  // Yearly table columns shown for records only, with the heading that says so: already counted elsewhere.
  const RECORDS_HEADINGS = { "Sales Tax (records)": "Sales tax (already in expenses, shown for records)" };
  const PLAIN_COLUMN = /^(Age|Your age|Year|Divisor|Dependents|Deduction type|Percentile)/;

  // ---- report data ----

  // The saved scenarios the report compares: distinct names in the order picked, at most `limit`.
  function capSelection(names, limit = MAX_SAVED) {
    return [...new Set((names || []).filter((name) => typeof name === "string" && name))].slice(0, limit);
  }

  function isoDate(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  // "<scenario>-report-<date>.pdf", the scenario name kept to letters, digits, dot, dash and underscore.
  function reportFilename(name, date) {
    const safe = String(name || "scenario").trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "scenario";
    return safe + "-report-" + isoDate(date) + ".pdf";
  }

  function householdLine(inputs) {
    const you = inputs && inputs.you;
    const partner = inputs && inputs.partner;
    const parts = [];
    if (you && Number.isFinite(you.currentAge)) {
      parts.push("You " + you.currentAge + (partner && Number.isFinite(partner.currentAge) ? ", partner "
        + partner.currentAge : ""));
    }
    const years = inputs ? shared.planYears(inputs) : null;  // a blank one: the years until you are 100
    if (Number.isFinite(years)) {
      parts.push(years + " years planned" + (you && Number.isFinite(you.currentAge) ? " (to your age "
        + (you.currentAge + years - 1) + ")" : ""));
    }
    return parts.join(" · ");
  }

  const headlineOf = (headlines, test) => (headlines || []).find((item) => test(item.label)) || null;

  // The four headline figures: median final worth and after tax (Monte Carlo), average net withdrawal (or earnings)
  // and average annual expense (the single run); a figure the results do not carry is left out.
  function headlineFigures(monteCarlo, single) {
    const mcLines = monteCarlo ? monteCarlo.headlines : [];
    const singleLines = single ? single.headlines : [];
    const picks = [
      [headlineOf(mcLines, (label) => label === "Median final worth"), "Median final worth"],
      [headlineOf(mcLines, (label) => label === AFTER_TAX_LABEL), AFTER_TAX_LABEL],
      [headlineOf(singleLines, (label) => /^Avg net (withdrawal|earnings)/.test(label)), null],
      [headlineOf(singleLines, (label) => label === "Avg annual expense"), "Avg annual expense"],
    ];
    return picks.filter(([item]) => item).map(([item, label]) => ({ label: label || item.label,
      value: fullMoney(item.value) }));
  }

  function percentileValue(monteCarlo, rank) {
    const row = ((monteCarlo && monteCarlo.percentiles && monteCarlo.percentiles.data) || []).find((item) => item[0] === rank);
    return row ? row[1] : null;
  }

  function successShare(monteCarlo) {
    const out = headlineOf(monteCarlo && monteCarlo.headlines, (label) => label === "Chance of running out");
    return out ? 1 - out.value : null;
  }

  function afterTaxValue(monteCarlo) {
    const item = headlineOf(monteCarlo && monteCarlo.headlines, (label) => label === AFTER_TAX_LABEL);
    return item ? item.value : null;
  }

  // Four key results lines: chance of success, median, 10th and 90th percentile final worth.
  function keyResults(monteCarlo) {
    return [
      "Chance of success (money lasts): " + percent(successShare(monteCarlo), 0),
      "Median final worth: " + fullMoney(percentileValue(monteCarlo, 50)),
      "10th percentile final worth: " + fullMoney(percentileValue(monteCarlo, 10)),
      "90th percentile final worth: " + fullMoney(percentileValue(monteCarlo, 90)),
    ];
  }

  // One compareBands spec from each configuration's balance bands ({name, result}), on a shared age axis.
  function compareSpec(configs) {
    const bandsOf = (config) => config.result.charts.find((spec) => spec.id === "bands");
    const ages = [...new Set(configs.flatMap((config) => bandsOf(config).x.values))].sort((left, right) => left - right);
    const series = configs.map((config, slot) => {
      const bands = bandsOf(config);
      const line = bands.series[0];
      const byAge = (values) => {
        const map = new Map(bands.x.values.map((age, position) => [age, values[position]]));
        return ages.map((age) => (map.has(age) ? map.get(age) : null));
      };
      return { name: config.name, slot, color: PALETTE[slot % PALETTE.length], mark: "line", low: byAge(line.low),
        values: byAge(line.values), high: byAge(line.high), afterTax: afterTaxValue(config.result) };
    });
    const first = bandsOf(configs[0]);
    // The calendar year of each age is the first configuration's (the year you are that age in it), as Compare does.
    const born = first.x.years && first.x.ages ? first.x.years[0] - first.x.ages[0] : null;
    const x = born == null ? { label: "Your age", values: ages }
      : { label: "Your age (year)", values: ages, ages, years: ages.map((age) => age + born) };
    const lead = born == null ? ["Your age"] : ["Your age", "Year"];
    return { id: "reportCompare", type: "compareBands", title: "Total balance by age", x,
      y: { label: "Total balance", unit: "money" }, percentiles: first.percentiles, series, dollars: first.dollars,
      table: { columns: lead.concat(series.map((item) => item.name + " median")),
        rows: ages.map((age, position) => (born == null ? [age] : [age, age + born])
          .concat(series.map((item) => item.values[position]))) } };
  }

  function comparisonTable(configs) {
    return { title: "Configurations compared", columns: ["Configuration", "Median final worth", AFTER_TAX_LABEL,
      "Chance of success", "10th percentile", "90th percentile"], numeric: [false, true, true, true, true, true],
    rows: configs.map((config) => [config.name, fullMoney(percentileValue(config.result, 50)),
      fullMoney(afterTaxValue(config.result)), percent(successShare(config.result), 0),
      fullMoney(percentileValue(config.result, 10)), fullMoney(percentileValue(config.result, 90))]) };
  }

  // The settings that differ between the current settings and each saved scenario compared, from Compare's own
  // differences (`compareDifferences` of the current settings against each; `a` is the current settings' text, `b` the
  // scenario's). `configs` is the report's list, the current settings first; a saved one carries `differences` (or
  // `differencesError`). One table per settings panel, in the panels' order: a row per setting that differs in any of
  // them, a column per configuration with its value (the current settings' value where one does not differ).
  function differenceTables(configs) {
    const saved = configs.slice(1).filter((config) => Array.isArray(config.differences));
    const union = [];  // [{id, section, label, current}], each config's order kept: a new one goes after its predecessor
    for (const config of saved) {
      let after = -1;
      for (const difference of config.differences) {
        let at = union.findIndex((item) => item.id === difference.id);
        if (at < 0) {
          at = after + 1;
          union.splice(at, 0, { id: difference.id, section: difference.section, label: difference.label,
            current: difference.a });
        }
        after = at;
      }
    }
    const sections = new Map();
    for (const item of union) {
      if (!sections.has(item.section)) sections.set(item.section, []);
      sections.get(item.section).push(item);
    }
    const columns = ["Setting"].concat(configs[0].name, saved.map((config) => config.name));
    return [...sections].map(([section, items]) => ({ title: "Settings that differ: " + section, columns,
      rows: items.map((item) => [item.label, item.current].concat(saved.map((config) => {
        const found = config.differences.find((difference) => difference.id === item.id);
        return found ? found.b : item.current;
      }))),
      brief: "The settings under " + section + " that are not the same in every configuration, with each one's "
        + "value; a configuration that matches the current settings shows the same value." }));
  }

  // One sentence per saved scenario under the comparison chart: how many settings it changes from the current ones.
  function differenceLines(configs) {
    return configs.slice(1).filter((config) => config.differences || config.differencesError).map((config) => {
      if (!Array.isArray(config.differences)) {
        return config.name + ": its settings that differ could not be listed (" + (config.differencesError
          || "no answer") + ").";
      }
      const count = config.differences.length;
      if (!count) return config.name + " has the same settings as the current ones.";
      const sections = [...new Set(config.differences.map((difference) => difference.section))];
      return config.name + " differs in " + count + " setting" + (count === 1 ? "" : "s") + " (" + sections.join(", ")
        + "); see Settings that differ in the addendum.";
    });
  }

  function humanize(key) {
    const text = String(key).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_.]+/g, " ").toLowerCase().trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  const RATE_KEY = /(rate|share|return|stddev|chance|raise|mean|mode|minimum|maximum|factor|coinsurance)/i;

  // A setting's value as short text: rates and shares as percents, numbers grouped, objects as "key value; ...".
  function inputText(key, value) {
    if (value == null) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") {
      if (RATE_KEY.test(key) && Math.abs(value) <= 1.5 && !Number.isInteger(value)) return percent(value, 2);
      return formatValue(value);
    }
    if (Array.isArray(value)) return value.map((item) => inputText(key, item)).join(", ");
    if (typeof value === "object") {
      return Object.entries(value).map(([inner, item]) => humanize(inner) + " " + inputText(inner, item)).join("; ");
    }
    return String(value);
  }

  const isRecordList = (value) => Array.isArray(value) && value.length > 0
    && value.every((item) => item && typeof item === "object" && !Array.isArray(item));

  // The type a field of an input type holds (an object's or a list item's), from the settings schema, or null.
  function fieldType(schema, typeName, name) {
    const field = ((schema && schema.types && schema.types[typeName]) || []).find((item) => item.name === name);
    return field && field.type ? field.type : null;
  }

  // The paths the settings panels hide now, as the app draws them: a field whose panel condition is not met, and the
  // fields of a titled section (or sub-section) other than its switch while the switch is off. Returns a test of a
  // path (a hidden path hides everything under it).
  function panelHidden(inputs, schema) {
    const hidden = [];
    const keep = new Set();
    for (const panel of (schema && schema.panels) || []) {
      for (const [name, condition] of Object.entries(panel.conditions || {})) {
        const value = getPath(inputs, condition.path);
        const met = condition.notEmpty ? Array.isArray(value) && value.length > 0 : value === condition.equals;
        if (!met) hidden.push(name);
      }
      const sections = (panel.sections || []).flatMap((section) => [section].concat(section.subsections || []));
      for (const section of sections) {
        if (!section.switch || getPath(inputs, section.switch)) continue;
        keep.add(section.switch);
        hidden.push(...section.fields.filter((name) => name !== section.switch));
      }
    }
    const holdsSwitch = (path) => [...keep].some((name) => name === path || name.startsWith(path + "."));
    return (path) => !holdsSwitch(path) && hidden.some((name) => path === name || path.startsWith(name + "."));
  }

  // Whether the app hides an object's field now: an object's `enabled` switch that is off hides its other fields, and
  // `APP_HIDDEN` names the app's own rules by type.
  function objectFieldHidden(typeName, name, value) {
    if (value.enabled === false && name !== "enabled") return true;
    return (APP_HIDDEN[typeName] || []).some(([names, test]) => names.includes(name) && test(value));
  }

  // Whether the app hides a list item's field now (`rules` is appInfo().sheetRules; without it nothing is hidden): the
  // sheet's rules (shared.hiddenReason: the figures behind a switch that is off, those a switch that is on replaces, a
  // car's pay figures), the purchase and sale switches of the timeline acting the same way, and a loan or mortgage
  // switch whose balance is 0 for an item owned today. Fields the sheet leaves to another page stay listed.
  function itemFieldHidden(typeName, name, item, rules) {
    if (!rules || !typeName) return false;
    if ((SHOWN_ELSEWHERE[typeName] || []).includes(name)) return false;
    const switches = (rules.itemSwitches || {})[typeName] || {};
    for (const [toggle, balance] of Object.entries(ZERO_BALANCE_SWITCHES[typeName] || {})) {
      if ((name === toggle || (switches[toggle] || []).includes(name)) && !item.buysLater && item[toggle]
        && !(Number(item[balance]) > 0)) return true;
    }
    return Boolean(hiddenReason(typeName, name, item, { ...rules, timelineManaged: {} }));
  }

  // The inputs as addendum tables: one "Settings: <group>" table (setting, value) per group of single settings, and one
  // table per list of items (expenses, accounts, loans and so on), each with its `brief` (GROUP_BRIEFS, LIST_BRIEFS)
  // and the list tables marked `list: true`; a list with no items gives no table, and the
  // suggested expense rows not filled in yet (`unfilledSuggestion`) are left out of the expenses. With the
  // settings `schema` and the sheet `rules`, a field the app hides now (a car's loan figures without a loan, the
  // commute figures with the commute off, a section whose switch is off) is left out the same way for every type.
  function inputTables(inputs, schema, rules) {
    const keyRows = [];
    const lists = [];
    const isHidden = panelHidden(inputs, schema);
    const walk = (value, group, label, key, listTitle, path, typeName) => {
      if (isHidden(path)) return;
      if (isRecordList(value)) {
        const items = path === "expenses" ? value.filter((item) => !unfilledSuggestion(item)) : value;
        if (items.length) lists.push({ ...recordTable(listTitle, items, typeName, rules, LIST_BRIEFS[key]), list: true });
        return;
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [inner, item] of Object.entries(value)) {
          if (typeName && objectFieldHidden(typeName, inner, value)) continue;
          walk(item, group, (label ? label + ": " : "") + humanize(inner), inner, (listTitle ? listTitle + ": " : "")
            + (LIST_TITLES[inner] || humanize(inner)), path + "." + inner, fieldType(schema, typeName, inner));
        }
        return;
      }
      if (value == null || (Array.isArray(value) && !value.length)) return;
      keyRows.push([group, label, inputText(key, value)]);
    };
    const groupKeys = new Map([["General", ""]]);
    const root = (schema && schema.root) || null;
    for (const [key, value] of Object.entries(inputs || {})) {
      if (key === "schemaVersion") continue;
      const title = LIST_TITLES[key] || humanize(key);
      const typeName = fieldType(schema, root, key);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const group = GROUP_TITLES[key] || humanize(key);
        groupKeys.set(group, key);
        walk(value, group, "", key, title, key, typeName);
      } else walk(value, "General", humanize(key), key, title, key, typeName);
    }
    // One table per group, in the order the groups first appear.
    const groups = new Map();
    for (const [group, label, value] of keyRows) {
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push([label, value]);
    }
    const tables = [...groups].map(([group, rows]) => {
      const lead = GROUP_BRIEFS[groupKeys.get(group)];
      return { title: "Settings: " + group, columns: ["Setting", "Value"], rows,
        brief: lead ? lead + " One row per setting, as entered in the app."
          : "The " + group.toLowerCase() + " settings, one row per setting, as entered in the app." };
    });
    const order = Object.values(LIST_TITLES);
    lists.sort((left, right) => rank(order, left.title) - rank(order, right.title));
    return tables.concat(lists);
  }

  function rank(order, title) {
    const position = order.indexOf(title);
    return position < 0 ? order.length : position;
  }

  // A list of items as a table: a column per field that any item fills and shows, the name first; a field the app
  // hides for an item (`itemFieldHidden`, by the item's `typeName`) is blank for it. A few items with many fields
  // (homes, cars) read better turned: a row per field and a column per item. The `brief` is `lead` (or a general
  // sentence) and how the table reads.
  function recordTable(title, items, typeName, rules, lead) {
    const opening = (lead || "Each item of the " + title.toLowerCase() + " list.") + " ";
    const shown = items.map((item) => Object.fromEntries(Object.entries(item)
      .filter(([key]) => !itemFieldHidden(typeName, key, item, rules))));
    const keys = [];
    for (const item of shown) for (const key of Object.keys(item)) if (!keys.includes(key)) keys.push(key);
    const filled = keys.filter((key) => shown.some((item) => item[key] != null && item[key] !== ""
      && !(Array.isArray(item[key]) && !item[key].length)));
    filled.sort((left, right) => (right === "name") - (left === "name"));
    if (filled.length > TURN_FIELDS && shown.length <= TURN_ITEMS) {
      const names = shown.map((item, position) => (item.name != null ? String(item.name) : "Item " + (position + 1)));
      return { title, brief: opening + "One column per item and one row per setting, as entered in the app.",
        columns: ["Setting"].concat(names), numeric: [false].concat(names.map(() => false)),
        rows: filled.filter((key) => key !== "name").map((key) => [humanize(key)].concat(shown.map((item) =>
          inputText(key, item[key])))) };
    }
    return { title, brief: opening + "One row per item, as entered in the app; a blank is a field the item leaves empty or the app hides.",
      columns: filled.map(humanize), numeric: filled.map((key) => shown.every((item) =>
      item[key] == null || typeof item[key] === "number")),
    rows: shown.map((item) => filled.map((key) => inputText(key, item[key]))) };
  }

  function columnText(column, value) {
    if (value == null || value === "") return "";
    if (typeof value !== "number") return String(value);
    if (PLAIN_COLUMN.test(column)) return formatValue(value);
    if (/Inflation/.test(column)) return percent(value, 2);
    return fullMoney(value);
  }

  // How a result table's money reads, by the result's `dollars` ("future" when inflation adjusted).
  const moneyNote = (dollars) => (dollars === "future" ? "amounts are inflation adjusted" : "amounts are in today's dollars");

  // A result frame ({columns, index?, data}) as a table; `indexLabel` names the index column when it has one.
  function frameTable(title, frame, indexLabel, brief) {
    const hasIndex = Array.isArray(frame.index) && indexLabel;
    const columns = (hasIndex ? [indexLabel] : []).concat(frame.columns);
    const rows = frame.data.map((row, position) => (hasIndex ? [frame.index[position]] : []).concat(row)
      .map((value, column) => columnText(columns[column], value)));
    return { title, brief, columns, rows, numeric: columns.map((name) => name !== "Deduction type" && name !== "Item") };
  }

  // The yearly table (Outputs, Summary table) split into its column groups, each led by your age, each with its
  // brief (YEARLY_GROUPS) saying how its money reads (`dollars`, the result's).
  function yearlyTables(summary, dollars) {
    const ageColumn = summary.columns.indexOf("Age (you)");
    const groups = YEARLY_GROUPS.map(([title, , lead]) => ({ title, lead, columns: [] }));
    summary.columns.forEach((name, position) => {
      if (position === ageColumn) return;
      const group = YEARLY_GROUPS.findIndex(([, pattern]) => pattern.test(name));
      groups[group].columns.push(position);
    });
    return groups.filter((group) => group.columns.length).map((group) => {
      const positions = (ageColumn >= 0 ? [ageColumn] : []).concat(group.columns);
      const names = positions.map((position) => summary.columns[position]);
      const columns = names.map((name) => RECORDS_HEADINGS[name] || name);
      return { title: "Yearly: " + group.title, brief: group.lead + " One row per year, led by your age; "
        + moneyNote(dollars) + ".", columns, numeric: columns.map((name) => name !== "Deduction type"),
        rows: summary.data.map((row) => positions.map((position) => columnText(summary.columns[position], row[position]))) };
    });
  }

  // The column blocks a table is drawn in: from each column's width measured from its text (`widths`, the row label
  // column first), as few blocks as fit `available` beside the row label column, with the columns spread so the blocks
  // are about equally wide (never a last block of a couple of leftover columns). Returns the positions of each block,
  // each led by the row label column (0); a column wider than the room left beside the label gets a block of its own.
  function fitColumns(widths, available) {
    const fill = (cap) => {
      const blocks = [];
      let block = [0];
      let used = widths[0];
      for (let position = 1; position < widths.length; position += 1) {
        if (block.length > 1 && used + widths[position] > cap) {
          blocks.push(block);
          block = [0];
          used = widths[0];
        }
        block.push(position);
        used += widths[position];
      }
      blocks.push(block);
      return blocks;
    };
    const fullest = fill(available);
    if (fullest.length === 1) return fullest;
    // The narrowest cap that still needs no more blocks than filling each one to `available` does.
    let low = widths[0];
    let high = available;
    for (let step = 0; step < 40 && high - low > 0.01; step += 1) {
      const middle = (low + high) / 2;
      if (fill(middle).length <= fullest.length) high = middle; else low = middle;
    }
    return fill(high);
  }

  // A table's column blocks (`fitColumns` positions) as tables, titled "(1 of n)" when there is more than one; only
  // the first block keeps the brief.
  function splitTable(table, blocks) {
    if (blocks.length === 1 && blocks[0].length === table.columns.length) return [table];
    const numeric = table.numeric || table.columns.map(() => false);
    return blocks.map((positions, block) => ({ title: table.title + " (" + (block + 1) + " of " + blocks.length + ")",
      brief: block === 0 ? table.brief : "",
      columns: positions.map((position) => table.columns[position]),
      numeric: positions.map((position) => numeric[position]),
      rows: table.rows.map((row) => positions.map((position) => row[position])) }));
  }

  // ---- plot summaries ----
  // Each chart gets 2 to 4 standard sentences built by rules from the run's data: events found by the thresholds
  // below, and a cause named only when the data shows it in the same year (a sale, a conversion, pay stopping).

  const JUMP_SHARE = 0.5;  // a year-over-year rise of at least half the year before is a jump...
  const JUMP_FLOOR = 5000;  // ...when it is also at least this many dollars
  const DROP_SHARE = 0.2;  // a year-over-year fall of at least a fifth of the year before is a drop...
  const DROP_FLOOR = 5000;  // ...when it is also at least this many dollars
  const EMPTY_BALANCE = 1;  // a balance or amount at or below this many dollars counts as zero
  const MIN_SENTENCES = 2;
  const MAX_SENTENCES = 4;

  const isEmpty = (value) => !(Number(value) > EMPTY_BALANCE);

  // The position of the largest year-over-year change in `direction` (1 rise, -1 fall) that passes `share` of the
  // year before and `floor` dollars, or -1. A rise from zero passes the share.
  function biggestChange(values, direction, share, floor) {
    let found = -1;
    let size = 0;
    for (let position = 1; position < values.length; position += 1) {
      const before = Number(values[position - 1]) || 0;
      const change = ((Number(values[position]) || 0) - before) * direction;
      if (change < floor || change <= size) continue;
      if (before > EMPTY_BALANCE && change / before < share) continue;
      found = position;
      size = change;
    }
    return found;
  }
  const jumpAt = (values) => biggestChange(values, 1, JUMP_SHARE, JUMP_FLOOR);
  const dropAt = (values) => biggestChange(values, -1, DROP_SHARE, DROP_FLOOR);

  // The first position where a series that held money reaches zero, or -1.
  function emptiesAt(values) {
    for (let position = 1; position < values.length; position += 1) {
      if (isEmpty(values[position]) && values.slice(0, position).some((value) => !isEmpty(value))) return position;
    }
    return -1;
  }

  // The last position a series holds money before it stays at zero to the end (pay stopping), or -1 when it never
  // stops (or never held money).
  function stopsAfter(values) {
    let last = -1;
    values.forEach((value, position) => { if (!isEmpty(value)) last = position; });
    return last >= 0 && last < values.length - 1 ? last : -1;
  }

  // The first position a series holds money when it starts at zero (Social Security starting), or -1.
  function startsAt(values) {
    if (!values.length || !isEmpty(values[0])) return -1;
    return values.findIndex((value) => !isEmpty(value));
  }

  const argMax = (values) => values.reduce((best, value, position) => (Number(value) > Number(values[best]) ? position
    : best), 0);
  // A series shown for records only (`counted: false`, the sales tax already in the expenses) is never in a total.
  const counted = (series) => series.filter((item) => item.counted !== false);
  const totals = (series) => (series.length ? series[0].values.map((unused, position) => counted(series).reduce((sum, item) =>
    sum + (Number(item.values[position]) || 0), 0)) : []);
  const seriesNamed = (spec, name) => (spec.series.find((item) => item.name === name) || { values: [] }).values;
  const largestSeries = (series) => counted(series).reduce((best, item) => {
    const sum = item.values.reduce((total, value) => total + Math.abs(Number(value) || 0), 0);
    return sum > best.sum ? { name: item.name, sum } : best;
  }, { name: null, sum: 0 }).name;

  // A column of the yearly table lined up with `ages` (your age), 0 where the table has no row; zeros when the
  // table or column is missing.
  function yearlyColumn(summary, name, ages) {
    const column = summary ? summary.columns.indexOf(name) : -1;
    const ageColumn = summary ? summary.columns.indexOf("Age (you)") : -1;
    if (column < 0 || ageColumn < 0) return ages.map(() => 0);
    const byAge = new Map(summary.data.map((row) => [row[ageColumn], Number(row[column]) || 0]));
    return ages.map((age) => (byAge.has(age) ? byAge.get(age) : 0));
  }

  // 2 to 4 sentences: the found ones first, then the fallbacks until there are two.
  function sentences(found, fallbacks) {
    const out = found.filter(Boolean).slice(0, MAX_SENTENCES);
    for (const line of fallbacks.filter(Boolean)) if (out.length < MIN_SENTENCES) out.push(line);
    return out;
  }

  // Total balance bands: the median's peak and end, when the median or the low band runs out, the spread at the end.
  function bandsSummary(spec) {
    const ages = spec.x.values;
    const series = spec.series[0];
    const [low, high] = spec.percentiles || [10, 90];
    const last = ages.length - 1;
    if (last < 0) return [];
    const peak = argMax(series.values);
    const found = [peak < last ? "The total balance peaks at age " + ages[peak] + " and ends at "
      + fullMoney(series.values[last]) + " in the median run."
      : "The total balance grows to the end of the plan, reaching " + fullMoney(series.values[last])
      + " at age " + ages[last] + " in the median run."];
    const medianOut = emptiesAt(series.values);
    const lowOut = emptiesAt(series.low || []);
    if (medianOut >= 0) found.push("In the median run the money runs out at age " + ages[medianOut] + ".");
    else if (lowOut >= 0) found.push("At the " + low + "th percentile the money runs out at age " + ages[lowOut] + ".");
    else if (series.low) found.push("Even at the " + low + "th percentile the money lasts to the end.");
    if (series.low && series.high) {
      found.push("At age " + ages[last] + " the " + low + "th to " + high + "th percentile range spans "
        + fullMoney(series.low[last]) + " to " + fullMoney(series.high[last]) + ".");
    }
    return sentences(found, []);
  }

  // Final values across the runs: the median, the 10th and 90th percentiles and the share that runs out.
  function histogramSummary(monteCarlo) {
    const median = percentileValue(monteCarlo, 50);
    const p10 = percentileValue(monteCarlo, 10);
    const p90 = percentileValue(monteCarlo, 90);
    const success = successShare(monteCarlo);
    return sentences([
      median != null ? "Half the runs end above " + fullMoney(median) + "." : null,
      p10 != null && p90 != null ? "One run in ten ends below " + fullMoney(p10) + ", and one in ten above "
        + fullMoney(p90) + "." : null,
      success != null ? (success >= 1 ? "No run runs out of money." : percent(1 - success, 0)
        + " of the runs run out of money before the plan ends.") : null,
    ], []);
  }

  // Each account's balance: the account drained first (by the withdrawal order when the data shows every account
  // before it in the order was already empty and the later ones still held money), the next drained, and the account
  // holding the most at the end.
  function balancesSummary(spec, withdrawalStrategy) {
    const ages = spec.x.values;
    const last = ages.length - 1;
    const drained = spec.series.map((item, order) => ({ name: item.name, order, at: emptiesAt(item.values) }))
      .filter((item) => item.at >= 0).sort((left, right) => left.at - right.at || left.order - right.order);
    const found = [];
    if (drained.length) {
      const first = drained[0];
      const before = spec.series.slice(0, first.order);
      const after = spec.series.slice(first.order + 1);
      const byOrder = withdrawalStrategy === "PRIORITY" && before.every((item) => isEmpty(item.values[first.at - 1]))
        && after.some((item) => !isEmpty(item.values[first.at]));
      found.push(first.name + " was drained first, at age " + ages[first.at]
        + (byOrder ? ", as the withdrawal order sets." : "."));
      if (drained[1]) found.push(drained[1].name + " is drained next, at age " + ages[drained[1].at] + ".");
    } else if (spec.series.length) {
      found.push("No account is drained in the middle half average of the runs.");
    }
    if (last >= 0 && spec.series.length) {
      const end = spec.series.reduce((best, item) => (Number(item.values[last]) > Number(best.values[last]) ? item
        : best));
      if (!isEmpty(end.values[last])) {
        found.push(end.name + " holds the most at the end, " + fullMoney(end.values[last]) + " at age " + ages[last]
          + ".");
      } else found.push("Every account is empty by age " + ages[last] + ".");
    }
    return sentences(found, []);
  }

  // Cash in and out: pay stopping, Social Security and withdrawals starting, sale proceeds and unpaid spending.
  function cashFlowSummary(spec) {
    const ages = spec.x.values;
    const paycheck = stopsAfter(seriesNamed(spec, "Paycheck"));
    const social = startsAt(seriesNamed(spec, "Social Security"));
    const withdrawals = startsAt(seriesNamed(spec, "Withdrawals"));
    const sales = seriesNamed(spec, "Sale proceeds").findIndex((value) => !isEmpty(value));
    const shortfall = seriesNamed(spec, "Shortfall (unpaid)").findIndex((value) => !isEmpty(value));
    const largest = largestSeries(spec.series.filter((item) => item.values.some((value) => Number(value) > 0)));
    return sentences([
      paycheck >= 0 ? "Pay stops after age " + ages[paycheck] + "." : null,
      social >= 0 ? "Social Security starts at age " + ages[social] + "." : null,
      withdrawals >= 0 ? "Withdrawals from the accounts begin at age " + ages[withdrawals] + "." : null,
      sales >= 0 ? "Sale proceeds first come in at age " + ages[sales] + "." : null,
      shortfall >= 0 ? "Some spending goes unpaid from age " + ages[shortfall] + "." : null,
    ], [largest ? largest + " is the largest source of cash over the plan." : null,
      "Cash in and cash out are the middle half average of the runs."]);
  }

  // What the yearly table shows beginning in the year at `position`, as a cause: a home sale's gain, a sale's
  // proceeds, Roth conversions, required minimum distributions; null when none does.
  function causeAt(summary, ages, position) {
    const column = (name) => yearlyColumn(summary, name, ages);
    const begins = (values) => !isEmpty(values[position]) && isEmpty(values[position - 1]);
    if (!isEmpty(column("Home Sale Gain")[position])) return "from the home sale's gain";
    if (begins(column("Asset Sale Proceeds"))) return "in the year of a sale";
    if (begins(column("Roth Conversion"))) return "as Roth conversions begin";
    if (begins(column("Required Withdrawal"))) return "as required minimum distributions begin";
    return null;
  }

  // Taxes: the sharpest rise (with its cause when the data shows one), the sharpest fall (after pay stops, when it
  // does), the peak year and the largest kind.
  function taxesSummary(spec, summary) {
    const ages = spec.x.values;
    const total = totals(spec.series);
    if (!total.length) return [];
    const jump = jumpAt(total);
    const drop = dropAt(total);
    const paycheck = stopsAfter(yearlyColumn(summary, "Paycheck", ages));
    const cause = jump >= 0 ? causeAt(summary, ages, jump) : null;
    const peak = argMax(total);
    const largest = largestSeries(spec.series);
    return sentences([
      jump >= 0 ? "Taxes rise sharply at age " + ages[jump] + (cause ? ", " + cause : "") + "." : null,
      drop >= 0 ? (drop === paycheck + 1 && paycheck >= 0 ? "Taxes fall at age " + ages[drop] + ", after pay stops."
        : "Taxes fall sharply at age " + ages[drop] + ".") : null,
      total[peak] > EMPTY_BALANCE ? "Taxes peak at age " + ages[peak] + " at " + fullMoney(total[peak]) + "." : null,
      largest ? largest + " is the largest tax over the plan." : null,
    ], ["Taxes stay at zero across the plan."]);
  }

  // Spending: the sharpest fall (at retirement when it comes the year after pay stops), the sharpest rise and the
  // category that led it, and the largest category.
  function expensesSummary(spec, summary) {
    const ages = spec.x.values;
    const total = totals(spec.series);
    if (!total.length) return [];
    const drop = dropAt(total);
    const jump = jumpAt(total);
    const paycheck = stopsAfter(yearlyColumn(summary, "Paycheck", ages));
    const leader = jump >= 0 ? spec.series.reduce((best, item) => {
      const rise = (Number(item.values[jump]) || 0) - (Number(item.values[jump - 1]) || 0);
      return rise > best.rise ? { name: item.name, rise } : best;
    }, { name: null, rise: 0 }).name : null;
    const largest = largestSeries(spec.series);
    return sentences([
      drop >= 0 ? (paycheck >= 0 && drop === paycheck + 1 ? "Spending drops at retirement, at age " + ages[drop]
        + ", the year after pay stops." : "Spending drops at age " + ages[drop] + ".") : null,
      jump >= 0 ? "Spending jumps at age " + ages[jump] + (leader ? ", led by " + leader : "") + "." : null,
      largest ? largest + " is the largest category over the plan." : null,
    ], ["Spending holds steady from year to year, with no sharp rise or fall."]);
  }

  // The comparison: the configuration that ends highest and lowest in the median run, and the best chance of success.
  function comparisonSummary(configs) {
    const ends = configs.map((config) => ({ name: config.name, end: percentileValue(config.result, 50),
      success: successShare(config.result) }));
    const ranked = ends.filter((item) => item.end != null).sort((left, right) => right.end - left.end);
    const safest = ends.filter((item) => item.success != null).sort((left, right) => right.success - left.success)[0];
    return sentences([
      ranked.length > 1 ? ranked[0].name + " ends highest in the median run, at " + fullMoney(ranked[0].end) + "; "
        + ranked[ranked.length - 1].name + " ends lowest, at " + fullMoney(ranked[ranked.length - 1].end) + "." : null,
      safest ? safest.name + " has the best chance of success, " + percent(safest.success, 0) + "." : null,
    ], ["All configurations use the same runs and seed."]);
  }

  // The summary sentences under one of the body's charts.
  function plotSummary(spec, monteCarlo, inputs) {
    const summary = (monteCarlo.tables || {}).summary || null;
    switch (spec.id) {
      case "bands": return bandsSummary(spec);
      case "histogram": return histogramSummary(monteCarlo);
      case "balances": return balancesSummary(spec, inputs && inputs.withdrawalStrategy);
      case "cashFlow": return cashFlowSummary(spec);
      case "taxes": return taxesSummary(spec, summary);
      case "expenses": return expensesSummary(spec, summary);
      default: return [];
    }
  }

  // The report as plain data. `data`: scenarioName, date (Date), inputs, monteCarlo (the current settings' finished
  // Monte Carlo result), single (the single run's result, or null) and configs ([{name, result}] of the saved
  // scenarios run for the report; empty for none), and optionally schema (the settings schema) and rules
  // (appInfo().sheetRules), which leave out of the settings tables the fields the app hides. The comparison is there
  // only when configs has an item. Each plot carries its `summary` sentences; `insights` holds the warnings and
  // opportunities (insights.js) drawn after the key results. The addendum is a list of sections ({heading, intro,
  // parts: [{heading (null for none), tables}], tables: every table of the parts}), empty parts and sections left
  // out; every table carries a one or two sentence `brief` of what it shows and how to read it.
  function buildReport(data) {
    const monteCarlo = data.monteCarlo;
    const plots = PLOTS.map((plot) => ({ spec: monteCarlo.charts.find((spec) => spec.id === plot.id),
      caption: plot.caption })).filter((plot) => plot.spec)
      .map((plot) => ({ ...plot, summary: plotSummary(plot.spec, monteCarlo, data.inputs) }));
    const configs = (data.configs || []).length ? [{ name: data.scenarioName + " (current)", result: monteCarlo }]
      .concat(data.configs) : [];
    const comparison = configs.length ? { spec: compareSpec(configs), caption: COMPARE_CAPTION,
      summary: comparisonSummary(configs),
      lines: configs.map((config) => config.name + ": median " + fullMoney(percentileValue(config.result, 50))
        + " · beneficiaries keep " + fullMoney(afterTaxValue(config.result)) + " · success "
        + percent(successShare(config.result), 0)), differences: differenceLines(configs) } : null;
    const differences = configs.length ? differenceTables(configs) : [];
    const tables = monteCarlo.tables || {};
    const money = moneyNote(monteCarlo.dollars);
    const dollarsLine = dollarsNote(data.inputs, monteCarlo.dollars);
    const Money = money.charAt(0).toUpperCase() + money.slice(1) + ".";
    const perYear = " One row per year, led by your age; " + money + ".";
    const settings = inputTables(data.inputs, data.schema, data.rules);
    const accounts = [];
    if (tables.accounts) {
      accounts.push(frameTable("Accounts by year", tables.accounts, null,
        "Each account's balance in each year, with the totals by kind of account." + perYear));
    }
    if (tables.rmdSchedule && tables.rmdSchedule.data && tables.rmdSchedule.data.length) {
      accounts.push(frameTable("Required minimum distributions", tables.rmdSchedule, null,
        "The least that must be taken out of Traditional accounts in each year the rule applies. " + Money));
    }
    const deductions = tables.deductions ? [frameTable("Deductions by year", tables.deductions, "Your age",
      "The deduction taken each year, standard or itemized, and its amount." + perYear)] : [];
    const taxes = tables.taxesByYear ? [frameTable("Taxes paid by year", tables.taxesByYear, "Your age",
      "The taxes charged each year by kind, the same figures as the Taxes plot; the sales tax is inside spending and "
      + "not in Total." + perYear)] : [];
    const outcomes = monteCarlo.percentiles ? [frameTable("Final worth by percentile", monteCarlo.percentiles, null,
      "What the plan ends with at each percentile of the runs: at the 10th, 9 runs in 10 end higher, and the 50th is "
      + "the median. " + Money)] : [];
    const inheritance = tables.inheritance ? [frameTable("Inheritance (median of runs)", tables.inheritance, null,
      "What is left at the end of the plan, the taxes on it and what beneficiaries keep, each row the median of the "
      + "runs. " + Money)] : [];
    const part = (heading, list) => ({ heading, tables: list.filter((table) => table.rows.length) });
    const sections = [
      { heading: "Your settings", intro: "The settings this report was run with (fields the app hides now are left "
        + "out); " + dollarsLine.charAt(0).toLowerCase() + dollarsLine.slice(1),
        parts: [part("Single settings by group", settings.filter((table) => !table.list)),
          part("Lists", settings.filter((table) => table.list))] },
      { heading: "Year by year results (middle half average of the runs)",
        intro: "Each year's figure is the average of the middle half of the runs, those between the 25th and 75th "
          + "percentile of final worth. " + Money,
        parts: [part("Cash flow by type", tables.summary ? yearlyTables(tables.summary, monteCarlo.dollars) : []),
          part("Accounts", accounts), part("Taxes", taxes), part("Deductions", deductions)] },
      { heading: "End of the plan", intro: "How the plan ends across all the runs.",
        parts: [part("Range of outcomes", outcomes), part("What beneficiaries receive", inheritance)] },
      { heading: "Comparison", intro: "The current settings beside the saved scenarios picked for this report.",
        parts: [part("Settings that differ", differences), part(differences.length ? "Results" : null,
          configs.length ? [{ ...comparisonTable(configs), brief: "Each configuration's median "
          + "final worth, what beneficiaries keep, chance of success and 10th and 90th percentile final worth. All of them use "
          + "the same runs and seed." }] : [])] },
    ].map((section) => {
      const parts = section.parts.filter((item) => item.tables.length);
      return { ...section, parts, tables: parts.flatMap((item) => item.tables) };
    }).filter((section) => section.tables.length);
    return {
      title: data.scenarioName, filename: reportFilename(data.scenarioName, data.date), date: isoDate(data.date),
      household: householdLine(data.inputs), runs: monteCarlo.runs, seed: monteCarlo.seed,
      dollars: monteCarlo.dollars === "future" ? "Inflation adjusted" : "Today's dollars", dollarsNote: dollarsLine,
      headlines: headlineFigures(monteCarlo, data.single), keyResults: keyResults(monteCarlo),
      insights: insightRules.insights(data.inputs, monteCarlo), plots, comparison, addendum: sections, notice: NOTICE,
    };
  }

  // ---- charts as images ----

  const CHART_STYLE = "svg{font-family:Helvetica,Arial,sans-serif}"
    + ".grid{stroke:" + LIGHT.line + ";stroke-width:1}.baseline{stroke:" + LIGHT.muted + ";stroke-width:1}"
    + ".tick{fill:" + LIGHT.muted + ";font-size:10.5px}.area{opacity:.88}"
    + ".seam{fill:none;stroke:" + LIGHT.surface + ";stroke-width:1.5}.band{opacity:.2}"
    + ".line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}"
    + ".dot{stroke:" + LIGHT.surface + ";stroke-width:2}.after-tax-step{stroke-width:1.5;stroke-linejoin:round}"
    + ".band-compare{opacity:.14}.whisker{fill:none;stroke-width:2;stroke-linecap:round}"
    + ".box{fill-opacity:.28;stroke-width:2}.median{stroke:" + LIGHT.ink + ";stroke-width:2.5}"
    + ".box-label{fill:" + LIGHT.ink2 + ";font-size:11px;font-weight:600}";

  // The chart markup's SVG as a standalone image: the light colors written in (series and hatch tokens to their light value,
  // the page's chart rules as an inline style), a white background, and no readout crosshair or hit area.
  function standaloneSvg(markup, size = IMAGE_SIZE) {
    const found = /<svg[\s\S]*<\/svg>/.exec(markup);
    if (!found) return null;
    const body = found[0]
      .replace(/<line class="crosshair"[^>]*><\/line>/g, "")
      .replace(/<rect class="hit"[^>]*><\/rect>/g, "")
      .replace(/var\(--[\w-]+, ([^)]+)\)/g, "$1")
      .replace(/^<svg class="chart-svg"([^>]*?) role="img" tabindex="0" aria-label="[^"]*"/, "<svg class=\"chart-svg\"$1");
    return body.replace(/^<svg /, "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + size.width + "\" height=\""
      + size.height + "\" ").replace(/^(<svg[^>]*>)/, "$1<style>" + CHART_STYLE + "</style><rect width=\"100%\" "
      + "height=\"100%\" fill=\"" + LIGHT.surface + "\"></rect>");
  }

  // The legend items of a chart spec: [{name, color, key}] with key "line", "band", "box" or "hatch" (a records series).
  function legendItems(spec) {
    if (spec.type === "bands") {
      const series = spec.series[0];
      const [low, high] = spec.percentiles || [10, 90];
      return [{ name: "Median", color: series.color, key: "line" }, { name: low + "th to " + high + "th percentile",
        color: series.color, key: "band" }].concat(series.afterTax != null ? [{ name: AFTER_TAX_LABEL + " "
        + fullMoney(series.afterTax), color: series.color, key: "box" }] : []);
    }
    if (spec.type === "histogram") return [];
    return spec.series.map((series) => ({ name: series.name, color: series.color,
      key: series.mark === "line" || spec.type === "compareBands" ? "line" : series.hatched ? "hatch" : "box" }))
      .concat(spec.afterTax != null ? [{ name: AFTER_TAX_LABEL + " " + fullMoney(spec.afterTax), color: LIGHT.ink,
        key: "box" }] : []);
  }

  // ---- drawing ----

  const PAGE = { width: 612, height: 792, margin: 40, footer: 24 };  // US Letter in points
  // Addendum table type: font size, cell padding, and the narrowest and widest a column is measured at (points).
  const TABLE_TYPE = { size: 6.5, padding: 3, narrowest: 24, widest: 150 };
  const INK = [11, 58, 79];
  const MUTED = [79, 103, 114];
  const RULE = [214, 226, 228];
  // Addendum heading type: section heading and intro, part subheading, table title (alone when it has no brief) and
  // brief; `after` is the space below, in points.
  const ADDENDUM_TYPE = { section: { size: 12, style: "bold", after: 3 },
    intro: { size: 8, style: "normal", color: MUTED, after: 8 }, part: { size: 10, style: "bold", after: 5 },
    title: { size: 8.5, style: "bold", after: 1.5 }, lone: { size: 8.5, style: "bold", after: 3 },
    brief: { size: 7.5, style: "normal", color: MUTED, after: 4 } };
  const KEEP_ROWS = 4;  // a table's title and headings stay on the page with its header row and this many rows
  const LATIN = { "→": "->", "–": "-", "—": "-", "‘": "'", "’": "'", "“": "\"", "”": "\"", "…": "...", "≥": ">=",
    "≤": "<=", "−": "-", "›": ">" };

  // Text the standard PDF fonts can show (Latin-1); a few common signs are spelled out, anything else is "?".
  function plain(text) {
    return String(text == null ? "" : text).replace(/[^\x00-\xFF]/g, (character) => LATIN[character] || "?");
  }

  function hexColor(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!match) return INK;
    const value = parseInt(match[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  // Shorten `text` with "..." until it fits `width` at the current font.
  function fitText(doc, text, width) {
    let shown = plain(text);
    if (doc.getTextWidth(shown) <= width) return shown;
    while (shown.length > 1 && doc.getTextWidth(shown + "...") > width) shown = shown.slice(0, -1);
    return shown + "...";
  }

  // Draw the report onto a fresh jsPDF document (US Letter, points). `images` maps a chart id to its PNG
  // ({dataUrl, width, height}); a chart without one is skipped. Returns {bodyPages, pages}.
  function drawReport(doc, report, images) {
    const width = PAGE.width - 2 * PAGE.margin;
    const bottom = PAGE.height - PAGE.margin - PAGE.footer;
    let y = PAGE.margin;
    const font = (size, style, color) => {
      doc.setFont("helvetica", style || "normal");
      doc.setFontSize(size);
      doc.setTextColor(...(color || INK));
    };
    const newPage = () => { doc.addPage("letter", "portrait"); y = PAGE.margin; };

    // Title block: name, date and household, the headline figures as tiles, the key results, then the insights.
    font(18, "bold");
    doc.text(fitText(doc, report.title, width), PAGE.margin, y + 16);
    y += 26;
    font(8.5, "normal", MUTED);
    doc.text(fitText(doc, [report.date, report.household, report.runs + " runs, seed " + report.seed, report.dollars]
      .filter(Boolean).join(" · "), width), PAGE.margin, y + 8);
    y += 12;
    if (report.dollarsNote) {  // what the dollars are: today's, with the average inflation taken out, or adjusted
      for (const line of doc.splitTextToSize(plain(report.dollarsNote), width)) {
        doc.text(line, PAGE.margin, y + 8);
        y += 10;
      }
    }
    y += 6;
    if (report.headlines.length) {
      const gap = 8;
      const tile = (width - gap * (report.headlines.length - 1)) / report.headlines.length;
      report.headlines.forEach((headline, position) => {
        const x = PAGE.margin + position * (tile + gap);
        doc.setFillColor(237, 244, 245);
        doc.roundedRect(x, y, tile, 40, 4, 4, "F");
        font(7, "normal", MUTED);
        doc.text(fitText(doc, headline.label, tile - 12), x + 6, y + 12);
        font(12, "bold");
        doc.text(fitText(doc, headline.value, tile - 12), x + 6, y + 30);
      });
      y += 50;
    }
    font(9, "normal");
    for (const line of report.keyResults) { doc.text(plain(line), PAGE.margin, y + 9); y += 12; }
    y += 6;
    drawInsights(report.insights);

    // The Insights section: a heading per kind that has items, each item a wrapped bullet, then the note; nothing
    // when there are no items.
    function drawInsights(found) {
      const groups = [["Warnings", (found && found.warnings) || []], ["Opportunities", (found && found.opportunities) || []]]
        .filter(([, items]) => items.length);
      if (!groups.length) return;
      if (y + 60 > bottom) newPage();
      font(13, "bold");
      doc.text("Insights", PAGE.margin, y + 12);
      y += 18;
      for (const [heading, items] of groups) {
        if (y + 30 > bottom) newPage();
        font(9.5, "bold");
        doc.text(heading, PAGE.margin, y + 9);
        y += 13;
        font(8.5, "normal");
        for (const item of items) {
          const lines = doc.splitTextToSize(plain(item.text), width - 10);
          if (y + lines.length * 11 > bottom) newPage();
          doc.text("-", PAGE.margin, y + 8);
          for (const line of lines) { doc.text(line, PAGE.margin + 10, y + 8); y += 11; }
          y += 2;
        }
        y += 4;
      }
      font(7.5, "normal", MUTED);
      doc.text(fitText(doc, found.note, width), PAGE.margin, y + 8);
      y += 18;
    }

    const legendHeight = (items) => {
      if (!items.length) return 0;
      font(7, "normal");
      let x = 0;
      let lines = 1;
      for (const item of items) {
        const itemWidth = 12 + doc.getTextWidth(plain(item.name)) + 10;
        if (x + itemWidth > width && x > 0) { lines += 1; x = 0; }
        x += itemWidth;
      }
      return lines * 10;
    };
    const drawLegend = (items) => {
      font(7, "normal", MUTED);
      let x = 0;
      let line = 0;
      for (const item of items) {
        const itemWidth = 12 + doc.getTextWidth(plain(item.name)) + 10;
        if (x + itemWidth > width && x > 0) { line += 1; x = 0; }
        const left = PAGE.margin + x;
        const top = y + line * 10;
        const [red, green, blue] = hexColor(item.color);
        doc.setFillColor(red, green, blue);
        if (item.key === "line") doc.rect(left, top + 3, 9, 2, "F");
        else if (item.key === "band") { doc.setFillColor(red + (255 - red) * 0.75, green + (255 - green) * 0.75,
          blue + (255 - blue) * 0.75); doc.rect(left, top + 1, 9, 6, "F"); }
        else if (item.key === "hatch") {  // a records series: outlined, with diagonal lines
          const keptWidth = doc.getLineWidth();
          doc.setDrawColor(red, green, blue);
          doc.setLineWidth(0.6);
          doc.rect(left, top + 1, 6, 6, "S");
          doc.line(left, top + 4, left + 3, top + 1);
          doc.line(left, top + 7, left + 6, top + 1);
          doc.line(left + 3, top + 7, left + 6, top + 4);
          doc.setLineWidth(keptWidth);
        } else doc.rect(left, top + 1, 6, 6, "F");
        doc.text(plain(item.name), left + 12, top + 7);
        x += itemWidth;
      }
      y += legendHeight(items);
    };
    // One chart: title and caption, legend, image, its summary and any lines under it; a new page when it does not fit.
    const drawChart = (spec, caption, lines, summary) => {
      const image = images[spec.id];
      if (!image) return;
      const items = legendItems(spec);
      const imageHeight = width * image.height / image.width;
      font(8.5, "normal");
      const summaryLines = (summary || []).length ? doc.splitTextToSize(plain(summary.join(" ")), width) : [];
      const needed = 26 + legendHeight(items) + imageHeight + (summaryLines.length + (lines || []).length) * 11 + 14;
      if (y + needed > bottom) newPage();
      font(10.5, "bold");
      doc.text(fitText(doc, spec.title, width - 90), PAGE.margin, y + 10);
      font(7.5, "normal", MUTED);
      doc.text(spec.dollars === "future" ? "Inflation adjusted" : "Today's dollars", PAGE.margin + width, y + 10,
        { align: "right" });
      doc.text(fitText(doc, caption, width), PAGE.margin, y + 21);
      y += 26;
      drawLegend(items);
      doc.addImage(image.dataUrl, "PNG", PAGE.margin, y, width, imageHeight);
      y += imageHeight + 4;
      font(8.5, "normal");
      for (const line of summaryLines) { doc.text(line, PAGE.margin, y + 8); y += 11; }
      if (summaryLines.length && (lines || []).length) y += 3;
      for (const line of lines || []) { doc.text(fitText(doc, line, width), PAGE.margin, y + 8); y += 11; }
      y += 10;
    };
    for (const plot of report.plots) drawChart(plot.spec, plot.caption, null, plot.summary);
    if (report.comparison) {
      if (y + 40 > bottom) newPage();
      font(13, "bold");
      doc.text("Comparison", PAGE.margin, y + 12);
      y += 20;
      drawChart(report.comparison.spec, report.comparison.caption, report.comparison.lines, report.comparison.summary);
      // How many settings each saved scenario changes; the settings themselves are in the addendum.
      font(8, "normal", MUTED);
      for (const text of report.comparison.differences || []) {
        for (const line of doc.splitTextToSize(plain(text), width)) {
          if (y + 11 > bottom) newPage();
          doc.text(line, PAGE.margin, y + 8);
          y += 11;
        }
      }
    }
    const bodyPages = doc.getNumberOfPages();

    // Addendum: each section's heading and intro, each part's subheading, then each table's title and brief over the
    // table, with its header row repeated on every page it runs onto. The headings wait (`pending`) and are drawn with
    // the next table, on a new page when they, its header row and first rows do not fit.
    newPage();
    font(14, "bold");
    doc.text("Addendum: tables", PAGE.margin, y + 12);
    y += 24;
    let pending = [];
    for (const section of report.addendum) {
      pending.push(leadText(section.heading, ADDENDUM_TYPE.section, 12));
      if (section.intro) pending.push(leadText(section.intro, ADDENDUM_TYPE.intro));
      for (const part of section.parts || [{ heading: null, tables: section.tables }]) {
        if (part.heading) pending.push(leadText(part.heading, ADDENDUM_TYPE.part, 4));
        for (const table of part.tables) fitTable(table);
      }
    }

    // A heading or brief as wrapped lines in its type ({size, style, color, after}), `before` points above it unless
    // it starts a page.
    function leadText(text, type, before) {
      font(type.size, type.style, type.color);
      const lines = doc.splitTextToSize(plain(text), width);
      return { lines, type, before: before || 0, height: (before || 0) + lines.length * type.size * 1.25 + type.after };
    }
    function drawLead(item) {
      if (y > PAGE.margin) y += item.before;
      font(item.type.size, item.type.style, item.type.color);
      for (const line of item.lines) { doc.text(line, PAGE.margin, y + item.type.size); y += item.type.size * 1.25; }
      y += item.type.after;
    }

    // A table split into column blocks by the width its text needs (`fitColumns`), each block drawn at full width.
    function fitTable(table) {
      font(TABLE_TYPE.size, "bold");
      const wordWidths = table.columns.map((name) => Math.max(...plain(name).split(/\s+/)
        .map((word) => doc.getTextWidth(word))) + 2 * TABLE_TYPE.padding);
      font(TABLE_TYPE.size, "normal");
      const natural = table.columns.map((name, column) => Math.min(TABLE_TYPE.widest, Math.max(TABLE_TYPE.narrowest,
        wordWidths[column], ...table.rows.map((row) => doc.getTextWidth(plain(row[column])) + 2 * TABLE_TYPE.padding))));
      const blocks = fitColumns(natural, width);
      splitTable(table, blocks).forEach((block, index) => drawTable(block, blocks[index].map((column) =>
        natural[column])));
    }

    // One table block, its measured column widths stretched (or shrunk) to fill the page width.
    function drawTable(table, natural) {
      const size = TABLE_TYPE.size;
      const rowHeight = 8.5;
      const padding = TABLE_TYPE.padding;
      const scale = width / natural.reduce((sum, value) => sum + value, 0);
      const widths = natural.map((value) => value * scale);
      font(size, "bold");
      const headers = table.columns.map((name, column) => doc.splitTextToSize(plain(name), widths[column] - 2 * padding)
        .slice(0, 3));
      const headerHeight = Math.max(...headers.map((lines) => lines.length)) * (size + 1) + 4;
      const numeric = table.numeric || table.columns.map(() => false);
      const drawHeader = () => {
        font(size, "bold", INK);
        let x = PAGE.margin;
        headers.forEach((lines, column) => {
          lines.forEach((text, line) => {
            const top = y + (size + 1) * (line + 1);
            if (numeric[column]) doc.text(text, x + widths[column] - padding, top, { align: "right" });
            else doc.text(text, x + padding, top);
          });
          x += widths[column];
        });
        y += headerHeight;
        doc.setDrawColor(...MUTED);
        doc.line(PAGE.margin, y - 1.5, PAGE.margin + widths.reduce((sum, value) => sum + value, 0), y - 1.5);
      };
      const drawTitle = (title) => {
        font(8.5, "bold");
        doc.text(fitText(doc, title, width), PAGE.margin, y + 9);
        y += 13;
      };
      const leads = pending.concat(leadText(table.title, table.brief ? ADDENDUM_TYPE.title : ADDENDUM_TYPE.lone),
        table.brief ? [leadText(table.brief, ADDENDUM_TYPE.brief)] : []);
      pending = [];
      const needed = leads.reduce((sum, item) => sum + item.height, 0) + headerHeight
        + rowHeight * Math.min(KEEP_ROWS, table.rows.length);
      if (y + needed > bottom) newPage();
      leads.forEach(drawLead);
      drawHeader();
      table.rows.forEach((row, index) => {
        if (y + rowHeight > bottom) { newPage(); drawTitle(table.title + " (continued)"); drawHeader(); }
        font(size, "normal");
        let x = PAGE.margin;
        row.forEach((value, column) => {
          const text = fitText(doc, value, widths[column] - 2 * padding);
          if (numeric[column]) doc.text(text, x + widths[column] - padding, y + 6, { align: "right" });
          else doc.text(text, x + padding, y + 6);
          x += widths[column];
        });
        if (index % 2 === 1) {
          doc.setDrawColor(...RULE);
          doc.line(PAGE.margin, y + rowHeight - 0.5, x, y + rowHeight - 0.5);
        }
        y += rowHeight;
      });
      y += 10;
    }

    // Footer on every page: scenario name, page number and the notice.
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      font(7, "normal", MUTED);
      const footerY = PAGE.height - PAGE.margin + 8;
      doc.setDrawColor(...RULE);
      doc.line(PAGE.margin, footerY - 9, PAGE.margin + width, footerY - 9);
      doc.text(fitText(doc, report.title, width / 3), PAGE.margin, footerY);
      doc.text("Page " + page + " of " + pages, PAGE.margin + width / 2, footerY, { align: "center" });
      doc.text(plain(report.notice), PAGE.margin + width, footerY, { align: "right" });
    }
    return { bodyPages, pages };
  }

  const api = { MAX_SAVED, PLOTS, NOTICE, IMAGE_SIZE, capSelection, reportFilename, householdLine, headlineFigures,
    keyResults, compareSpec, differenceTables, differenceLines, inputTables, recordTable, yearlyTables, fitColumns, splitTable, buildReport, standaloneSvg,
    legendItems, plain, drawReport, JUMP_SHARE, JUMP_FLOOR, DROP_SHARE, DROP_FLOOR, EMPTY_BALANCE, jumpAt, dropAt,
    emptiesAt, stopsAfter, startsAt, bandsSummary, histogramSummary, balancesSummary, cashFlowSummary, taxesSummary,
    expensesSummary, comparisonSummary, plotSummary };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WmtiReport = api;
})(typeof self !== "undefined" ? self : this);

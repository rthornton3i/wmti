// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// The final report (PDF): buildReport turns the current scenario's results (and any saved scenarios run beside it)
// into plain report data, and drawReport draws that data with a jsPDF document. The body holds the headline figures,
// four key results and the charts, each with a one-line caption; the addendum holds every table, in small type with
// the header row repeated on each page. buildReport and the helpers run in Node for the tests; drawReport needs only
// the jsPDF object it is given, and the page rasterizes the charts (standaloneSvg) before calling it.
(function (root) {
  "use strict";

  const shared = typeof module !== "undefined" && module.exports ? require("./shared.js") : root.WmtiShared;
  const { fullMoney, percent, formatValue } = shared;

  const MAX_SAVED = 4;  // saved scenarios the report can compare with the current settings
  // The body's charts, in order, by the Monte Carlo result's chart ids; one-line captions.
  const PLOTS = [
    { id: "bands", caption: "Median run (line) and 10th to 90th percentile (shaded) of the total balance." },
    { id: "histogram", caption: "How the runs' final values spread; the extreme runs are left out." },
    { id: "balances", caption: "Each account's balance by year; middle half average of the runs." },
    { id: "cashFlow", caption: "Cash in above zero, cash out below; middle half average of the runs." },
    { id: "taxes", caption: "Taxes by kind and year; middle half average of the runs." },
    { id: "expenses", caption: "Spending by category and year; middle half average of the runs." },
  ];
  const COMPARE_CAPTION = "Median (line) and 10th to 90th percentile (shaded) per configuration; same runs and seed.";
  // The app's own wording (the Setup notice): estimates for education, not advice.
  const NOTICE = "Estimates for education only; not financial, tax or legal advice.";
  const AFTER_TAX_PREFIX = "Final net worth after terminal tax";
  // The light scheme's chart tokens (the plain :root block of styles.css) and its series palette, slots 0 to 7.
  const LIGHT = { line: "#D6E2E4", muted: "#4F6772", surface: "#ffffff", ink: "#0B3A4F", ink2: "#2E5566" };
  const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
  const IMAGE_SIZE = { width: 640, height: 240 };  // the viewBox a chart is drawn on for the report
  const TABLE_COLUMNS = 8;  // data columns per addendum table block; wider tables continue in further blocks
  const TURN_ITEMS = 4;  // a list of at most this many items with more fields than a block holds is drawn turned
  // Titles of the input lists; any other list is titled from its key.
  const LIST_TITLES = { expenses: "Expenses", accounts: "Accounts and balances", loans: "Loans and mortgages",
    homes: "Homes", cars: "Cars", children: "Children and education", rents: "Rents", visits: "Healthcare visits",
    premiums: "Health premiums", salaryHistory: "Salary history", retirementSpending: "Retirement spending" };
  // The yearly table's column groups, first match wins; the rest go under Other.
  const YEARLY_GROUPS = [
    ["Income sources", /^(Paycheck|Interest|Social Security$|Asset Sale|Employer Match|Home Sale|Gross Income|Net Earnings)/],
    ["Taxes, deductions and withholding", /(Tax|Federal|State|MAGI|AGI|Deduction|Itemized|Dependents|HSA|FSA|Property|Medicare|Capital Gains|^Medical$|^Taxable)/],
    ["Deposits and withdrawals", /(Deposit|Withdraw|QCD|Conversion|Investment Gains|Shortfall)/],
    ["Loans, homes and cars", /(Loan|Home Value|Car Value)/],
    ["Expenses", /(Bills|Spending|College|Healthcare|Supplement|Premium|IRMAA|Car |Charitable|Asset Purchases|Selling Costs|Tagged)/],
    ["Other", /./],
  ];
  const PLAIN_COLUMN = /^(Age|Year|Divisor|Dependents|Deduction type|Percentile)/;

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
    if (inputs && Number.isFinite(inputs.years)) {
      parts.push(inputs.years + " years planned" + (you && Number.isFinite(you.currentAge) ? " (to your age "
        + (you.currentAge + inputs.years - 1) + ")" : ""));
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
      [headlineOf(mcLines, (label) => label.startsWith(AFTER_TAX_PREFIX)), "After tax, incl. home and cars"],
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
    const item = headlineOf(monteCarlo && monteCarlo.headlines, (label) => label.startsWith(AFTER_TAX_PREFIX));
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
    return { id: "reportCompare", type: "compareBands", title: "Total balance by age", x: { label: "Your age", values: ages },
      y: { label: "Total balance", unit: "money" }, percentiles: first.percentiles, series, dollars: first.dollars,
      table: { columns: ["Your age"].concat(series.map((item) => item.name + " median")),
        rows: ages.map((age, position) => [age].concat(series.map((item) => item.values[position]))) } };
  }

  function comparisonTable(configs) {
    return { title: "Configurations compared", columns: ["Configuration", "Median final worth", "After tax",
      "Chance of success", "10th percentile", "90th percentile"], numeric: [false, true, true, true, true, true],
    rows: configs.map((config) => [config.name, fullMoney(percentileValue(config.result, 50)),
      fullMoney(afterTaxValue(config.result)), percent(successShare(config.result), 0),
      fullMoney(percentileValue(config.result, 10)), fullMoney(percentileValue(config.result, 90))]) };
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

  // The inputs as addendum tables: one "Key inputs" table (group, setting, value) for every single setting, and one
  // table per list of items (expenses, accounts, loans and so on); a list with no items gives no table.
  function inputTables(inputs) {
    const keyRows = [];
    const lists = [];
    const walk = (value, group, label, key, listTitle) => {
      if (isRecordList(value)) { lists.push(recordTable(listTitle, value)); return; }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [inner, item] of Object.entries(value)) {
          walk(item, group, (label ? label + ": " : "") + humanize(inner), inner, (listTitle ? listTitle + ": " : "")
            + (LIST_TITLES[inner] || humanize(inner)));
        }
        return;
      }
      if (value == null || (Array.isArray(value) && !value.length)) return;
      keyRows.push([group, label, inputText(key, value)]);
    };
    for (const [key, value] of Object.entries(inputs || {})) {
      if (key === "schemaVersion") continue;
      const title = LIST_TITLES[key] || humanize(key);
      if (value && typeof value === "object" && !Array.isArray(value)) walk(value, humanize(key), "", key, title);
      else walk(value, "General", humanize(key), key, title);
    }
    const tables = [];
    if (keyRows.length) tables.push({ title: "Key inputs by group", columns: ["Group", "Setting", "Value"], rows: keyRows });
    const order = Object.values(LIST_TITLES);
    lists.sort((left, right) => rank(order, left.title) - rank(order, right.title));
    return tables.concat(lists);
  }

  function rank(order, title) {
    const position = order.indexOf(title);
    return position < 0 ? order.length : position;
  }

  // A list of items as a table: a column per field that any item fills, the name first. A few items with many
  // fields (homes, cars) read better turned: a row per field and a column per item.
  function recordTable(title, items) {
    const keys = [];
    for (const item of items) for (const key of Object.keys(item)) if (!keys.includes(key)) keys.push(key);
    const filled = keys.filter((key) => items.some((item) => item[key] != null && item[key] !== ""
      && !(Array.isArray(item[key]) && !item[key].length)));
    filled.sort((left, right) => (right === "name") - (left === "name"));
    if (filled.length > TABLE_COLUMNS + 1 && items.length <= TURN_ITEMS) {
      const names = items.map((item, position) => (item.name != null ? String(item.name) : "Item " + (position + 1)));
      return { title, columns: ["Setting"].concat(names), numeric: [false].concat(names.map(() => false)),
        rows: filled.filter((key) => key !== "name").map((key) => [humanize(key)].concat(items.map((item) =>
          inputText(key, item[key])))) };
    }
    return { title, columns: filled.map(humanize), numeric: filled.map((key) => items.every((item) =>
      item[key] == null || typeof item[key] === "number")),
    rows: items.map((item) => filled.map((key) => inputText(key, item[key]))) };
  }

  function columnText(column, value) {
    if (value == null || value === "") return "";
    if (typeof value !== "number") return String(value);
    if (PLAIN_COLUMN.test(column)) return formatValue(value);
    if (/Inflation/.test(column)) return percent(value, 2);
    return fullMoney(value);
  }

  // A result frame ({columns, index?, data}) as a table; `indexLabel` names the index column when it has one.
  function frameTable(title, frame, indexLabel) {
    const hasIndex = Array.isArray(frame.index) && indexLabel;
    const columns = (hasIndex ? [indexLabel] : []).concat(frame.columns);
    const rows = frame.data.map((row, position) => (hasIndex ? [frame.index[position]] : []).concat(row)
      .map((value, column) => columnText(columns[column], value)));
    return { title, columns, rows, numeric: columns.map((name) => name !== "Deduction type") };
  }

  // The yearly table (Outputs, Summary table) split into its column groups, each led by your age.
  function yearlyTables(summary) {
    const ageColumn = summary.columns.indexOf("Age (you)");
    const groups = YEARLY_GROUPS.map(([title]) => ({ title, columns: [] }));
    summary.columns.forEach((name, position) => {
      if (position === ageColumn) return;
      const group = YEARLY_GROUPS.findIndex(([, pattern]) => pattern.test(name));
      groups[group].columns.push(position);
    });
    return groups.filter((group) => group.columns.length).map((group) => {
      const positions = (ageColumn >= 0 ? [ageColumn] : []).concat(group.columns);
      const columns = positions.map((position) => summary.columns[position]);
      return { title: "Yearly: " + group.title, columns, numeric: columns.map((name) => name !== "Deduction type"),
        rows: summary.data.map((row) => positions.map((position) => columnText(summary.columns[position], row[position]))) };
    });
  }

  // Split a table into blocks of at most `limit` data columns, each repeating the first column.
  function chunkTable(table, limit = TABLE_COLUMNS) {
    const rest = table.columns.length - 1;
    if (rest <= limit) return [table];
    const blocks = Math.ceil(rest / limit);
    const numeric = table.numeric || table.columns.map(() => false);
    const out = [];
    for (let block = 0; block < blocks; block += 1) {
      const positions = [0].concat(Array.from({ length: Math.min(limit, rest - block * limit) },
        (unused, offset) => 1 + block * limit + offset));
      out.push({ title: table.title + " (" + (block + 1) + " of " + blocks + ")",
        columns: positions.map((position) => table.columns[position]),
        numeric: positions.map((position) => numeric[position]),
        rows: table.rows.map((row) => positions.map((position) => row[position])) });
    }
    return out;
  }

  // The report as plain data. `data`: scenarioName, date (Date), inputs, monteCarlo (the current settings' finished
  // Monte Carlo result), single (the single run's result, or null) and configs ([{name, result}] of the saved
  // scenarios run for the report; empty for none). The comparison is there only when configs has an item.
  function buildReport(data) {
    const monteCarlo = data.monteCarlo;
    const plots = PLOTS.map((plot) => ({ spec: monteCarlo.charts.find((spec) => spec.id === plot.id),
      caption: plot.caption })).filter((plot) => plot.spec);
    const configs = (data.configs || []).length ? [{ name: data.scenarioName + " (current)", result: monteCarlo }]
      .concat(data.configs) : [];
    const comparison = configs.length ? { spec: compareSpec(configs), caption: COMPARE_CAPTION,
      lines: configs.map((config) => config.name + ": median " + fullMoney(percentileValue(config.result, 50))
        + " · after tax " + fullMoney(afterTaxValue(config.result)) + " · success "
        + percent(successShare(config.result), 0)) } : null;
    const tables = monteCarlo.tables || {};
    const results = [];
    if (tables.summary) results.push(...yearlyTables(tables.summary));
    if (tables.accounts) results.push(frameTable("Accounts by year", tables.accounts, null));
    if (tables.deductions) results.push(frameTable("Deductions by year", tables.deductions, "Your age"));
    if (tables.rmdSchedule && tables.rmdSchedule.data && tables.rmdSchedule.data.length) {
      results.push(frameTable("Required minimum distributions", tables.rmdSchedule, null));
    }
    if (monteCarlo.percentiles) {
      results.push(frameTable("Final worth by percentile", monteCarlo.percentiles, null));
    }
    const sections = [
      { heading: "Settings", tables: inputTables(data.inputs) },
      { heading: "Yearly results (middle half average of the runs)", tables: results },
      { heading: "Comparison", tables: configs.length ? [comparisonTable(configs)] : [] },
    ].map((section) => ({ heading: section.heading, tables: section.tables.filter((table) => table.rows.length)
      .flatMap((table) => chunkTable(table)) })).filter((section) => section.tables.length);
    return {
      title: data.scenarioName, filename: reportFilename(data.scenarioName, data.date), date: isoDate(data.date),
      household: householdLine(data.inputs), runs: monteCarlo.runs, seed: monteCarlo.seed,
      dollars: monteCarlo.dollars === "future" ? "Inflation adjusted" : "Today's value",
      headlines: headlineFigures(monteCarlo, data.single), keyResults: keyResults(monteCarlo), plots, comparison,
      addendum: sections, notice: NOTICE,
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

  // The chart markup's SVG as a standalone image: the light colors written in (series tokens to their light value,
  // the page's chart rules as an inline style), a white background, and no readout crosshair or hit area.
  function standaloneSvg(markup, size = IMAGE_SIZE) {
    const found = /<svg[\s\S]*<\/svg>/.exec(markup);
    if (!found) return null;
    const body = found[0]
      .replace(/<line class="crosshair"[^>]*><\/line>/g, "")
      .replace(/<rect class="hit"[^>]*><\/rect>/g, "")
      .replace(/var\(--s\d+, ([^)]+)\)/g, "$1")
      .replace(/^<svg class="chart-svg"([^>]*?) role="img" tabindex="0" aria-label="[^"]*"/, "<svg class=\"chart-svg\"$1");
    return body.replace(/^<svg /, "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + size.width + "\" height=\""
      + size.height + "\" ").replace(/^(<svg[^>]*>)/, "$1<style>" + CHART_STYLE + "</style><rect width=\"100%\" "
      + "height=\"100%\" fill=\"" + LIGHT.surface + "\"></rect>");
  }

  // The legend items of a chart spec: [{name, color, key}] with key "line", "band" or "box".
  function legendItems(spec) {
    if (spec.type === "bands") {
      const series = spec.series[0];
      const [low, high] = spec.percentiles || [10, 90];
      return [{ name: "Median", color: series.color, key: "line" }, { name: low + "th to " + high + "th percentile",
        color: series.color, key: "band" }];
    }
    if (spec.type === "histogram") return [];
    return spec.series.map((series) => ({ name: series.name, color: series.color,
      key: series.mark === "line" || spec.type === "compareBands" ? "line" : "box" }));
  }

  // ---- drawing ----

  const PAGE = { width: 612, height: 792, margin: 40, footer: 24 };  // US Letter in points
  const INK = [11, 58, 79];
  const MUTED = [79, 103, 114];
  const RULE = [214, 226, 228];
  const LATIN = { "→": "->", "–": "-", "—": "-", "‘": "'", "’": "'", "“": "\"", "”": "\"", "…": "...", "≥": ">=",
    "≤": "<=", "−": "-" };

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

    // Title block: name, date and household, the headline figures as tiles, the key results.
    font(18, "bold");
    doc.text(fitText(doc, report.title, width), PAGE.margin, y + 16);
    y += 26;
    font(8.5, "normal", MUTED);
    doc.text(fitText(doc, [report.date, report.household, report.runs + " runs, seed " + report.seed, report.dollars]
      .filter(Boolean).join(" · "), width), PAGE.margin, y + 8);
    y += 18;
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
        else doc.rect(left, top + 1, 6, 6, "F");
        doc.text(plain(item.name), left + 12, top + 7);
        x += itemWidth;
      }
      y += legendHeight(items);
    };
    // One chart: title and caption, legend, image and any lines under it; a new page when it does not fit.
    const drawChart = (spec, caption, lines) => {
      const image = images[spec.id];
      if (!image) return;
      const items = legendItems(spec);
      const imageHeight = width * image.height / image.width;
      const needed = 26 + legendHeight(items) + imageHeight + (lines || []).length * 11 + 14;
      if (y + needed > bottom) newPage();
      font(10.5, "bold");
      doc.text(fitText(doc, spec.title, width - 90), PAGE.margin, y + 10);
      font(7.5, "normal", MUTED);
      doc.text(spec.dollars === "future" ? "Inflation adjusted" : "Today's value", PAGE.margin + width, y + 10,
        { align: "right" });
      doc.text(fitText(doc, caption, width), PAGE.margin, y + 21);
      y += 26;
      drawLegend(items);
      doc.addImage(image.dataUrl, "PNG", PAGE.margin, y, width, imageHeight);
      y += imageHeight + 4;
      font(8.5, "normal");
      for (const line of lines || []) { doc.text(fitText(doc, line, width), PAGE.margin, y + 8); y += 11; }
      y += 10;
    };
    for (const plot of report.plots) drawChart(plot.spec, plot.caption);
    if (report.comparison) {
      if (y + 40 > bottom) newPage();
      font(13, "bold");
      doc.text("Comparison", PAGE.margin, y + 12);
      y += 20;
      drawChart(report.comparison.spec, report.comparison.caption, report.comparison.lines);
    }
    const bodyPages = doc.getNumberOfPages();

    // Addendum: section headings, then each table with its header row repeated on every page it runs onto.
    newPage();
    font(14, "bold");
    doc.text("Addendum: tables", PAGE.margin, y + 12);
    y += 22;
    for (const section of report.addendum) {
      if (y + 60 > bottom) newPage();
      font(11.5, "bold");
      doc.text(plain(section.heading), PAGE.margin, y + 11);
      y += 18;
      for (const table of section.tables) drawTable(table);
    }

    function drawTable(table) {
      const size = 6.5;
      const rowHeight = 8.5;
      const padding = 3;
      font(size, "bold");
      const wordWidths = table.columns.map((name) => Math.max(...plain(name).split(/\s+/)
        .map((word) => doc.getTextWidth(word))) + 2 * padding);
      font(size, "normal");
      const natural = table.columns.map((name, column) => Math.min(150, Math.max(24, wordWidths[column],
        ...table.rows.map((row) => doc.getTextWidth(plain(row[column])) + 2 * padding))));
      const scale = Math.min(1, width / natural.reduce((sum, value) => sum + value, 0));
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
      if (y + 16 + headerHeight + rowHeight * Math.min(3, table.rows.length) > bottom) newPage();
      drawTitle(table.title);
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
    keyResults, compareSpec, inputTables, yearlyTables, chunkTable, buildReport, standaloneSvg, legendItems, plain,
    drawReport };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WmtiReport = api;
})(typeof self !== "undefined" ? self : this);

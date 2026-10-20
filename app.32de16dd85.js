// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// The page: boot screen, tabs and chips, settings forms built from the Python settings schema, results and charts.
// All numbers come from wmti.dashboard.web through the worker; this file only draws and keeps the draft.
(function () {
  "use strict";

  const { escapeText, compactMoney, fullMoney, percent, getPath, setPath, checkScenarioName, scenarioFileProblem, sheetFields, sheetLabel,
    sheetSwitches, clearedOnChange, kindReturnsFilled, returnsSummary,
    expenseAgesText, expenseSummary, expenseTotals, carSummary, homeSummary, spanText, hasCarLoan, yearOfAge, ageOfYear, timelineBars, choosePrimary, ensureOnePrimary, normalPair, tabRoute, inputsChip, normalCurvePoints, filteredPositions, filterStartValues,
    moveSelected, deleteSelected, moveItem, panelField, syncResetFlags, resetGroup, sameValue, walkRead, walkBoundsError, walkHint, walkIndex, WALK_TAGS,
    WALK_ACTION_LABELS, WALK_COUNT_LISTS, walkProgress, walkTrail, walkDirection, walkClean, answerText, legalBlocks, termsAccepted, migrateLegacyStorage, updateCheckText,
    blankInputs, needsSetup, otherScenarioNames, freeName, numberedName, undoRecord, undoStep, mergeUndoPush,
    mergeUndoPop, changedPaths } = window.WmtiShared;
  const charts = window.WmtiCharts;

  const BOOT_STEPS = [["script", "Loading the calculator"], ["boot", "Starting up"],
    ["packages", "Installing libraries"], ["imports", "Importing libraries"],
    ["model", "Loading the retirement model"], ["startup", "Reading your settings and the example household"]];
  const NOTES_PANELS = new Set(["accounts", "cars", "expenses", "retirement", "strategies"]);  // panels that show settingsNotes
  const SETUP_PANEL = "household";  // the schema panel drawn on Setup instead of as an Inputs chip
  const INFLATION_CARD_FIELDS = ["useInflation", "inflation"];  // fields of that panel drawn in the Inflation card
  const ROLLOVER_SWITCH = "strategies.rothConversion.enabled";  // adds or removes the rollover account
  // Plots chips: the chart spec id, the chip label, what the view shows and what it says when the run has no rows.
  // Every plot is drawn from the last Monte Carlo: "total" is its spread, the others the runs' middle half average each year.
  const PLOT_VIEWS = [
    { id: "total", label: "Total balance", charts: ["bands", "histogram"], intro: "The total balance over the runs "
      + "(the median run as a line, the 10th to 90th percentile shaded) and how the runs' final values spread." },
    { id: "balances", label: "Balances", intro: "Each account's balance at the end of each year, stacked; the "
      + "middle half average of the runs." },
    { id: "cashFlow", label: "Cash flow", intro: "Cash in above zero: pay, Social Security, withdrawals and any shortfall. "
      + "Cash out below it (negative): expenses, taxes, retirement deposits and the surplus put back into the accounts, so "
      + "each year's bars match. The middle half average of the runs." },
    { id: "flows", label: "Deposits and withdrawals", intro: "The middle half average of the runs. Deposits into the accounts "
      + "are above zero, withdrawals below it (negative). Traditional includes RMD and QCD; dotted line: the required "
      + "minimum. Social Security, pay and the Roth conversion are not bars." },
    { id: "taxes", label: "Taxes", intro: "The taxes charged each year, by kind; the middle half average of the runs. The "
      + "deductions are under Outputs, Summary." },
    { id: "expenses", label: "Expenses", intro: "What the household spends each year, by category; the middle half "
      + "average of the runs. Categories never charged are left out; taxes are in Taxes." },
  ];
  const RESULT_VIEWS = [{ id: "summary", label: "Summary" }, { id: "accounts", label: "Accounts" },
    { id: "deductions", label: "Deductions" }];
  // What Compare does, behind the "i" beside the Compare card's heading.
  const COMPARE_HELP = "Pick two configs to compare, as on the desktop. Both run on the same random draws (same seed), "
    + "so the differences come from the settings, not from luck. Save scenarios under Setup to compare them "
    + "here.";
  const CACHED_RESULTS = 2;  // Monte Carlo and comparison results kept per kind, newest first
  const DEFAULT_RUN_MS = 250;  // a phone's time per run until this device has measured one
  const SAVED_LIMIT = 50;
  const NO_EARNINGS_HINT = "Enter past earnings on the Income tab to use this.";  // wmti.dashboard.settings.NO_EARNINGS_HINT
  const NULL_LABELS = { owner: "Usual owner", account529: "None (the 529s together)" };  // what a blank select choice means for these fields
  const RUN_DELAY_MS = 400;
  const SETTLE_MS = 400;  // a pause in editing this long makes one undo step (and, with Auto-save on, one save)
  const UNDO_LIMIT = 10;  // input states of the open scenario that Undo can step back through
  const MC_DELAY_MS = 1500;  // the pause after the single run before the Monte Carlo starts on its own
  const EXAMPLE_NAME = "Example household";
  const DRAFT_KEY = "wmti.draft.v1";
  const SCENARIOS_KEY = "wmti.scenarios.v1";
  const PREFS_KEY = "wmti.prefs.v1";
  const WALK_KEY = "wmti.walk.v1";  // the walkthrough's progress
  const TERMS_KEY = "wmti.terms.v1";  // the Terms acceptance: {version, textHash, buildId, acceptedAt}
  // The key points at the top of the Terms step and of the Legal window, one line each, then a pointer to the full Terms.
  const LEGAL_SUMMARY = [
    "This app is for educational and non-commercial use only and is not to be considered financial, tax, investment or legal advice.",
    "The app provides hypothetical projections that may differ from your actual results. Please verify them with a licensed professional before acting.",
    "Your data is not shared with the developer or any third-party providers. Data sharing is limited to GitHub Pages data sharing policies.",
    "Use of this app is at your own risk. The app is provided as is, without warranty.",
  ];
  const LEGAL_SUMMARY_CLOSING = "Please read the full Terms below.";
  const TABS = ["setup", "inputs", "outputs"];  // the bottom bar, left to right
  const VIEWS = ["summary", "plots", "compare"];  // the switch inside Outputs
  // The color scheme, kept per viewer as plain text; index.html applies it before the first paint.
  const THEME_KEY = "wmti.theme.v1";
  // Every key this app keeps in localStorage; Clear all data on this device removes them all.
  const STORAGE_KEYS = [DRAFT_KEY, SCENARIOS_KEY, PREFS_KEY, WALK_KEY, TERMS_KEY, THEME_KEY];
  // Keys kept before the rename (fpt.*) move to these once, before anything reads them.
  try {
    migrateLegacyStorage(localStorage, TERMS_KEY, (window.WMTI_LEGAL || {}).textHash || "");
  } catch (error) { /* storage blocked: nothing kept to move */ }
  const SCHEMES = ["lagoon", "sunset", "palm", "night", "device"];
  // The header band's section label, title (blank: the selected Inputs chip) and one-line subtitle per place.
  const PLACE_TEXT = {
    setup: ["Setup", "Scenarios and run", "Your scenarios and files, the household and the run"],
    inputs: ["Inputs", "", "Every change reruns the plan"],
    "outputs/summary": ["Outputs", "Summary", "From the last Monte Carlo"],
    "outputs/plots": ["Outputs", "Plots", "Middle half average of the runs"],
    "outputs/compare": ["Outputs", "Compare", "Two configs on the same random draws"],
  };
  // Inline SVG icons (24 px grid, stroked): chips and pane titles.
  const ICONS = {
    user: "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6\"/>",
    sliders: "<path d=\"M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12\"/><circle cx=\"16\" cy=\"6\" r=\"2\"/>"
      + "<circle cx=\"10\" cy=\"12\" r=\"2\"/><circle cx=\"18\" cy=\"18\" r=\"2\"/>",
    chart: "<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/>",
    home: "<path d=\"M3 11l9-7 9 7v9h-6v-6H9v6H3z\"/>",
    briefcase: "<rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M8 7V5h8v2\"/>",
    baby: "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M6 21c0-4 3-6 6-6s6 2 6 6\"/>",
    heart: "<path d=\"M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z\"/>",
    sun: "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19"
      + "l1.5-1.5M17.5 6.5L19 5\"/>",
    pig: "<circle cx=\"12\" cy=\"13\" r=\"7\"/><path d=\"M12 9v8M9.5 11h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4\"/>",
    receipt: "<path d=\"M6 3h12v18l-3-2-3 2-3-2-3 2z\"/><path d=\"M9 8h6M9 12h6\"/>",
    bands: "<path d=\"M3 17l5-5 4 3 8-8\"/><path d=\"M3 21h18\"/>",
  };
  // The icon of a chip or pane: the first word here found in its label, else in its id; sliders when none is.
  const ICON_WORDS = [["household", "user"], ["income", "briefcase"], ["benefit", "briefcase"], ["savings", "briefcase"],
    ["children", "baby"], ["dependent", "baby"], ["home", "home"], ["loan", "receipt"], ["expense", "receipt"],
    ["tax", "receipt"], ["deduction", "receipt"], ["retirement plan", "pig"], ["total", "bands"], ["account", "pig"],
    ["balance", "pig"],
    ["medical", "heart"], ["hsa", "heart"], ["health", "heart"], ["medicare", "heart"], ["social security", "sun"],
    ["retirement", "sun"], ["summary", "chart"], ["cash", "chart"], ["flows", "sliders"]];

  const state = {
    info: null, schema: null, defaults: null, inputs: null, base: null, scenarioName: EXAMPLE_NAME, seed: 1,
    walkTree: null, result: null, error: null, lastRunMs: null, bootMs: null, pyodideVersion: null,
    notes: null, surplusLocks: [], benefits: null, earnings: null, deposits: null, planOpen: false,
    tab: "outputs", view: "summary", scroll: {}, chips: { results: "summary", plots: null, settings: "income" },
    plotView: "chart", scenarios: Object.create(null), perRunMs: null,
    autoSave: false, exampleHidden: false, savedJustNow: false, undo: { stack: [], current: null },
    mc: { runs: 25, job: null, cache: [], message: null, skipKey: null },
    compare: { seed: 1, pair: null, check: null, job: null, cache: [], message: null, differencesOpen: false,
      armed: null, diffs: null, diffsPending: null, mergeUndo: [] },
  };
  const $ = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  // ---- Storage (per viewer, may be unavailable) ----
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (error) { return null; }
  }
  function store(key, value) {
    if (state.clearing) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage blocked: keep going */ }
  }
  function saveDraft() {
    store(DRAFT_KEY, { inputs: state.inputs, base: state.base, scenarioName: state.scenarioName, seed: state.seed });
  }
  function savePrefs() {
    const compare = state.compare;
    store(PREFS_KEY, { tab: state.tab, view: state.view, chips: state.chips, plotView: state.plotView,
      surplusLocks: state.surplusLocks, mc: { runs: state.mc.runs }, autoSave: state.autoSave,
      exampleHidden: state.exampleHidden, compare: { seed: compare.seed, pair: compare.pair } });
  }

  // ---- Engine (the worker) ----
  const engine = (() => {
    let worker = null;
    let nextId = 1;
    const pending = new Map();
    let readyResolve;
    const ready = new Promise((resolve) => { readyResolve = resolve; });

    function start() {
      worker = new Worker("worker.5a09dfab2d.js");
      worker.onmessage = (event) => {
        const message = event.data;
        if (message.kind === "step") return bootStep(message);
        if (message.kind === "ready") { readyResolve(message); return onReady(message); }
        if (message.kind === "failed") return bootFailed(message.error);
        const call = pending.get(message.id);
        if (!call) return;
        if (message.kind === "progress") { if (call.onProgress) call.onProgress(message); return; }
        pending.delete(message.id);
        if (message.kind === "result") call.resolve({ value: message.value, ms: message.ms });
        else if (message.kind === "dropped") call.resolve(null);
        else call.reject(new Error(message.error));
      };
      worker.onerror = (event) => bootFailed(event.message || "the worker stopped");
    }

    function job(fn, args, lane, onProgress) {
      const id = nextId++;
      const promise = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress });
        worker.postMessage({ id, fn, args, lane });
      });
      return { id, promise };
    }

    function call(fn, args, lane, onProgress) { return job(fn, args, lane, onProgress).promise; }

    function cancel(target) { worker.postMessage({ fn: "cancel", target }); }

    return { start, call, job, cancel, ready };
  })();
  window.wmtiEngine = engine;  // for the tests and for debugging

  // Call wmti.dashboard.web and return its answer; a worker error comes back as {ok: false, error} so every caller
  // can show it, and a dropped request as null.
  async function ask(fn, args, lane) {
    try {
      const reply = await engine.call(fn, args, lane);
      return reply ? reply.value : null;
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    }
  }

  // ---- Boot screen ----
  const bootStarted = performance.now();
  let bootTimer = null;

  function renderBootSteps() {
    $("bootSteps").replaceChildren(...BOOT_STEPS.map(([key, label]) => {
      const item = document.createElement("li");
      item.id = "step-" + key;
      item.dataset.status = "todo";
      item.innerHTML = "<span class=\"step-mark\"></span><span class=\"step-label\"></span><span class=\"step-time\"></span>";
      item.querySelector(".step-label").textContent = label;
      return item;
    }));
    bootTimer = setInterval(() => {
      $("bootTime").textContent = ((performance.now() - bootStarted) / 1000).toFixed(1) + " s";
    }, 100);
  }

  function bootStep(message) {
    const item = $("step-" + message.key);
    if (!item) return;
    item.dataset.status = message.status;
    if (message.ms != null) item.querySelector(".step-time").textContent = (message.ms / 1000).toFixed(1) + " s";
    const done = document.querySelectorAll(".boot-steps li[data-status=done]").length;
    $("bootBar").style.width = (done / BOOT_STEPS.length) * 100 + "%";
    $("bootProgress").setAttribute("aria-valuenow", String(done));
  }

  function bootFailed(error) {
    clearInterval(bootTimer);
    $("bootErrorText").textContent = error;
    $("bootError").hidden = false;
  }

  // ---- Start-up ----
  async function onReady(message) {
    clearInterval(bootTimer);
    Object.assign(state, { info: message.info, schema: message.schema, defaults: message.defaults,
      walkTree: message.walkthrough, bootMs: message.bootMs, pyodideVersion: message.pyodideVersion,
      seed: message.info.defaultSeed });
    // A first visit: no saved draft and no walkthrough progress, decided before the draft is restored.
    const draftRead = readDraft();
    const firstVisit = draftRead.draft == null && !draftRead.unreadable && load(WALK_KEY) == null;
    state.mc.runs = message.info.monteCarlo.defaultRuns;
    let notice = null;
    try {
      notice = await restoreDraft();
    } catch (error) {
      notice = discardDraft();
    }
    const prefs = load(PREFS_KEY);
    if (prefs) {
      // Prefs of the older five-tab page (tab "settings", "plots", ...) lead to the matching new place.
      const route = tabRoute(prefs.tab);
      if (route) state.tab = route.tab;
      if (route && route.view) state.view = route.view;
      else if (VIEWS.includes(prefs.view)) state.view = prefs.view;
      Object.assign(state.chips, prefs.chips || {});
      if (route && route.chip) state.chips.settings = route.chip;
      if (prefs.plotView === "table") state.plotView = "table";
      if (Array.isArray(prefs.surplusLocks)) state.surplusLocks = prefs.surplusLocks.filter((name) => typeof name === "string");
      restoreRunPrefs(prefs);
      state.autoSave = prefs.autoSave === true;
      // The example household left Other scenarios when deleted there; it is back whenever it is the open scenario.
      state.exampleHidden = prefs.exampleHidden === true && state.scenarioName !== EXAMPLE_NAME;
    }
    const saved = load(SCENARIOS_KEY);
    // A map with no prototype, so a scenario named __proto__ or constructor is an ordinary key.
    if (saved && typeof saved === "object" && !Array.isArray(saved)) state.scenarios = Object.assign(Object.create(null), saved);
    const hashRoute = tabRoute(location.hash);
    if (hashRoute) state.tab = hashRoute.tab;
    if (hashRoute && hashRoute.chip) state.chips.settings = hashRoute.chip;
    if (hashRoute && hashRoute.view) state.view = hashRoute.view;
    $("boot").hidden = true;
    $("app").hidden = false;
    try {
      renderAll();
    } catch (error) {
      // A saved draft whose shape the forms cannot draw: start again from the example household.
      notice = discardDraft();
      renderAll();
    }
    resetUndo();
    if (notice) showFileMessage(notice, true);
    selectTab(state.tab, false);
    runNow();
    loadWalk();
    await termsAgreed;  // the Terms step comes first; the walkthrough only after it
    if (firstVisit || location.hash === "#walkthrough" || (walk.saved && walk.saved.status === "active")) openWalk();
  }

  function restoreRunPrefs(prefs) {
    const choices = state.info.monteCarlo.choices;
    if (prefs.mc && choices.includes(prefs.mc.runs)) state.mc.runs = prefs.mc.runs;  // an older page's own seed is ignored
    const compare = prefs.compare || {};  // an older page's own Compare runs are ignored: Compare uses Runs
    if (Number.isInteger(compare.seed)) state.compare.seed = compare.seed;
    // An older page kept up to four names as `selected` and the ceiling presets; the first two names become the pair.
    const pair = Array.isArray(compare.pair) ? compare.pair : compare.selected;
    if (Array.isArray(pair)) state.compare.pair = pair.filter((name) => typeof name === "string").slice(0, 2);
    // An older page's strategy variant, claim ages and Compare chip are ignored: Compare runs two configs only.
  }

  const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

  // Forget the saved draft and use the example household; returns the notice to show.
  function discardDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (error) { /* storage blocked: nothing to remove */ }
    state.inputs = clone(state.defaults);
    state.base = clone(state.defaults);
    state.scenarioName = EXAMPLE_NAME;
    state.seed = state.info.defaultSeed;
    return "Saved settings could not be read; defaults loaded.";
  }

  // Whether a current-version draft has the settings' shape: every top-level field of the example household, each
  // a list, an object or a value where the example has one (null stands for an unset optional part).
  function sameShape(example, inputs) {
    const kind = (value) => (Array.isArray(value) ? "list" : value === null ? "null" : typeof value);
    const keys = Object.keys(example);
    return keys.length === Object.keys(inputs).length && keys.every((key) => key in inputs
      && (example[key] === null || inputs[key] === null || kind(example[key]) === kind(inputs[key])));
  }

  function readDraft() {
    let text = null;
    try { text = localStorage.getItem(DRAFT_KEY); } catch (error) { return { draft: null, unreadable: false }; }
    if (text == null) return { draft: null, unreadable: false };
    try { return { draft: JSON.parse(text), unreadable: false }; } catch (error) { return { draft: null, unreadable: true }; }
  }

  // Bring back the draft saved on this device. A draft that is not JSON or not a settings object, one from an older
  // version that wmti cannot upgrade, or a current one without the settings' shape is discarded. A current draft
  // with a value that fails a check is kept, so an edit in progress survives a reload and its message shows as usual.
  // An upgraded draft is saved again at once in the current format.
  async function restoreDraft() {
    const { draft, unreadable } = readDraft();
    state.inputs = clone(state.defaults);
    state.base = clone(state.defaults);
    if (unreadable) return discardDraft();
    if (draft == null) return null;
    if (!isObject(draft) || !isObject(draft.inputs)) return discardDraft();
    let inputs = draft.inputs;
    const upgraded = inputs.schemaVersion !== state.info.inputsSchemaVersion;
    if (upgraded) {
      const reply = await ask("importScenario", [JSON.stringify(inputs)]);
      if (!reply || !reply.ok) return discardDraft();
      inputs = reply.inputs;
    } else if (!sameShape(state.defaults, inputs)) {
      return discardDraft();
    }
    state.inputs = inputs;
    state.base = isObject(draft.base) && draft.base.schemaVersion === state.info.inputsSchemaVersion ? draft.base
      : clone(inputs);
    state.scenarioName = typeof draft.scenarioName === "string" && draft.scenarioName ? draft.scenarioName : EXAMPLE_NAME;
    if (Number.isInteger(draft.seed)) state.seed = draft.seed;
    if (upgraded) saveDraft();
    return null;
  }

  // ---- Running the model ----
  let runTimer = null;
  let singleBusy = true;  // a single run is waiting or running; the automatic Monte Carlo waits for it

  function setStatus(kind, text) {
    $("status").dataset.state = kind;
    $("statusText").textContent = text;
  }

  function filingTable(status) {
    return status === "SEPARATE" || status === "MFS" ? "MFS"
      : status === "JOINT" || status === "MFJ" ? "JOINT" : "SINGLE";
  }

  function normalizeFilingTableChoices() {
    if (!state.schema || !state.inputs || !state.inputs.strategies) return;
    const conversion = state.inputs.strategies.rothConversion;
    if (!conversion) return;
    const table = filingTable(state.inputs.filingStatus);
    for (const field of state.schema.types.RothConversionPlan || []) {
      if (!field.choicesByFilingTable) continue;
      const choices = field.choicesByFilingTable[table] || [];
      if (conversion[field.name] != null && !choices.includes(conversion[field.name])) conversion[field.name] = null;
    }
  }

  function inputsChanged() {
    normalizeFilingTableChoices();
    if (state.schema) syncResetFlags(state.schema, state.inputs);
    saveDraft();
    state.savedJustNow = false;
    scheduleSettle();
    renderLoaded();
    const summaryCard = $("expenseSummary");
    if (summaryCard) fillExpenseSummary(summaryCard);
    clearTimeout(runTimer);
    setStatus("busy", "Updating");
    $("app").classList.add("stale");
    singleBusy = true;
    mcKeyChanged();
    runTimer = setTimeout(runNow, RUN_DELAY_MS);
  }

  async function runNow() {
    const inputsText = JSON.stringify(state.inputs);
    setStatus("busy", "Updating");
    let reply;
    try {
      reply = await engine.call("runSingle", [inputsText, state.seed, JSON.stringify(state.base)], "run");
    } catch (error) {
      reply = { value: { ok: false, error: String(error.message || error) } };
    }
    if (!reply || inputsText !== JSON.stringify(state.inputs)) return;  // a newer edit has its own run coming
    singleBusy = false;
    if (reply.value.ok) {
      state.result = reply.value;
      state.error = null;
      state.lastRunMs = reply.ms;
      setStatus("ok", "Up to date");
      $("app").classList.remove("stale");
    } else {
      state.error = reply.value.error;
      setStatus("error", "Check settings");
    }
    requestNotes();
    requestBenefits();
    requestEarnings();
    requestDeposits();
    renderPinned();
    renderMcBar();
    renderResults();
    renderPlots();
    renderSettingsError();
    renderAbout();
    renderLoaded();
    if (compareShown()) refreshCompare();
    scheduleMc();
  }

  // ---- Tabs, the Outputs switch and chips ----
  function compareShown() {
    return state.tab === "outputs" && state.view === "compare";
  }

  // The key a scroll position is kept under: the tab, and for Outputs its view too.
  function scrollKey() {
    return state.tab === "outputs" ? "outputs/" + state.view : state.tab;
  }

  // Show the current tab and view: panels and sub-panels hidden or shown, tab roles and roving tabindex set.
  function showPlace() {
    for (const name of TABS) {
      $("panel-" + name).hidden = name !== state.tab;
      $("tab-" + name).setAttribute("aria-selected", String(name === state.tab));
      $("tab-" + name).tabIndex = name === state.tab ? 0 : -1;
    }
    for (const name of VIEWS) {
      $("view-" + name).hidden = name !== state.view;
      $("sub-" + name).setAttribute("aria-selected", String(name === state.view));
      $("sub-" + name).tabIndex = name === state.view ? 0 : -1;
    }
    $("mc-bar").hidden = state.view === "compare";
    for (const element of document.querySelectorAll(".band [data-place]")) {
      element.hidden = element.dataset.place !== scrollKey() && element.dataset.place !== state.tab;
    }
    for (const row of document.querySelectorAll(".band .chips")) trackChips(row);
    renderBand();
    placeBand();
    if (state.tab === "inputs") { requestNotes(); requestBenefits(); requestEarnings(); requestDeposits(); }
    if (state.tab === "outputs" && state.view === "summary") requestNotes();
    if (compareShown()) refreshCompare();
  }

  // Move to a place (tab and view) and back to its saved scroll; a tap on the place already shown scrolls it to the
  // top. `remember` false (start-up) only shows the place.
  function goTo(tab, view, remember) {
    if (remember === false) {
      state.tab = tab;
      state.view = view;
      showPlace();
      return;
    }
    if (tab === state.tab && view === state.view) { window.scrollTo(0, 0); return; }
    state.scroll[scrollKey()] = window.scrollY;
    state.tab = tab;
    state.view = view;
    showPlace();
    savePrefs();
    window.scrollTo(0, state.scroll[scrollKey()] || 0);
  }

  function selectTab(tab, remember) {
    goTo(tab, state.view, remember);
  }

  function selectView(view, remember) {
    goTo("outputs", view, remember);
  }

  // Arrow keys, Home and End move between the tabs of a tab list and select the one reached.
  function wireTabKeys(list, selector, select) {
    list.addEventListener("keydown", (event) => {
      const items = [...list.querySelectorAll(selector)];
      const at = items.indexOf(document.activeElement);
      if (at < 0) return;
      const moves = { ArrowRight: (at + 1) % items.length, ArrowLeft: (at - 1 + items.length) % items.length,
        Home: 0, End: items.length - 1 };
      if (!(event.key in moves)) return;
      event.preventDefault();
      const next = items[moves[event.key]];
      next.focus();
      select(next);
    });
  }

  // The on-screen keyboard: hide the bottom bar while a text field outside the sheet has focus.
  // Enter (a phone keyboard's Enter, Go or Done) on a one-line input ends the edit: the input loses focus, which commits
  // its value and closes the keyboard. On key up, so a form's Enter (the walkthrough's Next) or an input's own Enter
  // handler acts first; an input that is no longer focused is left alone. A textarea keeps Enter for new lines.
  function enterEndsEdit(event) {
    const target = event.target;
    if (event.key !== "Enter" || event.isComposing || !target || target.tagName !== "INPUT") return;
    if (["checkbox", "radio", "button", "submit", "reset", "file", "range"].includes(target.type)) return;
    if (document.activeElement === target) target.blur();
  }

  function isTyping(element) {
    if (!element || element.closest("#sheet")) return false;
    if (element.tagName === "TEXTAREA") return true;
    return element.tagName === "INPUT" && !["range", "checkbox", "radio", "file", "button", "submit", "reset"]
      .includes(element.type);
  }

  function iconSvg(name, className) {
    return "<svg class=\"" + className + "\" viewBox=\"0 0 24 24\" aria-hidden=\"true\">" + ICONS[name] + "</svg>";
  }

  function iconFor(id, label) {
    for (const text of [label.toLowerCase(), id.toLowerCase()]) {
      const found = ICON_WORDS.find(([word]) => text.includes(word));
      if (found) return found[1];
    }
    return "sliders";
  }

  // The bar under a chips row: its thumb shows how much of the row is in view and where; hidden when it all fits.
  function trackChips(row) {
    const track = row.parentElement.querySelector(".chips-track");
    if (!track) return;
    const update = () => {
      const over = row.scrollWidth > row.clientWidth + 1;
      track.classList.toggle("chips-track-off", !over);
      if (!over) return;
      const thumb = track.firstElementChild;
      thumb.style.width = (row.clientWidth / row.scrollWidth) * 100 + "%";
      thumb.style.transform = "translateX(" + (row.scrollLeft / row.clientWidth) * 100 + "%)";
    };
    if (!row.dataset.tracked) {
      row.dataset.tracked = "true";
      row.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
    }
    update();
  }

  function renderChips(containerId, items, selected, onSelect) {
    const container = $(containerId);
    container.replaceChildren(...items.map((item) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.setAttribute("role", "tab");
      chip.setAttribute("aria-selected", String(item.id === selected));
      chip.innerHTML = iconSvg(iconFor(item.id, item.label), "chip-icon");
      chip.append(item.label);
      if (item.soon) {
        const soon = document.createElement("span");
        soon.className = "soon";
        soon.textContent = "soon";
        chip.append(soon);
      }
      chip.addEventListener("click", () => onSelect(item.id));
      return chip;
    }));
    trackChips(container);
  }

  // The header band: the section label, the title (the selected settings group on Inputs) and the subtitle.
  function renderBand() {
    const [label, title, sub] = PLACE_TEXT[scrollKey()];
    const chip = document.querySelector("#chips-settings .chip[aria-selected=true]");
    $("bandLabel").textContent = label;
    $("bandTitle").textContent = title || (chip ? chip.textContent : label);
    $("bandSub").textContent = sub;
  }

  // ---- Inputs' pinned tabs: the settings-group chips stay under the top bar while the page scrolls ----
  // Pinned (the default), the band sticks with only its chips row showing below the top bar; unpinned, it scrolls
  // away as on Outputs. The pin button at the row's right end switches it; the choice is kept on this device.
  const TABS_PIN_KEY = "wmti.tabsPin.v1";
  const tabsPin = { on: true };

  function wireTabsPin() {
    try { tabsPin.on = localStorage.getItem(TABS_PIN_KEY) !== "off"; } catch (error) { /* storage blocked: pinned */ }
    markTabsPin();
    $("chipsPin").addEventListener("click", () => {
      tabsPin.on = !tabsPin.on;
      try { localStorage.setItem(TABS_PIN_KEY, tabsPin.on ? "on" : "off"); } catch (error) { /* storage blocked */ }
      markTabsPin();
      placeBand();
    });
    const band = document.querySelector(".band");
    if (window.ResizeObserver) {
      const watch = new ResizeObserver(() => placeBand());
      watch.observe(band);
      watch.observe(document.querySelector(".topbar"));
    }
    window.addEventListener("resize", placeBand);
  }

  function markTabsPin() {
    const button = $("chipsPin");
    button.setAttribute("aria-pressed", String(tabsPin.on));
    button.setAttribute("aria-label", tabsPin.on ? "Unpin tabs" : "Pin tabs");
  }

  // Stick the band on Inputs while pinned: its top sits above the top bar's bottom by the height of everything over
  // the chips row (title and subtitle), less a small margin, so only the chips show once the page scrolls.
  function placeBand() {
    const on = state.tab === "inputs" && tabsPin.on;
    $("app").classList.toggle("inputs-pinned", on);
    if (!on) return;
    const band = document.querySelector(".band");
    const wrap = band.querySelector(".chips-wrap[data-place=\"inputs\"]");
    const above = Math.max(0, wrap.getBoundingClientRect().top - band.getBoundingClientRect().top - 8);
    band.style.setProperty("--band-stick", (document.querySelector(".topbar").offsetHeight - above) + "px");
  }

  // ---- Menu and color scheme ----
  function currentScheme() {
    const scheme = document.documentElement.getAttribute("data-theme");
    return SCHEMES.includes(scheme) ? scheme : "lagoon";
  }

  function markScheme() {
    for (const button of document.querySelectorAll(".scheme")) {
      button.setAttribute("aria-checked", String(button.dataset.scheme === currentScheme()));
    }
  }

  // Apply a scheme at once (charts draw in the page's color tokens, so they follow) and keep it on this device.
  function setScheme(scheme) {
    document.documentElement.setAttribute("data-theme", scheme);
    try { localStorage.setItem(THEME_KEY, scheme); } catch (error) { /* storage blocked: this visit only */ }
    markScheme();
  }

  function openMenu() {
    markScheme();
    $("menuWalkText").textContent = walk.saved && walk.saved.status === "paused" ? "Continue the walkthrough..."
      : "Walk me through it...";
    $("menu").hidden = false;
    $("menuBackdrop").hidden = false;
    $("menuButton").setAttribute("aria-expanded", "true");
    $("menu").querySelector(".menu-item").focus();
  }

  function closeMenu() {
    if ($("menu").hidden) return;
    $("menu").hidden = true;
    $("menuBackdrop").hidden = true;
    $("menuButton").setAttribute("aria-expanded", "false");
    $("menuButton").focus();
  }

  function renderAll() {
    renderPinned();
    renderMcBar();
    renderResults();
    renderPlots();
    renderSettings();
    renderCompare();
    renderSaved();
    renderAbout();
    renderLoaded();
  }

  // ---- Setup: the open scenario card, the seed and runs, and the Inflation card (the inflation adjusted switch and
  // the inflation range) ----
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  // The saved copy of a scenario: its entry on this device, or the example household for the example's name (unless
  // it was deleted from Other scenarios while another scenario was open).
  function savedCopy(name) {
    if (hasOwn(state.scenarios, name)) return state.scenarios[name];
    return name === EXAMPLE_NAME && (!state.exampleHidden || name === state.scenarioName) ? state.defaults : null;
  }

  // Whether the open scenario differs from its saved copy, or has none yet.
  function hasUnsavedChanges() {
    const copy = savedCopy(state.scenarioName);
    return !copy || !sameValue(copy, state.inputs);
  }

  function renderLoaded() {
    renderExampleBanner();
    renderOpenCard();
  }

  // The open scenario card: its name, whether it is saved, the Auto-save switch (Save shows only while it is off),
  // and the top bar's Undo, greyed out when there is nothing to undo.
  function renderOpenCard() {
    if (!state.inputs) return;
    const unsaved = hasUnsavedChanges();
    $("loadedName").textContent = state.scenarioName;
    $("saveStatus").textContent = state.autoSave ? "Saved automatically" : unsaved ? "Unsaved changes"
      : state.savedJustNow ? "Saved just now" : "Saved";
    $("dirtyDot").hidden = state.autoSave || !unsaved;
    $("autoSave").setAttribute("aria-checked", String(state.autoSave));
    $("saveButton").hidden = state.autoSave;
    $("undoButton").disabled = !state.undo.stack.length;
  }

  function renderRunCard() {
    const rootFields = state.schema.types[state.schema.root];
    $("run-body").replaceChildren(seedField(), runsField());
    $("inflation-body").replaceChildren(...INFLATION_CARD_FIELDS.map((name) =>
      fieldElement(rootFields.find((item) => item.name === name), name)));
  }

  // The Monte Carlo's number of runs: a segmented choice under the seed, kept in the prefs.
  function runsField() {
    const help = "Runs of the Monte Carlo behind every output, and of each config in Compare. About "
      + secondsText((state.perRunMs || state.lastRunMs || DEFAULT_RUN_MS) * state.info.monteCarlo.choices[0])
      + " on this device for " + state.info.monteCarlo.choices[0] + " runs. The Monte Carlo reruns on its own after every change.";
    const wrap = fieldShell("Runs", help, null);
    const group = document.createElement("div");
    group.className = "segmented";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Runs");
    group.id = "f-runs";
    for (const choice of state.info.monteCarlo.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.runs = String(choice);
      button.textContent = String(choice);
      button.setAttribute("aria-pressed", String(choice === state.mc.runs));
      button.addEventListener("click", () => {
        state.mc.runs = choice;
        for (const other of group.querySelectorAll("button")) {
          other.setAttribute("aria-pressed", String(other === button));
        }
        savePrefs();
        mcKeyChanged();
        scheduleMc();
        renderPinned();
        renderMcBar();
        renderResults();
        renderPlots();
      });
      group.append(button);
    }
    wrap.append(group);
    return wrap;
  }

  function dollarsText(dollars) {
    return dollars === "future" ? "Inflation adjusted" : "Today's value";
  }

  // The pinned strip: the median final worth of the last Monte Carlo ("Updating" before one, marked when stale) with
  // its median after terminal tax under it, then the two single-run headlines (net earnings or withdrawal, annual expense).
  function renderPinned() {
    const pinned = $("pinned");
    if (!state.result || needsSetup(state.inputs)) { pinned.replaceChildren(); return; }
    const { entry, stale } = latestMonteCarlo();
    const headline = (label) => (entry ? entry.value.headlines.find((item) => item.label === label) : null);
    const median = headline("Median final worth");
    const afterTax = headline(AFTER_TAX_LABEL);
    const stalePin = entry && stale ? " stale-results" : "";
    const pin = (label, value, extra) => "<div class=\"pin" + extra + "\"><span class=\"pin-label\">" + escapeText(label)
      + "</span><span class=\"pin-value\">" + escapeText(value) + "</span></div>";
    pinned.innerHTML = pin("Median final worth", median ? compactMoney(median.value) : "Updating", stalePin)
      + pin("After tax", afterTax ? compactMoney(afterTax.value) : "Updating", stalePin)
      + state.result.headlines.slice(0, 2).map((headline) => pin(headline.label, compactMoney(headline.value), "")).join("");
  }

  function errorBanner(error) {
    return "<div class=\"banner banner-error\" role=\"alert\"><strong>Settings need a fix.</strong> "
      + escapeText(error) + " The figures below are from the last valid settings.</div>";
  }

  // A value tile: its label (with an "i" beside it when the headline has a note), the value, the range or change
  // lines, and the note hidden until the "i" is tapped (one click handler in wire()).
  function tileHtml(headline, first, stale) {
    const helpId = headline.help ? newHelpId() : null;
    const label = "<span class=\"tile-label\">" + escapeText(headline.label) + "</span>";
    return "<div class=\"tile" + (first ? " tile-first" : "") + (stale ? " stale-results" : "") + "\">"
      + (helpId ? "<div class=\"tile-head\">" + label + helpButtonHtml(headline.label, helpId) + "</div>" : label)
      + "<span class=\"tile-value\">"
      + escapeText(headline.unit === "percent" ? percent(headline.value, 1) : fullMoney(headline.value)) + "</span>"
      + (headline.range ? "<span class=\"tile-change\">Middle half of the runs: " + escapeText(fullMoney(headline.range[0]))
        + " to " + escapeText(fullMoney(headline.range[1])) + "</span>" : "")
      + (headline.change ? "<span class=\"tile-change\">" + escapeText(headline.change) + " from "
        + escapeText(state.scenarioName) + "</span>" : "")
      + (helpId ? helpTextHtml(helpId, headline.help, "tile-help") : "") + "</div>";
  }

  // A read-only table card of the last Monte Carlo, marked when it is stale.
  function tableCard(title, help, frame, options, stale, dollars) {
    const about = titleHelp("h2", title, help);
    return "<div class=\"card" + (stale ? " stale-results" : "") + "\"><div class=\"card-head\">" + about.head
      + "<span class=\"chart-note\">" + escapeText(dollarsText(dollars)) + "</span></div>"
      + about.text + charts.renderFrame(frame, Object.assign({ title }, options)) + "</div>";
  }

  // Summary: Summary (tiles, percentiles, the middle half average summary table), Accounts and Deductions, all from the last
  // Monte Carlo; the single-run headline tiles follow the Monte Carlo ones.
  function renderResults() {
    const chip = RESULT_VIEWS.some((view) => view.id === state.chips.results) ? state.chips.results : "summary";
    renderChips("chips-results", RESULT_VIEWS, chip, (id) => {
      state.chips.results = id; savePrefs(); renderResults();
    });
    renderTerminalRate(chip === "summary");
    $("summary-warnings").hidden = chip !== "summary";  // the Medicare warning, as on the desktop Summary
    const body = $("results-body");
    if (needsSetup(state.inputs)) { body.innerHTML = FINISH_SETUP_HTML; return; }
    let html = state.error ? errorBanner(state.error) : "";
    const { entry, stale } = latestMonteCarlo();
    if (!entry) {
      body.innerHTML = html + "<div class=\"card empty-state\">No Monte Carlo yet. It starts on its own.</div>";
      return;
    }
    const result = entry.value;
    const tables = result.tables;
    if (chip === "summary") {
      html += "<div class=\"result-meta\"><span>" + result.runs + " runs</span><span>Seed " + escapeText(result.seed)
        + "</span><span>" + escapeText(dollarsText(result.dollars)) + "</span></div><div class=\"tiles\">"
        + result.headlines.map((headline, position) => tileHtml(headline, position === 0, stale)).join("")
        + (state.result ? state.result.headlines.map((headline) => tileHtml(headline, false, false)).join("") : "")
        + "</div>" + (tables.shortfallNote ? "<p class=\"note shortfall-note\">" + escapeText(tables.shortfallNote) + "</p>" : "");
      html += "<div class=\"card" + (stale ? " stale-results" : "") + "\"><div class=\"card-head\"><h2>Final worth by "
        + "percentile</h2><span class=\"chart-note\">" + escapeText(dollarsText(result.dollars)) + "</span></div>"
        + charts.renderUnitsTable(result.percentiles, ["ordinal", "money"], { title: "Final worth by percentile" })
        + "</div>";
      html += tableCard("Summary table", AVERAGE_HELP, tables.summary, { indexLabel: "Row", columnHelp: tables.columnHelp },
        stale, tables.dollars);
    } else if (chip === "accounts") {
      html += tableCard("Accounts table", AVERAGE_HELP, tables.accounts, { indexLabel: "Row" }, stale, tables.dollars);
    } else {
      html += tableCard("Deductions by year", DEDUCTIONS_HELP, tables.deductions, { indexLabel: "Your age" }, stale, tables.dollars);
    }
    body.innerHTML = html;
  }

  // What Summary and Plots show while a new scenario has no age yet (needsSetup): no result, nothing alarming.
  const FINISH_SETUP_HTML = "<div class=\"card empty-state finish-setup\"><strong>Finish setup to see results.</strong> "
    + "Fill in your age and the rest under Inputs, or open Walk me through it from the menu.</div>";

  const AVERAGE_HELP = "Each number is the middle half average for that year: the mean of the Monte Carlo runs whose "
    + "final worth lies between the 25th and 75th percentile, so the best and worst cases are left out (runs that ran "
    + "out count when they fall in it). Deduction type is the most common value among those runs that year.";
  const DEDUCTIONS_HELP = "Read-only: the federal deductions taken each year, the middle half average of the runs. Itemized parts "
    + "are before the high-income reduction; Itemized is after it. Deduction is the standard or itemized deduction "
    + "taken plus the senior deduction. Dependents counts the children claimed; only the state exemption uses it.";

  function listHtml(items) {
    return "<ul class=\"notes\">" + items.map((item) => "<li>" + escapeText(item) + "</li>").join("") + "</ul>";
  }

  // ---- Monte Carlo: runs on its own after every change (and on Run), in batches, with progress and cancel;
  // results kept per inputs ----
  let mcTimer = null;

  function mcKey() {
    return JSON.stringify([state.inputs, state.mc.runs, state.seed]);
  }

  // The settings, runs or seed changed: a running Monte Carlo for the old ones is cancelled without a message.
  function mcKeyChanged() {
    clearTimeout(mcTimer);
    mcTimer = null;
    const job = state.mc.job;
    if (job && !job.silent && job.key !== mcKey()) {
      job.silent = true;
      engine.cancel(job.id);
    }
  }

  // Start the automatic Monte Carlo after a pause (the single run has finished by then).
  function scheduleMc() {
    clearTimeout(mcTimer);
    mcTimer = setTimeout(autoMc, MC_DELAY_MS);
  }

  // Run the Monte Carlo on its own when the current settings, runs and seed have no result yet. It waits for a
  // single run, a running Monte Carlo or comparison, and does not run on settings that need a fix, or again on
  // settings whose run failed or was cancelled. `window.WMTI_NO_AUTO_MC` (set by the tests) turns it off.
  function autoMc() {
    clearTimeout(mcTimer);
    mcTimer = null;
    const mc = state.mc;
    if (window.WMTI_NO_AUTO_MC || walk.open || !state.info || singleBusy || state.error || mc.job
      || state.compare.job || needsSetup(state.inputs)) return;
    const key = mcKey();
    if (cachedResult(mc.cache, key) || key === mc.skipKey) return;
    runMonteCarlo(true);
  }

  function cachedResult(list, key) {
    return list.find((item) => item.key === key) || null;
  }

  function rememberResult(list, entry) {
    return [entry].concat(list.filter((item) => item.key !== entry.key)).slice(0, CACHED_RESULTS);
  }

  function secondsText(ms) {
    const seconds = ms / 1000;
    return seconds < 10 ? seconds.toFixed(1) + " s" : Math.round(seconds) + " s";
  }

  function estimateText(runs) {
    const perRun = state.perRunMs || state.lastRunMs || DEFAULT_RUN_MS;
    return "about " + secondsText(perRun * runs) + " on this device";
  }

  // A card's own seed box beside the number of runs it uses, the one Runs setting under Setup.
  function seedControl(prefix, seed) {
    return "<div class=\"run-controls\"><p class=\"muted\" id=\"" + prefix + "Runs\">" + state.mc.runs
      + " runs per config, set by Runs under Setup</p><div><label class=\"field-label\" "
      + "for=\"" + prefix + "Seed\">Seed</label><input class=\"input\" id=\"" + prefix + "Seed\" type=\"text\" "
      + "inputmode=\"numeric\" autocomplete=\"off\" value=\"" + escapeText(seed) + "\"></div></div>";
  }

  function wireSeedControl(holder, prefix, onSeed) {
    const seed = holder.querySelector("#" + prefix + "Seed");
    seed.addEventListener("input", () => {
      const ok = /^-?\d+$/.test(seed.value.trim());
      seed.setAttribute("aria-invalid", String(!ok));
      if (ok) onSeed(Number(seed.value.trim()));
    });
  }

  function progressHtml(prefix, job) {
    return "<div class=\"run-progress\" id=\"" + prefix + "Progress\"" + (job ? "" : " hidden") + "><div class=\"progress\" "
      + "role=\"progressbar\" aria-label=\"Runs done\" aria-valuemin=\"0\" id=\"" + prefix + "Bar\"><span></span></div>"
      + "<div class=\"run-row\"><span class=\"progress-text\" id=\"" + prefix + "ProgressText\">Starting</span>"
      + "<button type=\"button\" class=\"button button-quiet\" id=\"" + prefix + "Cancel\">Cancel</button></div></div>";
  }

  // Move a progress bar in place (no redraw), so the Cancel button keeps focus while the runs go on.
  function showProgress(prefix, job) {
    const bar = $(prefix + "Bar");
    if (!bar || !job) return;
    const share = job.total ? job.done / job.total : 0;
    bar.querySelector("span").style.width = share * 100 + "%";
    bar.setAttribute("aria-valuemax", String(job.total || 0));
    bar.setAttribute("aria-valuenow", String(job.done));
    const left = job.done && job.ms ? " · about " + secondsText((job.ms / job.done) * (job.total - job.done)) + " left" : "";
    $(prefix + "ProgressText").textContent = (job.scenario ? job.scenario + ": " : "") + "run " + job.done + " of "
      + job.total + left;
  }

  function messageHtml(message) {
    if (!message) return "";
    return "<p class=\"banner" + (message.error ? " banner-error" : "") + "\" role=\"status\">" + escapeText(message.text)
      + "</p>";
  }

  // The newest finished Monte Carlo and whether the inputs, runs or seed changed since it ran.
  function latestMonteCarlo() {
    const current = cachedResult(state.mc.cache, mcKey());
    const entry = current || state.mc.cache[0] || null;
    return { entry, stale: Boolean(entry) && !current };
  }

  // The run bar above Summary and Plots: Run (or Run again), the estimate, progress with Cancel and the last message.
  function renderMcBar() {
    const bar = $("mc-bar");
    if (!bar || !state.info) return;
    const mc = state.mc;
    const { entry, stale } = latestMonteCarlo();
    const label = entry && !stale ? "Run again" : "Run " + mc.runs + " runs";
    const why = state.error ? "It updates on its own once the settings are fixed" : "It updates on its own";
    bar.innerHTML = "<div class=\"run-row\"><button type=\"button\" class=\"button\" id=\"mcRun\""
      + (mc.job ? " disabled" : "") + ">" + label + "</button><span class=\"muted\">"
      + escapeText(estimateText(mc.runs)) + "</span></div>" + progressHtml("mc", mc.job) + messageHtml(mc.message)
      + (stale && !mc.job ? "<p class=\"banner banner-warn\" role=\"note\">Settings, runs or seed changed since the "
        + "last Monte Carlo. " + why + "; the dimmed outputs below are from the earlier run.</p>" : "");
    $("mcRun").addEventListener("click", () => runMonteCarlo(false));
    $("mcCancel").addEventListener("click", () => { if (mc.job) engine.cancel(mc.job.id); });
    showProgress("mc", mc.job);
  }

  // Run the Monte Carlo: `auto` when it started on its own (Cancel then leaves the focus where it was).
  async function runMonteCarlo(auto) {
    const mc = state.mc;
    if (mc.job) return;
    clearTimeout(mcTimer);
    mcTimer = null;
    const key = mcKey();
    const job = engine.job("monteCarlo", [JSON.stringify(state.inputs), mc.runs, state.seed], null, (message) => {
      Object.assign(mc.job, { done: message.done, total: message.total, ms: message.ms });
      showProgress("mc", mc.job);
    });
    mc.job = { id: job.id, done: 0, total: mc.runs, ms: 0, key, silent: false };
    mc.message = null;
    renderPinned();
    renderMcBar();
    if (!auto && $("mcCancel")) $("mcCancel").focus();
    let reply = null;
    let failure = null;
    try {
      reply = await job.promise;
    } catch (error) {
      failure = String(error.message || error);
    }
    const { done, silent } = mc.job;
    mc.job = null;
    if (failure || (!reply && !silent) || (reply && !reply.value.ok)) mc.skipKey = key;  // not again on its own
    if (failure) mc.message = { error: true, text: failure };
    else if (!reply && silent) mc.message = null;  // replaced by newer settings or a comparison: no message
    else if (!reply) mc.message = { text: "Cancelled after " + done + " of " + mc.runs + " runs. Nothing was kept from "
      + "the cancelled runs" + (mc.cache.length ? "; the last finished result stays." : ".") };
    else if (!reply.value.ok) mc.message = { error: true, text: reply.value.error };
    else {
      mc.cache = rememberResult(mc.cache, { key, value: reply.value, ms: reply.ms });
      state.perRunMs = reply.ms / reply.value.runs;
    }
    renderPinned();
    renderMcBar();
    renderResults();
    renderPlots();
    renderAbout();
    if (!mcTimer) autoMc();  // the settings may have changed while it ran
  }

  // ---- Compare: two configs (saved, the current settings or the example household) on the same draws ----
  function savedNames() {
    return Object.keys(state.scenarios).sort((left, right) => left.localeCompare(right));
  }

  function compareOptions() {
    return [state.info.compare.currentName, state.info.compare.defaultName].concat(savedNames());
  }

  // Config A and Config B: two different names on offer (a deleted scenario is replaced by another option).
  function selectedScenarios() {
    return normalPair(compareOptions(), state.compare.pair);
  }

  function compareRequest() {
    const selected = selectedScenarios().filter((name) => name != null);
    const saved = Object.create(null);
    for (const name of selected) if (state.scenarios[name]) saved[name] = state.scenarios[name];
    return { source: "saved", selected, saved };
  }

  function compareKey() {
    return JSON.stringify([state.inputs, compareRequest(), state.mc.runs, state.compare.seed, state.seed]);
  }

  // When Compare is shown: draw it and check the selection.
  function refreshCompare() {
    renderCompare();
  }

  async function checkCompare() {
    const requestText = JSON.stringify(compareRequest());
    const inputsText = JSON.stringify(state.inputs);
    let reply = null;
    try {
      reply = await engine.call("compareVariants", [inputsText, requestText], "compareCheck");
    } catch (error) {
      reply = { value: { ok: false, error: String(error.message || error) } };
    }
    if (!reply || requestText !== JSON.stringify(compareRequest()) || inputsText !== JSON.stringify(state.inputs)) return;
    state.compare.check = reply.value;
    showCompareCheck();
  }

  // The selection's verdict under the Run button: the two names that would run, the time, the warnings.
  function showCompareCheck() {
    const holder = $("compareCheck");
    const button = $("compareRun");
    if (!holder || !button) return;
    const compare = state.compare;
    const check = compare.check;
    const current = cachedResult(compare.cache, compareKey());
    if (!check) { holder.innerHTML = "<p class=\"muted\">Checking the selection</p>"; button.disabled = true; return; }
    button.disabled = !check.ok || Boolean(compare.job);
    if (!check.ok) {
      holder.innerHTML = "<p class=\"banner banner-warn\" role=\"note\">" + escapeText(check.error) + "</p>";
      return;
    }
    button.textContent = current ? "Run again" : "Run comparison";
    let html = "<p class=\"muted\">" + escapeText(check.names.join(" against ")) + ": " + state.mc.runs
      + " runs each, " + escapeText(estimateText(check.names.length * state.mc.runs)) + ".</p>";
    if (!current) html += check.warnings.map((warning) => "<p class=\"banner banner-warn\" role=\"note\">" + escapeText(warning)
      + "</p>").join("");
    holder.innerHTML = html;
  }

  function renderCompare() {
    if (!state.info) return;
    const compare = state.compare;
    const body = $("compare-body");
    const info = state.info.compare;
    const intro = document.createElement("div");
    intro.className = "card";
    intro.id = "compareCard";
    const about = titleHelp("h2", "Saved scenarios", COMPARE_HELP);
    let html = (state.error ? errorBanner(state.error) : "") + "<div class=\"card-head\">" + about.head
      + "<span class=\"phone-note\">" + info.compared + " × " + state.mc.runs + " runs</span></div>" + about.text;
    html += pairSelects();
    html += seedControl("compare", compare.seed)
      + "<div class=\"run-row\"><button type=\"button\" class=\"button\" id=\"compareRun\" disabled>Run comparison"
      + "</button></div><div id=\"compareCheck\"></div>" + progressHtml("compare", compare.job)
      + messageHtml(compare.message);
    intro.innerHTML = html;
    body.replaceChildren(intro);
    wireCompare(intro);
    showProgress("compare", compare.job);
    showCompareCheck();
    checkCompare();
    const current = cachedResult(compare.cache, compareKey());
    const shown = current || compare.cache[0] || null;
    if (shown) body.append(...compareResult(shown, !current));
    body.append(differencesCard());
    if (compareShown()) loadDiffs();
  }

  function selectHtml(id, label, options, chosen, attributes) {
    return "<label class=\"pair-field\" for=\"" + id + "\"><span class=\"field-label\">" + escapeText(label)
      + "</span><select class=\"input\" id=\"" + id + "\"" + (attributes || "") + ">" + options.map(([value, text]) =>
        "<option value=\"" + escapeText(value) + "\"" + (value === chosen ? " selected" : "") + ">" + escapeText(text)
        + "</option>").join("") + "</select></label>";
  }

  function pairSelects() {
    const info = state.info.compare;
    const [nameA, nameB] = selectedScenarios();
    const options = compareOptions().map((name) => [name, name + (name === info.currentName ? " (as edited now)"
      : name === info.defaultName ? " (example household)" : "")]);
    return "<div class=\"pair\">" + selectHtml("compareA", "Config A", options, nameA)
      + selectHtml("compareB", "Config B", options, nameB) + "</div>";
  }

  function wireCompare(card) {
    const compare = state.compare;
    const changed = () => { compare.armed = null; savePrefs(); showCompareCheck(); checkCompare(); };
    ["compareA", "compareB"].forEach((id, position) => {
      const select = card.querySelector("#" + id);
      if (!select) return;
      select.addEventListener("change", () => {
        const pair = selectedScenarios();
        pair[position] = select.value;
        compare.pair = normalPair(compareOptions(), pair);
        compare.check = null;
        compare.armed = null;
        savePrefs();
        renderCompare();
      });
    });
    wireSeedControl(card, "compare", (seed) => { compare.seed = seed; changed(); });
    card.querySelector("#compareRun").addEventListener("click", runCompare);
    card.querySelector("#compareCancel").addEventListener("click", () => { if (compare.job) engine.cancel(compare.job.id); });
  }

  async function runCompare() {
    const compare = state.compare;
    if (compare.job || !compare.check || !compare.check.ok) return;
    const key = compareKey();
    const total = compare.check.names.length * state.mc.runs;
    if (state.mc.job) state.mc.job.silent = true;  // the engine runs one batched job: the comparison replaces it
    const job = engine.job("compare", [JSON.stringify(state.inputs), JSON.stringify(compareRequest()), state.mc.runs,
      compare.seed, state.seed], null, (message) => {
      Object.assign(compare.job, { done: message.done, total: message.total, ms: message.ms, scenario: message.scenario });
      showProgress("compare", compare.job);
    });
    compare.job = { id: job.id, done: 0, total, ms: 0, scenario: null };
    compare.armed = null;
    renderCompare();
    $("compareCancel") && $("compareCancel").focus();
    let reply = null;
    let failure = null;
    try {
      reply = await job.promise;
    } catch (error) {
      failure = String(error.message || error);
    }
    const done = compare.job.done;
    compare.job = null;
    if (failure) compare.message = { error: true, text: failure };
    else if (!reply) compare.message = { text: "Cancelled after " + done + " of " + total + " runs. Nothing was kept from "
      + "the cancelled runs" + (compare.cache.length ? "; the last finished comparison stays below." : ".") };
    else if (!reply.value.ok) compare.message = { error: true, text: reply.value.error };
    else {
      compare.cache = rememberResult(compare.cache, { key, value: reply.value, ms: reply.ms });
      state.perRunMs = reply.ms / total;
    }
    renderCompare();
    renderAbout();
    scheduleMc();  // an automatic Monte Carlo waits for the comparison
  }

  function compareResult(entry, stale) {
    const result = entry.value;
    const top = document.createElement("div");
    top.className = "card" + (stale ? " stale-results" : "");
    top.innerHTML = (stale ? "<p class=\"banner banner-warn\" role=\"note\">The settings, selection, runs or seed "
      + "changed since this comparison. Press Run to update it; the figures below are from the earlier run.</p>" : "")
      + "<div class=\"card-head\"><h2>Comparison</h2><span class=\"chart-note\">" + result.runs + " runs each · seed "
      + escapeText(result.seed) + " · " + secondsText(entry.ms) + "</span></div>"
      + charts.renderUnitsTable(result.table, result.columnUnits, { title: "Comparison", wrapFirst: true })
      + "<p class=\"field-help\">" + escapeText(result.caption) + "</p>"
      + result.warnings.map((warning) => "<p class=\"banner banner-warn\" role=\"note\">" + escapeText(warning)
        + "</p>").join("");
    const parts = [top];
    const figures = [];
    for (const spec of result.charts) {
      const card = chartCard(spec, renderCompare);
      if (spec.type === "compareBands") {
        addChartHelp(card, spec.title, "Lines are the median run; shading is the 10th to 90th percentile.");
      }
      if (stale) card.classList.add("stale-results");
      figures.push([card.querySelector("figure"), spec]);
      parts.push(card);
    }
    requestAnimationFrame(() => figures.forEach(([figure, spec]) => figure && charts.attachChart(figure, spec)));
    return parts;
  }

  // The inputs a config name stands for, as stored now (no upgrade): the key the differences were found for.
  function storedConfig(name) {
    const info = state.info.compare;
    if (name === info.currentName) return state.inputs;
    if (name === info.defaultName) return state.defaults;
    return hasOwn(state.scenarios, name) ? state.scenarios[name] : null;
  }

  function diffKeyNow() {
    const [nameA, nameB] = selectedScenarios();
    return JSON.stringify([storedConfig(nameA), storedConfig(nameB), nameA, nameB]);
  }

  // Find the differences of the chosen pair (once per pair and settings), then redraw their card in place. A reply
  // for a pair or settings that changed while it was worked out is dropped.
  async function loadDiffs() {
    const compare = state.compare;
    const [nameA, nameB] = selectedScenarios();
    if (!nameA || !nameB || nameA === nameB) return;
    const configA = await configInputs(nameA);
    const configB = await configInputs(nameB);
    const key = diffKeyNow();
    if ((compare.diffs && compare.diffs.key === key) || compare.diffsPending === key) return;
    let value;
    if (!configA.ok || !configB.ok) value = { ok: false, error: (configA.ok ? configB : configA).error };
    else {
      compare.diffsPending = key;
      value = await ask("compareDifferences", [JSON.stringify(configA.inputs), JSON.stringify(configB.inputs), nameA,
        nameB]);
      if (compare.diffsPending === key) compare.diffsPending = null;
      if (!value) return;
    }
    if (key !== diffKeyNow()) return;
    compare.diffs = { key, value };
    const card = $("compareDifferences");
    if (card) card.replaceWith(differencesCard());
  }

  const MERGE_LABELS = { A: "Merge A with B", B: "Merge B with A" };  // A takes B's value; B takes A's

  // Settings that differ: the two names, the make-match buttons, Undo last merge, then one card per difference,
  // grouped by settings panel, each with its two merge buttons. Drawn without a finished comparison.
  function differencesCard() {
    const compare = state.compare;
    const card = document.createElement("details");
    card.className = "card disclosure";
    card.id = "compareDifferences";
    card.open = compare.differencesOpen;
    card.addEventListener("toggle", () => { compare.differencesOpen = card.open; });
    const [nameA, nameB] = selectedScenarios();
    const reply = compare.diffs && compare.diffs.key === diffKeyNow() ? compare.diffs.value : null;
    const differences = reply && reply.ok ? reply.differences : [];
    let html = "<summary>Settings that differ" + (reply && reply.ok ? " (" + differences.length + ")" : "")
      + "</summary><p class=\"pair-names\"><span><strong>A:</strong> " + escapeText(nameA)
      + "</span><span><strong>B:</strong> " + escapeText(nameB) + "</span></p>";
    if (!reply) html += "<p class=\"muted\">Finding the settings that differ…</p>";
    else if (!reply.ok) html += messageHtml({ error: true, text: reply.error });
    else {
      html += matchButtons([nameA, nameB], reply.problems);
      if (compare.mergeUndo.length) {
        html += "<div class=\"run-row\"><button type=\"button\" class=\"button button-quiet\" id=\"compareMergeUndo\">"
          + "Undo last merge (" + compare.mergeUndo.length + ")</button></div>";
      }
      if (!differences.length) html += "<p class=\"muted\">These configs have identical settings.</p>";
      // Why each side's buttons are off: "Merge A with B" changes A (problem of making A match B), and the reverse.
      const problems = { A: reply.problems[1], B: reply.problems[0] };
      let section = null;
      differences.forEach((difference, index) => {
        if (difference.section !== section) {
          section = difference.section;
          html += "<h3 class=\"diff-section\">" + escapeText(section) + "</h3>";
        }
        html += diffCardHtml(difference, index, problems);
      });
    }
    card.innerHTML = html;
    for (const button of card.querySelectorAll("[data-match]")) {
      button.addEventListener("click", () => makeMatch(Number(button.dataset.match), { names: [nameA, nameB] }));
    }
    for (const button of card.querySelectorAll("[data-merge]")) {
      button.addEventListener("click", () => mergeOne(button.dataset.merge, differences[Number(button.dataset.diff)].id));
    }
    const undo = card.querySelector("#compareMergeUndo");
    if (undo) undo.addEventListener("click", undoMerge);
    return card;
  }

  // One difference: its label, A's and B's value, the fields behind it, and the two merge buttons stacked.
  function diffCardHtml(difference, index, problems) {
    const lines = difference.lines.length ? "<details class=\"diff-lines\"><summary>Show fields</summary>"
      + "<div class=\"table-scroll\" tabindex=\"0\" role=\"region\" aria-label=\"" + escapeText(difference.label)
      + " fields\"><table class=\"data-table\"><thead><tr><th scope=\"col\">Field</th><th scope=\"col\">A</th>"
      + "<th scope=\"col\">B</th></tr></thead><tbody>" + difference.lines.map((line) => "<tr><th scope=\"row\">"
        + escapeText(line[0]) + "</th><td>" + escapeText(line[1]) + "</td><td>" + escapeText(line[2]) + "</td></tr>")
        .join("") + "</tbody></table></div></details>" : "";
    const buttons = ["A", "B"].map((side) => {
      const problem = problems[side];
      const why = "mergeWhy" + side + index;
      return "<div class=\"diff-merge\"><button type=\"button\" class=\"button button-quiet\" data-merge=\"" + side
        + "\" data-diff=\"" + index + "\" aria-describedby=\"" + why + "\"" + (problem ? " disabled" : "") + ">"
        + MERGE_LABELS[side] + "</button><p class=\"field-help\" id=\"" + why + "\">"
        + escapeText(problem || difference[side === "A" ? "toA" : "toB"]) + "</p></div>";
    }).join("");
    return "<section class=\"diff-card\"><p class=\"diff-label\">" + escapeText(difference.label) + "</p>"
      + "<p class=\"diff-values\"><span><strong>A:</strong> " + escapeText(difference.a) + "</span><span><strong>B:</strong> "
      + escapeText(difference.b) + "</span></p>" + lines + "<div class=\"diff-buttons\">" + buttons + "</div></section>";
  }

  // The settings a config name holds now, as JSON text, or null when it is gone.
  function configText(name) {
    const inputs = storedConfig(name);
    return inputs ? JSON.stringify(inputs) : null;
  }

  // Write a config's settings: the working settings for the current settings, else the scenario saved on this device.
  function writeConfig(name, inputs) {
    if (name === state.info.compare.currentName) {
      state.inputs = clone(inputs);  // the loaded scenario stays the base, so Outputs shows the settings as edited
      renderSettings();
      inputsChanged();
    } else {
      state.scenarios[name] = clone(inputs);
      storeScenarios();
      renderSaved();
    }
  }

  // Merge one difference at once: side "A" gives A the value of B, "B" gives B the value of A. The comparison is not
  // run again (it shows as changed); Undo last merge steps back through the last UNDO_LIMIT merges.
  async function mergeOne(side, diffId) {
    const compare = state.compare;
    if (compare.job) return;
    const [nameA, nameB] = selectedScenarios();
    const [target, source] = side === "A" ? [nameA, nameB] : [nameB, nameA];
    if (target === state.info.compare.defaultName) return;
    const targetConfig = await configInputs(target);
    const sourceConfig = await configInputs(source);
    const failed = !targetConfig.ok ? targetConfig : !sourceConfig.ok ? sourceConfig : null;
    const reply = failed ? null : await ask("mergeCompareDifference", [JSON.stringify(targetConfig.inputs),
      JSON.stringify(sourceConfig.inputs), diffId]);
    if (failed || !reply || !reply.ok) {
      compare.message = { error: true, text: failed ? failed.error : reply ? reply.error : "The merge did not answer; try again." };
      renderCompare();
      return;
    }
    const before = JSON.stringify(targetConfig.inputs);
    writeConfig(target, reply.inputs);
    compare.mergeUndo = mergeUndoPush(compare.mergeUndo, { target, before, after: configText(target), label: reply.label },
      UNDO_LIMIT);
    compare.message = { text: reply.label + ": " + target + " now matches " + source + "." };
    compare.diffs = null;
    renderCompare();
  }

  // Undo the last merge, unless its config changed since (later edits are never overwritten).
  function undoMerge() {
    const compare = state.compare;
    const popped = mergeUndoPop(compare.mergeUndo);
    if (!popped) return;
    compare.mergeUndo = popped.stack;
    const entry = popped.entry;
    if (configText(entry.target) !== entry.after) {
      compare.message = { error: true, text: entry.target + " changed since that merge; nothing was undone." };
    } else {
      writeConfig(entry.target, JSON.parse(entry.before));
      compare.message = { text: "Undone: " + entry.label + " in " + entry.target + "." };
    }
    compare.diffs = null;
    renderCompare();
  }

  const MATCH_LABELS = ["Make B match A", "Make A match B"];  // the accessible names
  const MATCH_ARROWS = ["A → B", "A ← B"];  // the button text: the arrow points the copy direction

  // The make-match buttons: off with the desktop's reason, and a first tap that asks for a second.
  function matchButtons(names, problems) {
    const [nameA, nameB] = names;
    return "<div class=\"match\">" + MATCH_LABELS.map((label, position) => {
      const problem = problems[position];
      const [source, target] = position === 0 ? [nameA, nameB] : [nameB, nameA];
      const armed = state.compare.armed === position && !problem;
      return "<div class=\"match-row\"><button type=\"button\" class=\"button button-quiet\" data-match=\"" + position
        + "\" data-armed=\"" + armed + "\"" + (armed ? "" : " aria-label=\"" + label + "\"")
        + (problem ? " disabled aria-describedby=\"matchWhy" + position + "\"" : "")
        + ">" + escapeText(armed ? "Tap again to replace " + target : MATCH_ARROWS[position])
        + "</button><p class=\"field-help\" id=\"matchWhy"
        + position + "\">" + escapeText(problem || (armed ? "Replaces " + target + " on this device with the settings "
          + "of " + source + "." : "")) + "</p></div>";
    }).join("") + "</div>";
  }

  // The inputs a config name stands for: the current settings, the example household or a scenario saved on this
  // device (an older version is upgraded first).
  async function configInputs(name) {
    const info = state.info.compare;
    if (name === info.currentName) return { ok: true, inputs: state.inputs };
    if (name === info.defaultName) return { ok: true, inputs: state.defaults };
    const inputs = state.scenarios[name];
    if (!inputs) return { ok: false, error: name + ": no saved scenario has this name on this device" };
    if (isObject(inputs) && inputs.schemaVersion === state.info.inputsSchemaVersion) return { ok: true, inputs };
    const reply = await ask("importScenario", [JSON.stringify(inputs)]);
    if (reply && reply.ok) keepUpgradedScenario(name, reply.inputs);
    return reply && reply.ok ? { ok: true, inputs: reply.inputs }
      : { ok: false, error: reply ? reply.error : name + " could not be read; try again." };
  }

  // A saved scenario upgraded from an older version is saved again at once in the current format.
  function keepUpgradedScenario(name, inputs) {
    state.scenarios[name] = clone(inputs);
    storeScenarios();
  }

  // Make one config match the other: the first tap arms the button, the second replaces the target (a scenario saved
  // on this device, or the working settings for the current settings; never the default profile), then the
  // comparison runs again.
  async function makeMatch(position, result) {
    const compare = state.compare;
    if (compare.job) return;
    const [nameA, nameB] = result.names;
    const [source, target] = position === 0 ? [nameA, nameB] : [nameB, nameA];
    if (compare.armed !== position) {
      compare.armed = position;
      renderCompare();
      return;
    }
    compare.armed = null;
    const check = await ask("matchProblems", [source, target]);
    const problem = !check ? "Make-match did not answer; try again." : check.ok ? check.problems[0] : check.error;
    const inputs = problem ? null : await configInputs(source);
    if (problem || !inputs.ok) {
      compare.message = { error: true, text: problem || inputs.error };
      renderCompare();
      return;
    }
    if (target === state.info.compare.currentName) {
      state.inputs = clone(inputs.inputs);  // the loaded scenario stays the base, so Outputs shows the settings as edited
      renderSettings();
      inputsChanged();
    } else {
      state.scenarios[target] = clone(inputs.inputs);
      storeScenarios();
      renderSaved();
    }
    compare.message = { text: target + " now matches " + source + "." };
    renderCompare();
    await checkCompare();
    runCompare();
  }

  // ---- Scenarios on this device (Setup): the open scenario card, Other scenarios, New and Import ----
  // The open scenario is the settings being edited, under a name; Save (or Auto-save) keeps a copy of it under that
  // name. Other scenarios lists the saved copies except the open one, and the example household while it is not open.
  function storeScenarios() {
    store(SCENARIOS_KEY, state.scenarios);
  }

  function savedMessage(text, isError) {
    const message = $("savedMessage");
    message.hidden = false;
    message.className = isError ? "banner banner-error" : "banner";
    message.textContent = text;
  }

  // Keep the open scenario's settings as its saved copy (Save, and Auto-save after each settled edit). Returns the
  // reason when it could not (this device keeps at most SAVED_LIMIT scenarios), else null.
  function saveOpen() {
    const name = state.scenarioName;
    if (!hasOwn(state.scenarios, name) && Object.keys(state.scenarios).length >= SAVED_LIMIT) {
      return "This device keeps at most " + SAVED_LIMIT + " scenarios. Delete one first.";
    }
    state.scenarios[name] = clone(state.inputs);
    storeScenarios();
    return null;
  }

  function saveButtonPressed() {
    const problem = saveOpen();
    if (problem) { savedMessage(problem, true); return; }
    state.savedJustNow = true;
    renderOpenCard();
    renderCompare();
  }

  function toggleAutoSave() {
    state.autoSave = !state.autoSave;
    savePrefs();
    if (state.autoSave && hasUnsavedChanges()) {
      const problem = saveOpen();
      if (problem) savedMessage(problem, true);
      else renderCompare();
    }
    renderOpenCard();
  }

  // ---- Undo and the settled edit: the open scenario's last UNDO_LIMIT input states ----
  let settleTimer = null;

  function scheduleSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SETTLE_MS);
  }

  // A pause in editing: the settings become one undo step and, with Auto-save on, the saved copy.
  function settle() {
    clearTimeout(settleTimer);
    settleTimer = null;
    if (!state.inputs) return;
    state.undo = undoRecord(state.undo, JSON.stringify(state.inputs), UNDO_LIMIT);
    if (state.autoSave && hasUnsavedChanges()) {
      const problem = saveOpen();
      if (problem) savedMessage(problem, true);
    }
    renderOpenCard();
  }

  // Another scenario is open now (or the page just started): nothing to undo, and Auto-save keeps it at once.
  function resetUndo() {
    clearTimeout(settleTimer);
    settleTimer = null;
    state.savedJustNow = false;
    state.undo = { stack: [], current: JSON.stringify(state.inputs) };
    if (state.autoSave && hasUnsavedChanges()) {
      const problem = saveOpen();
      if (problem) savedMessage(problem, true);
      else renderCompare();
    }
    renderOpenCard();
  }

  function undoLast() {
    if (settleTimer) settle();  // an edit still settling is a step of its own
    const back = undoStep(state.undo);
    if (!back) return;
    const before = state.inputs;
    state.undo = back;
    state.inputs = JSON.parse(back.current);
    renderSettings();
    inputsChanged();
    renderOpenCard();
    showUndone(changedPaths(before, state.inputs));
  }

  // ---- After Undo: go to the field it changed back and flash it ----
  // The first changed field that is drawn somewhere is brought into view: its tab and Inputs chip are opened, a list
  // row's sheet is opened when the field is inside one, and a list that changed in size is shown whole. Every changed
  // field then in view gets a tint that fades over a second. Nothing happens when no changed field is drawn.
  const UNDO_FLASH_MS = 1000;

  // The field names a settings panel draws, its sections' included.
  function panelNames(panel) {
    const names = (panel.fields || []).slice();
    for (const section of panel.sections || []) {
      names.push(...(section.fields || []));
      for (const sub of section.subsections || []) names.push(...(sub.fields || []));
    }
    return names;
  }

  // The places (tab, and chip on Inputs) whose panel draws a path, the closest field name first; Setup when its
  // cards draw the path outside any panel.
  function undonePlaces(path) {
    const places = [];
    for (const panel of state.schema.panels) {
      const match = panelNames(panel).filter((name) => path === name || path.startsWith(name + "."))
        .sort((a, b) => b.length - a.length)[0];
      if (match) places.push({ length: match.length, tab: panel.id === SETUP_PANEL ? "setup" : "inputs", chip: panel.id });
    }
    places.sort((a, b) => b.length - a.length);
    if (!places.length && $("panel-setup").querySelector("#" + CSS.escape(fieldId(path)))) places.push({ tab: "setup" });
    return places;
  }

  // The lists drawn for a list path (a list may be drawn more than once, filtered, such as the Home chip's mortgages).
  function drawnLists(path) {
    return Array.from(document.querySelectorAll(".items"))
      .filter((list) => list.dataset.list === path || list.dataset.list.startsWith(path + " "));
  }

  // Where a path is drawn on the shown place: its field, or (`row`) the list row whose sheet holds it, or the list
  // itself when the list changed in size. Null when it is not in view.
  function drawnField(path, scope) {
    const shown = (element) => element && element.getClientRects().length > 0;
    const parts = path.split(".");
    for (let end = parts.length; end > 0; end -= 1) {
      const prefix = parts.slice(0, end).join(".");
      const element = scope.querySelector("#" + CSS.escape(fieldId(prefix)));
      if (shown(element)) return { element };
      if (end < parts.length && /^\d+$/.test(parts[end]) && scope === document) {
        for (const list of drawnLists(prefix)) {
          const button = list.querySelector(".item[data-position=\"" + parts[end] + "\"]");
          if (shown(button)) return { element: button, row: true };
        }
      }
    }
    const list = scope === document ? drawnLists(path).find(shown) : null;
    return list ? { element: list.closest(".field") || list } : null;
  }

  function flashField(element) {
    const target = element.closest(".field") || element.closest(".item-row") || element;
    target.classList.remove("undo-flash");
    void target.offsetWidth;  // restart the fade when the same field flashes again
    target.classList.add("undo-flash");
    setTimeout(() => target.classList.remove("undo-flash"), UNDO_FLASH_MS);
    return target;
  }

  function showUndone(paths) {
    for (const path of paths) {
      for (const place of undonePlaces(path)) {
        if (place.tab === "inputs" && state.chips.settings !== place.chip) {
          state.chips.settings = place.chip;
          savePrefs();
          renderSettings();
        }
        goTo(place.tab, state.view);
        let found = drawnField(path, document);
        if (!found) continue;
        if (found.row) {
          found.element.click();  // opens the row's sheet
          const inSheet = drawnField(path, $("sheet"));
          if (inSheet) {
            const target = flashField(inSheet.element);
            for (const other of paths) {
              const more = other !== path && drawnField(other, $("sheet"));
              if (more) flashField(more.element);
            }
            target.scrollIntoView({ block: "center" });
            return;
          }
          closeSheet();
          found = drawnField(path, document);
          if (!found) return;
        }
        const target = flashField(found.element);
        for (const other of paths) {
          const more = other !== path && drawnField(other, document);
          if (more) flashField(more.element);
        }
        target.scrollIntoView({ block: "center" });
        return;
      }
    }
  }

  // ---- The scenario dialog: one centered window for New, Import, Rename, Clear, Delete and unsaved changes ----
  const dialog = { returnFocus: null };

  // Show the dialog: `title`, `text`, `body` (elements under the text) and `actions`, each [label, class, onClick,
  // id]; an action closes the dialog unless its onClick returns false. Focus goes to `focus` (else the first field or
  // button), stays inside while it is open (Tab wraps) and goes back to the opener when it closes.
  function openDialog({ title, text, body = [], actions, focus }) {
    const active = document.activeElement;
    if (active && active !== document.body && !$("dialog").contains(active)) dialog.returnFocus = active;
    closeRowMenu(false);
    $("dialogTitle").textContent = title;
    $("dialogText").textContent = text || "";
    $("dialogText").hidden = !text;
    $("dialogBody").replaceChildren(...body);
    dialogError(null);
    $("dialogActions").replaceChildren(...actions.map(([label, className, onClick, id]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = label;
      if (id) button.id = id;
      button.addEventListener("click", async () => {
        if ((await onClick()) !== false) closeDialog();
      });
      return button;
    }));
    $("dialog").hidden = false;
    $("dialogBackdrop").hidden = false;
    (focus || $("dialog").querySelector("input, textarea, .dialog-body button, .dialog-actions button")).focus();
  }

  function closeDialog(restoreFocus) {
    if ($("dialog").hidden) return;
    $("dialog").hidden = true;
    $("dialogBackdrop").hidden = true;
    $("dialogBody").replaceChildren();
    if (restoreFocus !== false && dialog.returnFocus && document.contains(dialog.returnFocus)) dialog.returnFocus.focus();
  }

  function dialogError(text) {
    $("dialogError").hidden = !text;
    $("dialogError").textContent = text || "";
  }

  // Tab and Shift+Tab wrap inside the open dialog or row menu.
  function trapFocus(event, holder) {
    if (event.key !== "Tab") return;
    const items = [...holder.querySelectorAll("button, input, textarea, select")].filter((item) => !item.disabled
      && item.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const CANCEL = ["Cancel", "button button-quiet", () => true, "dialogCancel"];

  // The dialog's name box; Enter presses the last action (Create and start, Rename).
  function nameField(value) {
    const label = document.createElement("label");
    label.className = "field-label";
    label.htmlFor = "dialogName";
    label.textContent = "Name";
    const input = document.createElement("input");
    input.className = "input";
    input.id = "dialogName";
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = value;
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      $("dialogActions").lastElementChild.click();
    });
    return [label, input];
  }

  // Every name in use on this device: the saved scenarios, the example household (while listed) and the open scenario.
  function takenNames() {
    return savedNames().concat(state.exampleHidden ? [] : [EXAMPLE_NAME], [state.scenarioName]);
  }

  // The name typed in the dialog, checked by the scenario name rule and against the names in use (`own` is the name
  // being renamed, which it may keep). Null, with the message shown, when it is refused.
  function dialogName(own) {
    const input = $("dialogName");
    const check = checkScenarioName(input.value, state.info.scenarioName);
    let error = check.ok ? null : check.error;
    const lower = check.ok ? check.name.toLowerCase() : "";
    if (!error && lower !== String(own || "").toLowerCase()
      && takenNames().some((name) => name.toLowerCase() === lower)) {
      error = check.name + " is already used on this device. Choose another name.";
    }
    input.setAttribute("aria-invalid", String(Boolean(error)));
    dialogError(error);
    return error ? null : check.name;
  }

  // Before another scenario replaces the open one: with unsaved changes and Auto-save off, ask Save, Discard or
  // Cancel first. `then` runs unless Cancel is chosen.
  function leaveOpen(then) {
    if (state.autoSave || !hasUnsavedChanges()) { then(); return; }
    const name = state.scenarioName;
    openDialog({ title: "Save changes to " + name + "?",
      text: name + " has changes that are not saved on this device.",
      actions: [CANCEL,
        ["Discard", "button button-danger", () => { closeDialog(false); then(); return false; }, "dialogDiscard"],
        ["Save", "button", () => {
          const problem = saveOpen();
          if (problem) { dialogError(problem); return false; }
          renderCompare();
          closeDialog(false);
          then();
          return false;
        }, "dialogSave"]] });
  }

  // The settings a listed scenario stands for: its saved copy (upgraded first when it is from an older version), or
  // the example household. Null, with the message shown, when it cannot be read.
  async function listedInputs(name) {
    let inputs = savedCopy(name);
    if (!inputs) return null;
    if (!isObject(inputs) || inputs.schemaVersion !== state.info.inputsSchemaVersion) {
      const reply = await ask("importScenario", [JSON.stringify(inputs)]);
      if (!reply || !reply.ok) { savedMessage(reply ? reply.error : name + " could not be read; try again.", true); return null; }
      inputs = reply.inputs;
      keepUpgradedScenario(name, inputs);
    }
    return clone(inputs);
  }

  // ---- The load splash: a full-screen card naming the scenario that is opening, for two seconds ----
  // Shown whenever another scenario replaces the open one (Other scenarios, Duplicate, New, Import, Load example
  // household); never at start-up (the boot screen shows then) nor for edits or Undo. The load work runs underneath;
  // the card takes every tap, and every key press is held back, until it goes.
  const SPLASH_MS = 2000;
  const splash = { timer: null, returnFocus: null, wired: false };

  function showLoadSplash(name) {
    const card = $("loadSplash");
    if (!splash.wired) {
      splash.wired = true;
      document.addEventListener("keydown", (event) => {
        if ($("loadSplash").hidden) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
    }
    $("loadSplashName").textContent = "Loading " + name;
    clearTimeout(splash.timer);
    if (card.hidden) {
      splash.returnFocus = document.activeElement;
      card.hidden = false;
      card.focus({ preventScroll: true });
    }
    splash.timer = setTimeout(hideLoadSplash, SPLASH_MS);
  }

  function hideLoadSplash() {
    clearTimeout(splash.timer);
    splash.timer = null;
    const card = $("loadSplash");
    if (card.hidden) return;
    card.hidden = true;
    const back = splash.returnFocus;
    splash.returnFocus = null;
    // Focus goes back where it was, unless something opened meanwhile (the walkthrough after New) has taken it.
    if (document.activeElement === card || document.activeElement === document.body) {
      if (back && back.isConnected && back.getClientRects().length) back.focus({ preventScroll: true });
    }
  }

  async function openSaved(name) {
    const inputs = await listedInputs(name);
    if (!inputs) return;
    showLoadSplash(name);
    state.inputs = inputs;
    state.base = clone(inputs);
    state.scenarioName = name;
    forgetBlankWalk();
    savedMessage("Opened " + name + ".", false);
    renderSettings();
    inputsChanged();
    resetUndo();
    renderSaved();
  }

  // New: a brand-new scenario with nothing filled in, opened at the walkthrough's first question.
  function newDialog() {
    leaveOpen(() => openDialog({ title: "New scenario",
      text: "Starts empty and opens Walk me through it from the first question.",
      body: nameField(numberedName("New plan", takenNames(), true)),
      actions: [CANCEL, ["Create and start", "button", () => {
        const name = dialogName(null);
        if (!name) return false;
        createScenario(name);
        return true;
      }, "newCreate"]] }));
  }

  function createScenario(name) {
    showLoadSplash(name);
    state.inputs = blankInputs(state.schema);
    state.base = clone(state.inputs);
    state.scenarioName = name;
    savedMessage("Created " + name + ".", false);
    renderSettings();
    inputsChanged();
    resetUndo();
    renderSaved();
    renderCompare();
    startBlankWalk();
  }

  // Import: a scenario file chosen here, or its text pasted, replaces the open scenario.
  function importDialog() {
    leaveOpen(() => {
      const choose = document.createElement("button");
      choose.type = "button";
      choose.className = "button button-quiet dialog-wide";
      choose.id = "importChoose";
      choose.textContent = "Choose file";
      const or = document.createElement("p");
      or.className = "field-label";
      or.id = "importTextLabel";
      or.textContent = "or paste the scenario text";
      const text = document.createElement("textarea");
      text.className = "input mono";
      text.id = "importText";
      text.rows = 4;
      text.setAttribute("aria-labelledby", "importTextLabel");
      text.placeholder = "{ \"schemaVersion\": " + state.info.inputsSchemaVersion + ", ... }";
      choose.addEventListener("click", () => pickScenarioFile(() => {
        dialogError("This browser did not open a file picker. Paste the scenario text into the box instead.");
        text.focus();
      }));
      openDialog({ title: "Import", text: "Pick a scenario file saved from Walk Me Through It or the desktop dashboard.",
        body: [choose, or, text], focus: choose,
        actions: [CANCEL, ["Open", "button", async () => {
          if (!text.value.trim()) { dialogError("Choose a file or paste the scenario text."); return false; }
          return importText(text.value, null);
        }, "importOpen"]] });
    });
  }

  function renameDialog(name) {
    openDialog({ title: "Rename " + name, body: nameField(name),
      actions: [CANCEL, ["Rename", "button", () => {
        const next = dialogName(name);
        if (!next) return false;
        if (next !== name) renameScenario(name, next);
        return true;
      }, "renameApply"]] });
  }

  // Rename a scenario: its saved copy moves to the new name, and the open scenario and Compare follow it.
  function renameScenario(from, to) {
    if (hasOwn(state.scenarios, from)) {
      state.scenarios[to] = state.scenarios[from];
      delete state.scenarios[from];
      storeScenarios();
    }
    if (from === state.scenarioName) {
      state.scenarioName = to;
      saveDraft();
    }
    if (Array.isArray(state.compare.pair)) {
      state.compare.pair = state.compare.pair.map((name) => (name === from ? to : name));
      savePrefs();
    }
    savedMessage("Renamed " + from + " to " + to + ".", false);
    renderOpenCard();
    renderSaved();
    renderCompare();
  }

  // Clear: two questions, then every setting of the open scenario is blank (as for New); Undo brings them back.
  function clearDialog() {
    const name = state.scenarioName;
    openDialog({ title: "Clear " + name + "?", text: "This empties every setting in " + name + ". You can undo it.",
      actions: [CANCEL, ["Continue", "button button-danger", () => {
        openDialog({ title: "Clear " + name + "?", text: "Last check: all values will be removed. Clear it?",
          actions: [CANCEL, ["Yes, clear", "button button-danger-solid", () => { clearOpen(); return true; },
            "clearConfirm"]] });
        return false;
      }, "clearContinue"]] });
  }

  function clearOpen() {
    if (settleTimer) settle();
    state.inputs = blankInputs(state.schema);
    renderSettings();
    inputsChanged();
    settle();  // at once, so Undo steps back to the settings before the clear
    showFileMessage("Cleared " + state.scenarioName + ". Undo (top right) brings the settings back.", false);
  }

  // The strip's Duplicate: a saved copy of the open scenario's current settings as "<name>_Copy1" (the lowest free number,
  // see numberedName), listed in Other scenarios and Compare and then opened, as picking it would (unsaved changes of
  // the scenario left are asked about first; Undo starts afresh on the copy).
  function duplicateOpen() {
    if (Object.keys(state.scenarios).length >= SAVED_LIMIT) {
      showFileMessage("This device keeps at most " + SAVED_LIMIT + " scenarios. Delete one first.", true);
      return;
    }
    if (settleTimer) settle();
    const copy = numberedName(state.scenarioName, takenNames(), false);
    state.scenarios[copy] = clone(state.inputs);
    storeScenarios();
    showFileMessage("Saved a copy of " + state.scenarioName + " as " + copy + ".", false);
    renderSaved();
    renderCompare();
    leaveOpen(() => openSaved(copy));
  }

  // A row's Duplicate: a saved copy of that scenario, opened as the strip's Duplicate opens its copy.
  function duplicateScenario(name) {
    if (Object.keys(state.scenarios).length >= SAVED_LIMIT) {
      savedMessage("This device keeps at most " + SAVED_LIMIT + " scenarios. Delete one first.", true);
      return;
    }
    const copy = numberedName(name, takenNames(), false);
    state.scenarios[copy] = clone(savedCopy(name));
    storeScenarios();
    savedMessage("Saved a copy of " + name + " as " + copy + ".", false);
    renderSaved();
    renderCompare();
    leaveOpen(() => openSaved(copy));
  }

  function deleteDialog(name) {
    const text = hasOwn(state.scenarios, name) ? "This removes " + name + " from this device. It cannot be undone."
      : "This removes " + name + " from this list. Load example household (Start over) brings it back.";
    openDialog({ title: "Delete " + name + "?", text,
      actions: [CANCEL, ["Delete", "button button-danger-solid", () => { deleteScenario(name); return true; },
        "deleteConfirm"]] });
  }

  // Delete a listed scenario (never the open one): it leaves the list, Compare and every name shown. The example
  // household leaves the list until Load example household brings it back.
  function deleteScenario(name) {
    if (name === state.scenarioName || (!hasOwn(state.scenarios, name) && name !== EXAMPLE_NAME)) return;
    if (hasOwn(state.scenarios, name)) {
      delete state.scenarios[name];
      storeScenarios();
    }
    if (name === EXAMPLE_NAME) {
      state.exampleHidden = true;
      savePrefs();
    }
    savedMessage("Deleted " + name + ".", false);
    renderOpenCard();
    renderSaved();
    renderCompare();
  }

  async function exportListed(name) {
    const inputs = await listedInputs(name);
    if (inputs) exportScenario(inputs, name);
  }

  // ---- A row's "..." menu: Duplicate, Rename, Export, Delete (the example household: Duplicate, Export, Delete) ----
  const rowMenu = { button: null };

  function openRowMenu(button, name) {
    const menu = $("rowMenu");
    if (rowMenu.button === button && !menu.hidden) { closeRowMenu(); return; }
    closeRowMenu(false);
    const saved = hasOwn(state.scenarios, name);
    const items = [["Duplicate", () => duplicateScenario(name)]];
    if (saved) items.push(["Rename", () => renameDialog(name)]);
    items.push(["Export", () => exportListed(name)]);
    items.push(["Delete", () => deleteDialog(name)]);
    menu.setAttribute("aria-label", name);
    menu.replaceChildren(...items.map(([label, onPick]) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "row-menu-item" + (label === "Delete" ? " row-menu-danger" : "");
      item.setAttribute("role", "menuitem");
      item.textContent = label;
      item.addEventListener("click", () => { closeRowMenu(false); onPick(); });
      return item;
    }));
    rowMenu.button = button;
    button.setAttribute("aria-expanded", "true");
    menu.hidden = false;
    const place = button.getBoundingClientRect();
    const below = place.bottom + 4 + menu.offsetHeight <= window.innerHeight - 8;
    menu.style.top = (below ? place.bottom + 4 : Math.max(8, place.top - 4 - menu.offsetHeight)) + "px";
    menu.style.right = Math.max(8, window.innerWidth - place.right) + "px";
    menu.querySelector("button").focus();
  }

  function closeRowMenu(restoreFocus) {
    const menu = $("rowMenu");
    if (menu.hidden) return;
    menu.hidden = true;
    const button = rowMenu.button;
    rowMenu.button = null;
    if (!button) return;
    button.setAttribute("aria-expanded", "false");
    if (restoreFocus !== false && document.contains(button)) button.focus();
  }

  // Arrow keys, Home and End move through the row menu; Tab closes it.
  function rowMenuKeys(event) {
    const items = [...$("rowMenu").querySelectorAll("button")];
    const at = items.indexOf(document.activeElement);
    const moves = { ArrowDown: (at + 1) % items.length, ArrowUp: (at - 1 + items.length) % items.length, Home: 0,
      End: items.length - 1 };
    if (event.key === "Tab") { closeRowMenu(); event.preventDefault(); return; }
    if (!(event.key in moves)) return;
    event.preventDefault();
    items[moves[event.key]].focus();
  }

  // Other scenarios: the saved ones and the example household (unless deleted from the list), except the open one.
  function otherNames() {
    return otherScenarioNames(savedNames(), state.scenarioName, EXAMPLE_NAME, state.exampleHidden);
  }

  const FILE_ICON = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 3h7l4 4v14H7z\"/><path d=\"M14 3v4h4\"/></svg>";
  const MORE_ICON = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"5\" cy=\"12\" r=\"1.6\"/>"
    + "<circle cx=\"12\" cy=\"12\" r=\"1.6\"/><circle cx=\"19\" cy=\"12\" r=\"1.6\"/></svg>";
  const TRASH_ICON = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13\"/>"
    + "<path d=\"M10 11v6M14 11v6\"/></svg>";

  function renderSaved() {
    const list = $("savedList");
    if (!list || !state.info) return;
    closeRowMenu(false);
    const names = otherNames();
    if (!names.length) {
      list.innerHTML = "<p class=\"note\">No other scenarios on this device yet.</p>";
      return;
    }
    list.replaceChildren(...names.map((name) => {
      const row = document.createElement("div");
      row.className = "scenario-row";
      row.setAttribute("role", "listitem");
      row.innerHTML = "<button type=\"button\" class=\"scenario-open\">" + FILE_ICON + "<span class=\"saved-name\"></span>"
        + "</button><button type=\"button\" class=\"scenario-delete\">" + TRASH_ICON + "</button>"
        + "<button type=\"button\" class=\"scenario-more\" aria-haspopup=\"menu\" aria-expanded=\"false\" "
        + "aria-controls=\"rowMenu\">" + MORE_ICON + "</button>";
      row.querySelector(".saved-name").textContent = name;
      const [open, remove, more] = row.querySelectorAll("button");
      open.setAttribute("aria-label", "Open " + name);
      remove.setAttribute("aria-label", "Delete " + name);
      remove.title = "Delete " + name;
      more.setAttribute("aria-label", "More for " + name);
      open.addEventListener("click", () => leaveOpen(() => openSaved(name)));
      remove.addEventListener("click", () => deleteDialog(name));
      more.addEventListener("click", (event) => { event.stopPropagation(); openRowMenu(more, name); });
      return row;
    }));
  }

  // ---- Plots ----
  const FULL_SCREEN_BUTTON = "<button type=\"button\" class=\"chart-full\" aria-label=\"Full screen\" "
    + "title=\"Full screen\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 9V4h5M15 4h5v5M20 15v5h-5"
    + "M9 20H4v-5\"/></svg></button>";

  function chartCard(spec, rerender) {
    const card = document.createElement("div");
    card.className = "card chart-card";
    card.innerHTML = "<div class=\"view-toggle\" role=\"group\" aria-label=\"Show as\"><button type=\"button\" "
      + "data-view=\"chart\">Chart</button><button type=\"button\" data-view=\"table\">Table</button></div>"
      + FULL_SCREEN_BUTTON + charts.renderChart(spec) + "<div class=\"chart-table\">" + charts.renderTable(spec) + "</div>";
    const showTable = state.plotView === "table";
    card.querySelector(".chart-plot, .chart-empty").hidden = showTable;
    // The Full screen button (top right) shows the plot on the whole screen in landscape; not for the table or a
    // chart with nothing to plot.
    card.querySelector(".chart-full").hidden = showTable || !card.querySelector(".chart-plot");
    charts.attachFullScreen(card, spec);
    if (card.querySelector(".legend")) card.querySelector(".legend").hidden = showTable;
    card.querySelector(".chart-table").hidden = !showTable;
    for (const button of card.querySelectorAll(".view-toggle button")) {
      button.setAttribute("aria-pressed", String(button.dataset.view === state.plotView));
      button.addEventListener("click", () => {
        state.plotView = button.dataset.view;
        savePrefs();
        (rerender || renderPlots)();
      });
    }
    return card;
  }

  // Plots: the charts of the last Monte Carlo, marked when stale; the RMD schedule sits under Deposits and withdrawals.
  function renderPlots() {
    const body = $("plots-body");
    const selected = PLOT_VIEWS.some((view) => view.id === state.chips.plots) ? state.chips.plots : PLOT_VIEWS[0].id;
    renderChips("chips-plots", PLOT_VIEWS, selected, (id) => { state.chips.plots = id; savePrefs(); renderPlots(); });
    if (needsSetup(state.inputs)) { body.innerHTML = FINISH_SETUP_HTML; return; }
    const { entry, stale } = latestMonteCarlo();
    const parts = [];
    if (state.error) {  // a stale result is dimmed; its note is in the run bar above
      const top = document.createElement("div");
      top.className = "view-intro";
      top.innerHTML = errorBanner(state.error);
      parts.push(top);
    }
    if (!entry) {
      const empty = document.createElement("div");
      empty.className = "card empty-state";
      empty.textContent = "No Monte Carlo yet. It starts on its own.";
      body.replaceChildren(...parts, empty);
      return;
    }
    const view = PLOT_VIEWS.find((item) => item.id === selected);
    const result = entry.value;
    const figures = [];
    for (const id of view.charts || [view.id]) {
      const spec = result.charts.find((item) => item.id === id);
      if (!spec) continue;
      const card = chartCard(spec);
      if (id === (view.charts || [view.id])[0]) addChartHelp(card, view.label, view.intro);
      if (spec.type === "histogram") {
        const note = document.createElement("p");
        note.className = "muted";
        note.textContent = "The chart leaves out the lowest and highest " + spec.trimmed.percent + "% of runs (below "
          + fullMoney(spec.trimmed.low) + " or above " + fullMoney(spec.trimmed.high) + ") so a few extreme outcomes do "
          + "not stretch the axis; the percentile table under Summary counts every run.";
        card.append(note);
      }
      if (stale) card.classList.add("stale-results");
      figures.push([card.querySelector("figure"), spec]);
      parts.push(card);
    }
    if (view.id === "flows") parts.push(rmdScheduleCard(result.tables, stale));
    body.replaceChildren(...parts);
    figures.forEach(([figure, spec]) => figure && charts.attachChart(figure, spec));
  }

  function rmdScheduleCard(tables, stale) {
    const card = document.createElement("div");
    card.className = "card" + (stale ? " stale-results" : "");
    if (tables.rmdEmptyNote) {
      card.classList.add("empty-state");
      card.textContent = tables.rmdEmptyNote;
      return card;
    }
    const about = titleHelp("h2", "RMD schedule", "Middle half average of the runs (the prior balance is that average balance). "
      + "IRMAA is not in the tax figure.");
    card.innerHTML = "<div class=\"card-head\">" + about.head + "<span class=\"chart-note\">"
      + escapeText(dollarsText(tables.dollars)) + "</span></div>" + about.text
      + charts.renderFrame(tables.rmdSchedule, { title: "RMD schedule" }) + listHtml(tables.rmdNotes);
    return card;
  }

  // ---- Settings ----
  function renderSettingsError() {
    for (const banner of [$("settings-error"), $("household-error")]) {  // Inputs, and Household & run on Setup
      banner.hidden = !state.error;
      if (state.error) banner.innerHTML = "<strong>Settings need a fix.</strong> " + escapeText(state.error);
    }
  }

  // Inputs shows every panel but Household & run as a chip; that panel's fields are drawn on Setup.
  // The one summary at the bottom of the Expenses chip (`expenseTotals`), per month: each monthly category, Major
  // Spending and Charity paid this year (per year / 12) and the one total of all, the costs other tabs already charge
  // included (from the settings notes; "n/a" until they arrive).
  function expenseSummaryCard() {
    const card = document.createElement("div");
    card.className = "card";
    card.id = "expenseSummary";
    fillExpenseSummary(card);
    return card;
  }

  function fillExpenseSummary(card) {
    const counted = state.notes && state.notes.alreadyCounted;
    const totals = expenseTotals(expenseSummary(state.inputs.expenses, state.info && state.info.expenseCategories,
      state.inputs.you && state.inputs.you.currentAge), counted ? counted.rows : null);
    const line = (row, strong) => {
      const cell = (value) => "<td>" + (strong ? "<strong>" + fullMoney(value) + "</strong>" : fullMoney(value)) + "</td>";
      return "<tr><th scope=\"row\">" + escapeText(row.item) + "</th>" + cell(row.monthly) + "</tr>";
    };
    const about = counted ? titleHelp("h2", "Total expenses", counted.totalsHelp)
      : { head: "<h2>Total expenses</h2>", text: "" };
    card.innerHTML = about.head + about.text + "<table class=\"data-table\"><thead><tr><th scope=\"col\">Expenses</th>"
      + "<th scope=\"col\">Monthly</th></tr></thead><tbody>"
      + totals.entered.map((row) => line(row, false)).join("")
      + line(totals.total || { item: "Total expenses", monthly: null }, true)
      + "</tbody></table><p class=\"field-help\">Major Spending and Charity count the rows paid this year, at your age "
      + "today; the total adds the Bills - Other from the other tabs, the first year of the run.</p>";
  }

  // The read-only card at the top of the Expenses chip: the costs other tabs already charge (from the settings notes),
  // so they are not entered again as expense rows, in one table under their one group (Bills - Other;
  // `alreadyCountedGroups`) and the note on the taxes under it; it reads "Reading the run" until the notes arrive.
  const COUNTED_COLUMNS = [["item", "Item"], ["where", "Where it is set"], ["monthly", "Monthly"], ["yearly", "Yearly"]];

  function alreadyCountedCard() {
    const card = document.createElement("div");
    card.className = "card";
    card.id = "alreadyCounted";
    fillAlreadyCounted(card);
    return card;
  }

  function fillAlreadyCounted(card) {
    const counted = state.notes && state.notes.alreadyCounted;
    if (!counted) {
      card.innerHTML = "<h2>Already counted from other tabs</h2><p class=\"note\">Reading the run</p>";
      return;
    }
    const about = titleHelp("h2", "Already counted from other tabs", counted.help);
    const head = COUNTED_COLUMNS.map(([key, label]) => "<th scope=\"col\" title=\"" + escapeText(counted.columnHelp[key])
      + "\">" + escapeText(label) + "</th>").join("");
    const groups = counted.groups.map((group) => {
      const title = titleHelp("h3", group.category, group.help, "sub-heading");
      const rows = group.rows.map((row) => "<tr><th scope=\"row\">" + escapeText(row.item) + "</th><td class=\"text\">"
        + escapeText(row.where) + "</td><td>" + fullMoney(row.monthly) + "</td><td>" + fullMoney(row.yearly)
        + "</td></tr>").join("");
      return "<div class=\"counted-group\" data-category=\"" + escapeText(group.category) + "\">" + title.head + title.text
        + "<div class=\"table-scroll\" tabindex=\"0\" role=\"region\" aria-label=\"" + escapeText(group.category)
        + "\"><table class=\"data-table wrap-first\"><thead><tr>" + head + "</tr></thead><tbody>" + rows
        + "</tbody></table></div></div>";
    }).join("");
    card.innerHTML = about.head + about.text + groups + "<p class=\"note\">" + escapeText(counted.note) + "</p>";
  }

  function renderSettings() {
    const panels = state.schema.panels.filter((panel) => panel.id !== SETUP_PANEL);
    const selected = inputsChip(panels.map((panel) => panel.id), state.chips.settings);
    renderChips("chips-settings", panels.map((panel) => ({ id: panel.id, label: panel.label })), selected, (id) => {
      state.chips.settings = id; savePrefs(); renderSettings();
    });
    renderSettingsError();
    const sections = panelSections(panels.find((item) => item.id === selected));
    $("settings-body").replaceChildren(...sections);
    if (selected === "expenses") {  // the costs other tabs charge on top, the entered rows, then the one summary
      $("settings-body").prepend(alreadyCountedCard());
      $("settings-body").append(expenseSummaryCard());
    }
    renderHousehold();
    applyNotes();
    applyBenefits();
    renderDeposits();
    requestNotes();
    requestBenefits();
    requestEarnings();
    requestDeposits();
    renderRunCard();
    renderBand();
  }

  // The Household & run panel on Setup: the partner switch and the panel's fields (the seed, runs and the
  // inflation adjusted switch and range are in the Loaded config and Inflation cards below it).
  function renderHousehold() {
    const panel = state.schema.panels.find((item) => item.id === SETUP_PANEL);
    $("householdCard").hidden = !panel;
    $("household-body").replaceChildren(...(panel ? panelSections(panel) : []));
  }

  // A settings panel's fieldset and any cards drawn after it; a panel in titled sections (Benefits, Healthcare,
  // Strategies) gives one fieldset per section, each followed by its own cards. A `field.child` name draws that one
  // field of a top-level object (an object child, such as one strategy, is drawn flat under the section's title), with
  // the panel's label for it if it gives one, and nothing while the object is null (the partner's age without a
  // partner); a section holding figures of Reset to defaults groups ends with one button that resets them all. A
  // section with a switch (a Benefits pane) shows only the switch while it is off: a switch that is one of the
  // section's fields is drawn here, the `enabled` switch of an object the section holds is drawn with the object.
  // A field the panel's `conditions` hide (the Medicare supplement on Medicare Advantage) is left out, and a section
  // with all its fields hidden is not drawn. A section's `subsections` (the HSA in the Medical plan pane) are drawn
  // inside it as smaller titled groups at the place of their first field, each opened by its own switch.
  function panelSections(panel) {
    // The Home and Cars panels open with their timeline, once, above every section.
    const timelineKind = ((state.schema.timeline || {}).panels || {})[panel.id];
    if (timelineKind && !panel.timelineDrawn) {
      return [timelineBlock(timelineKind), ...panelSections({ ...panel, timelineDrawn: true })];
    }
    if (panel.sections) {
      return panel.sections.filter((section) => section.fields.some((name) => conditionMet(panel, name)))
        .flatMap((section, index) => panelSections({ ...panel, label: section.label,
          fields: section.fields, note: index === 0 ? panel.note : null, sections: null, switch: section.switch,
          subsections: section.subsections || null, help: section.help, lead: section.lead || null }));
    }
    const group = document.createElement("fieldset");
    group.className = panel.subsection ? "group pane subsection" : "group pane";
    // The pane's title: an icon tile and the label (the icon adds no text, so the legend reads as the label); a
    // sub-section's title has no icon.
    const title = "<span class=\"legend-title\">" + (panel.subsection ? "" : "<span class=\"pane-icon\">"
      + iconSvg(iconFor(panel.id || "", panel.label), "pane-svg") + "</span>") + "<span>" + escapeText(panel.label)
      + "</span></span>";
    // Every pane's one-sentence tooltip, and the panel's note after it, open from the "i" beside the pane's title.
    const about = [panel.help, panel.note].filter(Boolean).join("\n\n");
    if (about) {
      const id = newHelpId();
      group.innerHTML = "<legend class=\"legend-help\">" + title + helpButtonHtml(panel.label, id) + "</legend>"
        + helpTextHtml(id, about, "panel-note");
    } else {
      group.innerHTML = "<legend>" + title + "</legend>";
    }
    if (panel.lead) {  // a section's rule shown on screen under its title (Roth conversion)
      const lead = document.createElement("p");
      lead.className = "pane-lead";
      lead.textContent = panel.lead;
      group.append(lead);
    }
    if (panel.id === SETUP_PANEL) {
      group.append(partnerField());  // the seed is in the Loaded config card, the inflation in the Inflation card
    }
    const switchOff = panel.fields.includes(panel.switch) && !getPath(state.inputs, panel.switch);
    // Whole objects the pane lists (Income: you, partner) are its sections when there are several.
    const objectSections = panel.fields.filter((name) => !name.includes(".")
      && (panelField(state.schema, name) || {}).kind === "object").length;
    for (const name of panel.fields) {
      if (name === panel.switch) {
        group.append(sectionSwitch(name));
        continue;
      }
      if (switchOff || !conditionMet(panel, name)) continue;
      const subsection = (panel.subsections || []).find((item) => item.fields.includes(name));
      if (subsection) {
        if (name === subsection.fields[0]) {
          group.append(...panelSections({ ...panel, label: subsection.label, fields: subsection.fields, note: null,
            switch: subsection.switch, subsections: null, subsection: true, help: subsection.help }));
        }
        continue;
      }
      let field = panelField(state.schema, name);
      if (!field || (panel.id === SETUP_PANEL && INFLATION_CARD_FIELDS.includes(name))) continue;
      if (name.includes(".") && getPath(state.inputs, name.split(".")[0]) == null) continue;
      if (panel.id === "retirement" && name.endsWith(".socialSecurityByAge")
        && getPath(state.inputs, name.split(".")[0] + ".socialSecurityBasis") === "earnings") continue;  // Manual entry only
      if (panel.headings && panel.headings[name]) group.append(personHeading(panel.headings[name], group));
      if (panel.labels && panel.labels[name]) field = { ...field, label: panel.labels[name] };
      if (panel.id === "savings" && name === "contributions") {
        group.append(...savingsFields(field, name));
        continue;
      }
      if (field.kind === "object" && name.includes(".")) {
        group.append(...objectChildren(field, name, panel.headings, group));
        continue;
      }
      if (panel.id === "expenses" && name === "expenses") {
        group.append(...expenseLists(field, name));
        continue;
      }
      const element = fieldElement(field, name, panel.filters ? panel.filters[name] : null);
      if (field.kind === "object" && objectSections > 1) markPaneSection(element, group);  // Income: You, Partner
      if (panel.id === "retirement" && name.endsWith(".socialSecurityAge")) {
        element.append(benefitBox(name.split(".")[0]));  // the benefit table and estimate under the claim age
      }
      group.append(element);
    }
    const resetRoots = Object.entries(state.schema.resetGroups || {}).filter(([root, reset]) =>
      reset.panel === panel.id && panel.fields.some((name) => name.startsWith(root + "."))).map(([root]) => root);
    if (resetRoots.length) group.append(resetDefaultsButton(resetRoots));
    const sections = [group];
    if (panel.id === "loans") group.append(...mortgageRows(), ...carLoanRows());
    if (panel.id === "cars") group.append(warningsBox("car-warnings"));  // Expenses rows a car charges again
    if (panel.id === "accounts") {
      group.append(warningsBox("owner-warnings"));
      sections.push(surplusSection());
    }
    if (panel.id === "savings" && panel.fields.includes("contributions") && getPath(state.inputs, "contributions.enabled")) {
      group.append(depositSection());  // in the Retirement plan pane, one panel with the plan
    }
    if (panel.id === "retirement" && panel.fields.includes("premiums.medicareAge")) {
      group.append(warningsBox("medicare-warnings"));  // the early IRMAA tier is estimated, as on the desktop
    }
    if (panel.id === "strategies" && panel.fields.includes("strategies.qcd")) {
      group.append(warningsBox("strategy-warnings"));  // once, after the last strategy, as on the desktop
    }
    tintSections(group);
    return sections;
  }

  // One tint per section, not per field: the sections of a pane or sheet (markPaneSection, sheetHeading, sheetSection)
  // alternate the two tints by order (the first section and anything before it on the first tint), and every field of a
  // section, which follows its heading or sits inside it, is on that section's tint. A container without sections
  // keeps the one tint.
  function tintSections(container) {
    let sections = 0;
    for (const child of container.children) {
      if (child.classList.contains("pane-section")) sections += 1;
      child.classList.toggle("tint-alt", sections > 0 && sections % 2 === 0);
    }
  }

  // The Expenses chip's two lists, as the desktop's two tables: the monthly categories, then Major Spending and Charity
  // (amounts per year), each a filtered view of the one saved expenses list whose sheet offers only its categories.
  const MAJOR_EXPENSES_HELP = "Major Spending and Charity rows: the amount is per year, from the From age to the To age.";
  function expenseLists(field, path) {
    const rules = state.info.sheetRules;
    const annual = [rules.majorCategory, rules.charityCategory];
    const monthly = state.info.expenseCategories.filter((name) => !annual.includes(name));
    return [fieldElement(field, path, { category: monthly }),
      fieldElement({ ...field, label: "Major expenses", help: MAJOR_EXPENSES_HELP }, path, { category: annual })];
  }

  // A sub-heading inside a pane (Social Security: You, then Partner) with its "i", drawn as one of the pane's sections.
  function personHeading(heading, group) {
    const help = titleHelp("h3", heading.label, heading.help, "sub-heading");
    const holder = document.createElement("div");
    holder.innerHTML = help.head + help.text;
    markPaneSection(holder, group, "sub-heading-block");
    return holder;
  }

  // The shared look of the sections inside one pane (Income: You, then Partner; Social Security: You, then Partner):
  // a larger accent title, and a divider above every section but the pane's first.
  function markPaneSection(element, group, ...classes) {
    element.classList.add(...classes, "pane-section");
    if (group.querySelector(".pane-section")) element.classList.add("section-break");
  }

  // The Loans chip's read-only mortgage rows: each home's mortgage (titled with the home's name: owed today, or
  // borrowed at a later purchase, with when it starts and ends), then one "Mortgage" row per Mortgage loan of the Home
  // chip's other mortgage loans, with a button that opens the Home chip where they are edited; nothing without a
  // mortgage.
  function mortgageRows() {
    const mortgages = (state.inputs.loans || []).filter((loan) => loan.kind === "Mortgage");
    const borrowed = (home) => (home.buysLater ? home.purchasePrice * (1 - home.downPaymentRate) : home.mortgageBalance);
    const owing = (state.inputs.homes || []).filter((home) => home.hasMortgage && borrowed(home) > 0);
    if (!mortgages.length && !owing.length) return [];
    const wrap = fieldShell("Mortgage", "Read-only here: a home's mortgage and the other mortgage loans are entered and "
      + "edited on the Home chip.", null);
    wrap.classList.add("mortgage-rows");
    for (const home of owing) {
      const row = document.createElement("div");
      row.className = "item item-readonly";
      row.innerHTML = "<span class=\"item-name\"></span><span class=\"item-value\"></span>"
        + "<span class=\"item-detail\"></span>";
      const span = spanText(home, state.inputs.you.currentAge).replace("buys at", "starts at")
        .replace("sells at", "ends at") + (home.sellsLater && home.saleAge != null ? " (sold)" : "");
      row.querySelector(".item-name").textContent = home.name;
      row.querySelector(".item-value").textContent = compactMoney(borrowed(home));
      row.querySelector(".item-detail").textContent = home.name + " mortgage · " + percent(home.mortgageRate, 2) + " · "
        + home.mortgageMonthsLeft + " months" + (span ? " · " + span : "");
      wrap.append(row);
    }
    for (const loan of mortgages) {
      const summary = itemSummary("Loan", loan);
      const row = document.createElement("div");
      row.className = "item item-readonly";
      row.innerHTML = "<span class=\"item-name\">Mortgage</span><span class=\"item-value\"></span>"
        + "<span class=\"item-detail\"></span>";
      row.querySelector(".item-value").textContent = summary.value;
      row.querySelector(".item-detail").textContent = (loan.name ? loan.name + " · " : "") + summary.detail
        .replace(/^Mortgage · /, "");
      wrap.append(row);
    }
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-quiet";
    edit.textContent = "Edit the mortgage on Home";
    edit.addEventListener("click", () => {
      state.chips.settings = "home";
      savePrefs();
      renderSettings();
    });
    wrap.append(edit);
    return [wrap];
  }

  // The Loans chip's read-only car loan rows, one per car that charges a loan (hasCarLoan), titled with the car's name:
  // the amount owed today, or borrowed at a later purchase, and when the loan starts (bought later) and ends (sold),
  // with a button that opens the Cars chip where the loan is edited; nothing without a car loan.
  function carLoanRows() {
    const owing = (state.inputs.cars || []).filter((car) => hasCarLoan(car));
    if (!owing.length) return [];
    const wrap = fieldShell("Car loans", "Read-only here: a car loan is entered and edited with its car on the Cars chip.",
      null);
    wrap.classList.add("car-loan-rows");
    for (const car of owing) {
      const row = document.createElement("div");
      row.className = "item item-readonly";
      row.innerHTML = "<span class=\"item-name\"></span><span class=\"item-value\"></span>"
        + "<span class=\"item-detail\"></span>";
      const span = spanText(car, state.inputs.you.currentAge).replace("buys at", "starts at")
        .replace("sells at", "ends at") + (car.sellsLater && car.saleAge != null ? " (sold)" : "");
      row.querySelector(".item-name").textContent = car.name;
      row.querySelector(".item-value").textContent = compactMoney(car.buysLater
        ? car.purchasePrice * (1 - car.downPaymentRate) : car.loanBalance);
      row.querySelector(".item-detail").textContent = car.name + " loan · " + percent(car.loanRate, 2) + " · "
        + car.loanMonthsLeft + " months" + (span ? " · " + span : "");
      wrap.append(row);
    }
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-quiet";
    edit.textContent = "Edit car loans on Cars";
    edit.addEventListener("click", () => {
      state.chips.settings = "cars";
      savePrefs();
      renderSettings();
    });
    wrap.append(edit);
    return [wrap];
  }

  // Whether a panel shows a field now: true unless its `conditions` name a path that holds another value (or, for
  // `notEmpty`, a list with no item: the child inflation factor without children).
  function conditionMet(panel, name) {
    const condition = panel.conditions && panel.conditions[name];
    if (!condition) return true;
    const value = getPath(state.inputs, condition.path);
    return condition.notEmpty ? Array.isArray(value) && value.length > 0 : value === condition.equals;
  }

  // Whether a path decides which fields a panel shows, so editing it redraws the form.
  function isConditionPath(path) {
    return state.schema.panels.some((panel) => panel.conditions
      && Object.values(panel.conditions).some((condition) => condition.path === path));
  }

  // Reset to defaults: puts the shipped figures of each group back (the visits and the plan's cost sharing);
  // editing any of them turns that group's defaults off again.
  function resetDefaultsButton(roots) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-quiet reset-defaults";
    button.textContent = "Reset to defaults";
    button.setAttribute("aria-label",
      "Reset the visits, prices, drugs and the plan's cost sharing to the shipped defaults");
    button.addEventListener("click", () => {
      for (const root of roots) resetGroup(state.schema, state.inputs, root);
      inputsChanged();
      renderSettings();
    });
    return button;
  }

  // A section's switch, such as whether the household has a medical plan; turning it redraws the section.
  function sectionSwitch(path) {
    const field = panelField(state.schema, path);
    const id = fieldId(path);
    const element = switchField(field.label, field.help, id, Boolean(getPath(state.inputs, path)), (checked) => {
      setValue(path, checked);
      refreshForm();
      const redrawn = $(id);
      if (redrawn) redrawn.focus();
    });
    element.classList.add("pane-switch");  // its toggle sits at the right of the pane's title
    return element;
  }

  // ---- Benefits, Retirement plan: its switch and each person's employer match (panel fields, drawn first), then the
  // household plan in a disclosure, and a deposit slider per account ----
  function savingsFields(field, path) {
    const children = (state.schema.types[field.type] || []).filter((child) => child.name !== "enabled");
    const plan = document.createElement("details");
    plan.className = "plan-details";
    plan.open = state.planOpen;
    plan.addEventListener("toggle", () => { state.planOpen = plan.open; });
    plan.innerHTML = "<summary>Household plan (used until you set account amounts)</summary><p class=\"info-box\">"
      + "Each person's Traditional deposit and employer match go into the first Traditional account they own (a 401k "
      + "before an IRA), else the first Traditional account; the Roth deposit goes into the first Roth account. The "
      + "yearly limits come from the law data.</p>";
    for (const child of children) plan.append(fieldElement(child, path + "." + child.name));
    return [plan];
  }

  function depositSection() {
    const part = document.createElement("div");
    part.className = "surplus deposits";
    part.id = "deposits";
    part.innerHTML = "<p class=\"field-label deposit-title\">Deposit per account</p><div class=\"surplus-body\" "
      + "id=\"depositBody\"><p class=\"note\">Reading the limits</p></div>";
    return part;
  }

  function depositsWanted() {
    return state.tab === "inputs" && state.chips.settings === "savings" && state.schema != null;
  }

  async function requestDeposits() {
    if (!depositsWanted()) return;
    const inputsText = JSON.stringify(state.inputs);
    let reply;
    try {
      reply = await engine.call("depositSliders", [inputsText], "deposits");
    } catch (error) {
      return;
    }
    if (!reply || inputsText !== JSON.stringify(state.inputs)) return;  // a newer edit asks again
    state.deposits = reply.value;
    renderDeposits();
  }

  // Draw the sliders from state.deposits (depositSliders). The rows are rebuilt only when the accounts, their room
  // or the mode change, so a slider being dragged keeps its place; otherwise only the values and maximums move.
  function renderDeposits() {
    const holder = $("depositBody");
    const deposits = state.deposits;
    if (!holder || !deposits) return;
    if (!deposits.ok || !deposits.accounts.length) {
      holder.dataset.key = "";
      holder.innerHTML = deposits.ok ? "<p class=\"banner\">" + escapeText(deposits.empty) + "</p>"
        : "<p class=\"banner banner-warn\" role=\"note\">Fix the settings to set deposits. " + escapeText(deposits.error)
          + "</p>";
      return;
    }
    const key = JSON.stringify([deposits.perAccount, deposits.notes, deposits.accounts.map((item) =>
      [item.name, item.kind, item.owner, item.noRoom])]);
    if (holder.dataset.key !== key) {
      holder.dataset.key = key;
      holder.replaceChildren(...depositRows(deposits));
    }
    deposits.accounts.forEach((item, position) => {
      const row = holder.querySelector(".deposit-row[data-position=\"" + position + "\"]");
      if (!row) return;
      row.querySelector(".surplus-value").textContent = fullMoney(item.value);
      const slider = row.querySelector("input[type=range]");
      slider.max = String(item.maximum);
      if (!(depositMove.pending && depositMove.name === item.name)) slider.value = String(item.value);
      slider.setAttribute("aria-valuetext", fullMoney(item.value));
      row.querySelector(".deposit-help").textContent = "Limit " + fullMoney(item.limit) + " a year, of which the "
        + "owner's other accounts in the group take " + fullMoney(item.usedByOthers) + "; at most "
        + fullMoney(item.maximum) + " here.";
    });
  }

  function depositRows(deposits) {
    const caption = document.createElement("p");
    caption.className = "info-box";  // the deposit-per-account explanation
    caption.textContent = deposits.caption;
    const parts = [caption];
    deposits.owners.forEach((heading, owner) => {
      const owned = deposits.accounts.map((item, position) => [item, position]).filter(([item]) => item.owner === owner);
      if (!owned.length) return;
      const title = document.createElement("p");
      title.className = "field-label deposit-owner";
      title.textContent = heading;
      parts.push(title);
      for (const [item, position] of owned) {
        if (item.noRoom) {
          const note = document.createElement("p");
          note.className = "info-box";
          note.textContent = item.name + " (" + item.kind + "): no room, " + item.noRoom + ".";
          parts.push(note);
          continue;
        }
        const row = document.createElement("div");
        row.className = "surplus-row deposit-row";
        row.dataset.position = String(position);
        row.innerHTML = "<div class=\"deposit-head\"><label class=\"field-label\"></label><output class=\"surplus-value\">"
          + "</output></div><input type=\"range\" class=\"range\" min=\"0\"><p class=\"field-help deposit-help\"></p>";
        const id = "deposit-" + position;
        const label = row.querySelector("label");
        label.textContent = item.name + " (" + item.kind + ")";
        label.htmlFor = id;
        const slider = row.querySelector("input");
        slider.id = id;
        slider.step = String(deposits.step);
        slider.max = String(item.maximum);
        slider.value = String(item.value);
        slider.addEventListener("input", () => moveDeposit(item.name, Number(slider.value)));
        parts.push(row);
      }
    });
    for (const text of deposits.notes) {
      const note = document.createElement("p");
      note.className = "info-box";
      note.textContent = text;
      parts.push(note);
    }
    if (deposits.perAccount) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "button button-quiet";
      back.textContent = "Go back to the household plan";
      back.addEventListener("click", useHouseholdPlan);
      parts.push(back);
    }
    return parts;
  }

  // Send a deposit slider move to wmti (moveDeposit). One move is in flight at a time; while it runs only the
  // newest position is kept, as for the surplus sliders.
  const depositMove = { busy: false, pending: null, name: null };

  async function moveDeposit(name, amount) {
    if (depositMove.busy) {
      depositMove.pending = { name, amount };
      depositMove.name = name;
      return;
    }
    depositMove.busy = true;
    depositMove.name = name;
    let reply = null;
    try {
      reply = await engine.call("moveDeposit", [JSON.stringify(state.inputs), name, amount]);
    } catch (error) {
      reply = null;
    }
    depositMove.busy = false;
    if (reply && !reply.value.inputs) {
      state.error = reply.value.error;
      renderSettingsError();
    }
    if (reply && reply.value.inputs) {
      const accounts = reply.value.inputs.accounts;
      state.inputs.accounts.forEach((account, position) => {
        if (accounts[position]) account.deposit = accounts[position].deposit;
      });
      if (reply.value.sliders) state.deposits = reply.value.sliders;
      inputsChanged();
    }
    const next = depositMove.pending;
    depositMove.pending = null;
    renderDeposits();
    if (next) moveDeposit(next.name, next.amount);
  }

  // Blank every 401k and IRA deposit, so the household plan applies again (the desktop's button).
  function useHouseholdPlan() {
    const kinds = state.info.sheetRules.depositKinds;
    for (const account of state.inputs.accounts) if (kinds.includes(account.kind)) account.deposit = null;
    inputsChanged();
    requestDeposits();
  }

  // ---- Retirement: each person's benefit table, earnings estimate and claim ages (benefitTables), drawn under the
  // claim age ----
  function benefitBox(role) {
    const box = document.createElement("div");
    box.className = "benefit";
    box.id = "benefit-" + role;
    box.innerHTML = "<p class=\"note\">Reading the benefit table</p>";
    return box;
  }

  function benefitsWanted() {
    return state.tab === "inputs" && state.chips.settings === "retirement" && state.schema != null;
  }

  async function requestBenefits() {
    if (!benefitsWanted()) return;
    const inputsText = JSON.stringify(state.inputs);
    let reply;
    try {
      reply = await engine.call("benefitTables", [inputsText], "benefits");
    } catch (error) {
      return;
    }
    if (!reply || inputsText !== JSON.stringify(state.inputs)) return;  // a newer edit asks again
    state.benefits = reply.value;
    applyBenefits();
  }

  function applyBenefits() {
    const benefits = state.benefits;
    if (!benefits) return;
    if (!benefits.ok) {
      for (const box of document.querySelectorAll(".benefit")) {
        box.innerHTML = "<p class=\"banner banner-warn\" role=\"note\">" + escapeText(benefits.error) + "</p>";
      }
      return;
    }
    for (const person of benefits.people) {
      const box = $("benefit-" + person.role);
      if (box) box.innerHTML = benefitHtml(person);
      updateClaimSelect(person);
    }
  }

  // The benefit used at the claim age, then, as the desktop Retirement tab prints them: on Manual entry (or an
  // earnings basis the estimate cannot cover) the read-only benefit table (age, entered, used, basis); on Earnings
  // history only the estimate with its caption and warnings.
  function benefitHtml(person) {
    let html = person.used ? "<p class=\"field-help benefit-used\">" + escapeText(person.used) + "</p>" : "";
    if (person.basisError) html += "<p class=\"banner banner-error\" role=\"alert\">" + escapeText(person.basisError) + "</p>";
    if (person.basis !== "earnings" || person.basisError) {
      const help = titleHelp("p", "Benefit table", "Read-only: the monthly benefit at each claim age in today's value. "
        + "Benefit used is what the model pays; the ages from 62 to 70 you did not enter are estimated. Enter amounts in "
        + "“Social Security benefit by claim age” above.", "field-label");
      return html + help.head + help.text + charts.renderUnitsTable({ columns: ["Claim age", "Benefit you enter",
        "Benefit used", "Basis"], data: person.table.data }, ["text", "money", "money", "text"], { title: "Benefit table" });
    }
    const estimate = person.estimate;
    if (!estimate) return html;
    const about = titleHelp("p", "Estimate from earnings", estimate.note, "field-label");  // EARNINGS_NOTE as a tooltip
    html += about.head + about.text;
    if (estimate.error) return html + "<p class=\"banner banner-warn\" role=\"note\">" + escapeText(estimate.error) + "</p>";
    return html + "<p class=\"field-help\">" + escapeText(estimate.caption) + "</p>"
      + charts.renderUnitsTable({ columns: ["Claim age", "Estimated benefit"], data: estimate.rows }, ["text", "money"],
        { title: "Estimate from earnings" })
      + estimate.warnings.map((warning) => "<p class=\"banner banner-warn\" role=\"note\">" + escapeText(warning)
        + "</p>").join("");
  }

  // The claim ages a select offers: every age of the benefit table, plus the saved age when it is not among them.
  function claimAgeList(ages, value) {
    return value != null && !ages.includes(value) ? ages.concat([value]).sort((left, right) => left - right) : ages;
  }

  // Put the benefit table's ages into a person's claim-age select in place, so focus and scrolling stay.
  function updateClaimSelect(person) {
    const select = $(fieldId(person.role + ".socialSecurityAge"));
    if (!select) return;
    const value = getPath(state.inputs, person.role + ".socialSecurityAge");
    const ages = claimAgeList(person.claimAges, value).map(String);
    if (JSON.stringify([...select.options].map((option) => option.value)) === JSON.stringify(ages)) return;
    select.replaceChildren(...ages.map((age) => {
      const option = document.createElement("option");
      option.value = age;
      option.textContent = age;
      return option;
    }));
    select.value = value == null ? "" : String(value);
  }

  // ---- Settings notes: surplus split, owner choices, warnings, the model's terminal rate estimate on Summary (settingsNotes) ----
  function notesWanted() {
    return state.schema != null && ((state.tab === "inputs" && NOTES_PANELS.has(state.chips.settings))
      || (state.tab === "outputs" && state.view === "summary"));  // Summary shows the model's estimate of the terminal rate
  }

  async function requestNotes() {
    if (!notesWanted()) return;
    const inputsText = JSON.stringify(state.inputs);
    let reply;
    try {
      reply = await engine.call("settingsNotes", [inputsText, state.seed], "notes");
    } catch (error) {
      return;
    }
    if (!reply || inputsText !== JSON.stringify(state.inputs)) return;  // a newer edit asks again
    if (!reply.value.ok) {
      state.error = reply.value.error;
      renderSettingsError();
      return;
    }
    state.notes = reply.value;
    applyNotes();
  }

  function warningsBox(id) {
    const box = document.createElement("div");
    box.id = id;
    box.className = "warnings";
    return box;
  }

  function fillWarnings(id, warnings) {
    const box = $(id);
    if (!box) return;
    box.replaceChildren(...(warnings || []).map((text) => {
      const item = document.createElement("p");
      item.className = "banner banner-warn";
      item.setAttribute("role", "note");
      item.textContent = text;
      return item;
    }));
  }

  function applyNotes() {
    const notes = state.notes;
    if (!notes) return;
    fillWarnings("owner-warnings", notes.ownerWarnings);
    fillWarnings("strategy-warnings", notes.strategyWarnings);
    fillWarnings("car-warnings", notes.carWarnings);
    fillWarnings("medicare-warnings", notes.medicareWarnings);
    fillWarnings("summary-warnings", notes.medicareWarnings);
    const countedCard = $("alreadyCounted");
    if (countedCard) fillAlreadyCounted(countedCard);
    const summaryCard = $("expenseSummary");
    if (summaryCard) fillExpenseSummary(summaryCard);
    renderSurplus();
    updateTerminalRate();
  }

  // ---- Where surplus cash goes: a slider and a lock per cash or Investments account, always totalling 100% ----
  const surplusMove = { busy: false, pending: null, name: null };

  function surplusSection() {
    const group = document.createElement("fieldset");
    group.className = "group surplus";
    group.id = "surplus";
    const id = newHelpId();
    group.innerHTML = "<legend class=\"legend-help\"><span>Where surplus cash goes</span>"
      + helpButtonHtml("Where surplus cash goes", id) + "</legend>" + helpTextHtml(id, "Cash left over after spending "
      + "and saving is deposited into these accounts. Drag a slider and the unlocked ones move so the total stays "
      + "100%; lock an account to keep its share. Retirement accounts and HSAs never receive surplus.")
      + "<div class=\"surplus-body\" id=\"surplusBody\"><p class=\"note\">Reading the split</p></div>";
    return group;
  }

  function lockedNames(names) {
    return state.surplusLocks.filter((name) => names.includes(name));
  }

  // Draw the split from state.notes.surplus. The rows are rebuilt only when the accounts or locks change, so a slider
  // being dragged keeps its place; otherwise only the values move.
  function renderSurplus() {
    const holder = $("surplusBody");
    if (!holder || !state.notes) return;
    const shares = state.notes.surplus;
    const names = shares.map(([name]) => name);
    const locked = lockedNames(names);
    const unlocked = names.filter((name) => !locked.includes(name));
    const key = JSON.stringify([names, locked]);
    if (holder.dataset.key !== key) {
      holder.dataset.key = key;
      holder.replaceChildren(...surplusRows(names, locked, unlocked));
    }
    shares.forEach(([name, share], position) => {
      const row = holder.querySelector(".surplus-row[data-position=\"" + position + "\"]");
      if (!row) return;
      row.querySelector(".surplus-value").textContent = percent(share, 1);
      const slider = row.querySelector("input[type=range]");
      if (!(surplusMove.pending && surplusMove.name === name)) slider.value = String(share * 100);
      slider.setAttribute("aria-valuetext", percent(share, 1));
      const segment = holder.querySelector(".split-bar [data-position=\"" + position + "\"]");
      if (segment) segment.style.flexGrow = String(share);
    });
    const total = holder.querySelector(".surplus-total strong");
    if (total) total.textContent = percent(shares.reduce((sum, [, share]) => sum + share, 0), 0);
  }

  function surplusRows(names, locked, unlocked) {
    if (!names.length) {
      const warning = document.createElement("p");
      warning.className = "banner banner-warn";
      warning.textContent = "Add a cash or Investments account to receive surplus cash.";
      return [warning];
    }
    const bar = document.createElement("div");
    bar.className = "split-bar";
    bar.setAttribute("aria-hidden", "true");
    names.forEach((name, position) => {
      const segment = document.createElement("span");
      segment.dataset.position = String(position);
      segment.style.background = "var(--s" + (position % 8) + ")";
      bar.append(segment);
    });
    const rows = names.map((name, position) => {
      const isLocked = locked.includes(name);
      const fixed = isLocked || unlocked.length <= 1;
      const row = document.createElement("div");
      row.className = "surplus-row";
      row.dataset.position = String(position);
      const id = "surplus-" + position;
      row.innerHTML = "<div class=\"surplus-head\"><span class=\"surplus-key\"></span><label class=\"field-label\"></label>"
        + "<output class=\"surplus-value\"></output></div><div class=\"surplus-control\"><input type=\"range\" "
        + "class=\"range\" min=\"0\" max=\"100\" step=\"1\"><button type=\"button\" class=\"lock\">"
        + "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"5\" y=\"11\" width=\"14\" height=\"10\" rx=\"2\"/>"
        + "<path class=\"shackle\"/></svg></button></div>";
      row.querySelector(".surplus-key").style.background = "var(--s" + (position % 8) + ")";
      const label = row.querySelector("label");
      label.textContent = name;
      label.htmlFor = id;
      const slider = row.querySelector("input");
      slider.id = id;
      slider.disabled = fixed;
      slider.addEventListener("input", () => moveSurplus(name, Number(slider.value) / 100));
      const lock = row.querySelector(".lock");
      lock.setAttribute("aria-pressed", String(isLocked));
      lock.setAttribute("aria-label", (isLocked ? "Unlock " : "Lock ") + name);
      lock.querySelector(".shackle").setAttribute("d", isLocked ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.5-2");
      lock.hidden = names.length === 1;
      lock.addEventListener("click", () => {
        state.surplusLocks = isLocked ? state.surplusLocks.filter((item) => item !== name)
          : state.surplusLocks.concat([name]);
        savePrefs();
        renderSurplus();
        const again = $("surplusBody").querySelector(".surplus-row[data-position=\"" + position + "\"] .lock");
        if (again) again.focus();
      });
      return row;
    });
    const footer = document.createElement("p");
    footer.className = "surplus-total";
    footer.innerHTML = "Total <strong></strong>";
    const hint = document.createElement("p");
    hint.className = "field-help";
    if (names.length === 1) hint.textContent = "Only one account can receive surplus cash, so it takes all of it.";
    else if (!unlocked.length) hint.textContent = "Every account is locked. Unlock one to change the split.";
    else if (unlocked.length === 1) hint.textContent = "Every other account is locked, so " + unlocked[0]
      + " keeps what the locked ones leave. Unlock another account to move it.";
    return [bar, ...rows, footer].concat(hint.textContent ? [hint] : []);
  }

  // Send a slider move to wmti (rebalanceSurplus). One move is in flight at a time; while it runs only the newest
  // position is kept, so the shares always follow the desktop rule step by step.
  async function moveSurplus(name, share) {
    if (surplusMove.busy) {
      surplusMove.pending = { name, share };
      surplusMove.name = name;
      return;
    }
    surplusMove.busy = true;
    surplusMove.name = name;
    const names = state.notes ? state.notes.surplus.map(([item]) => item) : [];
    let reply = null;
    try {
      reply = await engine.call("rebalanceSurplus", [JSON.stringify(state.inputs), name, share,
        JSON.stringify(lockedNames(names))]);
    } catch (error) {
      reply = null;
    }
    surplusMove.busy = false;
    if (reply && !reply.value.inputs) {
      state.error = reply.value.error;
      renderSettingsError();
    }
    if (reply && reply.value.inputs) {
      const accounts = reply.value.inputs.accounts;
      state.inputs.accounts.forEach((account, position) => {
        if (accounts[position]) account.surplusShare = accounts[position].surplusShare;
      });
      state.notes = Object.assign({}, state.notes, { surplus: reply.value.shares });
      inputsChanged();
    }
    const next = surplusMove.pending;
    surplusMove.pending = null;
    renderSurplus();
    if (next) moveSurplus(next.name, next.share);
  }

  // ---- Terminal tax rate on Outputs, Summary: blank uses the model's estimate (shown as the placeholder), a typed
  // rate is used instead; Use the model's estimate clears it. An edit reruns the outputs like any other setting ----
  const TERMINAL_PATH = "strategies.terminalTaxRate";
  const TERMINAL_HELP = "Combined federal and state rate charged on Traditional money left at the end. It sets the "
    + "final net worth after terminal tax on this tab; saved with a config, it is how strategies are compared after "
    + "tax (the after-tax columns of Compare). Leave it blank to use the model's estimate shown in the box; type a rate "
    + "to use your own.";
  const AFTER_TAX_LABEL = "Final net worth after terminal tax";

  function renderTerminalRate(shown) {
    const holder = $("terminal-card");
    holder.hidden = !shown || !state.schema;
    if (holder.hidden) return;
    if (!holder.firstChild) holder.append(...terminalRateCard());
    updateTerminalRate();
  }

  function terminalRateCard() {
    const field = state.schema.types.StrategyPlan.find((item) => item.name === "terminalTaxRate");
    const wrap = fieldShell(field.label, TERMINAL_HELP, "f-terminal-rate");
    wrap.classList.add("terminal-rate");
    wrap.append(numberInput("f-terminal-rate", field, getPath(state.inputs, TERMINAL_PATH), (value) => {
      setValue(TERMINAL_PATH, value);
      updateTerminalRate();
    }));
    const row = document.createElement("div");
    row.className = "row-buttons";
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "button button-quiet";
    reset.id = "terminal-reset";
    reset.textContent = "Use the model's estimate";
    reset.addEventListener("click", () => {
      $("f-terminal-rate").value = "";
      setValue(TERMINAL_PATH, null);
      updateTerminalRate();
    });
    row.append(reset);
    const caption = document.createElement("p");
    caption.className = "field-help";
    caption.id = "terminal-caption";
    wrap.append(row, caption);
    return [wrap];
  }

  // Show the model's estimate as the placeholder and in the caption, and the stored rate in the box unless it is being
  // typed in.
  function updateTerminalRate() {
    const input = $("f-terminal-rate");
    if (!input) return;
    const value = getPath(state.inputs, TERMINAL_PATH);
    if (document.activeElement !== input) input.value = value == null ? "" : String(Number((value * 100).toFixed(8)));
    $("terminal-reset").disabled = value == null;
    const advice = state.notes ? state.notes.terminalRate : null;
    input.placeholder = advice ? (advice.recommended * 100).toFixed(1) + " (model's estimate)" : "Model's estimate";
    $("terminal-caption").textContent = advice ? advice.caption + (value == null ? "."
      : "; the rate typed here is used instead.") : "";
  }

  // ---- Help: an "i" button that shows or hides an explanation in place; one click handler in wire() ----
  let helpCount = 0;

  function newHelpId() {
    helpCount += 1;
    return "help-" + helpCount;
  }

  function helpButtonHtml(label, helpId) {
    return "<button type=\"button\" class=\"help-button\" aria-expanded=\"false\" aria-controls=\"" + helpId
      + "\" aria-label=\"About " + escapeText(label) + "\"><span>i</span></button>";
  }

  function helpTextHtml(helpId, text, extraClass) {
    return "<p class=\"field-help" + (extraClass ? " " + extraClass : "") + "\" id=\"" + helpId + "\" hidden>"
      + escapeText(text) + "</p>";
  }

  // A heading with its "i" button: `head` goes where the heading was, `text` (hidden until tapped) below it.
  function titleHelp(tag, label, help, className) {
    const id = newHelpId();
    return { head: "<div class=\"title-help\"><" + tag + (className ? " class=\"" + className + "\"" : "") + ">"
      + escapeText(label) + "</" + tag + ">" + helpButtonHtml(label, id) + "</div>", text: helpTextHtml(id, help) };
  }

  // Put an "i" button beside a chart's title and its explanation under the title.
  function addChartHelp(card, label, help) {
    const title = card.querySelector(".chart-title");
    if (!title) return;
    const id = newHelpId();
    const wrap = document.createElement("span");
    wrap.className = "title-help";
    title.replaceWith(wrap);
    wrap.append(title);
    wrap.insertAdjacentHTML("beforeend", helpButtonHtml(label, id));
    card.querySelector("figcaption").insertAdjacentHTML("afterend", helpTextHtml(id, help));
  }

  function toggleHelp(button) {
    const text = $(button.getAttribute("aria-controls"));
    if (!text) return;
    text.hidden = !text.hidden;
    button.setAttribute("aria-expanded", String(!text.hidden));
  }

  function fieldShell(label, help, id) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const head = document.createElement("div");
    head.className = "field-head";
    const title = document.createElement(id ? "label" : "span");
    title.className = "field-label";
    title.textContent = label;
    if (id) title.htmlFor = id;
    head.append(title);
    wrap.append(head);
    if (help) {
      const helpId = (id || newHelpId()) + "-help";
      head.insertAdjacentHTML("beforeend", helpButtonHtml(label, helpId));
      wrap.insertAdjacentHTML("beforeend", helpTextHtml(helpId, help));
    }
    return wrap;
  }

  function fieldId(path) {
    return "f-" + path.replace(/[^A-Za-z0-9_-]/g, "-");
  }

  function partnerField() {
    const control = state.schema.controls.hasPartner;
    return switchField(control.label, control.help, "f-hasPartner", state.inputs.partner != null, async (checked) => {
      const reply = await ask("setPartner", [JSON.stringify(state.inputs), checked]);
      if (!reply || !reply.inputs) {
        state.error = reply ? reply.error : "The partner switch did not answer; try again.";
        setStatus("error", "Check settings");
        renderSettings();
        return;
      }
      state.inputs = reply.inputs;
      renderSettings();
      inputsChanged();
    });
  }

  function seedField() {
    const control = state.schema.controls.seed;
    const wrap = fieldShell(control.label, control.help, "f-seed");
    wrap.append(numberInput("f-seed", { kind: "integer", step: control.step }, state.seed, (value) => {
      state.seed = value;
      inputsChanged();
    }));
    return wrap;
  }

  function switchField(label, help, id, checked, onChange) {
    const wrap = fieldShell(label, help, null);
    const head = wrap.querySelector(".field-head");
    head.classList.add("switch-row");
    const holder = document.createElement("span");
    holder.className = "switch";
    holder.innerHTML = "<input type=\"checkbox\" role=\"switch\"><span></span>";
    const input = holder.querySelector("input");
    input.id = id;
    input.checked = checked;
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => onChange(input.checked));
    const help_ = head.querySelector(".help-button");
    head.insertBefore(holder, help_ || null);
    head.querySelector(".field-label").style.flex = "1";
    return wrap;
  }

  function scaleOf(field) {
    return field.unit === "percent" ? 100 : 1;
  }

  function shown(value, scale) {
    return value == null ? "" : String(Number((value * scale).toFixed(8)));
  }

  // A number box for a field (money gets a $ prefix, percent a % suffix and is shown times 100). Blank means
  // null for a nullable field; text that is not a number marks the box invalid and changes nothing.
  function numberInput(id, field, value, commit) {
    const scale = scaleOf(field);
    const input = document.createElement("input");
    input.className = "input";
    input.id = id;
    input.type = "text";
    input.inputMode = field.kind === "integer" ? "numeric" : "decimal";
    input.autocomplete = "off";
    input.value = shown(value, scale);
    if (field.nullable) input.placeholder = "Blank";
    const problem = document.createElement("p");
    problem.className = "field-error";
    problem.hidden = true;
    input.addEventListener("input", () => {
      const text = input.value.trim().replace(/[$,%\s]/g, "");
      let next;
      let error = null;
      if (text === "") {
        if (field.nullable) next = null;
        else error = "Enter a number.";
      } else if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) {
        error = "Enter a number, such as 1500 or 2.5.";
      } else {
        next = Number(text) / scale;
        if (field.kind === "integer") {
          if (!Number.isInteger(Number(text))) error = "Enter a whole number.";
          next = Number(text);
        } else {
          next = Number(next.toPrecision(12));
        }
      }
      input.setAttribute("aria-invalid", String(Boolean(error)));
      problem.hidden = !error;
      problem.textContent = error || "";
      if (!error) commit(next);
    });
    let box = input;
    if (field.unit === "money" || field.unit === "percent") {
      box = document.createElement("div");
      box.className = "affix";
      if (field.unit === "money") box.dataset.prefix = "$";
      else box.dataset.suffix = "%";
      box.append(input);
    }
    const holder = document.createDocumentFragment();
    holder.append(box, problem);
    return holder;
  }

  function setValue(path, value) {
    const account = /^accounts\.(\d+)\.(\w+)$/.exec(path);
    const before = getPath(state.inputs, path);
    setPath(state.inputs, path, value);
    // An edit makes an account the user's own: the Roth conversion switch no longer removes it.
    const item = account && state.inputs.accounts[Number(account[1])];
    if (item && item.autoCreated && account[2] !== "autoCreated" && before !== value) item.autoCreated = false;
    if (path === ROLLOVER_SWITCH) {
      syncRollover();
      return;
    }
    inputsChanged();
  }

  // The Roth conversion switch adds or removes the rollover account (wmti syncRolloverAccounts); the page is redrawn
  // at once so the account list shows it.
  async function syncRollover() {
    const reply = await ask("syncRollover", [JSON.stringify(state.inputs)]);
    if (!reply || !reply.inputs) {
      state.error = reply ? reply.error : "The conversion switch did not answer; try again.";
      setStatus("error", "Check settings");
      renderSettings();
      return;
    }
    state.inputs = reply.inputs;
    renderSettings();
    inputsChanged();
  }

  // Fields with their own control: the surplus share (moved by the sliders under Accounts) and the account owner (its
  // choices depend on the household).
  function specialField(field, path, value) {
    if (/^accounts\.\d+\.surplusShare$/.test(path)) {
      const wrap = fieldShell(field.label, field.help, null);
      const note = document.createElement("p");
      note.className = "info-box";
      note.textContent = percent(value, 1) + ". Set it under “Where surplus cash goes” on the Accounts page; the shares "
        + "are scaled to total 100% and only cash and Investments accounts receive surplus.";
      wrap.append(note);
      return wrap;
    }
    if (/^(you|partner)\.socialSecurityBasis$/.test(path)) return basisToggle(field, path, value);
    return null;
  }

  // The Social Security basis as a two-position toggle (Earnings history, Manual entry), as on the desktop. Without an
  // earnings history Earnings history is disabled with a hint, so the basis stays on the table the loader accepts.
  function basisToggle(field, path, value) {
    const wrap = fieldShell(field.label, field.help, null);
    const group = document.createElement("div");
    group.className = "segmented";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", field.label);
    group.id = fieldId(path);
    const person = getPath(state.inputs, path.split(".")[0]) || {};
    const history = person.salaryHistory;
    const hasHistory = person.earningsHistoryMode === "lastSalary" ? Number(person.lastSalary) > 0
      : history != null && Object.keys(history).length > 0;
    const hint = document.createElement("p");
    hint.className = "field-help basis-hint";
    hint.id = group.id + "-hint";
    hint.textContent = NO_EARNINGS_HINT;
    for (const choice of Object.keys(field.choiceLabels)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.basis = choice;
      button.textContent = field.choiceLabels[choice];
      button.setAttribute("aria-pressed", String(choice === value));
      if (choice === "earnings" && !hasHistory) {
        button.setAttribute("aria-describedby", hint.id);
        button.disabled = value !== "earnings";  // an earnings basis already set stays visible; its error explains it
      }
      button.addEventListener("click", () => {
        if (choice === getPath(state.inputs, path)) return;
        setValue(path, choice);
        refreshForm();  // the entered table shows only on Manual entry
      });
      group.append(button);
    }
    wrap.append(group);
    if (!hasHistory) wrap.append(hint);
    return wrap;
  }

  // A field whose schema entry has `inflationNote` (its help ends with the note that the mean inflation is subtracted
  // in today's value) gets a red "i" button.
  function fieldElement(field, path, filter) {
    const element = fieldControl(field, path, filter);
    const button = field.inflationNote && element.querySelector(":scope > .field-head > .help-button");
    if (button) button.classList.add("help-inflation");
    return element;
  }

  // `filter` (a panel's list filter, see filteredPositions) limits which items of a list field are shown.
  function fieldControl(field, path, filter) {
    const value = getPath(state.inputs, path);
    const id = fieldId(path);
    const special = specialField(field, path, value);
    if (special) return special;
    switch (field.kind) {
      case "toggle":
        return switchField(field.label, field.help, id, Boolean(value), (checked) => {
          setValue(path, checked);
          afterSheetEdit(path);
        });
      case "select": {
        const wrap = fieldShell(field.label, field.help, id);
        const select = document.createElement("select");
        select.className = "input";
        select.id = id;
        const table = filingTable(state.inputs.filingStatus);
        let choices = field.choicesByFilingTable ? field.choicesByFilingTable[table]
          : field.choicesFrom ? choicesFrom(field, path) : field.choices;
        const choiceLabels = field.choiceLabelsByFilingTable
          ? field.choiceLabelsByFilingTable[table] : field.choiceLabels;
        const allowed = sheetAllowed(field, path);  // a filtered list's item offers only the panel's values
        if (allowed) choices = allowed.concat(value != null && !allowed.includes(value) ? [value] : []);
        // A claim age at an estimated table age is not a key of the stored table; keep it selectable, not blank.
        if (field.choicesFrom && value != null && !choices.includes(value)) {
          choices = choices.concat([value]).sort((left, right) => left - right);
        }
        if (field.name === "owner" && state.notes && state.notes.ownerOptions) {
          choices = state.notes.ownerOptions.concat(value != null && !state.notes.ownerOptions.includes(value)
            ? [value] : []);
        }
        if (field.name === "account529") {  // a child's college 529: the household's 529 accounts by name
          const names = state.inputs.accounts.filter((account) => account.kind === "529").map((account) => account.name);
          choices = names.concat(value != null && !names.includes(value) ? [value] : []);
        }
        const options = (field.nullable ? [null] : []).concat(choices);
        for (const choice of options) {
          const option = document.createElement("option");
          option.value = choice == null ? "" : String(choice);
          option.textContent = (choiceLabels && choiceLabels[String(choice)])
            || (choice == null ? NULL_LABELS[field.name] || "None" : String(choice));
          select.append(option);
        }
        select.value = value == null ? "" : String(value);
        select.addEventListener("change", () => {
          const raw = select.value;
          let choice = options.find((item) => (item == null ? "" : String(item)) === raw);
          // The claim ages are put in place when the benefit tables arrive, so an age may not be in `options`.
          if (choice === undefined && field.choicesFrom && raw !== "") choice = Number(raw);
          setValue(path, choice === undefined ? null : choice);
          afterSheetEdit(path);
          if (isConditionPath(path)) refreshForm();
        });
        wrap.append(select);
        return wrap;
      }
      case "text": {
        const wrap = fieldShell(field.label, field.help, id);
        const input = document.createElement("input");
        input.className = "input";
        input.id = id;
        input.type = "text";
        input.value = value == null ? "" : value;
        input.addEventListener("input", () => setValue(path, input.value));
        wrap.append(input);
        return wrap;
      }
      case "integer":
      case "number": {
        const wrap = fieldShell(field.label, field.help, id);
        wrap.append(numberInput(id, field, value, (next) => setValue(path, next)));
        return wrap;
      }
      case "triangular":
        return triangularField(field, path, value, id);
      case "normal":
        return normalField(field, path, value, id);
      case "map":
        return mapField(field, path, value, id);
      case "list":
        return listField(field, path, value, filter);
      case "object":
        return objectField(field, path, value);
      default: {
        const wrap = fieldShell(field.label, field.help, null);
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "Not editable here yet.";
        wrap.append(note);
        return wrap;
      }
    }
  }

  // A select whose choices are the keys of a sibling map. The claim age offers every age of the person's benefit
  // table (entered and estimated, from benefitTables) once it has arrived, as the desktop does.
  function choicesFrom(field, path) {
    const parent = path.split(".").slice(0, -1).join(".");
    const card = field.name === "socialSecurityAge" && state.benefits && state.benefits.ok
      && state.benefits.people.find((person) => person.role === parent);
    if (card) return card.claimAges.slice();
    const map = getPath(state.inputs, (parent ? parent + "." : "") + field.choicesFrom) || {};
    return Object.keys(map).map(Number).sort((left, right) => left - right);
  }

  function triangularField(field, path, value, id) {
    const wrap = fieldShell(field.label, field.help, null);
    const row = document.createElement("div");
    row.className = "triple";
    for (const [key, label] of [["minimum", "Low"], ["mode", "Most likely"], ["maximum", "High"]]) {
      const cell = document.createElement("label");
      cell.htmlFor = id + "-" + key;
      cell.textContent = label;
      cell.append(numberInput(id + "-" + key, { kind: "number", unit: field.unit, step: field.step },
        value ? value[key] : null, (next) => setValue(path + "." + key, next)));
      row.append(cell);
    }
    wrap.append(row);
    return wrap;
  }

  // A normal distribution: a mean slider (its range and step from the schema), a standard deviation slider and a
  // small curve that moves with them. A saved value outside a slider's range is shown at the nearer end.
  const NORMAL_STD_DEV_MAX = 0.05;
  const NORMAL_STD_DEV_STEP = 0.0005;
  const CURVE_WIDTH = 240;
  const CURVE_HEIGHT = 60;

  function curvePath(mean, stdDev, low, high) {
    const { xs, ys } = normalCurvePoints(mean, stdDev, low, high, 61);
    const x = (value) => ((value - low) / (high - low) * CURVE_WIDTH).toFixed(1);
    const y = (value) => (CURVE_HEIGHT - 2 - value * (CURVE_HEIGHT - 6)).toFixed(1);
    if (!(stdDev > 0)) {
      const at = xs[ys.indexOf(1)];
      return "M" + x(at) + " " + y(0) + "L" + x(at) + " " + y(1);
    }
    return xs.map((value, index) => (index ? "L" : "M") + x(value) + " " + y(ys[index])).join("");
  }

  function normalCurveSvg(mean, stdDev, low, high) {
    const label = "Normal curve, mean " + percent(mean, 1) + ", standard deviation " + percent(stdDev, 2);
    return "<svg class=\"curve\" viewBox=\"0 0 " + CURVE_WIDTH + " " + CURVE_HEIGHT + "\" preserveAspectRatio=\"none\" "
      + "role=\"img\" aria-label=\"" + escapeText(label) + "\"><path d=\"" + curvePath(mean, stdDev, low, high)
      + "\"></path></svg><div class=\"curve-ends\" aria-hidden=\"true\"><span>" + percent(low, 0) + "</span><span>"
      + percent(high, 0) + "</span></div>";
  }

  function normalField(field, path, value, id) {
    const wrap = fieldShell(field.label, field.help, null);
    const low = field.minimum != null ? field.minimum : 0;
    const high = field.maximum != null ? field.maximum : 0.1;
    const current = { mean: value ? value.mean : 0, stdDev: value ? value.stdDev : 0 };
    const curve = document.createElement("div");
    curve.className = "curve-box";
    const draw = () => { curve.innerHTML = normalCurveSvg(current.mean, current.stdDev, low, high); };
    const parts = [["mean", "Mean", low, high, field.step || 0.001, 1],
      ["stdDev", "Std dev", 0, NORMAL_STD_DEV_MAX, NORMAL_STD_DEV_STEP, 2]];
    for (const [key, label, minimum, maximum, step, digits] of parts) {
      const cell = document.createElement("label");
      cell.className = "normal-part";
      cell.htmlFor = id + "-" + key;
      cell.textContent = label;
      const row = document.createElement("div");
      row.className = "range-row";
      row.innerHTML = "<input type=\"range\" class=\"range\"><output class=\"range-value\"></output>";
      const slider = row.querySelector("input");
      slider.id = id + "-" + key;
      slider.min = String(minimum * 100);
      slider.max = String(maximum * 100);
      slider.step = String(step * 100);
      slider.value = String(Math.min(Math.max(current[key], minimum), maximum) * 100);
      slider.setAttribute("aria-label", field.label + " " + label.toLowerCase());
      const output = row.querySelector("output");
      output.htmlFor = slider.id;
      output.textContent = percent(current[key], digits);
      slider.addEventListener("input", () => {
        current[key] = Number((Number(slider.value) / 100).toFixed(6));
        output.textContent = percent(current[key], digits);
        setValue(path + "." + key, current[key]);
        draw();
      });
      cell.append(row);
      wrap.append(cell);
    }
    draw();
    wrap.append(curve);
    return wrap;
  }

  // Fields of one type that share a schema group, in one disclosure with a Reset that puts each field's schema
  // default back.
  const openGroups = new Set();

  function groupDisclosure(name, fields, path) {
    const details = document.createElement("details");
    details.className = "field-group";
    const openKey = path + "|" + name;
    details.open = openGroups.has(openKey);  // stays open when the form is drawn again
    details.addEventListener("toggle", () => {
      if (details.open) openGroups.add(openKey);
      else openGroups.delete(openKey);
    });
    const summary = document.createElement("summary");
    summary.textContent = name;
    details.append(summary);
    for (const child of fields) details.append(fieldElement(child, path + "." + child.name));
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "button button-quiet";
    reset.textContent = "Reset";
    reset.setAttribute("aria-label", "Reset " + name.toLowerCase() + " to the shipped values");
    reset.addEventListener("click", () => {
      for (const child of fields) setPath(state.inputs, path + "." + child.name, clone(child.default));
      inputsChanged();
      refreshForm();
    });
    details.append(reset);
    return details;
  }

  // `root` is the object `path` points into (the inputs, or the walkthrough's scratch copy) and `onChange(redraw)`
  // what an edit calls (by default the inputs changed, and the form redrawn when rows were added, removed or renamed).
  function mapField(field, path, value, id, root = state.inputs, onChange = null) {
    const changed = (redraw) => {
      if (onChange) { onChange(redraw); return; }
      inputsChanged();
      if (redraw) refreshForm();
    };
    const wrap = fieldShell(field.label, field.help, null);
    const rows = document.createElement("div");
    rows.className = "map-rows";
    const entries = Object.entries(value || {}).sort((left, right) => Number(left[0]) - Number(right[0]));
    const keyLabel = field.keyUnit === "age" ? "Age" : "Year";
    if (!entries.length) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = "No entries.";
      rows.append(note);
    }
    entries.forEach(([key, amount]) => {
      const row = document.createElement("div");
      row.className = "map-row";
      const keyInput = document.createElement("input");
      keyInput.className = "input";
      keyInput.inputMode = "numeric";
      keyInput.value = key;
      keyInput.id = id + "-key-" + key;
      keyInput.setAttribute("aria-label", keyLabel);
      keyInput.addEventListener("change", () => {
        const next = keyInput.value.trim();
        if (!/^\d+$/.test(next) || next === key) { keyInput.value = key; return; }
        const map = getPath(root, path);
        if (next in map) { keyInput.value = key; return; }
        map[next] = map[key];
        delete map[key];
        changed(true);
      });
      const valueBox = document.createElement("div");
      valueBox.append(numberInput(id + "-value-" + key, { kind: "number", unit: field.unit, step: field.step },
        amount, (next) => { setPath(root, path + "." + key, next); changed(false); }));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button";
      remove.setAttribute("aria-label", "Remove " + keyLabel.toLowerCase() + " " + key);
      remove.textContent = "✕";
      remove.addEventListener("click", () => {
        delete getPath(root, path)[key];
        changed(true);
      });
      row.append(keyInput, valueBox, remove);
      rows.append(row);
    });
    const add = document.createElement("button");
    add.type = "button";
    add.className = "button button-quiet";
    add.textContent = "Add " + keyLabel.toLowerCase();
    add.addEventListener("click", () => {
      const map = getPath(root, path);
      const keys = Object.keys(map).map(Number);
      const next = keys.length ? Math.max(...keys) + 1 : (field.keyUnit === "age" ? 67 : new Date().getFullYear() - 1);
      map[String(next)] = 0;
      changed(true);
    });
    wrap.append(rows, add);
    return wrap;
  }

  function objectField(field, path, value) {
    const group = document.createElement("fieldset");
    group.className = "group";
    group.innerHTML = "<legend>" + escapeText(field.label) + "</legend>";
    const optional = field.nullable && path !== "partner";  // the partner has its own switch
    if (value == null) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = path === "partner"
        ? "No partner in this household. Turn on “Include a partner” under Setup, Household & run to add one."
        : "Not set.";
      group.append(note);
      if (optional) group.append(optionalButton("Add " + field.label.toLowerCase(), "button-quiet", () => {
        setPath(state.inputs, path, newItem(field.type));
      }));
      return group;
    }
    group.append(...objectChildren(field, path));
    if (optional) group.append(optionalButton("Remove " + field.label.toLowerCase(), "button-danger", () => {
      setPath(state.inputs, path, null);
    }));
    return group;
  }

  // An object's fields in form order, grouped fields in one disclosure. An object with an `enabled` switch (a
  // strategy) shows only that switch while it is off; switching it on draws the other fields.
  // `headings` (the panel's, by full path) draw a sub-heading before a child (the Roth conversion's ceiling
  // categories), each a section of the pane `group`.
  function objectChildren(field, path, headings = null, group = null) {
    // A child a panel lists by its own `field.child` name is drawn on that panel only (the current ages on Setup, Social
    // Security on Retirement).
    const placed = new Set(state.schema.panels.flatMap((panel) => panel.fields));
    const children = (state.schema.types[field.type] || []).filter((child) => !placed.has(path + "." + child.name));
    const value = getPath(state.inputs, path);
    const gate = children.find((child) => child.name === "enabled" && child.kind === "toggle");
    if (gate) {
      const gatePath = path + ".enabled";
      const id = fieldId(gatePath);
      const gateSwitch = switchField(gate.label, gate.help, id, Boolean(value && value.enabled), (checked) => {
        setValue(gatePath, checked);
        refreshForm();
        const redrawn = $(id);
        if (redrawn) redrawn.focus();
      });
      if (!(value && value.enabled)) return [gateSwitch];
      return [gateSwitch, ...groupedFields(children.filter((child) => child !== gate), path, headings, group)];
    }
    return groupedFields(children, path, headings, group);
  }

  // The earnings history on Income: one disclosure, closed until opened, drawn where `earningsHistoryMode` comes, with
  // the Manual entry / Last salary toggle. Manual entry shows the year-by-year table; Last salary the last salary, its
  // year, the note on the backtrack and the table filled in from them (earningsPreview): read-only until Edit, which
  // makes each year's earnings a box; a year changed from the calculated one is typed over it (`salaryOverrides`) and
  // marked edited, and Revert to calculated clears every typed year. The fields below are drawn inside it only; the
  // typed table is kept while Last salary is chosen.
  const EARNINGS_FIELDS = new Set(["lastSalary", "lastSalaryYear", "salaryHistory", "salaryOverrides"]);
  const earningsEditing = new Set();  // the people (paths) whose Last salary table is open for typing

  function earningsOpenKey(path) {
    return path + "|earnings";
  }

  function earningsHistoryDisclosure(children, path) {
    const byName = Object.fromEntries(children.map((child) => [child.name, child]));
    const modeField = byName.earningsHistoryMode;
    const modePath = path + ".earningsHistoryMode";
    const mode = getPath(state.inputs, modePath) || "manual";
    const details = document.createElement("details");
    details.className = "field-collapse earnings-history";
    details.id = "earnings-" + path;
    const openKey = earningsOpenKey(path);
    details.open = openGroups.has(openKey);  // closed by default; stays open when the form is drawn again
    details.addEventListener("toggle", () => {
      if (details.open) openGroups.add(openKey);
      else openGroups.delete(openKey);
    });
    const summary = document.createElement("summary");
    summary.textContent = modeField.label;
    details.append(summary);
    const id = fieldId(modePath);
    const wrap = fieldShell(modeField.label, modeField.help, null);
    const group = document.createElement("div");  // a two-position toggle, as the Social Security basis (basisToggle)
    group.className = "segmented";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", modeField.label);
    group.id = id;
    for (const choice of modeField.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.mode = choice;
      button.textContent = (modeField.choiceLabels || {})[choice] || choice;
      button.setAttribute("aria-pressed", String(choice === mode));
      button.addEventListener("click", () => {
        if (choice === (getPath(state.inputs, modePath) || "manual")) return;
        setValue(modePath, choice);
        refreshForm();
        const redrawn = document.querySelector("#" + CSS.escape(id) + " [data-mode=\"" + choice + "\"]");
        if (redrawn) redrawn.focus();
      });
      group.append(button);
    }
    wrap.append(group);
    details.append(wrap);
    if (mode !== "lastSalary") {
      if (byName.salaryHistory) details.append(fieldElement(byName.salaryHistory, path + ".salaryHistory"));
      return details;
    }
    for (const name of ["lastSalary", "lastSalaryYear"]) {
      if (byName[name]) details.append(fieldElement(byName[name], path + "." + name));
    }
    const note = document.createElement("div");
    const about = titleHelp("p", "Earnings filled in from your last salary", byName.lastSalary.help, "field-label");
    note.innerHTML = about.head + about.text;
    const table = document.createElement("div");
    table.className = "earnings-preview";
    table.id = "earnings-table-" + path;
    if (earningsEditing.has(path)) table.dataset.editing = "true";
    table.innerHTML = earningsPreviewHtml(path);
    fillEarningsBox(table);
    details.append(note, table, earningsButtons(path));
    requestEarnings();
    return details;
  }

  // Edit (or Done editing) and Revert to calculated under a Last salary table.
  function earningsButtons(path) {
    const editing = earningsEditing.has(path);
    const typed = getPath(state.inputs, path + ".salaryOverrides") || {};
    const actions = document.createElement("div");
    actions.className = "sheet-actions earnings-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-quiet";
    edit.dataset.action = "earnings-edit";
    edit.textContent = editing ? "Done editing" : "Edit";
    edit.addEventListener("click", () => {
      if (editing) earningsEditing.delete(path);
      else earningsEditing.add(path);
      refreshForm();
    });
    const revert = document.createElement("button");
    revert.type = "button";
    revert.className = "button button-quiet";
    revert.dataset.action = "earnings-revert";
    revert.textContent = "Revert to calculated";
    revert.disabled = !Object.keys(typed).length;
    revert.addEventListener("click", () => {
      earningsEditing.delete(path);
      setValue(path + ".salaryOverrides", {});
      refreshForm();
    });
    actions.append(edit, revert);
    return actions;
  }

  // Draw one person's Last salary table into its box: the read-only table, or while editing a box per year (drawn
  // once, so typing is not interrupted by a newer preview).
  function fillEarningsBox(box) {
    const role = box.id.slice("earnings-table-".length);
    if (box.dataset.editing !== "true") {
      box.innerHTML = earningsPreviewHtml(role);
      return;
    }
    if (box.querySelector("input")) return;
    const editor = earningsEditor(role);
    if (editor) box.replaceChildren(editor);
  }

  function earningsEditor(role) {
    const preview = state.earnings;
    const person = preview && preview.ok ? preview.people.find((item) => item.role === role) : null;
    if (!person || person.error) return null;
    const calculated = Object.fromEntries(person.calculated);
    const table = document.createElement("table");
    table.className = "units-table earnings-editor";
    table.innerHTML = "<thead><tr><th scope=\"col\">Year</th><th scope=\"col\">Earnings</th>"
      + "<th scope=\"col\">Edited</th></tr></thead>";
    const body = document.createElement("tbody");
    for (const [year, amount] of person.rows) {
      const row = document.createElement("tr");
      const head = document.createElement("th");
      head.scope = "row";
      head.textContent = String(year);
      const cell = document.createElement("td");
      const input = document.createElement("input");
      input.className = "input";
      input.type = "number";
      input.inputMode = "decimal";
      input.min = "0";
      input.step = "any";
      input.id = fieldId(role + ".salaryOverrides." + year);
      input.setAttribute("aria-label", "Earnings in " + year);
      input.value = String(amount);
      cell.append(input);
      const marker = document.createElement("td");
      marker.className = "text earnings-edited";
      marker.textContent = person.edited.includes(year) ? "edited" : "";
      input.addEventListener("change", () => {
        const overrides = { ...(getPath(state.inputs, role + ".salaryOverrides") || {}) };
        const value = Number(input.value);
        if (input.value === "" || !Number.isFinite(value) || value === calculated[year]) delete overrides[year];
        else overrides[year] = value;
        if (input.value === "") input.value = String(calculated[year]);
        setValue(role + ".salaryOverrides", overrides);
        marker.textContent = overrides[year] != null ? "edited" : "";
        const revert = document.querySelector("#earnings-" + role + " [data-action=earnings-revert]");
        if (revert) revert.disabled = !Object.keys(overrides).length;
      });
      row.append(head, cell, marker);
      body.append(row);
    }
    table.append(body);
    return table;
  }

  function earningsWanted() {
    return state.tab === "inputs" && state.schema != null && document.querySelector(".earnings-preview") != null;
  }

  async function requestEarnings() {
    if (!earningsWanted()) return;
    const inputsText = JSON.stringify(state.inputs);
    let reply;
    try {
      reply = await engine.call("earningsPreview", [inputsText], "earnings");
    } catch (error) {
      return;
    }
    if (!reply || inputsText !== JSON.stringify(state.inputs)) return;  // a newer edit asks again
    state.earnings = reply.value;
    for (const box of document.querySelectorAll(".earnings-preview")) fillEarningsBox(box);
  }

  // The read-only table of the earnings filled in for one person, from the latest earningsPreview reply.
  function earningsPreviewHtml(role) {
    const preview = state.earnings;
    if (!preview) return "<p class=\"note\">Filling in the earnings</p>";
    if (!preview.ok) return "<p class=\"banner banner-warn\" role=\"note\">" + escapeText(preview.error) + "</p>";
    const person = preview.people.find((item) => item.role === role);
    if (!person) return "<p class=\"note\">Filling in the earnings</p>";
    if (person.error) return "<p class=\"banner banner-warn\" role=\"note\">" + escapeText(person.error) + "</p>";
    if (!person.rows.length) return "<p class=\"note\">No entries.</p>";
    const rows = person.rows.map(([year, amount]) => [year, amount, person.edited.includes(year) ? "edited" : ""]);
    return charts.renderUnitsTable({ columns: ["Year", "Earnings", "Edited"], data: rows }, ["text", "money", "text"],
      { title: "Earnings filled in from your last salary" });
  }

  function groupedFields(children, path, headings = null, group = null) {
    const elements = [];
    const drawnGroups = new Set();
    for (const child of children) {
      const heading = headings && group && headings[path + "." + child.name];
      if (heading) {
        const holder = personHeading(heading, group);
        // The elements are appended together, so an earlier heading among them also asks for the divider.
        if (elements.some((element) => element.classList.contains("pane-section"))) {
          holder.classList.add("section-break");
        }
        elements.push(holder);
      }
      if (child.name === "retired") {  // the I'm retired switch: on hides the salary and its stop age (kept)
        const retiredPath = path + ".retired";
        elements.push(switchField(child.label, child.help, fieldId(retiredPath), Boolean(getPath(state.inputs, retiredPath)),
          (on) => {
            setValue(retiredPath, on);
            if (on) openGroups.add(earningsOpenKey(path));  // only the earnings history is left to fill in
            refreshForm();
          }));
        continue;
      }
      if ((child.name === "salary" || child.name === "salaryEndAge") && getPath(state.inputs, path + ".retired")) continue;
      if (child.name === "earningsHistoryMode") {
        elements.push(earningsHistoryDisclosure(children, path));
      } else if (EARNINGS_FIELDS.has(child.name) && children.some((item) => item.name === "earningsHistoryMode")) {
        continue;  // drawn inside the earnings history disclosure
      } else if (!child.group) {
        elements.push(fieldElement(child, path + "." + child.name));
      } else if (!drawnGroups.has(child.group)) {
        drawnGroups.add(child.group);
        elements.push(groupDisclosure(child.group, children.filter((item) => item.group === child.group), path));
      }
    }
    return elements;
  }

  function optionalButton(label, style, change) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button " + style;
    button.textContent = label;
    button.addEventListener("click", () => {
      change();
      inputsChanged();
      refreshForm();
    });
    return button;
  }

  // ---- Lists: one card per item, edited in a bottom sheet ----
  function itemSummary(typeName, item) {
    if (typeName === "Account") {
      return { name: item.name, detail: item.kind + (item.owner ? " · " + item.owner : ""),
        value: compactMoney(item.startingValue) };
    }
    if (typeName === "ExpenseItem") {
      const rules = state.info.sheetRules;
      const charity = item.category === rules.charityCategory;
      const major = item.category === rules.majorCategory;
      const deduction = charity ? "tax deductible" : item.deduction ? "deductible: " + item.deduction : null;
      const ages = charity ? "" : expenseAgesText(item, rules);
      return { name: item.name, detail: item.category + (deduction ? " · " + deduction : "")
        + (major || charity ? " · per year" : " · per month") + (ages ? " · " + ages : "")
        + (item.child && !charity ? " · not scaled by children" : ""), value: compactMoney(item.amount) };
    }
    if (typeName === "Loan") {
      const span = spanText(item, state.inputs.you.currentAge);
      return { name: item.name, detail: item.kind + " · " + percent(item.annualRate, 2) + " · " + item.remainingMonths
        + " months" + (item.refinance ? " · refinanced" : "") + (item.paymentsInExpenses ? " · payment in Expenses" : "")
        + (span ? " · " + span : ""),
      value: compactMoney(item.balance) };
    }
    if (typeName === "Car") return carSummary(item, state.inputs.you.currentAge);
    if (typeName === "Home") return homeSummary(item, state.inputs.you.currentAge);
    if (typeName === "RentPeriod") {
      const from = item.startAge == null ? "today" : String(timelineYear(item.startAge));
      const to = item.endAge == null ? "open" : String(timelineYear(item.endAge));
      return { name: item.name, detail: "per month · " + from + "-" + to, value: compactMoney(item.monthlyRent) };
    }
    if (typeName === "Child") {
      const age = state.inputs.you.currentAge - item.yourAgeAtBirth;
      return { name: item.name, detail: (age < 0 ? "not born yet" : "age " + age + " today") + ", child years to age "
        + item.dependentUntilAge, value: "" };
    }
    const fields = state.schema.types[typeName] || [];
    const first = fields.find((field) => field.kind === "text");
    return { name: first ? item[first.name] : typeName, detail: "", value: "" };
  }

  // The ticked items of each ordered list, as full-list positions, by list (its path and filter); kept while the page
  // redraws, dropped for a path whose items were removed (the positions no longer hold).
  const listSelections = {};
  const listKey = (path, filter) => path + (filter ? " " + JSON.stringify(filter) : "");

  function clearSelections(path) {
    for (const key of Object.keys(listSelections)) if (key === path || key.startsWith(path + " ")) delete listSelections[key];
  }

  // After a move, delete or drag: save, redraw and put the focus back on the same control of the redrawn list. A
  // deleted primary residence passes to the first home left.
  function afterReorder(key, focus) {
    ensureOnePrimary(state.inputs.homes);
    inputsChanged();
    refreshForm();
    const list = Array.from(document.querySelectorAll(".items")).find((element) => element.dataset.list === key);
    const target = list && focus(list.parentElement);
    if (target) target.focus();
  }

  // The bar under an ordered list: Move up, Move down and Delete act on the ticked items (Delete asks for a second tap).
  function reorderBar(key, path, label, shown, selected) {
    const bar = document.createElement("div");
    bar.className = "list-bar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Ticked " + label.toLowerCase());
    const count = document.createElement("span");
    count.className = "list-bar-count";
    count.setAttribute("aria-live", "polite");
    const action = (name, text, style, run) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button " + style;
      button.textContent = text;
      button.dataset.action = name;
      button.addEventListener("click", () => {
        const picked = selected();
        if (!picked.length) return;
        if (name === "delete" && button.dataset.armed !== "true") {
          button.dataset.armed = "true";
          button.textContent = "Tap again to delete " + picked.length;
          return;
        }
        listSelections[key] = run(getPath(state.inputs, path), picked);
        if (name === "delete") clearSelections(path);
        afterReorder(key, (wrap) => wrap.querySelector(".list-bar [data-action=" + name + "]:not(:disabled)")
          || wrap.querySelector(".items .item"));
      });
      return button;
    };
    bar.append(
      action("up", "Move up", "button-quiet", (items, picked) => moveSelected(items, picked, -1, shown)),
      action("down", "Move down", "button-quiet", (items, picked) => moveSelected(items, picked, 1, shown)),
      action("delete", "Delete", "button-danger", (items, picked) => deleteSelected(items, picked)),
      count);
    bar.refresh = () => {
      const picked = selected();
      for (const button of bar.querySelectorAll("button")) {
        button.disabled = !picked.length;
        if (button.dataset.action === "delete" && button.dataset.armed === "true") {
          button.dataset.armed = "false";
          button.textContent = "Delete";
        }
      }
      count.textContent = picked.length ? picked.length + " ticked" : "Tick items to move or delete them";
    };
    bar.refresh();
    return bar;
  }

  // Drag an item by its handle (mouse, pen or finger) onto another shown item's place; the arrow keys move it one place.
  function dragHandle(key, path, position, name, shown, list) {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "drag-handle";
    handle.setAttribute("aria-label", "Move " + name + ": drag, or press the up or down arrow");
    handle.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 5h2v2H9zM13 5h2v2h-2zM9 11h2v2H9zM13 "
      + "11h2v2h-2zM9 17h2v2H9zM13 17h2v2h-2z\" fill=\"currentColor\"/></svg>";
    const moveTo = (target) => {
      if (target === undefined || target === position) return;
      listSelections[key] = moveItem(getPath(state.inputs, path), position, target, listSelections[key], shown);
      afterReorder(key, (wrap) => Array.from(wrap.querySelectorAll(".drag-handle"))
        .find((element) => element.dataset.position === String(target)));
    };
    handle.dataset.position = String(position);
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      moveTo(shown[shown.indexOf(position) + (event.key === "ArrowUp" ? -1 : 1)]);
    });
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const row = handle.closest(".item-row");
      let over = null;
      handle.setPointerCapture(event.pointerId);
      row.classList.add("dragging");
      const mark = (target) => {
        if (over) over.classList.remove("drop-target");
        over = target && target !== row ? target : null;
        if (over) over.classList.add("drop-target");
      };
      const move = (moveEvent) => {
        const rows = Array.from(list.querySelectorAll(".item-row"));
        mark(rows.find((candidate) => {
          const box = candidate.getBoundingClientRect();
          return moveEvent.clientY >= box.top && moveEvent.clientY <= box.bottom;
        }) || null);
      };
      const end = (endEvent) => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        row.classList.remove("dragging");
        const target = endEvent.type === "pointerup" && over ? Number(over.dataset.position) : undefined;
        mark(null);
        moveTo(target);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    });
    return handle;
  }

  // A list's items as cards, each opening its sheet; with a filter only the matching items are shown, each keeping its
  // position in the full list. Every list is ordered: each card has a tick box at its left and a drag handle at its
  // right, and the bar under the list moves or deletes the ticked items.
  function listField(field, path, value, filter) {
    const help = path === "accounts" && field.help ? field.help + ". Withdrawals follow this order under the priority "
      + "strategy. Tick accounts to move them, or drag one by its handle." : field.help;
    const wrap = fieldShell(field.label, help, null);
    const list = document.createElement("div");
    list.className = "items";
    const key = listKey(path, filter);
    list.dataset.list = key;
    const shown = filteredPositions(value, filter);
    listSelections[key] = (listSelections[key] || []).filter((position) => shown.includes(position));
    const selected = () => listSelections[key];
    const bar = reorderBar(key, path, field.label, shown, selected);
    shown.forEach((position, index) => {
      const item = value[position];
      const summary = itemSummary(field.type, item);
      const name = summary.name || "(no name)";
      const row = document.createElement("div");
      row.className = "item-row";
      row.dataset.position = String(position);
      const tick = document.createElement("label");
      tick.className = "item-select";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = selected().includes(position);
      box.setAttribute("aria-label", "Tick " + name + ", position " + (index + 1));
      box.addEventListener("change", () => {
        const others = selected().filter((other) => other !== position);
        listSelections[key] = box.checked ? [...others, position].sort((a, b) => a - b) : others;
        bar.refresh();
      });
      tick.append(box);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "item";
      button.innerHTML = "<span class=\"item-name\"></span><span class=\"item-value\"></span><span class=\"item-detail\"></span>";
      button.querySelector(".item-name").textContent = name;
      button.querySelector(".item-detail").textContent = summary.detail;
      button.querySelector(".item-value").textContent = summary.value;
      button.setAttribute("aria-label", "Edit " + (summary.name || "item") + ", position " + (index + 1));
      button.dataset.position = String(position);
      button.addEventListener("click", () => openSheet(field, path, position, false, filter));
      row.append(tick, button, dragHandle(key, path, position, name, shown, list));
      list.append(row);
    });
    if (!shown.length) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = "None yet.";
      list.append(note);
    }
    const add = document.createElement("button");
    add.type = "button";
    add.className = "button button-quiet";
    add.textContent = "Add " + (field.type === "Loan" && filter && filter.kind && filter.kind.length === 1
      && filter.kind[0] === "Mortgage" ? "mortgage loan" : typeWords(field.type));  // the Home chip's other mortgages
    add.addEventListener("click", () => {
      // A home, car or rent period is added on its timeline: the first question there asks for its years.
      const timed = { Home: ["Home", "add", 0], Car: ["Car", "add", null], RentPeriod: ["Home", "rent", 0] }[field.type];
      if (timed) {
        openTimeline(timed[0], timed[1], { lane: timed[2] });
        return;
      }
      const items = getPath(state.inputs, path);
      const item = Object.assign(newItem(field.type), filterStartValues(filter));
      const usual = field.type === "Account" && state.info.usualReturns[item.kind];
      if (usual) [item.meanReturn, item.returnStdDev] = usual;  // a new account starts with its kind's usual returns
      if (field.type === "Child") item.yourAgeAtBirth = state.inputs.you.currentAge;  // a new child is born this year
      items.push(item);
      inputsChanged();
      openSheet(field, path, items.length - 1, false, filter);
    });
    wrap.append(list, ...(shown.length ? [bar] : []), add);
    return wrap;
  }

  function typeWords(typeName) {
    return typeName.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  }

  // A new list item from the schema: each field's default, else a blank of its kind.
  function newItem(typeName) {
    const item = {};
    for (const field of state.schema.types[typeName] || []) {
      if (field.default !== undefined && field.default !== null) item[field.name] = clone(field.default);
      else if (field.nullable) item[field.name] = null;
      else if (field.kind === "text") item[field.name] = "New " + typeWords(typeName);
      else if (field.kind === "select") item[field.name] = field.choices[0];
      else if (field.kind === "toggle") item[field.name] = false;
      else if (field.kind === "triangular") item[field.name] = { minimum: 0, mode: 0, maximum: 0 };
      else if (field.kind === "normal") item[field.name] = { mean: 0, stdDev: 0 };
      else if (field.kind === "map") item[field.name] = {};
      else if (field.kind === "list") item[field.name] = [];
      else if (field.kind === "object") item[field.name] = newItem(field.type);
      else item[field.name] = field.minimum != null ? field.minimum : 0;
    }
    return item;
  }

  let sheetReturn = null;
  let sheetOpen = null;  // {field, path, position, filter, kind} of the item in the sheet (kind: as it was drawn)

  // The values a select of the open sheet's item may take when its list is filtered on that field, else null.
  function sheetAllowed(field, path) {
    if (!sheetOpen || !sheetOpen.filter || !sheetOpen.filter[field.name]) return null;
    return path === sheetOpen.path + "." + sheetOpen.position + "." + field.name ? sheetOpen.filter[field.name] : null;
  }

  // The line at the top of an expense sheet: whether the amount is per month or per year, and for Charity that it is
  // tax deductible.
  function sheetIntro(typeName, item) {
    if (typeName !== "ExpenseItem" || !item) return null;
    const rules = state.info.sheetRules;
    const note = document.createElement("p");
    note.className = "field-help sheet-intro";
    note.textContent = item.category === rules.charityCategory
      ? "Charity amounts are per year, in today's value, and tax deductible; a Charity row is paid every year."
      : item.category === rules.majorCategory ? rules.majorCategory + " amounts are per year, in today's value, paid "
        + "once in the year you are the age below." : "This amount is per month, in today's value.";
    return note;
  }

  // The "Returns and basis" group of an account sheet: the returns in a disclosure, closed until opened, whose header
  // reads them ("Return 6.0% · std dev 12.0%"), with the kind's usual values and the button that writes them; the
  // basis fields follow it, always shown. `path` is the account's own path, for the disclosure's open state.
  function returnsGroup(item, path) {
    const group = document.createElement("fieldset");
    group.className = "group";
    group.innerHTML = "<legend>Returns and basis</legend>";
    const usual = state.info.usualReturns[item.kind];
    const details = document.createElement("details");
    details.className = "field-collapse account-returns";
    const openKey = path + "|returns";
    details.open = openGroups.has(openKey);  // closed by default; stays open when the sheet is drawn again
    details.addEventListener("toggle", () => {
      if (details.open) openGroups.add(openKey);
      else openGroups.delete(openKey);
    });
    const summary = document.createElement("summary");
    const mean = item.meanReturn != null ? item.meanReturn : (usual ? usual[0] : 0);
    const deviation = item.returnStdDev != null ? item.returnStdDev : (usual ? usual[1] : 0);
    summary.textContent = returnsSummary(mean, deviation);
    summary.title = "Filled from the account kind; change to override.";
    details.append(summary);
    group.append(details);
    if (!usual) return group;
    const help = document.createElement("p");
    help.className = "field-help usual-returns-help";
    help.textContent = "Filled from the account kind; change to override. For " + item.kind + ": mean return "
      + percent(usual[0], 2) + ", standard deviation " + percent(usual[1], 2) + ".";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-quiet usual-returns";
    button.textContent = "Use the usual returns";
    button.addEventListener("click", () => {
      [item.meanReturn, item.returnStdDev] = usual;
      inputsChanged();
      refreshForm();
    });
    details.append(help, button);
    return group;
  }

  // After a select or switch changes in the open sheet: clear what the new category or kind refuses (clearedOnChange)
  // and redraw the sheet, since the fields it shows depend on them. A home ticked as the primary residence becomes the
  // only one (unticking the only primary ticks it again).
  function afterSheetEdit(path) {
    if (!sheetOpen) return;
    const prefix = sheetOpen.path + "." + sheetOpen.position + ".";
    const name = path.startsWith(prefix) ? path.slice(prefix.length) : null;
    if (!name || name.includes(".")) return;
    if (sheetOpen.field.type === "Home" && name === "primaryResidence") {
      choosePrimary(getPath(state.inputs, sheetOpen.path), sheetOpen.position);
      inputsChanged();
      refreshForm();
      return;
    }
    const item = getPath(state.inputs, sheetOpen.path)[sheetOpen.position];
    const cleared = clearedOnChange(sheetOpen.field.type, name, item, state.info.sheetRules);
    if (sheetOpen.field.type === "Account" && name === "kind") {  // the returns follow the kind unless overridden
      Object.assign(cleared, kindReturnsFilled(item, sheetOpen.kind, state.info.usualReturns));
    }
    Object.assign(item, cleared);
    if (Object.keys(cleared).length) inputsChanged();
    if (name === "category" || name === "kind") refreshForm();
    if (sheetSwitches(sheetOpen.field.type, state.info.sheetRules).includes(name)) {  // a car's Loan or Commute switch
      refreshForm();
      const redrawn = $(fieldId(path));
      if (redrawn) redrawn.focus();
    }
  }

  // Redraw what is on screen after an edit that adds or removes fields: the sheet when one is open, else the panel.
  function refreshForm() {
    if (sheetOpen) openSheet(sheetOpen.field, sheetOpen.path, sheetOpen.position, true, sheetOpen.filter);
    else renderSettings();
  }

  // One titled section of a sheet (`schema.sheetSections`): its title with the "i" for its help, then its fields,
  // drawn as a pane section below a divider.
  function sheetSection(section, fields) {
    const group = document.createElement("fieldset");
    group.className = "group sheet-section pane-section section-break";
    const id = newHelpId();
    group.innerHTML = "<legend class=\"legend-help\"><span>" + escapeText(section.label) + "</span>"
      + helpButtonHtml(section.label, id) + "</legend>" + helpTextHtml(id, section.help);
    group.append(...fields);
    return group;
  }

  function openSheet(field, path, position, keepFocus, filter) {
    const items = getPath(state.inputs, path);
    if (!sheetOpen) sheetReturn = document.activeElement;
    sheetOpen = { field, path, position, filter: filter || null, kind: items[position] && items[position].kind };
    $("sheetTitle").textContent = (items[position] && items[position].name) || typeWords(field.type);
    const body = $("sheetBody");
    const children = state.schema.types[field.type] || [];
    const layout = sheetFields(field.type, items[position], children, state.info.sheetRules);
    const parts = [];
    const intro = sheetIntro(field.type, items[position]);
    if (intro) parts.push(intro);
    let returns = null;
    let section = null;
    // The type's titled sections (a child's Daycare and College) follow its other fields, each below a divider.
    const sections = ((state.schema.sheetSections || {})[field.type] || []).map((section) => ({ section, fields: [] }));
    for (const entry of layout.shown) {
      const schemaChild = children.find((candidate) => candidate.name === entry.name);
      const label = sheetLabel(field.type, entry.name, items[position], state.info.sheetRules);
      const child = label ? { ...schemaChild, label } : schemaChild;
      if (layout.sections && child.group && child.group !== section) {  // a titled section per schema group
        parts.push(sheetHeading(child.group, section === null));
        section = child.group;
      }
      const element = fieldElement(child, path + "." + position + "." + child.name);
      const holder = sections.find((item) => item.section.fields.includes(entry.name));
      if (holder) { holder.fields.push(element); continue; }
      if (entry.group !== "returns") { parts.push(element); continue; }
      if (!returns) {
        returns = returnsGroup(items[position], path + "." + position);
        parts.push(returns);
      }
      const returnsBox = returns.querySelector(".account-returns");
      if (child.name === "meanReturn" || child.name === "returnStdDev") {
        returnsBox.insertBefore(element, returnsBox.querySelector(".usual-returns-help"));
      } else {
        returns.append(element);
      }
    }
    for (const { section, fields } of sections) {
      if (fields.length) parts.push(sheetSection(section, fields));  // a section with every field hidden is not drawn
    }
    body.replaceChildren(...parts);
    tintSections(body);
    const actions = document.createElement("div");
    actions.className = "sheet-actions";
    // Moving swaps the item with its shown neighbour: with a filter, the next matching item in the full list.
    const shown = filteredPositions(items, filter);
    const move = (offset, label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-quiet";
      button.textContent = label;
      const target = shown[shown.indexOf(position) + offset];
      button.disabled = target === undefined;
      button.addEventListener("click", () => {
        [items[position], items[target]] = [items[target], items[position]];
        clearSelections(path);
        inputsChanged();
        openSheet(field, path, target, false, filter);
      });
      return button;
    };
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button-danger";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      if (remove.dataset.armed !== "true") {
        remove.dataset.armed = "true";
        remove.textContent = "Tap again to remove";
        return;
      }
      items.splice(position, 1);
      if (field.type === "Home") ensureOnePrimary(items);  // a removed primary passes to the first home left
      clearSelections(path);
      inputsChanged();
      closeSheet();
    });
    actions.append(move(-1, "Move up"), move(1, "Move down"), remove);
    body.append(actions);
    $("sheet").hidden = false;
    $("sheetBackdrop").hidden = false;
    $("app").classList.remove("typing");
    const first = body.querySelector("input, select");
    if (first && !keepFocus) first.focus({ preventScroll: true });
  }

  // A section title inside a sheet (a car's Value, Loan, Commute, Running costs and Replacement), styled as a pane's
  // sections (markPaneSection): a divider above all but the first.
  function sheetHeading(label, first) {
    const holder = document.createElement("div");
    holder.className = "sub-heading-block pane-section sheet-group-heading" + (first ? "" : " section-break");
    const heading = document.createElement("h3");
    heading.className = "sub-heading";
    heading.textContent = label;
    holder.append(heading);
    return holder;
  }

  function closeSheet() {
    if ($("sheet").hidden) return;
    if (timelineFlow && timelineFlow.notes.length) timelineNotes[timelineFlow.kind] = timelineFlow.notes.slice();
    timelineFlow = null;
    sheetOpen = null;
    $("sheet").hidden = true;
    $("sheetBackdrop").hidden = true;
    $("app").classList.remove("typing");
    renderSettings();
    if (sheetReturn && document.contains(sheetReturn)) sheetReturn.focus();
  }

  // ---- Ownership timeline: the Home and Cars panes' Timeline block and its workflow in the bottom sheet ----
  // The segments and every edit come from wmti.assets.timeline through the worker (timelineView, timelineApply), so the
  // phone refits and fills exactly as the desktop does. The workflow asks one question per screen with the words of
  // schema.timeline.flow; each step's edit is applied at once (a later Back never undoes it) and its notes, naming every
  // neighbour it changed, show on the screen and under the block. While an edit is on its way the buttons are disabled.
  const timelineNotes = {};  // by kind: the notes of the last edit, shown once under the block
  let timelineFlow = null;   // the open workflow: {kind, step, position, lane, year, history, notes, error, busy, rentDone}

  function timelineWords(kind) {
    return state.schema.timeline.flow[kind];
  }

  function timelineYear(age) {
    return yearOfAge(age, state.inputs.you.currentAge, state.info.lawTaxYear);
  }

  function timelineAge(year) {
    return ageOfYear(year, state.inputs.you.currentAge, state.info.lawTaxYear);
  }

  function timelineButton(text, action, style) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button " + (style || "button-quiet");
    button.textContent = text;
    button.dataset.action = action;
    return button;
  }

  function timelineNote(text, error) {
    const note = document.createElement("p");
    note.className = "banner" + (error ? " banner-error" : "");
    note.setAttribute("role", error ? "alert" : "note");
    note.textContent = text;
    return note;
  }

  // The panel's Timeline pane, drawn once at the top of the Home and Cars panels (see panelSections).
  function timelineBlock(kind) {
    const block = document.createElement("fieldset");
    block.className = "group pane timeline";
    block.dataset.kind = kind;
    const id = newHelpId();
    block.innerHTML = "<legend class=\"legend-help\"><span class=\"legend-title\"><span>Timeline</span></span>"
      + helpButtonHtml("Timeline", id) + "</legend>" + helpTextHtml(id, state.schema.timeline.help[kind]);
    const body = document.createElement("div");
    body.className = "timeline-body";
    body.textContent = "Drawing the timeline";
    block.append(body);
    fillTimeline(kind, body);
    return block;
  }

  async function fillTimeline(kind, body) {
    const reply = await ask("timelineView", [JSON.stringify(state.inputs), kind]);
    if (!reply || !document.contains(body)) return;
    if (!reply.ok) {
      body.replaceChildren(timelineNote("The timeline shows once the settings are valid: " + reply.error, true));
      return;
    }
    const words = timelineWords(kind);
    const parts = [];
    const bars = document.createElement("div");
    bars.className = "timeline-bars";
    bars.setAttribute("aria-hidden", "true");
    for (const row of timelineBars(reply.segments, reply.currentAge, reply.lastAge)) {
      const lane = document.createElement("div");
      lane.className = "timeline-lane";
      for (const bar of row.bars) {
        const span = document.createElement("span");
        span.className = "timeline-bar";
        span.dataset.mode = bar.mode;
        span.style.left = bar.left + "%";
        span.style.width = bar.width + "%";
        span.title = bar.text;
        lane.append(span);
      }
      bars.append(lane);
    }
    parts.push(bars);
    for (const note of timelineNotes[kind] || []) parts.push(timelineNote(note));
    delete timelineNotes[kind];
    const list = document.createElement("ul");
    list.className = "timeline-cards";
    for (const segment of reply.segments) {
      const card = document.createElement("li");
      card.className = "timeline-card";
      card.dataset.mode = segment.mode;
      const text = document.createElement("span");
      text.className = "timeline-text";
      text.textContent = segment.text;
      card.append(text);
      if (segment.position == null) {
        const hint = document.createElement("span");
        hint.className = "field-help";
        hint.textContent = words.gapEdit;
        card.append(hint);
      } else {
        const sale = timelineButton(words.start.own, "sale");
        sale.hidden = segment.mode === "rent";  // a rent period ends; it is not sold
        sale.addEventListener("click", () => openTimeline(kind, "sell", { position: segment.position, lane: segment.lane }));
        const edit = timelineButton(words.start.edit, "edit");
        edit.addEventListener("click", () => openTimeline(kind, "edit", { position: segment.position, lane: segment.lane }));
        const remove = timelineButton(words.start.delete, "delete", "button-danger");
        remove.addEventListener("click", async () => {
          if (remove.dataset.armed !== "true") {
            remove.dataset.armed = "true";
            remove.textContent = "Tap again to delete";
            return;
          }
          remove.disabled = true;
          const result = await applyTimeline(kind, { op: "delete", position: segment.position });
          timelineNotes[kind] = result.ok ? result.notes : [result.error];
          renderSettings();
        });
        const actions = document.createElement("span");
        actions.className = "timeline-actions";
        actions.append(sale, edit, remove);
        card.append(actions);
      }
      list.append(card);
    }
    parts.push(list);
    const chain = reply.segments.filter((segment) => segment.lane === 0 && segment.position != null);
    const starts = document.createElement("div");
    starts.className = "timeline-actions";
    const add = timelineButton(words.start.empty, "add", "button-primary");
    add.addEventListener("click", () => openTimeline(kind, "add", { lane: kind === "Car" ? null : 0 }));
    starts.append(add);
    if (chain.length) {
      const last = chain.reduce((latest, segment) => (segment.startAge > latest.startAge ? segment : latest));
      const plan = timelineButton(words.start.last, "plan", "button-primary");
      plan.addEventListener("click", () => openTimeline(kind, last.endAge == null && last.mode !== "rent" ? "sell" : "next",
        { position: last.position, lane: 0, year: last.endAge == null ? null : timelineYear(last.endAge) + 1 }));
      starts.append(plan);
    }
    parts.push(starts);
    body.replaceChildren(...parts);
  }

  // Apply one timeline edit through the worker: on success the inputs take the result (and every pane redraws), on
  // refusal nothing changes. Returns {ok, error, notes, position}.
  async function applyTimeline(kind, op) {
    const reply = await ask("timelineApply", [JSON.stringify(state.inputs), kind, JSON.stringify(op)]);
    if (!reply || !reply.ok) return { ok: false, error: reply ? reply.error : "The step was not applied; try again.", notes: [] };
    state.inputs = reply.inputs;
    inputsChanged();
    return { ok: true, error: null, notes: reply.notes || [], position: reply.position };
  }

  function openTimeline(kind, step, options) {
    if (!sheetOpen && $("sheet").hidden) sheetReturn = document.activeElement;
    sheetOpen = null;
    timelineFlow = { kind, step, position: null, lane: 0, year: null, history: [], notes: [], error: null, busy: false,
      rentDone: false, ...(options || {}) };
    $("sheetTitle").textContent = "Timeline";
    $("sheet").hidden = false;
    $("sheetBackdrop").hidden = false;
    timelineScreen();
  }

  function timelineGo(step, changes) {
    timelineFlow.history.push(timelineFlow.step);
    Object.assign(timelineFlow, { step, error: null }, changes || {});
    timelineScreen();
  }

  function timelineClose() {
    closeSheet();  // keeps the workflow's notes for the block (see closeSheet)
  }

  // A labelled input on a workflow screen: a number (a year shows your age beside it), text or a tick box.
  function timelineInput(label, type, value, options) {
    const wrap = document.createElement("label");
    wrap.className = "field timeline-field";
    const caption = document.createElement("span");
    caption.className = "field-label";
    caption.textContent = label;
    const input = document.createElement("input");
    input.type = type === "check" ? "checkbox" : type === "text" ? "text" : "number";
    if (type === "check") input.checked = Boolean(value);
    else if (value != null) input.value = String(value);
    Object.assign(input, options || {});
    wrap.append(caption, input);
    if (type === "year") {
      const age = document.createElement("span");
      age.className = "field-help timeline-age";
      const show = () => { age.textContent = input.value === "" ? "" : "Your age " + timelineAge(Number(input.value)); };
      input.addEventListener("input", show);
      show();
      wrap.append(age);
    }
    wrap.input = input;
    return wrap;
  }

  function timelineYearInput(label, year, optional) {
    const first = state.info.lawTaxYear;
    const last = first + state.inputs.years - 1;
    const value = year == null ? (optional ? null : first) : Math.min(Math.max(year, first), last);
    return timelineInput(label, "year", value, { min: first, max: last, step: 1 });
  }

  function timelineChoice(question, options, chosen) {
    const group = document.createElement("fieldset");
    group.className = "group timeline-question";
    const legend = document.createElement("legend");
    legend.textContent = question;
    group.append(legend);
    for (const [value, text] of options) {
      const label = document.createElement("label");
      label.className = "choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "timelineChoice";
      input.value = value;
      input.checked = value === chosen;
      label.append(input, document.createTextNode(" " + text));
      group.append(label);
    }
    group.value = () => (group.querySelector("input:checked") || {}).value;
    return group;
  }

  // The figures a purchase screen asks: the buying figures and the financing switch with its figures, from the
  // schema (shares as percents), at the item type's defaults. For an item owned now (`owned`): its value today and the
  // financing switch with every financing figure, the balance owed among them.
  function timelineFigures(kind, owned, initial) {
    const words = timelineWords(kind);
    const fields = state.schema.types[kind];
    const blank = { ...Object.fromEntries(fields.map((field) => [field.name, field.default])), ...(initial || {}) };
    const replaced = state.info.sheetRules.itemSwitchReplaces[kind].buysLater || [];
    const own = (owned ? words.ownedFields : words.purchaseFields.filter((name) => name !== "purchaseAge"))
      .filter((name) => !words.financingFields.includes(name));
    const names = own.concat([words.financingSwitch],
      words.financingFields.filter((name) => owned || !replaced.includes(name)));
    const inputs = {};
    const elements = names.map((name) => {
      const field = fields.find((item) => item.name === name);
      const percentUnit = field.unit === "percent";
      const element = field.kind === "toggle" ? timelineInput(field.label, "check", blank[name])
        : timelineInput(field.label + (percentUnit ? " (%)" : ""), "number",
          percentUnit ? blank[name] * 100 : blank[name], { min: 0, step: "any" });
      inputs[name] = () => (field.kind === "toggle" ? element.input.checked
        : (percentUnit ? Number(element.input.value) / 100 : Number(element.input.value)));
      if (field.kind === "integer") inputs[name] = () => Math.round(Number(element.input.value));
      return element;
    });
    return { elements, values: () => Object.fromEntries(Object.entries(inputs).map(([name, read]) => [name, read()])) };
  }

  function timelineFreeName(kind, rent) {
    const items = (rent ? state.inputs.rents : kind === "Home" ? state.inputs.homes : state.inputs.cars) || [];
    return freeName(rent ? "Rent" : kind === "Home" ? "Home" : "Car", items.map((item) => item.name));
  }

  // The items in timeline positions: the homes then the rent periods, or the cars.
  function timelineItems(kind) {
    return kind === "Home" ? (state.inputs.homes || []).concat(state.inputs.rents || []) : state.inputs.cars || [];
  }

  function timelineScreen() {
    const flow = timelineFlow;
    const kind = flow.kind;
    const words = timelineWords(kind);
    const items = timelineItems(kind);
    const isRent = kind === "Home" && flow.position != null && flow.position >= (state.inputs.homes || []).length;
    const nameLabel = state.schema.types[kind].find((field) => field.name === "name").label;
    const parts = [];
    let next = null;  // the screen's Next: an async step that returns once applied
    if (flow.step === "add") {
      // First whether it is a future purchase or owned now; then that case's fields.
      const choice = timelineChoice(words.addQuestion, Object.entries(words.addOptions), flow.addChoice || null);
      const holder = document.createElement("div");
      holder.className = "timeline-add";
      let read = null;
      const draw = () => {
        const value = choice.value() || null;
        flow.addChoice = value;
        if (!value) {
          holder.replaceChildren();
          read = null;
          return;
        }
        const owned = value === "owned";
        const kept = flow.addDraft && flow.addDraft.owned === owned ? flow.addDraft : {};  // after a refusal
        const name = timelineInput(nameLabel, "text", kept.name || timelineFreeName(kind));
        const start = owned ? null : timelineYearInput(words.purchaseYear, kept.purchaseAge != null
          ? timelineYear(kept.purchaseAge) : flow.year || state.info.lawTaxYear + 1);
        const end = timelineYearInput(words.saleYear + " (optional)", kept.saleAge != null ? timelineYear(kept.saleAge)
          : null, true);
        const figures = timelineFigures(kind, owned, kept.figures);
        holder.replaceChildren(...[name, start, end].filter(Boolean), ...figures.elements);
        read = () => ({ name: name.input.value, purchaseAge: start ? timelineAge(Number(start.input.value)) : null,
          saleAge: end.input.value === "" ? null : timelineAge(Number(end.input.value)), ...figures.values() });
        flow.addRead = () => ({ owned, name: name.input.value, purchaseAge: read().purchaseAge, saleAge: read().saleAge,
          figures: figures.values() });
      };
      choice.addEventListener("change", draw);
      draw();
      parts.push(choice, holder);
      next = async () => {
        if (!read) return;
        flow.addDraft = flow.addRead();  // kept for the screen drawn again with a refusal
        if (await timelineStep({ op: "buy", lane: flow.lane, fields: read() })) timelineClose();
      };
    } else if (flow.step === "sell") {
      const item = items[flow.position];
      const choice = timelineChoice(words.sellQuestion.replace("{name}", item.name),
        [["yes", words.sellYes], ["no", words.sellNo]], item.sellsLater ? "yes" : null);
      const start = item.buysLater ? item.purchaseAge : state.inputs.you.currentAge;
      const year = timelineYearInput(words.saleYear, timelineYear(item.sellsLater ? item.saleAge : start + 1));
      year.hidden = choice.value() !== "yes";
      choice.addEventListener("change", () => { year.hidden = choice.value() !== "yes"; });
      parts.push(choice, year);
      next = async () => {
        if (choice.value() === "yes") {
          const saleYear = Number(year.input.value);
          const result = await timelineStep({ op: "sell", position: flow.position, saleAge: timelineAge(saleYear) });
          if (result) timelineGo("next", { year: saleYear + 1 });
        } else if (choice.value() === "no") {
          if (await timelineStep({ op: "keep", position: flow.position })) timelineClose();
        }
      };
    } else if (flow.step === "next") {
      const options = Object.entries(words.options).filter(([value]) => !(flow.rentDone && value === "rent"));
      const choice = timelineChoice(words.nextQuestion, options, null);
      parts.push(choice);
      next = async () => {
        const value = choice.value();
        if (value === "buy") timelineGo("buy");
        else if (value === "rent" || value === "lease") timelineGo(value);
        else if (value === "done") timelineClose();
      };
    } else if (flow.step === "buy") {
      const name = timelineInput(state.schema.types[kind].find((field) => field.name === "name").label, "text",
        timelineFreeName(kind));
      const year = timelineYearInput(words.purchaseYear, flow.year);
      const figures = timelineFigures(kind);
      parts.push(name, year, ...figures.elements);
      next = async () => {
        const op = { op: "buy", lane: flow.lane, fields: { name: name.input.value, purchaseAge: timelineAge(Number(year.input.value)),
          ...figures.values() } };
        const result = await timelineStep(op);
        if (result) timelineGo("sell", { position: result.position });
      };
    } else if (flow.step === "rent") {
      const rentFields = state.schema.types.RentPeriod;
      const name = timelineInput(rentFields.find((field) => field.name === "name").label, "text",
        timelineFreeName(kind, true));
      const start = timelineYearInput(words.rentStart, flow.year);
      const end = timelineYearInput(words.rentEnd, null, true);
      const monthly = timelineInput(words.rentQuestion, "number", 0, { min: 0, step: "any" });
      const hint = document.createElement("p");
      hint.className = "field-help";
      hint.textContent = words.rentHint;
      parts.push(name, start, end, monthly, hint);
      next = async () => {
        const endYear = end.input.value === "" ? null : Number(end.input.value);
        const fields = { name: name.input.value, mode: "rent", monthlyRent: Number(monthly.input.value),
          purchaseAge: timelineAge(Number(start.input.value)), saleAge: endYear == null ? null : timelineAge(endYear) };
        if (await timelineStep({ op: "buy", lane: 0, fields })) {
          timelineGo("next", { rentDone: true, year: endYear == null ? null : endYear + 1 });
        }
      };
    } else if (flow.step === "lease") {
      const name = timelineInput(state.schema.types.Car.find((field) => field.name === "name").label, "text",
        timelineFreeName(kind));
      const start = timelineYearInput(words.leaseStart, flow.year);
      const end = timelineYearInput(words.leaseEnd, null, true);
      const monthlyField = state.schema.types.Car.find((field) => field.name === "leaseMonthly");
      const monthly = timelineInput(monthlyField.label, "number", 0, { min: 0, step: "any" });
      const hint = document.createElement("p");
      hint.className = "field-help";
      hint.textContent = words.leaseHint;
      parts.push(name, start, end, monthly, hint);
      next = async () => {
        const endYear = end.input.value === "" ? null : Number(end.input.value);
        const op = { op: "buy", lane: flow.lane, fields: { name: name.input.value, mode: "lease",
          purchaseAge: timelineAge(Number(start.input.value)), saleAge: endYear == null ? null : timelineAge(endYear),
          leaseMonthly: Number(monthly.input.value) } };
        const result = await timelineStep(op);
        if (!result) return;
        if (endYear == null) timelineClose();
        else timelineGo("next", { position: result.position, year: endYear + 1 });
      };
    } else if (flow.step === "edit" && isRent) {
      const period = items[flow.position];
      const currentAge = state.inputs.you.currentAge;
      const today = timelineInput("Renting since before today", "check", period.startAge == null);
      const startYear = timelineYearInput(words.rentStart, timelineYear(period.startAge == null ? currentAge + 1
        : period.startAge));
      const open = timelineInput("Until the end of the run", "check", period.endAge == null);
      const endYear = timelineYearInput(words.rentEnd.replace(" (optional)", ""), timelineYear(period.endAge == null
        ? currentAge + 1 : period.endAge));
      const monthly = timelineInput(words.rentQuestion, "number", period.monthlyRent, { min: 0, step: "any" });
      const sync = () => {
        startYear.hidden = today.input.checked;
        endYear.hidden = open.input.checked;
      };
      today.input.addEventListener("change", sync);
      open.input.addEventListener("change", sync);
      sync();
      parts.push(today, startYear, open, endYear, monthly);
      next = async () => {
        const fields = { monthlyRent: Number(monthly.input.value),
          purchaseAge: today.input.checked ? null : timelineAge(Number(startYear.input.value)),
          saleAge: open.input.checked ? null : timelineAge(Number(endYear.input.value)) };
        if (await timelineStep({ op: "edit", position: flow.position, fields })) timelineClose();
      };
    } else if (flow.step === "edit") {
      const item = items[flow.position];
      const leased = kind === "Car" && item.leases;
      const currentAge = state.inputs.you.currentAge;
      let ownedNow = null;
      let kept = null;
      const startYear = timelineYearInput(leased ? words.leaseStart : words.purchaseYear,
        timelineYear(item.buysLater ? item.purchaseAge : currentAge + 1));
      const endYear = timelineYearInput(leased ? words.leaseEnd : words.saleYear,
        item.sellsLater ? timelineYear(item.saleAge) : (leased ? null : timelineYear(currentAge + 1)), leased);
      const figure = leased ? timelineInput(state.schema.types.Car.find((field) => field.name === "leaseMonthly").label,
        "number", item.leaseMonthly, { min: 0, step: "any" })
        : timelineInput(state.schema.types[kind].find((field) => field.name === "purchasePrice").label, "number",
          item.purchasePrice, { min: 0, step: "any" });
      if (!leased) {
        ownedNow = timelineInput(words.ownedNow, "check", !item.buysLater);
        kept = timelineInput(words.sellNo, "check", !item.sellsLater);
        const sync = () => {
          startYear.hidden = ownedNow.input.checked;
          figure.hidden = ownedNow.input.checked;
          endYear.hidden = kept.input.checked;
        };
        ownedNow.input.addEventListener("change", sync);
        kept.input.addEventListener("change", sync);
        sync();
        parts.push(ownedNow, startYear, figure, kept, endYear);
      } else {
        parts.push(startYear, endYear, figure);
      }
      next = async () => {
        const fields = {};
        fields.purchaseAge = ownedNow && ownedNow.input.checked ? null : timelineAge(Number(startYear.input.value));
        fields.saleAge = (kept && kept.input.checked) || endYear.input.value === "" ? null
          : timelineAge(Number(endYear.input.value));
        if (leased) fields.leaseMonthly = Number(figure.input.value);
        else if (fields.purchaseAge != null) fields.purchasePrice = Number(figure.input.value);
        if (await timelineStep({ op: "edit", position: flow.position, fields })) timelineClose();
      };
    }
    if (flow.error) parts.push(timelineNote(flow.error, true));
    for (const note of flow.notes) parts.push(timelineNote(note));
    const actions = document.createElement("div");
    actions.className = "sheet-actions timeline-nav";
    const back = timelineButton(words.start.back, "back");
    back.disabled = !flow.history.length;
    back.addEventListener("click", () => {
      Object.assign(flow, { step: flow.history.pop(), error: null });
      timelineScreen();
    });
    const go = timelineButton(flow.step === "edit" || flow.step === "add" ? words.start.done : words.start.next, "next",
      "button-primary");
    go.addEventListener("click", async () => {
      if (flow.busy) return;
      flow.busy = true;
      for (const button of actions.querySelectorAll("button")) button.disabled = true;
      try {
        await next();
      } finally {
        flow.busy = false;
        if (timelineFlow === flow && !$("sheet").hidden && document.contains(go)) {
          for (const button of actions.querySelectorAll("button")) button.disabled = false;
          back.disabled = !flow.history.length;
        }
      }
    });
    const done = timelineButton(words.start.done, "close");
    done.addEventListener("click", timelineClose);
    actions.append(back, go, done);
    parts.push(actions);
    $("sheetBody").replaceChildren(...parts);
    const first = $("sheetBody").querySelector("input");
    if (first) first.focus({ preventScroll: true });
  }

  // Apply the screen's edit; on refusal show its sentence on the same screen. Returns the result, or null.
  async function timelineStep(op) {
    const flow = timelineFlow;
    const result = await applyTimeline(flow.kind, op);
    if (!result.ok) {
      flow.error = result.error;
      timelineScreen();
      return null;
    }
    flow.notes = flow.notes.concat(result.notes);
    renderSettings();
    return result;
  }

  // ---- Setup: scenario files (export, import), reset, about ----
  const downloadsReady = window.claude && window.claude.use ? window.claude.use("downloads").catch(() => null)
    : Promise.resolve(null);

  // The result of an export or import, under the open scenario card, scrolled into view so it is seen also when the
  // action was taken further down the page (an Other scenarios row's menu).
  function showFileMessage(text, isError) {
    const message = $("fileMessage");
    message.hidden = false;
    message.className = isError ? "banner banner-error" : "banner";
    message.textContent = text;
    if (typeof message.scrollIntoView === "function") message.scrollIntoView({ block: "nearest" });
  }

  // Start a real file download of `text` in the browser (a Blob link). False when the page cannot make one.
  function downloadFile(filename, text) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Export settings as a scenario file named after the scenario: the open one (the card's Export) by default. The file
  // is saved through the host's downloads when it offers them, else downloaded by the browser; where neither works the
  // text opens in a dialog to copy. A message under the card always says what happened.
  async function exportScenario(inputs = state.inputs, name = state.scenarioName) {
    const check = checkScenarioName(name, state.info.scenarioName);
    if (!check.ok) { showFileMessage(name + ": " + check.error + " Rename it, then export.", true); return; }
    const file = await ask("exportScenario", [JSON.stringify(inputs), check.name]);
    if (!file || !file.ok) { showFileMessage(file ? file.error : "Export did not finish; try again.", true); return; }
    const downloads = await downloadsReady;
    if (downloads) {
      try {
        await downloads.save({ filename: file.filename, data: file.text });
        showFileMessage("Saved " + file.filename + ".", false);
        return;
      } catch (error) {
        if (error && error.code === "declined") { showFileMessage("Export cancelled.", false); return; }
      }
    }
    if (downloadFile(file.filename, file.text)) {
      showFileMessage("Downloaded " + file.filename + ".", false);
      return;
    }
    exportDialog(file);
  }

  // The copy-text fallback, as a dialog over the page: the file's text and a Copy text button.
  function exportDialog(file) {
    const text = document.createElement("textarea");
    text.className = "input mono";
    text.id = "exportText";
    text.rows = 6;
    text.readOnly = true;
    text.setAttribute("aria-label", "Scenario file text");
    text.value = file.text;
    showFileMessage("Saving files is not available here; copy the text into a file named " + file.filename + ".", false);
    openDialog({ title: "Export " + file.filename,
      text: "Saving files is not available here. Copy the text and save it as " + file.filename + ".", body: [text],
      actions: [["Copy text", "button", () => copyExport(text, file.filename), "copyExport"],
        ["Close", "button button-quiet", () => true, "exportClose"]], focus: text });
  }

  async function copyExport(text, filename) {
    try {
      await navigator.clipboard.writeText(text.value);
      showFileMessage("Copied. Paste it into a file named " + filename + ".", false);
      return true;
    } catch (error) {
      text.focus();
      text.select();
      dialogError("Copy is blocked here; the text is selected so you can copy it yourself.");
      return false;
    }
  }

  // Open a scenario file's text as the open scenario, named after the file. Returns whether it opened; a refusal
  // shows under the card, in the Import dialog when it is open, and on the walkthrough's first step when it came from
  // there.
  async function importText(text, fileName) {
    const tooLarge = importProblem(text);
    const reply = tooLarge ? { ok: false, error: tooLarge } : await ask("importScenario", [text]);
    if (!reply || !reply.ok) {
      const message = reply ? reply.error : "Import did not finish; try again.";
      showFileMessage(message, true);
      if (!$("dialog").hidden) dialogError(message);
      if (walk.open && walk.importing) { walk.importing = false; walkError(message); }
      return false;
    }
    state.inputs = reply.inputs;
    state.base = clone(state.inputs);
    state.scenarioName = fileName ? fileName.replace(/\.json$/i, "") : "Pasted scenario";
    showLoadSplash(state.scenarioName);
    forgetBlankWalk();
    const upgraded = reply.fromVersion !== reply.inputs.schemaVersion;
    showFileMessage("Opened " + state.scenarioName + "."
      + (upgraded ? " Upgraded to the current format; export to save the new file." : ""), false);
    renderSettings();
    inputsChanged();
    resetUndo();
    renderSaved();
    closeDialog();
    if (walk.open && walk.importing) await walkImported();
    return true;
  }

  // A scenario file's list that is longer than the loader allows, refused here with the loader's message before the
  // worker reads the file, so a huge file cannot keep the phone busy. Null when the worker should read it (text that
  // is not JSON or not an object gets the worker's own message).
  function importProblem(text) {
    if (!state.info || !state.info.listLimits) return null;
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      const problem = scenarioFileProblem(data, state.info.listLimits);
      return problem ? "scenario file: " + problem : null;
    } catch (error) {
      return null;
    }
  }

  // Open the file picker of the hidden file input; `blocked` runs when the browser shows none (no focus change within
  // a moment), so the caller can offer the paste box instead.
  function pickScenarioFile(blocked) {
    let opened = false;
    const mark = () => { opened = true; };
    window.addEventListener("blur", mark, { once: true });
    document.addEventListener("visibilitychange", mark, { once: true });
    $("importFile").addEventListener("change", mark, { once: true });
    $("importFile").addEventListener("cancel", mark, { once: true });
    try { $("importFile").click(); } catch (error) { blocked(); return; }
    setTimeout(() => {
      window.removeEventListener("blur", mark);
      document.removeEventListener("visibilitychange", mark);
      if (!opened) blocked();
    }, 1200);
  }

  // Clear all data on this device: a first tap arms the button, a second removes every key this app keeps, the
  // installed app's offline copy (its caches) and its service worker, then reloads, so the page starts as on a first
  // visit (the Terms step included).
  async function clearAllData(button) {
    if (button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      button.textContent = "Tap again to delete everything";
      setTimeout(() => { button.dataset.armed = "false"; button.textContent = "Clear all data on this device"; }, 4000);
      return;
    }
    button.dataset.armed = "false";
    button.disabled = true;
    state.clearing = true;  // store() writes nothing from here on
    for (const key of STORAGE_KEYS) {
      try { localStorage.removeItem(key); } catch (error) { /* storage blocked: nothing kept */ }
    }
    try {
      if (window.caches) for (const key of await caches.keys()) if (key.startsWith("wmti:")) await caches.delete(key);
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
      }
    } catch (error) { /* no offline copy here */ }
    $("clearMessage").textContent = "Everything this app kept on this device is deleted. Reloading.";
    $("clearMessage").hidden = false;
    if (!window.WMTI_NO_RELOAD_ON_CLEAR) location.reload();
  }

  // The banner on Outputs that names the lists still holding the example household's (fictional) figures.
  function renderExampleBanner() {
    const banner = $("exampleBanner");
    if (!banner) return;
    const items = exampleLeftoverItems();
    banner.hidden = !items.length;
    banner.textContent = items.length ? "Example figures still in use for: " + items.map((item) => item[1]).join(", ")
      + ". They are fictional; replace them under Inputs." : "";
  }

  function resetToExample(button) {
    if (button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      button.textContent = "Tap again to replace your settings";
      setTimeout(() => { button.dataset.armed = "false"; button.textContent = "Load example household"; }, 4000);
      return;
    }
    button.dataset.armed = "false";
    button.textContent = "Load example household";
    showLoadSplash(EXAMPLE_NAME);
    state.inputs = clone(state.defaults);
    state.base = clone(state.defaults);
    state.scenarioName = EXAMPLE_NAME;
    state.exampleHidden = false;
    savePrefs();
    state.seed = state.info.defaultSeed;
    forgetBlankWalk();
    showFileMessage("The example household is loaded.", false);
    renderSettings();
    inputsChanged();
    resetUndo();
    renderSaved();
  }

  // The About window: opened from the menu over the page, closed by Done, the backdrop or Escape.
  function openAbout() {
    closeMenu();
    renderAbout();
    $("aboutUpdateStatus").textContent = "";
    $("aboutSheet").hidden = false;
    $("aboutBackdrop").hidden = false;
    $("aboutDone").focus();
  }

  function closeAbout() {
    if ($("aboutSheet").hidden) return;
    $("aboutSheet").hidden = true;
    $("aboutBackdrop").hidden = true;
    $("menuButton").focus();
  }

  function renderAbout() {
    $("aboutBuild").textContent = "Build " + window.WMTI_BUILD.id + (installablePage() ? ". Works offline once loaded." : ".");
    $("aboutVersion").textContent = "Version: " + window.WMTI_BUILD.id;
    // Only the static-host build registers a service worker (pwa.js); on the artifact host updates come from the host.
    $("aboutCheck").hidden = !window.wmtiServiceWorker;
    if (!state.info) return;
    const versions = state.info.versions;
    const rows = [["Build", window.WMTI_BUILD.id], ["Pyodide", state.pyodideVersion || window.WMTI_BUILD.pyodide],
      ["Python", versions.python], ["numpy / pandas", versions.numpy + " / " + versions.pandas],
      ["Law data", "Tax year " + state.info.lawTaxYear], ["Scenario format", "Version " + state.info.inputsSchemaVersion],
      ["Engine start", state.bootMs != null ? (state.bootMs / 1000).toFixed(1) + " s" : "n/a"],
      ["Last run", state.lastRunMs != null ? state.lastRunMs + " ms" : "n/a"],
      ["Monte Carlo and Compare", state.perRunMs != null ? Math.round(state.perRunMs) + " ms per run" : "n/a"]];
    $("about").innerHTML = rows.map(([label, value]) => "<dt>" + escapeText(label) + "</dt><dd>" + escapeText(value)
      + "</dd>").join("");
  }

  // About, Check for updates: ask the host for a newer build (registration.update()) and say what came of it. A newer
  // build that installs is offered through pwa.js's "New version ready" bar (window.wmtiOfferUpdate); the page never
  // reloads on its own.
  function whenInstalled(worker) {
    return new Promise((resolve) => {
      const settle = () => {
        if (worker.state === "installed" || worker.state === "activated") resolve(true);
        else if (worker.state === "redundant") resolve(false);
      };
      worker.addEventListener("statechange", settle);
      settle();
    });
  }

  async function checkForUpdates() {
    const button = $("aboutCheck");
    const status = $("aboutUpdateStatus");
    button.disabled = true;
    status.textContent = "Checking...";
    let outcome = "offline";
    try {
      const registration = await window.wmtiServiceWorker;
      if (registration) {
        await registration.update();
        const incoming = registration.installing;
        if (incoming) await whenInstalled(incoming);
        outcome = registration.waiting ? "ready" : "current";
        if (outcome === "ready" && window.wmtiOfferUpdate) window.wmtiOfferUpdate(registration.waiting);
      }
    } catch (error) {
      outcome = "offline";
    }
    status.textContent = updateCheckText(outcome);
    button.disabled = false;
  }

  // ---- Terms and Legal ----
  // The documents and the Terms version come from legal.js, which build.py writes from LICENSE and legal/*.md. On a
  // first visit, or when the Terms version (its date and the start of the text's sha256) changed, the Terms step covers the page until the box is ticked and Agree
  // and continue is pressed; Decline keeps the app locked. The acceptance is kept under TERMS_KEY; when storage is
  // blocked the step asks again on each load. The Legal window (menu) shows the documents and the acceptance date.
  const LEGAL = window.WMTI_LEGAL || { version: "", textHash: "", documents: [] };
  let termsAgreed = Promise.resolve();  // settles once the Terms are agreed to (at once when already agreed)

  function readTerms() {
    try { return localStorage.getItem(TERMS_KEY); } catch (error) { return null; }  // storage blocked: ask each load
  }

  // Draw documents (ids of LEGAL.documents) into a box as plain headings and paragraphs.
  function drawLegal(box, ids) {
    box.replaceChildren();
    for (const id of ids) {
      const legalDocument = LEGAL.documents.find((item) => item.id === id);
      if (!legalDocument) continue;
      for (const block of legalBlocks(legalDocument.text)) {
        const element = document.createElement(block.kind === "heading" ? (block.level === 1 ? "h3" : "h4") : "p");
        element.textContent = block.text;
        box.append(element);
      }
    }
  }

  function drawLegalSummary() {
    for (const box of document.querySelectorAll(".legal-summary")) {
      const list = document.createElement("ul");
      list.className = "field-help";
      list.replaceChildren(...LEGAL_SUMMARY.map((point) => {
        const item = document.createElement("li");
        item.textContent = point;
        return item;
      }));
      const closing = document.createElement("p");
      closing.className = "field-help";
      closing.textContent = LEGAL_SUMMARY_CLOSING;
      box.replaceChildren(list, closing);
    }
  }

  function startTerms() {
    drawLegalSummary();
    if (termsAccepted(readTerms(), LEGAL.version)) return;
    termsAgreed = new Promise((resolve) => {
      drawLegal($("termsText"), ["terms", "privacy", "license"]);
      $("terms").hidden = false;
      $("app").inert = true;
      $("termsAgree").addEventListener("change", () => {
        $("termsAccept").disabled = !$("termsAgree").checked;
        if ($("termsAgree").checked) $("termsDeclined").hidden = true;
      });
      $("termsDecline").addEventListener("click", () => { $("termsDeclined").hidden = false; });
      $("termsAccept").addEventListener("click", () => {
        if (!$("termsAgree").checked) return;
        const accepted = { version: LEGAL.version, textHash: LEGAL.textHash, buildId: window.WMTI_BUILD.id,
          acceptedAt: new Date().toISOString() };
        try { localStorage.setItem(TERMS_KEY, JSON.stringify(accepted)); } catch (error) { /* asked again next load */ }
        $("terms").hidden = true;
        $("app").inert = false;
        resolve();
      });
      $("termsTitle").focus();
    });
  }

  // The Legal window: opened from the menu over the page, closed by Done, the backdrop or Escape.
  function openLegal() {
    closeMenu();
    let accepted = null;
    try { accepted = JSON.parse(readTerms()); } catch (error) { /* none kept */ }
    const date = accepted && accepted.acceptedAt ? new Date(accepted.acceptedAt) : null;
    $("legalAccepted").textContent = date && !isNaN(date) && termsAccepted(readTerms(), LEGAL.version)
      ? "Terms: you agreed to version " + LEGAL.version + " on " + date.toLocaleDateString() + "."
      : "Terms: version " + LEGAL.version + ".";
    $("legalDocs").replaceChildren(...LEGAL.documents.map((legalDocument, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button" + (index ? " button-quiet" : "");
      button.dataset.doc = legalDocument.id;
      button.setAttribute("aria-pressed", String(!index));
      button.textContent = legalDocument.title;
      return button;
    }));
    if (LEGAL.documents.length) drawLegal($("legalDoc"), [LEGAL.documents[0].id]);
    $("legalSheet").hidden = false;
    $("legalBackdrop").hidden = false;
    $("legalDone").focus();
  }

  function showLegalDocument(event) {
    const button = event.target.closest("[data-doc]");
    if (!button) return;
    for (const other of $("legalDocs").querySelectorAll("[data-doc]")) {
      other.setAttribute("aria-pressed", String(other === button));
      other.classList.toggle("button-quiet", other !== button);
    }
    drawLegal($("legalDoc"), [button.dataset.doc]);
  }

  function closeLegal() {
    if ($("legalSheet").hidden) return;
    $("legalSheet").hidden = true;
    $("legalBackdrop").hidden = true;
    $("menuButton").focus();
  }

  // ---- Install: the static-host build (the only one with a manifest) can be added to the home screen ----
  // The menu gains "Install app" while the page is not already running as an installed app. Chrome and Android hand
  // over an install prompt (beforeinstallprompt), which the item shows; Safari on iOS has none, so the item opens a
  // short help sheet instead.
  let installPrompt = null;
  const installablePage = () => document.querySelector("link[rel=manifest]") !== null;
  const runningInstalled = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
    || navigator.standalone === true;
  const appleMobile = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function markInstall() {
    if ($("menuInstall")) $("menuInstall").hidden = runningInstalled();
  }

  function openInstallHelp() {
    $("installHelp").textContent = appleMobile() ? "Tap Share, then Add to Home Screen."
      : "Open your browser's menu, then choose Install app or Add to Home screen.";
    $("installSheet").hidden = false;
    $("installBackdrop").hidden = false;
    $("installDone").focus();
  }

  function closeInstallHelp() {
    if (!$("installSheet") || $("installSheet").hidden) return;
    $("installSheet").hidden = true;
    $("installBackdrop").hidden = true;
    $("menuButton").focus();
  }

  function installApp() {
    closeMenu();
    if (!installPrompt) {
      openInstallHelp();
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    prompt.prompt();
    prompt.userChoice.then(markInstall, markInstall);
  }

  function wireInstall() {
    if (!installablePage()) return;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "menu-item";
    item.id = "menuInstall";
    item.title = "Add this app to your home screen: it then opens with one tap and works offline.";
    item.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 4v11M7 10l5 5 5-5M5 20h14\"/></svg>"
      + "<span>Install app</span>";
    $("menu").insertBefore(item, $("menuAbout"));
    const sheet = document.createElement("div");
    sheet.innerHTML = "<div class=\"sheet-backdrop\" id=\"installBackdrop\" hidden></div>"
      + "<div class=\"sheet\" id=\"installSheet\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"installTitle\" hidden>"
      + "<div class=\"sheet-head\"><h2 id=\"installTitle\">Install app</h2>"
      + "<button type=\"button\" class=\"button\" id=\"installDone\">Done</button></div>"
      + "<div class=\"sheet-body\"><p class=\"field-help\" id=\"installHelp\"></p>"
      + "<p class=\"field-help\">Once added, it opens from your home screen with one tap and works offline.</p></div></div>";
    $("app").append(...sheet.children);
    item.addEventListener("click", installApp);
    $("installDone").addEventListener("click", closeInstallHelp);
    $("installBackdrop").addEventListener("click", closeInstallHelp);
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      markInstall();
    });
    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      markInstall();
    });
    if (window.matchMedia) window.matchMedia("(display-mode: standalone)").addEventListener("change", markInstall);
    markInstall();
  }

  // ---- Walkthrough: one question at a time, written to the inputs ----
  // The questions, their order and every answer's check come from wmti.dashboard.walkthrough (walkthroughTree at
  // start-up, walkthroughPlan and walkthroughApply through the worker); each answer is written to the real inputs at
  // once, and `before` (the inputs when the walkthrough started) lets "Undo my answers" put them back. Progress is
  // kept on this device under WALK_KEY: {v, tree, status (active, paused, done or skipped), current (a question id,
  // "start", "welcome" or "review"), trail (the screens visited, for Back), opened (questions and optional topics whose deeper
  // questions are open), answers (id to {status, values}), before}.
  const WALK_SWAP_MS = 340;  // the overlapping slide and fade between two screens
  const WALK_FLASH_MS = 1000;  // the highlight of a question total that changed
  const WALK_SCREENS = ["start", "welcome", "review"];  // the screens that are not questions
  const walk = { saved: null, index: null, plan: null, open: false, busy: false, pending: null, swap: 0,
    mapReturn: null, importing: false, lastTotal: null, flashTimer: null };

  function walkSave() {
    store(WALK_KEY, walk.saved);  // with storage blocked `walk.saved` still keeps this visit consistent
  }

  function loadWalk() {
    if (!state.walkTree) return;
    walk.index = walkIndex(state.walkTree);
    const saved = load(WALK_KEY);
    if (!isObject(saved) || saved.v !== 1) { walk.saved = null; return; }
    const topicIds = state.walkTree.topics.map((topic) => topic.id);
    walk.saved = { ...walkClean(saved, walk.index, topicIds), tree: state.walkTree.version };
  }

  // A new scenario's walkthrough: a fresh start at the first question, its blank numbers shown as empty boxes.
  function startBlankWalk() {
    if (!state.walkTree || walk.open) return;
    walk.saved = { ...freshWalk("active"), current: null, blank: true, hinted: walk.saved ? walk.saved.hinted : undefined };
    walkSave();
    openWalk();
  }

  // Another scenario is open: its zeros are answers, so they show as zeros again.
  function forgetBlankWalk() {
    if (walk.saved && walk.saved.blank) { delete walk.saved.blank; walkSave(); }
  }

  function freshWalk(status) {
    return { v: 1, tree: state.walkTree.version, status, current: "start", trail: [], opened: [], answers: {},
      before: clone(state.inputs) };
  }

  function walkRows() {
    return walk.plan ? walk.plan.questions : [];
  }

  function walkRow(id) {
    return walkRows().find((row) => row.id === id) || null;
  }

  function firstUnanswered() {
    const row = walkRows().find((item) => !walk.saved.answers[item.id]);
    return row ? row.id : "review";
  }

  // The screen after a question in plan order: its first opened deeper question, the next question, or the review. A
  // question its own answer took out of the plan (its condition no longer holds) goes on to `following`, the screen
  // after it before the answer, while that is still planned.
  function walkAfter(id, following) {
    const rows = walkRows();
    const at = rows.findIndex((row) => row.id === id);
    if (at < 0) return following === "review" || walkRow(following) ? following : firstUnanswered();
    return at + 1 < rows.length ? rows[at + 1].id : "review";
  }

  async function walkReplan() {
    const reply = await ask("walkthroughPlan", [JSON.stringify(state.inputs), JSON.stringify(walk.saved.opened)]);
    if (reply && reply.ok) walk.plan = reply;
    else if (!walk.plan) walk.plan = { questions: [], basicCount: 0, facts: null };
  }

  // Open the walkthrough: a fresh start after a skip or an undo (or the first time), else where it was left; a
  // finished one opens on the review. A fresh start opens on the first step (import a file or continue) while the
  // plan offers it, else on the welcome. The automatic Monte Carlo waits while it is open.
  async function openWalk() {
    if (!state.walkTree || walk.open) return;
    const saved = walk.saved;
    if (!saved || saved.status === "skipped" || !isObject(saved.before)) walk.saved = freshWalk("active");
    else {
      if (saved.status === "done") saved.current = "review";
      saved.status = "active";
    }
    walk.open = true;
    walk.lastTotal = null;
    clearTimeout(mcTimer);
    $("walkResume").hidden = true;
    $("walk").hidden = false;
    $("app").inert = true;
    walkSave();
    await walkReplan();
    let target = walk.saved.current;
    if (target === "start" && !walk.plan.offerImport) target = "welcome";
    if (!target || (!WALK_SCREENS.includes(target) && !walkRow(target))) target = firstUnanswered();
    showWalkScreen(target, "forward", false);
  }

  function closeWalk(status) {
    if (!walk.open) return;
    walk.open = false;
    walk.importing = false;
    walk.saved.status = status;
    walkSave();
    closeWalkMap(false);
    closeWalkLeave(false);
    $("walk").hidden = true;
    $("walkStage").replaceChildren();
    $("walkActions").replaceChildren();
    $("app").inert = false;
    scheduleMc();
  }

  function walkToast(text) {
    const toast = $("walkToast");
    toast.textContent = text;
    toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 6000);
  }

  // ---- Walkthrough screens ----
  function walkButton(text, className, onClick, submit) {
    const button = document.createElement("button");
    button.type = submit ? "submit" : "button";
    button.className = className;
    button.textContent = text;
    if (onClick) button.addEventListener("click", onClick);
    return button;
  }

  function walkHeading(text) {
    const heading = document.createElement("h1");
    heading.id = "walkTitle";
    heading.className = "walk-question";
    heading.tabIndex = -1;
    heading.textContent = text;
    return heading;
  }

  function walkParagraph(text, className) {
    const paragraph = document.createElement("p");
    paragraph.className = className;
    paragraph.textContent = text;
    return paragraph;
  }

  function walkEyebrow(text, className) {
    return walkParagraph(text, "eyebrow walk-eyebrow" + (className ? " " + className : ""));
  }

  // The short bullets under a Go deeper offer: what its deeper questions cover.
  function walkPreviewHtml(preview) {
    if (!preview || !preview.length) return "";
    return "<ul class=\"walk-preview\">" + preview.map((bullet) => "<li>" + escapeText(bullet) + "</li>").join("")
      + "</ul>";
  }

  function walkPreview(preview) {
    const holder = document.createElement("div");
    holder.innerHTML = walkPreviewHtml(preview);
    return holder.firstElementChild;
  }

  // Show a screen: the first step, the welcome, a question or the review. `direction` (forward or back) sets the slide;
  // `animate` false (opening) shows it at once.
  function showWalkScreen(id, direction, animate) {
    walk.saved.current = id;
    walkSave();
    const screen = id === "start" ? startScreen() : id === "welcome" ? welcomeScreen() : id === "review" ? reviewScreen()
      : questionScreen(id);
    swapWalkScreen(screen.element, direction, animate !== false);
    $("walkActions").replaceChildren(...screen.actions);
    renderWalkTop(id);
    $("walkTitle").focus({ preventScroll: true });
  }

  // Move to another screen, remembering this one for Back.
  function walkGo(target, direction) {
    const current = walk.saved.current;
    if (current && current !== target) walk.saved.trail.push(current);
    showWalkScreen(target, direction || walkDirection(walkRows(), current, target));
  }

  // The new screen slides in while the old one slides out (forward: out to the left, in from the right; back: the
  // reverse), both fading; transform and opacity only. With reduced motion the two only cross-fade.
  function swapWalkScreen(next, direction, animate) {
    const stage = $("walkStage");
    const olds = [...stage.children];
    for (const old of olds) {
      const heading = old.querySelector("#walkTitle");
      if (heading) heading.removeAttribute("id");
    }
    stage.dataset.direction = direction;
    if (!animate || !olds.length) { stage.replaceChildren(next); return; }
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [outClass, inClass] = reduced ? ["fading-out", "fading-in"] : ["leaving", "entering"];
    for (const old of olds) {
      old.classList.remove("entering", "fading-in", "forward", "back");
      old.classList.add(outClass, direction);
      old.setAttribute("aria-hidden", "true");
      old.inert = true;
    }
    next.classList.add(inClass, direction);
    stage.append(next);
    $("walk").classList.add("walk-swapping");
    const swap = ++walk.swap;
    setTimeout(() => {
      for (const old of olds) old.remove();
      next.classList.remove(inClass, direction);
      if (swap === walk.swap) $("walk").classList.remove("walk-swapping");
    }, WALK_SWAP_MS);
  }

  // The progress bar (one segment per topic), the topic over the question, Back and the spoken position.
  function renderWalkTop(id) {
    const progress = walkProgress(state.walkTree, walkRows(), id);
    const bar = $("walkProgress");
    bar.innerHTML = progress.segments.map((segment) => "<span data-state=\"" + segment.state + "\"></span>").join("");
    const opening = id === "start" || id === "welcome";
    const where = opening ? "Welcome" : id === "review" ? "Review"
      : "Question " + progress.number + " of " + progress.total + ", " + (progress.topic || "");
    bar.setAttribute("aria-valuemax", String(progress.total));
    bar.setAttribute("aria-valuenow", String(id === "review" ? progress.total : progress.number));
    bar.setAttribute("aria-valuetext", where);
    $("walkTopic").textContent = opening ? "Walk me through it" : id === "review" ? "Your plan"
      : progress.topic || "";
    $("walkBack").disabled = opening;
    $("walkMapButton").hidden = opening;
    $("walkLive").textContent = where;
    $("walkCount").hidden = opening || id === "review";
    $("walkCountNumber").textContent = String(progress.number);
    $("walkCountTotal").textContent = String(progress.total);
    if (walk.lastTotal != null && progress.total !== walk.lastTotal) flashWalkTotal();
    walk.lastTotal = progress.total;
  }

  // An answer added or removed questions: highlight the total for a second, fading out (held without motion when
  // reduced motion is on, see styles.css).
  function flashWalkTotal() {
    const total = $("walkCountTotal");
    total.classList.remove("walk-count-flash");
    void total.offsetWidth;  // restart the animation when the total changes again within the second
    total.classList.add("walk-count-flash");
    clearTimeout(walk.flashTimer);
    walk.flashTimer = setTimeout(() => total.classList.remove("walk-count-flash"), WALK_FLASH_MS);
  }

  // The first step: import an existing scenario file (the Setup import's file picker), or continue to the welcome.
  function startScreen() {
    const start = state.walkTree.start;
    const element = document.createElement("div");
    element.className = "walk-screen";
    const error = walkParagraph("", "walk-error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    element.append(walkEyebrow("Before you start"), walkHeading(start.prompt), walkParagraph(start.lede, "walk-lede"),
      error);
    walk.errorText = null;
    const importButton = walkButton(start.importLabel, "button walk-primary", walkImport);
    importButton.id = "walkImport";
    const continueButton = walkButton(start.continueLabel, "button button-quiet", null, true);
    continueButton.id = "walkContinue";
    return { element, actions: [importButton, continueButton] };
  }

  function walkImport() {
    if (walk.busy) return;
    walk.importing = true;
    walkError(null);
    pickScenarioFile(() => {
      walk.importing = false;
      walkError("This browser did not open a file picker. Continue the walkthrough, then paste the scenario text "
        + "under Setup, Import.");
    });
  }

  // After an import from the first step: the questions the file answers count as answered, and the walkthrough goes
  // on to the first one it does not answer (the review when it answers them all).
  async function walkImported() {
    walk.importing = false;
    await walkReplan();
    for (const id of walk.plan.notExample || []) walk.saved.answers[id] = { status: "answered", values: null };
    walkSave();
    walkGo(firstUnanswered(), "forward");
  }

  function welcomeScreen() {
    const element = document.createElement("div");
    element.className = "walk-screen";
    element.append(walkEyebrow("About 5 minutes"), walkHeading("Let's set up your plan"),
      walkParagraph("Each question is filled in with what your settings hold now: Continue takes what is shown, "
        + "changed or not, and Skip leaves it as it is. You can change any answer later.", "walk-lede"));
    const start = walkButton("Start", "button walk-primary", null, true);
    const skip = walkButton("Skip for now", "walk-quiet", () => {
      const hinted = walk.saved.hinted;
      walk.saved.hinted = true;
      closeWalk("skipped");
      goTo("outputs", "summary");
      if (!hinted) walkToast("“Walk me through it...” is in the menu (top right) whenever you want it.");
    });
    return { element, actions: [start, skip] };
  }

  function walkStart() {
    if (!Object.keys(walk.saved.answers).length) walk.saved.before = clone(state.inputs);
    const first = walkRows()[0];
    walkGo(first ? first.id : "review", "forward");
  }

  function choiceText(field, choice) {
    return (field.choiceLabels && field.choiceLabels[String(choice)]) || (choice == null ? "None" : String(choice));
  }

  // Big option buttons (a radio group) for a toggle, the partner question and a short list of choices.
  function walkChoices(labelIds, options, selected, onPick) {
    const group = document.createElement("div");
    group.className = "walk-options";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", labelIds);
    for (const [value, text] of options) {
      const button = walkButton(text, "walk-option", () => {
        for (const item of group.children) item.setAttribute("aria-checked", String(item === button));
        onPick(value);
      });
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(sameValue(value, selected)));
      button.insertAdjacentHTML("afterbegin", "<span class=\"walk-radio\" aria-hidden=\"true\"></span>");
      group.append(button);
    }
    return group;
  }

  function walkSet(key, value) {
    walk.pending.values[key] = value;
    walk.pending.touched = true;
    const tag = $("walkStage").querySelector(".walk-screen:last-child .walk-example");
    if (tag) tag.hidden = true;
    walkError(null);
  }

  // A number box of the walkthrough: big, named by the question and its label, its bounds checked as it is typed. It
  // never takes an empty value (that is refused with the screen's message), so no answer blanks a field. `onValue`
  // takes the number instead of the answer under `key`.
  function walkNumberBox(node, field, key, value, labelIds, index, onValue) {
    const id = "walk-" + node.id + "-" + index;
    const holder = document.createElement("div");
    holder.className = "walk-number";
    let committed = false;
    const shownValue = walk.saved && walk.saved.blank && value === 0 ? null : value;  // a new scenario's blank
    holder.append(numberInput(id, { ...field, nullable: false }, shownValue, (next) => {
      committed = true;
      if (onValue) onValue(next);
      else walkSet(key, next);
      const floor = field.minimumFrom ? walkRead(state.inputs, field.minimumFrom) : null;
      const problem = typeof next === "number" ? walkBoundsError(field, next, floor) : null;
      if (problem) {
        $(id).setAttribute("aria-invalid", "true");
        walkError(problem);
      }
    }));
    holder.querySelector("input").setAttribute("aria-labelledby", labelIds);
    holder.querySelector(".field-error").remove();  // the screen's one message line shows format and bounds
    const input = holder.querySelector("input");
    input.addEventListener("input", () => {  // runs after numberInput's own check, which commits a number
      if (!committed && input.getAttribute("aria-invalid") === "true") {
        walkError(!input.value.trim() ? "Enter a number."
          : field.kind === "integer" ? "Enter a whole number." : "Enter a number, such as 1500 or 2.5.");
      }
      committed = false;
    });
    return holder;
  }

  // One field's control, keyed by its path in the answers: option buttons, a list, a map editor or a number box.
  function walkField(node, field, index) {
    const multiple = node.fields.length > 1;
    const labelId = "walkLabel-" + index;
    const labelIds = "walkTitle " + labelId;
    const wrap = document.createElement("div");
    wrap.className = "walk-field";
    const label = walkParagraph(field.label, multiple ? "walk-label" : "sr-only");
    label.id = labelId;
    let current = walkRead(state.inputs, field.path);
    if (current === undefined) current = node.action === "balances" ? 0 : null;
    if (field.years) return walkRecentYears(node, field, wrap, index);
    walk.pending.values[field.path] = clone(current);
    if (field.kind !== "map") wrap.append(label);
    if (multiple && field.help && field.kind !== "map") {
      const helpId = newHelpId();
      label.insertAdjacentHTML("beforeend", helpButtonHtml(field.label, helpId));
      wrap.insertAdjacentHTML("beforeend", helpTextHtml(helpId, field.help, "walk-help"));
    }
    if (field.kind === "toggle") {
      wrap.append(walkChoices(labelIds, [[true, field.yes || "Yes"], [false, field.no || "No"]], Boolean(current),
        (value) => walkSet(field.path, value)));
    } else if (field.choices && field.choices.length <= 6) {
      wrap.append(walkChoices(labelIds, field.choices.map((choice) => [choice, choiceText(field, choice)]), current,
        (value) => walkSet(field.path, value)));
    } else if (field.choices) {
      const select = document.createElement("select");
      select.className = "input walk-select";
      select.setAttribute("aria-labelledby", labelIds);
      const options = (field.nullable ? [null] : []).concat(field.choices);
      if (current != null && !options.some((choice) => sameValue(choice, current))) options.push(current);
      for (const choice of options) {
        const option = document.createElement("option");
        option.value = choice == null ? "" : String(choice);
        option.textContent = choiceText(field, choice);
        select.append(option);
      }
      select.value = current == null ? "" : String(current);
      select.addEventListener("change", () => {
        walkSet(field.path, options.find((choice) => (choice == null ? "" : String(choice)) === select.value) ?? null);
      });
      wrap.append(select);
    } else if (field.kind === "map") {
      const scratch = { value: clone(current || {}) };
      const draw = () => mapField(field, "value", scratch.value, "walk-" + node.id + "-" + index, scratch, (redraw) => {
        walkSet(field.path, clone(scratch.value));
        if (redraw) wrap.replaceChildren(draw());
      });
      wrap.append(draw());
    } else {
      wrap.append(walkNumberBox(node, field, field.path, current, labelIds, index));
    }
    return wrap;
  }

  // A map of years asked for its recent years only: one number box a year, filled in with the amount the plan counts
  // now (`facts.recentEarnings`); the answer holds those years and the other years of the map stay.
  function walkRecentYears(node, field, wrap, index) {
    const recent = (walk.plan.facts && walk.plan.facts.recentEarnings) || {};
    const amounts = { ...(recent[field.path] || {}) };
    walk.pending.values[field.path] = clone(amounts);
    field.years.forEach((year, yearIndex) => {
      const yearLabel = walkParagraph(field.label + " in " + year, "walk-label");
      yearLabel.id = "walkLabel-" + index + "-" + yearIndex;
      wrap.append(yearLabel, walkNumberBox(node, { ...field, kind: "number", label: field.label + " in " + year },
        field.path, amounts[year] ?? null, "walkTitle " + yearLabel.id, index + "-" + yearIndex, (next) => {
          amounts[year] = next;
          walkSet(field.path, clone(amounts));
        }));
    });
    return wrap;
  }

  // The control of a question that changes the shape of the inputs: the partner, the number of children or of cars, or
  // the monthly spending total.
  function walkAction(node) {
    const labelIds = "walkTitle";
    if (node.action === "partner") {
      const has = state.inputs.partner != null;
      walk.pending.values.hasPartner = has;
      return walkChoices(labelIds, [[true, "Yes"], [false, "No"]], has, (value) => walkSet("hasPartner", value));
    }
    if (WALK_COUNT_LISTS[node.action]) {
      const count = (state.inputs[WALK_COUNT_LISTS[node.action]] || []).length;
      walk.pending.values.count = count;
      return walkNumberBox(node, { kind: "integer", unit: "count", label: WALK_ACTION_LABELS[node.action],
        minimum: node.minimum, maximum: node.maximum, nullable: false }, "count", count, labelIds, 0);
    }
    const total = walk.plan.facts ? Math.round(walk.plan.facts.monthlySpending) : 0;
    walk.pending.values.total = total;
    return walkNumberBox(node, { kind: "number", unit: "money", label: "Monthly spending", minimum: 0, maximum: null,
      nullable: false }, "total", total, labelIds, 0);
  }

  // Whether the inputs hold the example household's answer to a question.
  function walkIsExample(node) {
    if (node.action === "partner") return (state.inputs.partner != null) === node.example;
    const countList = WALK_COUNT_LISTS[node.action];
    if (countList) return (state.inputs[countList] || []).length === node.example;
    if (node.action === "total") return walk.plan.facts != null
      && Math.abs(walk.plan.facts.monthlySpending - node.example) < 1;
    return node.fields.every((field) => sameValue(walkRead(state.inputs, field.path) ?? null, field.example ?? null)
      || (node.action === "balances" && walkRead(state.inputs, field.path) == null && !field.example));
  }

  function walkError(text) {
    walk.errorText = text || null;
    const line = $("walkStage").querySelector(".walk-screen:last-child .walk-error");
    if (!line) return;
    line.hidden = !text;
    line.textContent = text || "";
  }

  function questionScreen(id) {
    const { node } = walk.index[id];
    const row = walkRow(id) || { depth: 0, control: node.control, hasDeeper: false };
    walk.pending = { values: {}, touched: false };
    walk.errorText = null;
    const element = document.createElement("div");
    element.className = "walk-screen";
    element.dataset.question = id;
    // "Question X of Y" is pinned above the stage (renderWalkTop); a deeper question is marked here.
    if (row.depth > 0) element.append(walkEyebrow("Go deeper", "walk-deeper"));
    const head = document.createElement("div");
    head.className = "walk-head";
    head.append(walkHeading(node.prompt));
    const help = node.fields.length === 1 ? node.fields[0].help : null;
    if (help && row.control !== "handoff") {
      const helpId = newHelpId();
      head.insertAdjacentHTML("beforeend", helpButtonHtml(node.fields[0].label, helpId));
      element.append(head);
      element.insertAdjacentHTML("beforeend", helpTextHtml(helpId, help, "walk-help"));
    } else {
      element.append(head);
    }
    if (node.hint && walk.plan.facts) {
      element.append(walkParagraph(walkHint(node.hint.template, walk.plan.facts), "walk-lede"));
    }
    const actions = [];
    if (row.control === "handoff") {
      const panel = node.handoff;
      element.append(walkParagraph("This is set on the " + panel.label + " page, where you can see and change every "
        + "row. Your answers so far are kept.", "walk-lede"));
      actions.push(walkButton("Continue", "button walk-primary", null, true),
        walkButton("Open " + panel.label, "walk-quiet", () => walkHandoff(panel.panel)));
      return { element, actions };
    }
    const controls = document.createElement("div");
    controls.className = "walk-controls";
    if (node.action && node.action !== "balances") controls.append(walkAction(node));
    else node.fields.forEach((field, index) => controls.append(walkField(node, field, index)));
    element.append(controls);
    const example = walkParagraph("Example value", "walk-example");
    example.hidden = !walkIsExample(node);
    const error = walkParagraph("", "walk-error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    element.append(example, error);
    actions.push(walkButton("Continue", "button walk-primary", null, true));
    if (row.hasDeeper && node.offer && !walk.saved.opened.includes(id)) {
      actions.push(walkButton("Go deeper: " + node.offer, "button button-quiet walk-deeper-button", walkDeeper));
      if (node.preview && node.preview.length) actions.push(walkPreview(node.preview));
    }
    const quiet = document.createElement("div");
    quiet.className = "walk-quiet-row";
    quiet.append(walkButton("Skip", "walk-quiet", () => walkAnswerAndMove("skip")));
    actions.push(quiet);
    return { element, actions };
  }

  // Write the current question's answer: `answer` (Continue: the shown values, written only when one was changed; an
  // empty or invalid box is refused) or `skip` (no change). Returns false when it was refused, with the message under
  // the field.
  async function walkCommit(mode) {
    if (walk.busy) return false;
    const id = walk.saved.current;
    const row = walkRow(id);
    let applyMode = "skip";
    let values = null;
    let status = "skipped";
    if (mode === "answer") {
      status = "answered";
      if (row && row.control !== "handoff") {
        const bad = $("walkStage").querySelector(".walk-screen:last-child [aria-invalid=true]");
        if (bad) {
          walkError(walk.errorText || "Enter a number.");
          bad.focus();
          return false;
        }
        if (walk.pending.touched) {
          applyMode = "answer";
          values = walk.pending.values;
        }
      }
    }
    walk.busy = true;
    try {
      if (applyMode !== "skip") {
        const reply = await ask("walkthroughApply", [JSON.stringify(state.inputs), id, JSON.stringify(values),
          applyMode]);
        if (!reply || !reply.ok) {
          walkError(reply ? reply.error : "The answer was not saved; try again.");
          const field = $("walkStage").querySelector(".walk-screen:last-child input, .walk-screen:last-child select");
          if (field) field.focus();
          return false;
        }
        state.inputs = reply.inputs;
        renderSettings();
        inputsChanged();
      }
      walk.saved.answers[id] = { status, values };
      walkSave();
      await walkReplan();
      return true;
    } finally {
      walk.busy = false;
    }
  }

  async function walkAnswerAndMove(mode) {
    const id = walk.saved.current;
    const following = walkAfter(id);
    if (await walkCommit(mode)) walkGo(walkAfter(id, following), "forward");
  }

  async function walkDeeper() {
    const id = walk.saved.current;
    if (!(await walkCommit("answer"))) return;
    if (!walk.saved.opened.includes(id)) walk.saved.opened.push(id);
    await walkReplan();
    walkGo(walkAfter(id), "forward");
  }

  // The form's submit (Continue, or Enter in a field): start, answer and move on, or finish.
  function walkSubmit() {
    if (walk.busy || !$("walkMap").hidden || !$("walkLeave").hidden) return;
    const current = walk.saved.current;
    if (current === "start") walkGo("welcome", "forward");
    else if (current === "welcome") walkStart();
    else if (current === "review") walkFinish();
    else walkAnswerAndMove("answer");
  }

  function walkBack() {
    const trail = walk.saved.trail;
    while (trail.length) {
      const id = trail.pop();
      if (WALK_SCREENS.includes(id) || walkRow(id)) { showWalkScreen(id, "back"); return; }
    }
    if (walk.saved.current !== "welcome") showWalkScreen("welcome", "back");
  }

  // A hand-off: leave for an Inputs page, with a pill to come back to the same question.
  function walkHandoff(panel) {
    closeWalk("paused");
    state.chips.settings = panel;
    renderSettings();
    goTo("inputs", state.view);
    window.scrollTo(0, 0);
    $("walkResume").hidden = false;
  }

  function walkFinish() {
    closeWalk("done");
    goTo("outputs", "summary");
  }

  // ---- The Trail (the map of the questions) and the review ----
  function trailHtml(review) {
    const rows = walkRows();
    const facts = walk.plan.facts;
    return walkTrail(state.walkTree, walk.index, rows, walk.saved, review ? null : walk.saved.current)
      .map((group) => {
        let html = "<li class=\"walk-topic-group\"><h3 class=\"eyebrow\">" + escapeText(group.title) + "</h3>";
        if (group.offer) {
          return html + "<button type=\"button\" class=\"walk-row walk-offer\" data-topic=\"" + escapeText(group.id)
            + "\">+ Go deeper: " + escapeText(group.title) + "</button>"
            + walkPreviewHtml((state.walkTree.topics.find((topic) => topic.id === group.id) || {}).preview) + "</li>";
        }
        html += "<ol class=\"walk-trail-list\">" + group.items.map((item) => {
          const depth = " style=\"--depth:" + item.depth + "\"";
          if (item.kind === "offer") {
            return "<li" + depth + "><button type=\"button\" class=\"walk-row walk-offer\" data-offer=\""
              + escapeText(item.id) + "\">+ " + escapeText(item.label) + "</button></li>";
          }
          const node = walk.index[item.id].node;
          const answer = item.status === "todo" && !review ? "Not yet" : answerText(node, state.inputs, facts);
          const tag = "<span class=\"walk-tag\" data-status=\"" + item.status + "\">" + WALK_TAGS[item.status]
            + "</span>";
          const text = "<span class=\"walk-row-text\"><span class=\"walk-row-label\">" + escapeText(item.label)
            + "</span><span class=\"walk-row-answer\">" + escapeText(answer) + "</span></span>";
          if (review) {
            return "<li class=\"walk-review-row\"" + depth + ">" + text + tag + "<button type=\"button\" "
              + "class=\"walk-change\" data-jump=\"" + escapeText(item.id) + "\" aria-label=\"Change "
              + escapeText(item.label) + "\">Change</button></li>";
          }
          return "<li" + depth + "><button type=\"button\" class=\"walk-row\" data-jump=\"" + escapeText(item.id) + "\""
            + (item.status === "now" ? " aria-current=\"step\"" : "") + ">" + text + tag + "</button></li>";
        }).join("") + "</ol></li>";
        return html;
      }).join("");
  }

  // The lists the walkthrough does not set in full that still equal the example household's: [panel, label, count,
  // unit] each (a list you changed is not listed).
  function exampleLeftoverItems() {
    if (!state.inputs) return [];
    return [["children", "Children", (state.inputs.children || []).length, "children"],
      ["expenses", "Expense rows", (state.inputs.expenses || []).length, "rows"],
      ["cars", "Cars", (state.inputs.cars || []).length, "cars"],
      ["loans", "Loans", (state.inputs.loans || []).length, "loans"]].filter((item) => item[2] > 0
        && state.defaults != null && sameValue(state.inputs[item[0]], state.defaults[item[0]]));
  }

  // The Review screen's group of those lists, each with its page.
  function exampleLeftovers() {
    const items = exampleLeftoverItems();
    if (!items.length) return "";
    return "<li class=\"walk-topic-group\"><h3 class=\"eyebrow\">Still from the example household</h3>"
      + "<ol class=\"walk-trail-list\">" + items.map(([panel, label, count, unit]) => "<li class=\"walk-review-row\">"
        + "<span class=\"walk-row-text\"><span class=\"walk-row-label\">" + label + "</span><span class=\"walk-row-answer\">"
        + count + " " + unit + "</span></span><button type=\"button\" class=\"walk-change\" data-panel=\"" + panel
        + "\" aria-label=\"Open " + label + "\">Open</button></li>").join("") + "</ol></li>";
  }

  function reviewScreen() {
    const element = document.createElement("div");
    element.className = "walk-screen walk-review";
    element.append(walkEyebrow("Review"), walkHeading("Here is your plan"),
      walkParagraph("Every answer is already in your settings. Change any of them, or go deeper.", "walk-lede"));
    const list = document.createElement("ol");
    list.className = "walk-trail";
    list.innerHTML = trailHtml(true) + exampleLeftovers();
    element.append(list);
    return { element, actions: [walkButton("Finish", "button walk-primary", null, true)] };
  }

  function openWalkMap() {
    walk.mapReturn = document.activeElement;
    $("walkMapBody").innerHTML = "<ol class=\"walk-trail\">" + trailHtml(false) + "</ol>";
    $("walkMap").hidden = false;
    $("walkMapBackdrop").hidden = false;
    $("walkMapButton").setAttribute("aria-expanded", "true");
    const current = $("walkMapBody").querySelector("[aria-current=step]") || $("walkMapBody").querySelector("button");
    if (current) current.focus();
  }

  function closeWalkMap(restoreFocus) {
    if ($("walkMap").hidden) return;
    $("walkMap").hidden = true;
    $("walkMapBackdrop").hidden = true;
    $("walkMapButton").setAttribute("aria-expanded", "false");
    if (restoreFocus !== false && walk.mapReturn && document.contains(walk.mapReturn)) walk.mapReturn.focus();
  }

  function openWalkLeave() {
    $("walkLeave").hidden = false;
    $("walkLeaveBackdrop").hidden = false;
    $("walkKeep").focus();
  }

  function closeWalkLeave(restoreFocus) {
    if ($("walkLeave").hidden) return;
    $("walkLeave").hidden = true;
    $("walkLeaveBackdrop").hidden = true;
    if (restoreFocus !== false && $("walkTitle")) $("walkTitle").focus();
  }

  // Escape closes the Trail first, then the leave sheet, then asks to leave. True when the walkthrough handled it.
  function walkEscape() {
    if (!walk.open) return false;
    if (!$("walkMap").hidden) closeWalkMap();
    else if (!$("walkLeave").hidden) closeWalkLeave();
    else openWalkLeave();
    return true;
  }

  // A tap in the Trail or the review: jump to a question, open a question's or an optional topic's deeper questions,
  // or open an Inputs page.
  async function walkTrailClick(event) {
    const button = event.target.closest("[data-jump], [data-offer], [data-topic], [data-panel]");
    if (!button || walk.busy) return;
    closeWalkMap(false);
    if (button.dataset.panel) { walkHandoff(button.dataset.panel); return; }
    if (button.dataset.jump) {
      if (button.dataset.jump !== walk.saved.current) walkGo(button.dataset.jump);
      else $("walkTitle").focus();
      return;
    }
    const opened = button.dataset.offer || button.dataset.topic;
    if (!walk.saved.opened.includes(opened)) walk.saved.opened.push(opened);
    walkSave();
    await walkReplan();
    const target = button.dataset.offer ? walkAfter(opened)
      : (walkRows().find((row) => row.topic === opened) || { id: "review" }).id;
    walkGo(target);
  }

  function walkUndo() {
    state.inputs = clone(walk.saved.before);
    renderSettings();
    inputsChanged();
    walk.saved = { ...freshWalk("skipped"), hinted: walk.saved.hinted, before: null };
    closeWalk("skipped");
  }

  function wireWalk() {
    $("walk").addEventListener("submit", (event) => { event.preventDefault(); walkSubmit(); });
    $("walkBack").addEventListener("click", () => { if (!walk.busy) walkBack(); });
    $("walkMapButton").addEventListener("click", openWalkMap);
    $("walkMapDone").addEventListener("click", () => closeWalkMap());
    $("walkMapBackdrop").addEventListener("click", () => closeWalkMap());
    $("walkMapBody").addEventListener("click", walkTrailClick);
    $("walkStage").addEventListener("click", walkTrailClick);
    $("walkClose").addEventListener("click", openWalkLeave);
    $("walkKeep").addEventListener("click", () => closeWalkLeave());
    $("walkLeaveBackdrop").addEventListener("click", () => closeWalkLeave());
    $("walkLater").addEventListener("click", () => closeWalk("paused"));
    $("walkUndo").addEventListener("click", walkUndo);
    $("walkResume").addEventListener("click", openWalk);
    $("menuWalk").addEventListener("click", () => { closeMenu(); openWalk(); });
  }

  // ---- Wiring ----
  function wire() {
    for (const tab of document.querySelectorAll(".tab")) {
      tab.addEventListener("click", () => selectTab(tab.dataset.tab));
    }
    for (const tab of document.querySelectorAll(".view-tab")) {
      tab.addEventListener("click", () => selectView(tab.dataset.view));
    }
    wireTabKeys(document.querySelector(".tabbar"), ".tab", (tab) => selectTab(tab.dataset.tab));
    wireTabKeys($("views-outputs"), ".view-tab", (tab) => selectView(tab.dataset.view));
    document.addEventListener("focusin", (event) => $("app").classList.toggle("typing", isTyping(event.target)));
    document.addEventListener("focusout", () => $("app").classList.remove("typing"));
    document.addEventListener("keyup", enterEndsEdit);
    document.addEventListener("click", (event) => {
      const button = event.target.closest(".help-button");
      if (button) toggleHelp(button);
    });
    $("settings-body").addEventListener("submit", (event) => event.preventDefault());
    $("household-body").addEventListener("submit", (event) => event.preventDefault());
    $("sheetDone").addEventListener("click", closeSheet);
    $("sheetSave").addEventListener("click", closeSheet);  // the same as Done, at the bottom of the sheet
    $("sheetBackdrop").addEventListener("click", closeSheet);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!$("rowMenu").hidden) { closeRowMenu(); return; }
      if (!$("dialog").hidden) { closeDialog(); return; }
      if (walkEscape()) return;
      closeMenu();
      closeAbout();
      closeLegal();
      closeInstallHelp();
      closeSheet();
    });
    $("menuButton").addEventListener("click", openMenu);
    $("menuBackdrop").addEventListener("click", closeMenu);
    $("undoButton").addEventListener("click", undoLast);
    $("menuAbout").addEventListener("click", openAbout);
    $("aboutCheck").addEventListener("click", checkForUpdates);
    $("aboutDone").addEventListener("click", closeAbout);
    $("aboutBackdrop").addEventListener("click", closeAbout);
    $("menuLegal").addEventListener("click", openLegal);
    $("legalDone").addEventListener("click", closeLegal);
    $("legalBackdrop").addEventListener("click", closeLegal);
    $("legalDocs").addEventListener("click", showLegalDocument);
    for (const button of document.querySelectorAll(".scheme")) {
      button.addEventListener("click", () => setScheme(button.dataset.scheme));
    }
    $("menuHelpButton").addEventListener("click", () => toggleHelp($("menuHelpButton")));
    wireInstall();
    wireWalk();
    markScheme();
    wireTabsPin();
    $("saveButton").addEventListener("click", saveButtonPressed);
    $("autoSave").addEventListener("click", toggleAutoSave);
    $("renameButton").addEventListener("click", () => renameDialog(state.scenarioName));
    $("duplicateButton").addEventListener("click", duplicateOpen);
    $("clearButton").addEventListener("click", clearDialog);
    $("exportButton").addEventListener("click", () => exportScenario());
    $("newButton").addEventListener("click", newDialog);
    $("importButton").addEventListener("click", importDialog);
    $("dialog").addEventListener("keydown", (event) => trapFocus(event, $("dialog")));
    $("dialogBackdrop").addEventListener("click", () => closeDialog());
    $("rowMenu").addEventListener("keydown", rowMenuKeys);
    document.addEventListener("click", (event) => {
      if (!$("rowMenu").hidden && !event.target.closest("#rowMenu")) closeRowMenu(false);
    });
    $("importFile").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importText(String(reader.result), file.name);
      reader.onerror = () => {
        showFileMessage("The file could not be read.", true);
        if (walk.open && walk.importing) { walk.importing = false; walkError("The file could not be read."); }
      };
      reader.readAsText(file);
      event.target.value = "";
    });
    $("resetButton").addEventListener("click", (event) => resetToExample(event.currentTarget));
    $("clearDataButton").addEventListener("click", (event) => clearAllData(event.currentTarget));
    $("bootRetry").addEventListener("click", () => location.reload());
  }

  renderBootSteps();
  wire();
  startTerms();
  engine.start();
})();

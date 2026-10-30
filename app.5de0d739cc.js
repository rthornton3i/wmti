// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// The page: boot screen, tabs and chips, settings forms built from the Python settings schema, results and charts.
// All numbers come from wmti.dashboard.web through the worker; this file only draws and keeps the draft.
(function () {
  "use strict";

  const { escapeText, compactMoney, fullMoney, percent, getPath, setPath, checkScenarioName, scenarioFileProblem, sheetFields, sheetLabel,
    sheetSwitches, clearedOnChange, kindReturnsFilled, kindOwnerFilled, returnsSummary, sheetDefault, showsDefault, sheetPrompt, sheetFieldNote, sheetSources,
    panelDefault, sheetResetTarget, sheetBlank, panelResetTarget, lastSalaryDefault, fieldDefault, atFieldDefault, formatValue, unfilledSuggestion, expensePresetChoices, expensePresetItem, countedElsewhereMatch, countedElsewhereText, choiceLabel, filterChoices, comboOptions, comboMove, comboPick, expenseAgesText, expenseAgeKnobs, expenseAgeStored, rothAgeKnobs, expenseSummary, expenseTotals, carSummary, carEstimatedValue, carPaidBy, sheetLoanPayment, carLoanNow, homeMortgageNow, sheetGroup, homeSummary, spanText, hasCarLoan, yearOfAge, ageOfYear, timelineBars, choosePrimary, primaryClashText, ensureOnePrimary, normalPair, tabRoute, inputsChip, normalCurvePoints, filteredPositions, filterStartValues, addHeir, syncChildHeirs, missingChildHeirs, addChildHeirs, dollarsNote, beneficiaryPayoutText,
    moveSelected, deleteSelected, moveItem, panelField, syncResetFlags, resetGroup, sameValue, matchPercent,
    matchTermsFromPercent, walkRead, walkBoundsError, walkHint, walkIndex, walkLabel, walkStatus, WALK_TAGS,
    WALK_ACTION_LABELS, WALK_COUNT_LISTS, walkProgress, walkTrail, walkDirection, walkClean, answerText, carTotalsOf,
    exampleLeftoverList, legalBlocks, termsAccepted, migrateLegacyStorage, updateCheckText, bannerFadeMs,
    storagePrefix, channelCachePrefixes, copyStableStorage, isBetaChannel,
    blankInputs, needsSetup, splitExperience, joinExperience, defaultExperience, storedExperience, carriedExperience,
    experienceDiffers, experienceChoice, experienceWords, defaultedInputCount, firstUnlocked, effortRank,
    otherScenarioNames, benefitAccounts, freeName, numberedName, importedName, planYears, undoRecord, undoStep, mergeUndoPush,
    mergeUndoPop, changedPaths, optimizeStepText, optimizeStatesEstimate, optimizeCheckpointKey, hasSocialSecurity, spendingStartAge, spendingChangeRows,
    spendingChangePreview, docsLink, stateRulesText } = window.WmtiShared;
  const charts = window.WmtiCharts;
  const report = window.WmtiReport;
  const insightRules = window.WmtiInsights;

  const BOOT_STEPS = [["script", "Loading the calculator"], ["boot", "Starting up"],
    ["packages", "Installing libraries"], ["imports", "Importing libraries"],
    ["model", "Loading the retirement model"], ["startup", "Reading your settings and the example household"]];
  const NOTES_PANELS = new Set(["accounts", "cars", "expenses", "retirement", "savings", "strategies"]);  // panels that show settingsNotes
  const SETUP_PANEL = "household";  // the schema panel drawn on Setup instead of as an Inputs chip
  const STRATEGY_PANEL = "strategies";  // the schema panel drawn on Strategy's Strategies view instead of as an Inputs chip
  const INFLATION_CARD_FIELDS = ["useInflation", "inflation"];  // fields of that panel drawn in the Inflation card
  const RUN_CARD_FIELDS = ["years"];  // fields of that panel drawn in the Run card, in Advanced settings
  const ROLLOVER_SWITCH = "strategies.rothConversion.enabled";  // adds or removes the rollover account
  // Plots chips: the chart spec id, the chip label, what the view shows and what it says when the run has no rows.
  // Every plot is drawn from the last Monte Carlo: "total" is its spread, the others the runs' middle half average each year.
  const PLOT_VIEWS = [
    { id: "total", label: "Total balance", charts: ["bands", "histogram"], intro: "The total balance over the runs "
      + "(the median run as a line, the 10th to 90th percentile shaded) and how the runs' final values spread." },
    { id: "balances", label: "Balances", intro: "Each account's balance at the end of each year, stacked; the "
      + "middle half average of the runs." },
    { id: "cashFlow", label: "Cash flow", intro: "Money in above zero: pay, Social Security and sale proceeds. Money out "
      + "below it (negative): expenses and taxes (early-withdrawal penalties included). Line: what is left over; above zero the year adds to the accounts, below "
      + "zero the accounts pay for it. Moves into and out of the accounts are on Deposits and withdrawals. The middle half "
      + "average of the runs." },
    { id: "flows", label: "Deposits and withdrawals", intro: "The middle half average of the runs. Deposits into the accounts "
      + "are above zero, withdrawals below it (negative). Traditional includes RMD and QCD; dotted line: the required "
      + "minimum. Social Security, pay and the Roth conversion are not bars." },
    { id: "taxes", label: "Taxes", intro: "The taxes charged each year, by kind; the middle half average of the runs. The "
      + "hatched bar is the sales tax inside your spending: already in expenses, shown for records, never added to the "
      + "taxes. The same figures by year, and the deductions, are tables in the Final report (PDF)." },
    { id: "expenses", label: "Expenses", intro: "What the household spends each year, by category; the middle half "
      + "average of the runs. Categories never charged are left out; taxes are in Taxes." },
  ];
  // What Compare does, behind the "i" beside the Compare card's heading.
  const COMPARE_HELP = "Pick two configs to compare. Both run on the same random draws (same seed), "
    + "so the differences come from the settings, not from luck. Save scenarios under Setup to compare them "
    + "here.";
  const CACHED_RESULTS = 2;  // Monte Carlo and comparison results kept per kind, newest first
  const DEFAULT_RUN_MS = 250;  // a phone's time per run until this device has measured one
  const SAVED_LIMIT = 50;
  const NO_EARNINGS_HINT = "Enter past earnings on the Income tab to use this.";  // wmti.dashboard.settings.NO_EARNINGS_HINT
  const MEDICARE_SLIDER_LOW = 65;  // the Medicare age slider's first age: Medicare eligibility (the model's default)
  const NULL_LABELS = { account529: "None (the 529s together)" };  // what a blank select choice means for these fields
  // Sheet choices shown as one inset row of radio buttons, every option at once (radioSegmentedField), by item type.
  const RADIO_SEGMENTED = { ExpenseItem: ["deduction", "taxable"] };
  // Of those, the choices whose picked button clears them to blank when tapped again (no blank button of their own).
  const RADIO_CLEARABLE = { ExpenseItem: ["deduction"] };
  // The medical plan's sharing switch (wmti VisitInputs.perHousehold), drawn as a Per person / Combined toggle right
  // after the out-of-pocket maximum; the walkthrough words its buttons the same (FieldRef yes and no).
  const PLAN_SHARE_PATH = "visits.perHousehold";
  const PLAN_SHARE_CHOICES = [[false, "Per person"], [true, "Combined"]];
  const LONG_SELECT_CHOICES = 12;  // a select with more choices than this (the states) is a combobox (stateCombobox)
  const RUN_DELAY_MS = 400;
  const SETTLE_MS = 400;  // a pause in editing this long makes one undo step (and, with Auto-save on, one save)
  const UNDO_LIMIT = 20;  // input states of the open scenario that Undo can step back through
  const MC_DELAY_MS = 1500;  // the pause after the single run before the Monte Carlo starts on its own
  const EXAMPLE_NAME = "Example household";
  const EXPERIENCE_VERSION = 57;  // the first schemaVersion with an experience block (an older file has none)
  // This channel's localStorage keys start with STORAGE_PREFIX: "wmti." for the stable app, "wmti.beta." for the beta
  // (window.WMTI_BUILD.channel), so a beta never reads or writes the stable app's scenarios and settings.
  const CHANNEL = (window.WMTI_BUILD || {}).channel;
  const STORAGE_PREFIX = storagePrefix(CHANNEL);
  // The effort and style (gamify) features: the picker, risk comfort, Low and Medium, the surfacing list, the effort
  // and style cues, the Coach Next steps card and every later gamify extra. build.py writes "off" for the stable
  // pages build (publish_pages.py --channel stable) and "on" for every other build; with them off the app shows High
  // and Accountant and keeps each scenario's experience block as it is. Every gamify entry point asks gamifyOn().
  const GAMIFY = "off" !== "off";
  const BETA_COPY_MARK = "copiedFromStable.v1";  // set once the beta has copied the stable app's keys (kept by Clear)
  const DRAFT_KEY = STORAGE_PREFIX + "draft.v1";
  const SCENARIOS_KEY = STORAGE_PREFIX + "scenarios.v1";
  const PREFS_KEY = STORAGE_PREFIX + "prefs.v1";
  const WALK_KEY = STORAGE_PREFIX + "walk.v1";  // the walkthrough's progress
  const TOUR_KEY = STORAGE_PREFIX + "tour.v1";  // "seen" once the tour has opened by itself after the first walkthrough
  const TERMS_KEY = STORAGE_PREFIX + "terms.v1";  // the Terms acceptance: {version, textHash, buildId, acceptedAt}
  const PICKER_KEY = STORAGE_PREFIX + "picker.v1";  // "done" once the effort and style picker has been kept
  const GAME_KEY = STORAGE_PREFIX + "game.v1";  // Gamer progress kept on the device before it moved into the scenario (read once)
  const GAME_PROGRESS_KEY = "game";  // the Gamer ledger's key in the scenario's experience.progress
  // The key points at the top of the Terms step and of the Legal window, one line each, then a pointer to the full Terms.
  const LEGAL_SUMMARY = [
    "This app is for educational and non-commercial use only and is not to be considered financial, tax, investment or legal advice.",
    "The app provides hypothetical projections that may differ from your actual results. Please verify them with a licensed professional before acting.",
    "Your data is not shared with the developer or any third-party providers. Data sharing is limited to GitHub Pages data sharing policies.",
    "Use of this app is at your own risk. The app is provided as is, without warranty.",
  ];
  const LEGAL_SUMMARY_CLOSING = "Please read the full Terms below.";
  const TABS = ["setup", "inputs", "outputs", "strategy", "awards"];  // the bottom bar, left to right (Awards: Gamer only)
  const VIEWS = ["summary", "plots"];  // the switch inside Outputs
  const STRATEGY_VIEWS = ["strategies", "compare", "optimize"];  // the switch inside Strategy
  const VIEW_ICONS = { summary: "chart", plots: "bands", strategies: "receipt", compare: "sliders", optimize: "pig",
    strategy: "compass", awards: "sprout" };  // its chips' icons
  // The color scheme, kept per viewer as plain text; index.html applies it before the first paint.
  const THEME_KEY = STORAGE_PREFIX + "theme.v1";
  // Every key this app keeps in localStorage; Clear all data on this device removes them all.
  // An interrupted strategy search: {key (optimizeCheckpointKey), inputsText, optionsText, checkpoint}.
  const OPTIMIZE_CHECKPOINT_KEY = STORAGE_PREFIX + "optimizeCheckpoint.v1";
  const TABS_PIN_KEY = STORAGE_PREFIX + "tabsPin.v1";  // whether Inputs' tabs stay pinned under the top bar: "on" or "off"
  const HEIRS_MARK_KEY = STORAGE_PREFIX + "heirsMark.v1";  // whether the balance charts mark What beneficiaries keep: "on" or "off"
  const EXTRAS_KEY = STORAGE_PREFIX + "extras.v1";  // whether Summary shows the source notes and estimates: "on" or "off"
  const LAW_KEY = STORAGE_PREFIX + "lawState.v1";  // kept by the removed law viewer; listed so Clear all data still removes it
  const SPLIT_KEY = STORAGE_PREFIX + "split.v1";  // the wide layout's Inputs share of the Inputs | Outputs room, "0" to "1"
  const SETUP_FOLD_KEY = STORAGE_PREFIX + "setupFold.v1";  // whether the wide layout's Setup column is folded to a rail: "folded" or "open"
  const ADVANCED_KEY = STORAGE_PREFIX + "advanced.v1";  // no longer kept; listed so Clear all data still removes it
  const LAW_STATE_PATHS = ["homeState", "strategies.relocation.state"];  // state selects with a "See this state's rules" link
  const STORAGE_KEYS = [DRAFT_KEY, SCENARIOS_KEY, PREFS_KEY, WALK_KEY, TOUR_KEY, TERMS_KEY, THEME_KEY,
    OPTIMIZE_CHECKPOINT_KEY, TABS_PIN_KEY, LAW_KEY, SPLIT_KEY, SETUP_FOLD_KEY, HEIRS_MARK_KEY, ADVANCED_KEY,
    PICKER_KEY, GAME_KEY, EXTRAS_KEY];
  // Keys kept before the rename (fpt.*) move to these once, before anything reads them (the stable app only). The
  // beta instead starts, once, from a copy of what the stable app keeps; it never writes a stable key.
  try {
    if (isBetaChannel(CHANNEL)) {
      copyStableStorage(localStorage, STORAGE_KEYS.map((key) => key.slice(STORAGE_PREFIX.length)), BETA_COPY_MARK);
    } else {
      migrateLegacyStorage(localStorage, TERMS_KEY, (window.WMTI_LEGAL || {}).textHash || "");
    }
  } catch (error) { /* storage blocked: nothing kept to move */ }
  const SCHEMES = ["lagoon", "sunset", "palm", "night", "device"];
  // The header band's section label, title (blank: the selected Inputs chip) and one-line subtitle per place.
  const PLACE_TEXT = {
    setup: ["Setup", "Scenarios and run", "Your scenarios and files, the household and the run"],
    inputs: ["Inputs", "", "Every change reruns the plan"],
    "outputs/summary": ["Outputs", "Summary", "From the last Monte Carlo"],
    "outputs/plots": ["Outputs", "Plots", "Middle half average of the runs"],
    "strategy/strategies": ["Strategy", "Strategies", "Tax strategies and end-of-plan settings"],
    "strategy/compare": ["Strategy", "Compare", "Two configs on the same random draws"],
    "strategy/optimize": ["Strategy", "Optimize", "The best strategy settings on the same random draws"],
    awards: ["Garden", "Garden", "Your garden, level, quests and awards, saved with this scenario"],
  };
  // Inline SVG icons (24 px grid, stroked): chips and pane titles.
  const ICONS = {
    user: "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6\"/>",
    sliders: "<path d=\"M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12\"/><circle cx=\"16\" cy=\"6\" r=\"2\"/>"
      + "<circle cx=\"10\" cy=\"12\" r=\"2\"/><circle cx=\"18\" cy=\"18\" r=\"2\"/>",
    chart: "<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/>",
    home: "<path d=\"M3 11l9-7 9 7v9h-6v-6H9v6H3z\"/>",
    key: "<circle cx=\"7.5\" cy=\"16.5\" r=\"4.5\"/><path d=\"M10.7 13.3L20 4M16 8l3 3M13.5 10.5l2.5 2.5\"/>",  // Rent
    bolt: "<path d=\"M13 2L4 14h7l-1 8 9-12h-7z\"/>",  // the Utilities pane
    briefcase: "<rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M8 7V5h8v2\"/>",
    baby: "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M6 21c0-4 3-6 6-6s6 2 6 6\"/>",
    heart: "<path d=\"M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z\"/>",
    sun: "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19"
      + "l1.5-1.5M17.5 6.5L19 5\"/>",
    pig: "<circle cx=\"12\" cy=\"13\" r=\"7\"/><path d=\"M12 9v8M9.5 11h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4\"/>",
    receipt: "<path d=\"M6 3h12v18l-3-2-3 2-3-2-3 2z\"/><path d=\"M9 8h6M9 12h6\"/>",
    bands: "<path d=\"M3 17l5-5 4 3 8-8\"/><path d=\"M3 21h18\"/>",
    pencil: "<path d=\"M4 20h4L19 9l-4-4L4 16z\"/><path d=\"M13 7l4 4\"/>",  // the timeline's Edit timeline button
    star: "<path d=\"M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z\"/>",
    compass: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M15.5 8.5l-2 5-5 2 2-5z\"/>",  // the Strategy chip
    sprout: "<path d=\"M12 21v-9M12 12c0-4-3-7-8-7 0 5 3 7 8 7zM12 14c0-4 3-6 8-6 0 4-3 6-8 6z\"/>",  // the Garden chip
  };
  // The icon of a chip or pane: the first word here found in its label, else in its id; sliders when none is. The
  // Home panel's three panes share the id "home", so Rent and Utilities are matched by label to icons of their own.
  const ICON_WORDS = [["household", "user"], ["income", "briefcase"], ["benefit", "briefcase"], ["savings", "briefcase"],
    ["children", "baby"], ["dependent", "baby"], ["rent", "key"], ["utilities", "bolt"], ["home", "home"],["loan", "receipt"], ["expense", "receipt"],
    ["tax", "receipt"], ["deduction", "receipt"], ["retirement plan", "pig"], ["total", "bands"], ["account", "pig"],
    ["balance", "pig"],
    ["medical", "heart"], ["hsa", "heart"], ["health", "heart"], ["medicare", "heart"], ["social security", "sun"],
    ["retirement", "sun"], ["summary", "chart"], ["cash", "chart"], ["flows", "sliders"]];

  const state = {
    info: null, schema: null, defaults: null, inputs: null, base: null, scenarioName: EXAMPLE_NAME, seed: 1,
    experience: null, defaultExperience: null,  // the open scenario's experience block, and a block-less scenario's
    walkTree: null, result: null, error: null, lastRunMs: null, bootMs: null, pyodideVersion: null,
    resultInputsText: null,  // the inputs text the single run's result ran on
    notes: null, surplusLocks: [], benefits: null, earnings: null, deposits: null, depositMoveNotes: [],
    heirLocks: [], heirNotice: [], childHeirsOn: null, heirSeenChildren: null,  // beneficiaries: slider locks, warning, children seen
    tab: "outputs", view: "summary", strategyView: "strategies", chips: { plots: null, settings: "income" },
    plotView: "chart", scenarios: Object.create(null), perRunMs: null,
    autoSaveOff: [], exampleHidden: false,
    openFolds: [],  // the closed-by-default disclosures opened this visit (the claim estimates, 80-settings.js)
    savedJustNow: false, undo: { stack: [], current: null },
    // preview: Low's partial result; seq: the number stamped on each Monte Carlo when it starts (the run diff's order)
    mc: { runs: 25, job: null, cache: [], message: null, skipKey: null, preview: null, seq: 0 },
    compare: { seed: 1, pair: null, check: null, job: null, cache: [], message: null, differencesOpen: false,
      armed: null, diffs: null, diffsPending: null, mergeUndo: [], merging: 0 },
    optimize: { info: null, job: null, entry: null, message: null, availability: null, availabilityPending: null,
      options: { effort: null, preset: null, dimensions: {}, states: [] },
      // The Earliest retirement card (59-earliest.js): its options (kept in the prefs), last result and message.
      earliest: { options: { effort: null, failurePercent: null }, entry: null, message: null } },
    // The Next steps card (49-coach.js): the gaps and the inputs text they are for, the running check, each gap's kept
    // check and last message, and the scenario they belong to.
    coach: { gaps: null, gapsKey: null, pendingKey: null, job: null, entries: {}, messages: {}, scenarioName: null },
    // Gamer progress (51-gamer.js): `ledger` reads the open scenario's experience.progress.game, cleaned.
    game: { get ledger() { return gameLedgerOf(state.experience); } },
  };
  const $ = (id) => document.getElementById(id);
  const gamifyOn = () => GAMIFY;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  // ---- Passing information banners ----
  // A banner shown in answer to a change ("Opened ...", "Deleted ...") stays bannerFadeMs (10 to 20 s, by its length),
  // then fades out (0.4 s; at once under reduced motion) and is hidden. The wait starts again while it is hovered or
  // has the focus, and when a new message is shown. It keeps role=status, so it is read out when shown. Tests set
  // window.WMTI_BANNER_FADE_MS before the page loads to change the wait. Warnings and errors never go through here.
  const BANNER_FADE_OUT_MS = 400;
  const bannerFades = new WeakMap();

  function stopBannerFade(element) {
    const fade = bannerFades.get(element);
    if (!fade) return;
    clearTimeout(fade.timer);
    clearTimeout(fade.out);
    fade.timer = null;
    fade.out = null;
    fade.active = false;
    element.classList.remove("banner-fading");
  }

  function armBannerFade(element) {
    const fade = bannerFades.get(element);
    clearTimeout(fade.timer);
    if (!fade.active || fade.held) return;
    const wait = typeof window.WMTI_BANNER_FADE_MS === "number" ? window.WMTI_BANNER_FADE_MS
      : bannerFadeMs(element.textContent);
    fade.timer = setTimeout(() => {
      fade.timer = null;
      if (reducedMotion()) { element.hidden = true; fade.active = false; return; }
      element.classList.add("banner-fading");
      fade.out = setTimeout(() => {
        fade.out = null;
        fade.active = false;
        element.hidden = true;
        element.classList.remove("banner-fading");
      }, BANNER_FADE_OUT_MS);
    }, wait);
  }

  // Show `element` (its text already set) and let it fade after its time.
  function showFadingBanner(element) {
    if (!element) return;
    if (!bannerFades.has(element)) {
      const fade = { timer: null, out: null, active: false, hover: false, focus: false,
        get held() { return this.hover || this.focus; } };
      bannerFades.set(element, fade);
      const hold = (key, value) => {
        fade[key] = value;
        if (!fade.active) return;
        if (fade.held) {
          clearTimeout(fade.timer);
          clearTimeout(fade.out);
          fade.out = null;
          element.classList.remove("banner-fading");
        } else armBannerFade(element);
      };
      element.addEventListener("pointerenter", () => hold("hover", true));
      element.addEventListener("pointerleave", () => hold("hover", false));
      element.addEventListener("focusin", () => hold("focus", true));
      element.addEventListener("focusout", () => hold("focus", false));
    }
    stopBannerFade(element);
    element.hidden = false;
    bannerFades.get(element).active = true;
    armBannerFade(element);
  }

  // ---- Storage (per viewer, may be unavailable) ----
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (error) { return null; }
  }
  function store(key, value) {
    if (state.clearing) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* storage blocked: keep going */ }
  }
  // The draft keeps the open scenario's experience block (state.experience, never inside state.inputs) with its
  // settings, the walkthrough's `before` included.
  function saveDraft() {
    store(DRAFT_KEY, { inputs: joinExperience(state.inputs, state.experience), base: state.base,
      scenarioName: state.scenarioName, seed: state.seed });
  }
  function savePrefs() {
    const compare = state.compare;
    store(PREFS_KEY, { tab: state.tab, view: state.view, strategyView: state.strategyView, chips: state.chips,
      plotView: state.plotView,
      surplusLocks: state.surplusLocks, mc: { runs: state.mc.runs }, autoSaveOff: state.autoSaveOff,
      exampleHidden: state.exampleHidden,
      compare: { seed: compare.seed, pair: compare.pair },
      earliest: { ...state.optimize.earliest.options } });
  }

  // ---- Engine (the worker) ----
  const engine = (() => {
    let worker = null;
    let nextId = 1;
    const pending = new Map();
    let readyResolve;
    const ready = new Promise((resolve) => { readyResolve = resolve; });

    function start() {
      worker = new Worker("worker.2eb526ef9d.js");
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

    // `options` adds fields to the message: `partialRuns` asks a Monte Carlo for one partial result (worker.js).
    function job(fn, args, lane, onProgress, options) {
      const id = nextId++;
      const promise = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress });
        worker.postMessage({ id, fn, args, lane, ...(options || {}) });
      });
      return { id, promise };
    }

    function call(fn, args, lane, onProgress) { return job(fn, args, lane, onProgress).promise; }

    function cancel(target) { worker.postMessage({ fn: "cancel", target }); }

    // End a batched strategy search now, keeping the best so far (its result still arrives).
    function finish(target) { worker.postMessage({ fn: "finish", target }); }

    // Answer a strategy search paused at its run budget: true continues with another budget of runs, false keeps the
    // best so far (its result still arrives).
    function answerCap(target, more) { worker.postMessage({ fn: "answerCap", target, more }); }

    // Hold a strategy search after its batch (the page went to the background), then run it on again.
    function pause(target) { worker.postMessage({ fn: "pause", target }); }
    function resume(target) { worker.postMessage({ fn: "resume", target }); }

    return { start, call, job, cancel, finish, answerCap, pause, resume, ready };
  })();
  window.wmtiEngine = engine;  // for the tests and for debugging

  // Each edit's place in line: inputsChanged and every request whose reply replaces the inputs (inputsTicket) take the
  // next number. A reply is written only while its request is still the newest edit; an older one (a switch-off's
  // block reset answered after the next edit) would undo that edit, so its write is dropped.
  let inputsRevision = 0;

  // Take the next edit number for a request that will replace the inputs; the returned check says whether its reply
  // may still be written (no edit, and no other such request, came after it).
  function inputsTicket() {
    const mine = ++inputsRevision;
    return () => mine === inputsRevision;
  }

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
    // The example household's experience block is kept apart from its settings (state.experience is never inside
    // state.inputs): it is the block of a scenario that has none.
    const example = splitExperience(message.defaults);
    Object.assign(state, { info: message.info, schema: message.schema, defaults: example.inputs,
      defaultExperience: example.experience || defaultExperience(),
      walkTree: message.walkthrough, bootMs: message.bootMs, pyodideVersion: message.pyodideVersion,
      seed: message.info.defaultSeed });
    state.experience = clone(state.defaultExperience);
    // A new user's first launch: no saved draft, no walkthrough progress (an older page's, under WALK_KEY, counts:
    // it is moved into the draft only by loadWalk below) and no saved scenario, decided before the draft is restored.
    const draftRead = readDraft();
    const savedBefore = load(SCENARIOS_KEY);
    const firstVisit = draftRead.draft == null && !draftRead.unreadable && load(WALK_KEY) == null
      && !(isObject(savedBefore) && Object.keys(savedBefore).length);
    let pickerDone = false;  // the effort and style picker is shown once to every user
    try { pickerDone = localStorage.getItem(PICKER_KEY) === "done"; } catch (error) { /* storage blocked: shown */ }
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
      if (route && route.view) state[route.tab === "strategy" ? "strategyView" : "view"] = route.view;
      else if (outputViews().includes(prefs.view)) state.view = prefs.view;  // Awards only in Gamer style
      if (STRATEGY_VIEWS.includes(prefs.strategyView)) state.strategyView = prefs.strategyView;
      Object.assign(state.chips, prefs.chips || {});
      if (route && route.chip) state.chips.settings = route.chip;
      // Prefs of the page before the Strategy tab: Compare and Optimize were Outputs views, Strategies an Inputs chip.
      if (state.tab === "outputs" && STRATEGY_VIEWS.includes(prefs.view)) {
        state.tab = "strategy";
        state.strategyView = prefs.view;
      }
      if (state.tab === "inputs" && state.chips.settings === STRATEGY_PANEL) {
        state.tab = "strategy";
        state.strategyView = STRATEGY_VIEWS[0];
        state.chips.settings = null;  // Inputs opens at its first chip
      }
      if (prefs.plotView === "table") state.plotView = "table";
      if (Array.isArray(prefs.surplusLocks)) state.surplusLocks = prefs.surplusLocks.filter((name) => typeof name === "string");
      restoreRunPrefs(prefs);
      // Auto-save is on unless turned off for a scenario; the older one-switch preference (`autoSave`) is not read, since
      // it could not tell a switch turned off from the old default.
      if (Array.isArray(prefs.autoSaveOff)) state.autoSaveOff = prefs.autoSaveOff.filter((name) => typeof name === "string");
      // The example household left Other scenarios when deleted there; it is back whenever it is the open scenario.
      state.exampleHidden = prefs.exampleHidden === true && state.scenarioName !== EXAMPLE_NAME;
    }
    const saved = load(SCENARIOS_KEY);
    // A map with no prototype, so a scenario named __proto__ or constructor is an ordinary key.
    if (saved && typeof saved === "object" && !Array.isArray(saved)) state.scenarios = Object.assign(Object.create(null), saved);
    const hashRoute = tabRoute(location.hash);
    if (hashRoute) state.tab = hashRoute.tab;
    if (hashRoute && hashRoute.tab === "setup") revealSetup();  // a link to Setup
    if (hashRoute && hashRoute.chip) state.chips.settings = hashRoute.chip;
    if (hashRoute && hashRoute.view) state[hashRoute.tab === "strategy" ? "strategyView" : "view"] = hashRoute.view;
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
    // The Terms step comes first; then, until it has been kept once, the effort and style picker (a returning user's
    // with High and Accountant chosen; never with gamify off); on a first launch then the walkthrough, then the tour
    // (once per device).
    await termsAgreed;
    if (gamifyOn() && (firstVisit || !pickerDone)) {
      await openExperiencePicker(firstVisit ? "firstLaunch" : "returning");
      try { localStorage.setItem(PICKER_KEY, "done"); } catch (error) { /* storage blocked */ }
    }
    if (firstVisit) walk.tourAfter = !tourSeen();
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
    // The Earliest retirement options; checked against the offered choices once the card's info comes.
    const earliest = isObject(prefs.earliest) ? prefs.earliest : {};
    const options = state.optimize.earliest.options;
    if (Number.isInteger(earliest.failurePercent)) options.failurePercent = earliest.failurePercent;
    if (typeof earliest.effort === "string") options.effort = earliest.effort;
  }

  const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

  // Forget the saved draft and use the example household; returns the notice to show.
  function discardDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (error) { /* storage blocked: nothing to remove */ }
    state.inputs = clone(state.defaults);
    state.base = clone(state.defaults);
    state.experience = clone(state.defaultExperience);
    state.scenarioName = EXAMPLE_NAME;
    state.seed = state.info.defaultSeed;
    return "Saved settings could not be read; defaults loaded.";
  }

  // Whether an experience block holds an effort and a style the pickers offer (appInfo().experience).
  function knownExperience(experience) {
    const offered = state.info.experience;
    return isObject(experience) && offered.efforts.some((item) => item.id === experience.effort)
      && offered.styles.some((item) => item.id === experience.style);
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
  // An upgraded draft is saved again at once in the current format. The draft's experience block becomes
  // state.experience (split off before the shape check); a draft without one gets the block of a scenario saved
  // before the pickers, and a block with an effort or style the app does not offer discards the draft.
  async function restoreDraft() {
    const { draft, unreadable } = readDraft();
    state.inputs = clone(state.defaults);
    state.base = clone(state.defaults);
    if (unreadable) return discardDraft();
    if (draft == null) return null;
    if (!isObject(draft) || !isObject(draft.inputs)) return discardDraft();
    let { inputs, experience } = splitExperience(draft.inputs);
    const upgraded = inputs.schemaVersion !== state.info.inputsSchemaVersion;
    if (upgraded) {
      const reply = await ask("importScenario", [JSON.stringify(draft.inputs)]);
      if (!reply || !reply.ok) return discardDraft();
      ({ inputs, experience } = splitExperience(reply.inputs));
    } else if (!sameShape(state.defaults, inputs)) {
      return discardDraft();
    }
    if (experience != null && !knownExperience(experience)) return discardDraft();
    state.inputs = inputs;
    state.experience = experience ? clone(experience) : clone(state.defaultExperience);
    const base = splitExperience(draft.base).inputs;
    state.base = isObject(base) && base.schemaVersion === state.info.inputsSchemaVersion ? base : clone(inputs);
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
    inputsRevision += 1;  // a reply still on its way for an earlier edit no longer writes the inputs (inputsTicket)
    normalizeFilingTableChoices();
    syncHeirs();  // a beneficiary per child while Add children as beneficiaries is on; shares at 100%
    if (state.schema) syncResetFlags(state.schema, state.inputs);
    saveDraft();
    state.savedJustNow = false;
    scheduleSettle();
    renderLoaded();
    const summaryCard = $("expenseSummary");
    if (summaryCard) fillExpenseSummary(summaryCard);
    refreshSpending();  // the Spending in retirement amounts follow every edit (a percent, the start or stop age)
    refreshYearsDefault();  // a blank Years to simulate follows your age
    refreshLastSalaryYearDefaults();  // a blank Last year paid follows the age, stop age and Retired
    refreshDefaultsNotice();  // Using defaults for N inputs follows every edit
    syncInflationRange();  // the inflation range shows only with Inflation-adjusted dollars on
    updateTerminalRate();  // the beneficiaries' caption follows their payouts
    renderSplit(HEIR_SPLIT);  // the beneficiaries' sliders follow their names and shares
    clearTimeout(runTimer);
    setStatus("busy", "Updating");
    $("app").classList.add("stale");
    singleBusy = true;
    renderPinned();  // the figures read "Running…" until the run is back
    mcKeyChanged();
    optimizeInputsChanged();
    coachInputsChanged();
    gamerTick();
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
      state.resultInputsText = inputsText;
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

  // ---- Wide layout: on a wide window (a PC monitor) the three tabs show side by side ----
  // At WIDE_QUERY the page puts Setup, Inputs and Outputs in three columns (1:2:2) under the top bar, each scrolling on
  // its own; the bottom bar goes, and a sideways swipe moves within the column it is made in (wirePanelsSwipe).
  // `state.tab` still names the place last opened (the phone layout comes back to it). A narrower window is the phone layout; a resize or rotation switches live.
  // A divider between Inputs and Outputs sets how they share their room (wireSplit below).
  const WIDE_QUERY = "(min-width: 1100px)";
  const wide = { on: false };

  // Whether a tab's panel is on screen: always in the wide layout, else when it is the selected tab. Strategy and
  // Awards (Gamer) show only while selected; in the wide layout they take the Outputs column's place.
  function tabShown(tab) {
    if (tab === "awards" || tab === "strategy") return state.tab === tab;
    if (wide.on) return tab !== "outputs" || !outputsColumnTaken();
    return state.tab === tab;
  }

  // Whether Strategy or Awards holds the wide layout's Outputs column.
  function outputsColumnTaken() {
    return state.tab === "awards" || state.tab === "strategy";
  }

  function wireWide() {
    const query = window.matchMedia ? window.matchMedia(WIDE_QUERY) : null;
    if (!query) return;
    const apply = () => {
      wide.on = query.matches;
      document.documentElement.classList.toggle("wide", wide.on);
      showSetupFold();
      showSplit(false);
    };
    wireSplit();
    wireSetupFold();
    apply();
    query.addEventListener("change", () => {
      apply();
      if (state.schema != null) showPlace();
      tourRelayout();  // the tour's control moved with the layout: measure it again in the new one
    });
  }

  // ---- Wide layout: the divider between Inputs and Outputs ----
  // A bar between the two columns: drag it (mouse, pen or touch) for a custom split, double-click it or press Enter for
  // an equal one, Left and Right to move it, Home to show only Outputs and End only Inputs. A side dragged under half
  // of SPLIT_MIN shuts, like a snapped window; the bar then stays at that edge to be dragged back. The icon at its top
  // pops out the same three snaps (Show only Outputs, Split equally, Show only Inputs) on hover, keyboard focus or a
  // tap. The split is Inputs' share of the two columns' room (the split* helpers in shared.js), kept per viewer.
  const SPLIT_MIN = 280;  // px an open column keeps
  const SPLIT_STEP = 0.05;  // an arrow key's move, as a share of the room
  const split = { share: 0.5, shown: 0.5, drag: null, fitTimer: 0 };
  const { splitShare, splitFit, splitStep, splitRead, splitText } = window.WmtiShared;

  // The Inputs track's left edge and the room Inputs and Outputs share (px), from the grid's resolved columns.
  function splitRoom() {
    const app = $("app");
    const tracks = getComputedStyle(app).gridTemplateColumns.split(" ").map(parseFloat);
    const left = app.getBoundingClientRect().left + parseFloat(getComputedStyle(app).paddingLeft) + tracks[0] + tracks[1];
    return { left, room: tracks[2] + tracks[4] };
  }

  // Draw the kept split (held to the room there is now) and, with `refit`, let the columns' contents fit their new
  // widths: the chips rows' bubbles and scroll bars follow a window resize, so one is sent once the bar settles (the
  // charts are SVG at the card's width and need nothing).
  function showSplit(refit) {
    const root = document.documentElement;
    const room = wide.on ? splitRoom().room : NaN;  // NaN while the page is hidden (start-up): the kept split as it is
    const shown = !wide.on ? 0.5 : isFinite(room) ? splitFit(split.share, room, SPLIT_MIN) : split.share;
    split.shown = shown;
    root.style.setProperty("--split", String(shown));
    root.style.setProperty("--split-in", 4 * shown + "fr");
    root.style.setProperty("--split-out", 4 * (1 - shown) + "fr");
    root.classList.toggle("split-only-outputs", wide.on && shown === 0);
    root.classList.toggle("split-only-inputs", wide.on && shown === 1);
    const bar = $("splitBar");
    bar.setAttribute("aria-valuenow", String(Math.round(shown * 100)));
    bar.setAttribute("aria-valuetext", splitText(shown));
    for (const button of document.querySelectorAll(".split-snap-button")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.split) === shown));
    }
    if (!refit) return;
    clearTimeout(split.fitTimer);
    split.fitTimer = setTimeout(() => window.dispatchEvent(new Event("resize")), 120);
  }

  // Keep a new split (`save` false while a drag is under way) and draw it.
  function setSplit(share, save) {
    split.share = share;
    if (save) {
      try { localStorage.setItem(SPLIT_KEY, String(share)); } catch (error) { /* storage blocked: this visit only */ }
    }
    showSplit(true);
  }

  // A column the split shuts: a move there (a link into Inputs while only Outputs shows) opens both again.
  function splitShuts(tab) {
    return wide.on && ((tab === "inputs" && document.documentElement.classList.contains("split-only-outputs"))
      || ((tab === "outputs" || tab === "strategy" || tab === "awards")
        && document.documentElement.classList.contains("split-only-inputs")));
  }

  function wireSplit() {
    try { split.share = splitRead(localStorage.getItem(SPLIT_KEY)); } catch (error) { /* storage blocked: equal */ }
    const bar = $("splitBar");
    const snap = $("splitSnap");
    const endDrag = (event) => {
      const drag = split.drag;
      if (!drag || event.pointerId !== drag.id) return;
      split.drag = null;
      document.documentElement.classList.remove("split-dragging");
      if (drag.moved) setSplit(split.share, true);
    };
    bar.addEventListener("pointerdown", (event) => {
      if (!wide.on || event.button !== 0) return;
      event.preventDefault();  // no text selection; the bar takes the focus below
      bar.focus({ preventScroll: true });
      bar.setPointerCapture(event.pointerId);
      split.drag = { id: event.pointerId, startX: event.clientX, grab: event.clientX - bar.getBoundingClientRect().left,
        moved: false, ...splitRoom() };
      document.documentElement.classList.add("split-dragging");
    });
    bar.addEventListener("pointermove", (event) => {
      const drag = split.drag;
      if (!drag || event.pointerId !== drag.id) return;
      if (!drag.moved && Math.abs(event.clientX - drag.startX) < 3) return;  // a click or a double-click, not a drag
      drag.moved = true;
      setSplit(splitShare(event.clientX - drag.grab - drag.left, drag.room, SPLIT_MIN), false);
    });
    bar.addEventListener("pointerup", endDrag);
    bar.addEventListener("pointercancel", endDrag);
    bar.addEventListener("lostpointercapture", endDrag);
    bar.addEventListener("dblclick", () => setSplit(0.5, true));
    bar.addEventListener("keydown", (event) => {
      const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      let share;
      if (step) share = splitStep(split.shown, step, splitRoom().room, SPLIT_MIN, SPLIT_STEP);
      else if (event.key === "Home") share = 0;
      else if (event.key === "End") share = 1;
      else if (event.key === "Enter") share = 0.5;
      else return;
      event.preventDefault();
      setSplit(share, true);
    });
    const openMenu = (open) => {
      snap.classList.toggle("open", open);
      $("splitSnapOpen").setAttribute("aria-expanded", String(open));
    };
    $("splitSnapOpen").addEventListener("click", () => openMenu(!snap.classList.contains("open")));
    for (const button of snap.querySelectorAll(".split-snap-button")) {
      button.addEventListener("click", () => {
        setSplit(Number(button.dataset.split), true);
        if (!button.matches(":focus-visible")) openMenu(false);  // a keyboard user stays in the menu
      });
    }
    snap.addEventListener("mouseleave", () => openMenu(false));
    snap.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !snap.contains(document.activeElement)) return;
      openMenu(false);
      bar.focus();
    });
    document.addEventListener("pointerdown", (event) => { if (!snap.contains(event.target)) openMenu(false); });
    // The page shown at start-up or a resized window: the kept split held to the room there is now.
    if (window.ResizeObserver) new ResizeObserver(() => showSplit(false)).observe($("app"));
    else window.addEventListener("resize", () => showSplit(false));
  }

  // ---- Wide layout: Setup folded to a rail ----
  // The bar over Setup's column (#setupFold: "Setup" and a chevron) folds the column to a slim rail showing the open
  // scenario's name, and a click (or Enter or Space) on the rail brings it back; Inputs and Outputs share the freed
  // width at the split they had. Folding only stops drawing Setup, so nothing in it is lost and its scroll comes back.
  // Anything that goes to Setup unfolds it first: a move to its tab (a link, Undo of a Setup field), the tour's Setup
  // steps, the open scenario's glow and a file message. Kept per device; the phone layout never folds.
  const setupFold = { folded: false, scroll: 0 };

  function showSetupFold() {
    const folded = wide.on && setupFold.folded;
    document.documentElement.classList.toggle("setup-folded", folded);
    const button = $("setupFold");
    const label = folded ? "Show Setup" : "Hide Setup";
    button.setAttribute("aria-expanded", String(!folded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function foldSetup(folded) {
    if (folded === setupFold.folded) return;
    const panel = $("panel-setup");
    if (folded) {
      setupFold.scroll = panel.scrollTop;
      if (panel.contains(document.activeElement)) $("setupFold").focus();
    }
    setupFold.folded = folded;
    try { localStorage.setItem(SETUP_FOLD_KEY, folded ? "folded" : "open"); } catch (error) { /* this visit only */ }
    showSetupFold();
    if (!folded) panel.scrollTop = setupFold.scroll;
    if (wide.on) showSplit(true);
  }

  // Unfold Setup before something in it is shown.
  function revealSetup() {
    if (wide.on && setupFold.folded) foldSetup(false);
  }

  function wireSetupFold() {
    try { setupFold.folded = localStorage.getItem(SETUP_FOLD_KEY) === "folded"; } catch (error) { /* open */ }
    $("setupFold").addEventListener("click", () => foldSetup(!setupFold.folded));
  }

  // Scroll a place to its top: its own column in the wide layout, else the page.
  function scrollPlaceTop(tab) {
    if (wide.on) $("panel-" + tab).scrollTop = 0;
    else window.scrollTo(0, 0);
  }

  // ---- Tabs, the Outputs and Strategy switches and chips ----
  function compareShown() {
    return tabShown("strategy") && state.strategyView === "compare";
  }

  // The view a tab shows: Outputs' (state.view) or Strategy's (state.strategyView); null for a tab without views.
  function placeView(tab) {
    if (tab === "outputs") return state.view;
    return tab === "strategy" ? state.strategyView : null;
  }

  // The tab a view belongs to: Strategy for its three views, else Outputs.
  function viewTab(view) {
    return STRATEGY_VIEWS.includes(view) ? "strategy" : "outputs";
  }

  // The tab a settings panel is drawn on: Household on Setup, Strategies on Strategy, every other one on Inputs.
  function paneTab(panelId) {
    if (panelId === SETUP_PANEL) return "setup";
    return panelId === STRATEGY_PANEL ? "strategy" : "inputs";
  }

  // Go to the tab a settings panel is drawn on (`tab`, from paneTab): Strategy opens at its Strategies view.
  function goToPane(tab) {
    goTo(tab, tab === "strategy" ? STRATEGY_VIEWS[0] : state.view);
  }

  // The key a scroll position is kept under: the tab, and for Outputs and Strategy its view too.
  function scrollKey() {
    const view = placeView(state.tab);
    return view ? state.tab + "/" + view : state.tab;
  }

  // Show the current tab and view: panels and sub-panels hidden or shown, tab roles and roving tabindex set.
  function showPlace() {
    noteViewSoon();  // a view left or shown (25-collapse.js)
    syncAwardsTab();  // the Awards tab shows only in Gamer style
    for (const name of TABS) {
      $("panel-" + name).hidden = !tabShown(name);
      $("tab-" + name).setAttribute("aria-selected", String(name === state.tab));
      $("tab-" + name).tabIndex = name === state.tab ? 0 : -1;
    }
    if (!VIEWS.includes(state.view)) state.view = VIEWS[0];
    if (!STRATEGY_VIEWS.includes(state.strategyView)) state.strategyView = STRATEGY_VIEWS[0];
    const taken = outputsColumnTaken();
    for (const name of VIEWS) {
      $("view-" + name).hidden = name !== state.view;
      $("sub-" + name).setAttribute("aria-selected", String(!taken && name === state.view));
      $("sub-" + name).tabIndex = !taken && name === state.view ? 0 : -1;
    }
    for (const name of STRATEGY_VIEWS) {
      $("view-" + name).hidden = name !== state.strategyView;
      $("sub-" + name).setAttribute("aria-selected", String(name === state.strategyView));
      $("sub-" + name).tabIndex = name === state.strategyView ? 0 : -1;
    }
    for (const tab of ["awards", "strategy"]) {  // wide only: Awards and Strategy from the Outputs row
      $("sub-" + tab).setAttribute("aria-selected", String(state.tab === tab));
      $("sub-" + tab).tabIndex = state.tab === tab ? 0 : -1;
    }
    $("sub-strategy").hidden = !wide.on;
    // Wide: Inputs' chips, the Outputs view row and the open view's sub-tabs all show, each over its column; with
    // Strategy open, its view row takes the sub-tabs' place under the Outputs row.
    const widePlaces = ["inputs", "outputs", state.tab === "strategy" ? "strategy" : "outputs/" + state.view];
    for (const element of document.querySelectorAll(".band [data-place]")) {
      element.hidden = wide.on ? !widePlaces.includes(element.dataset.place)
        : element.dataset.place !== scrollKey() && element.dataset.place !== state.tab;
    }
    for (const row of document.querySelectorAll(".band .chips")) trackChips(row);
    if (tabShown("inputs")) { placeBubble($("chips-settings"), false); centerChip($("chips-settings"), false); }
    placeViewBubble();
    placeStrategyBubble();
    renderBand();
    placeBand();
    if (tabShown("inputs")) { requestNotes(); requestBenefits(); requestEarnings(); requestDeposits(); }
    renderEarningsReturn();  // the Back to Social Security button goes when Inputs is left
    if (!tabShown("inputs") && tabShown("outputs") && state.view === "summary") requestNotes();  // asked once above
    if (compareShown()) refreshCompare();
    if (optimizeShown()) renderOptimize();
    if (tabShown("outputs")) gamerSeen(state.view);
    if (tabShown("strategy")) gamerSeen(state.strategyView);
    renderAwards();  // built only while it shows
  }

  // Move to a place (tab and view) and open it at its top, whether a tap or a swipe got there (the owner, s367: a new
  // tab starts at the top); a tap on the place already shown scrolls it to the top too. `remember` false (start-up)
  // only shows the place. `view` is the Outputs view, or on Strategy its view; a view of the other tab (such as the
  // Outputs view other callers pass along) keeps the tab's own.
  function goTo(tab, view, remember) {
    if (tab === "setup" && remember !== false) revealSetup();
    const key = tab === "strategy" ? "strategyView" : "view";
    if (view == null || viewTab(view) !== (tab === "strategy" ? "strategy" : "outputs")) view = state[key];
    if (remember === false) {
      state.tab = tab;
      state[key] = view;
      showPlace();
      return;
    }
    if (wide.on) {
      // Wide: every column shows and keeps its own scroll; the Outputs column opens another view at its top.
      if (splitShuts(tab)) setSplit(0.5, true);
      if (tab === state.tab && view === state[key]) { scrollPlaceTop(tab); return; }
      const viewChanged = view !== state[key];
      state.tab = tab;
      state[key] = view;
      showPlace();
      savePrefs();
      if (viewChanged) $(tab === "strategy" ? "panel-strategy" : "panel-outputs").scrollTop = 0;
      return;
    }
    if (tab === state.tab && view === state[key]) { window.scrollTo(0, 0); return; }
    state.tab = tab;
    state[key] = view;
    showPlace();
    savePrefs();
    window.scrollTo(0, 0);
  }

  // The Outputs view row's bubble: over the selected view (wide, the Garden or Strategy chip while that tab holds the
  // column), gliding there when the view changed while Outputs showed.
  function placeViewBubble() {
    const row = $("views-outputs");
    const shown = tabShown("outputs") || (wide.on && outputsColumnTaken());
    const selected = outputsColumnTaken() ? state.tab : state.view;
    const moved = row.dataset.tab === "outputs" && row.dataset.selected !== selected;
    row.dataset.tab = shown ? "outputs" : state.tab;
    row.dataset.selected = selected;
    if (shown) placeBubble(row, moved);
  }

  // The Strategy view row's bubble, the same way.
  function placeStrategyBubble() {
    const row = $("views-strategy");
    const shown = tabShown("strategy");
    const moved = row.dataset.tab === "strategy" && row.dataset.selected !== state.strategyView;
    row.dataset.tab = shown ? "strategy" : state.tab;
    row.dataset.selected = state.strategyView;
    if (shown) placeBubble(row, moved);
  }

  function selectTab(tab, remember) {
    goTo(tab, placeView(tab) || state.view, remember);
  }

  // A tap (or arrow key) on a bottom tab other than the shown one opens that tab at its first sub-tab, at the top: the
  // first Inputs panel, the first Outputs view with its first sub-tabs, or Strategy's first view (Strategies). A swipe
  // never changes the bottom tab.
  function selectTabFresh(tab) {
    if (tab === state.tab || state.schema == null) { selectTab(tab); return; }
    let view = state.view;
    if (tab === "inputs") {
      const panels = inputsPanels();
      if (panels.length) state.chips.settings = panels[0].id;
    } else if (tab === "outputs") {
      view = outputViews()[0];
      state.chips.plots = PLOT_VIEWS[0].id;
    } else if (tab === "strategy") {
      view = STRATEGY_VIEWS[0];
    }
    goTo(tab, view);
    if (tab === "inputs" || tab === "strategy") renderSettings();
    else if (tab === "outputs") { renderResults(); renderPlots(); }
    scrollPlaceTop(tab);  // after the redraw, which can change the page's height
    centerSwipedChips();
  }

  // An Outputs or Strategy view; "awards" and "strategy" (the wide layout's Garden and Strategy chips, or a Show me)
  // open that tab.
  function selectView(view, remember) {
    if (view === "awards" || view === "strategy") { if (state.tab !== view) selectTabFresh(view); return; }
    goTo(viewTab(view), view, remember);
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
      chip.dataset.id = item.id;
      chip.innerHTML = iconSvg(iconFor(item.id, item.label), "chip-icon");
      chip.append(item.label);
      if (item.soon) {
        const soon = document.createElement("span");
        soon.className = "soon";
        soon.textContent = "soon";
        chip.append(soon);
      }
      chip.addEventListener("click", () => {
        onSelect(item.id);
        // Another chip opens its page at the top (its column in the wide layout), as a swipe does.
        if (item.id !== selected) scrollPlaceTop(containerId === "chips-settings" ? "inputs" : "outputs");
      });
      return chip;
    }));
    if (containerId === "chips-settings") {  // Inputs' chips: the bubble over the selected one, kept across renders
      if (!container.chipBubble) container.chipBubble = makeBubble("chipBubbleFill");
      container.append(container.chipBubble);
      const moved = container.dataset.selected != null && container.dataset.selected !== selected;
      container.dataset.selected = selected;
      placeBubble(container, moved);
      if (moved) centerChip(container, true);
    }
    trackChips(container);
  }

  // ---- The chip bubble: one glowing ring over the selected Inputs chip, and over the selected Outputs view ----
  // One SVG capsule inside the chips row (so it scrolls with the chips): a rim in the scheme's --chip-on with a glow
  // and a nearly clear fill, so the chip's own colors and label show through. While a swipe drags toward a neighbour
  // chip it stretches there, its waist pinching thinner and its middle filling in like a stretched balloon; on
  // release, or after a tap, it glides back to a capsule over the selected chip (a spring-like ease, BUBBLE_MS). With
  // reduced motion it never stretches and moves at once.
  const BUBBLE_MS = 250;
  const BUBBLE_FILL = 0.14;  // the fill's opacity at rest (and at the ends while stretched)
  const BUBBLE_PAD = 3;  // px the capsule stands out from its chip on each side

  function reducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // A bubble whose fill gradient has the id `fillId` (one per row, so the ids stay unique).
  function makeBubble(fillId) {
    const holder = document.createElement("div");
    holder.innerHTML = "<svg class=\"chip-bubble\" aria-hidden=\"true\" focusable=\"false\" width=\"0\" height=\"0\">"
      + "<defs><linearGradient id=\"" + fillId + "\" x1=\"0\" x2=\"1\" y1=\"0\" y2=\"0\"><stop offset=\"0\"/>"
      + "<stop offset=\"0.5\"/><stop offset=\"1\"/></linearGradient></defs><path fill=\"url(#" + fillId + ")\"/></svg>";
    return holder.firstElementChild;
  }

  // The capsule over a chip, in the row's content coordinates.
  function chipGeom(chip) {
    return { left: chip.offsetLeft - BUBBLE_PAD, right: chip.offsetLeft + chip.offsetWidth + BUBBLE_PAD,
      top: chip.offsetTop - BUBBLE_PAD, height: chip.offsetHeight + 2 * BUBBLE_PAD, pinch: 0 };
  }

  // A capsule from `left` to `right` whose top and bottom edges bow in by `pinch` px at the middle.
  function bubblePath(geom) {
    const radius = geom.height / 2;
    const start = geom.left + radius;
    const end = Math.max(start, geom.right - radius);
    const mid = (start + end) / 2;
    const reach = (end - start) / 4;
    const top = geom.top;
    const bottom = geom.top + geom.height;
    const waistTop = top + geom.pinch;
    const waistBottom = bottom - geom.pinch;
    return ["M", start, top, "C", start + reach, top, mid - reach, waistTop, mid, waistTop,
      "C", mid + reach, waistTop, end - reach, top, end, top, "A", radius, radius, 0, 0, 1, end, bottom,
      "C", end - reach, bottom, mid + reach, waistBottom, mid, waistBottom,
      "C", mid - reach, waistBottom, start + reach, bottom, start, bottom, "A", radius, radius, 0, 0, 1, start, top, "Z"]
      .map((part) => (typeof part === "number" ? String(Math.round(part * 10) / 10) : part)).join(" ");
  }

  function drawBubble(row, geom) {
    const bubble = row.chipBubble;
    bubble.geom = geom;
    const stretch = Math.max(0, Math.min(1, geom.pinch / (geom.height * 0.3)));
    bubble.querySelector("path").setAttribute("d", bubblePath(geom));
    const stops = bubble.querySelectorAll("stop");
    stops[0].setAttribute("stop-opacity", String(BUBBLE_FILL));
    stops[1].setAttribute("stop-opacity", String(Math.round((BUBBLE_FILL + 0.5 * stretch) * 100) / 100));
    stops[2].setAttribute("stop-opacity", String(BUBBLE_FILL));
  }

  // A spring-like ease: a little past the end, then settled.
  function springEase(k) {
    const back = 1.3;
    return 1 + (back + 1) * (k - 1) ** 3 + back * (k - 1) ** 2;
  }

  // Glide to `chip`, measured afresh every frame, so a chip whose width settles mid-glide (its bolder label, a font
  // arriving) is still where the glide ends.
  function glideBubble(row, chip) {
    const bubble = row.chipBubble;
    cancelAnimationFrame(bubble.frame);
    const from = bubble.geom;
    if (!from || reducedMotion()) { bubble.frame = 0; drawBubble(row, chipGeom(chip)); return; }
    const begun = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - begun) / BUBBLE_MS);
      const ease = springEase(k);
      const to = chipGeom(chip);
      const mix = (key) => from[key] + (to[key] - from[key]) * ease;
      drawBubble(row, { left: mix("left"), right: mix("right"), top: to.top, height: to.height,
        pinch: Math.max(0, from.pinch * (1 - Math.min(1, k * 1.6))) });
      bubble.frame = k < 1 ? requestAnimationFrame(step) : 0;
    };
    bubble.frame = requestAnimationFrame(step);
  }

  // Keep the bubble on its chip when the row or a chip changes size after it was placed: a web font arriving after
  // start-up (the selected chip's bolder face is fetched only once a chip is selected), the row shown again after it
  // was hidden, or the band's width settling as the page opens (the row's scroll bar is redrawn with it). A glide or a
  // swipe's stretch under way is left alone.
  function watchBubble(row) {
    if (!window.ResizeObserver) return;
    if (!row.bubbleWatch) {
      row.bubbleWatch = new ResizeObserver(() => {
        trackChips(row);
        const bubble = row.chipBubble;
        if (!bubble || bubble.frame || (bubble.geom && bubble.geom.pinch > 0)) return;
        placeBubble(row, false);
      });
    }
    const chips = [...row.querySelectorAll(".chip")];
    if (row.bubbleChips && row.bubbleChips.length === chips.length
      && row.bubbleChips.every((chip, index) => chip === chips[index])) return;
    row.bubbleWatch.disconnect();
    row.bubbleWatch.observe(row);
    for (const chip of chips) row.bubbleWatch.observe(chip);
    row.bubbleChips = chips;
  }

  // Put the bubble over the row's selected chip, gliding there when `animate`; nothing while the row is hidden.
  function placeBubble(row, animate) {
    const bubble = row && row.chipBubble;
    const chip = row && row.querySelector(".chip[aria-selected=true]");
    if (bubble) watchBubble(row);
    if (!bubble || !chip || !row.offsetParent) return;
    bubble.setAttribute("width", "0");
    bubble.setAttribute("width", String(row.scrollWidth));
    bubble.setAttribute("height", String(row.clientHeight));
    if (animate) glideBubble(row, chip);
    else { cancelAnimationFrame(bubble.frame); bubble.frame = 0; drawBubble(row, chipGeom(chip)); }
  }

  // Stretch the bubble from the selected chip toward `target` by `progress` (0 to 1) of a swipe.
  function stretchBubble(row, target, progress) {
    const bubble = row.chipBubble;
    const chip = row.querySelector(".chip[aria-selected=true]");
    if (!bubble || !chip || !row.offsetParent || reducedMotion()) return;
    cancelAnimationFrame(bubble.frame);
    bubble.frame = 0;
    const from = chipGeom(chip);
    if (!target) { drawBubble(row, from); return; }
    const to = chipGeom(target);
    const head = Math.max(0, Math.min(1, progress * 2));
    const ahead = to.left > from.left;
    const geom = { ...from, left: ahead ? from.left : from.left + (to.left - from.left) * head,
      right: ahead ? from.right + (to.right - from.right) * head : from.right };
    geom.pinch = from.height * 0.3 * head;
    drawBubble(row, geom);
  }

  // Scroll a chips row so its selected chip sits in the middle.
  function centerChip(row, smooth) {
    const chip = row.querySelector(".chip[aria-selected=true]");
    if (!chip || !row.offsetParent) return;
    const left = Math.max(0, chip.offsetLeft + chip.offsetWidth / 2 - row.clientWidth / 2);
    row.scrollTo({ left, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
  }

  // ---- Collapsible panels: a chevron in each card's or pane's header on Setup, Inputs and Outputs ----
  // Every card (`.card`, not a <details> one, which already opens and shuts), Inputs pane (`fieldset.pane`, not a
  // sub-section), Setup's Scenario files and the Advanced settings' Inflation and Run cards with a heading gets a
  // chevron button at the right of its header (aria-expanded, aria-controls). The button or a click on the header (not
  // on its "i" or another control) folds the panel to its header and opens it again; no height animation. Folded, a
  // panel whose first field is an on/off switch (a pane's toggle, Roth conversion, Inflation) shows a copy of that
  // switch in the header that works the real one; turned on there, the panel opens (turned off, it stays folded) and its
  // header keeps its place on screen. Every panel on Setup and Inputs starts folded on each start of the app, those
  // drawn later included; Outputs' panels (charts, tables, summary tiles) start open and nothing folds them but their
  // own chevron or header (COLLAPSE_NEVER_AUTO). Which are open is kept for the visit only (`collapseFolds`, keys `tab:id-or-heading`), so a redraw keeps it. The
  // tests start them open with WMTI_START_OPEN. The panels are drawn and redrawn by many parts, so a
  // MutationObserver on the three tabs adds the header controls to each new panel. Anything that shows a field opens
  // its panel first (`revealField` and `revealPanels`: a jump to a field, Undo, flashField, the tour); a field marked invalid opens its panel. The
  // header's "i" text still opens while folded.
  // Sheets, dialogs and the walkthrough sit outside the three tabs and never fold, nor does a summary with no inputs
  // (`.summary-only`: Expenses' summary card and the Home and Cars timelines), which has no chevron.
  const COLLAPSE_TABS = ["panel-setup", "panel-inputs", "panel-outputs", "panel-strategy"];
  const COLLAPSE_PANELS = ".card:not(details):not(.mc-bar):not(.summary-only), "
    + "fieldset.pane:not(.subsection):not(.summary-only), .files-card, .run-card";
  const COLLAPSE_HEADS = [":scope > legend", ":scope > .card-head", ":scope > .title-help:not(.note-help)",
    ":scope > .files-head", ":scope > h2", ":scope > figure.chart > figcaption"];
  const COLLAPSE_TITLE = "h2, h3, .legend-title, .chart-title";
  let collapseCount = 0;
  const collapseFolds = new Map();  // panel key to folded (true) or open (false), this visit only
  const COLLAPSE_START_FOLDED = window.WMTI_START_OPEN !== true;  // a panel not yet folded or opened this visit
  // Tabs whose panels start open and are never folded but by hand: Outputs, and Strategy's Compare and Optimize (its
  // Strategies view folds as an Inputs chip does: its keys start "strategies", collapseKey).
  const COLLAPSE_NEVER_AUTO = ["outputs", "strategy"];

  function isFolded(key) {
    if (collapseFolds.has(key)) return collapseFolds.get(key);
    return COLLAPSE_NEVER_AUTO.includes(key.split(":")[0]) ? false : COLLAPSE_START_FOLDED;
  }

  // The header of a panel that can fold (one holding a title), else null.
  function collapseHead(panel) {
    if (panel.closest("details:not(.card):not(.advanced)")) return null;  // inside a collapsible of its own
    for (const selector of COLLAPSE_HEADS) {
      const head = panel.querySelector(selector);
      if (head && (head.matches("h2") || head.querySelector(COLLAPSE_TITLE))) return head;
    }
    return null;
  }

  function collapseKey(panel, head) {
    const tab = panel.closest("#view-strategies") ? "strategies" : panel.closest(".panel").dataset.tab;
    const title = head.matches("h2") ? head : head.querySelector(COLLAPSE_TITLE);
    const own = panel.dataset.collapseAuto ? "" : panel.id;  // an id given here changes with each drawing
    return tab + ":" + (own || (title ? title.textContent.trim() : ""));
  }

  // The switches, besides an object's `enabled` gate, that turn a whole panel's feature on or off: Inflation's
  // inflation-adjusted dollars and the Early withdrawals strategy. Another first-field switch (Income's I'm retired,
  // Household's partner) is a setting inside the panel and stays out of its header.
  const COLLAPSE_FEATURE_SWITCHES = ["f-useInflation", "f-strategies-penaltyFreeFirst"];

  // The panel's on/off switch shown in its folded header: its pane toggle, else its first field when that is the
  // switch of the panel's whole feature (an `enabled` gate or COLLAPSE_FEATURE_SWITCHES).
  function collapseSwitch(panel) {
    const own = panel.querySelector(":scope > .pane-switch input[role=switch]");
    if (own) return own;
    const first = Array.from(panel.querySelectorAll(".field")).find((field) => !field.closest(".subsection")
      && field.closest(COLLAPSE_PANELS) === panel);
    const input = first ? first.querySelector(":scope > .switch-row input[role=switch]") : null;
    return input && (input.id.endsWith("-enabled") || COLLAPSE_FEATURE_SWITCHES.includes(input.id)) ? input : null;
  }

  // Add the header controls to every panel drawn since the last pass and show each one open or folded.
  function enhancePanels() {
    for (const tabId of COLLAPSE_TABS) {
      for (const panel of $(tabId).querySelectorAll(COLLAPSE_PANELS)) {
        const head = collapseHead(panel);
        if (!head) continue;
        let tools = head.querySelector(":scope > .collapse-tools");
        if (!tools) {
          if (!panel.id) {
            panel.id = "collapsible-" + (++collapseCount);
            panel.dataset.collapseAuto = "1";
          }
          head.classList.add("collapse-head");
          for (let up = head.parentElement; up !== panel; up = up.parentElement) up.classList.add("collapse-path");
          tools = document.createElement("span");
          tools.className = "collapse-tools";
          const button = document.createElement("button");
          button.type = "button";
          button.className = "collapse-button";
          button.setAttribute("aria-controls", panel.id);
          button.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 9l6 6 6-6\"/></svg>";
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            foldPanel(panel, !panel.classList.contains("is-collapsed"));
          });
          tools.append(button);
          head.append(tools);
          head.addEventListener("click", (event) => {
            if (event.target.closest("button, input, select, textarea, a, label, .field-help")) return;
            if (button.hidden) return;  // switched off: nothing to fold
            foldPanel(panel, !panel.classList.contains("is-collapsed"));
          });
        }
        const help = head.querySelector(".help-button");  // the header's "i" text still opens while folded
        const helpText = help && document.getElementById(help.getAttribute("aria-controls"));
        if (helpText && panel.contains(helpText)) helpText.classList.add("collapse-keep");
        panel.dataset.collapseKey = collapseKey(panel, head);
        let folded = isFolded(panel.dataset.collapseKey);
        if (folded && panel.querySelector("[aria-invalid=true]")) {  // a field that needs a fix is shown
          folded = false;
          collapseFolds.set(panel.dataset.collapseKey, false);
        }
        showFolded(panel, folded);
      }
    }
  }

  // Draw `panel` open or folded: its class, the chevron's state and name, and the header copy of its switch.
  function showFolded(panel, folded) {
    const head = panel.querySelector(".collapse-head");
    const button = head.querySelector(":scope > .collapse-tools > .collapse-button");
    panel.classList.toggle("is-collapsed", folded);
    if (button.getAttribute("aria-expanded") !== String(!folded)) button.setAttribute("aria-expanded", String(!folded));
    const title = head.matches("h2") ? head : head.querySelector(COLLAPSE_TITLE);
    const label = (folded ? "Expand " : "Collapse ") + (title ? title.textContent.trim() : "panel");
    if (button.getAttribute("aria-label") !== label) {
      button.setAttribute("aria-label", label);
      button.title = label;
    }
    const gate = collapseSwitch(panel);
    button.hidden = Boolean(gate && !gate.checked);  // a switched-off panel shows no fold arrow until it is turned on
    const tools = button.parentElement;
    let copy = tools.querySelector(".collapse-switch");
    const real = folded ? collapseSwitch(panel) : null;
    if (!real) {
      if (copy) copy.remove();
      return;
    }
    if (!copy) {
      copy = document.createElement("span");
      copy.className = "switch collapse-switch";
      copy.innerHTML = "<input type=\"checkbox\" role=\"switch\"><span></span>";
      copy.querySelector("input").addEventListener("change", (event) => {
        const source = collapseSwitch(panel);
        event.target.checked = source ? source.checked : event.target.checked;
        if (!source) return;
        const key = panel.dataset.collapseKey;
        const top = head.getBoundingClientRect().top;  // the header stays where it is on screen
        const turnedOn = !source.checked;
        if (turnedOn) foldPanel(panel, false);  // turned on, the panel opens to show what the switch brings
        source.click();  // its own change handler saves and redraws
        enhancePanels();
        const now = Array.from(document.querySelectorAll("[data-collapse-key]"))
          .find((item) => item.dataset.collapseKey === key && item.querySelector(".collapse-head"));
        if (!now) return;
        const moved = now.querySelector(".collapse-head").getBoundingClientRect().top - top;
        const tab = now.closest(".panel").dataset.tab;
        if (Math.abs(moved) >= 1) leaveScrollTo(tab, leaveScroll(tab) + moved);
        const again = now.classList.contains("is-collapsed") ? now.querySelector(".collapse-switch input")
          : collapseSwitch(now);
        if (again) again.focus({ preventScroll: true });
      });
      tools.prepend(copy);
    }
    const input = copy.querySelector("input");
    input.checked = real.checked;
    input.disabled = real.disabled;
    if (input.getAttribute("aria-label") !== real.getAttribute("aria-label")) {
      input.setAttribute("aria-label", real.getAttribute("aria-label") || "");
    }
  }

  // Fold or open `panel` and keep the choice for the visit.
  function foldPanel(panel, folded) {
    collapseFolds.set(panel.dataset.collapseKey, folded);
    showFolded(panel, folded);
  }

  // Open every folded panel around `element` before it is shown (a jump to a field, Undo, the tour).
  function revealPanels(element) {
    leaveHold();  // the view it lands on is not reset
    enhancePanels();  // a panel drawn just now is shown folded or open before it is opened
    for (let panel = element && element.closest(".is-collapsed"); panel; panel = panel.parentElement.closest(".is-collapsed")) {
      foldPanel(panel, false);
    }
  }

  // Open the folded panels that hold input `path` (its field, else the field or list of a shorter part of it), before
  // the place that shows it looks for it on screen.
  function revealField(path) {
    leaveHold();  // the view it lands on is not reset
    enhancePanels();
    const parts = path.split(".");
    for (let end = parts.length; end > 0; end -= 1) {
      const element = document.getElementById(fieldId(parts.slice(0, end).join(".")));
      if (element) { revealPanels(element); break; }
    }
    for (const list of drawnLists(parts[0])) revealPanels(list);
  }

  function wireCollapse() {
    const observer = new MutationObserver(() => enhancePanels());
    for (const tabId of COLLAPSE_TABS) observer.observe($(tabId), { childList: true, subtree: true });
    enhancePanels();
    wireLeave();
  }

  // ---- Leaving a view: back within LEAVE_RESET_MS as it was left, later folded and at its top ----
  // A view is what one column shows: Setup, an Inputs chip page (or the Low page), an Outputs view (Plots with its
  // sub-tab) or Awards. A view left (a chip, a swipe, a bottom tab, the app hidden) and shown again within
  // LEAVE_RESET_MS comes back at the scroll it was left at (a stray swipe costs nothing); shown again later, every
  // panel in it folds (never an Outputs one, COLLAPSE_NEVER_AUTO) and it opens at its top. That fold is a fold like any other, kept for the visit. Nothing happens on a first visit, while a field in the view is being typed in,
  // while the tour or the walkthrough is open, or when the view was reached to show a field (revealField and
  // revealPanels: a jump to a field, Undo, the tour), which opens that field's panel as before.
  const LEAVE_RESET_MS = 5000;
  // The tests set WMTI_LEAVE_DELAY before the page loads (a long one, so a test that comes back to a view later finds
  // it as it left it) and change it with wmtiViews.setLeaveDelay.
  const leave = { delay: typeof window.WMTI_LEAVE_DELAY === "number" ? window.WMTI_LEAVE_DELAY : LEAVE_RESET_MS,
    shown: {}, scroll: {}, left: {}, hold: false, queued: false };
  window.wmtiViews = { setLeaveDelay: (ms) => { leave.delay = ms; } };  // for the tests

  // The view a tab's column shows now.
  function leaveViewKey(tab) {
    if (tab === "inputs") return "inputs/" + (lowOn() ? "low" : state.chips.settings);
    if (tab === "outputs") return "outputs/" + state.view + (state.view === "plots" ? "/" + shownSubtab("plots") : "");
    if (tab === "strategy") return "strategy/" + state.strategyView;
    return tab;
  }

  function leaveScroll(tab) {
    return wide.on ? $("panel-" + tab).scrollTop : window.scrollY;
  }

  function leaveScrollTo(tab, top) {
    if (wide.on) $("panel-" + tab).scrollTop = top;
    else window.scrollTo(0, top);
  }

  // A reveal is on its way (a jump to a field, Undo): the view it lands on is left as the reveal shows it.
  function leaveHold() {
    leave.hold = true;
    setTimeout(() => { leave.hold = false; }, 0);
  }

  // Note the shown views once the move that changed them (and its own scroll to the top) is done.
  function noteViewSoon() {
    if (leave.queued) return;
    leave.queued = true;
    queueMicrotask(noteViews);
  }

  // Each column whose view changed: the view left keeps its scroll and the time; the view shown comes back as it was
  // (within the delay) or folded at its top (later).
  function noteViews() {
    leave.queued = false;
    const now = Date.now();
    for (const tab of TABS) {
      const key = tabShown(tab) ? leaveViewKey(tab) : null;
      const before = leave.shown[tab] || null;
      if (key === before) continue;
      if (before) leave.left[before] = { at: now, scroll: leave.scroll[before] || 0, wide: wide.on };
      if (key) leave.shown[tab] = key;
      else delete leave.shown[tab];
      if (key) leaveArrive(tab, key, now);
    }
  }

  function leaveArrive(tab, key, now) {
    const left = leave.left[key];
    delete leave.left[key];
    if (!left || leave.hold || walk.open || !$("tour").hidden) {
      leave.scroll[key] = leaveScroll(tab);
      return;
    }
    if (now - left.at >= leave.delay) {
      resetView(tab);
      return;
    }
    const top = left.wide === wide.on ? left.scroll : 0;
    leave.scroll[key] = top;
    leaveScrollTo(tab, top);
    requestAnimationFrame(() => {  // a page drawn after this frame may be taller
      if (leave.shown[tab] === key && leaveScroll(tab) !== top) leaveScrollTo(tab, top);
    });
  }

  // Fold every panel in the view a column shows (not on Outputs, nor Strategy's Compare and Optimize) and scroll it to
  // its top, unless a field in it is being typed in.
  function resetView(tab) {
    const view = placeView(tab);
    const holder = view ? $("view-" + view) : $("panel-" + tab);
    if (isTyping(document.activeElement) && holder.contains(document.activeElement)) return;
    const foldTab = view === "strategies" ? "strategies" : tab;
    if (COLLAPSE_TABS.includes("panel-" + tab) && !COLLAPSE_NEVER_AUTO.includes(foldTab)) {
      enhancePanels();
      for (const panel of holder.querySelectorAll("[data-collapse-key]")) {
        if (!panel.classList.contains("is-collapsed") && !panel.querySelector("[aria-invalid=true]")) {
          foldPanel(panel, true);
        }
      }
    }
    leave.scroll[leave.shown[tab]] = 0;
    leaveScrollTo(tab, 0);
  }

  // Keep each shown view's scroll; the app hidden leaves its views, and shown again after the delay resets them.
  function wireLeave() {
    document.addEventListener("scroll", () => {
      for (const tab of Object.keys(leave.shown)) leave.scroll[leave.shown[tab]] = leaveScroll(tab);
    }, { capture: true, passive: true });
    document.addEventListener("visibilitychange", () => {
      const now = Date.now();
      for (const tab of Object.keys(leave.shown)) {
        const key = leave.shown[tab];
        if (document.hidden) leave.left[key] = { at: now, scroll: leaveScroll(tab), wide: wide.on };
        else if (leave.left[key]) leaveArrive(tab, key, now);
      }
    });
    noteViewSoon();
  }

  // ---- Hold sliders: a finger must hold a slider still before it moves ----
  // Every slider (each <input type=range> and each ages slider, `.age-range`) resists a passing swipe: a finger that
  // touches it moves nothing until it has stayed within HOLD_SLIDER_SLOP px for HOLD_SLIDER_MS. Moving sooner lets go
  // of the slider, so the page scrolls or the sideways swipe (30-swipe-menu.js) moves on as from anywhere else. After
  // the hold the handle lifts (a larger knob with the value above it, `.hold-lift`; a short buzz where the phone has
  // one) and follows the finger, which no longer scrolls the page: held on the handle it drags from where it is, held
  // on the track it jumps there. A tap alone moves nothing. A mouse or pen moves at once, lifted the same way; the
  // keys work as before. A range input's own touch moves are undone and kept from its listeners while the finger is
  // down; the moves made here reach them as ordinary input and change events. An ages slider gives its own drag to
  // this code through `track.holdSlider` (ageRangeField, 81-help.js).
  const HOLD_SLIDER_MS = 120;
  const HOLD_SLIDER_SLOP = 8;  // px a finger may wander during the hold
  const HOLD_GRAB_PX = 28;  // a hold this close to the handle drags the handle from where it is
  const HOLD_THUMB_PX = 16;  // a range input's thumb width: its value runs between the thumb's centres at each end
  const HOLD_BUZZ_MS = 12;
  const HOLD_SLIDERS = "input[type=range], .age-range";
  // The tests set WMTI_HOLD_DELAY before the page loads to change the hold (0: a touch lifts at once).
  const hold = { delay: typeof window.WMTI_HOLD_DELAY === "number" ? window.WMTI_HOLD_DELAY : HOLD_SLIDER_MS,
    session: null, pointer: null, lift: null };

  // Whether a slider is being moved now (a lifted touch, or a mouse or pen held down on it): no swipe starts then.
  function holdSliderBusy() {
    return Boolean((hold.session && hold.session.lifted) || hold.pointer);
  }

  // The slider `target` sits in, or null (none, or a disabled range input).
  function holdSliderOf(target) {
    const element = target && target.closest ? target.closest(HOLD_SLIDERS) : null;
    return element && !element.disabled ? element : null;
  }

  // How to move a slider: `handle(x)` the handle's middle {x, y} and its value text (`x`, before a drag, picks the
  // ages slider's nearer knob), `start(x)` and `move(x)` put the handle at `x`, `end()` closes the drag.
  function holdAdapter(element) {
    return element.tagName === "INPUT" ? rangeHoldAdapter(element) : element.holdSlider || null;
  }

  function rangeHoldAdapter(input) {
    const min = input.min === "" ? 0 : Number(input.min);
    const max = input.max === "" ? 100 : Number(input.max);
    const span = () => { const box = input.getBoundingClientRect(); return [box, Math.max(0, box.width - HOLD_THUMB_PX)]; };
    const set = (x) => {
      const [box, width] = span();
      const share = width > 0 ? Math.min(1, Math.max(0, (x - box.left - HOLD_THUMB_PX / 2) / width)) : 0;
      const before = input.value;
      input.value = String(min + share * (max - min));  // the input keeps it to its step and ends
      if (input.value !== before) input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    let first = null;
    return {
      handle: () => {
        const [box, width] = span();
        const share = max > min ? (Number(input.value) - min) / (max - min) : 0;
        return { x: box.left + HOLD_THUMB_PX / 2 + share * width, y: box.top + box.height / 2, text: rangeHoldText(input) };
      },
      start: (x) => { first = input.value; set(x); },
      move: set,
      end: () => { if (first !== null && input.value !== first) input.dispatchEvent(new Event("change", { bubbles: true })); },
    };
  }

  // A range input's value as its page shows it: its aria-valuetext, the output for it, the typed box beside it, or the
  // bare value.
  function rangeHoldText(input) {
    if (input.getAttribute("aria-valuetext")) return input.getAttribute("aria-valuetext");
    const output = input.id ? [...document.querySelectorAll("output")].find((item) => item.htmlFor.contains(input.id)) : null;
    if (output && output.textContent) return output.textContent;
    const field = input.closest(".field");
    const box = field ? field.querySelector("input:not([type=range]):not([type=checkbox]):not([type=radio])") : null;
    if (box && box.value) return box.value;
    return input.value;
  }

  // Show the lifted handle over `element`'s handle (`x`: where the finger or pointer is, before a drag).
  function showHoldLift(session, x) {
    let lift = hold.lift;
    if (!lift) {
      lift = document.createElement("div");
      lift.className = "hold-lift";
      lift.setAttribute("aria-hidden", "true");
      lift.innerHTML = "<span class=\"hold-lift-knob\"></span><span class=\"hold-lift-bubble\"></span>";
      document.body.append(lift);
      hold.lift = lift;
    }
    const handle = session.adapter.handle(x);
    if (!handle) return;
    lift.style.left = handle.x + "px";
    lift.style.top = handle.y + "px";
    lift.lastChild.textContent = handle.text;
    if (!lift.classList.contains("on")) {
      const accent = getComputedStyle(session.element).accentColor;
      lift.style.setProperty("--hold-accent", accent && accent !== "auto" ? accent : "");
      lift.classList.add("on");
      session.element.classList.add("hold-lifted");
    }
  }

  function hideHoldLift(element) {
    if (hold.lift) hold.lift.classList.remove("on");
    if (element) element.classList.remove("hold-lifted");
  }

  function holdTouchOf(event, session) {
    return [...event.changedTouches].find((touch) => touch.identifier === session.id) || null;
  }

  function holdTouchStart(event) {
    if (hold.session) endHold(hold.session, null);
    if (event.touches.length > 1) return;
    const element = holdSliderOf(event.target);
    const adapter = element ? holdAdapter(element) : null;
    if (!adapter) return;
    const touch = event.changedTouches[0];
    const session = { element, adapter, id: touch.identifier, x: touch.clientX, y: touch.clientY, grab: 0,
      lifted: false, value: element.value };
    session.timer = setTimeout(() => liftHold(session), hold.delay);
    hold.session = session;
  }

  // The hold is over: the handle lifts and goes to the finger.
  function liftHold(session) {
    if (hold.session !== session) return;
    session.lifted = true;
    try { if (navigator.vibrate) navigator.vibrate(HOLD_BUZZ_MS); } catch (error) { /* no vibration here */ }
    const handle = session.adapter.handle(session.x);
    session.grab = handle && Math.abs(session.x - handle.x) < HOLD_GRAB_PX ? handle.x - session.x : 0;
    session.adapter.start(session.x + session.grab);
    session.value = session.element.value;
    showHoldLift(session);
  }

  function holdTouchMove(event) {
    const session = hold.session;
    const touch = session ? holdTouchOf(event, session) : null;
    if (!touch) return;
    if (!session.lifted) {
      if (Math.hypot(touch.clientX - session.x, touch.clientY - session.y) > HOLD_SLIDER_SLOP) endHold(session, null);
      return;
    }
    if (event.cancelable) event.preventDefault();
    session.adapter.move(touch.clientX + session.grab);
    session.value = session.element.value;
    showHoldLift(session);
  }

  function holdTouchEnd(event) {
    const session = hold.session;
    if (!session || !holdTouchOf(event, session)) return;
    // No click follows: a tap moves nothing, and a range input's own tap would.
    if (event.type === "touchend" && event.cancelable) event.preventDefault();
    endHold(session, event);
  }

  // Close a touch on a slider; its range input's own late events (its change on lift-off) stay held back this turn.
  function endHold(session, event) {
    clearTimeout(session.timer);
    if (session.lifted) {
      session.lifted = false;
      session.adapter.end();
      hideHoldLift(session.element);
    }
    if (!event) { hold.session = null; return; }
    setTimeout(() => { if (hold.session === session) hold.session = null; }, 0);
  }

  // A range input's own input and change events while a finger is on it: undone and kept from its listeners.
  function holdGuard(event) {
    const session = hold.session;
    if (!session || !event.isTrusted || event.target !== session.element || session.element.tagName !== "INPUT") return;
    session.element.value = session.value;
    event.stopImmediatePropagation();
  }

  // A mouse or pen moves the slider at once (its own handlers do); the handle lifts until the button is let go.
  function holdPointerDown(event) {
    if (event.pointerType === "touch" || event.button > 0) return;
    const element = holdSliderOf(event.target);
    const adapter = element ? holdAdapter(element) : null;
    if (!adapter) return;
    const session = { element, adapter };
    hold.pointer = session;
    requestAnimationFrame(() => { if (hold.pointer === session) showHoldLift(session, event.clientX); });
  }

  function holdPointerUp() {
    if (!hold.pointer) return;
    hideHoldLift(hold.pointer.element);
    hold.pointer = null;
  }

  function wireHoldSliders() {
    document.addEventListener("touchstart", holdTouchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", holdTouchMove, { capture: true, passive: false });
    document.addEventListener("touchend", holdTouchEnd, { capture: true, passive: false });
    document.addEventListener("touchcancel", holdTouchEnd, { capture: true, passive: false });
    window.addEventListener("input", holdGuard, true);
    window.addEventListener("change", holdGuard, true);
    // A long press on a slider is the hold, not the browser's menu.
    document.addEventListener("contextmenu", (event) => { if (holdSliderOf(event.target)) event.preventDefault(); }, true);
    document.addEventListener("pointerdown", holdPointerDown, true);
    window.addEventListener("pointermove", () => { if (hold.pointer) showHoldLift(hold.pointer); });
    window.addEventListener("input", () => { if (hold.pointer) showHoldLift(hold.pointer); });
    window.addEventListener("pointerup", holdPointerUp);
    window.addEventListener("pointercancel", holdPointerUp);
  }

  // ---- Swipe: a sideways drag moves to the next or previous Inputs panel, Outputs sub-tab, or walkthrough question ----
  // An enhancement only: the chips, Continue and Back do the same. A touch or pen drag that starts in the area (not in
  // a field, drag handle, chart, chips row or sideways-scrolling table; a slider is fine, since it waits for a hold,
  // 26-hold-slider.js, and no swipe starts once it has lifted) and goes mostly sideways follows the
  // finger; let go past a third of the width, or flicked, it moves on (finger to the left: forward), otherwise it
  // springs back. On Outputs it steps through the sub-tabs of each view and on to the next view; it never moves between
  // the bottom tabs (Setup, Inputs, Outputs): past an end it springs back.
  // The area's touch-action (pan-y, styles.css) leaves vertical scrolling to the browser, which cancels the drag.
  const SWIPE_SLOP = 10;  // px moved before a drag is judged sideways (more across than 1.5 times down) or not
  const SWIPE_FLICK = 0.5;  // px per ms: a quicker release moves on whatever the distance
  const SWIPE_SPRING = "transform " + BUBBLE_MS + "ms cubic-bezier(0.34, 1.4, 0.64, 1)";

  function swipeStartsOn(target, root) {
    if (!target.closest) return false;
    if (!holdSliderOf(target) && target.closest("input, select, textarea, [contenteditable], [role=slider], "
      + ".drag-handle, .chart-svg, canvas, .chips")) return false;
    for (let node = target; node && node !== root; node = node.parentElement) {
      if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return false;
    }
    return true;
  }

  // Watch `root` for swipes. `handlers.enabled(down)` says whether a swipe may start (and `width()`, when given, how
  // wide the swiped area is; else root's width), `drag(dx, width)` follows the
  // finger and `release(direction, dx, width)` ends it (direction 1 forward, -1 back, 0 too short: spring back).
  function wireSwipe(root, handlers) {
    // While a sideways drag is followed the page must not scroll: Safari still can when the area's touch-action is
    // not honoured, so its touchmove is cancelled too.
    let claimed = false;
    root.addEventListener("touchmove", (event) => { if (claimed && event.cancelable) event.preventDefault(); },
      { passive: false });
    root.addEventListener("pointerdown", (down) => {
      if (down.pointerType === "mouse" || !down.isPrimary || !handlers.enabled(down) || !swipeStartsOn(down.target, root)) {
        return;
      }
      const width = Math.max(1, handlers.width ? handlers.width() : root.clientWidth);
      let sideways = null;
      let dx = 0;
      let samples = [];
      const stop = () => {
        claimed = false;
        root.removeEventListener("pointermove", move);
        root.removeEventListener("pointerup", end);
        root.removeEventListener("pointercancel", end);
      };
      const move = (event) => {
        if (event.pointerId !== down.pointerId) return;
        dx = event.clientX - down.clientX;
        const dy = event.clientY - down.clientY;
        if (sideways === null) {
          if (holdSliderBusy()) { stop(); return; }  // a slider held long enough takes the finger
          if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return;
          sideways = Math.abs(dx) > 1.5 * Math.abs(dy);
          if (!sideways) { stop(); return; }
          claimed = true;
          try { root.setPointerCapture(event.pointerId); } catch (error) { /* already released */ }
        }
        samples = samples.filter(([time]) => event.timeStamp - time < 100).concat([[event.timeStamp, dx]]);
        handlers.drag(dx, width);
      };
      const end = (event) => {
        if (event.pointerId !== down.pointerId) return;
        stop();
        if (!sideways) return;
        if (event.type === "pointercancel") { handlers.release(0, dx, width); return; }
        const [time, first] = samples[0] || [event.timeStamp, dx];
        const speed = event.timeStamp > time ? (dx - first) / (event.timeStamp - time) : 0;
        const far = Math.abs(dx) > width / 3;
        const flick = Math.abs(dx) > 30 && Math.abs(speed) > SWIPE_FLICK && Math.sign(speed) === Math.sign(dx);
        handlers.release(far || flick ? -Math.sign(dx) : 0, dx, width);
      };
      root.addEventListener("pointermove", move);
      root.addEventListener("pointerup", end);
      root.addEventListener("pointercancel", end);
    });
  }

  // Slide `element` by `dx` with no transition, or back to rest with the spring (`dx` null).
  function slideTo(element, dx, spring) {
    element.style.transition = spring ? SWIPE_SPRING : "none";
    element.style.transform = dx ? "translateX(" + dx + "px)" : "";
  }

  // The settings panel `direction` (1 next, -1 previous) chips away from the selected one, or null at an end.
  function neighbourChip(direction) {
    const chips = [...$("chips-settings").querySelectorAll(".chip")];
    const at = chips.findIndex((chip) => chip.getAttribute("aria-selected") === "true");
    return at < 0 ? null : chips[at + direction] || null;
  }

  // The sub-tabs of each Outputs view, in order; a view without sub-tabs (Summary, Compare, Optimize) is one step of
  // its own.
  const OUTPUT_SUBTABS = { plots: { list: PLOT_VIEWS, chip: "plots" } };

  // The sub-tab a view shows now: its stored chip when the view still offers it, else its first; null for none.
  function shownSubtab(view) {
    const sub = OUTPUT_SUBTABS[view];
    if (!sub) return null;
    const stored = state.chips[sub.chip];
    return sub.list.some((item) => item.id === stored) ? stored : sub.list[0].id;
  }

  // Every Outputs step in swipe order: each view's sub-tabs, then the next view's. Strategy's views have no sub-tabs:
  // one step each.
  function outputSteps(tab) {
    if (tab === "strategy") return STRATEGY_VIEWS.map((view) => ({ view, sub: null }));
    return outputViews().flatMap((view) => (OUTPUT_SUBTABS[view] ? OUTPUT_SUBTABS[view].list.map((item) => ({ view, sub: item.id }))
      : [{ view, sub: null }]));
  }

  // Where a swipe `direction` (1 forward, -1 back) leads from the shown place: the neighbouring Inputs panel (`chip`,
  // in the bubble's `row`), or on Outputs the neighbouring sub-tab (`sub`), past either end of a view's sub-tabs the
  // neighbouring view, always at its first sub-tab (`chip` is then the view's chip), and on Strategy the neighbouring
  // view; null at an end, on Setup and on the Low page (one page, no panels), so a swipe never changes the bottom tab.
  function swipeTarget(direction) {
    if (swipeTab() === "inputs") {
      if (lowOn()) return null;  // the Low page: no panels
      const chip = neighbourChip(direction);
      return chip ? { tab: "inputs", view: state.view, chip, row: $("chips-settings") } : null;
    }
    const tab = swipeTab();
    if (tab === "outputs" || tab === "strategy") {
      const steps = outputSteps(tab);
      const shown = placeView(tab);
      const at = steps.findIndex((step) => step.view === shown && step.sub === shownSubtab(shown));
      const next = at < 0 ? null : steps[at + direction];
      if (!next) return null;
      const row = $("views-" + tab);
      if (next.view === shown) return { tab, view: next.view, sub: next.sub, row, chip: null };
      const sub = OUTPUT_SUBTABS[next.view];
      return { tab, view: next.view, sub: sub ? sub.list[0].id : null, row, chip: $("sub-" + next.view) };
    }
    return null;
  }

  // The tab a swipe moves through: the shown tab, or in the wide layout the column the finger went down in.
  let swipeColumn = null;
  const swipeTab = () => (wide.on && swipeColumn) || state.tab;

  // The swiped tab's panel, and its chips row that wears a bubble (none on Setup).
  const shownPanel = () => $("panel-" + swipeTab());
  const bubbleRow = () => (swipeTab() === "inputs" ? $("chips-settings")
    : swipeTab() === "outputs" || swipeTab() === "strategy" ? $("views-" + swipeTab()) : null);

  // After a swipe, scroll every chips row in view so the tab or sub-tab swiped to sits in the middle of the screen.
  function centerSwipedChips() {
    for (const row of document.querySelectorAll(".band .chips")) centerChip(row, true);
  }

  // Open a swipe's target and return what a screen reader hears: the Inputs panel's name, or the Outputs sub-tab's,
  // led by the view's name when the view changed. A new Inputs group or Outputs view opens at the top of the page.
  function openSwipeTarget(target) {
    if (target.tab === "inputs") {
      const panels = inputsPanels();
      const chosen = panels[[...$("chips-settings").querySelectorAll(".chip")].indexOf(target.chip)];
      state.chips.settings = chosen.id;
      savePrefs();
      renderSettings();
      scrollPlaceTop("inputs");
      centerSwipedChips();
      return chosen.label;
    }
    const sub = OUTPUT_SUBTABS[target.view];
    const viewChanged = target.view !== placeView(target.tab);
    if (sub) {
      state.chips[sub.chip] = target.sub;
      savePrefs();
      if (target.view === "summary") renderResults();
      else renderPlots();
    }
    if (viewChanged) goTo(target.tab, target.view);
    scrollPlaceTop(target.tab);  // another view or sub-tab opens at its top
    centerSwipedChips();
    const subLabel = sub ? sub.list.find((item) => item.id === target.sub).label : "";
    const viewLabel = $("sub-" + target.view).textContent.trim();
    return viewChanged ? [viewLabel, subLabel].filter(Boolean).join(", ") : subLabel;
  }

  // One swipe for the sheet: Inputs panels, Outputs sub-tabs and views, and Strategy's views; never across the bottom
  // tabs. In the wide layout (a touch screen such as an iPad held sideways) a swipe in the Inputs column moves between
  // its panels and one in the Outputs column between its sub-tabs and views (Strategy's while it holds the column),
  // the column sliding on its own; Setup has none.
  function wirePanelsSwipe() {
    let busy = false;
    // Listen on the whole sheet, so a swipe in the empty space below a short panel works too; the panel still slides.
    const root = document.querySelector("main.panels");
    wireSwipe(root, {
      enabled: (down) => {
        if (state.schema == null || walk.open || busy) return false;
        const column = wide.on ? down.target.closest("#panel-inputs, #panel-outputs, #panel-strategy") : null;
        swipeColumn = column ? column.dataset.tab : null;
        if (swipeTab() === "inputs" && lowOn()) return false;  // the Low page is one page: nothing to swipe to
        return !wide.on || column != null;
      },
      width: () => (wide.on ? shownPanel().clientWidth : root.clientWidth),
      drag: (dx, width) => {
        const target = swipeTarget(dx < 0 ? 1 : -1);
        if (reducedMotion()) return;
        slideTo(shownPanel(), target ? dx : dx * 0.3, false);
        const row = bubbleRow();
        if (row) stretchBubble(row, target && target.row === row ? target.chip : null, Math.abs(dx) / width);
      },
      release: (direction, dx, width) => {
        const target = direction ? swipeTarget(direction) : null;
        const panel = shownPanel();
        if (!target) {
          if (panel.style.transform) slideTo(panel, null, true);
          const row = bubbleRow();
          if (row) placeBubble(row, true);
          return;
        }
        const reduced = reducedMotion();
        const open = () => {
          slideTo(panel, null, false);  // the old panel back at rest (hidden when the tab changed)
          panel.style.transition = "";
          $("chipsLive").textContent = openSwipeTarget(target);
          const shown = shownPanel();
          if (reduced) { busy = false; return; }
          slideTo(shown, direction * width * 0.35, false);
          void shown.offsetWidth;  // start the slide in from the far side
          slideTo(shown, null, true);
          setTimeout(() => { shown.style.transition = ""; busy = false; }, BUBBLE_MS);
        };
        busy = true;
        if (reduced) { open(); return; }
        panel.style.transition = "transform 140ms ease-in";
        panel.style.transform = "translateX(" + (-direction * width) + "px)";
        setTimeout(open, 140);
      },
    });
  }

  // In the walkthrough a swipe forward is Continue (refused as Continue would be: the message shows and the
  // question springs back) and a swipe back is Back.
  function wireWalkSwipe() {
    const stage = $("walkStage");
    const screen = () => stage.querySelector(".walk-screen:last-child");
    const open = () => walk.open && !walk.busy && $("walkMap").hidden && $("walkLeave").hidden
      && !$("walk").classList.contains("walk-swapping");
    wireSwipe(stage, {
      enabled: open,
      drag: (dx) => {
        const element = screen();
        if (!element || reducedMotion()) return;
        slideTo(element, dx > 0 && $("walkBack").disabled ? dx * 0.3 : dx, false);
      },
      release: async (direction) => {
        const element = screen();
        const before = walk.saved.current;
        if (direction > 0 && open()) await walkSubmit();
        else if (direction < 0 && open() && !$("walkBack").disabled) walkBack();
        if (!element) return;
        slideTo(element, null, walk.open && walk.saved.current === before);
      },
    });
  }

  // The header band: the section label, the title (the selected settings group on Inputs, "Your plan" for the Low
  // page) and the subtitle.
  function renderBand() {
    const [label, title, sub] = PLACE_TEXT[scrollKey()];
    const chip = document.querySelector("#chips-settings .chip[aria-selected=true]");
    $("bandLabel").textContent = label;
    $("bandTitle").textContent = title || (lowOn() ? "Your plan" : chip ? chip.textContent : label);
    $("bandSub").textContent = sub;
  }

  // ---- Pinned tabs: Inputs' group chips, Outputs' view chips with their sub-tabs, or Strategy's view chips, stay
  // under the top bar ----
  // Pinned (the default), the band sticks with only its chips row showing below the top bar; unpinned, it scrolls
  // away. A pin button at each row's right end switches them all; the choice is kept on this device.
  const tabsPin = { on: true };

  function wireTabsPin() {
    try { tabsPin.on = localStorage.getItem(TABS_PIN_KEY) !== "off"; } catch (error) { /* storage blocked: pinned */ }
    markTabsPin();
    for (const button of document.querySelectorAll(".chips-pin")) {
      button.addEventListener("click", () => {
        tabsPin.on = !tabsPin.on;
        try { localStorage.setItem(TABS_PIN_KEY, tabsPin.on ? "on" : "off"); } catch (error) { /* storage blocked */ }
        markTabsPin();
        placeBand();
      });
    }
    const band = document.querySelector(".band");
    if (window.ResizeObserver) {
      const watch = new ResizeObserver(() => placeBand());
      watch.observe(band);
      watch.observe(document.querySelector(".topbar"));
    }
    window.addEventListener("resize", placeBand);
  }

  function markTabsPin() {
    for (const button of document.querySelectorAll(".chips-pin")) {
      button.setAttribute("aria-pressed", String(tabsPin.on));
      button.setAttribute("aria-label", tabsPin.on ? "Unpin groups" : "Pin groups");
    }
  }

  // Stick the band on Inputs, Outputs or Strategy while pinned: its top sits above the top bar's bottom by the height of everything over
  // the chips row (title and subtitle), less a small margin, so only the chips show once the page scrolls.
  function placeBand() {
    const place = ["inputs", "outputs", "strategy"].includes(state.tab) ? state.tab : null;
    // wide: the chips sit over their own column; the Low page has no Inputs chips to pin
    const on = !wide.on && place != null && tabsPin.on && !(place === "inputs" && lowOn());
    $("app").classList.toggle("inputs-pinned", on && place === "inputs");
    $("app").classList.toggle("outputs-pinned", on && place === "outputs");
    $("app").classList.toggle("strategy-pinned", on && place === "strategy");
    if (!on) return;
    const band = document.querySelector(".band");
    const wrap = band.querySelector(`.chips-wrap[data-place="${place}"]`);
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

  // The menu's Appearance entry opens its color schemes in place under it, and closes them again (s422).
  function toggleAppearance() {
    const open = $("menuScheme").hidden;
    $("menuScheme").hidden = !open;
    $("menuAppearance").setAttribute("aria-expanded", String(open));
    $("menuAppearance").classList.toggle("menu-open", open);
  }

  // The schemes folded away under Appearance, so the menu opens short.
  function closeAppearance() {
    $("menuScheme").hidden = true;
    $("menuAppearance").setAttribute("aria-expanded", "false");
    $("menuAppearance").classList.remove("menu-open");
  }

  function openMenu() {
    markScheme();
    closeAppearance();
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
    closeAppearance();
    $("menuButton").setAttribute("aria-expanded", "false");
    $("menuButton").focus();
  }

  function renderAll() {
    renderPinned();
    renderMcBar();
    renderResults();
    renderPlots();
    renderEffortViews();  // Inputs (the Low page at Low), with the Summary, band and run bar for the effort
    renderCompare();
    renderSaved();
    renderAbout();
    renderLoaded();
    applyExperience();
  }

  // ---- Setup: the open scenario card, the seed and runs, and the Inflation card (the inflation adjusted switch and
  // the inflation range, in Advanced settings with the Run card) ----
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  // The saved copy of a scenario: its entry on this device, or the example household for the example's name (unless
  // it was deleted from Other scenarios while another scenario was open).
  function savedCopy(name) {
    if (hasOwn(state.scenarios, name)) return state.scenarios[name];
    return name === EXAMPLE_NAME && (!state.exampleHidden || name === state.scenarioName) ? state.defaults : null;
  }

  // Whether the open scenario differs from its saved copy, or has none yet. The settings alone are compared: the
  // experience block (effort, style, walkthrough progress) never makes a scenario unsaved.
  function hasUnsavedChanges() {
    const copy = savedCopy(state.scenarioName);
    return !copy || !sameValue(splitExperience(copy).inputs, state.inputs);
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
    $("setupFoldName").textContent = state.scenarioName;
    // The shipped example household, unedited, carries a "Tough example" tag; its (i) explains why.
    const tough = state.scenarioName === EXAMPLE_NAME && state.defaults != null && sameValue(state.inputs, state.defaults);
    $("exampleTag").hidden = !tough;
    if (!tough) {
      $("help-example").hidden = true;
      $("exampleTag").querySelector(".help-button").setAttribute("aria-expanded", "false");
    }
    $("saveStatus").textContent = autoSaveOn() ? "Saved automatically" : unsaved ? "Unsaved changes"
      : state.savedJustNow ? "Saved just now" : "Saved";
    $("dirtyDot").hidden = autoSaveOn() || !unsaved;
    $("autoSave").setAttribute("aria-checked", String(autoSaveOn()));
    $("saveButton").hidden = autoSaveOn();
    $("undoButton").disabled = !state.undo.stack.length;
  }

  // A blank Years to simulate shows, in grey, the years until you are 100 (planYears): kept in step with your age
  // after every edit, unless its box is being typed in.
  function refreshYearsDefault() {
    const input = $(fieldId("years"));
    if (!input || !state.inputs || state.inputs.years != null || document.activeElement === input) return;
    input.value = String(planYears(state.inputs));
    markDefault(input, "years");
  }

  // A blank Last year you were paid this salary and a blank Last salary show, in grey, the year and salary the model
  // uses (PANEL_DEFAULTS): kept in step with the age, the age pay stops, Retired and the salary after every edit,
  // unless its box is being typed in.
  function refreshLastSalaryYearDefaults() {
    if (!state.inputs) return;
    for (const path of ["you.lastSalaryYear", "partner.lastSalaryYear", "you.lastSalary", "partner.lastSalary"]) {
      const input = $(fieldId(path));
      if (!input || getPath(state.inputs, path) != null || document.activeElement === input) continue;
      const fallback = panelDefault(path, state.inputs, state.info.lawTaxYear);
      input.value = fallback ? String(fallback.value) : "";
      markDefault(input, path);
    }
  }

  function renderRunCard() {
    const rootFields = state.schema.types[state.schema.root];
    $("run-body").replaceChildren(...RUN_CARD_FIELDS.map((name) =>
      fieldElement(rootFields.find((item) => item.name === name), name)), seedField(), runsField());
    // At Medium the inflation adjusted switch (High) waits for Household's Add detail, at the foot of the card.
    const household = state.schema.panels.find((panel) => panel.id === SETUP_PANEL);
    $("inflation-body").replaceChildren(...INFLATION_CARD_FIELDS.filter((name) => !household
      || entryShown(household, name)).map((name) => {
      const element = fieldElement(rootFields.find((item) => item.name === name), name);
      element.dataset.inflationField = name;
      return element;
    }));
    syncInflationRange();
    const detail = paneDetailRow(SETUP_PANEL);
    $("advancedDetail").replaceChildren(...(detail ? [detail] : []));
  }

  // The inflation range shows only while Inflation-adjusted dollars is on. Off, it is hidden but still used: its mean
  // turns the nominal rates into today's dollars. While the switch is not drawn (Medium) the range always shows.
  function syncInflationRange() {
    const range = document.querySelector("#inflation-body [data-inflation-field=\"inflation\"]");
    const switchDrawn = document.querySelector("#inflation-body [data-inflation-field=\"useInflation\"]");
    if (range) range.hidden = Boolean(switchDrawn) && !(state.inputs && state.inputs.useInflation);
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
    return dollars === "future" ? "Inflation adjusted" : "Today's dollars";
  }

  // The pinned strip: what the household is worth today (the single run's `netWorthToday`), the median final worth of
  // the last Monte Carlo (marked when stale), then the two single-run headlines (net earnings or withdrawal, annual
  // expense). While a run after a change is under way its figures read RUNNING_TEXT: the single run's while it runs,
  // the median before the first Monte Carlo and while a stale one is being replaced (a run going, or the single run
  // it waits for). Median final worth and the two single-run headlines are buttons that open their Outputs plot in a
  // pop-up (PIN_PLOTS, the PLOT_VIEWS id; openPinPlot in 70-plots.js), with the timeline's tap hint at the top right.
  const RUNNING_TEXT = "Running…";
  const PIN_PLOTS = { "Median final worth": "total", "Avg net earnings": "flows", "Avg annual expense": "expenses" };
  function renderPinned() {
    const pinned = $("pinned");
    if (!state.result || needsSetup(state.inputs)) { pinned.replaceChildren(); return; }
    const { entry, stale } = latestMonteCarlo();
    const median = entry ? entry.value.headlines.find((item) => item.label === "Median final worth") : null;
    const medianRunning = !median || (stale && Boolean(state.mc.job || singleBusy));
    const today = state.result.netWorthToday;
    const stalePin = entry && stale ? " stale-results" : "";
    const money = (value) => (singleBusy ? RUNNING_TEXT : compactMoney(value));
    const pin = (label, value, extra) => {
      const inner = "<span class=\"pin-label\">" + escapeText(label) + "</span><span class=\"pin-value\">"
        + escapeText(value) + "</span>";
      const plot = PLOT_VIEWS.find((view) => view.id === PIN_PLOTS[label]);
      if (!plot) return "<div class=\"pin" + extra + "\">" + inner + "</div>";
      const name = label + " " + value + ", " + (timelineTouch() ? "tap" : "click") + " to show the " + plot.label + " plot";
      return "<button type=\"button\" class=\"pin pin-button" + extra + "\" data-plot=\"" + plot.id
        + "\" aria-haspopup=\"dialog\" aria-label=\"" + escapeText(name) + "\">" + inner
        + "<span class=\"timeline-bar-icon pin-tap\" aria-hidden=\"true\">" + TIMELINE_TAP_ICON + TIMELINE_CLICK_ICON
        + "</span></button>";
    };
    pinned.innerHTML = (today ? pin(today.label, money(today.value), "") : "")
      + pin("Median final worth", medianRunning ? RUNNING_TEXT : compactMoney(median.value), stalePin)
      + state.result.headlines.slice(0, 2).map((headline) => pin(headline.label, money(headline.value), "")).join("");
  }

  function errorBanner(error) {
    return "<div class=\"banner banner-error\" role=\"alert\"><strong>Settings need a fix.</strong> "
      + escapeText(error) + " The figures below are from the last valid settings.</div>";
  }

  // A value tile: its label (with an "i" beside it when the headline has a note), the value, the range or change
  // lines, and the note hidden until the "i" is tapped (one click handler in wire()). `source` is "mc" for a Monte
  // Carlo tile, "single" for the single run's, for its Why? button (56-accountant.js).
  function tileHtml(headline, first, stale, source) {
    const helpId = headline.help ? newHelpId() : null;
    const label = "<span class=\"tile-label\">" + escapeText(headline.label) + "</span>";
    const subtitle = headline.subtitle ? "<span class=\"tile-subtitle\">" + escapeText(headline.subtitle) + "</span>" : "";
    const lines = (headline.range ? "<span class=\"tile-change\">Middle half of the runs: "
        + escapeText(fullMoney(headline.range[0])) + " to " + escapeText(fullMoney(headline.range[1])) + "</span>" : "")
      + (headline.change ? "<span class=\"tile-change\">" + escapeText(headline.change) + " from "
        + escapeText(state.scenarioName) + "</span>" : "");
    const value = "<span class=\"tile-value\">"
      + escapeText(headline.unit === "percent" ? percent(headline.value, 1) : fullMoney(headline.value)) + "</span>";
    // Minimalist (glanceOn): the big number first; the subtitle and the range or change lines a Details tap away.
    const body = glanceOn() ? value + glanceDetails("Details", subtitle + lines) : subtitle + value + lines;
    return "<div class=\"tile" + (first ? " tile-first" : "") + (stale ? " stale-results" : "") + "\">"
      + (helpId ? "<div class=\"tile-head\">" + label + helpButtonHtml(headline.label, helpId) + "</div>" : label)
      + body
      + (helpId ? helpTextHtml(helpId, headline.help, "tile-help") : "") + accountantWhyButton(headline, source) + "</div>";
  }

  // Minimalist's tap-to-open box (a details element) round `inner` under `summary`; "" when there is nothing inside.
  function glanceDetails(summary, inner) {
    return inner ? "<details class=\"glance-more\"><summary>" + escapeText(summary) + "</summary>" + inner + "</details>"
      : "";
  }

  // Whether the open scenario shows at Low effort, where Summary opens with the gauge and the fan chart (and the
  // Inputs tab is the Low page).
  function lowShown() {
    return Boolean(state.info && state.experience) && shownExperience().effort === "low";
  }

  // What the Low gauge and fan chart show: the full Monte Carlo when it is current, else the partial result of the
  // run under way on the current settings (`state.mc.preview`), else the stale full one (dimmed); null for none.
  function lowResult(entry, stale) {
    const preview = state.mc.preview;
    if (entry && !stale) return { value: entry.value, preview: false, stale: false };
    if (preview && preview.key === mcKey()) return { value: preview.value, preview: true, stale: false };
    return entry ? { value: entry.value, preview: false, stale: true } : null;
  }

  // The Low cards above Summary's tiles: the gauge (share of runs that ended with money left, no verdict) and the fan
  // chart card; a preview says the full runs are still going. Returns [cards, figures to attach], or null.
  function lowResultCards(entry, stale) {
    const shown = lowResult(entry, stale);
    if (!shown) return null;
    const result = shown.value;
    const dimmed = shown.stale ? " stale-results" : "";
    const cards = [];
    const depleted = result.headlines.find((headline) => headline.label === "Chance of running out");
    if (depleted && depleted.value != null) {
      const share = 1 - depleted.value;
      const gauge = document.createElement("div");
      gauge.className = "card gauge-card" + dimmed;
      gauge.id = "lowGauge";
      gauge.innerHTML = "<h2>Chance your money lasts</h2>"
        + charts.renderGauge({ share, runs: result.runs, preview: shown.preview })
        + "<p class=\"gauge-caption\">" + escapeText(percent(share, 0) + " of " + result.runs
          + " runs ended with money left.") + "</p>"
        + (shown.preview ? "<p class=\"low-preview-note\">" + escapeText("Preview from " + result.runs + " runs; the full "
          + state.mc.runs + " are running.") + "</p>" : "");
      cards.push(gauge);
    }
    if (result.fan) {
      const fan = chartCard(result.fan, renderResults);
      fan.id = "lowFan";
      if (shown.stale) fan.classList.add("stale-results");
      if (shown.preview) {
        fan.insertAdjacentHTML("beforeend", "<p class=\"low-preview-note\">" + escapeText("Preview from " + result.runs
          + " runs; the full " + state.mc.runs + " are running.") + "</p>");
      }
      cards.push(fan);
    }
    return cards.length ? [cards, cards.filter((card) => card.chartSpec)
      .map((card) => [card.querySelector("figure"), card.chartSpec])] : null;
  }

  // Put the Low cards into their holder in Summary's body and attach the chart readout.
  function placeLowResults(body, low) {
    const holder = body.querySelector("#lowResults");
    if (!holder || !low) return;
    holder.replaceChildren(...low[0]);
    low[1].forEach(([figure, spec]) => figure && charts.attachChart(figure, spec));
  }

  // Summary: the headline tiles and insights of the last Monte Carlo (the single-run headline tiles after the Monte
  // Carlo ones), then a pointer to the Final report, which holds every table; the app itself shows none. At Low the
  // gauge and the fan chart come first (lowResultCards), from the partial result while the first runs go on.
  function renderResults() {
    gamerTick();  // a new result may finish a quest
    const body = $("results-body");
    if (needsSetup(state.inputs)) { body.innerHTML = FINISH_SETUP_HTML; return; }
    let html = state.error ? errorBanner(state.error) : "";
    const { entry, stale } = latestMonteCarlo();
    const low = lowShown() ? lowResultCards(entry, stale) : null;
    const lowHolder = low ? "<div class=\"low-results\" id=\"lowResults\"></div>" : "";
    const nextSteps = "<div id=\"nextSteps\">" + renderNextSteps() + "</div>";  // Coach and Gamer (49-coach.js)
    const accountantCards = "<div id=\"accountantCards\"></div>";  // the Accountant extras (56-accountant.js)
    const accountantLedger = "<div id=\"accountantLedger\"></div>";
    if (!entry) {
      body.innerHTML = html + lowHolder + accountantCards + nextSteps
        + "<div class=\"card empty-state\">No Monte Carlo yet. It starts on its own.</div>";
      placeLowResults(body, low);
      wireNextSteps(body);
      wireAccountant(body);
      return;
    }
    const result = entry.value;
    const tables = result.tables;
    const meta = "<div class=\"result-meta\"><span>" + result.runs + " runs</span><span>Seed " + escapeText(result.seed)
      + "</span><span>" + escapeText(dollarsText(result.dollars)) + "</span></div>"
      + "<p class=\"note dollars-note\" id=\"dollarsNote\">"  // what the dollars are, before any figure
      + escapeText(dollarsNote(ranInputs(entry, stale), result.dollars)) + "</p>";
    html += (glanceOn() ? glanceDetails("About these figures", meta) : meta) + lowHolder + "<div class=\"tiles\">"
      + result.headlines.map((headline, position) => tileHtml(headline, position === 0, stale, "mc")).join("")
      + (state.result ? state.result.headlines.map((headline) => tileHtml(headline, false, false, "single")).join("")
        : "")
      + "</div>" + (tables.shortfallNote ? "<p class=\"note shortfall-note\">" + escapeText(tables.shortfallNote) + "</p>" : "")
      + (tables.penaltyNote ? "<p class=\"note penalty-note\">" + escapeText(tables.penaltyNote) + "</p>" : "");
    html += accountantCards + nextSteps + renderInsights(result, entry, stale) + REPORT_POINTER_HTML + accountantLedger;
    body.innerHTML = html;
    placeLowResults(body, low);
    wireNextSteps(body);
    wireAccountant(body);
  }

  // The inputs a Monte Carlo cache entry ran on: the current ones unless it is stale.
  function ranInputs(entry, stale) {
    if (!stale) return state.inputs;
    try { return JSON.parse(entry.key)[0]; } catch (error) { return state.inputs; }
  }

  // The Insights card (insights.js) of a Monte Carlo cache entry, on the inputs it ran on: a list per kind that has
  // items and the note; "" when neither has any. A person's unused-match line is left out while the Next steps card
  // shows that person's match gap (the report keeps it).
  function renderInsights(result, entry, stale) {
    const found = insightRules.insights(ranInputs(entry, stale), result);
    const coached = new Set(coachMatchRoles().map((role) => "unusedMatch-" + role));
    found.opportunities = found.opportunities.filter((item) => !coached.has(item.id));
    const groups = [["Warnings", found.warnings, "insights-warnings"], ["Opportunities", found.opportunities,
      "insights-opportunities"]].filter(([, items]) => items.length);
    if (!groups.length) return "";
    return "<div class=\"card insights-card" + (stale ? " stale-results" : "") + "\" id=\"insights\"><div class=\"card-head\">"
      + "<h2>Insights</h2></div>" + groups.map(([title, items, kind]) => "<h3 class=\"insights-title\">" + title
      + "</h3><ul class=\"notes " + kind + "\">" + items.map((item) => "<li>" + escapeText(item.text) + "</li>").join("")
      + "</ul>").join("") + "<p class=\"note insights-note\">" + escapeText(found.note) + "</p></div>";
  }

  // What Summary and Plots show while a new scenario has no age yet (needsSetup): no result, nothing alarming.
  const FINISH_SETUP_HTML = "<div class=\"card empty-state finish-setup\"><strong>Finish setup to see results.</strong> "
    + "Fill in your age and the rest under Inputs, or open Walk me through it from the menu.</div>";

  // Where the tables went: one line and a button that opens the Final report (PDF) picker (wired once in wire()).
  const REPORT_POINTER_HTML = "<div class=\"card report-pointer\"><p>Detailed tables are in the Final report (PDF) in "
    + "the menu.</p><button type=\"button\" class=\"button button-quiet open-report\">Open the Final report</button></div>";

  // ---- Effort and style: the picker and "Using defaults for N inputs" ----
  // Effort (how much the app asks) and style (how it talks) are the open scenario's experience block
  // (state.experience); the choices and their blurbs come from appInfo().experience. Changing either saves the block
  // (saveExperience): no run, no undo step and no unsaved mark. The picker (an energy bar for effort, a tile per
  // style, each choice's description behind its (i)) is the only place to choose them; it opens from the menu (or
  // the Low page's Change effort; Save and Cancel) and once at start-up until it has been kept (Continue: a
  // new user's first launch, or a returning user's first visit since the picker came, wmti.picker.v1). Opening or
  // importing a scenario with another effort or style asks which to keep (askExperience).
  const experiencePicker = { mode: null, resolve: null, choice: null, returnFocus: null };
  const { pickerLevelAt, pickerKeyLevel } = window.WmtiShared;

  // The picker's group descriptions behind the (i) beside Effort and Style; each choice's own description is its blurb
  // from appInfo().experience.
  const PICKER_GROUP_INFO = { effort: "How many questions you answer. Drag the bar up or down, or tap a level.",
    style: "How results are shown. Style never changes the numbers." };
  // The style tiles' icons (stroke colour, stroke width, 24 by 24 shapes); a style the app does not know uses the first.
  const PICKER_STYLE_ICONS = {
    standard: ["#3d4a54", 1.6, '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>'],
    accountant: ["#185FA5", 1.6, '<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="8" height="3"/>'
      + '<path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01"/>'],
    coach: ["#FFF4DD", 1.8, '<path d="M4 18l6-6 4 4 6-8"/><path d="M15 8h5v5"/>'],
    glance: ["#24242a", 1.4, '<circle cx="12" cy="12" r="8"/><path d="M9 12h6"/>'],
    gamer: ["#5DFFC8", 1.8, '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 12h.01M18 13h.01"/>'],
  };
  const PICKER_SPARKS = 8;  // sparks over the energy bar's top edge at High; the first two also at Medium

  // An (i) button of the picker: opens `title` and `text` in the picker's description panel (`popId`).
  function pickerInfoButton(title, text, popId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pk-info";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", popId);
    button.setAttribute("aria-label", "About " + title);
    button.dataset.title = title;
    button.dataset.text = text;
    const mark = document.createElement("span");
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "i";
    button.append(mark);
    button.addEventListener("click", () => showPickerInfo(button));
    return button;
  }

  // Show the description of (i) `button` in its picker's panel, or close the panel when that one is already open.
  function showPickerInfo(button) {
    const pop = document.getElementById(button.getAttribute("aria-controls"));
    if (!pop) return;
    const open = button.getAttribute("aria-expanded") === "true";
    closePickerInfo(pop);
    if (open) return;
    const title = document.createElement("b");
    title.textContent = button.dataset.title;
    pop.replaceChildren(title, document.createTextNode(button.dataset.text));
    pop.hidden = false;
    button.setAttribute("aria-expanded", "true");
    pop.scrollIntoView({ block: "nearest" });
  }

  // Close the picker description panel `pop` and mark its (i) buttons closed.
  function closePickerInfo(pop) {
    if (!pop) return;
    pop.hidden = true;
    pop.replaceChildren();
    for (const button of document.querySelectorAll('.pk-info[aria-controls="' + pop.id + '"]')) {
      button.setAttribute("aria-expanded", "false");
    }
  }

  // Mark `choice` ({effort, style}) on the picker groups inside `root` without rebuilding them: the radios, the energy
  // bar's level and fill (--pk-f), the slider's value and the chosen stop and tile. Keeps focus and the transitions.
  function paintExperience(root, choice) {
    for (const input of root.querySelectorAll(".pk-group input[type=radio]")) {
      input.checked = choice[input.dataset.key] === input.value;
      const holder = input.closest(".pk-stop, .pk-style");
      if (holder) holder.classList.toggle("pk-on", input.checked);
    }
    const eff = root.querySelector(".pk-eff");
    if (!eff) return;
    const efforts = state.info.experience.efforts;
    const index = Math.max(0, efforts.findIndex((item) => item.id === choice.effort));
    const level = efforts.length > 1 ? Math.round(index * 2 / (efforts.length - 1)) : 0;
    eff.classList.remove("pk-drag", "lv0", "lv1", "lv2");
    eff.classList.add("lv" + level);
    eff.style.setProperty("--pk-f", String((index + 1) / efforts.length));
    const slider = eff.querySelector(".pk-barwrap");
    slider.setAttribute("aria-valuenow", String(index));
    slider.setAttribute("aria-valuetext", efforts[index] ? efforts[index].label : "");
  }

  // The two picker groups, Effort (an energy bar to drag, with a stop per level) then Style (a tile per style), and the
  // description panel their (i) buttons open, marking `choice` ({effort, style}); `onPick` gets {effort} or {style}.
  // `prefix` keeps the ids and radio names of the card and the picker apart. Each choice keeps a real radio (laid over
  // its stop or tile) with its label and blurb; the effort radios leave the keyboard to the bar (role=slider).
  function experienceGroups(prefix, choice, onPick) {
    const offered = state.info.experience;
    const pop = document.createElement("p");
    pop.className = "pk-pop";
    pop.id = prefix + "-info";
    pop.setAttribute("role", "status");
    pop.setAttribute("aria-live", "polite");
    pop.hidden = true;
    const grid = document.createElement("div");
    grid.className = "pk-grid";
    // The choice the groups mark now (the card's is repainted from outside too, so it is read back, not kept).
    const marked = () => {
      const read = (key) => (grid.querySelector('input[data-key="' + key + '"]:checked') || {}).value;
      return { effort: read("effort"), style: read("style") };
    };
    const pick = (change) => {
      closePickerInfo(pop);
      paintExperience(grid, { ...marked(), ...change });
      onPick(change);
    };
    const group = (key, title) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "experience-group pk-group pk-group-" + key;
      fieldset.id = prefix + "-" + key;
      const legend = document.createElement("legend");
      legend.className = "pk-legend";
      const name = document.createElement("span");
      name.textContent = title;
      legend.append(name, pickerInfoButton(title, PICKER_GROUP_INFO[key], pop.id));
      fieldset.append(legend);
      return fieldset;
    };
    const radio = (key, item) => {
      const input = document.createElement("input");
      input.type = "radio";
      input.className = "pk-radio";
      input.name = prefix + "-" + key;
      input.id = prefix + "-" + key + "-" + item.id;
      input.value = item.id;
      input.dataset.key = key;
      input.addEventListener("change", () => { if (input.checked) pick({ [key]: item.id }); });
      const label = document.createElement("span");
      label.className = "experience-label";
      label.textContent = item.label;
      const blurb = document.createElement("span");
      blurb.className = "experience-blurb";
      blurb.hidden = true;
      blurb.textContent = item.blurb;
      return [input, label, blurb];
    };

    // Effort: the bar (its fill, two dividers, the knob and the sparks) and a stop per level, the highest on top; the
    // DOM keeps them lowest first (Low, Medium, High).
    const efforts = offered.efforts;
    const effort = group("effort", "Effort");
    const eff = document.createElement("div");
    eff.className = "pk-eff";
    const slider = document.createElement("div");
    slider.className = "pk-barwrap";
    slider.tabIndex = 0;
    slider.setAttribute("role", "slider");
    slider.setAttribute("aria-orientation", "vertical");
    slider.setAttribute("aria-label", "Effort");
    slider.setAttribute("aria-valuemin", "0");
    slider.setAttribute("aria-valuemax", String(Math.max(0, efforts.length - 1)));
    slider.innerHTML = '<div class="pk-cap"></div><div class="pk-bar"><div class="pk-cells"><div class="pk-fill"></div>'
      + '<div class="pk-div" style="top: 33.3%"></div><div class="pk-div" style="top: 66.6%"></div></div></div>'
      + '<div class="pk-rail"><div class="pk-sparks"></div><div class="pk-knob"><svg viewBox="0 0 24 24" aria-hidden="true">'
      + '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/></svg></div></div>';
    const sparks = slider.querySelector(".pk-sparks");
    for (let index = 0; index < PICKER_SPARKS; index += 1) {
      const spark = document.createElement("span");
      spark.className = "pk-spark" + (index < 2 ? " few" : "");
      spark.style.setProperty("--x", (4 + (index * 7) % 24) + "px");
      spark.style.setProperty("--dx", ((index % 2 ? 1 : -1) * (6 + (index * 5) % 13)) + "px");
      spark.style.setProperty("--dy", (-12 - (index * 9) % 24) + "px");
      spark.style.animationDelay = ((index * 0.37) % 1.1).toFixed(2) + "s";
      sparks.append(spark);
    }
    const stops = document.createElement("div");
    stops.className = "pk-stops";
    efforts.forEach((item, index) => {
      const stop = document.createElement("div");
      stop.className = "pk-stop";
      stop.style.setProperty("--pk-at", String(1 - (index + 0.5) / efforts.length));
      const option = document.createElement("label");
      option.className = "pk-lab";
      const [input, label, blurb] = radio("effort", item);
      input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true");
      // A stop's pick leaves focus on the bar, not on its hidden radio.
      input.addEventListener("change", () => slider.focus({ preventScroll: true }));
      option.append(input, label, blurb);
      stop.append(option, pickerInfoButton(item.label, item.blurb, pop.id));
      stops.append(stop);
    });
    eff.append(slider, stops);
    effort.append(eff);

    // Drag (mouse, touch or pen): the fill follows the pointer and the release chooses the level under it; a tap does
    // the same. A cancelled drag puts the chosen level back.
    const cells = slider.querySelector(".pk-cells");
    const fractionAt = (y) => {
      const box = cells.getBoundingClientRect();
      const fraction = box.height > 0 ? (box.bottom - y) / box.height : 0;
      return Math.min(1, Math.max(0.05, fraction));
    };
    let dragging = null;
    slider.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button > 0) return;
      dragging = event.pointerId;
      try { slider.setPointerCapture(event.pointerId); } catch (error) { /* a synthetic pointer: no capture */ }
      closePickerInfo(pop);
      eff.classList.add("pk-drag");
      eff.style.setProperty("--pk-f", String(fractionAt(event.clientY)));
      event.preventDefault();
      slider.focus({ preventScroll: true });
    });
    slider.addEventListener("pointermove", (event) => {
      if (event.pointerId !== dragging) return;
      eff.style.setProperty("--pk-f", String(fractionAt(event.clientY)));
    });
    slider.addEventListener("pointerup", (event) => {
      if (event.pointerId !== dragging) return;
      dragging = null;
      pick({ effort: efforts[pickerLevelAt(fractionAt(event.clientY), efforts.length)].id });
    });
    slider.addEventListener("pointercancel", (event) => {
      if (event.pointerId !== dragging) return;
      dragging = null;
      paintExperience(grid, marked());
    });
    slider.addEventListener("keydown", (event) => {
      const index = Math.max(0, efforts.findIndex((item) => item.id === marked().effort));
      const level = pickerKeyLevel(index, event.key, efforts.length);
      if (level === null) return;
      event.preventDefault();
      if (level !== index) pick({ effort: efforts[level].id });
    });

    // Style: a 3D tile per style, its radio over the whole tile; the chosen one ringed, with a Chosen badge.
    const style = group("style", "Style");
    const tiles = document.createElement("div");
    tiles.className = "pk-styles";
    for (const item of offered.styles) {
      const look = Object.prototype.hasOwnProperty.call(PICKER_STYLE_ICONS, item.id) ? item.id : "accountant";
      const tile = document.createElement("div");
      tile.className = "pk-style pk-" + look;
      const [input, label, blurb] = radio("style", item);
      const top = document.createElement("div");
      top.className = "pk-top";
      const badge = document.createElement("span");
      badge.className = "pk-badge";
      badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>Chosen';
      top.append(badge, pickerInfoButton(item.label, item.blurb, pop.id));
      const [stroke, width, shapes] = PICKER_STYLE_ICONS[look];
      const icon = document.createElement("span");
      icon.className = "pk-icon";
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="' + width
        + '" aria-hidden="true">' + shapes + "</svg>";
      tile.append(input, top, icon, label, blurb);
      tiles.append(tile);
    }
    style.append(tiles);

    grid.append(effort, style);
    paintExperience(grid, choice);
    return [grid, pop];
  }

  // The effort and style shown for the open scenario: High and Accountant when its block holds one the app does not
  // offer, and always with the gamify features off (gamifyOn).
  function shownExperience() {
    if (!gamifyOn()) return { effort: "high", style: "accountant" };
    const offered = state.info.experience;
    const experience = state.experience || {};
    const effort = offered.efforts.some((item) => item.id === experience.effort) ? experience.effort : "high";
    const style = offered.styles.some((item) => item.id === experience.style) ? experience.style : "accountant";
    return { effort, style };
  }

  // Whether the open scenario shows the Minimalist style (id "glance"): Summary then keeps each tile's secondary lines
  // and the run facts behind a Details tap. Accountant's features otherwise; never with the gamify features off.
  function glanceOn() {
    return Boolean(state.info && state.experience) && shownExperience().style === "glance";
  }

  // Mark the page with the open scenario's effort and style (data-effort and data-style on <html>, always ids the
  // app offers; neither with the gamify features off, so no cue shows) and refresh "Using defaults for N inputs".
  // Display only: never the inputs or the results.
  function applyExperience() {
    if (!state.info || !state.experience) return;
    const { effort, style } = shownExperience();
    if (gamifyOn()) {
      document.documentElement.dataset.effort = effort;
      document.documentElement.dataset.style = style;
    } else {
      delete document.documentElement.dataset.effort;
      delete document.documentElement.dataset.style;
    }
    refreshDefaultsNotice();
    gamerStyleChanged();  // the Awards chip shows only in Gamer style
  }

  // Below High, how many inputs the effort leaves at the example household's values (defaultedInputCount; an input
  // Add detail shows is not counted); hidden at High and when there are none. Follows every edit and every effort
  // change, with the line under it on the detail added (refreshDetailNotice).
  function refreshDefaultsNotice() {
    const notice = $("defaultsNotice");
    if (!notice || !state.schema || !state.inputs || !state.experience) return;
    const effort = shownExperience().effort;
    const count = effort === "high" ? 0 : defaultedInputCount(state.schema, state.inputs, state.defaults, effort,
      tierOverrides());
    notice.hidden = count === 0;
    notice.textContent = count ? "Using defaults for " + count + (count === 1 ? " input" : " inputs") : "";
    refreshDetailNotice();
  }

  // Change the open scenario's effort, style or risk comfort (`patch`: {effort}, {style} and/or {riskComfort}, each an
  // id appInfo offers, riskComfort also null for unset; others are ignored) and save the block. Risk comfort is
  // written only when it differs from the one shown, so an unknown word kept in a file is never rewritten by itself.
  function setExperience(patch) {
    const offered = state.info.experience;
    const change = {};
    if (offered.efforts.some((item) => item.id === patch.effort)) change.effort = patch.effort;
    if (offered.styles.some((item) => item.id === patch.style)) change.style = patch.style;
    if (Object.prototype.hasOwnProperty.call(patch, "riskComfort") && patch.riskComfort !== riskComfortShown()
      && (patch.riskComfort === null || (offered.riskComforts || []).some((item) => item.id === patch.riskComfort))) {
      change.riskComfort = patch.riskComfort;
    }
    if (!Object.keys(change).length) return;
    const previous = shownExperience();
    saveExperience(change);
    if (change.effort && effortRank(change.effort) > effortRank(previous.effort)) walkEffortRaised(previous.effort);
    applyExperience();
    if (change.effort && change.effort !== previous.effort) {
      lowRaiseNote(previous.effort, change.effort);  // a raise from Low: the spending number still covers housing
      renderEffortViews();
    } else if (change.style && change.style !== previous.style) {
      renderResults();  // the Next steps card shows only at Coach and Gamer
    }
    coachExperienceChanged();
  }

  // The Effort and style dialog's risk comfort group (settings mode only): one radio per answer appInfo offers, then
  // Not set; `choice.riskComfort` follows the pick.
  function riskComfortGroup(choice) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "experience-group risk-group";
    fieldset.id = "xpPick-risk";
    const legend = document.createElement("legend");
    legend.textContent = "Risk comfort";
    const lede = document.createElement("p");
    lede.className = "field-help";
    lede.textContent = (state.info.experience.riskQuestion || "How much ups and downs do you accept?") + " Coach uses "
      + "it to say which check result is better; it never changes your inputs or results.";
    fieldset.append(legend, lede);
    const items = (state.info.experience.riskComforts || []).concat([{ id: "", label: "Not set",
      blurb: "Balanced is used." }]);
    for (const item of items) {
      const row = document.createElement("label");
      row.className = "experience-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "xpPick-risk";
      input.id = "xpPick-risk-" + (item.id || "none");
      input.value = item.id;
      input.checked = (choice.riskComfort || "") === item.id;
      input.addEventListener("change", () => { if (input.checked) choice.riskComfort = item.id || null; });
      const label = document.createElement("span");
      label.className = "experience-label";
      label.textContent = item.label;
      const blurb = document.createElement("span");
      blurb.className = "experience-blurb";
      blurb.textContent = item.blurb;
      row.append(input, label, blurb);
      fieldset.append(row);
    }
    return fieldset;
  }

  // Open the picker: "settings" (from the menu: the current choice, Save keeps it and Cancel discards it),
  // "firstLaunch" (a new user's first launch: Low and Coach chosen, Continue keeps the choice) or "returning" (a
  // returning user's one showing: High and Accountant chosen, Continue keeps it). Returns a promise of the choice
  // kept ({effort, style}), or null when it was cancelled (at once, with no picker, while gamify is off).
  function openExperiencePicker(mode) {
    if (!gamifyOn()) return Promise.resolve(null);
    if (!$("experience").hidden) closeExperiencePicker(null);
    const returning = mode === "returning";
    const first = mode === "firstLaunch" || returning;  // a single Continue; Escape and the backdrop do nothing
    const active = document.activeElement;
    experiencePicker.returnFocus = active && active !== document.body ? active : null;
    experiencePicker.mode = first ? mode : "settings";
    const offered = state.info.experience;
    experiencePicker.choice = returning ? { ...offered.existingDefault }
      : first ? { ...offered.newUserDefault } : { ...shownExperience(), riskComfort: riskComfortShown() };
    const pick = (change) => Object.assign(experiencePicker.choice, change);
    if (!first) experiencePicker.choice.extras = accountantExtrasOn();
    $("experienceChoices").replaceChildren(...experienceGroups("xpPick", experiencePicker.choice, pick),
      ...(first ? [] : [riskComfortGroup(experiencePicker.choice), extrasGroup(experiencePicker.choice)]));
    if (first) $("experienceDetail").hidden = true;
    else renderDetailList();  // the detail added to the scenario, each with its Hide it
    const button = (label, className, id, onClick) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = className;
      element.id = id;
      element.textContent = label;
      element.addEventListener("click", onClick);
      return element;
    };
    const keep = () => closeExperiencePicker({ ...experiencePicker.choice });
    $("experienceActions").replaceChildren(...(first ? [button("Continue", "button", "experienceContinue", keep)]
      : [button("Cancel", "button button-quiet", "experienceCancel", () => closeExperiencePicker(null)),
        button("Save", "button", "experienceSave", keep)]));
    $("experience").hidden = false;
    $("experienceBackdrop").hidden = false;
    $("experience").querySelector(".pk-barwrap").focus();
    return new Promise((resolve) => { experiencePicker.resolve = resolve; });
  }

  // Opening or importing a scenario (`name`) whose block (`found`) holds another offered effort or style than the
  // current ones asks which to keep. Returns a promise of the block to adopt: `found` itself (also at once, with no
  // dialog, when nothing differs or there is no block to compare), or its copy with the current effort and style for
  // Keep mine; false when the user cancelled (Cancel, Escape or the backdrop). With gamify off, `found` as it is.
  function askExperience(name, found) {
    const offered = state.info.experience;
    const current = shownExperience();
    if (!gamifyOn() || !experienceDiffers(found, current, offered)) return Promise.resolve(found);
    // An import from the walkthrough's first step: the walkthrough keeps the page (#app, which holds the dialog) inert,
    // so it is lifted while the dialog shows (its backdrop covers the walkthrough) and put back unless the walkthrough
    // has closed.
    const lifted = $("app").inert;
    if (lifted) $("app").inert = false;
    return new Promise((settle) => {
      let settled = false;
      const resolve = (block) => {
        if (settled) return;
        settled = true;
        if (lifted && walk.open) $("app").inert = true;
        settle(block);
      };
      const option = (id, text, checked) => {
        const row = document.createElement("label");
        row.className = "experience-option";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "xpAsk";
        input.id = id;
        input.checked = checked;
        const label = document.createElement("span");
        label.className = "experience-label";
        label.textContent = text;
        row.append(input, label);
        return row;
      };
      const theirs = option("xpAsk-scenario", "Use the scenario's: " + experienceWords(found, offered), true);
      const mine = option("xpAsk-mine", "Keep mine: " + experienceWords(current, offered), false);
      const choices = document.createElement("div");
      choices.className = "experience-choices";
      choices.append(theirs, mine);
      openDialog({ title: "Effort and style", text: name + " was saved with a different effort or style.",
        body: [choices], focus: theirs.querySelector("input"),
        actions: [["Cancel", "button button-quiet", () => { resolve(false); return true; }, "experienceAskCancel"],
          ["Open", "button", () => {
            resolve(experienceChoice(found, current, $("xpAsk-mine").checked));
            return true;
          }, "experienceAskOpen"]] });
      dialog.onClose = () => resolve(false);  // Escape and the backdrop cancel; after Open or Cancel it does nothing
    });
  }

  // Close the picker; a kept `choice` is saved (setExperience) before the promise resolves.
  function closeExperiencePicker(choice) {
    if ($("experience").hidden) return;
    $("experience").hidden = true;
    $("experienceBackdrop").hidden = true;
    $("experienceChoices").replaceChildren();
    $("experienceActions").replaceChildren();
    if (choice) setExperience(choice);
    if (choice && typeof choice.extras === "boolean" && choice.extras !== accountantExtrasOn()) {
      setAccountantExtras(choice.extras);  // the source notes switch (56-accountant.js)
      renderResults();
    }
    const resolve = experiencePicker.resolve;
    experiencePicker.resolve = null;
    experiencePicker.mode = null;
    const back = experiencePicker.returnFocus;
    experiencePicker.returnFocus = null;
    if (back && document.contains(back)) back.focus();
    if (resolve) resolve(choice);
  }

  // Escape and the backdrop cancel the menu's picker; the start-up one waits for Continue. True when the picker
  // was open.
  function experienceEscape() {
    if ($("experience").hidden) return false;
    if (experiencePicker.mode === "settings") closeExperiencePicker(null);
    return true;
  }

  function wireExperience() {
    $("menuExperience").hidden = !gamifyOn();
    $("menuExperience").addEventListener("click", () => { closeMenu(); openExperiencePicker("settings"); });
    $("experienceBackdrop").addEventListener("click", () => experienceEscape());
    $("experience").addEventListener("keydown", (event) => trapFocus(event, $("experience")));
    // A click outside the picker's (i) buttons and description panel closes an open description.
    document.addEventListener("click", (event) => {
      if (event.target.closest && event.target.closest(".pk-info, .pk-pop")) return;
      for (const pop of document.querySelectorAll(".pk-pop:not([hidden])")) closePickerInfo(pop);
    });
  }

  // ---- Add detail: at Medium each pane and list sheet draws its Low and Medium inputs, and its Add detail row shows
  // the High ones of that pane only ----
  // The rule is the scenario's `experience.tierOverrides` (detailShown in shared.js): `pane.<panelId>` set to high is a
  // pane's Add detail; a `Type.field` key set to its own tier shows one input. Hidden is a view rule only: every value
  // is kept and runs, and nothing here edits the inputs. Changing it saves the experience block (saveExperience): no
  // run, no undo step and no unsaved mark. At Low and High the effort alone decides (the Low page ignores overrides).
  const { detailShown, detailHidden, optionShown, paneDetailOverrides } = window.WmtiShared;
  const DETAIL_LABELS_SHOWN = 3;  // labels the Add detail sentence names before "and M more"
  let drawingPane = null;  // the panel id panelSections is drawing, read by the object children it draws

  function detailEffort() {
    return shownExperience().effort;
  }

  // Whether the tier filter applies: at Medium only (High draws every input; Low draws its own page).
  function detailActive() {
    return Boolean(state.info && state.experience && state.schema) && detailEffort() === "medium";
  }

  // The open scenario's tier overrides (an empty table when it has none).
  function tierOverrides() {
    const overrides = state.experience && state.experience.tierOverrides;
    return overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {};
  }

  function paneDetailOn(paneId) {
    return paneId != null && hasOwn(tierOverrides(), "pane." + paneId) && tierOverrides()["pane." + paneId] === "high";
  }

  // The pane whose Add detail decides what is drawn now: an open sheet's (the Inputs chip it was opened from), else
  // the panel being drawn.
  function currentDetailPane() {
    return sheetOpen ? sheetOpen.paneId : drawingPane;
  }

  // Whether an input of `tier` keyed `key` (`Type.field`) is drawn on pane `paneId`; always at Low and High.
  function tierDetailShown(tier, key, paneId = currentDetailPane()) {
    if (tier == null || !detailActive()) return true;
    return detailShown(tier, detailEffort(), tierOverrides(), paneId, key);
  }

  // Whether field `child` (a schema field or derived field, with its `tier`) of an object of `typeName` is drawn.
  function detailShownFor(typeName, child, paneId = currentDetailPane()) {
    return tierDetailShown(child && child.tier, typeName + "." + (child && child.name), paneId);
  }

  // Whether a panel entry is drawn: its tier from the panel's `tiers`, its key from `keys`.
  function entryShown(panel, name) {
    if (!panel.tiers || !hasOwn(panel.tiers, name)) return true;
    return tierDetailShown(panel.tiers[name], panel.keys && hasOwn(panel.keys, name) ? panel.keys[name] : null, panel.id);
  }

  // Whether a choice `value` of field `Type.field` is offered (an option above the effort is not, unless it is held).
  function choiceShown(typeName, fieldName, value, held, paneId = currentDetailPane()) {
    if (!detailActive() || value === held) return true;
    return optionShown(state.schema, typeName + "." + fieldName, value, detailEffort(), tierOverrides(), paneId);
  }

  // The `Type.field` key of `schema.optionTiers` that select field `field` is (its name and choices match), or null.
  function optionKeyOf(field) {
    return Object.keys((state.schema && state.schema.optionTiers) || {}).find((key) => {
      const [typeName, name] = key.split(".");
      const child = name === field.name && (state.schema.types[typeName] || []).find((item) => item.name === name);
      return Boolean(child) && JSON.stringify(child.choices) === JSON.stringify(field.choices);
    }) || null;
  }

  // The Inputs chip shown now (null at Low, which has no chips).
  function selectedInputsPane() {
    if (!state.schema || lowOn()) return null;
    return inputsChip(inputsPanels().map((panel) => panel.id), state.chips.settings);
  }

  // A list sheet's fields at the effort: `shown` (the entries of `entries`, sheetFields' layout, that are drawn) and
  // `info`, the fields its pane's Add detail would add ({hidden, changed, labels}; changed: not at the field's default).
  function sheetDetail(typeName, item, entries, children, paneId) {
    const info = { hidden: 0, changed: 0, labels: [] };
    const shown = entries.filter((entry) => {
      const child = children.find((candidate) => candidate.name === entry.name);
      if (!child) return true;
      if (!detailShownFor(typeName, child, null)) {
        info.hidden += 1;
        info.labels.push(sheetLabel(typeName, entry.name, item, state.info.sheetRules) || child.label);
        if (item && !sameValue(item[entry.name], child.default)) info.changed += 1;
      }
      return detailShownFor(typeName, child, paneId);
    });
    return { shown, info };
  }

  // The Add detail sentence: what the pane's (or sheet's) hidden inputs are, and how many of them are set.
  function detailText(info, on) {
    if (on) return "Showing every input on this page.";
    const labels = info.labels.slice(0, DETAIL_LABELS_SHOWN);
    const more = info.hidden - labels.length;
    const named = labels.join(", ") + (more > 0 ? " and " + more + " more" : "");
    const text = "Shows " + info.hidden + (info.hidden === 1 ? " more input" : " more inputs") + " on this page: "
      + named + ".";
    return info.changed > 0 ? text + " " + info.changed + " of them " + (info.changed === 1 ? "is" : "are") + " set."
      : text;
  }

  // The Add detail row of a pane (`panelId`), drawn at the end of its body; `sheetInfo` ({hidden, changed, labels}) is
  // a list sheet's own count of the fields it left out. Null at Low and High and while nothing is hidden.
  function paneDetailRow(panelId, sheetInfo = null) {
    if (panelId == null || !detailActive()) return null;
    const panel = state.schema.panels.find((item) => item.id === panelId);
    const info = sheetInfo || (panel ? detailHidden(state.schema, panel, detailEffort(), tierOverrides(), state.inputs,
      state.defaults) : null);
    if (!info || !info.hidden) return null;
    const on = paneDetailOn(panelId);
    const row = document.createElement("div");
    row.className = "detail-row";
    row.dataset.detailPane = panelId;
    const text = document.createElement("p");
    text.className = "note detail-text";
    text.textContent = detailText(info, on);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-quiet detail-toggle";
    button.textContent = on ? "Hide detail" : "Add detail";
    button.setAttribute("aria-pressed", String(on));
    button.addEventListener("click", () => setPaneDetail(panelId, !on, Boolean(row.closest("#sheetBody"))));
    row.append(text, button);
    return row;
  }

  // Turn a pane's Add detail on or off, redraw what shows it (the open sheet, Inputs and Setup) and put the focus back
  // on the row's button.
  function setPaneDetail(paneId, on, inSheet = false) {
    saveExperience({ tierOverrides: paneDetailOverrides(tierOverrides(), paneId, on) });
    redrawDetail();
    const scope = inSheet ? $("sheetBody") : document;
    const button = scope.querySelector(".detail-row[data-detail-pane=\"" + paneId + "\"] .detail-toggle");
    if (button) button.focus({ preventScroll: true });
  }

  // Remove every override (the Hide it under "Using defaults for N inputs").
  function clearAddedDetail() {
    saveExperience({ tierOverrides: {} });
    redrawDetail();
  }

  function redrawDetail() {
    renderSettings();
    if (sheetOpen && !timelineFlow) refreshForm();
    refreshDefaultsNotice();
  }

  // Under "Using defaults for N inputs": below High, while the scenario has overrides, how many there are and a Hide it
  // button that clears them.
  function refreshDetailNotice() {
    const notice = $("detailNotice");
    if (!notice || !state.experience) return;
    const count = Object.keys(tierOverrides()).length;
    const shown = count > 0 && Boolean(state.info) && detailEffort() !== "high";
    notice.hidden = !shown;
    if (!shown) {
      notice.replaceChildren();
      return;
    }
    const text = document.createElement("span");
    text.textContent = count === 1 ? "Detail added on 1 page or input. " : "Detail added on " + count
      + " pages and inputs. ";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-quiet detail-clear";
    button.textContent = "Hide it";
    button.addEventListener("click", clearAddedDetail);
    notice.replaceChildren(text, button);
  }
  // ---- Low effort: the spending number that covers housing, cars and loans, and the effort-change hook ----
  // At Low the one monthly spending number counts rent or mortgage, car and loan payments, property taxes and
  // utilities (wmti.dashboard.lowcover). The backend clears what is still the example household's when the spending
  // question is answered at Low (walkthroughApply with effort "low"); anything else the plan counts on top of the
  // number is shown with Remove them (lowCoverClear: one undo step). Effort never edits the inputs by itself.
  const low = { gen: 0, facts: null, factsTurn: 0, queue: Promise.resolve(), noteTurn: 0, tree: null, index: null };

  // Whether the open scenario is at Low effort. `lowShown` (the Low results' check) is used when the page has it.
  function lowOn() {
    if (typeof lowShown === "function") return lowShown();
    return Boolean(state.experience && state.info) && shownExperience().effort === "low";
  }

  // The spending question's hint at Low: the "leave them out" wording while the plan counts items on top of the
  // number that are not the untouched example's (those are cleared on the answer), else the "count everything" one.
  // At Medium and High the question's own hint.
  function spendingHint(node, facts) {
    if (!lowOn() || !node.hintLow) return node.hint;
    return facts && lowCovered(facts) && node.hintLowCovered ? node.hintLowCovered : node.hintLow;
  }

  // Whether the plan counts homes, rent periods, cars, loans or utilities on top of a Low spending number that the
  // answer does not clear by itself (Remove them is offered).
  function lowCovered(facts) {
    return Boolean(facts) && facts.coveredCount > 0 && !facts.coveredExample;
  }

  // Remove them: drop every home, rent period, car and loan and zero the utility bills (lowCoverClear), as one undo
  // step. Returns the reply (its `facts` are the new inputs'), or null when it was refused.
  async function removeCovered() {
    const current = inputsTicket();
    const reply = await ask("lowCoverClear", [JSON.stringify(state.inputs)]);
    if (!reply || !reply.ok || !current()) return null;  // !current(): an edit came after; this answer would undo it
    state.inputs = reply.inputs;
    low.facts = reply.facts;
    renderSettings();
    inputsChanged();
    return reply;
  }

  // "Skip for now" at Low: the example household's home, cars and loans go as they do on a spending answer, so its
  // property tax is not counted on top of the example's spending (walkthroughApply skip at Low).
  async function lowSkipClear() {
    if (!lowOn()) return;
    const current = inputsTicket();
    const reply = await ask("walkthroughApply", [JSON.stringify(state.inputs), "spending", "null", "skip", "low"]);
    if (!reply || !reply.ok || !reply.changed || !reply.changed.length || !current()) return;
    state.inputs = reply.inputs;
    renderSettings();
    inputsChanged();
  }

  // The note on Setup (#lowRaiseNote) after a raise from Low while the plan has no home, car or loan: the spending
  // number still covers them. It goes on the next effort change and is never stored.
  const LOW_RAISE_NOTE = "Your monthly spending counts housing, cars and loans because none are entered. Lower it by "
    + "what you add.";
  // The same note on the walkthrough screens a raise from Low unlocks that add a home, a mortgage, cars or loans.
  const LOW_RAISE_SCREENS = ["homes", "mortgage", "cars", "loansMore"];

  async function lowRaiseNote(previous, effort) {
    const note = $("lowRaiseNote");
    const turn = ++low.noteTurn;
    if (!note) return;
    note.hidden = true;
    note.textContent = "";
    if (previous !== "low" || effortRank(effort) <= effortRank("low")) return;
    const reply = await ask("walkthroughPlan", [JSON.stringify(state.inputs), "[]", "medium"]);
    if (turn !== low.noteTurn || !reply || !reply.ok || !reply.facts || reply.facts.coveredCount !== 0) return;
    note.textContent = LOW_RAISE_NOTE;
    note.hidden = false;
  }

  // Redraw every view that depends on the effort (Inputs, the Summary, the band and the run bar); called wherever the
  // open scenario's effort is set.
  function renderEffortViews() {
    renderSettings();
    renderResults();
    renderBand();
    renderMcBar();
    refreshDefaultsNotice();
  }

  // ---- The Low page: the Inputs tab at Low effort ----
  // One card per topic (#lowPage, each `data-low-card`), in this order. Plain fields (ages, filing status, state, pay)
  // are the schema's own controls (fieldElement: the normal edit path, undo and runs); the answers that change the
  // shape of the inputs (partner, spending, balances, children, the two plans) go through walkthroughApply at Low
  // (lowApply), commit when the box is left (or on Enter) and redraw only their own cards. The spending, children's
  // ages and the plans' summaries come from the walkthrough's facts: no money rule is worked out here.
  const LOW_CARDS = [["about", "About you"], ["pay", "Pay"], ["spending", "Spending"], ["savings", "Savings"],
    ["children", "Children"], ["retirement", "Retirement plan"], ["medical", "Medical plan"], ["more", "More detail"]];
  const LOW_FACT_CARDS = ["spending", "children", "retirement", "medical"];  // drawn again when the facts arrive
  const LOW_MORE_TEXT = "Homes, cars, loans and more detail are in Medium effort. At Low your spending number covers "
    + "housing, cars and loans, and what you are worth leaves out the value of a home.";
  const LOW_BALANCES_NOTE = "You have more than one account of a kind; change them at Medium effort.";

  // The tree's question `id` (its node), or null.
  function lowNode(id) {
    if (!state.walkTree) return null;
    if (low.tree !== state.walkTree) {
      low.tree = state.walkTree;
      low.index = walkIndex(state.walkTree);
    }
    return low.index[id] ? low.index[id].node : null;
  }

  // Leave the Low page (Medium and High): the Inputs tab's groups come back.
  function hideLowPage() {
    const page = $("lowPage");
    if (page && !page.hidden) {
      page.hidden = true;
      page.replaceChildren();
    }
    $("settings-body").hidden = false;
    $("app").classList.remove("low-effort");
  }

  // Draw the Low page in place of the Inputs groups, then ask for the facts and draw the cards that show them.
  function renderLowPage() {
    const gen = ++low.gen;
    $("settings-body").hidden = true;
    $("settings-body").replaceChildren();
    $("app").classList.add("low-effort");
    const page = $("lowPage");
    page.hidden = false;
    page.replaceChildren(...LOW_CARDS.map(([id, title]) => {
      const card = document.createElement("section");
      card.className = "card low-card";
      card.id = "lowCard-" + id;
      card.dataset.lowCard = id;
      card.setAttribute("aria-label", title);
      return card;
    }));
    for (const [id] of LOW_CARDS) renderLowCard(id);
    lowFacts().then((facts) => {
      if (gen !== low.gen || !facts) return;
      for (const id of LOW_FACT_CARDS) {
        const card = $("lowCard-" + id);
        if (card && !card.contains(document.activeElement)) renderLowCard(id);
      }
    });
  }

  // The walkthrough's facts for the open inputs at Low; only the latest of overlapping calls is kept (null for an
  // older one, or when the inputs give none).
  async function lowFacts() {
    const turn = ++low.factsTurn;
    const reply = await ask("walkthroughPlan", [JSON.stringify(state.inputs), "[]", "low"]);
    if (turn !== low.factsTurn || !reply || !reply.ok) return null;
    low.facts = reply.facts;
    return reply.facts;
  }

  // Draw one card again from the open inputs and facts; a box that had focus gets it back.
  function renderLowCard(id) {
    const card = $("lowCard-" + id);
    if (!card) return;
    const focused = card.contains(document.activeElement) ? document.activeElement.id : null;
    const heading = document.createElement("h2");
    heading.textContent = (LOW_CARDS.find((item) => item[0] === id) || [id, id])[1];
    const error = document.createElement("p");
    error.className = "field-error low-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    card.replaceChildren(heading, ...LOW_CARD_BUILDERS[id]().filter(Boolean), error);
    if (focused && $(focused) && card.contains($(focused))) $(focused).focus({ preventScroll: true });
  }

  function lowError(cardId, text) {
    const line = document.querySelector("#lowCard-" + cardId + " .low-error");
    if (!line) return;
    line.hidden = !text;
    line.textContent = text || "";
  }

  // Write one answer at Low (walkthroughApply), after any answer still on its way; the reply's cards are drawn again.
  // An answer whose page was drawn again since (an undo, another scenario, an effort change) is dropped. Returns the
  // reply, or null when it was refused (its message under the card) or dropped.
  function lowApply(questionId, values, cardId, cards) {
    const gen = low.gen;
    const run = async () => {
      if (gen !== low.gen || !lowOn()) return null;
      lowError(cardId, null);
      const current = inputsTicket();
      const reply = await ask("walkthroughApply", [JSON.stringify(state.inputs), questionId, JSON.stringify(values),
        "answer", "low"]);
      if (gen !== low.gen || !lowOn() || !current()) return null;  // !current(): an edit came after; it wins
      if (!reply || !reply.ok) {
        lowError(cardId, reply ? reply.error : "The answer was not saved; try again.");
        return null;
      }
      state.inputs = reply.inputs;
      low.facts = reply.facts;
      if (reply.changed && reply.changed.length) inputsChanged();
      for (const id of cards || [cardId]) renderLowCard(id);
      return reply;
    };
    const next = low.queue.then(run, run);
    low.queue = next.catch(() => null);
    return next;
  }

  // A schema field drawn as on the Inputs groups, under the Low page's own label; null when the schema has none.
  function lowSchemaField(path, label) {
    const field = panelField(state.schema, path);
    return field ? fieldElement({ ...field, label }, path) : null;
  }

  // A Yes/No choice (segmented); `onPick` gets true or false when the other one is tapped.
  function lowYesNo(id, label, value, onPick) {
    const wrap = fieldShell(label, null, null);
    const group = document.createElement("div");
    group.className = "segmented low-yes-no";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    group.id = id;
    for (const [choice, text] of [[true, "Yes"], [false, "No"]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.choice = String(choice);
      button.textContent = text;
      button.setAttribute("aria-pressed", String(choice === value));
      button.addEventListener("click", () => { if (choice !== value) onPick(choice); });
      group.append(button);
    }
    wrap.append(group);
    return wrap;
  }

  // A number box that commits when it is left or on Enter (not on each keystroke): an empty, malformed or
  // out-of-bounds number shows its message under the box and commits nothing. `disabled` shows it read-only;
  // `shownLabel` (a guided step's question) is shown in place of the field's label, which the messages keep.
  function lowNumber(id, field, value, onCommit, disabled, shownLabel) {
    const wrap = fieldShell(shownLabel || field.label, null, id);
    let next = value;
    wrap.append(numberInput(id, { ...field, nullable: false }, value, (number) => { next = number; }));
    const input = wrap.querySelector("input");
    const problem = wrap.querySelector(".field-error");
    input.disabled = Boolean(disabled);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); input.blur(); } });
    input.addEventListener("change", () => {
      if (input.getAttribute("aria-invalid") === "true") return;
      const bounds = walkBoundsError(field, next, null);
      if (bounds) {
        input.setAttribute("aria-invalid", "true");
        problem.hidden = false;
        problem.textContent = bounds;
        return;
      }
      if (!sameValue(next, value)) onCommit(next);
    });
    return wrap;
  }

  // A plan's short summary with Change (the guided sheet), shown while the plan is on.
  function lowSummary(kind, text) {
    if (!text) return null;
    const holder = document.createElement("div");
    holder.className = "low-summary";
    holder.dataset.summary = kind;
    const line = document.createElement("p");
    line.className = "low-summary-text";
    line.textContent = text;
    const change = document.createElement("button");
    change.type = "button";
    change.className = "button button-quiet";
    change.id = "low-" + kind + "-change";
    change.textContent = "Change";
    change.setAttribute("aria-label", "Change the " + kind + " plan");
    change.addEventListener("click", () => openGuidedPlan(kind));
    holder.append(line, change);
    return holder;
  }

  const LOW_CARD_BUILDERS = {
    about() {
      const partner = state.inputs.partner != null;
      return [lowSchemaField("you.currentAge", "Your age"),
        lowYesNo("low-partner", "Is a partner part of this plan?", partner,
          (hasPartner) => lowApply("partner", { hasPartner }, "about", ["about", "pay", "retirement"])),
        partner ? lowSchemaField("partner.currentAge", "Partner age") : null,
        partner ? lowSchemaField("filingStatus", "Filing status") : null,
        lowSchemaField("homeState", "State")];
    },
    pay() {
      return [lowSchemaField("you.salary", "Your yearly pay"),
        state.inputs.partner != null ? lowSchemaField("partner.salary", "Partner's yearly pay") : null];
    },
    spending() {
      const facts = low.facts;
      const node = lowNode("spending");
      const items = [lowNumber("low-spending", { kind: "number", unit: "money", label: "Monthly spending",
        minimum: 0, maximum: null }, facts ? Math.round(facts.monthlySpending) : null,
      (total) => lowApply("spending", { total }, "spending"))];
      const hint = node && facts ? spendingHint(node, facts) : null;
      if (hint) {
        const line = document.createElement("p");
        line.className = "note low-hint";
        line.textContent = walkHint(hint.template, facts);
        items.push(line);
      }
      if (lowCovered(facts)) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button button-quiet";
        remove.id = "lowRemoveCovered";
        remove.textContent = "Remove them";
        remove.addEventListener("click", async () => {
          remove.disabled = true;
          if (!(await removeCovered())) {
            remove.disabled = false;
            lowError("spending", "They were not removed; try again.");
          }
        });
        const or = document.createElement("p");
        or.className = "note";
        or.textContent = "or raise effort to Medium to edit them.";
        items.push(remove, or);
      }
      return items;
    },
    savings() {
      const node = lowNode("balances");
      if (!node) return [];
      let shared = false;
      const items = node.fields.map((field, index) => {
        const kind = (/^accounts\[(.+)\]\./.exec(field.path) || [])[1];
        const several = (state.inputs.accounts || []).filter((account) => account.kind === kind).length > 1;
        shared = shared || several;
        const current = walkRead(state.inputs, field.path);
        return lowNumber("low-balance-" + index, field, current == null ? 0 : current,
          (value) => lowApply("balances", { [field.path]: value }, "savings"), several);
      });
      if (shared) {
        const note = document.createElement("p");
        note.className = "note low-balances-note";
        note.textContent = LOW_BALANCES_NOTE;
        items.push(note);
      }
      return items;
    },
    children() {
      const children = state.inputs.children || [];
      const countNode = lowNode("children") || {};
      const agesNode = lowNode("childAges") || {};
      const items = [lowYesNo("low-children", "Do you have children, or expect any?", children.length > 0,
        (yes) => lowApply("children", { count: yes ? 1 : 0 }, "children"))];
      if (!children.length) return items;
      items.push(lowNumber("low-child-count", { kind: "integer", unit: "count", label: "How many children",
        minimum: Math.max(1, countNode.minimum || 0), maximum: countNode.maximum ?? null }, children.length,
      (count) => lowApply("children", { count }, "children")));
      const age = state.inputs.you.currentAge;
      const ages = low.facts && Array.isArray(low.facts.childAges) && low.facts.childAges.length === children.length
        ? low.facts.childAges.slice() : children.map((child) => (age == null ? null : age - child.yourAgeAtBirth));
      children.forEach((child, index) => {
        items.push(lowNumber("low-child-age-" + index, { kind: "integer", unit: "age",
          label: (child.name || "Child " + (index + 1)) + ": age", minimum: agesNode.minimum ?? null,
          maximum: age ?? null }, ages[index], (value) => {
          const next = ages.slice();
          next[index] = value;
          lowApply("childAges", { ages: next }, "children");
        }));
      });
      const hint = agesNode.hint ? document.createElement("p") : null;
      if (hint) {
        hint.className = "note";
        hint.textContent = agesNode.hint.template;
        items.push(hint);
      }
      return items;
    },
    retirement() {
      return lowPlanCard("retirement", "plan401k", null, low.facts && low.facts.retirementSummary);
    },
    medical() {
      return lowPlanCard("medical", "medicalPlan", "Do you have a medical plan before Medicare?",
        low.facts && low.facts.medicalSummary);
    },
    more() {
      const text = document.createElement("p");
      text.className = "note";
      text.textContent = LOW_MORE_TEXT;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-quiet";
      button.id = "lowChangeEffort";
      button.textContent = "Change effort";
      button.addEventListener("click", () => openExperiencePicker("settings"));
      return [text, button];
    },
  };

  // A plan card: its Yes/No switch (the tree question `questionId`) and, while it is on, its summary with Change.
  // Yes turns the plan on (one undo step) and opens its guided sheet; No turns it off and keeps its other values.
  function lowPlanCard(kind, questionId, label, summary) {
    const node = lowNode(questionId);
    if (!node) return [];
    const path = node.fields[0].path;
    const on = Boolean(walkRead(state.inputs, path));
    return [lowYesNo("low-" + kind + "-plan", label || walkText(node, "prompt"), on, async (yes) => {
      const reply = await lowApply(questionId, { [path]: yes }, kind);
      if (reply && yes) await openGuidedPlan(kind);
    }), on ? lowSummary(kind, summary) : null];
  }

  // ---- Guided plan setups: one scrolling pop-up per plan (walkthroughTree's `guided`) ----
  // The sheet works on a copy of the inputs: a live summary at the top, then the plan's steps that apply (the
  // walkthrough's Medium plan of the copy decides, so a follow-up shows only after its Yes), each answer checked by
  // walkthroughApply. Save keeps the copy as one undo step; Cancel, Escape and the backdrop discard it. Over the
  // walkthrough the page is lifted from inert while it shows (as askExperience). Returns a promise of whether it was
  // saved.
  function openGuidedPlan(kind) {
    const plan = state.walkTree && (state.walkTree.guided || []).find((item) => item.id === kind);
    if (!plan) return Promise.resolve(false);
    const sheet = { plan, working: clone(state.inputs), turn: 0, queue: Promise.resolve(), saved: false };
    sheet.summary = document.createElement("div");
    sheet.summary.className = "low-summary guided-summary";
    sheet.summary.setAttribute("role", "status");
    sheet.summary.innerHTML = "<p class=\"low-summary-text\" id=\"guidedSummary\"></p>";
    sheet.steps = document.createElement("div");
    sheet.steps.className = "guided-steps";
    sheet.steps.id = "guidedSteps";
    const lifted = $("app").inert;
    if (lifted) $("app").inert = false;
    return new Promise((settle) => {
      openDialog({ title: plan.title, text: "", body: [sheet.summary, sheet.steps],
        actions: [["Cancel", "button button-quiet", () => true, "guidedCancel"],
          ["Save", "button", async () => {
            await sheet.queue;
            if (sheet.steps.querySelector("[aria-invalid=true]")) {
              dialogError("Fix the answer marked above, or tap Cancel.");
              return false;
            }
            sheet.saved = true;
            if (!sameValue(sheet.working, state.inputs)) {
              state.inputs = sheet.working;
              renderSettings();
              inputsChanged();
            }
            return true;
          }, "guidedSave"]] });
      dialog.onClose = () => {  // Save, Cancel, Escape and the backdrop all close here
        if (lifted && walk.open) $("app").inert = true;
        settle(sheet.saved);
      };
      guidedRefresh(sheet);
    });
  }

  // Draw the sheet's summary and the steps that apply to its copy; only the latest of overlapping refreshes is drawn,
  // and a box that had focus gets it back.
  async function guidedRefresh(sheet) {
    const turn = ++sheet.turn;
    const reply = await ask("walkthroughPlan", [JSON.stringify(sheet.working), "[]", "medium"]);
    if (turn !== sheet.turn || !sheet.steps.isConnected) return;
    const facts = reply && reply.ok ? reply.facts : null;
    sheet.summary.querySelector("p").textContent = (facts && facts[sheet.plan.id + "Summary"]) || "";
    const planned = reply && reply.ok ? reply.questions.map((row) => row.id) : [];
    const focused = sheet.steps.contains(document.activeElement) ? document.activeElement.id : null;
    sheet.steps.replaceChildren(...sheet.plan.steps.filter((id) => planned.includes(id))
      .map((id) => guidedStep(sheet, id)).filter(Boolean));
    if (focused && $(focused)) $(focused).focus({ preventScroll: true });
  }

  // One step of the sheet: a Yes/No for a switch, else a number box; its answer's message shows under it.
  function guidedStep(sheet, id) {
    const node = lowNode(id);
    if (!node || !node.fields.length) return null;
    const field = node.fields[0];
    const holder = document.createElement("div");
    holder.className = "guided-step";
    holder.dataset.step = id;
    const current = walkRead(sheet.working, field.path);
    const answer = (value) => guidedAnswer(sheet, id, { [field.path]: value });
    holder.append(field.kind === "toggle" ? lowYesNo("guided-" + id, node.prompt, Boolean(current), answer)
      : lowNumber("guided-" + id, field, current == null ? null : current, answer, false, node.prompt));
    if (node.hint && !node.hint.fact) {
      const hint = document.createElement("p");
      hint.className = "note";
      hint.textContent = node.hint.template;
      holder.append(hint);
    }
    const error = document.createElement("p");
    error.className = "field-error guided-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    holder.append(error);
    return holder;
  }

  // Write one step's answer to the sheet's copy (after any answer still on its way), then draw the sheet again; a
  // refused answer keeps the copy and shows its message under the step.
  function guidedAnswer(sheet, id, values) {
    const run = async () => {
      const reply = await ask("walkthroughApply", [JSON.stringify(sheet.working), id, JSON.stringify(values),
        "answer", "low"]);
      if (!sheet.steps.isConnected) return;
      if (!reply || !reply.ok) {
        const line = sheet.steps.querySelector("[data-step=\"" + id + "\"] .guided-error");
        if (line) {
          line.hidden = false;
          line.textContent = reply ? reply.error : "The answer was not saved; try again.";
        }
        return;
      }
      sheet.working = reply.inputs;
      dialogError(null);
      await guidedRefresh(sheet);
    };
    sheet.queue = sheet.queue.then(run, run);
    return sheet.queue;
  }

  // ---- Surfacing: show and open one lever's inputs at any effort (the hook the Coach prompts call) ----
  // A lever is an id of the settings schema's `surface` (wmti.dashboard.tiers.SURFACE_TARGETS): each input it names
  // comes with the chain of holders up to its panel entry, built in Python. Surfacing writes each chain key not shown
  // at the effort into `experience.tierOverrides` at its own tier (surfaceOverrides), through saveExperience: no run,
  // no undo step and no unsaved mark. The Effort and style dialog lists the overrides, each with its Hide it.
  const { surfaceOverrides, surfacePath, walkIndexedPath, overrideList } = window.WmtiShared;
  window.wmtiSurface = { surfaceField, jumpToField };  // for the tests and for debugging

  // A lever's targets (a list of surfaceChain dicts), or null for an unknown lever id.
  function surfaceTarget(leverId) {
    const surface = state.schema && state.schema.surface;
    if (!surface || typeof leverId !== "string" || !hasOwn(surface, leverId)) return null;
    const targets = surface[leverId];
    return Array.isArray(targets) && targets.length ? targets : null;
  }

  // The lever whose first input is drawn at input path `path` ({id, itemPath}; `itemPath` the list item, such as
  // `children.0`, when the input is inside one), or null when no lever opens there.
  function surfaceLeverFor(path) {
    for (const id of Object.keys((state.schema && state.schema.surface) || {})) {
      const target = surfaceTarget(id) && surfaceTarget(id)[0];
      if (!target || typeof target.entry !== "string") continue;
      const item = path.startsWith(target.entry + ".") ? /^\d+/.exec(path.slice(target.entry.length + 1)) : null;
      const itemPath = item ? target.entry + "." + item[0] : undefined;
      if (surfacePath(target, itemPath) === path) return { id, itemPath };
    }
    return null;
  }

  // Show a lever's inputs at the open scenario's effort, kept in its overrides. False (and nothing changes) for an
  // unknown lever and at Low, whose page has no such inputs; true otherwise (at High nothing needs adding).
  function surfaceField(leverId) {
    const targets = surfaceTarget(leverId);
    if (!targets || !state.experience || lowOn()) return false;
    const additions = surfaceOverrides(targets, detailEffort(), tierOverrides());
    if (Object.keys(additions).length) {
      saveExperience({ tierOverrides: Object.assign({}, tierOverrides(), additions) });
      redrawDetail();
    }
    return true;
  }

  // Surface a lever and open its first input on Inputs: its chip, the list item's sheet when `itemPath` names one
  // (such as `children.0`), the field scrolled into view, flashed and focused. `path`, when given, is the input path
  // to open instead of the lever's first (a partner's match entry). False (and nothing changes) at Low and for an
  // unknown lever.
  function jumpToField(leverId, itemPath, path) {
    const targets = surfaceTarget(leverId);
    if (!targets || !surfaceField(leverId)) return false;
    openInputsField(typeof path === "string" && path ? path : surfacePath(targets[0], itemPath), targets[0].panel);
    return true;
  }

  // Bring input `path` into view on its page (the Inputs chip `chip`, or Setup or Strategy for their panels, else the
  // first page that draws it): a list
  // row's sheet is opened when the input is inside one, and the input flashes and takes the focus. False when no page
  // draws it.
  function openInputsField(path, chip) {
    const place = chip ? { tab: paneTab(chip), chip } : undonePlaces(path)[0];
    if (!path || !place) return false;
    if (sheetOpen) closeSheet(true);
    if (place.tab === "inputs" && state.chips.settings !== place.chip) {
      state.chips.settings = place.chip;
      savePrefs();
      renderSettings();
    }
    goToPane(place.tab);
    revealField(path);  // a folded panel opens first
    let found = drawnField(path, document);
    if (found && found.row) {
      found.element.click();  // opens the row's sheet
      found = drawnField(path, $("sheet")) || found;
    }
    if (!found) return true;
    const shut = found.element.closest("details:not([open])");  // Advanced settings
    if (shut) shut.open = true;
    const target = flashField(found.element);
    target.scrollIntoView({ block: "center" });
    const control = found.element.matches("input, select, textarea, button") ? found.element
      : target.querySelector("input, select, textarea, button");
    if (control) control.focus({ preventScroll: true });
    return true;
  }

  // The Effort and style dialog's list of the detail added to the open scenario (its tierOverrides), each with a Hide
  // it button that removes that one; empty when there is none.
  function renderDetailList() {
    const holder = $("experienceDetail");
    if (!holder) return;
    const items = state.schema && state.experience ? overrideList(state.schema, tierOverrides()) : [];
    holder.hidden = !items.length;
    if (!items.length) {
      holder.replaceChildren();
      return;
    }
    const heading = document.createElement("h3");
    heading.className = "eyebrow";
    heading.textContent = "Detail added";
    const lede = document.createElement("p");
    lede.className = "note";
    lede.textContent = "Inputs shown beyond what Medium shows. Hide it puts one back; its value is kept.";
    const list = document.createElement("ul");
    list.className = "detail-list";
    for (const { key, label } of items) {
      const row = document.createElement("li");
      row.className = "detail-list-row";
      const text = document.createElement("span");
      text.textContent = label;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-quiet detail-hide";
      button.dataset.overrideKey = key;
      button.textContent = "Hide it";
      button.setAttribute("aria-label", "Hide " + label);
      button.addEventListener("click", () => hideAddedDetail(key));
      row.append(text, button);
      list.append(row);
    }
    holder.replaceChildren(heading, lede, list);
  }

  // Remove one override (a row's Hide it in the Effort and style dialog), redraw what it showed and keep the focus in
  // the dialog.
  function hideAddedDetail(key) {
    const kept = Object.fromEntries(Object.entries(tierOverrides()).filter(([name]) => name !== key));
    saveExperience({ tierOverrides: kept });
    redrawDetail();
    renderDetailList();
    const next = $("experienceDetail").querySelector(".detail-hide") || $("experience").querySelector(".pk-barwrap");
    if (next) next.focus();
  }
  // ---- Coach: the Next steps card on Summary (Coach and Gamer styles) ----
  // wmti.dashboard.coach finds a short ranked list of gaps from the inputs alone (coachGaps: no run, so the card shows
  // before any Monte Carlo); the card draws up to MAX_NEXT_STEPS not dismissed. Each gap has Show me where
  // (jumpToField), Not now (kept in `experience.progress`), and, when it has a sweep, Check what it is worth: a short
  // batched job ("leverSweep", wmti.dashboard.leversweep) on the same random draws with progress and Cancel. Its result
  // is kept with the inputs, sweep, person, score preset and seed it ran on (coachSweepKey); Apply writes its
  // changes through applyOptimum as one Undo step. Nothing here changes an input until Apply is tapped. Risk comfort
  // (the Effort and style dialog) only picks the sweep's score preset.
  const { coachGapsShown, coachDismissKey, coachDismissed, coachSweepKey, riskPresetOf, coachChangeText } =
    window.WmtiShared;
  const MAX_NEXT_STEPS = 3;  // wmti.dashboard.coach.MAX_NEXT_STEPS
  const COACH_STOPPED = {  // why a running check ended without a result, by what stopped it
    user: "Cancelled. Nothing changed.",
    background: "Stopped while the app was in the background. Check it again.",
    dropped: "Another run replaced this check. Check it again.",
  };
  const coachTurn = { gaps: 0 };
  window.wmtiCoach = { state: () => state.coach, runLeverSweep, applyLeverSweep };  // for the tests

  // Whether Summary shows the Next steps card: Coach or Gamer style, on a plan that has its ages.
  function coachOn() {
    if (!state.info || !state.experience || !state.inputs || needsSetup(state.inputs)) return false;
    const style = shownExperience().style;
    return style === "coach" || style === "gamer";
  }

  // The open scenario's risk comfort: an id appInfo offers, else null (unset; an unknown word is never rewritten).
  function riskComfortShown() {
    const offered = (state.info && state.info.experience && state.info.experience.riskComforts) || [];
    const value = state.experience && state.experience.riskComfort;
    return offered.some((item) => item.id === value) ? value : null;
  }

  // The score preset a sweep uses: risk comfort's, else balanced.
  function coachPreset() {
    return riskPresetOf(state.info && state.info.experience && state.info.experience.riskComforts, riskComfortShown());
  }

  // Ask for the gaps of the current inputs (one request in flight, a newer one replaces it); the card is redrawn when
  // they arrive.
  async function loadCoachGaps() {
    const coach = state.coach;
    if (!coachOn()) return;
    const inputsText = JSON.stringify(state.inputs);
    if (coach.gapsKey === inputsText || coach.pendingKey === inputsText) return;
    coach.pendingKey = inputsText;
    const turn = ++coachTurn.gaps;
    if (!state.optimize.info) loadOptimizeInfo();  // the not-advice note the card carries
    const reply = await ask("coachGaps", [inputsText], "coach");
    if (turn !== coachTurn.gaps) return;
    coach.pendingKey = null;
    if (!reply) return;
    coach.gaps = reply.ok && Array.isArray(reply.gaps) ? reply.gaps : [];
    coach.gapsKey = inputsText;
    renderResults();  // the card, and the Insights line it stands in for
  }

  // The gaps the card draws now ({shown, hidden}, coachGapsShown), with any applied gap that the rules no longer list
  // kept in place so its Undo stays in reach.
  function coachShown() {
    const coach = state.coach;
    const experience = state.experience || {};
    const found = coachGapsShown(coach.gaps || [], { effort: shownExperience().effort,
      dismissed: coachDismissed(experience.progress), max: MAX_NEXT_STEPS });
    const listed = new Set(found.shown.map((gap) => gap.id));
    for (const [id, entry] of Object.entries(coach.entries)) {
      if (entry && entry.gap && !listed.has(id) && coachApplied(entry)) found.shown.push(entry.gap);
    }
    return found;
  }

  // The roles whose match gap the card shows (the Insights card leaves out their unused-match line).
  function coachMatchRoles() {
    if (!coachOn()) return [];
    return coachShown().shown.filter((gap) => gap.rule === "match" || /^match_/.test(gap.id))
      .map((gap) => (gap.sweep && gap.sweep.who) || gap.id.replace(/^match_/, ""));
  }

  function coachGap(gapId) {
    const listed = (state.coach.gaps || []).find((gap) => gap.id === gapId);
    const entry = state.coach.entries[gapId];
    return listed || (entry && entry.gap) || null;
  }

  // The key a gap's sweep would run under now.
  function coachKeyNow(gap) {
    return coachSweepKey(JSON.stringify(state.inputs), gap.sweep.id, gap.sweep.who, coachPreset(), state.seed);
  }

  function coachApplied(entry) {
    return entry.appliedText != null && entry.appliedText === JSON.stringify(state.inputs);
  }

  function coachStale(entry, gap) {
    return !coachApplied(entry) && (!gap || !gap.sweep || entry.key !== coachKeyNow(gap));
  }

  // Why Check what it is worth cannot run now, or null: one batched job runs at a time.
  function coachBusyReason(gapId) {
    if (state.coach.job) return state.coach.job.gapId === gapId ? null : "Another check is running.";
    if (state.error) return "Fix the settings first.";
    if (state.mc.job) return "Waiting for the Monte Carlo to finish.";
    if (state.compare.job) return "Waiting for the comparison to finish.";
    if (state.optimize.job) return "Waiting for the strategy search to finish.";
    if (reportRun.busy) return "Waiting for the report to finish.";
    return null;
  }

  // The Next steps card's HTML ("" when it is not drawn); renderResults puts it in #nextSteps and wireNextSteps wires it.
  function renderNextSteps() {
    if (!coachOn()) return "";
    loadCoachGaps();
    const { shown, hidden } = coachShown();
    if (!shown.length && !hidden.length) return "";
    const notAdvice = state.optimize.info && state.optimize.info.notAdvice;
    return "<div class=\"card nextsteps-card\" id=\"nextStepsCard\"><div class=\"card-head\"><h2>Next steps</h2></div>"
      + (shown.length ? "<ul class=\"nextsteps-list\">" + shown.map(nextStepHtml).join("") + "</ul>"
        : "<p class=\"field-help\">Every next step is hidden.</p>")
      + (hidden.length ? "<button type=\"button\" class=\"button button-quiet nextsteps-hidden\" id=\"nextStepsHidden\">"
        + "Show " + hidden.length + " hidden</button>" : "")
      + riskComfortLinkHtml()
      + (notAdvice ? "<p class=\"field-help nextsteps-note\">" + escapeText(notAdvice) + "</p>" : "") + "</div>";
  }

  // One gap's row, top to bottom: its title and text (what is missing); the kept check's result in its "Checked:" box
  // right under it (or why the last check ended without one); one row of compact buttons (Show me where, Check, Not
  // now, then Apply, or Applied and Undo, once a check offers it); the running check's progress; What was tried last.
  function nextStepHtml(gap) {
    const id = escapeText(gap.id);
    const low = lowOn();
    const busy = coachBusyReason(gap.id);
    const running = state.coach.job && state.coach.job.gapId === gap.id;
    const buttons = [];
    if (low && gap.lowGuide) {
      buttons.push("<button type=\"button\" class=\"button nextstep-guide\" data-gap=\"" + id + "\">Open the "
        + "retirement setup</button>");
    } else if (!low && gap.jump) {
      buttons.push("<button type=\"button\" class=\"button nextstep-jump\" data-gap=\"" + id + "\">Show me where</button>");
    }
    if (gap.sweep && !running) {
      buttons.push("<button type=\"button\" class=\"button button-quiet nextstep-check\" data-gap=\"" + id + "\""
        + " aria-label=\"Check what it is worth\" title=\"Check what it is worth\"" + (busy ? " disabled" : "")
        + ">Check</button>");
    }
    buttons.push("<button type=\"button\" class=\"button button-quiet nextstep-dismiss\" data-gap=\"" + id + "\">Not now"
      + "</button>");
    buttons.push(nextStepApplyHtml(gap));
    return "<li class=\"nextstep\" data-gap=\"" + id + "\"><h3>" + escapeText(gap.title) + "</h3><p>"
      + escapeText(gap.text) + "</p>"
      + (!gap.sweep && gap.sweepNote ? "<p class=\"field-help\">" + escapeText(gap.sweepNote) + "</p>" : "")
      + "<div class=\"nextstep-result\" role=\"status\" id=\"coachResult-" + id + "\">" + nextStepResultHtml(gap)
      + "</div>"
      + "<div class=\"nextstep-actions\">" + buttons.join("") + "</div>"
      + (gap.sweep && busy && !running ? "<p class=\"field-help nextstep-busy\">" + escapeText(busy) + "</p>" : "")
      + (running ? progressHtml("coach", state.coach.job) : "")
      + nextStepTriedHtml(gap) + "</li>";
  }

  // A gap's kept check in its "Checked:" box: the summary, dimmed under a warning once the settings, the risk comfort
  // or the seed changed, and any Apply error. A message when the last check ended without one.
  function nextStepResultHtml(gap) {
    const coach = state.coach;
    const entry = coach.entries[gap.id];
    const message = coach.messages[gap.id];
    if (!entry) return message ? "<p class=\"field-help\">" + escapeText(message) + "</p>" : "";
    const stale = coachStale(entry, gap);
    return "<div class=\"nextstep-check-result" + (stale ? " stale-results" : "") + "\">"
      + (stale ? "<p class=\"banner banner-warn\" role=\"note\">Settings changed since you checked.</p>" : "")
      + "<p><strong class=\"nextstep-checked\">Checked:</strong> " + escapeText(entry.value.summary) + "</p>"
      + (entry.error ? "<p class=\"banner banner-error\" role=\"alert\">" + escapeText(entry.error) + "</p>" : "")
      + "</div>";
  }

  // The kept check's buttons at the end of the button row: Apply (off once the check is stale) when it found a change
  // that may be applied, Applied and Undo once applied; "" before a check.
  function nextStepApplyHtml(gap) {
    const entry = state.coach.entries[gap.id];
    if (!entry) return "";
    const id = escapeText(gap.id);
    if (coachApplied(entry)) {
      return "<span class=\"muted\">Applied.</span><button type=\"button\" class=\"button button-quiet nextstep-undo\" "
        + "data-gap=\"" + id + "\">Undo</button>";
    }
    if (!entry.value.changed || !entry.value.applicable) return "";
    return "<button type=\"button\" class=\"button nextstep-apply\" data-gap=\"" + id + "\""
      + (coachStale(entry, gap) ? " disabled" : "") + ">Apply</button>";
  }

  // What the kept check tried, last in the row (dimmed with the result once stale); "" before a check.
  function nextStepTriedHtml(gap) {
    const entry = state.coach.entries[gap.id];
    const rows = entry && entry.value.rows;
    if (!rows || !rows.length) return "";
    return "<details class=\"nextstep-rows" + (coachStale(entry, gap) ? " stale-results" : "") + "\"><summary>What was "
      + "tried</summary><ul>" + rows.map((row) => "<li>" + escapeText(row.text) + (coachChangeText(row.change)
        ? ": " + escapeText(coachChangeText(row.change)) + " typical" : "") + "</li>").join("") + "</ul></details>";
  }

  // The quiet line under the gaps: the risk comfort the checks use, with Change (opens the Effort and style dialog).
  function riskComfortLinkHtml() {
    const value = riskComfortShown();
    const item = value && state.info.experience.riskComforts.find((choice) => choice.id === value);
    return "<p class=\"risk-row\"><span>" + escapeText(item ? "Risk comfort: " + item.label + "." : "Tell Coach how much "
      + "ups and downs you accept.") + "</span><button type=\"button\" class=\"button button-quiet risk-change\" "
      + "id=\"riskComfortChange\">" + (item ? "Change" : "Set it") + "</button></p>";
  }

  // Wire the card drawn in Summary's `body`.
  function wireNextSteps(body) {
    const card = body.querySelector("#nextStepsCard");
    if (!card) return;
    card.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      const gapId = button.dataset.gap;
      const gap = gapId ? coachGap(gapId) : null;
      if (button.classList.contains("nextstep-jump") && gap) {
        jumpToField(gap.jump.lever, gap.jump.itemPath || undefined, gap.jump.path || undefined);
      } else if (button.classList.contains("nextstep-guide") && gap) {
        openGuidedPlan(gap.lowGuide);
      } else if (button.classList.contains("nextstep-check")) {
        runLeverSweep(gapId);
      } else if (button.classList.contains("nextstep-dismiss")) {
        dismissGap(gapId);
      } else if (button.classList.contains("nextstep-apply")) {
        applyLeverSweep(gapId);
      } else if (button.classList.contains("nextstep-undo")) {
        undoLast();
        refreshNextSteps(gapId);
      } else if (button.id === "nextStepsHidden") {
        showDismissed();
      } else if (button.id === "riskComfortChange") {
        openExperiencePicker("settings");
      } else if (button.id === "coachCancel" && state.coach.job) {
        state.coach.job.stopped = "user";
        engine.cancel(state.coach.job.id);
      }
    });
    if (state.coach.job) showProgress("coach", state.coach.job);
  }

  // Redraw the card in place (Summary keeps everything else) and put the focus on gap `focusGap`'s first button.
  function refreshNextSteps(focusGap) {
    const holder = $("nextSteps");
    if (!holder) return;
    holder.innerHTML = renderNextSteps();
    wireNextSteps(holder);
    if (!focusGap) return;
    const row = holder.querySelector(".nextstep[data-gap=\"" + focusGap + "\"]");
    const target = row && (row.querySelector("#coachCancel, .nextstep-apply:not([disabled]), .nextstep-undo")
      || row.querySelector("button:not([disabled])"));
    if (target) target.focus();
  }

  // The Check buttons follow the other batched jobs (each one's end schedules the automatic Monte Carlo).
  // The focused button keeps the focus.
  function refreshCoachChecks() {
    const card = $("nextStepsCard");
    if (!card || state.coach.job) return;
    const active = card.contains(document.activeElement) ? document.activeElement : null;
    const kind = active && [...active.classList].find((name) => name.startsWith("nextstep-") || name === "risk-change");
    const gapId = active && active.dataset.gap;
    refreshNextSteps();
    if (!kind) return;
    const again = $("nextSteps").querySelector("." + kind + (gapId ? "[data-gap=\"" + gapId + "\"]" : ""));
    if (again) again.focus();
  }

  // Not now: hide gap `gapId` (kept in the experience block: no run, no undo step, no unsaved mark).
  function dismissGap(gapId) {
    if (!state.experience || !gapId) return;
    const progress = Object.assign({}, state.experience.progress || {}, { [coachDismissKey(gapId)]: true });
    saveExperience({ progress });
    renderResults();
    const next = $("nextStepsCard") && $("nextStepsCard").querySelector("button:not([disabled])");
    if (next) next.focus();
  }

  // Show N hidden: bring every dismissed gap back.
  function showDismissed() {
    if (!state.experience) return;
    const dismissed = new Set(coachDismissed(state.experience.progress).map(coachDismissKey));
    const progress = Object.fromEntries(Object.entries(state.experience.progress || {})
      .filter(([key]) => !dismissed.has(key)));
    saveExperience({ progress });
    renderResults();
    const first = $("nextStepsCard") && $("nextStepsCard").querySelector(".nextstep button");
    if (first) first.focus();
  }

  // Check what it is worth: run gap `gapId`'s sweep (one batched job; the automatic Monte Carlo waits for it).
  async function runLeverSweep(gapId) {
    const coach = state.coach;
    const gap = coachGap(gapId);
    if (!gap || !gap.sweep || coach.job || coachBusyReason(gapId)) return;
    const inputsText = JSON.stringify(state.inputs);
    const preset = coachPreset();
    const seed = state.seed;
    const key = coachSweepKey(inputsText, gap.sweep.id, gap.sweep.who, preset, seed);
    clearTimeout(mcTimer);
    mcTimer = null;
    const job = engine.job("leverSweep", [inputsText, gap.sweep.id, JSON.stringify({ preset, who: gap.sweep.who }),
      seed], null, (message) => {
      if (!coach.job || coach.job.id !== job.id) return;
      Object.assign(coach.job, { done: message.done, total: message.total, ms: message.ms });
      showProgress("coach", coach.job);
    });
    coach.job = { id: job.id, gapId, key, inputsText, done: 0, total: 0, ms: 0, stopped: null };
    coach.scenarioName = state.scenarioName;  // the scenario its result belongs to
    delete coach.entries[gapId];
    coach.messages[gapId] = null;
    refreshNextSteps(gapId);
    let reply = null;
    let failure = null;
    try {
      reply = await job.promise;
    } catch (error) {
      failure = String(error.message || error);
    }
    const { stopped } = coach.job;
    coach.job = null;
    if (failure) coach.messages[gapId] = failure;
    else if (!reply) coach.messages[gapId] = stopped === "inputs" || stopped === "hidden" ? null
      : COACH_STOPPED[stopped || "dropped"];
    else if (!reply.value.ok) coach.messages[gapId] = reply.value.error;
    else coach.entries[gapId] = { key, inputsText, value: reply.value, gap, appliedText: null, error: null };
    refreshNextSteps(gapId);
    scheduleMc();  // an automatic Monte Carlo waits for the check
  }

  // Apply a kept check's changes (applyOptimum's guard decides), as one Undo step.
  async function applyLeverSweep(gapId) {
    const entry = state.coach.entries[gapId];
    const gap = coachGap(gapId);
    if (!entry || coachStale(entry, gap) || coachApplied(entry) || !entry.value.applicable) return;
    const inputsText = JSON.stringify(state.inputs);
    const reply = await ask("applyOptimum", [inputsText, JSON.stringify(entry.value.changes)]);
    if (!reply || inputsText !== JSON.stringify(state.inputs)) return;
    if (!reply.ok) {
      entry.error = reply.error;
      refreshNextSteps(gapId);
      return;
    }
    entry.error = null;
    if (settleTimer) settle();  // an edit still settling is a step of its own
    state.inputs = reply.inputs;
    renderSettings();
    inputsChanged();
    entry.appliedText = JSON.stringify(state.inputs);  // after inputsChanged, which may tidy the inputs (reset flags)
    refreshNextSteps(gapId);
  }

  // The settings changed: a running check is dropped without a message; kept results go stale (their key); another
  // scenario clears them. The gaps are asked again.
  function coachInputsChanged() {
    const coach = state.coach;
    if (coach.job && coach.job.inputsText !== JSON.stringify(state.inputs)) {
      coach.job.stopped = "inputs";
      engine.cancel(coach.job.id);
    }
    if (coach.scenarioName != null && coach.scenarioName !== state.scenarioName) {
      coach.entries = {};
      coach.messages = {};
    }
    coach.scenarioName = state.scenarioName;
    loadCoachGaps();
  }

  // The style, effort or risk comfort changed (setExperience): a running check whose row is no longer drawn is
  // cancelled, the gaps are asked for when the card shows, and the automatic Monte Carlo is scheduled again.
  function coachExperienceChanged() {
    const job = state.coach.job;
    if (job && !(coachOn() && coachShown().shown.some((gap) => gap.id === job.gapId))) {
      job.stopped = "hidden";
      engine.cancel(job.id);
    }
    if (coachOn()) loadCoachGaps();
    refreshNextSteps();
    scheduleMc();
  }

  // Leaving the app stops a running check (it is short; nothing restarts by itself).
  function coachVisibilityChanged() {
    const job = state.coach.job;
    if (!job || document.visibilityState !== "hidden") return;
    job.stopped = "background";
    engine.cancel(job.id);
  }
  // ---- Monte Carlo: runs on its own after every change (and on Run), in batches, with progress and cancel;
  // results kept per inputs ----
  let mcTimer = null;
  // At Low a Monte Carlo of more runs posts one partial result once this many are done (the same seed and runs, no
  // extra ones), so the gauge and the fan chart show early; it is kept apart from the cache.
  const PREVIEW_RUNS = 10;

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
    refreshCoachChecks();  // a batched job ended: the Next steps checks may run again
  }

  // Run the Monte Carlo on its own when the current settings, runs and seed have no result yet. It waits for a
  // single run, a running Monte Carlo or comparison, and does not run on settings that need a fix, or again on
  // settings whose run failed or was cancelled. `window.WMTI_NO_AUTO_MC` (set by the tests) turns it off.
  function autoMc() {
    clearTimeout(mcTimer);
    mcTimer = null;
    const mc = state.mc;
    if (window.WMTI_NO_AUTO_MC || walk.open || !state.info || singleBusy || state.error || mc.job
      || state.compare.job || state.optimize.job || state.coach.job || reportRun.busy || needsSetup(state.inputs)) return;
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
      const ok = /^\d+$/.test(seed.value.trim());  // a whole number of 0 or more
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
    refreshCoachChecks();  // a Monte Carlo started or ended: the Next steps checks follow
  }

  // Run the Monte Carlo: `auto` when it started on its own (Cancel then leaves the focus where it was).
  async function runMonteCarlo(auto) {
    const mc = state.mc;
    if (mc.job) return;
    clearTimeout(mcTimer);
    mcTimer = null;
    const key = mcKey();
    // Low asks for the partial result (never put in the cache, so Compare, the report and the pins never see it).
    const partial = lowShown() && mc.runs > PREVIEW_RUNS ? { partialRuns: PREVIEW_RUNS } : null;
    const job = engine.job("monteCarlo", [JSON.stringify(state.inputs), mc.runs, state.seed], null, (message) => {
      Object.assign(mc.job, { done: message.done, total: message.total, ms: message.ms });
      showProgress("mc", mc.job);
      if (message.partial && message.partial.ok && !mc.job.silent) {
        mc.preview = { key, value: message.partial };
        renderResults();
      }
    }, partial);
    // The scenario and order are stamped when the run starts, so a scenario switched mid-run keeps the right name.
    mc.job = { id: job.id, done: 0, total: mc.runs, ms: 0, key, silent: false, startScenario: state.scenarioName,
      seq: ++mc.seq };
    mc.preview = null;
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
    const { done, silent, startScenario, seq } = mc.job;
    mc.job = null;
    mc.preview = null;  // the full result (or nothing, after a cancel or an error) replaces it
    if (failure || (!reply && !silent) || (reply && !reply.value.ok)) mc.skipKey = key;  // not again on its own
    if (failure) mc.message = { error: true, text: failure };
    else if (!reply && silent) mc.message = null;  // replaced by newer settings or a comparison: no message
    else if (!reply) mc.message = { text: "Cancelled after " + done + " of " + mc.runs + " runs. Nothing was kept from "
      + "the cancelled runs" + (mc.cache.length ? "; the last finished result stays." : ".") };
    else if (!reply.value.ok) mc.message = { error: true, text: reply.value.error };
    else {
      mc.cache = rememberResult(mc.cache, { key, value: reply.value, ms: reply.ms, scenario: startScenario, seq });
      state.perRunMs = reply.ms / reply.value.runs;
    }
    renderPinned();
    renderMcBar();
    renderResults();
    renderPlots();
    renderAbout();
    if (!mcTimer) autoMc();  // the settings may have changed while it ran
  }

  // ---- Gamer: level, XP, quests and awards (Gamer style only) ----
  // The rules are gamify.js (WmtiGamify); this part keeps the ledger in the open scenario's experience block
  // (experience.progress.game, so it is saved, exported and imported with the scenario, and the model never reads it),
  // works out the facts from the state, grants on a short debounce after results, edits and walkthrough steps
  // (gamerTick), shows one polite toast line and draws the Awards tab, built only while it is open. Nothing here reads
  // or changes an input or a result beyond looking at them.
  const gamify = window.WmtiGamify;
  const GAMER_TICK_MS = 300;  // the debounce of gamerTick
  const GAMER_TOAST_MS = 3500;  // how long the toast line shows
  // Gamer is a look only for now (owner, 2026-10-30): the HUD styling of styles.css "Gamer HUD look". false keeps the
  // Awards tab, Garden, XP, quests, quest map, mini games and toasts off; true brings them back unchanged.
  const GAMER_EXTRAS = false;
  const SEEN_VIEWS = ["summary", "plots", "compare", "optimize"];  // the result views a visit marks seen
  // `pending`: a level-up card waiting for the Garden tab (memory only); `year`: the Garden's Plan year slider;
  // `detail`: the bed or chip the Garden's detail area explains.
  const gamer = { timer: null, toastTimer: null, migrated: false, pending: null, year: 0, detail: null };
  window.wmtiGamer = { state: () => state.game, tick: gamerTickNow, tree: () => state.walkTree };  // for the tests

  // Whether the Gamer extras show: Gamer style with GAMER_EXTRAS on; never with the gamify features off (gamifyOn), so
  // no Awards view, XP, quest map, Quick game or mini game shows then.
  function gamerOn() {
    if (!gamifyOn() || !state.info || !state.info.experience || !state.experience) return false;
    return GAMER_EXTRAS && shownExperience().style === "gamer";
  }

  // The Outputs views (Awards is a bottom tab of its own, not a view; Strategy's views are STRATEGY_VIEWS).
  function outputViews() {
    return VIEWS;
  }

  const gameToday = () => Math.floor(Date.now() / 86400000);  // the UTC day number the ledger records

  // The ledger an experience block holds (experience.progress.game), cleaned; an empty ledger when there is none.
  function gameLedgerOf(experience) {
    const progress = experience && isObject(experience.progress) ? experience.progress : {};
    return gamify.cleanLedger(hasOwn(progress, GAME_PROGRESS_KEY) ? progress[GAME_PROGRESS_KEY] : null);
  }

  // Keep `ledger` in the open scenario's experience block: the draft and its saved copy, with no run, undo step or
  // unsaved mark (saveExperience). Only in Gamer style: otherwise (another style, or a build with the gamify features
  // off, whose shownExperience is Accountant) the ledger in the block is never written and stays as the file has it.
  function saveLedger(ledger) {
    if (!state.experience || !gamerOn()) return;
    const progress = { ...(isObject(state.experience.progress) ? state.experience.progress : {}),
      [GAME_PROGRESS_KEY]: gamify.cleanLedger(ledger) };
    saveExperience({ progress });
  }

  // Progress kept on this device by an older page (GAME_KEY) moves once into the open scenario, joined with what the
  // scenario already holds, and leaves the device.
  function migrateDeviceLedger() {
    if (gamer.migrated || !state.experience || !gamerOn()) return;
    gamer.migrated = true;
    let raw = null;
    try { raw = localStorage.getItem(GAME_KEY); } catch (error) { return; }  // storage blocked: nothing to move
    if (raw == null) return;
    const device = gamify.cleanLedger(raw);
    if (JSON.stringify(device) !== JSON.stringify(gamify.emptyLedger())) {
      saveLedger(gamify.mergeLedgers(state.game.ledger, device));
    }
    try { localStorage.removeItem(GAME_KEY); } catch (error) { /* storage blocked */ }
  }

  // The facts the rules read: inputs, the experience block, the effort, whether this is the unedited example, the
  // results there are and the views seen.
  function gamerFacts() {
    const isExample = state.defaults != null && state.inputs != null && sameValue(state.inputs, state.defaults);
    return gamify.gamifyFacts({ inputs: state.inputs, experience: state.experience, effort: shownExperience().effort,
      isExample, results: { mc: state.inputs ? cachedResult(state.mc.cache, mcKey()) : null,
        compare: state.compare.cache[0] || null, optimize: state.optimize.entry },
      seen: state.game.ledger.seen, games: state.game.ledger.games });
  }

  // Grant what is met now, a moment after the last call (results, edits and walkthrough steps call it).
  function gamerTick() {
    clearTimeout(gamer.timer);
    gamer.timer = setTimeout(gamerTickNow, GAMER_TICK_MS);
  }

  function gamerTickNow() {
    clearTimeout(gamer.timer);
    gamer.timer = null;
    if (!gamerOn() || !state.inputs) return;
    migrateDeviceLedger();
    const before = gamify.levelOf(gamify.xpOf(state.game.ledger)).level;
    const { ledger, grants } = gamify.evaluate(gamerFacts(), state.game.ledger,
      { effort: shownExperience().effort, today: gameToday() });
    if (!grants.length && JSON.stringify(ledger) === JSON.stringify(state.game.ledger)) return;
    saveLedger(ledger);
    const card = gamify.levelUpCard(grants, gardenNameOf, before);
    if (card) gamer.pending = card;  // shown by the Garden's next render with nothing else open
    if (grants.length) {
      gamerToast(gamify.grantsText(grants) + (card && !gardenCanReveal() ? " The garden has news." : ""));
    }
    if (awardsShown()) renderAwards();
  }

  // One polite status line above the tab bar for a few seconds; the focus stays where it is.
  function gamerToast(text) {
    const toast = $("gamerToast");
    if (!text) return;
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(gamer.toastTimer);
    gamer.toastTimer = setTimeout(() => { toast.hidden = true; }, GAMER_TOAST_MS);
  }

  // A visit to a result view in Gamer style marks it seen once (Plots and Explorer read it).
  function gamerSeen(view) {
    if (!gamerOn() || !SEEN_VIEWS.includes(view) || view in state.game.ledger.seen) return;
    const ledger = gamify.cleanLedger(state.game.ledger);
    ledger.seen[view] = gameToday();
    saveLedger(ledger);
    gamerTick();
  }

  const awardsShown = () => state.tab === "awards" && gamerOn();

  // Show the Awards bottom tab only in Gamer style (and, wide, its chip in the Outputs row, since the wide layout has
  // no bottom bar); a user on Awards when it goes moves to Outputs, Summary. True when the tab's visibility changed.
  function syncAwardsTab() {
    const on = gamerOn();
    const changed = $("tab-awards").hidden === on;
    $("tab-awards").hidden = !on;
    $("sub-awards").hidden = !(on && wide.on);
    if (!on && state.tab === "awards") {
      state.tab = "outputs";
      state.view = "summary";
    }
    return changed;
  }

  // The style changed or another scenario opened: the Awards tab follows the style and shows that scenario's progress.
  function gamerStyleChanged() {
    const on = gamerOn();
    const changed = syncAwardsTab();
    if (!on) {
      clearTimeout(gamer.toastTimer);
      $("gamerToast").hidden = true;
      gamer.pending = null;
      closeLevelUp();
      $("awards-body").replaceChildren();  // no garden is kept while away
    }
    if (state.schema) {
      if (changed) { showPlace(); savePrefs(); } else renderAwards();
    }
    if (on) gamerTick();
  }

  // A day number as a short date.
  const gameDate = (day) => new Date(day * 86400000).toLocaleDateString(undefined,
    { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

  const QUEST_ORDER = { open: 0, pending: 0, locked: 1, done: 2 };  // open quests first, done ones last
  const QUEST_STATE_TEXT = { open: "To do", pending: "Done, adding it now", done: "Done" };

  // The Garden tab: the Glass Garden, level and XP with the Next step, the garden's detail area, the quests (each open
  // one with Show me), the awards, the Greenhouse of mini games, and Reset progress.
  function awardsHtml() {
    const ledger = state.game.ledger;
    const facts = gamerFacts();
    const model = gardenModel();
    const xp = model.xp;
    const level = model.level;
    const toNext = level.next == null ? "The top level." : (level.next - level.into) + " XP to level "
      + (level.level + 1) + ".";
    let html = gardenHtml(model);
    html += "<section class=\"gm-hero\" aria-labelledby=\"gmLevel\"><h3 id=\"gmLevel\" tabindex=\"-1\">Level "
      + level.level + ": " + escapeText(level.name) + "</h3><progress class=\"gm-bar\" max=\"" + (level.next || 1)
      + "\" value=\"" + (level.next == null ? 1 : level.into) + "\" aria-labelledby=\"gmLevel gmXp\"></progress><p "
      + "id=\"gmXp\">" + xp + " XP. " + toNext + "</p><p class=\"gd-next\">" + escapeText(gardenNextStep(model))
      + "</p></section>";
    html += gardenDetailBox(model);
    const quests = gamify.questStatus(facts, ledger, shownExperience().effort)
      .map((quest, position) => ({ quest, position }))
      .sort((one, two) => QUEST_ORDER[one.quest.state] - QUEST_ORDER[two.quest.state] || one.position - two.position)
      .map(({ quest }) => quest);
    html += "<div class=\"card\"><div class=\"card-head\"><h2>Quests</h2></div><ul class=\"gm-list\" id=\"gmQuests\">"
      + quests.map((quest) => {
      const status = quest.state === "locked" ? quest.lockText
        : quest.state === "done" ? "Done " + gameDate(quest.day) : QUEST_STATE_TEXT[quest.state];
      const show = quest.state === "open" ? "<button type=\"button\" class=\"button button-quiet gm-show\" data-show=\""
        + escapeText(quest.show) + "\" aria-label=\"Show me: " + escapeText(quest.title) + "\">Show me</button>" : "";
      return "<li class=\"gm-quest\" data-quest=\"" + escapeText(quest.id) + "\" data-state=\"" + quest.state + "\">"
        + "<strong>" + escapeText(quest.title) + "</strong>" + show + "<p>" + escapeText(quest.how) + " " + quest.xp
        + " XP. " + escapeText(status) + ".</p></li>";
    }).join("") + "</ul></div>";
    html += "<div class=\"card\"><div class=\"card-head\"><h2>Awards</h2></div><ul class=\"gm-list\" id=\"gmAwards\">"
      + gamify.AWARDS.map((award) => {
      const day = ledger.awards[award.id];
      const earned = day != null;
      return "<li class=\"gm-award\" data-award=\"" + escapeText(award.id) + "\" data-earned=\"" + earned + "\"><strong>"
        + escapeText(award.title) + "</strong><p>" + (earned ? "Earned " + escapeText(gameDate(day)) + "."
        : escapeText(award.how)) + "</p></li>";
    }).join("") + "</ul></div>";
    html += miniGamesHtml(ledger);
    html += "<div class=\"card\"><p class=\"field-help\">Progress is saved with this scenario and goes with its file. "
      + "XP counts what you do and compare, never how a plan turns out.</p><button type=\"button\" "
      + "class=\"button button-danger\" id=\"gamerReset\">Reset progress</button></div>";
    return html;
  }

  // The Greenhouse: one card per mini game with its best stars and Play (Claim Age Showdown once per person); a tool's
  // game says which tool and level open it, with no Play button, until then.
  function miniGamesHtml(ledger) {
    const partner = Boolean(state.inputs && state.inputs.partner);
    const level = gamify.levelOf(gamify.xpOf(ledger)).level;
    return "<div class=\"card\"><div class=\"card-head\"><h2>Greenhouse: mini games</h2></div><div class=\"gm-list\" id=\"gmGames\">"
      + gameRules.GAMES.map((game) => {
      const entry = ledger.games[game.id];
      const tool = gamify.toolOf(game.id);
      if (tool && level < tool.level) {
        return "<div class=\"gm-game-card\" data-game-card=\"" + game.id + "\" data-locked=\"true\"><strong>"
          + escapeText(game.title) + "</strong><p>Opens with the " + escapeText(tool.title.toLowerCase()) + " (level "
          + tool.level + ").</p></div>";
      }
      const best = entry ? "Best: " + entry.stars + " of 3 stars." : "Not played yet.";
      const people = game.id === "claim" && partner ? [["you", "Play: you"], ["partner", "Play: partner"]]
        : [["you", "Play"]];
      const buttons = people.map(([who, label]) => "<button type=\"button\" class=\"button gm-play\" data-game=\""
        + game.id + "\" data-who=\"" + who + "\" aria-label=\"" + escapeText(label + ": " + game.title) + "\">"
        + escapeText(label) + "</button>").join(" ");
      return "<div class=\"gm-game-card\" data-game-card=\"" + game.id + "\"><strong>" + escapeText(game.title)
        + "</strong><span class=\"row-buttons\">" + buttons + "</span><p>" + escapeText(best) + "</p></div>";
    }).join("") + "</div><p class=\"field-help\">Three short rounds each, no clock; close any time. Illustrative, not "
      + "advice.</p></div>";
  }

  function renderAwards() {
    if (!awardsShown()) return;
    migrateDeviceLedger();
    $("awards-body").innerHTML = awardsHtml();
    maybeShowPending();
  }

  // Show me: the walkthrough, a result view, or an input on its page (Inputs when it is not drawn at this effort).
  function gamerShowMe(target) {
    if (target === "walk") { openWalk(); return; }
    if (target.startsWith("view:")) { selectView(target.slice(5)); return; }
    if (target.startsWith("field:") && openInputsField(target.slice(6))) return;
    selectTabFresh("inputs");
  }

  // Reset progress, after a confirm: XP, quests, awards and views seen go, and what is true now is not granted back.
  function confirmResetGame() {
    openDialog({ title: "Reset progress?",
      text: "This clears this scenario's XP, quests and awards. Your plan does not change.",
      actions: [["Reset", "button button-danger", () => {
        saveLedger(gamify.resetLedger(gamerFacts(), state.game.ledger));
        gamer.pending = null;
        renderAwards();
        gamerToast("Progress reset.");
      }, "gamerResetConfirm"], ["Cancel", "button button-quiet", () => true, "gamerResetCancel"]] });
  }

  // The walkthrough Trail as a quest map in Gamer style: each topic a stage with "n of m" answered, each row a node
  // (done, now, to do or skipped). `group` is one walkTrail group; returns the stage's class and heading.
  function questMapHtml(group) {
    const questions = (group.items || []).filter((item) => item.kind !== "offer");
    const done = questions.filter((item) => item.status === "answered").length;
    const count = group.offer ? "" : " <span class=\"walk-quest-count\">" + done + " of " + questions.length
      + "</span>";
    return { className: " walk-quest", heading: escapeText(group.title) + count };
  }

  const QUEST_NODES = { answered: "done", now: "now", todo: "todo", skipped: "skipped" };
  const questNode = (item) => " data-node=\"" + (QUEST_NODES[item.status] || "todo") + "\"";

  // A finished mini game: one more play of `id` and its best stars, then a tick (the games' rules read them).
  function gamerRecordPlay(id, stars) {
    const ledger = gamify.cleanLedger(state.game.ledger);
    const before = ledger.games[id] || { plays: 0, stars: 0 };
    ledger.games[id] = { plays: before.plays + 1, stars: Math.max(before.stars, Number(stars) || 0) };
    saveLedger(ledger);
    gamerTick();
  }

  function wireGamer() {
    $("awards-body").addEventListener("click", (event) => {
      const show = event.target.closest(".gm-show");
      if (show) { gamerShowMe(show.dataset.show); return; }
      const playButton = event.target.closest(".gm-play");
      if (playButton) { openGame(playButton.dataset.game, { who: playButton.dataset.who, returnFocus: playButton }); return; }
      if (event.target.closest("#gamerReset")) confirmResetGame();
    });
    wireGarden();
  }
  // ---- Gamer mini games (Gamer style only) ----
  // Seven short, original games (rules in games.js, WmtiGames) in one pop-up (#gameDialog), opened from the Garden
  // tab's Greenhouse and tools (the three tool games, 54-tool-games.js, once their level is reached) and from the
  // walkthrough's "Quick game" buttons. Three rounds, no clock; Close or Escape any
  // time (an unfinished run grants nothing). Finishing records the play with gamerRecordPlay (51-gamer.js). The games
  // read fixed law data (state.info.law), the person's benefitTables rows (Claim Age Showdown) or generic numbers and
  // change nothing, except Claim Age Showdown's confirmed "Set my claim age" (one Undo step, never at Low).
  const gameRules = window.WmtiGames;
  const GAME_TITLES = Object.fromEntries(gameRules.GAMES.map((game) => [game.id, game.title]));
  const GAME_DIGITS = { 1: 0, 2: 1, 3: 2, 4: 3 };  // Receipt Sort: a number key sends the chosen card to that bin
  const play = { id: null, who: "you", round: 0, rounds: null, results: [], answer: undefined, checked: false,
    finished: false, stars: 0, data: null, returnFocus: null, returnSelector: null, turn: 0, lifespan: 90, pick: null,
    chosen: null, reveal: null, placeReceipt: null, wasInert: false };
  window.wmtiGames = { state: () => play };  // for the tests

  function gameEl(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function gameButton(text, className, onClick, id) {
    const button = gameEl("button", className, text);
    button.type = "button";
    if (id) button.id = id;
    if (onClick) button.addEventListener("click", onClick);
    return button;
  }

  // The polite status line under the title: each check's result and the final stars.
  function gameStatus(text) {
    $("gameStatus").textContent = text || "";
  }

  // A radio group of answers; picking one sets the round's answer. `options` are [value, label].
  function gameChoices(legend, options) {
    const group = gameEl("fieldset");
    group.append(gameEl("legend", "", legend));
    const name = "gameChoice" + play.round;
    options.forEach(([value, label], index) => {
      const option = gameEl("label", "gm-card");
      const input = gameEl("input");
      input.type = "radio";
      input.name = name;
      input.id = name + "-" + index;
      input.value = String(value);
      input.addEventListener("change", () => { if (!play.checked) play.answer = value; });
      option.append(input, document.createTextNode(" " + label));
      group.append(option);
    });
    return group;
  }

  // Bars of named amounts, each with its figure in words beside the bar. `rows` are [label, amount].
  function gameBars(rows, label) {
    const holder = gameEl("div", "gm-bars");
    holder.setAttribute("role", "group");
    holder.setAttribute("aria-label", label);
    const top = Math.max(1, ...rows.map(([, amount]) => amount));
    for (const [name, amount] of rows) {
      const row = gameEl("div");
      const meter = gameEl("meter");
      meter.min = 0;
      meter.max = top;
      meter.value = Math.max(0, amount);
      meter.setAttribute("aria-hidden", "true");
      row.append(gameEl("span", "", name + ": " + fullMoney(amount)), meter);
      holder.append(row);
    }
    return holder;
  }

  // Open game `id`; `who` picks the person for Claim Age Showdown, `returnFocus` gets the focus back on Close.
  async function openGame(id, { who = "you", returnFocus = null } = {}) {
    if (!GAME_TITLES[id] || !gamerOn() || !state.inputs || !toolGameOpen(id)) return;
    const turn = ++play.turn;
    Object.assign(play, { id, who: who === "partner" && state.inputs.partner ? "partner" : "you", round: 0,
      rounds: null, results: [], answer: undefined, checked: false, finished: false, stars: 0, data: null,
      lifespan: 90, pick: null, chosen: null, reveal: null, placeReceipt: null });
    play.returnFocus = returnFocus || document.activeElement;
    play.returnSelector = play.returnFocus && play.returnFocus.dataset && play.returnFocus.dataset.game
      ? ".gm-play[data-game=\"" + id + "\"][data-who=\"" + play.who + "\"]" : null;
    $("gameTitle").textContent = GAME_TITLES[id];
    $("gameRound").textContent = "";
    gameStatus("");
    $("gameBody").replaceChildren(gameEl("p", "gm-readout", id === "claim" ? "Reading your benefit table" : ""));
    gameActions([]);
    if ($("gameDialog").hidden) play.wasInert = $("app").inert;
    $("app").inert = false;  // the pop-up is in the page, which the walkthrough keeps inert
    $("gameDialog").hidden = false;
    $("gameBackdrop").hidden = false;
    $("gameTitle").focus();
    const seed = Math.floor(Math.random() * 1e9) + 1;
    if (id === "claim") {
      const loaded = await loadClaimTables();
      if (turn !== play.turn) return;
      const rounds = loaded.rows ? gameRules.claimRounds(loaded.rows, seed) : null;
      if (!rounds) {
        $("gameBody").replaceChildren(gameEl("p", "gm-readout", loaded.error || "Enter your benefit first: Claim Age "
          + "Showdown needs at least two claim ages with a monthly benefit (Inputs, Retirement)."));
        gameActions([]);
        $("gameClose").focus();
        return;
      }
      play.data = { rows: loaded.rows };
      play.rounds = rounds;
    } else if (id === "bracket") {
      play.data = { brackets: gameBrackets() };
      play.rounds = gameRules.bracketRounds({ brackets: { key: play.data.brackets } }, "key", seed);
    } else if (id === "receipts") {
      play.rounds = gameRules.receiptRounds(seed);
    } else if (id === "seesaw") {
      play.rounds = gameRules.seesawRounds(seed);
    } else if (id === "leaks") {
      play.rounds = gameRules.leakRounds(seed);
    } else if (id === "snowball") {
      play.rounds = gameRules.snowballRounds(seed);
    } else {
      play.rounds = gameRules.decadeRounds(seed);
    }
    renderGameRound();
  }

  // The federal brackets of the open scenario's filing status, from the fixed law data in appInfo.
  function gameBrackets() {
    const law = state.info.law;
    const key = law.filingKeys[String(state.inputs.filingStatus || "").toUpperCase()] || "SINGLE";
    return law.brackets[key] || law.brackets.SINGLE;
  }

  // The person's benefit rows from benefitTables (lane "game"); `{rows}` or `{error}`.
  async function loadClaimTables() {
    let reply;
    try {
      reply = await engine.call("benefitTables", [JSON.stringify(state.inputs)], "game");
    } catch (error) {
      return { error: "The benefit table could not be read: " + String((error && error.message) || error) };
    }
    const value = reply && reply.value;
    if (!value || !value.ok) return { error: (value && value.error) || "The benefit table could not be read." };
    const person = (value.people || []).find((item) => item.role === play.who);
    return { rows: person ? gameRules.claimRows(person.table) : [] };
  }

  // The footer: `buttons` (each from gameButton) and Close, always last.
  function gameActions(buttons) {
    $("gameActions").replaceChildren(...buttons, gameButton("Close", "button button-quiet", closeGame, "gameClose"));
  }

  const GAME_SCREENS = { bracket: bracketScreen, claim: claimScreen, receipts: receiptScreen, decade: decadeScreen,
    seesaw: seesawScreen, leaks: leaksScreen, snowball: snowballScreen };

  function renderGameRound() {
    play.answer = undefined;
    play.checked = false;
    play.reveal = null;
    const round = play.rounds[play.round];
    $("gameRound").textContent = "Round " + (play.round + 1) + " of " + gameRules.ROUNDS;
    const { nodes, reveal } = GAME_SCREENS[play.id](round);
    play.reveal = reveal;
    $("gameBody").replaceChildren(...nodes);
    $("gameBody").scrollTop = 0;
    gameActions([gameButton("Check", "button", gameCheck, "gameCheck")]);
    const first = $("gameBody").querySelector("input, button");
    (first || $("gameCheck")).focus();
  }

  // Check the round's answer once; then Next (or See result after the last round).
  function gameCheck() {
    if (play.checked) return;
    const round = play.rounds[play.round];
    if (play.answer === undefined) {
      gameStatus(play.id === "receipts" ? "Sort every receipt first." : "Choose an answer first.");
      return;
    }
    const graders = { bracket: gameRules.gradeBracket, claim: gameRules.gradeClaim, receipts: gameRules.gradeReceipts,
      decade: gameRules.gradeDecade, seesaw: gameRules.gradeSeesaw, leaks: gameRules.gradeLeaks,
      snowball: gameRules.gradeSnowball };
    const answer = play.answer === "never" ? null : play.answer;
    const right = graders[play.id](round, answer);
    play.checked = true;
    play.results.push(right);
    for (const input of $("gameBody").querySelectorAll("input[type=radio]")) input.disabled = true;
    const said = play.reveal ? play.reveal(right) : "";
    const verdict = round.kind === "pick" ? "Noted." : right ? "Right." : "Not quite.";
    gameStatus(verdict + (said ? " " + said : ""));
    const last = play.round + 1 >= play.rounds.length;
    const next = gameButton(last ? "See result" : "Next", "button", last ? finishGame : gameNext, "gameNext");
    gameActions([next]);
    next.focus();
  }

  function gameNext() {
    if (!play.checked || play.finished) return;
    play.round += 1;
    renderGameRound();
  }

  // The result card: the stars, what to remember, the not-advice line and, in Claim Age Showdown, the offer to set the
  // claim age picked in round 3. The play is recorded once.
  function finishGame() {
    if (!play.checked) return;
    if (!play.finished) {
      play.finished = true;
      play.stars = gameRules.starsOf(play.results);
      gamerRecordPlay(play.id, play.stars);
    }
    const game = gameRules.GAMES.find((item) => item.id === play.id);
    $("gameRound").textContent = "Finished";
    const stars = gameEl("p", "gm-readout");
    const shown = gameEl("span", "", "★".repeat(play.stars) + "☆".repeat(gameRules.ROUNDS - play.stars) + " ");
    shown.setAttribute("aria-hidden", "true");
    stars.append(shown, document.createTextNode(play.stars + " of " + gameRules.ROUNDS + " stars"));
    const nodes = [stars, gameEl("p", "", "Remember: " + game.remember), gameEl("p", "", gameRules.NOT_ADVICE)];
    const buttons = [gameButton("Play again", "button", () => openGame(play.id,
      { who: play.who, returnFocus: play.returnFocus }), "gameAgain")];
    const offer = claimOffer();
    if (offer) nodes.push(offer);
    $("gameBody").replaceChildren(...nodes);
    gameActions(buttons);
    gameStatus("Finished with " + play.stars + " of " + gameRules.ROUNDS + " stars.");
    (offer ? offer : $("gameAgain")).focus();
  }

  function closeGame() {
    if ($("gameDialog").hidden) return false;
    play.turn += 1;
    $("gameDialog").hidden = true;
    $("gameBackdrop").hidden = true;
    $("gameBody").replaceChildren();
    if (play.wasInert && walk.open) $("app").inert = true;
    let target = play.returnFocus;
    if ((!target || !document.contains(target)) && play.returnSelector) {
      target = document.querySelector(play.returnSelector);
    }
    if (target && document.contains(target)) target.focus();
    return true;
  }

  // Escape closes the game only (a game opened from the walkthrough leaves it open). True when a game was open.
  function gameEscape() {
    return closeGame();
  }

  // ---- Bracket Climber ----
  const LADDER = { width: 300, height: 200, rail: 44 };

  function ladderTop(round, brackets) {
    const third = brackets[Math.min(2, brackets.length - 1)].from;
    if (round.kind === "target") return Math.max(third * 1.3, round.target * 1.6);
    return Math.max(round.income * 1.4, third * 1.2);
  }

  // The to-scale ladder: one rung per bracket up to `top`, its rate at the side, and the climber at `income`.
  function ladderSvg(brackets, top, income) {
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 " + LADDER.width + " " + LADDER.height);
    svg.setAttribute("aria-hidden", "true");
    const y = (value) => LADDER.height - Math.min(1, Math.max(0, value / top)) * LADDER.height;
    brackets.filter((row) => row.from < top).forEach((row, index) => {
      const low = y(row.from);
      const high = y(row.to === null ? top : Math.min(row.to, top));
      const rung = document.createElementNS(svgNs, "rect");
      rung.setAttribute("x", LADDER.rail);
      rung.setAttribute("y", high);
      rung.setAttribute("width", LADDER.width - LADDER.rail);
      rung.setAttribute("height", Math.max(0, low - high));
      rung.setAttribute("style", "fill: " + (index % 2 ? "var(--gm-panel)" : "var(--gm-deep)")
        + "; stroke: var(--gm-violet)");
      svg.append(rung);
      if (low - high >= 14) {
        const label = document.createElementNS(svgNs, "text");
        label.setAttribute("x", LADDER.width - 8);
        label.setAttribute("y", (low + high) / 2 + 4);
        label.setAttribute("text-anchor", "end");
        label.textContent = percent(row.rate, 0);
        svg.append(label);
      }
    });
    const climber = document.createElementNS(svgNs, "circle");
    climber.setAttribute("class", "gm-climber");
    climber.setAttribute("cx", LADDER.rail / 2);
    climber.setAttribute("cy", y(income));
    climber.setAttribute("r", 9);
    svg.append(climber);
    return { svg, move: (value) => climber.setAttribute("cy", y(value)) };
  }

  function bracketReadout(brackets, income) {
    const found = gameRules.bracketAt(brackets, income);
    return "At " + fullMoney(income) + ": last dollar " + percent(found.marginal, 0) + ", average "
      + percent(found.average, 1) + ".";
  }

  function bracketScreen(round) {
    const brackets = play.data.brackets;
    const top = ladderTop(round, brackets);
    const start = round.kind === "target" ? 0 : round.income;
    const ladder = ladderSvg(brackets, top, start);
    const holder = gameEl("div", "gm-ladder");
    holder.append(ladder.svg, gameEl("p", "sr-only", "Federal brackets: " + brackets.map((row) => percent(row.rate, 0)
      + (row.to === null ? " above " + fullMoney(row.from) : " from " + fullMoney(row.from) + " to "
      + fullMoney(row.to))).join("; ") + "."));
    const readout = gameEl("p", "gm-readout");
    readout.id = "gameReadout";
    const second = brackets[1];
    const prompts = {
      next: "At " + fullMoney(round.income) + " of taxable income, what rate does the next $1,000 pay?",
      target: "Climb to about " + fullMoney(round.target) + " of taxable income (within $500) and stay in the "
        + percent(second.rate, 0) + " bracket, below " + fullMoney(second.to) + ".",
      average: "At " + fullMoney(round.income) + " of taxable income, what is the average rate on all of it?",
    };
    const nodes = [gameEl("p", "", prompts[round.kind]), holder];
    if (round.kind === "target") {
      const label = gameEl("label", "field-label", "Taxable income");
      label.htmlFor = "gameRange";
      const range = gameEl("input");
      Object.assign(range, { type: "range", id: "gameRange", min: 0, max: Math.round(top / 1000) * 1000, step: 1000,
        value: start });
      const step = gameEl("div", "row-buttons");
      const update = (value) => {
        const income = Math.max(0, Math.min(Number(range.max), value));
        range.value = income;
        range.setAttribute("aria-valuetext", fullMoney(income));
        ladder.move(income);
        readout.textContent = bracketReadout(brackets, income);
        if (!play.checked) play.answer = income;
      };
      range.addEventListener("input", () => update(Number(range.value)));
      const down = gameButton("- $1,000", "button button-quiet", () => update(Number(range.value) - 1000), "gameDown");
      const up = gameButton("+ $1,000", "button button-quiet", () => update(Number(range.value) + 1000), "gameUp");
      down.setAttribute("aria-label", "Down $1,000");
      up.setAttribute("aria-label", "Up $1,000");
      step.append(down, up);
      nodes.push(label, range, step, readout);
      update(start);
      play.answer = undefined;  // the start is not an answer until the climber moves
      return { nodes, reveal: () => readout.textContent };
    }
    const choices = round.kind === "next" ? round.choices.map((rate) => [rate, percent(rate, 0)])
      : round.choices.map((rate) => [rate, percent(rate, 1)]);
    nodes.push(gameChoices(round.kind === "next" ? "Rate of the next $1,000" : "Average rate", choices), readout);
    return { nodes, reveal: () => {
      const found = gameRules.bracketAt(brackets, round.income);
      readout.textContent = bracketReadout(brackets, round.income);
      return round.kind === "next" ? "The next $1,000 pays " + percent(round.answer, 0) + "."
        : "The tax is " + fullMoney(found.tax) + ", an average of " + percent(round.answer, 1) + " while the last "
          + "dollar pays " + percent(found.marginal, 0) + ".";
    } };
  }

  // ---- Claim Age Showdown ----
  const claimLabel = (age) => "Claiming at " + age;

  function claimBars(rows, ages, upTo) {
    return gameBars(ages.map((age) => [claimLabel(age), gameRules.cumulative(rows, age, upTo)]),
      "Collected by age " + upTo);
  }

  function claimScreen(round) {
    const rows = play.data.rows;
    const used = (age) => fullMoney(rows.find((row) => row.age === age).used);
    const whose = play.who === "partner" ? "Your partner's benefit" : "Your benefit";
    const nodes = [gameEl("p", "gm-readout", whose)];
    const note = gameEl("p", "field-help", "Simple sums in today's dollars: no investing of early benefits, no taxes.");
    if (round.kind === "breakEven") {
      nodes.push(gameEl("p", "", claimLabel(round.early) + " pays " + used(round.early) + " a month; "
        + claimLabel(round.late).toLowerCase() + " pays " + used(round.late) + ". By about what age has the later "
        + "claimant collected as much?"));
      nodes.push(gameChoices("Break-even age", round.choices.map((age) => (age === null ? ["never", "Never"]
        : [age, "About " + age]))), note);
      return { nodes, reveal: () => (round.exact === null ? "Claiming later never catches up here."
        : "They are even at about age " + round.exact.toFixed(1) + ".") };
    }
    if (round.kind === "lifespan") {
      nodes.push(gameEl("p", "", "By age " + round.lifespan + ", which claimant has collected the most?"));
      nodes.push(gameChoices("Collected the most", round.ages.map((age) => [age, claimLabel(age)])));
      const explore = gameEl("div", "dialog-body");
      explore.hidden = true;
      nodes.push(explore, note);
      return { nodes, reveal: () => {
        const label = gameEl("label", "field-label", "Life span");
        label.htmlFor = "gameLifespan";
        const range = gameEl("input");
        Object.assign(range, { type: "range", id: "gameLifespan", min: round.min, max: round.max, step: 1,
          value: round.lifespan });
        const line = gameEl("p", "gm-readout");
        line.id = "gameReadout";
        let bars = claimBars(rows, round.ages, round.lifespan);
        const update = () => {
          const upTo = Number(range.value);
          play.lifespan = upTo;
          range.setAttribute("aria-valuetext", "Age " + upTo);
          const fresh = claimBars(rows, round.ages, upTo);
          bars.replaceWith(fresh);
          bars = fresh;
          line.textContent = "By age " + upTo + ", " + claimLabel(gameRules.leaderAt(rows, round.ages, upTo))
            .toLowerCase() + " has collected the most.";
        };
        range.addEventListener("input", update);
        explore.append(bars, label, range, line);
        explore.hidden = false;
        update();
        return claimLabel(round.answer) + " has collected the most by " + round.lifespan + ". Move the life span to "
          + "see others.";
      } };
    }
    nodes.push(gameEl("p", "", "There is no right claim age. Which would you choose?"));
    nodes.push(gameChoices("Your claim age", round.ages.map((age) => [age, String(age)])), note);
    return { nodes, reveal: () => {
      play.pick = Number(play.answer);
      return gameRules.claimSentence(rows, play.pick, play.lifespan);
    } };
  }

  // The offer after Claim Age Showdown: set the claim age picked in round 3, absent at Low and when it is already set.
  function claimOffer() {
    if (play.id !== "claim" || play.pick == null || lowOn() || !state.inputs[play.who]) return null;
    if (Number(state.inputs[play.who].socialSecurityAge) === play.pick) return null;
    const button = gameButton("Set my claim age to " + play.pick, "button button-quiet",
      () => confirmClaimAge(play.who, play.pick), "gameClaimSet");
    if (play.who === "partner") button.textContent = "Set my partner's claim age to " + play.pick;
    return button;
  }

  // Ask first (old to new; Change or Cancel), then set the claim age as one Undo step; nothing is written when the
  // plan changed during the call, and a refusal shows the checker's message.
  function confirmClaimAge(who, age) {
    if (lowOn() || !state.inputs[who]) return;
    const whose = who === "partner" ? "Your partner's" : "Your";
    openDialog({ title: "Set the claim age?", text: whose + " Social Security claim age changes from "
      + state.inputs[who].socialSecurityAge + " to " + age + ". Undo puts it back.",
      actions: [["Change", "button", async () => { await setClaimAge(who, age); }, "gameClaimChange"],
        ["Cancel", "button button-quiet", () => true, "gameClaimCancel"]] });
  }

  async function setClaimAge(who, age) {
    if (!gamifyOn()) return;  // the mini games, and so this write, exist only with the gamify features on
    const inputsText = JSON.stringify(state.inputs);
    const reply = await ask("applySettings", [inputsText, JSON.stringify([{ path: who + ".socialSecurityAge",
      value: age }])]);
    if (inputsText !== JSON.stringify(state.inputs)) {
      gameStatus("Your plan changed; try again.");
      return;
    }
    if (!reply || !reply.ok || reply.error) {
      gameStatus((reply && reply.error) || "The claim age could not be set.");
      return;
    }
    if (settleTimer) settle();  // an edit still settling is a step of its own
    state.inputs = reply.inputs;
    renderSettings();
    inputsChanged();
    const set = $("gameClaimSet");
    if (set) set.remove();
    gameStatus("Claim age set to " + age + ". Undo puts it back.");
  }

  // ---- Receipt Sort ----
  function receiptScreen(round) {
    const placed = {};
    play.chosen = round.cards[0];
    const cards = gameEl("div", "gm-list");
    cards.setAttribute("role", "group");
    cards.setAttribute("aria-label", "Receipts");
    const bins = gameEl("div", "gm-list");
    bins.setAttribute("role", "group");
    bins.setAttribute("aria-label", "Paid from");
    const cardButtons = {};
    const paint = () => {
      for (const [id, button] of Object.entries(cardButtons)) button.setAttribute("aria-pressed", String(id === play.chosen));
    };
    const place = (bin) => {
      if (play.checked || !play.chosen || play.chosen in placed) return;
      const id = play.chosen;
      const receipt = gameRules.RECEIPTS.find((item) => item.id === id);
      const check = gameRules.receiptCheck(id, bin);
      const binLabel = (binId) => gameRules.BINS.find((item) => item.id === binId).label;
      placed[id] = bin;
      const button = cardButtons[id];
      button.dataset.result = check.correct ? "right" : "wrong";
      button.setAttribute("aria-disabled", "true");
      button.textContent = receipt.text + ": " + binLabel(bin) + (check.correct ? ", right. " : ", not quite: "
        + binLabel(check.bin) + ". ") + check.why;
      gameStatus(button.textContent);
      play.chosen = round.cards.find((card) => !(card in placed)) || null;
      paint();
      if (!play.chosen) play.answer = { ...placed };
    };
    for (const id of round.cards) {
      const receipt = gameRules.RECEIPTS.find((item) => item.id === id);
      const button = gameButton(receipt.text, "gm-card", () => {
        if (id in placed || play.checked) return;
        play.chosen = id;
        paint();
      });
      button.dataset.receipt = id;
      cardButtons[id] = button;
      cards.append(button);
    }
    gameRules.BINS.forEach((bin, index) => {
      const button = gameButton((index + 1) + ". " + bin.label, "gm-bin", () => place(bin.id));
      button.dataset.bin = bin.id;
      button.setAttribute("aria-keyshortcuts", String(index + 1));
      bins.append(button);
    });
    paint();
    play.placeReceipt = place;
    return { nodes: [gameEl("p", "", "Choose a receipt, then where it is generally paid from. Or press 1 to 4 to send "
      + "the chosen receipt."), cards, bins], reveal: (right) => (right ? "Every receipt on this screen is sorted right."
      : "Some receipts belong elsewhere; the reasons are on each card.") };
  }

  // ---- The Bad Decade ----
  const RETIREE = { first: "Retiree A (down years first)", second: "Retiree B (down years last)", equal: "They end equal" };

  function decadeBars(pair, label) {
    return gameBars([[RETIREE.first, pair.ends.first], [RETIREE.second, pair.ends.second]], label);
  }

  // The paths as a table, built only when its section opens.
  function decadeTable(pair) {
    const details = gameEl("details");
    details.append(gameEl("summary", "", "Show the paths as a table"));
    details.addEventListener("toggle", () => {
      if (!details.open || details.querySelector("table")) return;
      const table = gameEl("table", "data-table");
      const head = gameEl("tr");
      for (const name of ["Year", "A return", "A balance", "B return", "B balance"]) head.append(gameEl("th", "", name));
      table.append(head);
      pair.returns.first.forEach((rate, year) => {
        const row = gameEl("tr");
        for (const text of [String(year + 1), percent(rate, 0), fullMoney(pair.first[year + 1]),
          percent(pair.returns.second[year], 0), fullMoney(pair.second[year + 1])]) row.append(gameEl("td", "", text));
        table.append(row);
      });
      details.append(table);
    });
    return details;
  }

  function decadeScreen(round) {
    const start = fullMoney(gameRules.START);
    const choices = round.choices.map((id) => [id, RETIREE[id]]);
    const nodes = [];
    const after = gameEl("div", "dialog-body");
    after.hidden = true;
    if (round.kind === "predict") {
      nodes.push(gameEl("p", "", "Two retirees start with " + start + " and spend " + fullMoney(gameRules.SPEND)
        + " a year. They get the same ten yearly returns (illustrative, not a forecast), A with the down years first "
        + "and B with them last."), gameEl("p", "field-help", "A's returns: " + gameRules.RETURNS.map((rate) =>
        percent(rate, 0)).join(", ") + ". B's: the same, last to first."));
      nodes.push(gameChoices("Who ends higher after ten years?", choices), after);
      return { nodes, reveal: () => {
        const pair = gameRules.decadePair();
        after.append(decadeBars(pair, "After ten years"), decadeTable(pair));
        after.hidden = false;
        return "Same returns and same average, but A ends with " + fullMoney(pair.ends.first) + " and B with "
          + fullMoney(pair.ends.second) + ".";
      } };
    }
    if (round.kind === "withdraw") {
      nodes.push(gameEl("p", "", "Now both spend " + fullMoney(round.spend) + " a year. Who ends higher?"));
      nodes.push(gameChoices("Who ends higher?", choices), after);
      return { nodes, reveal: () => {
        let spend = round.spend;
        const line = gameEl("p", "gm-readout");
        line.id = "gameReadout";
        let bars = decadeBars(gameRules.decadePair(gameRules.START, spend), "After ten years");
        const update = (value) => {
          spend = Math.max(0, Math.min(gameRules.SPEND_MAX, value));
          const pair = gameRules.decadePair(gameRules.START, spend);
          const fresh = decadeBars(pair, "After ten years");
          bars.replaceWith(fresh);
          bars = fresh;
          line.textContent = "Spending " + fullMoney(spend) + " a year: A ends with " + fullMoney(pair.ends.first)
            + ", B with " + fullMoney(pair.ends.second) + ".";
        };
        const step = gameEl("div", "row-buttons");
        const down = gameButton("- " + fullMoney(gameRules.SPEND_STEP), "button button-quiet",
          () => update(spend - gameRules.SPEND_STEP), "gameDown");
        const up = gameButton("+ " + fullMoney(gameRules.SPEND_STEP), "button button-quiet",
          () => update(spend + gameRules.SPEND_STEP), "gameUp");
        down.setAttribute("aria-label", "Spend " + fullMoney(gameRules.SPEND_STEP) + " less a year");
        up.setAttribute("aria-label", "Spend " + fullMoney(gameRules.SPEND_STEP) + " more a year");
        step.append(down, up);
        after.append(bars, step, line);
        after.hidden = false;
        update(spend);
        return line.textContent + " With nothing withdrawn the order would not matter.";
      } };
    }
    nodes.push(gameEl("p", "", "Both now trim spending 10% in a year after a down year. Whose end balance gains more "
      + "from the trim?"));
    nodes.push(gameChoices("Gains more from the trim", choices), after);
    return { nodes, reveal: () => {
      const plain = gameRules.decadePair();
      const trimmed = gameRules.trimmedPair();
      after.append(decadeBars(trimmed, "After ten years with the trim"));
      after.hidden = false;
      return "With the trim A ends " + fullMoney(trimmed.ends.first - plain.ends.first) + " higher and B "
        + fullMoney(trimmed.ends.second - plain.ends.second) + " higher: cutting back early helps most when the "
        + "down years come first.";
    } };
  }

  function wireGames() {
    $("gameBackdrop").addEventListener("click", closeGame);
    $("gameDialog").addEventListener("keydown", (event) => {
      trapFocus(event, $("gameDialog"));
      if (play.id !== "receipts" || !(event.key in GAME_DIGITS) || !play.placeReceipt) return;
      if (event.target.closest("input, textarea, select")) return;
      event.preventDefault();
      play.placeReceipt(gameRules.BINS[GAME_DIGITS[event.key]].id);
    });
  }
  // ---- Glass Garden (Gamer style only) ----
  // The Garden tab's terrarium (rules in gamify.js): one bed per walkthrough topic and three tools (each opening a
  // mini game, 54-tool-games.js), opened by level; a bed's soil is how
  // much of the topic is filled in, the plants grow with the latest simulation's chance of success, and the Plan year
  // slider turns the seasons. The garden is drawn from the plan, the walkthrough answers, the latest Monte Carlo and the
  // ledger every time the tab renders, and stores nothing; playing never changes the plan. Also the level-up card
  // (through openDialog) naming the steps that earned a level. Built only while the Garden tab is open (renderAwards).
  const { tierShown } = window.WmtiShared;  // walkLabel comes from 00-core.js

  // The chance of success of a Monte Carlo result (1 less the chance of running out), or null.
  function gardenSuccess(entry) {
    const headlines = entry && entry.value && Array.isArray(entry.value.headlines) ? entry.value.headlines : [];
    const out = headlines.find((item) => item.label === "Chance of running out");
    return out && Number.isFinite(out.value) ? 1 - out.value : null;
  }

  // The value at a walkthrough field path (list selectors such as `accounts[Savings]` resolved) of some data.
  function gardenValueAt(data, path) {
    if (data == null) return undefined;
    const indexed = walkIndexedPath(data, path);
    return indexed == null ? undefined : getPath(data, indexed);
  }

  // Everything the Garden draws, read from the state; nothing is written.
  function gardenModel() {
    const ledger = state.game.ledger;
    const xp = gamify.xpOf(ledger);
    const level = gamify.levelOf(xp);
    const effort = shownExperience().effort;
    const saved = state.experience && isObject(state.experience.walk) ? state.experience.walk : {};
    const counts = state.walkTree ? gamify.bedCounts(state.walkTree, { answers: saved.answers, opened: saved.opened,
      inputs: state.inputs, defaults: state.defaults, effort, tierShown, valueAt: gardenValueAt, same: sameValue }) : [];
    const open = gamify.bedsOpen(level.level);
    const { entry, stale } = latestMonteCarlo();
    const share = gardenSuccess(entry);
    const years = Math.max(1, planYears(state.inputs) || 1);
    const yearMax = years - 1;
    gamer.year = Math.min(Math.max(0, Number(gamer.year) || 0), yearMax);
    const quests = gamify.questStatus(gamerFacts(), ledger, effort);
    const nextQuest = quests.find((quest) => quest.state === "open") || null;
    return { xp, level, effort, counts, open, soil: gamify.soilOf(counts, open), share, stale: Boolean(entry) && stale,
      growth: gamify.growthStage(share), yearMax, startYear: Number(state.info.lawTaxYear) || new Date().getFullYear(),
      nextQuest };
  }

  // The Next step line: the first open quest, else more walkthrough answers, else nothing at the top level.
  function gardenNextStep(model) {
    if (model.level.next == null) return "You are at the top level; every bed is open.";
    if (model.nextQuest) return "Next step: " + model.nextQuest.title + " (" + model.nextQuest.xp + " XP). "
      + model.nextQuest.how;
    return "Next step: answer more questions in Walk me through it (" + gamify.XP.walkAnswer + " XP each).";
  }

  const gardenPercent = (share) => Math.round(Math.max(0, Math.min(1, share)) * 100) + " percent";
  const gardenSeasonText = (model) => {
    const season = gamify.seasonAt(gamer.year);
    return (model.startYear + season.year) + ", " + season.name;
  };

  // One plant (decorative): a dashed ghost for an empty slot, else its growth stage, 0 a seedling to 4 in bloom.
  function plantSvg(stage, ghost) {
    const leaf = (x, y, turn, size) => "<ellipse class=\"gd-leaf\" cx=\"" + x + "\" cy=\"" + y + "\" rx=\""
      + (size * 7) + "\" ry=\"" + (size * 3) + "\" transform=\"rotate(" + turn + " " + x + " " + y + ")\"/>";
    let shape;
    if (ghost) shape = "<path class=\"gd-ghost\" d=\"M20 62V36M20 31a5 5 0 1 1 0 .01\"/>";
    else if (stage <= 0) shape = "<path class=\"gd-stem\" d=\"M20 62V54\"/>" + leaf(16, 55, -30, 0.6)
      + leaf(24, 54, 30, 0.6);
    else if (stage === 1) shape = "<path class=\"gd-stem\" d=\"M20 62V44\"/>" + leaf(15, 52, -30, 0.8)
      + leaf(25, 47, 30, 0.8);
    else {
      shape = "<path class=\"gd-stem\" d=\"M20 62C18 50 22 38 20 22\"/>" + leaf(13, 54, -28, 1.1)
        + leaf(27, 48, 28, 1.1) + leaf(14, 40, -34, 1) + leaf(26, 33, 34, 0.9);
      if (stage === 3) shape += "<ellipse class=\"gd-bud\" cx=\"20\" cy=\"18\" rx=\"5\" ry=\"7\"/>";
      if (stage >= 4) {
        shape += [0, 72, 144, 216, 288].map((turn) => "<ellipse class=\"gd-petal\" cx=\"20\" cy=\"9\" rx=\"4.5\" "
          + "ry=\"7\" transform=\"rotate(" + turn + " 20 16)\"/>").join("") + "<circle class=\"gd-core\" cx=\"20\" "
          + "cy=\"16\" r=\"3.5\"/>";
      }
    }
    return "<svg class=\"gd-plant\" viewBox=\"0 0 40 64\" aria-hidden=\"true\" focusable=\"false\"><g class=\"gd-sway\">"
      + shape + "</g></svg>";
  }

  // A bed's state: locked below its level, rest (no question at this effort, or an optional topic not opened),
  // complete when every question is filled, else open.
  function bedState(bed, model) {
    if (!model.open.includes(bed.id)) return "locked";
    if (bed.rest) return "rest";
    return bed.filled >= bed.total ? "complete" : "open";
  }

  // One bed: a real button whose name carries its state; the plants, soil and frosted cover are decoration.
  function bedHtml(bed, model) {
    const state = bedState(bed, model);
    const share = bed.total ? bed.filled / bed.total : 0;
    let name;
    let label;
    let plants = "";
    if (state === "locked") {
      name = bed.title + " bed, locked. Opens at level " + bed.level;
      label = "<span class=\"gd-cover\"><strong>" + escapeText(bed.title) + "</strong><span>Level " + bed.level
        + "</span></span>";
    } else if (state === "rest") {
      name = bed.title + " bed, optional. Walk me through it to open";
      label = "<span class=\"gd-label\"><strong>" + escapeText(bed.title) + "</strong><span>Optional</span></span>";
      plants = [0, 1, 2, 3].map(() => plantSvg(0, true)).join("");
    } else {
      const done = state === "complete" ? ", complete" : "";
      name = bed.title + " bed, " + bed.filled + " of " + bed.total + " filled, soil " + gardenPercent(share) + done;
      label = "<span class=\"gd-label\"><strong>" + escapeText(bed.title) + "</strong><span>"
        + (state === "complete" ? "Complete" : bed.filled + " of " + bed.total) + "</span></span>";
      const grown = bed.filled > 0 ? Math.max(1, Math.round(4 * share)) : 0;
      plants = [0, 1, 2, 3].map((slot) => plantSvg(model.growth.stage, slot >= grown)).join("");
    }
    return "<button type=\"button\" class=\"gd-bed\" data-bed=\"" + escapeText(bed.id) + "\" data-state=\"" + state
      + "\" style=\"--soil: " + share.toFixed(2) + "\" aria-label=\"" + escapeText(name) + "\"><span class=\"gd-plants\" "
      + "aria-hidden=\"true\">" + plants + "</span><span class=\"gd-soil-wrap\" aria-hidden=\"true\"><span "
      + "class=\"gd-soil\"></span></span>" + label + "</button>";
  }

  // The tools row: each tool a button; an open one starts its game, a locked one says its level.
  function toolHtml(model) {
    return "<div class=\"gd-tools\" role=\"group\" aria-label=\"Garden tools\">" + gamify.TOOLS.map((tool) => {
      const open = model.level.level >= tool.level;
      const game = GAME_TITLES[tool.game];
      const name = open ? tool.title + ": play " + game : tool.title + ", locked. Opens at level " + tool.level;
      return "<button type=\"button\" class=\"gd-tool\" data-tool=\"" + tool.id + "\" data-game=\"" + tool.game
        + "\" data-state=\"" + (open ? "open" : "locked") + "\" aria-label=\"" + escapeText(name) + "\"><b>"
        + escapeText(tool.title) + "</b><span>" + (open ? escapeText(game) : "Level " + tool.level) + "</span></button>";
    }).join("") + "</div>";
  }

  // The three chips under the scene: soil, plants and season, each a button that explains itself below.
  function gardenChips(model) {
    const chip = (kind, small, big, name) => "<button type=\"button\" class=\"gd-chip\" data-detail=\"" + kind
      + "\" aria-label=\"" + escapeText(name) + "\"><small>" + escapeText(small) + "</small><b" + (kind === "season"
        ? " id=\"gdSeasonChip\"" : "") + ">" + escapeText(big) + "</b></button>";
    const season = gardenSeasonText(model);
    return "<div class=\"gd-chips\">" + chip("soil", "Soil", Math.round(model.soil * 100) + "%", "Soil "
      + gardenPercent(model.soil) + ", how much of your plan you have filled in")
      + chip("growth", "Plants", model.growth.name, "Plants " + model.growth.name + ", from the chance of success")
      + chip("season", "Season", season, "Season " + season + ", from the Plan year") + "</div>";
  }

  // The line under the scene saying how healthy the plan looks, or how to find out.
  function gardenStatusHtml(model) {
    if (model.share == null) {
      return "<p class=\"gd-status\">Your plants are seedlings. Run the simulation to see how healthy the plan is. "
        + "<button type=\"button\" class=\"button button-quiet gd-run\">Go to Summary</button></p>";
    }
    return "<p class=\"gd-status\">Your plants are " + escapeText(model.growth.name) + ": the " + (model.stale
      ? "earlier run" : "latest run") + " gives a " + gardenPercent(model.share) + " chance of success.</p>";
  }

  // The Garden: the terrarium with its beds, the chips, the status line and the Plan year slider.
  function gardenHtml(model) {
    const season = gamify.seasonAt(gamer.year).season;
    const beds = model.counts.map((bed) => bedHtml(bed, model)).join("");
    return "<section class=\"card gd-scene\" aria-labelledby=\"gdTitle\"><div class=\"card-head\"><h2 id=\"gdTitle\">"
      + "Glass Garden</h2></div><div class=\"gd-stage\" id=\"gdStage\" data-season=\"" + season + "\" data-growth=\""
      + model.growth.stage + "\"><svg class=\"gd-house\" viewBox=\"0 0 300 120\" preserveAspectRatio=\"none\" "
      + "aria-hidden=\"true\" focusable=\"false\"><path class=\"gd-hills\" d=\"M0 80c50-24 100-16 150 0s100-8 150-16"
      + "v56H0z\"/><path class=\"gd-frame\" d=\"M6 120V40Q150-20 294 40V120\"/><path class=\"gd-frame\" "
      + "d=\"M80 120V14M150 120V6M220 120V14\"/></svg><div class=\"gd-beds\" role=\"group\" aria-label=\"Garden beds\">"
      + beds + "</div></div>" + toolHtml(model) + gardenChips(model) + gardenStatusHtml(model) + "<div class=\"gd-year\"><label "
      + "class=\"field-label\" for=\"gdYear\">Plan year</label><input type=\"range\" id=\"gdYear\" min=\"0\" max=\""
      + model.yearMax + "\" step=\"0.25\" value=\"" + gamer.year + "\" aria-valuetext=\""
      + escapeText(gardenSeasonText(model)) + "\"><output id=\"gdYearText\" for=\"gdYear\">"
      + escapeText(gardenSeasonText(model)) + "</output></div></section>";
  }

  // The words of the detail area for a bed or a chip (`kind` bed, soil, growth or season).
  function gardenDetailHtml(kind, id, model) {
    const walkButton = "<button type=\"button\" class=\"button button-quiet gd-walk\">Walk me through it</button>";
    if (kind === "bed") {
      const bed = model.counts.find((item) => item.id === id);
      if (!bed) return "";
      const state = bedState(bed, model);
      const head = "<h3>" + escapeText(bed.title) + "</h3>";
      if (state === "locked") {
        return head + "<p>Opens at level " + bed.level + ". You are at level " + model.level.level + ".</p><p>"
          + escapeText(gardenNextStep(model)) + "</p>";
      }
      if (state === "rest") {
        return head + "<p>Optional: Walk me through it to open. No questions of this topic are asked at this effort "
          + "yet.</p>" + walkButton;
      }
      return head + "<p>" + bed.filled + " of " + bed.total + " questions filled in" + (state === "complete"
        ? ". Complete." : ", soil " + gardenPercent(bed.filled / bed.total) + ".") + "</p><p class=\"field-help\">A "
        + "question counts once you answer it in Walk me through it or change its input from the example.</p>"
        + walkButton;
    }
    if (kind === "tool") {
      const tool = gamify.TOOLS.find((item) => item.id === id);
      if (!tool) return "";
      return "<h3>" + escapeText(tool.title) + "</h3><p>Opens " + escapeText(GAME_TITLES[tool.game]) + " at level "
        + tool.level + ". You are at level " + model.level.level + ".</p><p>" + escapeText(gardenNextStep(model))
        + "</p>";
    }
    if (kind === "soil") {
      const open = model.counts.filter((bed) => model.open.includes(bed.id) && !bed.rest);
      const filled = open.reduce((sum, bed) => sum + bed.filled, 0);
      const total = open.reduce((sum, bed) => sum + bed.total, 0);
      return "<h3>Soil</h3><p>" + filled + " of " + total + " questions of your open beds are filled in: soil "
        + gardenPercent(model.soil) + ". Richer soil means more plants in each bed.</p>";
    }
    if (kind === "growth") {
      return "<h3>Plants</h3><p>" + (model.share == null ? "Seedlings: no simulation yet. Run it in Outputs, Summary."
        : "Plants " + escapeText(model.growth.name) + " for a " + gardenPercent(model.share) + " chance of success.")
        + " The plants follow your plan; playing never changes it.</p>";
    }
    if (kind === "season") {
      return "<h3>Season</h3><p>Plan year " + escapeText(gardenSeasonText(model)) + ". Move the Plan year slider to "
        + "turn the seasons; nothing is saved or run.</p>";
    }
    return "";
  }

  // Fill the detail area (a polite live region) for a bed or a chip; the focus stays where it is.
  function showGardenDetail(kind, id) {
    gamer.detail = { kind, id };
    const detail = $("gardenDetail");
    if (detail) detail.innerHTML = gardenDetailHtml(kind, id, gardenModel());
  }

  // The detail area's markup for the render (the last bed or chip chosen, else a hint).
  function gardenDetailBox(model) {
    const kept = gamer.detail ? gardenDetailHtml(gamer.detail.kind, gamer.detail.id, model) : "";
    return "<div class=\"card gd-detail\" id=\"gardenDetail\" aria-live=\"polite\">" + (kept
      || "<p class=\"field-help\">Choose a bed or a chip to see what it shows.</p>") + "</div>";
  }

  // The Plan year slider: the season on the stage and the label follow; nothing is saved, rendered again or run.
  function gardenYear(input) {
    gamer.year = Number(input.value) || 0;
    const season = gamify.seasonAt(gamer.year);
    const text = (Number(state.info.lawTaxYear) || new Date().getFullYear()) + season.year + ", " + season.name;
    $("gdStage").dataset.season = String(season.season);
    $("gdYearText").textContent = text;
    $("gdSeasonChip").textContent = text;
    input.setAttribute("aria-valuetext", text);
  }

  // A grant's line on the level-up card: the quest, the question answered or the game finished.
  function gardenNameOf(grant) {
    if (grant.kind === "answer") {
      const found = state.walkTree ? walkIndex(state.walkTree)[grant.id] : null;
      return "Answered: " + (found ? walkLabel(found.node) : grant.id);
    }
    if (grant.kind === "game") {
      const title = GAME_TITLES[grant.id] || grant.id;
      return grant.key.endsWith(".done") ? "Finished " + title : "3 stars in " + title;
    }
    return grant.title || grant.key;
  }

  // Whether the level-up card may show now: the Garden tab is open and no dialog, game or walkthrough is.
  function gardenCanReveal() {
    return awardsShown() && $("dialog").hidden && $("gameDialog").hidden && !walk.open;
  }

  // The level-up card: the level, what earned it (largest XP first) and what opened. Escape or the button closes it.
  function showLevelUp(card) {
    const box = document.createElement("div");
    box.className = "gd-reveal";
    box.innerHTML = "<p>What earned it:</p><ul>" + card.steps.map((step) => "<li>" + escapeText(step.text) + ": +"
      + step.xp + " XP</li>").join("") + (card.more ? "<li>and " + card.more + " more</li>" : "") + "</ul>"
      + (card.unlocks.length ? "<p>Now open: " + escapeText(card.unlocks.join(", ")) + ".</p>" : "")
      + "<p class=\"field-help\">XP pays once. The garden follows your plan; playing never changes it.</p>";
    const active = document.activeElement;
    if ((!active || active === document.body) && $("gmLevel")) $("gmLevel").focus();
    openDialog({ title: "Level " + card.level + ": " + card.name, body: [box],
      actions: [["Back to the garden", "button", () => true, "gardenRevealClose"]] });
  }

  // Show a level-up card waiting for the Garden, once nothing else is open.
  function maybeShowPending() {
    if (!gamer.pending || !gardenCanReveal()) return;
    const card = gamer.pending;
    gamer.pending = null;
    showLevelUp(card);
  }

  // Close an open level-up card (leaving Gamer).
  function closeLevelUp() {
    if (!$("dialog").hidden && $("gardenRevealClose")) closeDialog(false);
  }

  function wireGarden() {
    $("awards-body").addEventListener("click", (event) => {
      const bed = event.target.closest(".gd-bed");
      if (bed) { showGardenDetail("bed", bed.dataset.bed); return; }
      const tool = event.target.closest(".gd-tool");
      if (tool && tool.dataset.state === "open") { openGame(tool.dataset.game, { returnFocus: tool }); return; }
      if (tool) { showGardenDetail("tool", tool.dataset.tool); return; }
      const chip = event.target.closest(".gd-chip");
      if (chip) { showGardenDetail(chip.dataset.detail, null); return; }
      if (event.target.closest(".gd-walk")) { openWalk(); return; }
      if (event.target.closest(".gd-run")) selectView("summary");
    });
    $("awards-body").addEventListener("input", (event) => {
      if (event.target.id === "gdYear") gardenYear(event.target);
    });
  }
  // ---- The Garden's tool games (Gamer style only) ----
  // Drift Seesaw (rebalancing), Plug the Leaks (fees) and Early Bird Snowball (starting early): the games the
  // Garden's tools open (watering can, shears, seed pouch; gamify.js TOOLS). Rules in games.js; the screens here use
  // the shared pop-up of 52-games.js (gameEl, gameChoices, gameBars), radio answers only, no clock, generic numbers and
  // no user data. Each picture is decoration; its facts are in the text, the live readout or a table.

  // Whether game `id` may open: any game that is not a tool's, or a tool's once the level reaches it.
  function toolGameOpen(id) {
    const tool = gamify.toolOf(id);
    return !tool || gamify.levelOf(gamify.xpOf(state.game.ledger)).level >= tool.level;
  }

  // A polite live line under a game's picture.
  function toolReadout(text) {
    const line = gameEl("p", "gm-readout", text || "");
    line.id = "gameReadout";
    line.setAttribute("aria-live", "polite");
    return line;
  }

  // A decorative picture from SVG markup (built from numbers only).
  function toolPicture(className, markup) {
    const holder = gameEl("div", className);
    holder.setAttribute("aria-hidden", "true");
    holder.innerHTML = markup;
    return holder;
  }

  // ---- Drift Seesaw ----
  const SEESAW_VIEW = { width: 300, height: 120, top: 0.8, bottom: 0.4 };

  // The stock share line of `path` over the green band, and a beam tilted by the last month's drift.
  function seesawSvg(path) {
    const rules = gameRules.SEESAW;
    const { width, height, top, bottom } = SEESAW_VIEW;
    const y = (share) => (height * (top - Math.min(top, Math.max(bottom, share))) / (top - bottom)).toFixed(1);
    const x = (index) => (20 + index * ((width - 30) / (path.length - 1))).toFixed(1);
    const line = path.map((share, index) => (index ? "L" : "M") + x(index) + " " + y(share)).join("");
    const tilt = Math.max(-20, Math.min(20, (path[path.length - 1] - rules.target) * 200)).toFixed(1);
    return "<svg viewBox=\"0 0 " + width + " " + (height + 40) + "\"><rect class=\"gm-band\" x=\"0\" y=\""
      + y(rules.high) + "\" width=\"" + width + "\" height=\"" + (y(rules.low) - y(rules.high)).toFixed(1) + "\"/>"
      + "<path class=\"gm-line\" d=\"" + line + "\"/><g transform=\"translate(150 " + (height + 22) + ") rotate("
      + tilt + ")\"><rect class=\"gm-beam\" x=\"-90\" y=\"-3\" width=\"180\" height=\"6\" rx=\"3\"/></g><path "
      + "class=\"gm-pivot\" d=\"M150 " + (height + 22) + "l-9 16h18z\"/></svg>";
  }

  // The plain path as a table, built when its section opens.
  function seesawTable(returns) {
    const details = gameEl("details");
    details.append(gameEl("summary", "", "Show the months as a table"));
    details.addEventListener("toggle", () => {
      if (!details.open || details.querySelector("table")) return;
      const table = gameEl("table", "data-table");
      const head = gameEl("tr");
      for (const name of ["Month", "Stock return", "Stocks, never rebalanced"]) head.append(gameEl("th", "", name));
      table.append(head);
      gameRules.driftPath(returns).forEach((share, index) => {
        const row = gameEl("tr");
        for (const text of [String(index + 1), percent(returns[index], 1), percent(share, 1)]) {
          row.append(gameEl("td", "", text));
        }
        table.append(row);
      });
      details.append(table);
    });
    return details;
  }

  function seesawScreen(round) {
    const rules = gameRules.SEESAW;
    const picture = toolPicture("gm-ladder gm-seesaw", seesawSvg(gameRules.driftPath(round.returns)));
    const readout = toolReadout("Drawn: never rebalanced. The mix ends at "
      + percent(gameRules.driftPath(round.returns).slice(-1)[0], 0) + " stocks.");
    const choices = gameChoices("Rebalancing plan", round.options.map((option) => [option.id, option.label]));
    choices.addEventListener("change", () => {
      const option = round.options.find((item) => item.id === play.answer);
      if (!option) return;
      const path = gameRules.driftPath(round.returns, option.months);
      picture.innerHTML = seesawSvg(path);
      readout.textContent = "Drawn: " + option.label.toLowerCase() + ".";
    });
    const nodes = [gameEl("p", "", "Your mix starts at " + percent(rules.target, 0) + " stocks; the green band is "
      + percent(rules.low, 0) + " to " + percent(rules.high, 0) + ". Stocks swing month to month (illustrative), "
      + "bonds earn a little. Which plan keeps you in the green band the most months?"), picture, readout, choices,
    seesawTable(round.returns)];
    return { nodes, reveal: () => round.options.map((option) => option.label + ": " + option.inBand + " of "
      + rules.months).join("; ") + "." };
  }

  // ---- Plug the Leaks ----
  const leakLabel = (id) => gameRules.leakPool().find((leak) => leak.id === id).label;
  const leakText = (ids) => ids.map((id) => leakLabel(id).toLowerCase()).join(" and ");

  // A tank whose water stands at `share` of the fee-free end value.
  function leakTank(share) {
    const level = (110 - 100 * Math.max(0, Math.min(1, share))).toFixed(1);
    return "<svg viewBox=\"0 0 300 120\"><rect class=\"gm-tank\" x=\"100\" y=\"8\" width=\"100\" height=\"104\" "
      + "rx=\"8\"/><rect class=\"gm-water\" x=\"104\" y=\"" + level + "\" width=\"92\" height=\"" + (110 - level)
      .toFixed(1) + "\" rx=\"4\"/></svg>";
  }

  function leaksScreen(round) {
    const all = gameRules.leakFee(round.leaks);
    const free = gameRules.leakValue(0);
    const left = (option) => all - gameRules.leakFee(option.plugs);
    const picture = toolPicture("gm-ladder gm-leaks", leakTank(gameRules.leakValue(all) / free));
    const readout = toolReadout("Fees now: " + percent(all, 2) + " a year.");
    const list = gameEl("ul");
    for (const id of round.leaks) {
      list.append(gameEl("li", "", leakLabel(id) + ": " + percent(gameRules.leakPool()
        .find((leak) => leak.id === id).fee, 2) + " a year"));
    }
    const pair = round.kind === "pair";
    const choices = gameChoices(pair ? "Plug two" : "Plug one", round.options.map((option) => [option.id,
      "Plug the " + leakText(option.plugs)]));
    choices.addEventListener("change", () => {
      const option = round.options.find((item) => item.id === play.answer);
      if (!option) return;
      picture.innerHTML = leakTank(gameRules.leakValue(left(option)) / free);
      readout.textContent = "Fees left: " + percent(left(option), 2) + " a year.";
    });
    const nodes = [gameEl("p", "", fullMoney(100000) + " grows for 30 years at 6% a year, less these yearly fees. "
      + (pair ? "Plug two: which pair saves the most?" : "Plug one: which saves the most?")), list, picture, readout,
    choices];
    return { nodes, reveal: () => round.options.map((option) => "Plug the " + leakText(option.plugs) + ": "
      + percent(left(option), 2) + " left, ends with " + fullMoney(gameRules.leakValue(left(option))))
      .join("; ") + ". With no fees: " + fullMoney(free) + "." };
  }

  // ---- Early Bird Snowball ----
  function snowballScreen(round) {
    const { rival, rivalStart, you } = round.preset;
    const readout = toolReadout("");
    const choices = gameChoices("Latest start age", round.choices.map((age) => [age, "Start at " + age]));
    choices.addEventListener("change", () => {
      if (play.answer == null) return;
      readout.textContent = "Starting at " + play.answer + ": " + (65 - Number(play.answer)) + " years of saving.";
    });
    const after = gameEl("div", "dialog-body");
    after.hidden = true;
    const nodes = [gameEl("p", "", "Your rival saves " + fullMoney(rival) + " a month from age " + rivalStart
      + " to 65. You save " + fullMoney(you) + " a month. At 7% a year, what is the latest age you can start and "
      + "still end with more?"), choices, readout, after];
    return { nodes, reveal: () => {
      const mine = gameRules.snowballValue(you, round.answer);
      const theirs = gameRules.snowballValue(rival, rivalStart);
      after.append(gameBars([["You, from " + round.answer, mine], ["Rival, from " + rivalStart, theirs]],
        "At 65"));
      after.hidden = false;
      return "Start at " + round.answer + ": " + fullMoney(mine) + "; rival: " + fullMoney(theirs) + ". A year later "
        + "and you end below.";
    } };
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
    for (const name of selected) if (state.scenarios[name]) saved[name] = splitExperience(state.scenarios[name]).inputs;
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
    gamerTick();  // a new comparison may finish a quest
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
    // Why the after-tax column can be above Median final (accounts only), behind the "i" beside the heading.
    const about = titleHelp("h2", "Comparison", result.afterTaxHelp);
    // The rate and its source stay on screen; the after-tax caption (how r* is read) is behind its "i".
    const source = /rate of [\d.]+% \(([^)]*)\)/.exec(result.caption);
    const rateNote = noteHelp((result.terminalRate == null
      ? "Beneficiaries' tax at their brackets, by each row's payout (set in Benefits, Beneficiaries)"
      : "Beneficiaries' tax rate " + percent(result.terminalRate, 1) + " (" + (source ? source[1] + "; " : "")
        + "set in Benefits, Beneficiaries)") + ".",
    result.caption, "field-help");
    top.className = "card" + (stale ? " stale-results" : "");
    top.innerHTML = (stale ? "<p class=\"banner banner-warn\" role=\"note\">The settings, selection, runs or seed "
      + "changed since this comparison. Press Run to update it; the figures below are from the earlier run.</p>" : "")
      + "<div class=\"card-head\">" + about.head + "<span class=\"chart-note\">" + result.runs + " runs each · seed "
      + escapeText(result.seed) + " · " + secondsText(entry.ms) + "</span></div>" + about.text
      + charts.renderUnitsTable(result.table, result.columnUnits, { title: "Comparison", wrapFirst: true })
      + rateNote.head + rateNote.text
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
      figures.push([card.querySelector("figure"), card.chartSpec]);
      parts.push(card);
    }
    requestAnimationFrame(() => figures.forEach(([figure, spec]) => figure && charts.attachChart(figure, spec)));
    return parts;
  }

  // ---- Accountant extras on Summary: Why this number?, the Estimates card, What changed since the last run and the
  // ledger CSV ----
  // They read inputs and results only: nothing here writes an input, runs a simulation or changes a figure. Every
  // style shows them (styles stack); one device switch (EXTRAS_KEY, in the Effort and style dialog) hides the notes,
  // and none of them shows with the gamify features off (gamifyOn). wmti.dashboard.provenance gives the run facts, key
  // inputs, law rows and estimates of an inputs text ("provenance", kept per inputs text); the run diff compares the
  // shown Monte Carlo with the other kept one of the same scenario ("compareDifferences"); the ledger is the Monte
  // Carlo's year-by-year tables (report.js ledgerCsv). Law text from the files is set with textContent only.
  const { runChangePlan, runChangeRows, differenceLines, extrasOn } = window.WmtiShared;
  const { ledgerCsv, ledgerFilename } = report;
  const MAX_ESTIMATE_ROWS = 5;  // estimates the card lists; more are counted
  const MAX_CHANGE_LINES = 8;  // settings lines the run diff lists; more are counted
  const LEDGER_HELP = "The year-by-year tables of the Final report (the middle half average of the runs, the same "
    + "numbers): the yearly summary, the accounts, the taxes and the deductions, one row per year, in whole dollars. "
    + "UTF-8 with a byte-order mark, so Excel opens it as it is.";
  const EXTRAS_HELP = "Why? buttons on the Summary figures, the Estimates card and What changed since the last run. They "
    + "describe the settings and results; they never change them.";
  state.accountant = { why: { key: null, value: null, pending: null }, changes: { key: null, value: null, pending: null },
    open: null, csv: null, changesOpen: false };
  const accountantTurn = { why: 0, changes: 0 };
  window.wmtiAccountant = { state: () => state.accountant, openWhy, downloadLedger,  // for the tests
    cache: () => state.mc.cache.map(({ key, scenario, seq, value }) => ({ key, scenario, seq, tables: value.tables })) };

  // Whether the source notes and estimates show: never with the gamify features off; else the device switch, on
  // unless saved "off" (storage blocked: on).
  function accountantExtrasOn() {
    if (!gamifyOn()) return false;
    try { return extrasOn(localStorage.getItem(EXTRAS_KEY)); } catch (error) { return true; }
  }

  function setAccountantExtras(on) {
    if (!gamifyOn()) return;
    try { localStorage.setItem(EXTRAS_KEY, on ? "on" : "off"); } catch (error) { /* storage blocked: on for this visit */ }
  }

  // The Effort and style dialog's switch (settings mode): `choice.extras` follows the box; applied on Save only.
  function extrasGroup(choice) {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "experience-group extras-group";
    fieldset.id = "xpPick-extras";
    const legend = document.createElement("legend");
    legend.textContent = "Source notes";
    const row = document.createElement("label");
    row.className = "experience-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = "xpPick-extrasOn";
    input.checked = choice.extras !== false;
    input.addEventListener("change", () => { choice.extras = input.checked; });
    const label = document.createElement("span");
    label.className = "experience-label";
    label.textContent = "Show source notes and estimates";
    const blurb = document.createElement("span");
    blurb.className = "experience-blurb";
    blurb.textContent = EXTRAS_HELP;
    row.append(input, label, blurb);
    fieldset.append(legend, row);
    return fieldset;
  }

  // The inputs text a tile's figure ran on: the shown Monte Carlo's (ranInputs) or the single run's.
  function whyInputsText(source) {
    if (source === "single") return state.resultInputsText;
    const { entry, stale } = latestMonteCarlo();
    return JSON.stringify(entry ? ranInputs(entry, stale) : state.inputs);
  }

  // A tile's Why? button: "" when the notes are off, or for the single run's tile while it runs.
  function accountantWhyButton(headline, source) {
    if (!accountantExtrasOn() || !source || (source === "single" && (singleBusy || !state.resultInputsText))) return "";
    return "<button type=\"button\" class=\"button button-quiet tile-why\" data-why=\"" + escapeText(headline.label)
      + "\" data-source=\"" + source + "\" aria-label=\"Why this number? " + escapeText(headline.label)
      + "\">Why?</button>";
  }

  // Ask for the provenance of `inputsText` (one request in flight, a newer one replaces it); the cards and an open
  // pop-up for it are filled in place when it arrives.
  async function loadProvenance(inputsText) {
    const why = state.accountant.why;
    if (!gamifyOn() || !inputsText || why.key === inputsText || why.pending === inputsText) return;
    why.pending = inputsText;
    const turn = ++accountantTurn.why;
    const reply = await ask("provenance", [inputsText], "why");
    if (turn !== accountantTurn.why) return;
    why.pending = null;
    if (!reply) return;
    why.key = inputsText;
    why.value = reply;
    refreshAccountant();
    if (state.accountant.open && state.accountant.open.inputsText === inputsText) fillWhy();
  }

  function provenanceOf(inputsText) {
    const why = state.accountant.why;
    return why.key === inputsText ? why.value : null;
  }

  // Ask for the settings that differ between the two runs of `plan` (runChangePlan), kept per pair.
  async function loadRunChanges(plan) {
    const changes = state.accountant.changes;
    const key = JSON.stringify([plan.previousInputsText, plan.currentInputsText]);
    if (changes.key === key || changes.pending === key) return;
    changes.pending = key;
    const turn = ++accountantTurn.changes;
    const reply = await ask("compareDifferences", [plan.previousInputsText, plan.currentInputsText, "Last run",
      "This run"], "changes");
    if (turn !== accountantTurn.changes) return;
    changes.pending = null;
    if (!reply) return;
    changes.key = key;
    changes.value = reply;  // its `problems` (merge buttons) are not used here
    refreshAccountant();
  }

  // The Estimates card of the figures' inputs: the estimates the plan rests on (up to MAX_ESTIMATE_ROWS, each with
  // Why?); "" when there are none or the provenance has not arrived.
  function estimatesCardHtml(inputsText, stale) {
    const found = provenanceOf(inputsText);
    if (!found) { loadProvenance(inputsText); return ""; }
    if (!found.ok || !Array.isArray(found.estimates) || !found.estimates.length) return "";
    const shown = found.estimates.slice(0, MAX_ESTIMATE_ROWS);
    const more = found.estimates.length - shown.length;
    return "<div class=\"card accountant-card" + (stale ? " stale-results" : "") + "\" id=\"estimatesCard\">"
      + "<div class=\"card-head\"><h2>Estimates</h2></div><p class=\"note\">These parts of the plan rest on figures "
      + "that are not confirmed.</p><ul class=\"estimate-list\">" + shown.map((item) => "<li class=\"estimate-row\" "
        + "data-row=\"" + escapeText(item.id) + "\"><span class=\"estimate-label\">" + escapeText(item.label)
        + "</span><span class=\"estimate-pill\">estimate</span><button type=\"button\" class=\"button button-quiet "
        + "estimate-why\" data-row=\"" + escapeText(item.id) + "\" aria-label=\"Why? " + escapeText(item.label)
        + "\">Why?</button></li>").join("") + "</ul>"
      + (more > 0 ? "<p class=\"note\">" + more + " more in the Why? pop-up.</p>" : "") + "</div>";
  }

  function headlineValueText(unit, value) {
    return unit === "percent" ? percent(value, 1) : fullMoney(value);
  }

  function changeText(row) {
    if (row.change == null) return "no change";
    const sign = row.change > 0 ? "+" : "−";
    return row.unit === "percent" ? sign + Math.abs(row.change).toFixed(1) + " points"
      : sign + fullMoney(Math.abs(row.change));
  }

  // What changed since the last run: the shown Monte Carlo against the other kept one of the same scenario, in the
  // direction other to shown; "" when there is none, at Low, or with the notes off.
  function runChangesCardHtml(entry, stale) {
    const kept = state.mc.cache.find((item) => item !== entry);
    const plan = runChangePlan(entry, kept);
    if (!plan) return "";
    const lead = plan.direction === "earlier" ? "Compared with the run before" : "Compared with the run you came back from";
    const runsLine = (value) => value.runs + " runs, seed " + value.seed;
    const rows = runChangeRows(kept.value.headlines, entry.value.headlines);
    const nothing = plan.sameInputs && !plan.seedChanged && !plan.runsChanged && rows.every((row) => row.change == null);
    let settings = "";
    if (!plan.sameInputs) {
      loadRunChanges(plan);
      const key = JSON.stringify([plan.previousInputsText, plan.currentInputsText]);
      const reply = state.accountant.changes.key === key ? state.accountant.changes.value : null;
      if (!reply) settings = "<p class=\"note\">Loading the settings that differ…</p>";
      else if (!reply.ok) settings = "<p class=\"note\">" + escapeText(reply.error || "The settings could not be compared.")
        + "</p>";
      else {
        const found = differenceLines(reply.differences, MAX_CHANGE_LINES);
        settings = "<h3 class=\"why-title\">Settings that differ</h3>" + (found.lines.length ? "<ul class=\"change-lines\">"
          + found.lines.map((line) => "<li>" + escapeText(line) + "</li>").join("") + "</ul>"
          : "<p class=\"note\">No setting differs.</p>")
          + (found.more ? "<p class=\"note\">" + found.more + " more</p>" : "");
      }
    }
    const notes = [];
    if (plan.sameInputs && (plan.seedChanged || plan.runsChanged)) {
      notes.push("Only the seed or the number of runs changed, so the change is sampling noise.");
    } else if (plan.seedChanged || plan.runsChanged) {
      notes.push("The seed or the number of runs changed too, so part of the change is sampling noise.");
    }
    if (plan.dollarsChanged) notes.push("One run is in today's dollars and the other inflation adjusted.");
    const body = nothing ? "<p class=\"note\">Nothing changed since the last run.</p>"
      : "<table class=\"change-table\"><thead><tr><th scope=\"col\">Figure</th><th scope=\"col\">Before</th>"
        + "<th scope=\"col\">After</th><th scope=\"col\">Change</th></tr></thead><tbody>" + rows.map((row) => "<tr><th "
        + "scope=\"row\">" + escapeText(row.label) + "</th><td>" + escapeText(headlineValueText(row.unit, row.before))
        + "</td><td>" + escapeText(headlineValueText(row.unit, row.after)) + "</td><td>" + escapeText(changeText(row))
        + "</td></tr>").join("") + "</tbody></table>" + settings;
    return "<details class=\"card accountant-card" + (stale ? " stale-results" : "") + "\" id=\"runChanges\""
      + (state.accountant.changesOpen ? " open" : "") + "><summary><h2>What changed since the last run</h2></summary>"
      + "<p class=\"note\" id=\"runChangesLead\">" + escapeText(lead + ": " + runsLine(kept.value) + " then "
        + runsLine(entry.value) + ".") + "</p>" + body
      + notes.map((text) => "<p class=\"note change-note\">" + escapeText(text) + "</p>").join("") + "</details>";
  }

  // The Download ledger (CSV) card: hidden at Low and with nothing to download, disabled while results are dimmed;
  // the status line says what the last download did and Copy CSV text opens the text to copy.
  function ledgerCardHtml(entry, stale) {
    const tables = entry && entry.value.tables;
    const ready = Boolean(tables && tables.summary && tables.summary.data && tables.summary.data.length);
    const csv = state.accountant.csv;
    const helpId = newHelpId();
    return "<div class=\"card ledger-card\" id=\"ledgerCard\"><div class=\"ledger-row\"><button type=\"button\" "
      + "class=\"button button-quiet\" id=\"ledgerDownload\"" + (ready && !stale ? "" : " disabled")
      + ">Download ledger (CSV)</button>" + helpButtonHtml("Download ledger (CSV)", helpId) + "</div>"
      + helpTextHtml(helpId, LEDGER_HELP)
      + (stale ? "<p class=\"note\">Available once the results match the settings.</p>" : "")
      + "<p class=\"note\" id=\"ledgerStatus\" role=\"status\">" + escapeText(csv && csv.status ? csv.status : "")
      + "</p>" + (csv ? "<button type=\"button\" class=\"button button-quiet\" id=\"ledgerCopy\">Copy CSV text</button>"
        : "") + "</div>";
  }

  // Draw the extras' holders in place (never the whole Summary).
  function refreshAccountant() {
    const holder = $("accountantCards");
    const ledger = $("accountantLedger");
    if (!holder && !ledger) return;
    const off = !gamifyOn() || !state.info || !state.inputs || needsSetup(state.inputs);
    const { entry, stale } = latestMonteCarlo();
    const low = !off && shownExperience().effort === "low";
    if (holder) {
      let html = "";
      if (!off && accountantExtrasOn()) {
        html += estimatesCardHtml(JSON.stringify(entry ? ranInputs(entry, stale) : state.inputs), stale);
        if (entry && !low) html += runChangesCardHtml(entry, stale);
      }
      holder.innerHTML = html;
    }
    if (ledger) ledger.innerHTML = !off && entry && !low ? ledgerCardHtml(entry, stale) : "";
  }

  // Fill the holders renderResults drew and wire their buttons and the tiles' Why? buttons (each render makes new
  // elements, so each gets one listener).
  function wireAccountant(body) {
    refreshAccountant();
    if (!gamifyOn()) return;
    const tiles = body.querySelector(".tiles");
    if (tiles) {
      tiles.addEventListener("click", (event) => {
        const button = event.target.closest(".tile-why");
        if (button) openWhy(button.dataset.why, button.dataset.source, null);
      });
    }
    const holder = body.querySelector("#accountantCards");
    if (holder) {
      holder.addEventListener("click", (event) => {
        const button = event.target.closest(".estimate-why");
        if (!button) return;
        const { entry } = latestMonteCarlo();
        const first = entry ? entry.value.headlines[0] : null;
        openWhy(first ? first.label : "Median final worth", "mc", button.dataset.row);
      });
      holder.addEventListener("toggle", (event) => {
        if (event.target.id === "runChanges") state.accountant.changesOpen = event.target.open;
      }, true);
    }
    const ledger = body.querySelector("#accountantLedger");
    if (ledger) {
      ledger.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button || button.disabled) return;
        if (button.id === "ledgerDownload") downloadLedger();
        else if (button.id === "ledgerCopy") ledgerCopyDialog();
      });
    }
  }

  // The headline `label` on screen: the Monte Carlo's, the single run's, or the household's worth today.
  function shownHeadline(label, source) {
    const { entry } = latestMonteCarlo();
    const lists = source === "single" ? [state.result && state.result.headlines]
      : [entry && entry.value.headlines, state.result && state.result.headlines];
    for (const list of lists) {
      const found = (list || []).find((item) => item.label === label);
      if (found) return found;
    }
    const today = state.result && state.result.netWorthToday;
    return today && today.label === label ? today : { label, value: null, unit: "money" };
  }

  // Open "Why this number?" for the figure `label` (`source` "mc" or "single"), scrolled to row `focusRow` when given.
  function openWhy(label, source, focusRow) {
    if (!accountantExtrasOn()) return;
    const inputsText = whyInputsText(source);
    const { entry } = latestMonteCarlo();
    const run = source === "single" ? { runs: 1, seed: state.seed, dollars: null }
      : entry ? { runs: entry.value.runs, seed: entry.value.seed, dollars: entry.value.dollars } : null;
    const container = document.createElement("div");
    container.className = "why-body";
    container.id = "whyBody";
    container.tabIndex = -1;
    container.addEventListener("click", (event) => {
      const button = event.target.closest(".why-show");
      if (!button) return;
      closeDialog(false);
      openInputsField(button.dataset.path);
    });
    state.accountant.open = { label, source, inputsText, focusRow, run, headline: shownHeadline(label, source), container };
    fillWhy();
    openDialog({ title: "Why this number?", body: [container], focus: container,
      actions: [["Close", "button", () => true, "whyClose"]] });
    dialog.onClose = () => { state.accountant.open = null; };
    scrollWhyRow();
    loadProvenance(inputsText);
  }

  function element(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text != null) item.textContent = text;
    return item;
  }

  function whySection(title, ...children) {
    const section = element("section", "why-section");
    section.append(element("h3", "why-title", title), ...children);
    return section;
  }

  // One law or estimate row: its label, the year and "as of" date, the confidence, and where to check it (a link only
  // for a lone https:// address).
  function whyLawRow(row) {
    const item = element("li", "why-law" + (row.estimate ? " why-estimate" : ""));
    item.dataset.row = row.id;
    const head = element("div", "why-law-head");
    head.append(element("span", "why-law-label", row.label + (row.jurisdiction && row.jurisdiction !== "federal"
      ? " (" + row.jurisdiction + ")" : row.jurisdiction === "federal" ? " (federal)" : "")));
    if (row.estimate) head.append(element("span", "estimate-pill", "estimate"));
    item.append(head);
    const facts = [];
    if (row.year != null) facts.push("Tax year " + row.year);
    if (row.asOf) facts.push("as of " + row.asOf);
    if (row.confidence) facts.push(row.confidence);
    if (row.text) facts.push(row.text);
    if (facts.length) item.append(element("p", "why-law-facts", facts.join(", ")));
    if (row.checkAt) {
      const check = element("p", "why-law-check", "Check: ");
      if (/^https:\/\/\S+$/.test(row.checkAt)) {
        const link = element("a", null, row.checkAt);
        link.href = row.checkAt;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        check.append(link);
      } else {
        check.append(document.createTextNode(row.checkAt));
      }
      item.append(check);
    }
    if (row.path) {
      const show = element("button", "button button-quiet why-show", "Show me");
      show.type = "button";
      show.dataset.path = row.path;
      item.append(show);
    }
    return item;
  }

  // Build the open pop-up's body: the figure, how it is made, the run, the inputs behind it and the law used.
  function fillWhy() {
    const open = state.accountant.open;
    if (!open) return;
    const { container, headline, run } = open;
    const found = provenanceOf(open.inputsText);
    const parts = [];
    const figure = element("p", "why-figure");
    figure.append(element("strong", null, headline.label), document.createTextNode(" "
      + (headline.value == null ? "" : headlineValueText(headline.unit, headline.value))));
    parts.push(figure);
    if (headline.help) parts.push(element("p", "note", headline.help));
    if (!found) {
      parts.push(element("p", "note why-loading", "Loading sources..."));
      container.replaceChildren(...parts);
      return;
    }
    if (!found.ok) {
      if (run) parts.push(whySection("The run", element("p", null, run.runs + (run.runs === 1 ? " run" : " runs")
        + ", seed " + run.seed)));
      parts.push(element("p", "banner banner-error", found.error || "The sources could not be read."));
      container.replaceChildren(...parts);
      return;
    }
    const how = found.how && found.how[headline.label];
    if (how) parts.push(whySection("How it is made", element("p", null, how)));
    const facts = found.run;
    const runLines = [];
    if (run) {
      runLines.push((run.runs === 1 ? "One run" : run.runs + " runs") + ", seed " + run.seed + ", "
        + dollarsText(run.dollars || (facts.dollars === "future" ? "future" : "today's")));
    }
    runLines.push("Ages " + facts.startAge + " to " + facts.endAge + " (" + facts.years + " years)");
    runLines.push("Tax law of " + facts.lawYear + ", filing status " + facts.filingStatus);
    runLines.push("Home state " + facts.homeState + (facts.finalState ? ", moving to " + facts.finalState : ""));
    parts.push(whySection("The run", ...runLines.map((line) => element("p", "why-line", line))));
    const inputs = element("ul", "why-inputs");
    for (const row of found.inputs || []) {
      const item = element("li", "why-input");
      item.dataset.row = row.id;
      item.append(element("span", "why-input-label", row.label), element("span", "why-input-value", row.value));
      if (row.path) {
        const show = element("button", "button button-quiet why-show", "Show me");
        show.type = "button";
        show.dataset.path = row.path;
        item.append(show);
      }
      inputs.append(item);
    }
    parts.push(whySection("Inputs behind it", inputs));
    const estimateIds = new Set((found.estimates || []).map((item) => item.id));
    const lawById = new Map((found.law || []).map((row) => [row.id, row]));
    const estimates = element("ul", "why-law-list");
    for (const item of found.estimates || []) {
      const row = lawById.get(item.id);
      estimates.append(whyLawRow(row ? { ...row, path: null } : { ...item, estimate: true }));
    }
    const rest = (found.law || []).filter((row) => !estimateIds.has(row.id));
    const all = element("details", "why-all");
    all.append(element("summary", null, "Show all (" + rest.length + ")"));
    const restList = element("ul", "why-law-list");
    restList.append(...rest.map(whyLawRow));
    all.append(restList);
    if (open.focusRow && rest.some((row) => row.id === open.focusRow)) all.open = true;
    parts.push(whySection("Law used", ...(estimates.children.length ? [estimates] : [element("p", "note",
      "No law figure this plan reads is marked unconfirmed.")]), all));
    container.replaceChildren(...parts);
    scrollWhyRow();
  }

  function scrollWhyRow() {
    const open = state.accountant.open;
    if (!open || !open.focusRow) return;
    const row = [...open.container.querySelectorAll("[data-row]")].find((item) => item.dataset.row === open.focusRow);
    if (!row) return;
    row.classList.add("why-focus");
    if (typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "center" });
  }

  // Save the ledger of the shown, current Monte Carlo: the host's downloads when offered (a declined save is
  // cancelled), else a browser download; where neither works the text opens to copy. Copy CSV text stays offered.
  async function downloadLedger() {
    if (!gamifyOn()) return;
    const { entry, stale } = latestMonteCarlo();
    if (!entry || stale) return;
    const text = ledgerCsv(entry.value.tables, { firstYear: state.info.lawTaxYear });
    if (!text) return;
    const filename = ledgerFilename(state.scenarioName, new Date(), entry.value.dollars);
    const csv = { key: entry.key, filename, text, status: null };
    state.accountant.csv = csv;
    const downloads = await downloadsReady;
    if (downloads) {
      try {
        await downloads.save({ filename, data: text });
        csv.status = "Saved " + filename + ".";
      } catch (error) {
        if (error && error.code === "declined") csv.status = "Download cancelled.";
      }
    }
    let blocked = false;
    if (!csv.status) {
      if (downloadFile(filename, new Blob([text], { type: "text/csv;charset=utf-8" }))) {
        csv.status = "Downloaded " + filename + ".";
      } else {
        csv.status = "This browser cannot save files from this page. Copy the CSV text instead.";
        blocked = true;
      }
    }
    refreshAccountant();
    if (blocked) ledgerCopyDialog();
  }

  // The copy-text fallback for the ledger: its text read-only, Copy and Close.
  function ledgerCopyDialog() {
    const csv = state.accountant.csv;
    if (!csv) return;
    const text = document.createElement("textarea");
    text.className = "input mono";
    text.id = "ledgerText";
    text.rows = 6;
    text.readOnly = true;
    text.setAttribute("aria-label", "Ledger CSV text");
    text.value = csv.text;
    openDialog({ title: "Ledger " + csv.filename, text: "Copy the text and save it as " + csv.filename + ".",
      body: [text], focus: text,
      actions: [["Copy", "button", async () => {
        try {
          await navigator.clipboard.writeText(text.value);
          csv.status = "Copied. Paste it into a file named " + csv.filename + ".";
          refreshAccountant();
          return true;
        } catch (error) {
          text.focus();
          text.select();
          dialogError("Copy is blocked here; the text is selected so you can copy it yourself.");
          return false;
        }
      }, "ledgerCopyText"], ["Close", "button button-quiet", () => true, "ledgerClose"]] });
  }
  // ---- Optimize: search the strategy settings for the best score on the same draws, then apply on a tap ----
  // The search runs in the worker as a batched job ("optimize"); Stop posts a finish (the best so far is kept), Cancel
  // drops it. At its run budget the search pauses and the progress asks whether to continue with another budget of
  // runs (no run is done twice) or stop and keep the best so far. A result is kept with the inputs text it ran on: once the settings change it is marked stale and Apply is
  // off. Apply changes the settings at once (one Undo step); the Python builds every text shown.
  const OPTIMIZE_HELP = "Searches your strategy settings for the best score: the Roth conversion, the backdoor, QCDs, "
    + "the withdrawal order, the Social Security claim ages, raising 401k deposits, the split of surplus cash, "
    + "adding accounts and, for the states you tick, where to retire (each option's i says more). Every setting tried faces the same random draws (the Seed under "
    + "Setup), and the winner is checked again on fresh draws. Nothing changes until you tap Apply, and Undo takes it "
    + "back. Keep the app open while it searches: leaving it pauses the search until you come back.";
  const OPTIMIZE_PAUSED_TEXT = "Paused while the app was in the background";
  const OPTIMIZE_RESUMED_TEXT = "Resumed";
  // A checkpoint can be a few hundred KB, so it is written at most this often while the search runs, and at once when
  // the search pauses (background, run cap) or the page hides.
  const OPTIMIZE_CHECKPOINT_MS = 5000;

  function optimizeShown() {
    return tabShown("strategy") && state.strategyView === "optimize";
  }

  // The settings changed: a running search is dropped; a finished result stays, marked stale; an interrupted search
  // kept for other settings is cleared.
  function optimizeInputsChanged() {
    const optimize = state.optimize;
    if (optimize.job && optimize.job.inputsText !== JSON.stringify(state.inputs)) {
      optimize.job.dropped = true;
      engine.cancel(optimize.job.id);
    }
    savedOptimizeSearch();
    if (optimizeShown()) renderOptimize();
  }

  // ---- The search and the screen: a Screen Wake Lock keeps the phone awake while it runs; in the background it
  // pauses (the worker holds it after its batch) and comes back on its own; its checkpoint is kept every few seconds
  // and whenever it pauses, so a search the browser closed can be resumed on the same settings and build after a reload. ----

  // The interrupted search kept for the current inputs and seed, or null; one kept for other settings is cleared.
  function savedOptimizeSearch() {
    if (!state.inputs) return null;
    const saved = load(OPTIMIZE_CHECKPOINT_KEY);
    if (!saved) return null;
    const usable = typeof saved.checkpoint === "string" && typeof saved.optionsText === "string"
      && saved.key === optimizeCheckpointKey(JSON.stringify(state.inputs), saved.optionsText, state.seed,
        window.WMTI_BUILD.id);
    if (!usable) clearOptimizeCheckpoint();
    return usable ? saved : null;
  }

  function clearOptimizeCheckpoint() {
    try { localStorage.removeItem(OPTIMIZE_CHECKPOINT_KEY); } catch (error) { /* storage blocked: nothing kept */ }
  }

  // Write the search's latest checkpoint, if one is waiting.
  function writeOptimizeCheckpoint(job) {
    if (!job || !job.checkpoint || state.clearing) return;
    store(OPTIMIZE_CHECKPOINT_KEY, job.checkpoint);
    job.checkpoint = null;
    job.checkpointAt = Date.now();
  }

  async function holdScreenOn() {
    const job = state.optimize.job;
    if (!job || job.wakeLock || document.visibilityState !== "visible") return;
    try {
      if (!navigator.wakeLock || !navigator.wakeLock.request) return;
      const lock = await navigator.wakeLock.request("screen");
      if (state.optimize.job === job && !job.wakeLock) job.wakeLock = lock;
      else lock.release().catch(() => {});
    } catch (error) { /* no Screen Wake Lock here, or refused: the search runs without it */ }
  }

  function letScreenSleep(job) {
    const lock = job && job.wakeLock;
    if (!lock) return;
    job.wakeLock = null;
    try { Promise.resolve(lock.release()).catch(() => {}); } catch (error) { /* already let go */ }
  }

  // Leaving the app holds the search after its batch (the time away is not counted); coming back runs it on.
  function optimizeVisibilityChanged() {
    const job = state.optimize.job;
    if (!job) return;
    if (document.visibilityState === "hidden") {
      if (job.paused) return;
      job.paused = true;
      writeOptimizeCheckpoint(job);
      letScreenSleep(job);  // the browser lets a screen lock go with the page anyway
      engine.pause(job.id);
      job.backgroundText = OPTIMIZE_PAUSED_TEXT;
    } else if (document.visibilityState === "visible") {
      if (!job.paused) return;
      job.paused = false;
      engine.resume(job.id);
      job.backgroundText = OPTIMIZE_RESUMED_TEXT;
      holdScreenOn();
    }
    showOptimizeProgress();
  }
  document.addEventListener("visibilitychange", optimizeVisibilityChanged);
  window.addEventListener("pagehide", () => writeOptimizeCheckpoint(state.optimize.job));

  // Which search options can be used for the settings now (`optimizeAvailability`), asked once per settings and seed;
  // an option that cannot be used is greyed out with its reason and left out of the search.
  async function loadOptimizeAvailability() {
    const optimize = state.optimize;
    const key = JSON.stringify([state.inputs, state.seed]);
    if ((optimize.availability && optimize.availability.key === key) || optimize.availabilityPending === key) return;
    optimize.availabilityPending = key;
    const reply = await ask("optimizeAvailability", [JSON.stringify(state.inputs), state.seed]);
    if (optimize.availabilityPending === key) optimize.availabilityPending = null;
    if (!reply || !reply.ok || key !== JSON.stringify([state.inputs, state.seed])) return;
    optimize.availability = { key, options: reply.options, estimate: reply.estimate };
    if (optimizeShown() && !optimize.job) renderOptimize();
  }

  // Each effort's estimate on this device for the settings now (`searchEstimates`), or null until it comes.
  function optimizeEstimate() {
    const availability = state.optimize.availability;
    return availability && availability.key === JSON.stringify([state.inputs, state.seed]) ? availability.estimate : null;
  }

  // The search option as the settings now allow it: {available, reason}; available until the answer comes.
  function optimizeOption(key) {
    const availability = state.optimize.availability;
    const current = availability && availability.key === JSON.stringify([state.inputs, state.seed]);
    return (current && availability.options[key]) || { available: true, reason: null };
  }

  async function loadOptimizeInfo() {
    if (state.optimize.info) return;
    const info = await ask("optimizeInfo", []);
    if (!info || !info.ok) return;
    state.optimize.info = info;
    const options = state.optimize.options;
    if (!options.effort) options.effort = info.defaultEffort.phone;
    if (!options.preset) options.preset = info.defaultPreset;
    if (optimizeShown()) renderOptimize();
  }

  function renderOptimize() {
    const body = $("optimize-body");
    if (!body || !state.info) return;
    gamerTick();  // a new search result may finish a quest
    const optimize = state.optimize;
    const info = optimize.info;
    if (!info) { body.innerHTML = "<div class=\"card\"><p class=\"muted\">Loading</p></div>"; loadOptimizeInfo(); return; }
    const card = document.createElement("div");
    card.className = "card";
    card.id = "optimizeCard";
    const about = titleHelp("h2", "Find the best settings", OPTIMIZE_HELP);
    const options = optimize.options;
    const presets = info.presets.map((preset) => [preset.id, preset.label]);
    const estimate = optimizeEstimate();
    const efforts = info.efforts.map((effort) => [effort.id, effort.label + " ("
      + (estimate ? estimate.efforts[effort.id].text : effort.text) + ")"]);
    const presetText = (info.presets.find((preset) => preset.id === options.preset) || {}).text || "";
    // What the chosen risk preference weighs, behind an "i" (its text follows the select).
    const presetHelp = noteHelp("What the risk preference weighs", presetText, "field-help", "optimizePresetText");
    const saved = optimize.job ? null : savedOptimizeSearch();
    card.innerHTML = (state.error ? errorBanner(state.error) : "") + "<div class=\"card-head\">" + about.head + "</div>"
      + about.text + "<p class=\"field-help\">" + escapeText(info.notAdvice) + "</p><div id=\"optimizeSwitches\"></div>"
      + "<div class=\"pair\">" + selectHtml("optimizePreset", "Risk preference", presets, options.preset)
      + selectHtml("optimizeEffort", "Effort", efforts, options.effort) + "</div>"
      + presetHelp.head + presetHelp.text
      + "<div class=\"run-row\"><button type=\"button\" class=\"button\" id=\"optimizeRun\""
      + (optimize.job || state.error ? " disabled" : "") + ">Find best settings</button></div>"
      + (saved ? "<div class=\"run-progress\" id=\"optimizeResumeOffer\" role=\"group\" aria-labelledby=\""
        + "optimizeResumeText\"><p class=\"progress-text\" id=\"optimizeResumeText\">A search on these settings was "
        + "interrupted before it finished (the app was closed). Resume it where it stopped, or discard it.</p>"
        + "<div class=\"run-row\"><button type=\"button\" class=\"button\" id=\"optimizeResume\""
        + (state.error ? " disabled" : "") + ">Resume the search</button><button type=\"button\" class=\"button "
        + "button-quiet\" id=\"optimizeDiscard\">Discard</button></div></div>" : "")
      + optimizeProgressHtml(optimize.job && optimize.job.kind !== "earliest" ? optimize.job : null)
      + messageHtml(optimize.message);
    const switches = card.querySelector("#optimizeSwitches");
    const availability = optimize.availability;
    // Whether the switches show the answer for the settings now (tests wait for it).
    switches.dataset.ready = String(Boolean(availability
      && availability.key === JSON.stringify([state.inputs, state.seed])));
    for (const dimension of info.dimensions) {
      const option = optimizeOption(dimension.key);
      if (dimension.key === "states") {
        switches.append(optimizeStatesField(dimension, option, info));
        continue;
      }
      switches.append(switchField(dimension.label, dimension.help + " Untick to keep its current setting.",
        "optimizeDim-" + dimension.key, option.available && options.dimensions[dimension.key] !== false,
        (checked) => { options.dimensions[dimension.key] = checked; }, !option.available,
        option.available ? null : "Not available: " + option.reason + "."));
    }
    loadOptimizeAvailability();
    card.querySelector("#optimizePreset").addEventListener("change", (event) => {
      options.preset = event.target.value;
      $("optimizePresetText").textContent = (info.presets.find((preset) => preset.id === options.preset) || {}).text || "";
    });
    card.querySelector("#optimizeEffort").addEventListener("change", (event) => {
      options.effort = event.target.value;
      showOptimizeStatesEstimate();
    });
    card.querySelector("#optimizeRun").addEventListener("click", () => runOptimize());
    const resume = card.querySelector("#optimizeResume");
    if (resume) resume.addEventListener("click", () => runOptimize(savedOptimizeSearch()));
    const discard = card.querySelector("#optimizeDiscard");
    if (discard) discard.addEventListener("click", () => { clearOptimizeCheckpoint(); renderOptimize(); });
    const stop = card.querySelector("#optimizeStop");
    if (stop) stop.addEventListener("click", () => { if (optimize.job) engine.finish(optimize.job.id); });
    const cancel = card.querySelector("#optimizeCancel");
    if (cancel) cancel.addEventListener("click", () => { if (optimize.job) engine.cancel(optimize.job.id); });
    const capContinue = card.querySelector("#optimizeCapContinue");
    if (capContinue) capContinue.addEventListener("click", () => answerOptimizeCap(true));
    const capKeep = card.querySelector("#optimizeCapKeep");
    if (capKeep) capKeep.addEventListener("click", () => answerOptimizeCap(false));
    body.replaceChildren(card, ...earliestCard());
    showOptimizeStatesEstimate();
    showOptimizeProgress();
    if (optimize.entry) body.append(...optimizeResult(optimize.entry));
  }

  // The States option: a list of the states to tick (a search box above it on the phone), at most `info.maxStates`;
  // once that many are ticked the rest are off with a short note. The estimate under it counts the ticked states.
  function optimizeStatesField(dimension, option, info) {
    const options = state.optimize.options;
    const wrap = fieldShell(dimension.label, dimension.help, null);
    wrap.id = "optimizeStates";
    const search = document.createElement("input");
    search.className = "input select-search";
    search.type = "search";
    search.autocomplete = "off";
    search.placeholder = "Search";
    search.setAttribute("aria-label", "Search states");
    search.setAttribute("aria-controls", "optimizeStateList");
    const list = document.createElement("div");
    list.className = "state-picks";
    list.id = "optimizeStateList";
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "States to compare");
    const choices = state.info.states || [];
    const labelled = { choiceLabels: Object.fromEntries(choices.map((item) => [item.code, item.code + " - " + item.name])) };
    const boxes = choices.map((item) => {
      const label = document.createElement("label");
      label.className = "state-pick";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = item.code;
      box.id = "optimizeState-" + item.code;
      box.checked = options.states.includes(item.code);
      box.addEventListener("change", () => {
        options.states = box.checked ? options.states.concat([item.code])
          : options.states.filter((code) => code !== item.code);
        syncPicks();
        showOptimizeStatesEstimate();
      });
      label.append(box, document.createTextNode(" " + labelled.choiceLabels[item.code]));
      list.append(label);
      return box;
    });
    const row = document.createElement("div");
    row.className = "run-row";
    const none = document.createElement("button");
    none.type = "button";
    none.className = "button button-quiet";
    none.id = "optimizeStatesNone";
    none.textContent = "None";
    none.addEventListener("click", () => {
      options.states = [];
      for (const box of boxes) box.checked = false;
      syncPicks();
      showOptimizeStatesEstimate();
    });
    row.append(none);
    const limit = document.createElement("p");
    limit.className = "field-help";
    limit.id = "optimizeStatesFull";
    limit.textContent = "Up to " + info.maxStates + " states per search.";
    const estimate = document.createElement("p");
    estimate.className = "field-help";
    estimate.id = "optimizeStatesEstimate";
    estimate.setAttribute("aria-live", "polite");
    function syncPicks() {
      const full = options.states.length >= info.maxStates;
      for (const box of boxes) box.disabled = !option.available || (full && !box.checked);
      none.disabled = !option.available || !options.states.length;
      limit.hidden = !full;
    }
    search.addEventListener("input", () => {
      const matches = filterChoices(labelled, choices.map((item) => item.code), search.value);
      for (const box of boxes) box.parentElement.hidden = !matches.includes(box.value) && !box.checked;
    });
    search.disabled = !option.available;
    wrap.append(search, list, row, limit, estimate);
    if (!option.available) {
      wrap.classList.add("field-disabled");
      const why = document.createElement("p");
      why.className = "field-help switch-note";
      why.id = "optimizeStates-note";
      why.textContent = "Not available: " + option.reason + ".";
      wrap.append(why);
    }
    syncPicks();
    return wrap;
  }

  // The States option's estimate for the ticked states and the chosen effort.
  function showOptimizeStatesEstimate() {
    const line = $("optimizeStatesEstimate");
    const info = state.optimize.info;
    if (!line || !info) return;
    const options = state.optimize.options;
    const effort = info.efforts.find((item) => item.id === options.effort);
    const count = options.states.length;
    line.textContent = !count ? "Tick the states you would consider; staying where you are is always compared."
      : count + (count === 1 ? " state" : " states") + " and staying put: "
        + (effort ? optimizeStatesEstimate(effort, count, (optimizeEstimate() || {}).secondsPerRun) : "") + ".";
  }

  function optimizeProgressHtml(job) {
    return "<div class=\"run-progress\" id=\"optimizeProgress\"" + (job ? "" : " hidden") + "><div class=\"progress\" "
      + "role=\"progressbar\" aria-label=\"Runs done\" aria-valuemin=\"0\" id=\"optimizeBar\"><span></span></div>"
      + "<p class=\"progress-text\" id=\"optimizeProgressText\">Starting the search</p>"
      + "<p class=\"progress-text\" id=\"optimizeBackground\" aria-live=\"polite\"></p>"
      + "<div id=\"optimizeCap\" role=\"group\" aria-labelledby=\"optimizeCapText\" hidden>"
      + "<p class=\"progress-text\" id=\"optimizeCapText\"></p><div class=\"run-row\"><button type=\"button\" "
      + "class=\"button\" id=\"optimizeCapContinue\">Continue</button><button type=\"button\" class=\"button "
      + "button-quiet\" id=\"optimizeCapKeep\">Stop and keep best so far</button></div></div>"
      + "<div class=\"run-row\"><button type=\"button\" class=\"button button-quiet\" id=\"optimizeStop\">Stop, show best "
      + "so far</button><button type=\"button\" class=\"button button-quiet\" id=\"optimizeCancel\">Cancel</button></div>"
      + "</div>";
  }

  // Move the search's bar and text in place, so Stop and Cancel keep focus while it runs.
  function showOptimizeProgress() {
    const job = state.optimize.job;
    if (job && job.kind === "earliest") { showEarliestProgress(); return; }
    const bar = $("optimizeBar");
    if (!bar || !job) return;
    const detail = job.detail;
    const planned = detail ? detail.expected : 1;
    const runs = detail ? detail.runs : 0;
    bar.querySelector("span").style.width = Math.min(1, runs / planned) * 100 + "%";
    bar.setAttribute("aria-valuemax", String(planned));
    bar.setAttribute("aria-valuenow", String(runs));
    $("optimizeProgressText").textContent = optimizeStepText(detail)
      + (detail && detail.gain != null ? " Best so far: score " + (detail.gain >= 0 ? "+" : "") + Math.round(detail.gain)
        .toLocaleString("en-US") + "." : "");
    const capped = Boolean(detail && detail.capped);
    $("optimizeCap").hidden = !capped;
    $("optimizeCapText").textContent = capped ? detail.capText : "";
    $("optimizeStop").hidden = capped;
    $("optimizeBackground").textContent = job.backgroundText || "";
    $("optimizeBackground").hidden = !job.backgroundText;
  }

  // Answer the search paused at its run budget: continue with another budget of runs, or keep the best so far.
  function answerOptimizeCap(more) {
    const job = state.optimize.job;
    if (!job || !job.detail || !job.detail.capped) return;
    job.detail = { ...job.detail, capped: false, capText: null };
    engine.answerCap(job.id, more);
    showOptimizeProgress();
    $("optimizeStop").focus();
  }

  // The options' switches as the search takes them: an option that cannot be used is off.
  function optimizeDimensions() {
    const dimensions = { ...state.optimize.options.dimensions };
    for (const dimension of state.optimize.info.dimensions) {
      if (!optimizeOption(dimension.key).available) dimensions[dimension.key] = false;
    }
    return dimensions;
  }

  // The ticked states the search takes: none while the States option cannot be used.
  function optimizeStates() {
    return optimizeOption("states").available ? state.optimize.options.states.slice() : [];
  }

  // Start a search on the current settings, or resume `saved` (`savedOptimizeSearch`) with its own options.
  async function runOptimize(saved = null) {
    const optimize = state.optimize;
    if (optimize.job || state.error) return;
    const inputsText = JSON.stringify(state.inputs);
    const optionsText = saved ? saved.optionsText : JSON.stringify({ effort: optimize.options.effort,
      preset: optimize.options.preset, dimensions: optimizeDimensions(), surplusLocked: state.surplusLocks.slice(),
      ...(optimizeStates().length ? { states: optimizeStates() } : {}) });
    const seed = state.seed;
    const key = optimizeCheckpointKey(inputsText, optionsText, seed, window.WMTI_BUILD.id);
    if (state.mc.job) state.mc.job.silent = true;  // the engine runs one batched job: the search replaces it
    clearTimeout(mcTimer);
    const job = engine.job("optimize", [inputsText, optionsText, seed, true, saved ? saved.checkpoint : null], null,
      (message) => {
        if (!optimize.job) return;
        if (message.checkpoint && message.checkpoint !== "null" && !state.clearing) {
          optimize.job.checkpoint = { key, optionsText, checkpoint: message.checkpoint };
          if (optimize.job.paused || (message.detail && message.detail.capped)
            || Date.now() - optimize.job.checkpointAt >= OPTIMIZE_CHECKPOINT_MS) writeOptimizeCheckpoint(optimize.job);
        }
        const wasCapped = Boolean(optimize.job.detail && optimize.job.detail.capped);
        optimize.job.detail = message.detail;
        showOptimizeProgress();
        if (message.detail && message.detail.capped && !wasCapped && $("optimizeCapContinue")) {
          $("optimizeCapContinue").focus();
        }
      });
    optimize.job = { id: job.id, kind: "optimize", detail: null, inputsText, dropped: false, paused: false,
      backgroundText: null, wakeLock: null, checkpoint: null, checkpointAt: 0 };
    optimize.message = null;
    renderOptimize();
    if ($("optimizeStop")) $("optimizeStop").focus();
    holdScreenOn();
    if (document.visibilityState === "hidden") optimizeVisibilityChanged();
    let reply = null;
    let failure = null;
    try {
      reply = await job.promise;
    } catch (error) {
      failure = String(error.message || error);
    }
    const { dropped } = optimize.job;
    letScreenSleep(optimize.job);
    clearOptimizeCheckpoint();
    optimize.job = null;
    if (failure) optimize.message = { error: true, text: failure };
    else if (!reply) optimize.message = dropped ? { text: "The settings changed, so the search was dropped. Run it again." }
      : { text: "Cancelled. Nothing was kept from the search" + (optimize.entry ? "; the last result stays." : ".") };
    else if (!reply.value.ok) optimize.message = { error: true, text: reply.value.error };
    else optimize.entry = { value: reply.value, inputsText, ms: reply.ms, appliedText: null };
    renderOptimize();
    scheduleMc();  // an automatic Monte Carlo waits for the search
  }

  function textTable(title, columns, rows) {
    return "<div class=\"table-scroll\" tabindex=\"0\" role=\"region\" aria-label=\"" + escapeText(title) + "\">"
      + "<table class=\"data-table wrap-first\"><thead><tr>" + columns.map((name) => "<th scope=\"col\">"
        + escapeText(name) + "</th>").join("") + "</tr></thead><tbody>" + rows.map((row) => "<tr>" + row.map((value,
        position) => (position === 0 ? "<th scope=\"row\">" : "<td class=\"text\">") + escapeText(value)
        + (position === 0 ? "</th>" : "</td>")).join("") + "</tr>").join("") + "</tbody></table></div>";
  }

  // Whether the settings now are the ones Apply wrote (so Undo is offered).
  function optimizeApplied(entry) {
    return entry.appliedText != null && entry.appliedText === JSON.stringify(state.inputs);
  }

  // Why Apply is off, or null when it may run.
  function optimizeApplyProblem(entry) {
    if (!entry.value.changed) return "Your current settings are already the best found.";
    if (entry.inputsText !== JSON.stringify(state.inputs)) return "Your settings changed since this ran; run it again.";
    return null;
  }

  // Every change Apply writes, in one list: a highlighted card for each that improves the score (setting, now → best,
  // its gain), a plain one marked "changed, no measured gain" for the rest; the total, and the settings kept folded
  // into one line that opens on a tap.
  function optimizeImprovementsHtml(result) {
    const cards = result.improvements.map((item) => "<li class=\""
      + (item.improves === false ? "optimize-change-plain" : "optimize-improvement") + "\">"
      + "<div class=\"optimize-improvement-head\"><strong>" + escapeText(item.label) + "</strong><span class=\"optimize-gain\">" + escapeText(item.gainText)
      + "</span></div>" + item.changes.map((change) => "<p class=\"optimize-change\">"
        + (change.label !== item.label ? escapeText(change.label) + ": " : "") + "<span class=\"optimize-now\">"
        + escapeText(change.now) + "</span> → <span class=\"optimize-best\">" + escapeText(change.best)
        + "</span></p>").join("") + "</li>").join("");
    return (cards ? "<h3>Settings that change</h3><ul class=\"optimize-improvements\" id=\"optimizeImprovements\">"
      + cards + "</ul><p class=\"field-help optimize-total\" id=\"optimizeTotal\">" + escapeText(result.totalText)
      + "</p>" : "")
      + (result.kept.length ? "<details class=\"optimize-kept\" id=\"optimizeKept\"><summary>"
        + escapeText(result.keptText) + "</summary><ul>" + result.kept.map((row) => "<li>" + escapeText(row[0])
          + ": " + escapeText(row[1]) + "</li>").join("") + "</ul></details>" : "");
  }

  function optimizeResult(entry) {
    const result = entry.value;
    const applied = optimizeApplied(entry);
    const stale = !applied && entry.inputsText !== JSON.stringify(state.inputs);
    const card = document.createElement("div");
    card.className = "card" + (stale ? " stale-results" : "");
    card.id = "optimizeResult";
    const held = result.recheck.held;
    const banner = (text, kind) => "<p class=\"banner" + (kind ? " banner-" + kind : "") + "\" role=\"note\">"
      + escapeText(text) + "</p>";
    const problem = optimizeApplyProblem(entry);
    let html = (stale ? banner("The settings changed since this search. Run it again to update it; Apply is off.", "warn")
      : "") + "<div class=\"card-head\"><h2>Best settings found</h2><span class=\"chart-note\">" + result.runs
      + " runs · " + secondsText(entry.ms) + "</span></div>"
      + "<p class=\"field-help\">" + escapeText(result.stopText) + "</p>"
      + optimizeImprovementsHtml(result)
      + "<h3>Score breakdown</h3>" + textTable("Score breakdown", ["Part", "Now", "Best", "Change"], result.breakdown)
      + "<p class=\"field-help\">" + escapeText(result.footnote) + "</p>"
      + banner(result.recheck.text, held === false ? "warn" : null)
      + result.skipped.concat(result.notes).map((note) => "<p class=\"field-help\">" + escapeText(note) + "</p>").join("");
    if (applied) {
      html += "<div class=\"run-row\"><span class=\"muted\" id=\"optimizeApplied\">Applied "
        + escapeText(result.applyText) + ".</span><button type=\"button\" class=\"button button-quiet\" id=\"optimizeUndo\">Undo</button></div>";
    } else {
      html += "<div class=\"run-row\"><button type=\"button\" class=\"button\" id=\"optimizeApply\""
        + (problem ? " disabled" : "") + ">Apply these settings</button></div>"
        + (problem ? "<p class=\"field-help\" id=\"optimizeApplyWhy\">" + escapeText(problem) + "</p>"
          : held === false ? "<p class=\"field-help\">This did not hold up on fresh draws; you can still apply it.</p>" : "");
    }
    card.innerHTML = html;
    const apply = card.querySelector("#optimizeApply");
    if (apply) apply.addEventListener("click", () => applyOptimum(entry));
    const undo = card.querySelector("#optimizeUndo");
    if (undo) undo.addEventListener("click", () => { undoLast(); renderOptimize(); });
    return [card];
  }

  async function applyOptimum(entry) {
    if (optimizeApplyProblem(entry)) return;
    const inputsText = JSON.stringify(state.inputs);
    const reply = await ask("applyOptimum", [inputsText, JSON.stringify(entry.value.changes)]);
    if (!reply || inputsText !== JSON.stringify(state.inputs)) return;
    if (!reply.ok) {
      state.optimize.message = { error: true, text: reply.error };
      renderOptimize();
      return;
    }
    if (settleTimer) settle();  // an edit still settling is a step of its own
    state.inputs = reply.inputs;
    entry.appliedText = JSON.stringify(state.inputs);
    renderSettings();
    inputsChanged();
    renderOptimize();
  }

  // The inputs a config name stands for, as stored now (no upgrade, no experience block): the key the differences
  // were found for.
  function storedConfig(name) {
    const info = state.info.compare;
    if (name === info.currentName) return state.inputs;
    if (name === info.defaultName) return state.defaults;
    return hasOwn(state.scenarios, name) ? splitExperience(state.scenarios[name]).inputs : null;
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
      // Make-match and Undo would undo a merge still in line, so they wait for it.
      const busy = compareBusy() || (compare.merging ? "Off until the merges in line are applied." : null);
      html += matchButtons([nameA, nameB], reply.problems.map((problem) => problem || busy));
      if (compare.mergeUndo.length) {
        html += "<div class=\"run-row\"><button type=\"button\" class=\"button button-quiet\" id=\"compareMergeUndo\""
          + (busy ? " disabled" : "") + ">Undo last merge (" + compare.mergeUndo.length + ")</button></div>";
      }
      if (!differences.length) html += "<p class=\"muted\">These configs have identical settings.</p>";
      // Why each side's buttons are off: "Merge A with B" changes A (problem of making A match B), and the reverse.
      const running = compareBusy();  // merges wait in line, so only a running comparison turns them off
      const problems = { A: reply.problems[1] || running, B: reply.problems[0] || running };
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
  // The open scenario's saved copy with Auto-save on is its working settings too: writing only the copy would be undone
  // by the next Auto-save (the next edit, or the next page load), which keeps the working settings as the copy. The
  // target keeps its own experience block, never the source's nor the one a merge reply carries.
  function writeConfig(name, inputs) {
    const open = name === state.scenarioName && autoSaveOn();
    const settings = splitExperience(inputs).inputs;
    if (name === state.info.compare.currentName || open) {
      if (open) {
        putScenario(name, settings);
        storeScenarios();
      }
      state.inputs = clone(settings);  // the loaded scenario stays the base, so Outputs shows the settings as edited
      takeHeirsAsLoaded();
      renderSettings();
      inputsChanged();
    } else {
      const own = hasOwn(state.scenarios, name) ? splitExperience(state.scenarios[name]).experience : null;
      putScenario(name, settings, own);
      storeScenarios();
      renderSaved();
    }
  }

  // Why the merge and make-match buttons are off while a comparison runs, or null.
  function compareBusy() {
    return state.compare.job ? "Off while the comparison runs; wait for it or cancel it." : null;
  }

  // Merges wait in line: each starts from the settings the one before it wrote, so a quick second tap never overwrites
  // the first merge with the settings from before it.
  let mergeLine = Promise.resolve();

  function mergeOne(side, diffId) {
    if (compareBusy()) return mergeLine;
    const [nameA, nameB] = selectedScenarios();
    const run = mergeLine.then(() => mergeNow(side, diffId, nameA, nameB));
    mergeLine = run.catch(() => null);
    return run;
  }

  // Merge one difference at once: side "A" gives A the value of B, "B" gives B the value of A. The comparison is not
  // run again (it shows as changed); Undo last merge steps back through the last UNDO_LIMIT merges.
  async function mergeNow(side, diffId, nameA, nameB) {
    const compare = state.compare;
    const [target, source] = side === "A" ? [nameA, nameB] : [nameB, nameA];
    if (target === state.info.compare.defaultName) return;
    if (settleTimer) settle();  // an edit still settling is saved first, so the merge starts from it
    compare.merging += 1;
    let reply;
    let before = null;
    try {
      const targetConfig = await configInputs(target);
      const sourceConfig = await configInputs(source);
      const failed = !targetConfig.ok ? targetConfig : !sourceConfig.ok ? sourceConfig : null;
      before = failed ? null : JSON.stringify(targetConfig.inputs);
      const stored = configText(target);
      reply = failed || await ask("mergeCompareDifference", [before, JSON.stringify(sourceConfig.inputs), diffId]);
      if (reply && reply.ok && configText(target) !== stored) {
        reply = { ok: false, error: target + " changed while the merge was worked out; nothing was merged. Try again." };
      }
    } finally {
      compare.merging -= 1;
    }
    if (!reply || !reply.ok) {
      compare.message = { error: true, text: reply ? reply.error : "The merge did not answer; try again." };
      renderCompare();
      return;
    }
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
    if (compareBusy() || compare.merging) return;
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

  // The make-match buttons: off with matchProblem's reason, and a first tap that asks for a second.
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
  // device (an older version is upgraded first), without the experience block.
  async function configInputs(name) {
    const info = state.info.compare;
    if (name === info.currentName) return { ok: true, inputs: state.inputs };
    if (name === info.defaultName) return { ok: true, inputs: state.defaults };
    const inputs = state.scenarios[name];
    if (!inputs) return { ok: false, error: name + ": no saved scenario has this name on this device" };
    if (isObject(inputs) && inputs.schemaVersion === state.info.inputsSchemaVersion) {
      return { ok: true, inputs: splitExperience(inputs).inputs };
    }
    const reply = await ask("importScenario", [JSON.stringify(inputs)]);
    if (reply && reply.ok) keepUpgradedScenario(name, reply.inputs);
    return reply && reply.ok ? { ok: true, inputs: splitExperience(reply.inputs).inputs }
      : { ok: false, error: reply ? reply.error : name + " could not be read; try again." };
  }

  // A saved scenario upgraded from an older version is saved again at once in the current format, with the
  // experience block the upgrade gave it.
  function keepUpgradedScenario(name, inputs) {
    putScenario(name, inputs, splitExperience(inputs).experience);
    storeScenarios();
  }

  // Make one config match the other: the first tap arms the button, the second replaces the target (a scenario saved
  // on this device, or the working settings for the current settings; never the default profile), then the
  // comparison runs again.
  async function makeMatch(position, result) {
    const compare = state.compare;
    if (compareBusy() || compare.merging) return;
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
    writeConfig(target, inputs.inputs);
    compare.message = { text: target + " now matches " + source + "." };
    renderCompare();
    await checkCompare();
    runCompare();
  }

  // ---- Earliest retirement: the earliest retirement ages whose failing runs stay within a limit, under Optimize ----
  // The search runs in the worker as a batched job ("earliestRetire", wmti.dashboard.earliest) in the strategy
  // search's slot (`state.optimize.job`, kind "earliest"), so every guard that waits for a search waits for it too;
  // Stop keeps the best so far, Cancel drops it. Its result is kept with the inputs text it ran on and applied through
  // the strategy search's Apply and Undo (only the retirement ages change). The Python builds every text shown.

  // Why nobody can be moved (as wmti.dashboard.earliest.movablePeople), or null when someone is paid today.
  function earliestSkip(inputs) {
    const reasons = [];
    for (const [role, label] of [["you", "you"], ["partner", "your partner"]]) {
      const person = inputs && inputs[role];
      if (!person) continue;
      if (!person.retired && person.salary > 0 && person.salaryEndAge > person.currentAge) return null;
      reasons.push(label + ": " + (person.retired ? "already retired" : !(person.salary > 0) ? "no pay"
        : "already past the retirement age"));
    }
    return "No one has pay to stop" + (reasons.length ? ": " + reasons.join("; ") : "") + ".";
  }

  // The card's options, each one the info offers (a stored choice it no longer offers takes the default).
  function earliestOptions() {
    const info = state.optimize.info.earliest;
    const options = state.optimize.earliest.options;
    if (!info.tolerances.includes(options.failurePercent)) options.failurePercent = info.defaultTolerance;
    if (!info.efforts.some((effort) => effort.id === options.effort)) options.effort = info.defaultEffort.phone;
    return options;
  }

  // The card and, below it, the last result: the nodes renderOptimize places after the strategy search's card.
  function earliestCard() {
    const optimize = state.optimize;
    const info = optimize.info.earliest;
    const options = earliestOptions();
    const job = optimize.job;
    const skip = state.inputs ? earliestSkip(state.inputs) : null;
    const card = document.createElement("div");
    card.className = "card";
    card.id = "earliestCard";
    const about = titleHelp("h2", "Earliest retirement", info.help);
    const tolerances = info.tolerances.map((value) => [String(value), value + "%"]);
    const efforts = info.efforts.map((effort) => [effort.id, effort.label + " (" + effort.text + ")"]);
    const failureHelp = noteHelp("What counts as a failing run", info.failureHelp, "field-help");
    const starts = [["you", "you"], ["partner", "partner"]].filter(([role]) => state.inputs && state.inputs[role])
      .map(([role, label]) => label + " " + state.inputs[role].salaryEndAge);
    const running = Boolean(job && job.kind === "earliest");
    card.innerHTML = "<div class=\"card-head\">" + about.head + "</div>" + about.text
      + "<div class=\"pair\">" + selectHtml("earliestFailures", "Failures allowed", tolerances,
        String(options.failurePercent))
      + selectHtml("earliestEffort", "Effort (runs per age)", efforts, options.effort) + "</div>"
      + failureHelp.head + failureHelp.text
      + "<p class=\"field-help\" id=\"earliestStart\">Starting from: " + escapeText(starts.join(", ")) + "</p>"
      + "<div class=\"run-row\"><button type=\"button\" class=\"button\" id=\"earliestRun\""
      + (job || state.error || skip ? " disabled" : "") + ">Find earliest retirement</button></div>"
      + (skip ? "<p class=\"field-help\" id=\"earliestSkip\">" + escapeText(skip) + "</p>" : "")
      + (running ? earliestProgressHtml() : "") + messageHtml(optimize.earliest.message);
    card.querySelector("#earliestFailures").addEventListener("change", (event) => {
      options.failurePercent = Number(event.target.value);
      savePrefs();
    });
    card.querySelector("#earliestEffort").addEventListener("change", (event) => {
      options.effort = event.target.value;
      savePrefs();
    });
    card.querySelector("#earliestRun").addEventListener("click", () => runEarliest());
    const stop = card.querySelector("#earliestStop");
    if (stop) stop.addEventListener("click", () => { if (optimize.job) engine.finish(optimize.job.id); });
    const cancel = card.querySelector("#earliestCancel");
    if (cancel) cancel.addEventListener("click", () => { if (optimize.job) engine.cancel(optimize.job.id); });
    return optimize.earliest.entry ? [card, earliestResult(optimize.earliest.entry)] : [card];
  }

  function earliestProgressHtml() {
    return "<div class=\"run-progress\" id=\"earliestProgress\"><div class=\"progress\" role=\"progressbar\" "
      + "aria-label=\"Runs done\" aria-valuemin=\"0\" id=\"earliestBar\"><span></span></div>"
      + "<p class=\"progress-text\" id=\"earliestProgressText\">Starting the search</p>"
      + "<p class=\"progress-text\" id=\"earliestBackground\" aria-live=\"polite\"></p>"
      + "<div class=\"run-row\"><button type=\"button\" class=\"button button-quiet\" id=\"earliestStop\">Stop, show best "
      + "so far</button><button type=\"button\" class=\"button button-quiet\" id=\"earliestCancel\">Cancel</button></div>"
      + "</div>";
  }

  // Move the search's bar and text in place, so Stop and Cancel keep focus while it runs.
  function showEarliestProgress() {
    const job = state.optimize.job;
    const bar = $("earliestBar");
    if (!bar || !job) return;
    const detail = job.detail;
    const planned = detail ? detail.expected : 1;
    const runs = detail ? detail.runs : 0;
    bar.querySelector("span").style.width = Math.min(1, runs / planned) * 100 + "%";
    bar.setAttribute("aria-valuemax", String(planned));
    bar.setAttribute("aria-valuenow", String(runs));
    $("earliestProgressText").textContent = optimizeStepText(detail);
    $("earliestBackground").textContent = job.backgroundText || "";
    $("earliestBackground").hidden = !job.backgroundText;
  }

  // Start a search on the current settings with the card's options.
  async function runEarliest() {
    const optimize = state.optimize;
    if (optimize.job || state.error || earliestSkip(state.inputs)) return;
    const inputsText = JSON.stringify(state.inputs);
    const options = earliestOptions();
    if (state.mc.job) state.mc.job.silent = true;  // the engine runs one batched job: the search replaces it
    clearTimeout(mcTimer);
    const job = engine.job("earliestRetire", [inputsText, JSON.stringify({ effort: options.effort,
      failurePercent: options.failurePercent }), state.seed], null, (message) => {
      if (!optimize.job) return;
      optimize.job.detail = message.detail;
      showEarliestProgress();
    });
    optimize.job = { id: job.id, kind: "earliest", detail: null, inputsText, dropped: false, paused: false,
      backgroundText: null, wakeLock: null, checkpoint: null, checkpointAt: 0 };
    optimize.earliest.message = null;
    renderOptimize();
    if ($("earliestStop")) $("earliestStop").focus();
    holdScreenOn();
    if (document.visibilityState === "hidden") optimizeVisibilityChanged();
    let reply = null;
    let failure = null;
    try {
      reply = await job.promise;
    } catch (error) {
      failure = String(error.message || error);
    }
    const { dropped } = optimize.job;
    letScreenSleep(optimize.job);
    optimize.job = null;
    const earliest = optimize.earliest;
    if (failure) earliest.message = { error: true, text: failure };
    else if (!reply) earliest.message = dropped ? { text: "The settings changed, so the search was dropped. Run it again." }
      : { text: "Cancelled. Nothing was kept from the search" + (earliest.entry ? "; the last result stays." : ".") };
    else if (!reply.value.ok) earliest.message = { error: true, text: reply.value.error };
    else earliest.entry = { value: reply.value, inputsText, ms: reply.ms, appliedText: null };
    renderOptimize();
    scheduleMc();  // an automatic Monte Carlo waits for the search
  }

  function earliestResult(entry) {
    const result = entry.value;
    const applied = optimizeApplied(entry);
    const stale = !applied && entry.inputsText !== JSON.stringify(state.inputs);
    const card = document.createElement("div");
    card.className = "card" + (stale ? " stale-results" : "");
    card.id = "earliestResult";
    const held = result.recheck.held;
    const banner = (text, kind) => "<p class=\"banner" + (kind ? " banner-" + kind : "") + "\" role=\"note\">"
      + escapeText(text) + "</p>";
    const problem = optimizeApplyProblem(entry);
    let html = (stale ? banner("The settings changed since this search. Run it again to update it; Apply is off.", "warn")
      : "") + "<div class=\"card-head\"><h2>Earliest retirement found</h2><span class=\"chart-note\">" + result.runs
      + " runs · " + secondsText(entry.ms) + "</span></div>"
      + "<p class=\"field-help\">" + escapeText(result.stopText) + "</p>"
      + "<p id=\"earliestHeadline\">" + escapeText(result.headline) + "</p>"
      + textTable("Ages tried", result.columns, result.rows)
      + banner(result.recheck.text, held === false ? "warn" : null)
      + result.notes.map((note) => "<p class=\"field-help\">" + escapeText(note) + "</p>").join("")
      + "<p class=\"field-help\">" + escapeText(result.footnote) + "</p>";
    if (applied) {
      html += "<div class=\"run-row\"><span class=\"muted\" id=\"earliestApplied\">Applied "
        + escapeText(result.applyText) + ".</span><button type=\"button\" class=\"button button-quiet\" "
        + "id=\"earliestUndo\">Undo</button></div>";
    } else if (result.changed) {
      html += "<div class=\"run-row\"><button type=\"button\" class=\"button\" id=\"earliestApply\""
        + (problem ? " disabled" : "") + ">Apply these ages</button></div>"
        + (problem ? "<p class=\"field-help\" id=\"earliestApplyWhy\">" + escapeText(problem) + "</p>"
          : held === false ? "<p class=\"field-help\">This did not hold up on fresh draws; you can still apply it.</p>" : "");
    }
    card.innerHTML = html;
    const apply = card.querySelector("#earliestApply");
    if (apply) apply.addEventListener("click", () => applyOptimum(entry));
    const undo = card.querySelector("#earliestUndo");
    if (undo) undo.addEventListener("click", () => { undoLast(); renderOptimize(); });
    return card;
  }
  // ---- Scenarios on this device (Setup): the open scenario card, Other scenarios, New and Import ----
  // The open scenario is the settings being edited, under a name; Save (or Auto-save) keeps a copy of it under that
  // name. Other scenarios lists the saved copies except the open one, and the example household while it is not open.
  function storeScenarios() {
    store(SCENARIOS_KEY, state.scenarios);
  }

  // Every saved copy is written here: the settings (any experience block they carry taken off) with `experience`
  // joined last, as a file keeps it (storedExperience: no walkthrough `before`); the open scenario's block unless
  // another is given, and none when null is. The caller stores the list.
  function putScenario(name, inputs, experience = state.experience) {
    state.scenarios[name] = joinExperience(clone(splitExperience(inputs).inputs), storedExperience(experience));
  }

  // The open scenario's experience changed (effort, style, walkthrough progress): kept in the draft and, when the
  // scenario has a saved copy, in that copy's block alone. No run, no undo step and no unsaved mark follow.
  function saveExperience(patch) {
    if (patch) Object.assign(state.experience, patch);
    saveDraft();
    const name = state.scenarioName;
    if (!hasOwn(state.scenarios, name)) return;
    putScenario(name, state.scenarios[name]);
    storeScenarios();
  }

  // Another scenario is open: its own experience block when it has one (`found`), else the open one's effort, style,
  // risk comfort and overrides with no progress and no walkthrough (carriedExperience). `keepWalk` keeps the
  // walkthrough in progress (an import from its first step). A walkthrough left active in a file is paused, so
  // opening or importing a scenario never opens it by itself.
  function adoptExperience(found, keepWalk) {
    const walkNow = state.experience ? state.experience.walk : null;
    const next = isObject(found) ? { ...carriedExperience(found), ...clone(found) }
      : carriedExperience(state.experience);
    if (keepWalk) next.walk = walkNow;
    else if (isObject(next.walk) && next.walk.status === "active") next.walk.status = "paused";
    state.experience = next;
    loadWalk();  // the walkthrough's progress is the scenario's own
    applyExperience();
    lowRaiseNote(null, null);  // the note after a raise from Low goes with the scenario
    renderEffortViews();
  }

  function savedMessage(text, isError) {
    const message = $("savedMessage");
    message.className = isError ? "banner banner-error" : "banner";
    message.textContent = text;
    if (isError) { stopBannerFade(message); message.hidden = false; } else showFadingBanner(message);  // errors stay
  }

  // Keep the open scenario's settings as its saved copy (Save, and Auto-save after each settled edit). Returns the
  // reason when it could not (this device keeps at most SAVED_LIMIT scenarios), else null.
  function saveOpen() {
    const name = state.scenarioName;
    if (!hasOwn(state.scenarios, name) && Object.keys(state.scenarios).length >= SAVED_LIMIT) {
      return "This device keeps at most " + SAVED_LIMIT + " scenarios. Delete one first.";
    }
    putScenario(name, state.inputs);
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

  // Auto-save is on by default, for every scenario (a first visit, New, Duplicate, an import): only a scenario whose
  // switch was turned off keeps it off (its name in `state.autoSaveOff`, kept on this device).
  function autoSaveOn() {
    return !state.autoSaveOff.includes(state.scenarioName);
  }

  function toggleAutoSave() {
    const name = state.scenarioName;
    state.autoSaveOff = autoSaveOn() ? state.autoSaveOff.concat([name])
      : state.autoSaveOff.filter((item) => item !== name);
    savePrefs();
    if (autoSaveOn() && hasUnsavedChanges()) {
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
    if (autoSaveOn() && hasUnsavedChanges()) {
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
    if (autoSaveOn() && hasUnsavedChanges()) {
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

  // The places (tab, and chip on Inputs) whose panel draws a path, the closest field name first (Strategies' fields on
  // Strategy); Setup when its cards draw the path outside any panel.
  function undonePlaces(path) {
    const places = [];
    for (const panel of state.schema.panels) {
      const match = panelNames(panel).filter((name) => path === name || path.startsWith(name + "."))
        .sort((a, b) => b.length - a.length)[0];
      if (!match) continue;
      let tab = paneTab(panel.id);
      // At Low, Household's fields are on the Low page (Inputs); the inflation and run fields stay on Setup.
      if (tab === "setup" && lowOn() && ![...INFLATION_CARD_FIELDS, ...RUN_CARD_FIELDS].includes(match)) tab = "inputs";
      places.push({ length: match.length, tab, chip: panel.id });
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
    revealPanels(element);  // a folded panel opens first
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
        if (place.tab === "inputs" && state.chips.settings !== place.chip && !lowOn()) {  // the Low page has no chips
          state.chips.settings = place.chip;
          savePrefs();
          renderSettings();
        }
        goToPane(place.tab);
        revealField(path);  // a folded panel opens first
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
          closeSheet(true);
          found = drawnField(path, document);
          if (!found) return;
        }
        const shut = found.element.closest("details:not([open])");  // Advanced settings: the inflation and run
        if (shut) shut.open = true;
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
  // `onClose`: called once when the dialog closes or is replaced by another (set by askExperience, whose Escape and
  // backdrop answer Cancel).
  const dialog = { returnFocus: null, onClose: null };

  function settleDialogClose() {
    const hook = dialog.onClose;
    dialog.onClose = null;
    if (hook) hook();
  }

  // Show the dialog: `title`, `text`, `body` (elements under the text) and `actions`, each [label, class, onClick,
  // id]; an action closes the dialog unless its onClick returns false. Focus goes to `focus` (else the first field or
  // button), stays inside while it is open (Tab wraps) and goes back to the opener when it closes.
  function openDialog({ title, text, body = [], actions, focus }) {
    settleDialogClose();
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
    settleDialogClose();
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
    if (autoSaveOn() || !hasUnsavedChanges()) { then(); return; }
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

  // The settings a listed scenario stands for, as saved (its experience block included): its saved copy (upgraded
  // first when it is from an older version, and filled in the way Import fills a file when a current one lacks some
  // fields, so the draft it opens survives a reload), or the example household, as {inputs, legacy}: `legacy` when
  // the copy was upgraded from a version before the experience block (its block is a default, not a choice). Null,
  // with the message shown, when it cannot be read.
  async function listedInputs(name) {
    let inputs = savedCopy(name);
    if (!inputs) return null;
    let legacy = false;
    if (!isObject(inputs) || inputs.schemaVersion !== state.info.inputsSchemaVersion
      || !sameShape(state.defaults, splitExperience(inputs).inputs)) {
      const reply = await ask("importScenario", [JSON.stringify(inputs)]);
      if (!reply || !reply.ok) { savedMessage(reply ? reply.error : name + " could not be read; try again.", true); return null; }
      legacy = reply.fromVersion < EXPERIENCE_VERSION;
      inputs = reply.inputs;
      keepUpgradedScenario(name, inputs);
    }
    return { inputs: clone(inputs), legacy };
  }

  // ---- The opened scenario: its card glows for a second ----
  // Whenever another scenario replaces the open one (Other scenarios, Duplicate, New, Import, Load example household)
  // Setup's open-scenario card is brought into view (when Setup shows) and its edge glows, fading over a second like
  // the Undo flash (same class; held still for that second with reduced motion). Never at start-up nor for edits.
  function highlightOpenCard() {
    revealSetup();
    const card = flashField($("savedCard"));
    if (card.getClientRects().length) card.scrollIntoView({ block: "nearest" });
  }

  // Open a listed scenario. When its effort or style differ from the current ones the user is asked which to keep
  // (askExperience; Cancel leaves the open scenario as it is), except for a Duplicate (`askFirst` false) and a copy
  // saved before the experience block. The block adopted is saved, so the copy does not ask again.
  async function openSaved(name, askFirst = true) {
    const listed = await listedInputs(name);
    if (!listed) return;
    const { inputs, experience } = splitExperience(listed.inputs);
    const block = askFirst ? await askExperience(name, listed.legacy ? null : experience) : experience;
    if (block === false) return;
    forgetBlankWalk();
    state.inputs = inputs;
    takeHeirsAsLoaded();
    state.base = clone(inputs);
    state.scenarioName = name;
    adoptExperience(block, false);
    saveExperience();
    savedMessage("Opened " + name + ".", false);
    renderSettings();
    inputsChanged();
    resetUndo();
    renderSaved();
    highlightOpenCard();
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
    forgetBlankWalk();
    state.inputs = splitExperience(blankInputs(state.schema)).inputs;
    state.base = clone(state.inputs);
    state.scenarioName = name;
    adoptExperience(null, false);
    savedMessage("Created " + name + ".", false);
    renderSettings();
    inputsChanged();
    resetUndo();
    renderSaved();
    renderCompare();
    highlightOpenCard();
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
      openDialog({ title: "Import", text: "Pick a scenario file saved from Walk Me Through It.",
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
    if (state.autoSaveOff.includes(from)) {  // a switch turned off stays off under the new name
      state.autoSaveOff = state.autoSaveOff.map((name) => (name === from ? to : name));
      savePrefs();
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
    state.inputs = splitExperience(blankInputs(state.schema)).inputs;
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
    putScenario(copy, state.inputs);  // the copy keeps the open scenario's experience block
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
    const source = splitExperience(savedCopy(name));
    putScenario(copy, source.inputs, source.experience);  // the copy keeps that scenario's experience block, if any
    storeScenarios();
    savedMessage("Saved a copy of " + name + " as " + copy + ".", false);
    renderSaved();
    renderCompare();
    leaveOpen(() => openSaved(copy, false));  // never asks: the copy holds the block of the scenario it copies
  }

  function deleteDialog(name) {
    const text = hasOwn(state.scenarios, name) ? "This removes " + name + " from this device. It cannot be undone."
      : "This removes " + name + " from this list. Load example household (in the menu) brings it back.";
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
    if (name === EXAMPLE_NAME) state.exampleHidden = true;
    state.autoSaveOff = state.autoSaveOff.filter((item) => item !== name);  // a new scenario of that name starts on
    savePrefs();
    savedMessage("Deleted " + name + ".", false);
    renderOpenCard();
    renderSaved();
    renderCompare();
  }

  async function exportListed(name) {
    const listed = await listedInputs(name);
    if (listed) exportScenario(listed.inputs, name);
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

  // Whether the balance charts mark What beneficiaries keep (Total balance, Balances, Compare): on unless this device
  // turned it off.
  const heirsMark = { on: true };
  try { heirsMark.on = localStorage.getItem(HEIRS_MARK_KEY) !== "off"; } catch (error) { /* storage blocked: on */ }

  // A chart card: Chart / Table, Full screen, the chart and its table. A spec with a What beneficiaries keep mark gets
  // the "Show what beneficiaries keep" box under the chart; unticked, the card draws the spec without the mark. The
  // spec drawn is `card.chartSpec`, for attachChart.
  function chartCard(spec, rerender) {
    const marked = charts.hasAfterTax(spec);
    const shown = marked && !heirsMark.on ? charts.withoutAfterTax(spec) : spec;
    const card = document.createElement("div");
    card.className = "card chart-card";
    card.chartSpec = shown;
    card.innerHTML = "<div class=\"view-toggle\" role=\"group\" aria-label=\"Show as\"><button type=\"button\" "
      + "data-view=\"chart\">Chart</button><button type=\"button\" data-view=\"table\">Table</button></div>"
      + FULL_SCREEN_BUTTON + charts.renderChart(shown)
      + (marked ? "<label class=\"heirs-toggle\"><input type=\"checkbox\" class=\"heirs-toggle-input\""
        + (heirsMark.on ? " checked" : "") + "> Show what beneficiaries keep</label>" : "")
      + "<div class=\"chart-table\">" + charts.renderTable(shown) + "</div>";
    const toggle = card.querySelector(".heirs-toggle-input");
    if (toggle) {
      toggle.addEventListener("change", () => {
        heirsMark.on = toggle.checked;
        try { localStorage.setItem(HEIRS_MARK_KEY, heirsMark.on ? "on" : "off"); } catch (error) { /* storage blocked */ }
        (rerender || renderPlots)();
      });
    }
    spec = shown;
    const showTable = state.plotView === "table";
    card.querySelector(".chart-plot, .chart-empty").hidden = showTable;
    // The Full screen button (top right) shows the plot on the whole screen in landscape; not for the table or a
    // chart with nothing to plot.
    card.querySelector(".chart-full").hidden = showTable || !card.querySelector(".chart-plot");
    charts.attachFullScreen(card, spec);
    if (card.querySelector(".legend")) card.querySelector(".legend").hidden = showTable;
    if (card.querySelector(".heirs-toggle")) card.querySelector(".heirs-toggle").hidden = showTable;
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

  // Plots: the charts of the last Monte Carlo, marked when stale (their tables are in the Final report).
  function renderPlots() {
    noteViewSoon();  // a view left or shown (25-collapse.js)
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
        // The trim and its bounds stay on screen; why, behind the "i".
        const note = noteHelp("Leaves out the lowest and highest " + spec.trimmed.percent + "% of runs (below "
          + fullMoney(spec.trimmed.low) + " or above " + fullMoney(spec.trimmed.high) + ").", "The chart leaves out "
          + "the extreme runs so a few outcomes do not stretch the axis; the percentile table in the Final report counts every "
          + "run.", "muted");
        card.insertAdjacentHTML("beforeend", note.head + note.text);
      }
      if (stale) card.classList.add("stale-results");
      figures.push([card.querySelector("figure"), card.chartSpec]);
      parts.push(card);
    }
    if (view.id === "flows") {  // where the RMD schedule table was
      const holder = document.createElement("div");
      holder.innerHTML = REPORT_POINTER_HTML;
      parts.push(holder.firstElementChild);
    }
    body.replaceChildren(...parts);
    figures.forEach(([figure, spec]) => figure && charts.attachChart(figure, spec));
  }

  // A headline chip's plot (renderPinned in 40-setup.js): the Outputs view `viewId` (PLOT_VIEWS) of the last Monte
  // Carlo in the scenario dialog, drawn by chartCard as on Outputs (dimmed when stale), or "Run the plan first" before
  // one. Closes on its X, Close, Escape or a tap outside; Chart / Table and the beneficiaries box redraw it and Outputs.
  function openPinPlot(viewId) {
    const view = PLOT_VIEWS.find((item) => item.id === viewId);
    if (!view) return;
    const holder = document.createElement("div");
    holder.className = "pin-plot-body";
    const fill = () => {
      const { entry, stale } = latestMonteCarlo();
      if (!entry) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "Run the plan first.";
        holder.replaceChildren(empty);
        return;
      }
      const cards = [];
      const figures = [];
      for (const id of view.charts || [view.id]) {
        const spec = entry.value.charts.find((item) => item.id === id);
        if (!spec) continue;
        const card = chartCard(spec, () => { fill(); renderPlots(); });
        if (stale) card.classList.add("stale-results");
        figures.push([card.querySelector("figure"), card.chartSpec]);
        cards.push(card);
      }
      holder.replaceChildren(...cards);
      figures.forEach(([figure, spec]) => figure && charts.attachChart(figure, spec));
    };
    const close = document.createElement("button");
    close.type = "button";
    close.className = "pin-plot-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg>";
    close.addEventListener("click", () => closeDialog());
    openDialog({ title: view.label, body: [holder], actions: [["Close", "button", () => true]] });
    $("dialog").classList.add("pin-plot-dialog");
    $("dialog").querySelector(".dialog-head").append(close);
    dialog.onClose = () => { $("dialog").classList.remove("pin-plot-dialog"); close.remove(); };
    fill();  // after the dialog shows, so the charts measure their width
    close.focus();
  }

  // ---- Settings ----
  function renderSettingsError() {
    for (const banner of [$("settings-error"), $("household-error")]) {  // Inputs, and Household on Setup
      banner.hidden = !state.error;
      if (state.error) banner.innerHTML = "<strong>Settings need a fix.</strong> " + escapeText(state.error);
    }
  }

  // Inputs shows every panel but Household and Strategies as a chip; Household's fields are drawn on Setup and
  // Strategies' on Strategy's Strategies view (renderStrategyPane).
  function inputsPanels() {
    return state.schema.panels.filter((panel) => panel.id !== SETUP_PANEL && panel.id !== STRATEGY_PANEL);
  }

  // The one summary at the bottom of the Expenses chip (`expenseTotals`), per month: each monthly category, Major
  // Spending and Charity paid this year (per year / 12), one Bills - Other row for the costs other tabs already charge
  // (from the settings notes, when there are any) and the one total of all ("n/a" until the notes arrive).
  function expenseSummaryCard() {
    const card = document.createElement("div");
    card.className = "card summary-only";  // a summary with no inputs: it never folds (25-collapse.js)
    card.id = "expenseSummary";
    fillExpenseSummary(card);
    return card;
  }

  function fillExpenseSummary(card) {
    const counted = state.notes && state.notes.alreadyCounted;
    const totals = expenseTotals(expenseSummary(state.inputs.expenses, state.info && state.info.expenseCategories,
      state.inputs.you && state.inputs.you.currentAge), counted ? counted.rows : null);
    const nonZero = (row) => Math.abs(Number(row.monthly) || 0) >= 0.005;  // a row of $0 is left out
    const line = (row, strong) => {
      const cell = (value) => "<td>" + (strong ? "<strong>" + fullMoney(value) + "</strong>" : fullMoney(value)) + "</td>";
      return "<tr><th scope=\"row\">" + escapeText(row.item) + "</th>" + cell(row.monthly) + "</tr>";
    };
    // What the rows count, behind the heading's "i" rather than on screen.
    const about = titleHelp("h2", "Total expenses", counted ? counted.totalsHelp + " " + EXPENSE_COUNTED_NOTE
      : EXPENSE_ROWS_NOTE + " " + EXPENSE_COUNTED_NOTE);
    card.innerHTML = about.head + about.text + "<table class=\"data-table\"><thead><tr><th scope=\"col\">Expenses</th>"
      + "<th scope=\"col\">Monthly</th></tr></thead><tbody>"
      + totals.entered.filter(nonZero).map((row) => line(row, false)).join("")
      + (totals.counted && nonZero(totals.counted) ? line(totals.counted, false) : "")
      + line(totals.total || { item: "Total expenses", monthly: null }, true)
      + "</tbody></table>";
  }

  const EXPENSE_ROWS_NOTE = "Major Spending and Charity count the rows paid this year, at your age today.";
  const EXPENSE_COUNTED_NOTE = "Bills - Other is what the other tabs charge in the first year of the run.";

  // The read-only card at the top of the Expenses chip: the costs other tabs already charge (from the settings notes),
  // so they are not entered again as expense rows, in one table under their one group (Bills - Other;
  // `alreadyCountedGroups`) and the note on the taxes under it; it reads "Reading the run" until the notes arrive.
  // The amounts come first and the tab it is set on last, so the table fits a phone without scrolling sideways.
  const COUNTED_COLUMNS = [["item", "Item"], ["monthly", "Monthly"], ["yearly", "Yearly"], ["where", "Set on"]];

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
    // A row of $0 this year that the run charges later (`later`) shows in italics with that first later year's amount,
    // starred, and its age and year after the tab; the footnote (`laterNote`) says it is for reference only.
    const counts = (row) => {
      const later = row.later;
      const amount = (value) => later ? fullMoney(value) + "*" : fullMoney(value);
      const where = later ? row.where + " (age " + later.age + ", " + later.year + ")" : row.where;
      return "<tr" + (later ? " class=\"counted-later\"" : "") + "><th scope=\"row\">" + escapeText(row.item)
        + "</th><td>" + amount(later ? later.monthly : row.monthly) + "</td><td>"
        + amount(later ? later.yearly : row.yearly) + "</td><td class=\"text source\" title=\"" + escapeText(where)
        + "\">" + escapeText(where) + "</td></tr>";
    };
    const anyLater = counted.groups.some((group) => group.rows.some((row) => row.later));
    const groups = counted.groups.map((group) => {
      const title = titleHelp("h3", group.category, group.help, "sub-heading");
      const rows = group.rows.map(counts).join("");
      return "<div class=\"counted-group\" data-category=\"" + escapeText(group.category) + "\">" + title.head + title.text
        + "<div class=\"table-scroll\" tabindex=\"0\" role=\"region\" aria-label=\"" + escapeText(group.category)
        + "\"><table class=\"data-table wrap-first counted-table\"><thead><tr>" + head + "</tr></thead><tbody>" + rows
        + "</tbody></table></div></div>";
    }).join("");
    card.innerHTML = about.head + about.text + groups
      + (anyLater && counted.laterNote ? "<p class=\"note counted-later-note\">" + escapeText(counted.laterNote) + "</p>" : "")
      + "<p class=\"note\">" + escapeText(counted.note) + "</p>";
  }

  function renderSettings() {
    noteViewSoon();  // a view left or shown (25-collapse.js)
    if (lowOn()) {  // Low: the one Low page; Setup keeps its error banner, the hidden Household card and Advanced
      renderSettingsError();
      renderHousehold();
      renderStrategyPane();
      renderRunCard();
      renderLowPage();
      renderBand();
      return;
    }
    hideLowPage();
    const panels = inputsPanels();
    const selected = inputsChip(panels.map((panel) => panel.id), state.chips.settings);
    renderChips("chips-settings", panels.map((panel) => ({ id: panel.id, label: panel.label })), selected, (id) => {
      state.chips.settings = id; savePrefs(); renderSettings();
    });
    renderSettingsError();
    const panel = panels.find((item) => item.id === selected);
    const sections = panelSections(panel);
    $("settings-body").replaceChildren(...(sections.length ? sections : [emptyPaneNote(panel)]));
    if (selected === "expenses") {  // the costs other tabs charge on top, the entered rows, then the one summary
      $("settings-body").prepend(alreadyCountedCard());
      $("settings-body").append(expenseSummaryCard());
    }
    const detail = paneDetailRow(selected);  // Medium: the pane's Add detail, at the end of its body
    if (detail) $("settings-body").append(detail);
    renderHousehold();
    renderStrategyPane();
    applyNotes();
    applyBenefits();
    renderDeposits();
    renderSplit(HEIR_SPLIT);
    fillHeirNotice();
    requestNotes();
    requestBenefits();
    requestEarnings();
    requestDeposits();
    renderRunCard();
    renderBand();
    renderEarningsReturn();
    // Fold the redrawn panels now, not on the observer's later pass: a control focused after this redraw (a switch
    // just turned) is then measured in the folded page, so the browser does not scroll to it (25-collapse.js).
    enhancePanels();
  }

  // A pane whose every entry Medium hides (Strategies): its title, a note on where its inputs are, and for
  // Strategies the optimizer link; the Add detail row follows it.
  const STRATEGIES_MEDIUM_NOTE = "Strategies such as Roth conversions, backdoor Roth, charitable gifts and relocation "
    + "are shown at High effort. Add detail shows them here.";
  // At Low (no Add detail) the Strategies view shows only this note and the optimizer link.
  const STRATEGIES_LOW_NOTE = "Strategies such as Roth conversions, backdoor Roth, charitable gifts and relocation "
    + "are set at Medium or High effort.";
  function emptyPaneNote(panel) {
    const group = document.createElement("fieldset");
    group.className = "group pane";
    group.innerHTML = "<legend><span class=\"legend-title\"><span class=\"pane-icon\">"
      + iconSvg(iconFor(panel.id || "", panel.label), "pane-svg") + "</span><span>" + escapeText(panel.label)
      + "</span></span></legend>";
    const note = document.createElement("p");
    note.className = "note detail-empty";
    note.textContent = panel.id !== "strategies" ? "This page's inputs are shown at High effort. Add detail shows them here."
      : lowOn() ? STRATEGIES_LOW_NOTE : STRATEGIES_MEDIUM_NOTE;
    group.append(note);
    if (panel.id === "strategies") group.append(optimizeLink());
    return group;
  }

  // Strategy's Strategies view: the Strategies settings panel, as an Inputs chip draws its panel, with the warnings
  // after the last strategy and, at Medium, the pane's Add detail. At Low only the note and the optimizer link.
  function renderStrategyPane() {
    const panel = state.schema.panels.find((item) => item.id === STRATEGY_PANEL);
    const body = $("strategy-body");
    if (!panel) { body.replaceChildren(); return; }
    const sections = lowOn() ? [] : panelSections(panel);
    body.replaceChildren(...(sections.length ? sections : [emptyPaneNote(panel)]));
    const detail = lowOn() ? null : paneDetailRow(STRATEGY_PANEL);
    if (detail) body.append(detail);
  }

  // The Household panel on Setup: the partner switch and the panel's fields (the seed, runs and the
  // inflation adjusted switch and range are in the Inflation and Run cards of Advanced settings). At Low the card is
  // hidden: its fields are on the Low page.
  function renderHousehold() {
    const panel = lowOn() ? null : state.schema.panels.find((item) => item.id === SETUP_PANEL);
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
  // At Medium an entry above the effort (and not shown by Add detail, see entryShown) is left out, and a section with
  // no entry shown is not drawn.
  function panelSections(panel) {
    drawingPane = panel.id;  // the object children drawn below follow this pane's Add detail
    // The Home and Cars panels open with their timeline, once, above every section.
    const timelineKind = ((state.schema.timeline || {}).panels || {})[panel.id];
    if (timelineKind && !panel.timelineDrawn) {
      return [timelineBlock(timelineKind), ...panelSections({ ...panel, timelineDrawn: true })];
    }
    if (panel.sections) {
      return panel.sections.filter((section) => section.fields.some((name) => conditionMet(panel, name)
        && entryShown(panel, name)))
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
      // Another Inputs panel named in it as "<label> tab" (the Medical plan's Retirement tab) is a button that opens it.
      const linked = (state.schema.panels || []).find((item) => item.id !== panel.id
        && panel.lead.includes(item.label + " tab"));
      if (linked) {
        const words = linked.label + " tab";
        const at = panel.lead.indexOf(words);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pane-lead-link";
        button.textContent = words;
        button.addEventListener("click", () => goToInputsPanel(linked.id));
        lead.append(panel.lead.slice(0, at), button, panel.lead.slice(at + words.length));
      } else {
        lead.textContent = panel.lead;
      }
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
      if (!entryShown(panel, name)) continue;
      if (name === panel.switch) {
        group.append(sectionSwitch(name));
        continue;
      }
      if (switchOff || !conditionMet(panel, name)) continue;
      const subsection = (panel.subsections || []).find((item) => item.fields.includes(name));
      if (subsection) {
        if (name === subsection.fields.find((item) => entryShown(panel, item))) {
          group.append(...panelSections({ ...panel, label: subsection.label, fields: subsection.fields, note: null,
            switch: subsection.switch, subsections: null, subsection: true, help: subsection.help }));
        }
        continue;
      }
      if (name === TERMINAL_PATH) {  // the beneficiaries' tax rate box with its estimate, in Beneficiaries
        group.append(...terminalRateCard());
        continue;
      }
      if (name === HEIRS_PATH) {  // the list and its share sliders, in Beneficiaries
        group.append(...beneficiaryList());
        continue;
      }
      let field = panelField(state.schema, name);
      if (!field || (panel.id === SETUP_PANEL && [...INFLATION_CARD_FIELDS, ...RUN_CARD_FIELDS].includes(name))) continue;
      if (name.includes(".") && getPath(state.inputs, name.split(".")[0]) == null) continue;
      if (panel.id === "retirement" && name.endsWith(".socialSecurityByAge")
        && getPath(state.inputs, name.split(".")[0] + ".socialSecurityBasis") === "earnings") continue;  // Manual entry only
      if (panel.headings && panel.headings[name]) group.append(personHeading(panel.headings[name], group));
      if (panel.labels && panel.labels[name]) field = { ...field, label: panel.labels[name] };
      // The plan's only field is its switch (drawn above); "contributions" places the deposit per account below.
      if (panel.id === "savings" && name === "contributions") continue;
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
      if (panel.id === "retirement" && name === PART_B_SWITCH) element.append(partBRow(element));
      if (panel.id === "retirement" && name === "retirementSpending.startAge") {
        spendingStartHint(element);  // the age a blank start means, as the box's placeholder
        group.append(spendingBox());  // Per expense: every Expenses row with its percent; then the change's caption
      }
    }
    const resetRoots = Object.entries(state.schema.resetGroups || {}).filter(([root, reset]) =>
      reset.panel === panel.id && panel.fields.some((name) => name.startsWith(root + "."))).map(([root]) => root);
    if (resetRoots.length) group.append(resetDefaultsButton(resetRoots));
    const sections = [group];
    if (panel.id === "loans") group.append(...mortgageRows(), ...carLoanRows());
    if (panel.id === "cars") group.append(warningsBox("car-warnings"));
    if (panel.id === "children") group.append(warningsBox("child-heir-warnings"));  // children's beneficiaries kept  // Expenses rows a car charges again
    if (panel.id === "home" && panel.fields.includes("homes")) {
      group.append(warningsBox("home-warnings"));  // in the Homes pane: a Mortgage while renting, bills counted twice
    }
    if (panel.id === "savings" && panel.subsection && panel.fields.includes("hsa.enabled")
      && getPath(state.inputs, "hsa.enabled")) {
      group.append(warningsBox("hsa-warnings"));  // the medical plan's deductible below the HSA's minimum
    }
    if (panel.id === "savings" && panel.fields.includes("dependentCareFsa")
      && getPath(state.inputs, "dependentCareFsa.enabled")) {
      group.append(warningsBox("fsa-warnings"));  // an FSA that excludes nothing
    }
    if (panel.id === "accounts") {
      group.append(...benefitAccountRows());
      // The surplus split edits each account's surplus share (High): at Medium it waits for Add detail, and the
      // stored shares keep working (renderSplit draws nothing without its holder).
      const share = (state.schema.types.Account || []).find((child) => child.name === "surplusShare");
      if (detailShownFor("Account", share, panel.id)) sections.push(surplusSection());
    }
    if (panel.id === "savings" && panel.fields.includes("contributions") && getPath(state.inputs, "contributions.enabled")) {
      group.append(depositSection());  // in the Retirement plan pane, one panel with the plan
    }
    if (panel.id === "retirement" && panel.fields.includes("premiums.medicareAge")) {
      group.append(warningsBox("medicare-warnings"));  // the early IRMAA tier is estimated
    }
    if (panel.id === "strategies" && panel.fields.includes("strategies.qcd")) {
      group.append(warningsBox("strategy-warnings"));  // once, after the last strategy
      const link = optimizeLink();  // at the top, in a section of its own before the toggles
      link.classList.add("pane-section");
      group.prepend(link);
      if (link.nextElementSibling) link.nextElementSibling.classList.add("section-break");
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

  // The Expenses chip's two lists: the monthly categories, then Major Spending and Charity
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

  // The Loans chip's read-only home loan rows: each home's mortgage (titled with the home's name: owed today, or
  // borrowed at a later purchase, with when it starts and ends), then one row per loan each home holds (titled with
  // the home's name, its kind first), with a button that opens the Home chip where they are edited; nothing without a
  // home loan. A Mortgage loan still on the Loans list is edited there, in the list below.
  function mortgageRows() {
    const homes = state.inputs.homes || [];
    const mortgages = homes.flatMap((home) => (home.loans || []).map((loan) => ({ home, loan })));
    const rules = state.info.sheetRules;
    const borrowed = (home) => (home.buysLater ? home.purchasePrice * (1 - home.downPaymentRate)
      : homeMortgageNow(home, rules).balance);
    const monthsLeft = (home) => (home.buysLater ? home.mortgageMonthsLeft : homeMortgageNow(home, rules).monthsLeft);
    const owing = homes.filter((home) => home.hasMortgage && borrowed(home) > 0);
    if (!mortgages.length && !owing.length) return [];
    const wrap = fieldShell("Home loans", "Read-only here: each home's mortgage and its other loans (second mortgage, "
      + "home equity) are entered and edited on the home, on the Home chip.", null);
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
        + monthsLeft(home) + " months" + (span ? " · " + span : "");
      wrap.append(row);
    }
    for (const { home, loan } of mortgages) {
      const summary = itemSummary("Loan", loan);
      const row = document.createElement("div");
      row.className = "item item-readonly";
      row.innerHTML = "<span class=\"item-name\"></span><span class=\"item-value\"></span>"
        + "<span class=\"item-detail\"></span>";
      row.querySelector(".item-name").textContent = home.name;
      row.querySelector(".item-value").textContent = summary.value;
      row.querySelector(".item-detail").textContent = (loan.name ? loan.name + " · " : "") + summary.detail;
      wrap.append(row);
    }
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-quiet";
    edit.textContent = "Edit home loans on Home";
    edit.addEventListener("click", () => {
      state.chips.settings = "home";
      savePrefs();
      renderSettings();
    });
    wrap.append(edit);
    return [wrap];
  }

  // The Part B switch's read-only line (`state.info.medicarePartB`, wmti `medicarePartBInfo`): the law data's standard
  // premium and deductible, shown while the switch is on. The model adds IRMAA on higher incomes.
  const PART_B_SWITCH = "premiums.partB";
  function partBRow(element) {
    const partB = state.info.medicarePartB;
    const row = document.createElement("div");
    row.className = "item item-readonly part-b-row";
    row.innerHTML = "<span class=\"item-name\"></span><span class=\"item-detail\"></span>";
    const dollars = (value, digits) => "$" + value.toLocaleString("en-US",
      { minimumFractionDigits: digits, maximumFractionDigits: digits });
    row.querySelector(".item-name").textContent = "Part B premium " + dollars(partB.monthlyPremium, 2)
      + " per person per month (" + partB.year + ", set by law) · deductible " + dollars(partB.annualDeductible, 0)
      + " a year";
    row.querySelector(".item-detail").textContent = "Higher incomes pay more (IRMAA), added by the model";
    const input = element.querySelector("input[type=checkbox]");
    const show = () => { row.hidden = !input.checked; };
    input.addEventListener("change", show);
    show();
    return row;
  }

  // The Accounts chip's read-only benefit accounts (`benefitAccounts`): the HSA while it counts and the dependent care
  // FSA while it is on, with what each starts with and its return, and a button that opens the Benefits chip where
  // they are set. They are not in the accounts list, so they take no part in the withdrawal order or the surplus.
  function benefitAccountRows() {
    const accounts = benefitAccounts(state.inputs);
    if (!accounts.length) return [];
    const wrap = fieldShell("Benefit accounts", "Read-only here: the HSA and the dependent care FSA are set on the "
      + "Benefits chip. They pay their own costs (qualified healthcare, dependent care), so they are outside the "
      + "withdrawal order and get no surplus cash. The FSA starts each year empty and is used up by the year's care.",
      null);
    wrap.classList.add("benefit-account-rows");
    for (const account of accounts) {
      const row = document.createElement("div");
      row.className = "item item-readonly";
      row.dataset.kind = account.kind;
      row.innerHTML = "<span class=\"item-name\"></span><span class=\"item-value\"></span>"
        + "<span class=\"item-detail\"></span>";
      row.querySelector(".item-name").textContent = account.name;
      row.querySelector(".item-value").textContent = compactMoney(account.value);
      row.querySelector(".item-detail").textContent = account.kind === "hsa"
        ? "Return " + percent(account.meanReturn, 2) + " ± " + percent(account.returnStdDev, 2) + " · "
          + choiceLabel(schemaField("HsaPlan", "owner"), account.owner)
          + " · " + (account.sizing === "max" ? "puts in the most allowed" : "puts in what the year's costs need")
        : "No return · starts each year empty";
      wrap.append(row);
    }
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-quiet";
    edit.textContent = "Edit on Benefits";
    edit.addEventListener("click", () => {
      state.chips.settings = "savings";
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
    const rules = state.info.sheetRules;
    const owing = (state.inputs.cars || []).filter((car) => hasCarLoan(car, rules));
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
      const now = car.buysLater ? null : carLoanNow(car, rules);
      row.querySelector(".item-value").textContent = compactMoney(now ? now.balance
        : car.purchasePrice * (1 - car.downPaymentRate));
      row.querySelector(".item-detail").textContent = car.name + " loan · " + percent(car.loanRate, 2) + " · "
        + (now ? now.monthsLeft : car.loanMonthsLeft) + " months" + (span ? " · " + span : "");
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

  // A section's switch, such as whether the household has a medical plan; turning it redraws the section. It has no
  // "i": the pane being on or off says it all.
  function sectionSwitch(path) {
    const field = panelField(state.schema, path);
    const id = fieldId(path);
    const element = switchField(field.label, null, id, Boolean(getPath(state.inputs, path)), (checked) => {
      setValue(path, checked);
      refreshForm();
      const redrawn = $(id);
      if (redrawn) redrawn.focus();
    });
    element.classList.add("pane-switch");  // its toggle sits at the right of the pane's title
    return element;
  }

  // ---- Benefits, Retirement plan: its switch, each person's deposit (% of pay, see depositShareField) and employer
  // match (panel fields drawn first), then the deposit notes; the dollar slider per account shows only while deposits
  // are set per account ----
  function depositSection() {
    const part = document.createElement("div");
    part.className = "surplus deposits";
    part.id = "deposits";
    // The deposits explanation (`depositSliders` caption) sits behind the title's "i" (depositRows fills it).
    part.innerHTML = "<div class=\"title-help\"><p class=\"field-label deposit-title\">Deposit per account</p>"
      + helpButtonHtml("Deposit per account", "deposit-caption") + "</div><div class=\"surplus-body\" "
      + "id=\"depositBody\"><p class=\"note\">Reading the limits</p></div>";
    return part;
  }

  function depositsWanted() {
    return tabShown("inputs") && state.chips.settings === "savings" && state.schema != null;
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
    syncDepositCaps();  // each person's deposit cap follows the same answer
    if (!holder || !deposits) return;
    const title = holder.parentElement.querySelector(".title-help");
    if (title) title.hidden = !(deposits.ok && deposits.perAccount);  // the dollar sliders' title, with them
    if (!deposits.ok || !deposits.accounts.length) {
      holder.dataset.key = "";
      holder.innerHTML = deposits.ok ? "<p class=\"banner\">" + escapeText(deposits.empty) + "</p>"
        : "<p class=\"banner banner-warn\" role=\"note\">Fix the settings to set deposits. " + escapeText(deposits.error)
          + "</p>";
      return;
    }
    const key = JSON.stringify([deposits.perAccount, deposits.notes, state.depositMoveNotes,
      deposits.accounts.map((item) => [item.name, item.kind, item.owner, item.noRoom])]);
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
      row.querySelector(".deposit-help").textContent = depositCaption(item);
    });
  }

  // A slider's caption, per person: the owner's own deposit (and its share of their pay) against the owner's own
  // limit, what the owner's other accounts sharing that limit take, and apart from it any deposit of the other person
  // that lands here on the plan (they have no account of their own).
  function depositCaption(item) {
    const whose = item.owner === 0 ? ["Your", "your"] : ["Your partner's", "their"];
    const other = item.owner === 0 ? "your partner's" : "your";
    const own = item.ownDeposit == null ? item.value : item.ownDeposit;
    let text = whose[0] + " deposit " + fullMoney(own)
      + (item.percentOfPay != null ? " (" + percent(item.percentOfPay, 1) + " of pay)" : "") + ". Limit "
      + fullMoney(item.limit) + " a year, of which " + whose[1] + " other accounts sharing it take "
      + fullMoney(item.usedByOthers) + "; at most " + fullMoney(item.maximum) + " here.";
    if (item.fromOthers > 0) text += " Plus " + other + " " + fullMoney(item.fromOthers) + " goes to this account.";
    return text;
  }

  // On the household plan only the notes show (the deposits are entered as % of pay); with amounts per account, the
  // dollar slider per account with its caption, the notes and the way back to the plan.
  function depositRows(deposits) {
    if (!deposits.perAccount) return depositNotes(deposits);
    const caption = document.createElement("p");
    caption.className = "field-help info-box";  // the deposit-per-account explanation, behind the title's "i"
    caption.id = "deposit-caption";
    caption.textContent = deposits.caption;
    const button = document.querySelector("[aria-controls=\"deposit-caption\"]");
    caption.hidden = !button || button.getAttribute("aria-expanded") !== "true";  // a rebuild keeps it open or shut
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
    parts.push(...depositNotes(deposits));
    const back = document.createElement("button");
    back.type = "button";
    back.className = "button button-quiet";
    back.textContent = "Go back to the household plan";
    back.addEventListener("click", useHouseholdPlan);
    parts.push(back);
    return parts;
  }

  function depositNotes(deposits) {
    return [...(deposits.perAccount ? state.depositMoveNotes : []), ...deposits.notes].map((text) => {
      const note = document.createElement("p");
      note.className = "info-box";
      note.textContent = text;
      return note;
    });
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
    let switched = false;
    if (reply && reply.value.inputs) {
      const accounts = reply.value.inputs.accounts;
      state.inputs.accounts.forEach((account, position) => {
        if (accounts[position]) account.deposit = accounts[position].deposit;
      });
      // The first move names the amounts it wrote (moveDeposit notes); they stay until the plan is back.
      if (reply.value.notes && reply.value.notes.length) state.depositMoveNotes = reply.value.notes;
      switched = Boolean(reply.value.sliders && reply.value.sliders.perAccount
        && !(state.deposits && state.deposits.perAccount));
      if (reply.value.sliders) state.deposits = reply.value.sliders;
      inputsChanged();
    }
    const next = depositMove.pending;
    depositMove.pending = null;
    // Amounts per account grey out each person's deposit boxes, so the pane is drawn again once.
    if (switched) refreshForm();
    else renderDeposits();
    renderSheetDeposit();
    if (next) moveDeposit(next.name, next.amount);
  }

  // ---- An IRA's item sheet: the Benefits pane's deposit slider for that account (depositSliders), moved through
  // moveDeposit, so the sheet and Benefits always show the one stored `deposit` ----
  function sheetDepositBox(account) {
    const kinds = (state.info.sheetRules.depositKinds || []).filter((kind) => kind.endsWith("IRA"));
    if (!account || !kinds.includes(account.kind)) return null;
    const box = document.createElement("div");
    box.className = "field surplus-row deposit-row sheet-deposit";
    box.id = "sheetDeposit";
    box.dataset.name = account.name;
    box.innerHTML = "<div class=\"deposit-head\"><label class=\"field-label\" for=\"sheetDepositRange\">Deposit per "
      + "year</label><output class=\"surplus-value\"></output></div><input type=\"range\" class=\"range\" "
      + "id=\"sheetDepositRange\" min=\"0\" hidden><p class=\"field-help deposit-help\">Reading the limits</p>";
    const slider = box.querySelector("input");
    slider.addEventListener("input", () => moveDeposit(account.name, Number(slider.value)));
    requestSheetDeposit();
    return box;
  }

  async function requestSheetDeposit() {
    const inputsText = JSON.stringify(state.inputs);
    let reply;
    try {
      reply = await engine.call("depositSliders", [inputsText], "deposits");
    } catch (error) {
      return;
    }
    if (!reply || inputsText !== JSON.stringify(state.inputs)) return;  // a newer edit asks again
    state.deposits = reply.value;
    renderSheetDeposit();
  }

  // Draw the open sheet's deposit slider from state.deposits: its value, maximum and the Benefits caption; on the
  // household plan the caption says a move sets amounts per account in place of each person's % of pay.
  function renderSheetDeposit() {
    const box = $("sheetDeposit");
    const deposits = state.deposits;
    if (!box || !deposits) return;
    const slider = box.querySelector("input");
    const help = box.querySelector(".deposit-help");
    const item = deposits.ok ? deposits.accounts.find((entry) => entry.name === box.dataset.name) : null;
    slider.hidden = !item || Boolean(item.noRoom);
    if (!deposits.ok) {
      help.textContent = "Fix the settings to set deposits. " + deposits.error;
      return;
    }
    if (!item) return;
    if (item.noRoom) {
      box.querySelector(".surplus-value").textContent = "";
      help.textContent = "No room, " + item.noRoom + ".";
      return;
    }
    box.querySelector(".surplus-value").textContent = fullMoney(item.value);
    slider.step = String(deposits.step);
    slider.max = String(item.maximum);
    if (!(depositMove.pending && depositMove.name === item.name)) slider.value = String(item.value);
    slider.setAttribute("aria-valuetext", fullMoney(item.value));
    help.textContent = depositCaption(item) + (deposits.perAccount ? ""
      : " Moving it sets an amount per account on Benefits in place of each person's % of pay.");
  }

  // Blank every 401k and IRA deposit, so the household plan applies again; each person's deposit boxes come back.
  function useHouseholdPlan() {
    const kinds = state.info.sheetRules.depositKinds;
    for (const account of state.inputs.accounts) if (kinds.includes(account.kind)) account.deposit = null;
    state.depositMoveNotes = [];
    inputsChanged();
    refreshForm();
    requestDeposits();
  }

  // ---- Retirement, Spending in retirement: in Per expense, one row per Expenses row with its own percent (stored in
  // the row, `expenses.<i>.retirementChange`) and the amount after it; then the monthly rows before and after ----
  function spendingBox() {
    const box = document.createElement("div");
    box.className = "spending";
    box.id = "spendingBox";
    if (getPath(state.inputs, "retirementSpending.mode") === "perExpense") {
      const field = (state.schema.types.ExpenseItem || []).find((item) => item.name === "retirementChange");
      const { head, text } = titleHelp("h4", "Change per expense", field.help, "spending-title");
      box.insertAdjacentHTML("beforeend", head + text);
      const rows = spendingChangeRows(state.inputs);
      if (!rows.length) box.insertAdjacentHTML("beforeend", "<p class=\"note\">No Expenses rows yet.</p>");
      rows.forEach((row, position) => {
        const path = "expenses." + position + ".retirementChange";
        const id = fieldId(path);
        const line = document.createElement("div");
        line.className = "field spending-row";
        line.dataset.position = String(position);
        line.innerHTML = "<div class=\"field-head\"><label class=\"field-label\" for=\"" + id + "\">"
          + escapeText(row.name || "(no name)") + "</label></div><p class=\"note spending-detail\">"
          + escapeText(row.category + " · " + fullMoney(row.amount) + " a " + row.unit) + "</p>";
        line.append(numberInput(id, field, row.change, (next) => setValue(path, next)));
        line.insertAdjacentHTML("beforeend", "<p class=\"note spending-after\"></p>");
        box.append(line);
      });
    }
    box.insertAdjacentHTML("beforeend", "<p class=\"note spending-preview\" id=\"spendingPreview\"></p>");
    refreshSpending(box);
    return box;
  }

  // Fill the after amounts and the caption from the inputs, in place, so a percent being typed keeps its box.
  function refreshSpending(holder) {
    const box = holder || $("spendingBox");
    if (!box) return;
    const rows = spendingChangeRows(state.inputs);
    for (const line of box.querySelectorAll(".spending-row")) {
      const row = rows[Number(line.dataset.position)];
      if (row) line.querySelector(".spending-after").textContent = "After: " + fullMoney(row.after) + " a " + row.unit;
    }
    spendingStartHint(document);
    const start = spendingStartAge(state.inputs);
    const preview = spendingChangePreview(state.inputs);
    const year = " (" + yearOfAge(start, state.inputs.you.currentAge, state.info.lawTaxYear) + ").";
    let text = getPath(state.inputs, "retirementSpending.startAge") == null
      ? "Starts at " + spendingStartDefault() + ", " + start + year : "Starts at age " + start + year;
    if (preview) {
      text += " From then your monthly rows change from " + fullMoney(preview.before) + " to "
        + fullMoney(preview.after) + " a month (today's dollars).";
      if (preview.fromFirstYear) text += " The start age is at or before your age today, so the change applies from "
        + "the first year; the Expenses totals show the amounts entered.";
    }
    box.querySelector(".spending-preview").textContent = text;
  }

  // What a blank start age means, in words (wmti defaultSpendingStartAge): your claim age, else your stop age.
  function spendingStartDefault() {
    return hasSocialSecurity(state.inputs.you) ? "your Social Security age" : "the age you stop working";
  }

  // Show the age a blank start age means as the start age box's placeholder, so a blank box is never empty of meaning.
  function spendingStartHint(holder) {
    const input = holder.querySelector("#" + fieldId("retirementSpending.startAge"));
    if (!input) return;
    const blank = { ...state.inputs, retirementSpending: { ...state.inputs.retirementSpending, startAge: null } };
    input.placeholder = "Starts at " + spendingStartDefault() + ", " + spendingStartAge(blank);
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
    return tabShown("inputs") && state.chips.settings === "retirement" && state.schema != null;
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
      if (box) {
        box.innerHTML = benefitHtml(person);
        wireClaimFold(box);
      }
      updateClaimSelect(person);
    }
  }

  // The claim estimates (the benefit table or the estimate from earnings) sit closed under a "Claim estimates"
  // disclosure, closed on every start; one opened stays open for the visit (`state.openFolds`, not kept), per person.
  const CLAIM_FOLD_LABEL = "Claim estimates";

  function claimFoldKey(role) {
    return "inputs:claim-estimates:" + role;
  }

  function claimFold(role, inner) {
    const open = state.openFolds.includes(claimFoldKey(role)) ? " open" : "";
    return "<details class=\"field-collapse claim-fold\" data-role=\"" + escapeText(role) + "\"" + open + "><summary>"
      + CLAIM_FOLD_LABEL + "</summary>" + inner + "</details>";
  }

  function wireClaimFold(box) {
    const details = box.querySelector(":scope > .claim-fold");
    if (!details) return;
    details.addEventListener("toggle", () => {
      const key = claimFoldKey(details.dataset.role);
      const opened = state.openFolds.includes(key);
      if (details.open === opened) return;
      state.openFolds = state.openFolds.filter((item) => item !== key);
      if (details.open) state.openFolds.push(key);
    });
  }

  // The benefit used at the claim age, then: on Manual entry (or an
  // earnings basis the estimate cannot cover) the read-only benefit table (age, entered, used, basis); on Earnings
  // history only the estimate with its caption and warnings. The table (and the estimate's caption) is folded under
  // "Claim estimates" (claimFold).
  function benefitHtml(person) {
    let html = person.used ? "<p class=\"field-help benefit-used\">" + escapeText(person.used) + "</p>" : "";
    if (person.basisError) html += "<p class=\"banner banner-error\" role=\"alert\">" + escapeText(person.basisError) + "</p>";
    if (person.basis !== "earnings" || person.basisError) {
      const help = titleHelp("p", "Benefit table", "Read-only: the monthly benefit at each claim age in today's dollars. "
        + "Benefit used is what the model pays; the ages from " + state.info.claimAgeRange[0] + " to "
        + state.info.claimAgeRange[1] + " you did not enter are estimated. Enter amounts in "
        + "“Social Security benefit by claim age” above.", "field-label");
      return html + claimFold(person.role, help.head + help.text + charts.renderUnitsTable({ columns: ["Claim age",
        "Benefit you enter", "Benefit used", "Basis"], data: person.table.data }, ["text", "money", "money", "text"],
      { title: "Benefit table" }));
    }
    const estimate = person.estimate;
    if (!estimate) return html;
    const about = titleHelp("p", "Estimate from earnings", estimate.note, "field-label");  // EARNINGS_NOTE as a tooltip
    html += about.head + about.text;
    if (estimate.error) return html + "<p class=\"banner banner-warn\" role=\"note\">" + escapeText(estimate.error) + "</p>";
    return html + claimFold(person.role, "<p class=\"field-help\">" + escapeText(estimate.caption) + "</p>"
      + charts.renderUnitsTable({ columns: ["Claim age", "Estimated benefit"], data: estimate.rows }, ["text", "money"],
        { title: "Estimate from earnings" }))
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
    if (!select || select.tagName !== "SELECT") return;  // the claim age is a slider: no options to update
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

  // ---- Settings notes: surplus split, owner choices, warnings, the model's terminal rate estimate (settingsNotes) ----
  function notesWanted() {
    return state.schema != null && ((tabShown("inputs") && NOTES_PANELS.has(state.chips.settings))
      || (tabShown("strategy") && state.strategyView === "strategies")  // the strategy warnings
      || (tabShown("outputs") && state.view === "summary"));  // Summary shows the Medicare warning
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

  // A quiet button at the top of the strategies that opens Strategy, Optimize.
  function optimizeLink() {
    const row = document.createElement("div");
    row.className = "run-row";
    row.innerHTML = "<button type=\"button\" class=\"button button-quiet\" id=\"optimizeLink\">Find the best settings in the optimizer</button>";
    row.querySelector("button").addEventListener("click", () => selectView("optimize"));
    return row;
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
    fillWarnings("strategy-warnings", notes.strategyWarnings);
    fillWarnings("car-warnings", notes.carWarnings);
    fillWarnings("home-warnings", notes.homeWarnings);
    fillWarnings("medicare-warnings", notes.medicareWarnings);
    fillWarnings("summary-warnings", notes.medicareWarnings);
    fillWarnings("hsa-warnings", notes.hsaWarnings);
    fillWarnings("fsa-warnings", notes.fsaWarnings);
    const countedCard = $("alreadyCounted");
    if (countedCard) fillAlreadyCounted(countedCard);
    const summaryCard = $("expenseSummary");
    if (summaryCard) fillExpenseSummary(summaryCard);
    renderSurplus();
    updateTerminalRate();
    syncGapSwitch(notes.gapMedical);
  }

  // An untouched gap medical plan switch follows the inputs (wmti gapExists): the stored switch is set to the
  // engine's value for display only, with no new run (the run already used the effective value, gapPlanOn).
  function syncGapSwitch(gap) {
    const plan = state.inputs && state.inputs.gapMedical;
    if (!gap || !plan || plan.touched || plan.enabled === gap.derived) return;
    setPath(state.inputs, "gapMedical.enabled", gap.derived);
    saveDraft();
    renderSettings();
  }

  // ---- Linked share sliders: a slider and a lock per item, always totalling 100%. Where surplus cash goes (Accounts:
  // the cash and Investments accounts, by name, from state.notes.surplus) and Split among beneficiaries (Benefits:
  // the beneficiaries, by position, from the inputs) are two splits drawn and moved by the same code. A split names its
  // body's id, its slider ids, the items as [label, share] pairs, the key that locks an item, its locks, the wmti
  // call that moves a share (`call`, by the item's position) and how the reply is written back (`apply`) ----
  const SURPLUS_SPLIT = {
    body: "surplusBody", idPrefix: "surplus-", noun: "account",
    empty: "Add a cash or Investments account to receive surplus cash.",
    only: "Only one account can receive surplus cash, so it takes all of it.",
    items: () => (state.notes ? state.notes.surplus : null),
    keys: (items) => items.map(([name]) => name),
    locks: () => state.surplusLocks,
    setLocks: (keys) => {
      state.surplusLocks = keys;
      savePrefs();
    },
    call: (position, share, locked) => engine.call("rebalanceSurplus", [JSON.stringify(state.inputs),
      state.notes.surplus[position][0], share, JSON.stringify(locked)]),
    apply: (reply) => {
      const accounts = reply.inputs.accounts;
      state.inputs.accounts.forEach((account, position) => {
        if (accounts[position]) account.surplusShare = accounts[position].surplusShare;
      });
      state.notes = Object.assign({}, state.notes, { surplus: reply.shares });
    },
    motion: { busy: false, pending: null, position: null, dragging: null, rerun: false },
  };
  const HEIR_SPLIT = {
    body: "heirSplitBody", idPrefix: "heir-share-", noun: "beneficiary",
    empty: "Add a beneficiary to split what is left.",
    only: "Only one beneficiary, so they take all of it.",
    items: () => (getPath(state.inputs, HEIRS_PATH) || []).map((heir, position) =>
      [heir.name || "Beneficiary " + (position + 1), Number(heir.share) || 0]),
    keys: (items) => items.map((_, position) => String(position)),
    locks: () => state.heirLocks,
    setLocks: (keys) => { state.heirLocks = keys; },
    call: (position, share, locked) => engine.call("rebalanceHeirShares", [JSON.stringify(state.inputs), position,
      share, JSON.stringify(locked.map(Number))]),
    apply: (reply) => {
      const heirs = getPath(state.inputs, HEIRS_PATH) || [];
      reply.shares.forEach((share, position) => { if (heirs[position]) heirs[position].share = share; });
    },
    motion: { busy: false, pending: null, position: null, dragging: null, rerun: false },
  };

  function splitSection(split, title, help) {
    const group = document.createElement("fieldset");
    group.className = "group surplus";
    group.id = split.body.replace(/Body$/, "");
    const id = newHelpId();
    group.innerHTML = "<legend class=\"legend-help\"><span>" + escapeText(title) + "</span>"
      + helpButtonHtml(title, id) + "</legend>" + helpTextHtml(id, help)
      + "<div class=\"surplus-body\" id=\"" + split.body + "\"><p class=\"note\">Reading the split</p></div>";
    return group;
  }

  function surplusSection() {
    return splitSection(SURPLUS_SPLIT, "Where surplus cash goes", "Cash left over after spending and saving is "
      + "deposited into these accounts. Drag a slider and the unlocked ones move so the total stays 100%; lock an "
      + "account to keep its share. Retirement accounts and HSAs never receive surplus.");
  }

  function lockedKeys(split, keys) {
    return split.locks().filter((key) => keys.includes(key));
  }

  // Draw a split. The rows are rebuilt only when the items or locks change, so a slider being dragged keeps its
  // place; otherwise only the values move.
  function renderSplit(split) {
    const holder = $(split.body);
    const items = holder && split.items();
    if (!items) return;
    const keys = split.keys(items);
    const locked = lockedKeys(split, keys);
    const key = JSON.stringify([items.map(([label]) => label), keys, locked]);
    if (holder.dataset.key !== key) {
      holder.dataset.key = key;
      holder.replaceChildren(...splitRows(split, items, keys, locked));
    }
    items.forEach(([, share], position) => {
      const row = holder.querySelector(".surplus-row[data-position=\"" + position + "\"]");
      if (!row) return;
      const slider = row.querySelector("input[type=range]");
      // The slider being dragged keeps the finger's place (and its figure); only the others follow the reply.
      const held = split.motion.dragging === position || (split.motion.pending && split.motion.position === position);
      if (held) return;
      row.querySelector(".surplus-value").textContent = percent(share, 1);
      slider.value = String(share * 100);
      slider.setAttribute("aria-valuetext", percent(share, 1));
      const segment = holder.querySelector(".split-bar [data-position=\"" + position + "\"]");
      if (segment) segment.style.flexGrow = String(share);
    });
    const total = holder.querySelector(".surplus-total strong");
    if (total) total.textContent = percent(items.reduce((sum, [, share]) => sum + share, 0), 0);
  }

  function renderSurplus() {
    renderSplit(SURPLUS_SPLIT);
  }

  function splitRows(split, items, keys, locked) {
    if (!items.length) {
      const warning = document.createElement("p");
      warning.className = "banner banner-warn";
      warning.textContent = split.empty;
      return [warning];
    }
    const unlocked = keys.filter((key) => !locked.includes(key));
    const bar = document.createElement("div");
    bar.className = "split-bar";
    bar.setAttribute("aria-hidden", "true");
    items.forEach((_, position) => {
      const segment = document.createElement("span");
      segment.dataset.position = String(position);
      segment.style.background = "var(--s" + (position % 8) + ")";
      bar.append(segment);
    });
    const rows = items.map(([name], position) => {
      const isLocked = locked.includes(keys[position]);
      const fixed = isLocked || unlocked.length <= 1;
      const row = document.createElement("div");
      row.className = "surplus-row";
      row.dataset.position = String(position);
      const id = split.idPrefix + position;
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
      // The dragged slider and its figure move at once; the others follow wmti's reply, and the plan reruns only when
      // the drag ends, so nothing queues behind the finger.
      slider.addEventListener("input", () => {
        split.motion.dragging = position;
        const share = Number(slider.value) / 100;
        row.querySelector(".surplus-value").textContent = percent(share, 1);
        moveSplit(split, position, share);
      });
      const release = () => {
        if (split.motion.dragging !== position) return;
        split.motion.dragging = null;
        if (split.motion.rerun && !split.motion.busy) {
          split.motion.rerun = false;
          inputsChanged();
        }
        renderSplit(split);
      };
      slider.addEventListener("change", release);
      slider.addEventListener("blur", release);  // a drag the browser cancelled still lets the plan rerun
      const lock = row.querySelector(".lock");
      lock.setAttribute("aria-pressed", String(isLocked));
      lock.setAttribute("aria-label", (isLocked ? "Unlock " : "Lock ") + name);
      lock.querySelector(".shackle").setAttribute("d", isLocked ? "M8 11V8a4 4 0 0 1 8 0v3" : "M8 11V8a4 4 0 0 1 7.5-2");
      lock.hidden = items.length === 1;
      lock.addEventListener("click", () => {
        const all = split.locks();
        split.setLocks(isLocked ? all.filter((item) => item !== keys[position]) : all.concat([keys[position]]));
        renderSplit(split);
        const again = $(split.body).querySelector(".surplus-row[data-position=\"" + position + "\"] .lock");
        if (again) again.focus();
      });
      return row;
    });
    const footer = document.createElement("p");
    footer.className = "surplus-total";
    footer.innerHTML = "Total <strong></strong>";
    const hint = document.createElement("p");
    hint.className = "field-help";
    const noun = split.noun;
    if (items.length === 1) hint.textContent = split.only;
    else if (!unlocked.length) hint.textContent = "Every " + noun + " is locked. Unlock one to change the split.";
    else if (unlocked.length === 1) hint.textContent = "Every other " + noun + " is locked, so "
      + items[keys.indexOf(unlocked[0])][0] + " keeps what the locked ones leave. Unlock another " + noun + " to move it.";
    return [bar, ...rows, footer].concat(hint.textContent ? [hint] : []);
  }

  // Send a slider move to wmti (the split's `call`, editing.rebalanceShares). One move is in flight at a time; while
  // it runs only the newest position is kept, so the shares always follow the rebalanceShares rule step by step.
  async function moveSplit(split, position, share) {
    const motion = split.motion;
    motion.position = position;
    if (motion.busy) {
      motion.pending = { position, share };
      return;
    }
    motion.busy = true;
    const items = split.items() || [];
    let reply = null;
    try {
      reply = await split.call(position, share, lockedKeys(split, split.keys(items)));
    } catch (error) {
      reply = null;
    }
    motion.busy = false;
    if (reply && !reply.value.inputs) {
      state.error = reply.value.error;
      renderSettingsError();
    }
    if (reply && reply.value.inputs) {
      split.apply(reply.value);
      split.motion.rerun = true;
    }
    if (split.motion.rerun && motion.dragging == null && !motion.pending) {
      split.motion.rerun = false;
      inputsChanged();
    }
    const next = motion.pending;
    motion.pending = null;
    renderSplit(split);
    if (next) moveSplit(split, next.position, next.share);
  }

  // ---- Beneficiaries' tax rate in Benefits, Beneficiaries: blank taxes each beneficiary's payout (over 10 years or
  // all at once, set on their card above) at their brackets; a typed rate is charged flat instead, whichever the
  // payouts; Use the beneficiaries' payout clears it. The model's flat estimate is shown as a guide. An edit reruns
  // the outputs like any other setting ----
  const TERMINAL_PATH = "strategies.terminalTaxRate";
  const TERMINAL_HELP = "Leave blank to tax what beneficiaries withdraw at their federal and state brackets, by each "
    + "one's payout above: over 10 years or all at once in the year after the death. Type a rate to charge that flat "
    + "rate on Traditional money left instead, whichever the payouts. It sets What beneficiaries keep "
    + "on Outputs, Summary (no gains tax, since their basis steps up; less home selling costs, the "
    + "federal and state estate taxes and the inheritance tax) and, saved with a config, how strategies are compared "
    + "after tax in Compare.";

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
    reset.textContent = "Use the beneficiaries' payout";
    reset.addEventListener("click", () => {
      $("f-terminal-rate").value = "";
      setValue(TERMINAL_PATH, null);
      updateTerminalRate();
    });
    row.append(reset);
    // The estimate stays on screen; how it was found sits behind the "i" beside it (updateTerminalRate fills both).
    const note = document.createElement("div");
    note.className = "title-help note-help";
    note.innerHTML = "<p class=\"field-help\" id=\"terminal-caption\"></p>" + helpButtonHtml("the model's flat estimate",
      "terminal-basis") + helpTextHtml("terminal-basis", "");
    wrap.append(row, note, note.querySelector("#terminal-basis"));  // the hidden text moves below the line
    updateTerminalRate(wrap);
    return [wrap];
  }

  // Say the payout is taxed while the box is blank, show the model's flat estimate as a guide in the caption, and the
  // stored rate in the box unless it is being typed in. `root` holds the box (the page, or the card being built).
  function updateTerminalRate(root) {
    const scope = root || document;
    const input = scope.querySelector("#f-terminal-rate");
    if (!input) return;
    const value = getPath(state.inputs, TERMINAL_PATH);
    if (document.activeElement !== input) input.value = value == null ? "" : String(Number((value * 100).toFixed(8)));
    scope.querySelector("#terminal-reset").disabled = value == null;
    const advice = state.notes ? state.notes.terminalRate : null;
    input.placeholder = "Blank: beneficiaries' payout";
    // "Model's estimate 20%" on screen as a guide for a flat rate, how it was found behind the "i".
    const figure = advice ? advice.caption.split(": ")[0] : "";
    scope.querySelector("#terminal-caption").textContent = (value == null ? beneficiaryPayoutText(state.inputs)
      : "The flat rate typed here is used instead of the beneficiaries' payout.")
      + (advice ? " A flat rate to compare: " + figure + "." : "");
    scope.querySelector("#terminal-basis").textContent = advice ? advice.caption + "." : "";
  }

  // ---- Beneficiaries in Benefits, Beneficiaries (stored as `strategies.heirs`): a list like Accounts, each row
  // opening its pop-up (name, other income, filing status, state, payout), Add beneficiary below it, then Split among
  // beneficiaries, the linked share sliders (HEIR_SPLIT). With Add children as beneficiaries on (Children), each child
  // has a beneficiary (syncChildHeirs); one kept because you edited it is named in a warning ----
  const HEIRS_PATH = "strategies.heirs";
  const HEIR_STATE_PATH = /^strategies\.heirs\.\d+\.state$/;
  const SAME_STATE_LABEL = "Same as household";
  const HEIR_NOTICE_BOXES = ["child-heir-warnings", "heir-warnings"];

  // One field's schema entry of a type (its label, choices and choice labels), or undefined.
  function schemaField(typeName, name) {
    return (state.schema.types[typeName] || []).find((field) => field.name === name);
  }

  function heirFieldsSchema() {
    return state.schema.types.Heir || [];
  }

  function beneficiaryList() {
    const field = state.schema.types.StrategyPlan.find((item) => item.name === "heirs");
    const list = listField(field, HEIRS_PATH, getPath(state.inputs, HEIRS_PATH) || []);
    list.classList.add("heir-list");
    const split = splitSection(HEIR_SPLIT, "Split among beneficiaries", "How what is left is split. Drag a slider and "
      + "the unlocked beneficiaries move so the total stays 100%; lock a beneficiary to keep their share. Adding a "
      + "beneficiary gives them an equal part and the others keep their split of the rest.");
    split.classList.add("heir-split");
    const addChildren = document.createElement("button");
    addChildren.type = "button";
    addChildren.id = "heir-add-children";
    addChildren.className = "button button-quiet";
    addChildren.textContent = "Add children";
    addChildren.hidden = !missingChildHeirs(state.inputs).length;
    addChildren.addEventListener("click", addChildrenAsHeirs);
    return [list, addChildren, warningsBox("heir-warnings"), split];
  }

  // Add children: a beneficiary for each child without one (deleted from the list, or the switch off), turning Add
  // children as beneficiaries on. A beneficiary of your own named as such a child is not doubled silently: a dialog
  // names them and offers to link it to the child, add the child's anyway, or skip that child.
  function addChildrenAsHeirs() {
    const field = (state.schema.types.StrategyPlan || []).find((item) => item.name === "heirs");
    const apply = (onMatch) => {
      const before = (state.inputs.strategies.heirs || []).length;
      state.inputs.strategies = addChildHeirs(state.inputs, heirFieldsSchema(), field && field.maximum, onMatch);
      if (state.inputs.strategies.heirs.length !== before) state.heirLocks = [];
      state.childHeirsOn = true;  // turned on here: no other child is added by the switch turning on
      renderSettings();
      inputsChanged();
    };
    const clashes = missingChildHeirs(state.inputs).filter((item) => item.matches.length);
    if (!clashes.length) {
      apply("skip");
      return;
    }
    const names = clashes.map((item) => item.child).join(", ");
    const one = clashes.length === 1;
    openDialog({ title: "Beneficiaries already named " + names,
      text: (one ? "A beneficiary you added has the name of " : "Beneficiaries you added have the names of ") + names
        + ". Link " + (one ? "it to that child" : "each to its child") + ", add the child's beneficiary anyway, or skip "
        + (one ? "that child" : "those children") + ".",
      actions: [["Link", "button", () => apply("link"), "heir-match-link"],
        ["Add anyway", "button button-quiet", () => apply("add"), "heir-match-add"],
        ["Skip", "button button-quiet", () => apply("skip"), "heir-match-skip"],
        ["Cancel", "button button-quiet", () => {}, "heir-match-cancel"]] });
  }

  // Keep the beneficiaries in step with the children and their shares at 100% (syncChildHeirs). A child gets a
  // beneficiary when it is added, or every child when the switch is turned on; one you deleted stays deleted (Add
  // children brings it back), and a loaded file is taken as it is. Locks follow positions, so they are dropped when
  // the list changes length. The warning naming the beneficiaries kept because you edited them lasts until the switch
  // is turned on again or they are gone.
  // Settings loaded from a file or saved scenario are taken as they are: the children they have are not new, so no
  // beneficiary is added for them and one the file lacks stays deleted.
  function takeHeirsAsLoaded() {
    state.heirSeenChildren = null;
    state.childHeirsOn = null;
  }

  function syncHeirs() {
    const strategies = state.schema && state.inputs && state.inputs.strategies;
    if (!strategies) return;
    const field = (state.schema.types.StrategyPlan || []).find((item) => item.name === "heirs");
    const names = (state.inputs.children || []).map((child) => String(child.name));
    const seen = state.heirSeenChildren;
    const turnedOn = strategies.childrenAsHeirs && state.childHeirsOn === false;
    const addFor = seen == null ? [] : turnedOn ? undefined : names.filter((name) => !seen.includes(name));
    state.heirSeenChildren = names;
    const { heirs, changed, kept } = syncChildHeirs(state.inputs, heirFieldsSchema(), field && field.maximum, addFor);
    if (changed) {
      if (heirs.length !== (strategies.heirs || []).length) state.heirLocks = [];
      strategies.heirs = heirs;
    }
    if (strategies.childrenAsHeirs && !state.childHeirsOn) state.heirNotice = [];
    state.childHeirsOn = Boolean(strategies.childrenAsHeirs);
    const own = new Set(heirs.filter((heir) => heir.child == null).map((heir) => heir.name));
    state.heirNotice = kept.length ? kept : state.heirNotice.filter((name) => own.has(name));
    fillHeirNotice();
    const addChildren = $("heir-add-children");
    if (addChildren) addChildren.hidden = !missingChildHeirs(state.inputs).length;
  }

  function fillHeirNotice() {
    const names = state.heirNotice;
    const text = !names.length ? [] : ["Kept " + names.length + (names.length === 1 ? " beneficiary" : " beneficiaries")
      + " you edited: " + names.join(", ") + ". Remove " + (names.length === 1 ? "it" : "them")
      + " in the Beneficiaries list on Benefits if you want."];
    for (const id of HEIR_NOTICE_BOXES) fillWarnings(id, text);
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

  // A short line kept on screen with an "i" beside it: the longer explanation (`help`) is hidden until tapped, so no
  // large block of text shows. `textId` names the hidden text when the caller updates it later; `textClass` adds a
  // class to it (such as "info-box").
  function noteHelp(short, help, className, textId, textClass) {
    const id = textId || newHelpId();
    return { head: "<div class=\"title-help note-help\"><p class=\"" + className + "\">" + escapeText(short) + "</p>"
      + helpButtonHtml(short, id) + "</div>", text: helpTextHtml(id, help, textClass) };
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
      const current = inputsTicket();
      const reply = await ask("setPartner", [JSON.stringify(state.inputs), checked]);
      if (!current()) {  // an edit came after: this answer would undo it; redraw the switch from the inputs
        renderSettings();
        return;
      }
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
    const field = { kind: "integer", step: control.step, minimum: control.minimum, checkMinimum: true };
    wrap.append(numberInput("f-seed", field, state.seed, (value) => {
      state.seed = value;
      inputsChanged();
    }));
    return wrap;
  }

  // A labelled switch; `disabled` greys it out with `note` (why) shown under it.
  function switchField(label, help, id, checked, onChange, disabled = false, note = null) {
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
    if (disabled) {
      input.disabled = true;
      wrap.classList.add("field-disabled");
    }
    if (note) {
      const why = document.createElement("p");
      why.className = "field-help switch-note";
      why.id = id + "-note";
      why.textContent = note;
      input.setAttribute("aria-describedby", why.id);
      wrap.append(why);
    }
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
  function numberInput(id, field, value, commit, blankValue) {
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
        if (blankValue !== undefined) next = blankValue;
        else if (field.nullable) next = null;
        else error = "Enter a number.";
      } else if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) {
        error = "Enter a number, such as 1500 or 2.5.";
      } else {
        next = Number(text) / scale;
        if (field.kind === "integer") {
          if (!Number.isInteger(Number(text))) error = "Enter a whole number.";
          next = Number(text);
          if (!error && field.checkMinimum && next < field.minimum) error = "Enter " + field.minimum + " or more.";
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
    // The owner set the gap medical plan's switch: it stops following the inputs (wmti gapPlanOn).
    if (path === "gapMedical.enabled") setPath(state.inputs, "gapMedical.touched", true);
    // A block's switch turned off: wmti applySettings puts its other fields back to their defaults (resetDisabledBlock).
    const previous = /\.enabled$/.test(path) && before && !value ? clone(state.inputs) : null;
    setPath(state.inputs, path, value);
    // An edit makes an account the user's own: the Roth conversion switch no longer removes it.
    const item = account && state.inputs.accounts[Number(account[1])];
    if (item && item.autoCreated && account[2] !== "autoCreated" && before !== value) item.autoCreated = false;
    if (previous) {
      switchOff(previous, path, value);
      return;
    }
    if (path === ROLLOVER_SWITCH) {
      syncRollover();
      return;
    }
    inputsChanged();
  }

  // The Roth conversion switch adds or removes the rollover account (wmti syncRolloverAccounts); the page is redrawn
  // at once so the account list shows it.
  async function syncRollover() {
    const current = inputsTicket();
    const reply = await ask("syncRollover", [JSON.stringify(state.inputs)]);
    if (current()) takeEngineInputs(reply);  // an edit came after: this answer would undo it
  }

  // A block switched off (the Roth conversion, a QCD, the retirement plan...): the engine applies the switch to the
  // inputs before it, putting the block's other fields back to their defaults and syncing the rollover account.
  // An edit made while the reset is on its way wins: the reset's answer is then dropped (inputsTicket), the switch
  // staying off as setValue left it.
  async function switchOff(previous, path, value) {
    const current = inputsTicket();
    const reply = await ask("applySettings", [JSON.stringify(previous), JSON.stringify([{ path, value }])]);
    if (current()) takeEngineInputs(reply);
  }

  function takeEngineInputs(reply) {
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

  // Fields with their own control: the Social Security basis, an expense row's and the Roth conversion's ages, and the
  // claim and Medicare ages (one-knob age sliders).
  function specialField(field, path, value) {
    if (/^(you|partner)\.socialSecurityBasis$/.test(path)) return basisToggle(field, path, value);
    if (/^(you|partner)\.employerMatch\.percent$/.test(path)) return matchPercentField(field, path);
    if (DEPOSIT_SHARE_PATH.test(path)) return depositShareField(field, path);
    const at = sheetItemOf(path);
    if (at && at.type === "Car" && at.name === "replaceBy") return segmentedField(field, path, value);
    if (at && at.type === "Car" && at.name === "payMethod") return segmentedField(field, path, carPaidBy(at.item));
    // Define loan by: At purchase | Current; the other basis' figures hide (hiddenReason) and the sheet redraws.
    if (at && ((at.type === "Car" && at.name === "loanBasis") || (at.type === "Home" && at.name === "mortgageBasis"))) {
      return segmentedField(field, path, at.item[at.name] === "purchase" ? "purchase" : "current");
    }
    if (at && (RADIO_SEGMENTED[at.type] || []).includes(at.name)) return radioSegmentedField(field, path);
    if (at && at.type === "ExpenseItem" && at.name === "year") return expenseAgesField(field, path, at.item);
    if (path === "strategies.rothConversion.startAge") return rothAgesField(field, path);
    if (/^(you|partner)\.socialSecurityAge$/.test(path)) return claimAgeField(field, path);
    if (path === "premiums.medicareAge") return medicareAgeField(field, path);
    if (path === PLAN_SHARE_PATH) return planShareToggle(field, path, value);
    if (LIMIT_SLIDER_PATHS.includes(path)) return limitSliderField(field, path);
    return null;
  }

  // ---- Benefits: the HSA cap and the dependent care FSA cap, each a slider from $0 to the most the law allows the
  // household this year, with the amount beside it. Blank (the default) is the legal limit: the slider sits at the
  // top, its amount grey, and the reset puts it back. A saved cap above today's limit shows at the limit with an "IRS
  // limit" note and stays saved as it is until the slider moves. The limit (state.info.benefitLimits, wmti
  // benefitLimitsInfo) is worked out from the household today when the pane is drawn: the HSA's family limit while the
  // partner is under the Medicare age or a child under the coverage age is on the plan (the medical plan's family
  // tier, childrenOnPlan), else self-only, plus the catch-up for each person under the Medicare age at the catch-up
  // age or older; the FSA's limit per return for the filing status, summed over the household's returns. ----
  const LIMIT_SLIDER_PATHS = ["hsa.cap", "dependentCareFsa.cap"];
  const LIMIT_SLIDER_STEP = 50;

  function benefitLimitToday(path) {
    const limits = state.info.benefitLimits;
    const inputs = state.inputs;
    const you = Number(inputs.you.currentAge);
    if (path === "dependentCareFsa.cap") {
      const fsa = limits.dependentCareFsa;
      if (inputs.partner == null) return fsa.SINGLE;
      return ["SEPARATE", "MFS"].includes(String(inputs.filingStatus).toUpperCase()) ? 2 * fsa.MFS : fsa.JOINT;
    }
    const stored = getPath(inputs, "premiums.medicareAge");
    const medicareAge = stored == null ? panelField(state.schema, "premiums.medicareAge").default : Number(stored);
    const ages = inputs.partner == null ? [you] : [you, Number(inputs.partner.currentAge)];
    const eligible = ages.filter((age) => age < medicareAge);
    if (!eligible.length) return 0;
    const children = (inputs.children || []).filter((child) => child.dependentUntilAge > 0
      && you - child.yourAgeAtBirth >= 0 && you - child.yourAgeAtBirth < limits.coverageAge).length;
    const family = children > 0 || (ages.length > 1 && ages[1] < medicareAge);
    const hsa = limits.hsa;
    return (family ? hsa.family : hsa.single) + eligible.filter((age) => age >= hsa.catchUpAge).length * hsa.catchUp;
  }

  function limitSliderField(field, path) {
    const id = fieldId(path);
    const wrap = fieldShell(field.label, field.help, id);
    wrap.classList.add("limit-slider");
    const limit = benefitLimitToday(path);
    const row = document.createElement("div");
    row.className = "range-row";
    row.innerHTML = "<input type=\"range\" class=\"range\"><output class=\"range-value\"></output>";
    const slider = row.querySelector("input");
    slider.id = id;
    slider.min = "0";
    slider.max = String(limit);
    slider.step = String(LIMIT_SLIDER_STEP);
    slider.setAttribute("aria-label", field.label);
    const output = row.querySelector("output");
    output.htmlFor = id;
    const note = document.createElement("p");
    note.className = "field-help limit-note";
    note.id = id + "-note";
    slider.setAttribute("aria-describedby", note.id);
    const show = () => {
      const saved = getPath(state.inputs, path);
      const value = saved == null ? limit : Math.min(Number(saved), limit);
      slider.value = String(value);
      output.textContent = fullMoney(value);
      output.classList.toggle("is-default", saved == null);
      note.hidden = saved != null && Number(saved) <= limit;
      note.textContent = saved == null ? "IRS limit" : "IRS limit (your saved " + fullMoney(Number(saved)) + " is above it)";
      syncReset(output);
    };
    slider.addEventListener("input", () => {
      setValue(path, Number(slider.value));
      show();
    });
    wrap.append(row, note);
    if (path === "dependentCareFsa.cap") {  // wmti sets aside only what the year's child care needs
      const needed = document.createElement("p");
      needed.className = "field-help switch-note";
      needed.textContent = "Only what's needed is set aside: the smallest of this cap, the year's child care and the "
        + "federal limit.";
      wrap.append(needed);
    }
    addResetButton(output, field.label, () => "IRS limit", () => {
      setValue(path, null);
      show();
    }, () => getPath(state.inputs, path) == null);
    show();
    return wrap;
  }

  // How the medical plan's deductible and out-of-pocket maximum are shared, right after the out-of-pocket maximum: a
  // Per person / Combined toggle over the stored switch (combined is True).
  function planShareToggle(field, path, value) {
    const wrap = fieldShell(field.label, field.help, null);
    wrap.classList.add("plan-share");
    const group = document.createElement("div");
    group.className = "segmented";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", field.label);
    group.id = fieldId(path);
    for (const [choice, text] of PLAN_SHARE_CHOICES) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.choice = String(choice);
      button.textContent = text;
      button.setAttribute("aria-pressed", String(choice === Boolean(value)));
      button.addEventListener("click", () => {
        if (choice === Boolean(getPath(state.inputs, path))) return;
        setValue(path, choice);
        for (const item of group.children) item.setAttribute("aria-pressed", String(item === button));
      });
      group.append(button);
    }
    wrap.append(group);
    return wrap;
  }

  // The Social Security claim age as a one-knob age slider over the claim ages (appInfo claimAgeRange: 62 to 70, whole
  // years, as the model reads it).
  function claimAgeField(field, path) {
    const [low, high] = state.info.claimAgeRange.map(Number);
    return oneAgeField(field, path, low, high, "Claim age");
  }

  // The Medicare age as a one-knob age slider from 65 (MEDICARE_SLIDER_LOW) to your age in the run's last year.
  function medicareAgeField(field, path) {
    const low = MEDICARE_SLIDER_LOW;
    const high = Math.max(low, Number(state.inputs.you.currentAge) + planYears(state.inputs) - 1);
    return oneAgeField(field, path, low, high, "Medicare age");
  }

  // A one-knob age slider (ageRangeField) for the whole-year age at `path` from `low` to `high`; a saved age outside
  // shows at the nearest end and is kept until the knob moves. `store` takes the age instead of setValue (the
  // walkthrough's pending answer); `id` replaces the field's id.
  function oneAgeField(field, path, low, high, name, store, id) {
    const saved = () => Number(store ? store.value : getPath(state.inputs, path));
    const at = Math.min(high, Math.max(low, saved()));
    return ageRangeField(field, {
      low, high, set: true, outside: saved() < low || saved() > high, values: { at }, names: { at: name },
      ids: { at: id || fieldId(path) },
      text: () => "Age " + saved(),
      store: (knob, age) => (store ? store.set(age) : setValue(path, age)),
    });
  }

  // An expense row's From and To ages on the ages slider (ageRangeField) from your age today to your age in the run's
  // last year (expenseAgeKnobs): two knobs for a monthly row, one for a Major Spending row paid in one year. A knob
  // moved stores its age (expenseAgeStored: a knob at an end stores a blank).
  function expenseAgesField(field, path, item) {
    const rules = state.info.sheetRules;
    const low = Number(state.inputs.you.currentAge);
    const high = Math.max(low, low + planYears(state.inputs) - 1);
    const toPath = path.replace(/\.year$/, ".toAge");
    const shown = expenseAgeKnobs(item, low, high, rules);
    return ageRangeField(field, {
      low, high, outside: shown.outside, set: shown.set,
      values: shown.major ? { at: shown.at } : { from: shown.from, to: shown.to },
      ids: { at: fieldId(path), from: fieldId(path), to: fieldId(toPath) },
      text: () => expenseAgeKnobs(getPath(state.inputs, path.replace(/\.year$/, "")), low, high, rules).text,
      store: (name, age) => {
        const stored = expenseAgeStored(name, age, low, high);
        if ("toAge" in stored && name === "at") setPath(state.inputs, toPath, stored.toAge);
        if ("year" in stored) setValue(path, stored.year);
        else setValue(toPath, stored.toAge);
      },
    });
  }

  // The Roth conversion's From and To ages (startAge, endAge) as the two knobs of the ages slider (ageRangeField)
  // from your age today to your age in the run's last year (rothAgeKnobs). The ages are never blank: a knob moved
  // stores its age, at an end too.
  function rothAgesField(field, path) {
    const low = Number(state.inputs.you.currentAge);
    const high = Math.max(low, low + planYears(state.inputs) - 1);
    const endPath = path.replace(/\.startAge$/, ".endAge");
    const plan = () => getPath(state.inputs, path.replace(/\.startAge$/, ""));
    const shown = rothAgeKnobs(plan(), low, high);
    const label = { label: "Ages", help: "Your ages in the first and last years of conversions, both included" };
    return ageRangeField({ ...field, ...label }, {
      low, high, outside: shown.outside, set: true,
      values: { from: shown.from, to: shown.to },
      ids: { from: fieldId(path), to: fieldId(endPath) },
      text: () => rothAgeKnobs(plan(), low, high).text,
      store: (name, age) => setValue(name === "from" ? path : endPath, age),
    });
  }

  // An ages slider from `low` to `high`: two knobs (`values` {from, to}) or one (`values` {at}; `set` false shows it
  // as no age yet). Each knob is a role=slider stop (arrows, Page Up / Page Down by 5, Home, End) with the id in
  // `ids`; a drag on the track moves the nearer knob. A knob moved calls `store(name, age)`; `text()` reads the ages
  // beside the label. A stored age outside the track (`outside`) shows at its end and is kept until a knob moves.
  function ageRangeField(field, { low, high, values, ids, set, outside, text: textOf, store, names: named }) {
    const single = "at" in values;
    const wrap = fieldShell(field.label, field.help, null);
    wrap.classList.add("age-range-field");
    const text = document.createElement("span");
    text.className = "age-range-text";
    text.setAttribute("aria-hidden", "true");  // each knob says its own age
    wrap.querySelector(".field-head").append(text);
    const track = document.createElement("div");
    track.className = "age-range";
    const rail = document.createElement("div");
    rail.className = "age-range-rail";
    const fill = document.createElement("div");
    fill.className = "age-range-fill";
    rail.append(fill);
    track.append(rail);
    const names = { at: "Age paid", from: "From age", to: "To age", ...named };
    const knobs = {};
    for (const name of Object.keys(values)) {
      const knob = document.createElement("div");
      knob.className = "age-range-knob";
      knob.id = ids[name];
      knob.tabIndex = 0;
      knob.dataset.knob = name;
      knob.setAttribute("role", "slider");
      knob.setAttribute("aria-label", names[name]);
      knob.setAttribute("aria-valuemin", String(low));
      knob.setAttribute("aria-valuemax", String(high));
      knob.addEventListener("keydown", (event) => {
        const range = bounds(name);
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[event.key];
        const next = step ? values[name] + step : event.key === "Home" ? range[0] : event.key === "End" ? range[1] : null;
        if (next === null) return;
        event.preventDefault();
        move(name, next);
      });
      knobs[name] = knob;
      rail.append(knob);
    }
    // The ages a knob may take: the From knob never passes the To knob, nor the To knob the From knob.
    const bounds = (name) => (name === "from" ? [low, values.to] : name === "to" ? [values.from, high] : [low, high]);
    const place = (age) => (high > low ? ((age - low) / (high - low)) * 100 : 0);
    const draw = () => {
      for (const [name, knob] of Object.entries(knobs)) {
        const range = bounds(name);
        knob.style.left = place(values[name]) + "%";
        knob.setAttribute("aria-valuenow", String(values[name]));
        knob.setAttribute("aria-valuetext", name === "at" && !set ? "No age yet, not paid" : "Age " + values[name]);
        knob.setAttribute("aria-valuemin", String(range[0]));
        knob.setAttribute("aria-valuemax", String(range[1]));
        knob.classList.toggle("is-default", name === "at" && !set);
      }
      fill.style.left = (single ? place(values.at) : place(values.from)) + "%";
      fill.style.width = (single ? 0 : place(values.to) - place(values.from)) + "%";
      text.textContent = textOf();
    };
    // Move a knob to `age` (kept within its bounds) and store it; nothing is stored when the knob does not move.
    const move = (name, age) => {
      const range = bounds(name);
      const next = Math.min(range[1], Math.max(range[0], Math.round(age)));
      if (next === values[name] && (name !== "at" || set)) return;
      values[name] = next;
      set = true;
      store(name, next);
      draw();
    };
    const ageAt = (clientX) => {
      const box = rail.getBoundingClientRect();
      const share = box.width > 0 ? Math.min(1, Math.max(0, (clientX - box.left) / box.width)) : 0;
      return Math.round(low + share * (high - low));
    };
    let dragging = null;  // {name, pointerId}; name is null until a drag between two knobs at one age picks a side
    // A drag that starts at `clientX` (`pointerId`: the mouse or pen's, or "hold" for a held finger) moves the nearer
    // knob there; `drag` follows it.
    const grab = (clientX, pointerId) => {
      const age = ageAt(clientX);
      let name = "at";
      if (!single) {
        if (values.from === values.to) name = age < values.from ? "from" : age > values.to ? "to" : null;
        else name = Math.abs(age - values.from) <= Math.abs(age - values.to) ? "from" : "to";
      }
      dragging = { name, pointerId, start: age };
      if (name) {
        knobs[name].focus({ preventScroll: true });
        move(name, age);
      } else {
        knobs.to.focus({ preventScroll: true });
      }
    };
    const drag = (clientX) => {
      const age = ageAt(clientX);
      if (!dragging.name) {
        if (age === dragging.start) return;
        dragging.name = age < dragging.start ? "from" : "to";
        knobs[dragging.name].focus({ preventScroll: true });
      }
      move(dragging.name, age);
    };
    // A finger is left to the hold (26-hold-slider.js), which drives the same drag.
    track.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.pointerType === "touch") return;
      event.preventDefault();
      grab(event.clientX, event.pointerId);
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener("pointermove", (event) => {
      if (!dragging || dragging.pointerId !== event.pointerId) return;
      drag(event.clientX);
    });
    const stop = (event) => {
      if (dragging && dragging.pointerId === event.pointerId) dragging = null;
    };
    track.addEventListener("pointerup", stop);
    track.addEventListener("pointercancel", stop);
    // The knob a drag moves (else the knob nearest `clientX`, else the focused or first one): its middle and its age.
    const knobCentre = (knob) => {
      const box = knob.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, text: knob.getAttribute("aria-valuetext") };
    };
    track.holdSlider = {
      handle: (clientX) => {
        let knob = dragging && dragging.name ? knobs[dragging.name] : null;
        if (!knob && clientX != null) {
          knob = Object.values(knobs).reduce((best, item) => (!best || Math.abs(knobCentre(item).x - clientX)
            < Math.abs(knobCentre(best).x - clientX) ? item : best), null);
        }
        knob = knob || Object.values(knobs).find((item) => item === document.activeElement) || Object.values(knobs)[0];
        return knob ? knobCentre(knob) : null;
      },
      start: (clientX) => grab(clientX, "hold"),
      move: (clientX) => { if (dragging && dragging.pointerId === "hold") drag(clientX); },
      end: () => { if (dragging && dragging.pointerId === "hold") dragging = null; },
    };
    draw();
    wrap.append(track);
    const ends = document.createElement("div");
    ends.className = "age-range-ends";
    ends.setAttribute("aria-hidden", "true");
    ends.innerHTML = "<span></span><span></span>";
    ends.children[0].textContent = String(low);
    ends.children[1].textContent = String(high);
    wrap.append(ends);
    if (outside) {
      const note = document.createElement("p");
      note.className = "field-help age-range-note";
      note.textContent = "A saved age falls outside this run (ages " + low + " to " + high + "); the slider shows "
        + "the nearest end and keeps the saved age until you move a knob.";
      wrap.append(note);
    }
    return wrap;
  }

  // A nullable sheet choice as an inset row of radio buttons with every real option showing, thin lines between them
  // (an expense row's Tax deduction and Taxable); there is no blank button. A blank that shows its source's value
  // (Taxable: the row's default) shows that value's button picked and underlined as the one it follows; a blank with
  // no source value (a row taxed by its state's own rule) picks none. A clearable choice (RADIO_CLEARABLE: Tax
  // deduction) is cleared to blank by tapping, Space or Enter on the picked button. One stop in the tab order; the
  // arrow keys, Home and End move the choice. Picking one stores it in place, as the select did.
  function radioSegmentedField(field, path) {
    const id = fieldId(path);
    const wrap = fieldShell(field.label, field.help, null);
    const group = document.createElement("div");
    group.className = "segmented segmented-inset";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", field.label);
    group.id = id;
    const at = sheetItemOf(path);
    const clearable = Boolean(at && (RADIO_CLEARABLE[at.type] || []).includes(at.name));
    const options = field.choices.slice();
    const stored = () => (getPath(state.inputs, path) == null ? null : getPath(state.inputs, path));
    const buttons = options.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.dataset.choice = String(choice);
      button.textContent = choiceLabel(field, choice, NULL_LABELS[field.name]);
      button.addEventListener("click", () => pick(clearable && sameValue(choice, stored()) ? null : choice, button));
      return button;
    });
    const show = () => {
      const value = stored();
      const fallback = value == null ? sheetDefaultOf(path) : null;
      const shown = fallback ? fallback.value : value;
      buttons.forEach((button, position) => {
        const checked = shown != null && sameValue(options[position], shown);
        button.setAttribute("aria-checked", String(checked));
        button.classList.toggle("is-followed", Boolean(fallback) && checked);
      });
      const tabbed = buttons.find((button) => button.getAttribute("aria-checked") === "true") || buttons[0];
      buttons.forEach((button) => { button.tabIndex = button === tabbed ? 0 : -1; });
    };
    // Store `choice` (null clears) and keep the focus on the picked button, else on `from`, the button pressed.
    const pick = (choice, from) => {
      if (sameValue(choice, stored())) return;
      setValue(path, choice);
      show();
      group.dispatchEvent(new Event("change", { bubbles: true }));
      afterSheetEdit(path);
      if (isConditionPath(path)) refreshForm();
      const holder = document.getElementById(id);
      const redrawn = holder && (holder.querySelector("[aria-checked=\"true\"]")
        || Array.from(holder.querySelectorAll("[role=radio]")).find((button) => from
          && button.dataset.choice === from.dataset.choice));
      if (redrawn) redrawn.focus();
    };
    group.addEventListener("keydown", (event) => {
      const at = buttons.indexOf(document.activeElement);
      if (at < 0) return;
      const last = buttons.length - 1;
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      const next = step ? (at + step + buttons.length) % buttons.length
        : event.key === "Home" ? 0 : event.key === "End" ? last : null;
      if (next === null) return;
      event.preventDefault();
      pick(options[next], buttons[next]);
    });
    show();
    group.append(...buttons);
    wrap.append(group);
    return wrap;
  }

  // A sheet choice of a few options as a segmented toggle (a car's Replace by: Years, Miles, Both; its How it is paid:
  // Cash, Finance, Lease): picking one stores it with what it sets (clearedOnChange: How it is paid sets the Loan and
  // Lease switches) and redraws the sheet, which shows the figures it selects.
  function segmentedField(field, path, value) {
    const wrap = fieldShell(field.label, field.help, null);
    const group = document.createElement("div");
    group.className = "segmented";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", field.label);
    group.id = fieldId(path);
    for (const choice of field.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.choice = choice;
      button.textContent = choiceLabel(field, choice);
      button.setAttribute("aria-pressed", String(choice === value));
      button.addEventListener("click", () => {
        if (choice === value && choice === getPath(state.inputs, path)) return;
        const at = sheetItemOf(path);
        if (at) {
          Object.assign(at.item, clearedOnChange(at.type, at.name, { ...at.item, [at.name]: choice },
            state.info.sheetRules));
        }
        setValue(path, choice);
        refreshForm();
        const redrawn = document.querySelector("#" + CSS.escape(group.id) + " [data-choice=\"" + choice + "\"]");
        if (redrawn) redrawn.focus();
      });
      group.append(button);
    }
    wrap.append(group);
    return wrap;
  }

  // A person's employer match as one share of pay (the schema's derived field): shown as rate x cap, and an entered
  // share outside its bounds is refused with a message; a new share is stored as rate 1 and the share as the cap,
  // and the stored terms are kept while the share equals theirs (wmti.accounts.contributions.matchTermsFromPercent).
  function matchPercentField(field, path) {
    const matchPath = path.slice(0, path.lastIndexOf("."));
    const id = fieldId(path);
    const wrap = fieldShell(field.label, field.help, id);
    wrap.append(numberInput(id, field, matchPercent(getPath(state.inputs, matchPath)), (next) => {
      const error = walkBoundsError(field, next, null);
      const input = $(id);
      const problem = wrap.querySelector(".field-error");
      if (input) input.setAttribute("aria-invalid", String(Boolean(error)));
      problem.hidden = !error;
      problem.textContent = error || "";
      if (error) return;
      const match = getPath(state.inputs, matchPath);
      const terms = matchTermsFromPercent(next, match);
      if (terms.rate === match.rate && terms.cap === match.cap) return;
      setPath(state.inputs, matchPath + ".rate", terms.rate);
      setValue(matchPath + ".cap", terms.cap);
    }));
    return wrap;
  }

  // ---- A person's retirement deposit (Benefits > Retirement plan): two linked sliders, the Traditional and the Roth
  // share of pay (the stored fields), each a number box and a slider bound to the one value: typing moves the slider
  // and dragging fills the box. Each slider runs from 0 to the share of the person's pay that reaches their 401k limit
  // (depositCap), and the two together never pass it: raising one past (cap - other) lowers the other so the two add
  // up to the cap. A move goes to wmti (moveDepositShare), which stores both shares the same way. A share is offered
  // only when the person owns an account of its kind (a hint says what to add otherwise). No dollar amounts are shown.
  // With deposits set per account the controls are disabled.
  const DEPOSIT_SHARE_PATH = /^(you|partner)\.retirementDeposit\.(traditionalShare|rothShare)$/;
  const DEPOSIT_SHARE_NAMES = ["traditionalShare", "rothShare"];
  const DEPOSIT_SHARE_KINDS = {
    traditionalShare: { flag: "hasTraditional",
      hint: "Add a Traditional 401k or Traditional IRA account to set a Traditional deposit." },
    rothShare: { flag: "hasRoth", hint: "Add a Roth 401k or Roth IRA account to set a Roth deposit." },
  };
  const depositShareMove = { busy: false, pending: null };
  const depositClamped = { you: false, partner: false };  // a share typed above the cap is held to it, with the note

  // A stored share of the person's pay.
  function depositShareValue(role, name) {
    const deposit = getPath(state.inputs, role + ".retirementDeposit") || {};
    return Number(deposit[name]) || 0;
  }

  function depositOther(name) {
    return name === "traditionalShare" ? "rothShare" : "traditionalShare";
  }

  // A person's depositSliders `people` entry, or null until that answer arrives.
  function depositPerson(role) {
    const people = (state.deposits && state.deposits.ok && state.deposits.people) || [];
    return people.find((item) => item.role === role) || null;
  }

  // The most a person's two shares can add up to: the share of their pay that reaches their 401k limit this year
  // (depositSliders `people` cappedAt: the elective deferral with any catch-up for their age, over their pay), rounded
  // up to the field's step and at most its maximum; null until that answer arrives, "noPay" without pay.
  function depositCap(role, field) {
    const person = depositPerson(role);
    if (!person) return null;
    if (person.cappedAt == null) return "noPay";
    const steps = Math.ceil(person.cappedAt / field.step - 1e-9);
    return Math.min(field.maximum, Number((steps * field.step).toFixed(8)));
  }

  // Whether a person owns an account a share goes into (true until the depositSliders answer arrives).
  function depositKindOwned(role, name) {
    const person = depositPerson(role);
    return !person || person[DEPOSIT_SHARE_KINDS[name].flag] !== false;
  }

  // The value a share's box shows: a stored share above the cap shows the cap (the stored shares stay).
  function depositShownValue(role, name, field) {
    const value = depositShareValue(role, name);
    const cap = depositCap(role, field);
    return typeof cap === "number" ? Math.min(value, cap) : value;
  }

  // Show the other share of a pair as a move of `name` to `next` leaves it: lowered so the two stay within the cap.
  function showLinkedShare(role, name, next, cap) {
    if (typeof cap !== "number") return;
    const other = depositOther(name);
    const path = role + ".retirementDeposit." + other;
    const field = drawnFields.get(path);
    const input = $(fieldId(path));
    const slider = $(fieldId(path) + "-slider");
    if (!field || !input || !slider) return;
    const kept = Math.min(depositShownValue(role, other, field), Math.max(0, Number((cap - next).toFixed(8))));
    if (document.activeElement !== input) input.value = shown(kept, scaleOf(field));
    if (document.activeElement !== slider) slider.value = String(kept);
  }

  function depositsPerAccount() {
    const kinds = state.info.sheetRules.depositKinds;
    return (state.inputs.accounts || []).some((account) => kinds.includes(account.kind) && account.deposit != null);
  }

  function depositShareField(field, path) {
    const [, role, name] = DEPOSIT_SHARE_PATH.exec(path);
    const id = fieldId(path);
    const wrap = fieldShell(field.label, field.help, id);
    wrap.classList.add("deposit-share");
    const box = numberInput(id, field, depositShownValue(role, name, field), (next) => {
      const error = walkBoundsError(field, next, null);
      const problem = wrap.querySelector(".field-error");
      input.setAttribute("aria-invalid", String(Boolean(error)));
      problem.hidden = !error;
      problem.textContent = error || "";
      if (error) return;
      const cap = depositCap(role, field);
      // A share typed above the cap is held to it, with the note, until a share within it is entered.
      depositClamped[role] = typeof cap === "number" && next > cap;
      if (typeof cap === "number") next = Math.min(next, cap);
      slider.value = String(next);
      showLinkedShare(role, name, next, cap);
      syncDepositCap(role);
      moveDepositShare(role, name, next, cap);
    });
    const input = box.querySelector("input");
    // Once the typing is done, a held share shows the value kept.
    input.addEventListener("change", () => {
      input.value = shown(depositShownValue(role, name, field), scaleOf(field));
    });
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "range";
    slider.id = id + "-slider";
    slider.min = String(field.minimum);
    slider.max = String(field.maximum);
    slider.step = String(field.step);
    slider.value = String(depositShownValue(role, name, field));
    slider.setAttribute("aria-label", field.label);
    slider.addEventListener("input", () => {
      const next = Number(slider.value);
      const cap = depositCap(role, field);
      input.value = shown(next, scaleOf(field));
      depositClamped[role] = false;
      showLinkedShare(role, name, next, cap);
      moveDepositShare(role, name, next, cap);
    });
    wrap.append(box, slider);
    // The box (with its reset button) and the slider, hidden together without an account of this kind.
    const controls = [input.parentNode, slider];
    controls.forEach((control) => control.classList.add("deposit-share-control"));
    const atDefault = () => Math.abs(depositShareValue(role, name) - field.default) <= 1e-9;
    input.classList.toggle("is-default", atDefault());
    addResetButton(input, field.label, () => resetValueText(field.default, field, input), () => {
      const cap = depositCap(role, field);
      const next = typeof cap === "number" ? Math.min(field.default, cap) : field.default;
      depositClamped[role] = false;
      input.value = shown(next, scaleOf(field));
      slider.value = String(next);
      showLinkedShare(role, name, next, cap);
      moveDepositShare(role, name, next, cap);
    }, atDefault);
    const hint = document.createElement("p");
    hint.className = "field-help deposit-kind-hint";
    hint.textContent = DEPOSIT_SHARE_KINDS[name].hint;
    hint.hidden = true;
    const note = document.createElement("p");
    note.className = "field-help deposit-cap-note";
    note.hidden = true;
    wrap.append(hint, note);
    if (depositsPerAccount()) {
      input.disabled = true;
      slider.disabled = true;
      wrap.classList.add("field-disabled");
      const note = document.createElement("p");
      note.className = "field-help switch-note";
      note.textContent = "Set per account below.";
      wrap.append(note);
      if (name === "traditionalShare") {
        const back = document.createElement("button");
        back.type = "button";
        back.className = "button button-quiet";
        back.textContent = "Go back to the household plan";
        back.addEventListener("click", useHouseholdPlan);
        wrap.append(back);
      }
    }
    return wrap;
  }

  // Bring a person's two shares to the last depositSliders answer: each slider's top at the cap, each box and slider
  // held there, a share without an account of its kind swapped for its hint, and one note under the last share shown:
  // "IRS limit" when the two together reach the cap (or a typed share was above it), or why the sliders are off without
  // pay. Called again whenever the answer moves (pay, age or accounts changed).
  function syncDepositCap(role) {
    const perAccount = depositsPerAccount();
    const drawn = [];
    for (const name of DEPOSIT_SHARE_NAMES) {
      const path = role + ".retirementDeposit." + name;
      const field = drawnFields.get(path);
      const input = $(fieldId(path));
      const slider = $(fieldId(path) + "-slider");
      const wrap = input && input.closest(".deposit-share");
      const note = wrap && wrap.querySelector(".deposit-cap-note");
      if (!field || !slider || !note) continue;
      const cap = depositCap(role, field);
      const owned = depositKindOwned(role, name);
      slider.max = String(typeof cap === "number" ? cap : field.maximum);
      slider.disabled = perAccount || cap === "noPay";
      const value = depositShownValue(role, name, field);
      if (document.activeElement !== slider) slider.value = String(value);
      if (document.activeElement !== input) input.value = shown(value, scaleOf(field));
      wrap.querySelectorAll(".deposit-share-control").forEach((control) => { control.hidden = !owned; });
      wrap.querySelector(".deposit-kind-hint").hidden = owned;
      note.hidden = true;
      drawn.push({ field, note, owned, cap });
    }
    const last = drawn.filter((item) => item.owned).pop();
    if (!last || perAccount) return;
    const total = DEPOSIT_SHARE_NAMES.reduce((sum, name) => sum + depositShareValue(role, name), 0);
    let text = "";
    if (last.cap === "noPay") text = "No pay this year: enter a salary on Income to set the deposit.";
    else if (typeof last.cap === "number" && (depositClamped[role] || total >= last.cap - 1e-9)) {
      text = "IRS limit: at most " + percent(last.cap, 0) + " of pay together.";
    }
    last.note.textContent = text;
    last.note.hidden = !text;
  }

  function syncDepositCaps() {
    for (const role of ["you", "partner"]) syncDepositCap(role);
  }

  // Send a Traditional or Roth share move to wmti (moveDepositShare) with the slider's top as the cap the two share (null
  // until it is known: wmti then reads the cap itself); one move is in flight at a time and only the newest waiting
  // position is kept. The reply's Traditional and Roth shares are stored, and its sliders redraw the deposits.
  async function moveDepositShare(role, name, value, cap) {
    if (depositShareMove.busy) {
      depositShareMove.pending = { role, name, value, cap };
      return;
    }
    depositShareMove.busy = true;
    let reply = null;
    const limit = typeof cap === "number" ? cap : null;
    try {
      reply = await engine.call("moveDepositShare", [JSON.stringify(state.inputs), role, name, value, limit]);
    } catch (error) {
      reply = null;
    }
    depositShareMove.busy = false;
    const answer = reply && reply.value;
    if (answer && !answer.inputs) {
      state.error = answer.error;
      renderSettingsError();
    }
    if (answer && answer.inputs && answer.inputs[role] && state.inputs[role]) {
      state.inputs[role].retirementDeposit = answer.inputs[role].retirementDeposit;
      if (answer.sliders) state.deposits = answer.sliders;
      inputsChanged();
      syncDepositShareDefaults();
      renderDeposits();
    }
    const next = depositShareMove.pending;
    depositShareMove.pending = null;
    if (next) moveDepositShare(next.role, next.name, next.value, next.cap);
  }

  // After a move: each drawn Traditional and Roth share shows the stored shares (the other one of a pair as wmti kept
  // it), grey at its default with the reset button hidden.
  function syncDepositShareDefaults() {
    for (const [path, field] of drawnFields) {
      const match = DEPOSIT_SHARE_PATH.exec(path);
      const input = match && $(fieldId(path));
      if (!input) continue;
      const value = depositShownValue(match[1], match[2], field);
      if (document.activeElement !== input) input.value = shown(value, scaleOf(field));
      const slider = $(fieldId(path) + "-slider");
      if (slider && document.activeElement !== slider) slider.value = String(value);
      input.classList.toggle("is-default", Math.abs(depositShareValue(match[1], match[2]) - field.default) <= 1e-9);
      syncReset(input);
    }
    syncDepositCaps();
  }

  // Whether a person ("you", "partner") has the earnings history the earnings basis reads: entered years, or a last
  // salary to backtrack from (a blank one is today's salary while not past the retirement age, lastSalaryDefault).
  function hasEarningsHistory(role) {
    const person = getPath(state.inputs, role) || {};
    const history = person.salaryHistory;
    const lastSalary = person.lastSalary == null ? lastSalaryDefault(person) : person.lastSalary;
    return person.earningsHistoryMode === "lastSalary" ? Number(lastSalary) > 0
      : history != null && Object.keys(history).length > 0;
  }

  // The Social Security basis as a two-position toggle (Earnings history, Manual entry). With the earnings history
  // filled in, Earnings history is simply chosen. Without it, a pop-up asks "Enter earnings history?": Yes opens that
  // history on Income (with Back to Social Security), No keeps Manual entry; either way the basis stays on the table
  // (the loader refuses the earnings basis without a history) until the history is entered and Back is tapped.
  function basisToggle(field, path, value) {
    const wrap = fieldShell(field.label, field.help, null);
    const group = document.createElement("div");
    group.className = "segmented";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", field.label);
    group.id = fieldId(path);
    const role = path.split(".")[0];
    const hasHistory = hasEarningsHistory(role);
    const hint = document.createElement("p");
    hint.className = "field-help basis-hint";
    hint.id = group.id + "-hint";
    hint.textContent = NO_EARNINGS_HINT;
    // At Medium the earnings estimate (offered at High only) is left out unless it is the basis already held.
    const choices = Object.keys(field.choiceLabels).filter((choice) => choiceShown("Person", field.name, choice, value));
    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.basis = choice;
      button.textContent = field.choiceLabels[choice];
      button.setAttribute("aria-pressed", String(choice === value));
      if (choice === "earnings" && !hasHistory) button.setAttribute("aria-describedby", hint.id);
      button.addEventListener("click", () => {
        if (choice === getPath(state.inputs, path)) return;
        if (choice === "earnings" && !hasEarningsHistory(role)) {
          askEarningsHistory(role);
          return;
        }
        setValue(path, choice);
        refreshForm();  // the entered table shows only on Manual entry
      });
      group.append(button);
    }
    wrap.append(group);
    if (!hasHistory && choices.includes("earnings")) wrap.append(hint);
    return wrap;
  }

  // Yes on "Enter earnings history?" leads to that person's earnings history on Income (opened and scrolled to), with
  // a large Back to Social Security button in the top bar and a dismiss (X). Shown only after that choice; gone when
  // Inputs or the Income chip is left.
  let earningsReturn = null;  // the person ("you", "partner") whose Social Security Back returns to

  // The pop-up before the jump: Yes opens the earnings history, No keeps Manual entry (the benefit amount).
  function askEarningsHistory(role) {
    const whose = role === "partner" ? "Your partner's" : "Your";
    openDialog({ title: "Enter earnings history?",
      text: whose + " earnings history is empty, and the estimate from earnings needs it. Enter it on Income now? "
        + "No keeps Manual entry (the benefit amount) until the history is entered.",
      actions: [["No", "button button-quiet", () => refreshForm(), "earningsAskNo"],
        ["Yes", "button", () => { goToEarnings(role); }, "earningsAskYes"]] });
  }

  function goToEarnings(role) {
    earningsReturn = role;
    openGroups.add(earningsOpenKey(role));
    state.chips.settings = "income";
    savePrefs();
    renderSettings();
    const summary = document.querySelector("#" + CSS.escape("earnings-" + role) + " > summary");
    if (summary) summary.scrollIntoView({ block: "center" });
    const back = document.querySelector("#earningsReturn [data-action=earnings-return]");
    if (back) back.focus({ preventScroll: true });
  }

  function renderEarningsReturn() {
    let bar = $("earningsReturn");
    if (earningsReturn == null || !tabShown("inputs") || state.chips.settings !== "income") {
      earningsReturn = null;
      if (bar) bar.remove();
      return;
    }
    if (bar) return;
    bar = document.createElement("div");
    bar.id = "earningsReturn";
    bar.className = "earnings-return";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Social Security");
    const back = document.createElement("button");
    back.type = "button";
    back.className = "earnings-return-back";
    back.dataset.action = "earnings-return";
    back.textContent = "Back to Social Security";
    back.addEventListener("click", backToSocialSecurity);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "earnings-return-close";
    close.dataset.action = "earnings-return-dismiss";
    close.setAttribute("aria-label", "Dismiss Back to Social Security");
    close.textContent = "\u00d7";
    close.addEventListener("click", () => {
      const role = earningsReturn;
      earningsReturn = null;
      renderEarningsReturn();
      const summary = document.querySelector("#" + CSS.escape("earnings-" + role) + " > summary");
      if (summary) summary.focus({ preventScroll: true });
    });
    bar.append(back, close);
    document.querySelector(".topbar").append(bar);  // in the sticky top bar: never over a control of Income
  }

  // Back to Social Security: a history entered meanwhile makes the earnings estimate the basis.
  function backToSocialSecurity() {
    const role = earningsReturn;
    earningsReturn = null;
    if (hasEarningsHistory(role) && getPath(state.inputs, role + ".socialSecurityBasis") !== "earnings") {
      setValue(role + ".socialSecurityBasis", "earnings");
    }
    state.chips.settings = "retirement";
    savePrefs();
    renderSettings();
    const group = $(fieldId(role + ".socialSecurityBasis"));
    if (!group) return;
    group.scrollIntoView({ block: "center" });
    const pressed = group.querySelector("[aria-pressed=\"true\"]");
    if (pressed) pressed.focus({ preventScroll: true });
  }

  // A field whose schema entry has `inflationNote` (its help ends with the note that the mean inflation is subtracted
  // in today's dollars) gets a red "i" button.
  function fieldElement(field, path, filter) {
    const element = fieldControl(field, path, filter);
    const button = field.inflationNote && element.querySelector(":scope > .field-head > .help-button");
    if (button) button.classList.add("help-inflation");
    return element;
  }

  // The open sheet's item and the field name a path points at, or null when the path is not a field of that item.
  function sheetItemOf(path) {
    if (!sheetOpen) return null;
    const prefix = sheetOpen.path + "." + sheetOpen.position + ".";
    if (!path.startsWith(prefix) || path.slice(prefix.length).includes(".")) return null;
    const item = (getPath(state.inputs, sheetOpen.path) || [])[sheetOpen.position];
    return item ? { item, name: path.slice(prefix.length), type: sheetOpen.field.type } : null;
  }

  // A blank sheet figure that shows its source's value (sheetDefault), or a blank panel figure that shows the value
  // the model uses (panelDefault): the value shown, its stored blank and the `.is-default` styling, refreshed after
  // each edit (showsDefault).
  function sheetDefaultOf(path) {
    const at = sheetItemOf(path);
    return at ? sheetDefault(at.type, at.name, at.item, state.info.sheetRules)
      : panelDefault(path, state.inputs, state.info.lawTaxYear);
  }

  // The schema field drawn at each path (fieldControl), so a field with no blank rule can fall back on its shipped
  // default (fieldDefault): grey while it holds it, with a reset button once it differs.
  const drawnFields = new Map();

  // Whether a field follows a blank rule (a sheet or panel default) rather than its shipped default.
  function hasBlankRule(path) {
    return defaultBlankOf(path) !== undefined;
  }

  // A field with no blank rule that has a shipped default: {value, blank} with both the default, or null.
  function shippedDefaultOf(path) {
    if (hasBlankRule(path)) return null;
    const value = fieldDefault(drawnFields.get(path));
    return value == null ? null : { value, blank: value };
  }

  function markDefault(element, path) {
    const at = sheetItemOf(path);
    const grey = !hasBlankRule(path) ? atFieldDefault(drawnFields.get(path), getPath(state.inputs, path))
      : at ? showsDefault(at.type, at.name, at.item, state.info.sheetRules)
        : panelDefault(path, state.inputs, state.info.lawTaxYear) !== null;
    element.classList.toggle("is-default", grey);
    // A box cleared while typed in shows the value its blank stands for, never the word Blank.
    const target = element.tagName === "INPUT" && hasBlankRule(path) ? resetTargetOf(path) : null;
    if (target && drawnFields.has(path)) element.placeholder = shown(target.value, scaleOf(drawnFields.get(path)));
    syncReset(element);
  }

  // What a sheet or panel field's reset button puts back ({value, blank}, from the same rules as sheetDefaultOf, else
  // its shipped default), or null when it has no default.
  function resetTargetOf(path) {
    const at = sheetItemOf(path);
    const target = at ? sheetResetTarget(at.type, at.name, at.item, state.info.sheetRules)
      : panelResetTarget(path, state.inputs, state.info.lawTaxYear);
    return target || shippedDefaultOf(path);
  }

  // Whether a sheet or panel field already holds what its reset button would show (a figure typed equal to its
  // default), so there is nothing to reset.
  function atResetTarget(path) {
    const target = resetTargetOf(path);
    const value = getPath(state.inputs, path);
    return target !== null && (sameValue(value, target.value)
      || (!hasBlankRule(path) && atFieldDefault(drawnFields.get(path), value)));
  }

  // What a field with a default stores when cleared: its sheet rule's blank (sheetBlank), null for a panel default,
  // or undefined for a field with no default (numberInput then refuses a blank, or stores null if nullable).
  function defaultBlankOf(path) {
    const at = sheetItemOf(path);
    if (at) return sheetBlank(at.type, at.name);
    return panelResetTarget(path, state.inputs, state.info.lawTaxYear) ? null : undefined;
  }

  // ---- Reset to default: a field with a default (`.is-default` while it shows it) gets a small reset button inside
  // its right edge, shown once the value is edited; a click puts the default back through the field's own edit path
  // (addResetButton). `describe` gives the default as text for the tooltip, or null when there is none now. ----
  const RESET_ICON = "<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M3.5 8a4.5 4.5 0 1 0 "
    + "1.4-3.3\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M4.6 1.8"
    + "v3.2h3.2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" "
    + "stroke-linejoin=\"round\"/></svg>";
  const resetDescriptions = new WeakMap();
  const resetMatches = new WeakMap();  // button -> () => whether the value already equals the default (atResetTarget)

  // The default's text for a tooltip: a select's option label, else the value in the field's unit ($1,234, 5%).
  function resetValueText(value, field, control) {
    if (control.tagName === "SELECT") {
      const option = Array.from(control.options).find((item) => item.value === (value == null ? "" : String(value)));
      if (option) return option.textContent;
      return choiceLabel(field, value, NULL_LABELS[field.name]);
    }
    return typeof value === "number" ? formatValue(value, field.unit) : String(value);
  }

  // Put a reset button beside `control` (inside its $ or % box, else in a new box around it). `reset` stores the
  // default and shows it; the button then hides and the control takes the focus. `matches` (optional) says whether the
  // value already equals the default, which hides the button too.
  function addResetButton(control, label, describe, reset, matches) {
    let host = control.parentNode;
    if (!(host && host.classList && host.classList.contains("affix"))) {
      host = document.createElement("div");
      control.replaceWith(host);
      host.append(control);
    }
    host.classList.add("has-reset");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reset-default";
    button.setAttribute("aria-label", "Reset " + label + " to default");
    button.innerHTML = RESET_ICON;
    // A press keeps the focus in the field, so the bottom bar hidden while typing does not come back under the finger.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      reset();
      if (control.getAttribute("aria-invalid") === "true") control.setAttribute("aria-invalid", "false");
      const problem = host.nextElementSibling;
      if (problem && problem.classList.contains("field-error")) problem.hidden = true;
      if (control.isConnected) control.focus();
    });
    resetDescriptions.set(button, describe);
    if (matches) resetMatches.set(button, matches);
    host.append(button);
    syncReset(control);
  }

  // Show a control's reset button only while its value is not the default (not `.is-default` and not equal to it)
  // and a default exists.
  function syncReset(control) {
    const host = control.parentNode;
    const button = host && host.querySelector ? host.querySelector(":scope > .reset-default") : null;
    if (!button) return;
    const matches = resetMatches.get(button);
    const text = control.classList.contains("is-default") || (matches && matches()) ? null
      : resetDescriptions.get(button)();
    button.hidden = text == null;
    host.classList.toggle("reset-shown", text != null);
    if (text != null) button.title = "Reset to default (" + text + ")";
  }

  // ---- State combobox: one box over a long select (the states) that filters its list as you type ----
  // `select` stays in place as the value: hidden, its options, value, change event, `.is-default` and reset button
  // work as before, and setting `select.value` updates the box. Call it once the select sits in its field (after its
  // reset button): the field's label moves to the box. Focus or a click opens the list; typing filters it by name or
  // code (comboOptions); the arrows, Home and End move the highlight; Enter or a tap picks; Escape or leaving puts the
  // chosen state's name back. A cleared box with Enter picks the blank choice where the select has one.
  let comboCount = 0;
  const SELECT_VALUE = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");

  function stateCombobox(select) {
    comboCount += 1;
    const box = document.createElement("div");
    box.className = "combo";
    const input = document.createElement("input");
    input.type = "text";
    input.id = (select.id || "combo-" + comboCount) + "-combo";
    input.className = select.className + " combo-input";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    const list = document.createElement("ul");
    list.className = "combo-list";
    list.id = input.id + "-list";
    list.setAttribute("role", "listbox");
    list.hidden = true;
    input.setAttribute("aria-controls", list.id);
    const root = select.getRootNode();
    const labels = select.id && root.querySelectorAll
      ? Array.from(root.querySelectorAll("label[for=\"" + CSS.escape(select.id) + "\"]")) : [];
    labels.forEach((label, index) => {
      label.htmlFor = input.id;
      if (!label.id) label.id = input.id + "-label" + (index || "");
    });
    const labelledBy = select.getAttribute("aria-labelledby") || labels.map((label) => label.id).join(" ");
    if (labelledBy) {
      input.setAttribute("aria-labelledby", labelledBy);
      list.setAttribute("aria-labelledby", labelledBy);
    }
    if (select.hasAttribute("aria-describedby")) input.setAttribute("aria-describedby", select.getAttribute("aria-describedby"));
    box.append(input, list);
    select.before(box);
    select.classList.add("combo-native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    let listed = [];
    let active = -1;
    const options = () => Array.from(select.options).map((option) => ({ value: option.value, label: option.textContent }));
    const show = () => {  // the box shows the chosen choice's name, in gray while it is the default
      const chosen = select.options[select.selectedIndex];
      input.value = chosen ? chosen.textContent : "";
      input.classList.toggle("is-default", select.classList.contains("is-default"));
      input.disabled = select.disabled;
    };
    const highlight = (index) => {
      active = index;
      Array.from(list.children).forEach((item, at) => item.classList.toggle("active", at === active));
      const item = list.children[active];
      if (item) {
        input.setAttribute("aria-activedescendant", item.id);
        item.scrollIntoView({ block: "nearest" });
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    };
    const draw = (query) => {
      listed = comboOptions(options(), query);
      list.replaceChildren(...listed.map((option, at) => {
        const item = document.createElement("li");
        item.id = list.id + "-" + at;
        item.className = "combo-option";
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(option.value === select.value));
        item.textContent = option.label;
        return item;
      }));
      if (!listed.length) {
        const empty = document.createElement("li");
        empty.className = "combo-empty";
        empty.textContent = "No match";
        list.append(empty);
      }
    };
    const open = () => {
      if (input.disabled) return;
      draw("");
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      highlight(listed.findIndex((option) => option.value === select.value));
    };
    const close = () => {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      active = -1;
    };
    const choose = (value) => {
      close();
      if (value != null && value !== select.value) {
        SELECT_VALUE.set.call(select, value);
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (select.isConnected) show();
    };

    let quiet = false;  // focused from code (the reset button): the list stays shut
    let keepSelection = false;  // the click that focused the box keeps its text selected, so typing replaces it
    input.addEventListener("focus", () => {
      if (!quiet) open();
      input.select();
      keepSelection = true;
    });
    input.addEventListener("mouseup", (event) => {
      if (keepSelection) event.preventDefault();
      keepSelection = false;
    });
    input.addEventListener("click", () => { if (list.hidden) open(); });
    input.addEventListener("blur", () => {
      close();
      show();
    });
    input.addEventListener("input", () => {
      keepSelection = false;
      draw(input.value);
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      highlight(input.value.trim() && listed.length ? 0 : -1);
    });
    input.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key === "ArrowDown" || key === "ArrowUp" || ((key === "Home" || key === "End") && !list.hidden)) {
        event.preventDefault();
        if (list.hidden) open();
        else highlight(comboMove(listed.length, active, key));
      } else if (key === "Enter" && !list.hidden) {
        event.preventDefault();
        choose(comboPick(listed, active, input.value));
      } else if (key === "Escape" && !list.hidden) {
        event.preventDefault();
        event.stopPropagation();
        close();
        show();
        input.select();
      }
    });
    list.addEventListener("mousedown", (event) => event.preventDefault());  // the box keeps the focus
    list.addEventListener("click", (event) => {
      const item = event.target.closest(".combo-option");
      if (item) choose(listed[Array.from(list.children).indexOf(item)].value);
    });
    // The select stays the value: setting it in code, a change made on it, its gray default class and its disabled
    // state all show in the box; focusing it focuses the box (the reset button does).
    Object.defineProperty(select, "value", {
      configurable: true,
      get() { return SELECT_VALUE.get.call(select); },
      set(value) {
        SELECT_VALUE.set.call(select, value);
        show();
      },
    });
    select.addEventListener("change", show);
    select.focus = (focusOptions) => {
      quiet = true;
      input.focus(focusOptions);
      quiet = false;
    };
    new MutationObserver(show).observe(select, { attributes: true, attributeFilter: ["class", "disabled"] });
    show();
    return input;
  }

  // A blank sheet figure whose source shows nothing yet (sheetPrompt): {text, blank}, or null.
  function sheetPromptOf(path) {
    const at = sheetItemOf(path);
    return at ? sheetPrompt(at.type, at.name, at.item, state.info.sheetRules) : null;
  }

  // `filter` (a panel's list filter, see filteredPositions) limits which items of a list field are shown.
  function fieldControl(field, path, filter) {
    drawnFields.set(path, field);
    const fallback = sheetDefaultOf(path);
    // A blank with a prompt and nothing to show (a car's value today without a year bought) is an empty box.
    const prompt = fallback ? null : sheetPromptOf(path);
    const value = fallback ? fallback.value : prompt ? null : getPath(state.inputs, path);
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
        // At Medium an option offered only at High (visit-based healthcare costs) is left out unless it is held.
        const optionKey = optionKeyOf(field);
        if (optionKey) {
          choices = choices.filter((choice) => choiceShown(optionKey.split(".")[0], field.name, choice, value));
        }
        const allowed = sheetAllowed(field, path);  // a filtered list's item offers only the panel's values
        if (allowed) choices = allowed.concat(value != null && !allowed.includes(value) ? [value] : []);
        // A claim age at an estimated table age is not a key of the stored table; keep it selectable, not blank.
        if (field.choicesFrom && value != null && !choices.includes(value)) {
          choices = choices.concat([value]).sort((left, right) => left - right);
        }
        if (path === "hsa.owner") {  // the HSA belongs to one person: no JOINT, and no PARTNER without a partner
          choices = choices.filter((choice) => choice !== "PARTNER" || state.inputs.partner != null
            || choice === value);
        } else if (field.name === "owner" && state.notes && state.notes.ownerOptions) {
          choices = state.notes.ownerOptions.concat(value != null && !state.notes.ownerOptions.includes(value)
            ? [value] : []);
        }
        if (field.name === "account529") {  // a child's college 529: the household's 529 accounts by name
          const names = state.inputs.accounts.filter((account) => account.kind === "529").map((account) => account.name);
          choices = names.concat(value != null && !names.includes(value) ? [value] : []);
        }
        // A blank that shows its source's choice offers only real choices; picking one stores it.
        const offered = fallback ? choices.filter((choice) => choice !== fallback.blank) : choices;
        const options = (field.nullable ? [null] : []).concat(offered);
        const labelled = { choiceLabels };
        select.replaceChildren(...options.map((choice) => {
          const option = document.createElement("option");
          option.value = choice == null ? "" : String(choice);
          option.textContent = choiceLabel(labelled, choice,
            HEIR_STATE_PATH.test(path) ? SAME_STATE_LABEL : NULL_LABELS[field.name]);
          return option;
        }));
        select.value = value == null ? "" : String(value);
        select.addEventListener("change", () => {
          const raw = select.value;
          let choice = options.find((item) => (item == null ? "" : String(item)) === raw);
          // The claim ages are put in place when the benefit tables arrive, so an age may not be in `options`.
          if (choice === undefined && field.choicesFrom && raw !== "") choice = Number(raw);
          setValue(path, choice === undefined ? null : choice);
          markDefault(select, path);
          afterSheetEdit(path);
          if (isConditionPath(path)) refreshForm();
        });
        markDefault(select, path);
        wrap.append(select);
        if (resetTargetOf(path)) {  // reset stores the blank and runs the select's own change path
          addResetButton(select, field.label, () => {
            const target = resetTargetOf(path);
            return target ? resetValueText(target.value, field, select) : null;
          }, () => {
            const target = resetTargetOf(path);
            if (!target) return;
            setValue(path, target.blank);
            const now = resetTargetOf(path);
            const shownChoice = now ? String(now.value) : "";
            const listed = Array.from(select.options).some((option) => option.value === shownChoice);
            select.value = listed ? shownChoice : "";
            markDefault(select, path);
            afterSheetEdit(path);
            if (!listed || isConditionPath(path)) refreshForm();
          }, () => atResetTarget(path));
        }
        if (LAW_STATE_PATHS.includes(path)) wrap.append(stateRulesLink(select));
        // A long list (the 51 states) is one box that filters its list as you type (stateCombobox).
        if (offered.length > LONG_SELECT_CHOICES) stateCombobox(select);
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
        const at = sheetItemOf(path);
        if (at && at.type === "ExpenseItem" && at.name === "name") watchExpenseName(path, input);
        wrap.append(input);
        return wrap;
      }
      case "integer":
      case "number": {
        const wrap = fieldShell(field.label, field.help, id);
        // A field with a default: clearing it stores the blank again (the source shows on redraw), whether or not it
        // showed the default when drawn.
        const box = numberInput(id, field, value, (next) => {
          setValue(path, next);
          markDefault(input, path);
        }, defaultBlankOf(path));
        const input = box.querySelector("input") || box;
        if (prompt) input.placeholder = prompt.text;
        markDefault(input, path);
        if (resetTargetOf(path)) {  // reset stores the blank and shows the source's value, as a redraw would
          addResetButton(input, field.label, () => {
            const target = resetTargetOf(path);
            return target ? resetValueText(target.value, field, input) : null;
          }, () => {
            const target = resetTargetOf(path);
            if (!target) return;
            setValue(path, target.blank);
            const now = resetTargetOf(path);
            input.value = shown(now ? now.value : null, scaleOf(field));
            markDefault(input, path);
            input.dispatchEvent(new Event("change"));
          }, () => atResetTarget(path));
        }
        const at = sheetItemOf(path);
        if (at && sheetSources(at.type).includes(at.name)) {  // the figures that follow it, or show with it, redraw
          input.addEventListener("change", () => {
            refreshForm();
            const redrawn = $(fieldId(path));
            if (redrawn) redrawn.focus();
          });
        }
        wrap.append(box);
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
  // table (entered and estimated, from benefitTables) once it has arrived.
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
        ? "No partner in this household. Turn on “Include a partner” under Setup, Household to add one."
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
    // A derived field (the employer match percent) is drawn where the first stored field it replaces would be.
    const derived = (state.schema.derivedFields || {})[field.type] || [];
    const children = (state.schema.types[field.type] || []).flatMap((child) => {
      const replacing = derived.filter((entry) => entry.replaces.includes(child.name));
      if (!replacing.length) return [child];
      return replacing.filter((entry) => entry.replaces[0] === child.name);
    }).filter((child) => !placed.has(path + "." + child.name));
    const value = getPath(state.inputs, path);
    const gate = children.find((child) => child.name === "enabled" && child.kind === "toggle");
    // At Medium a child above the effort (and not shown by Add detail) is left out, so a group or the earnings history
    // with no member shown is not drawn; a switch left out still keeps the fields it opens closed while it is off.
    // The Roth conversion's To age is the second knob of its From age's slider (rothAgesField).
    const shown = children.filter((child) => child !== gate && detailShownFor(field.type, child))
      .filter((child, _, list) => !(field.type === "RothConversionPlan" && child.name === "endAge"
        && list.some((other) => other.name === "startAge")));
    if (gate) {
      if (!detailShownFor(field.type, gate)) {
        return value && value.enabled ? pickedFields(field.type, shown, path, headings, group) : [];
      }
      const gatePath = path + ".enabled";
      const id = fieldId(gatePath);
      const gateSwitch = switchField(gate.label, gate.help, id, Boolean(value && value.enabled), (checked) => {
        setValue(gatePath, checked);
        refreshForm();
        const redrawn = $(id);
        if (redrawn) redrawn.focus();
      });
      if (!(value && value.enabled)) return [gateSwitch];
      return [gateSwitch, ...pickedFields(field.type, shown, path, headings, group)];
    }
    return pickedFields(field.type, shown, path, headings, group);
  }

  // An object's fields with its checklist picker (`schema.fieldPickers`, the Roth conversion's limits): the picker is
  // drawn where its first option comes, then the field of each ticked option (a ticked switch needs none). An option
  // is ticked while its stored value is set (not null or false); the model reads the values alone.
  function pickedFields(typeName, children, path, headings, group) {
    const picker = (state.schema.fieldPickers || {})[typeName];
    const names = new Set(picker ? picker.options.map((option) => option.name) : []);
    const first = children.findIndex((child) => names.has(child.name));
    if (first < 0) return groupedFields(children, path, headings, group);
    const byName = Object.fromEntries(children.map((child) => [child.name, child]));
    const others = children.filter((child) => !names.has(child.name));
    const ticked = picker.options.filter((option) => byName[option.name]
      && pickerTicked(getPath(state.inputs, path + "." + option.name)));
    return [...groupedFields(others.filter((child) => children.indexOf(child) < first), path, headings, group),
      checklistPicker(picker, byName, path),
      ...ticked.filter((option) => byName[option.name].kind !== "toggle")
        .map((option) => fieldElement(byName[option.name], path + "." + option.name)),
      ...groupedFields(others.filter((child) => children.indexOf(child) > first), path, headings, group)];
  }

  function pickerTicked(value) {
    return value !== null && value !== undefined && value !== false;
  }

  // The value a tick stores: the option's own, or the field's first choice where that is not offered (a filing table's
  // brackets and tiers).
  function pickerTickValue(option, field) {
    const byTable = field.choicesByFilingTable;
    const choices = byTable ? byTable[filingTable(state.inputs.filingStatus)] || [] : field.choices;
    if (!choices || choices.includes(option.value)) return option.value;
    return choices.length ? choices[0] : option.value;
  }

  // A dropdown checklist: a button naming the ticked options (or the picker's `none` text) that opens the list of
  // checkboxes below it. A tick stores the option's value and an untick the field's default, and the form is drawn
  // again with the list still open; Escape, the button or a tap outside closes it.
  const openPickers = new Set();

  function checklistPicker(picker, byName, path) {
    const id = fieldId(path) + "-picker";
    const open = openPickers.has(id);
    const wrap = fieldShell(picker.label, picker.help, null);
    wrap.classList.add("picker");
    const title = wrap.querySelector(".field-label");
    title.id = id + "-label";
    const table = filingTable(state.inputs.filingStatus);
    const options = picker.options.filter((option) => byName[option.name]);
    const chosen = options.filter((option) => pickerTicked(getPath(state.inputs, path + "." + option.name)));
    const button = document.createElement("button");
    button.type = "button";
    button.id = id;
    button.className = "input picker-button";
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-controls", id + "-list");
    button.setAttribute("aria-labelledby", title.id + " " + id + "-value");
    button.innerHTML = "<span class=\"picker-value" + (chosen.length ? "" : " is-default") + "\" id=\"" + id
      + "-value\">" + escapeText(chosen.length ? chosen.map((option) => option.label).join(", ") : picker.none)
      + "</span>";
    const list = document.createElement("fieldset");
    list.className = "picker-list";
    list.id = id + "-list";
    list.hidden = !open;
    list.innerHTML = "<legend class=\"sr-only\">" + escapeText(picker.label) + "</legend>";
    for (const option of options) {
      const field = byName[option.name];
      const optionPath = path + "." + option.name;
      const ticked = pickerTicked(getPath(state.inputs, optionPath));
      const unavailable = !ticked && option.unavailable && option.unavailable[table];
      const row = document.createElement("label");
      row.className = "picker-option";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.id = fieldId(optionPath) + "-pick";
      box.checked = ticked;
      box.disabled = Boolean(unavailable);
      const text = document.createElement("span");
      text.className = "picker-option-text";
      text.innerHTML = "<span>" + escapeText(option.label) + "</span><span class=\"picker-option-help\">"
        + escapeText(unavailable || option.help) + "</span>";
      box.addEventListener("change", () => {
        setValue(optionPath, box.checked ? pickerTickValue(option, field) : field.default);
        refreshForm();
        const redrawn = $(box.id);
        if (redrawn) redrawn.focus();
      });
      row.append(box, text);
      list.append(row);
    }
    button.addEventListener("click", () => setPickerOpen(button, button.getAttribute("aria-expanded") !== "true"));
    wrap.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || button.getAttribute("aria-expanded") !== "true") return;
      event.preventDefault();
      event.stopPropagation();
      setPickerOpen(button, false);
      button.focus();
    });
    wrap.append(button, list);
    return wrap;
  }

  function setPickerOpen(button, open) {
    button.setAttribute("aria-expanded", String(open));
    $(button.getAttribute("aria-controls")).hidden = !open;
    if (open) openPickers.add(button.id);
    else openPickers.delete(button.id);
  }

  // A tap or click outside an open picker closes it.
  document.addEventListener("pointerdown", (event) => {
    for (const button of document.querySelectorAll(".picker-button[aria-expanded='true']")) {
      if (!button.closest(".picker").contains(event.target)) setPickerOpen(button, false);
    }
  });

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

  // Edit (or Save, which closes the boxes keeping what was typed) and Revert to calculated under a Last salary table.
  function earningsButtons(path) {
    const editing = earningsEditing.has(path);
    const typed = getPath(state.inputs, path + ".salaryOverrides") || {};
    const actions = document.createElement("div");
    actions.className = "sheet-actions earnings-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "button button-quiet";
    edit.dataset.action = "earnings-edit";
    edit.textContent = editing ? "Save" : "Edit";
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

  // Draw one person's Last salary table into its box: the read-only table, or while editing a box per year. A newer
  // preview (a raise, promotion or last salary edit) updates the boxes in place, so the calculated years follow it and
  // a typed year keeps its typed amount; the box being typed in is left alone.
  function fillEarningsBox(box) {
    const role = box.id.slice("earnings-table-".length);
    if (box.dataset.editing !== "true") {
      box.innerHTML = earningsPreviewHtml(role);
      return;
    }
    if (box.querySelector("input") && refreshEarningsEditor(box, role)) return;
    const editor = earningsEditor(role);
    if (editor) box.replaceChildren(editor);
  }

  function earningsPerson(role) {
    const preview = state.earnings;
    const person = preview && preview.ok ? preview.people.find((item) => item.role === role) : null;
    return person && !person.error ? person : null;
  }

  // Put the latest preview into an open editor's boxes; false when its years changed and the editor is to be drawn
  // again (kept while one of its boxes has the focus).
  function refreshEarningsEditor(box, role) {
    const person = earningsPerson(role);
    if (!person) return true;
    const rows = [...box.querySelectorAll("tbody tr")];
    if (rows.length !== person.rows.length
        || rows.some((row, index) => row.querySelector("th").textContent !== String(person.rows[index][0]))) {
      return box.contains(document.activeElement);
    }
    person.rows.forEach(([year, amount], index) => {
      const input = rows[index].querySelector("input");
      if (input !== document.activeElement) input.value = String(amount);
      rows[index].querySelector(".earnings-edited").textContent = person.edited.includes(year) ? "edited" : "";
    });
    return true;
  }

  function earningsEditor(role) {
    const person = earningsPerson(role);
    if (!person) return null;
    // The calculated years of the latest preview, read when a box changes, so a newer preview is compared against.
    const calculated = () => Object.fromEntries((earningsPerson(role) || person).calculated);
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
        const calculatedYear = calculated()[year];
        if (input.value === "" || !Number.isFinite(value) || value === calculatedYear) delete overrides[year];
        else overrides[year] = value;
        if (input.value === "") input.value = String(calculatedYear);
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
    return tabShown("inputs") && state.schema != null && document.querySelector(".earnings-preview") != null;
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
      return { name: item.name, detail: item.kind + (item.owner ? " · " + choiceLabel(schemaField("Account", "owner"),
        item.owner) : ""),
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
        + (item.child && !charity ? " · not scaled by children" : ""), value: compactMoney(item.amount),
        isDefault: unfilledSuggestion(item) };
    }
    if (typeName === "Loan") {
      const span = spanText(item, state.inputs.you.currentAge);
      return { name: item.name, detail: item.kind + " · " + percent(item.annualRate, 2) + " · " + item.remainingMonths
        + " months" + (item.refinance ? " · refinanced" : "")
        + (item.improvesHome === false && state.info.sheetRules.homeLoanKinds.includes(item.kind) ? " · not deducted" : "")
        + (span ? " · " + span : ""),
      value: compactMoney(item.balance) };
    }
    if (typeName === "Car") {
      return carSummary(item, state.inputs.you.currentAge, state.info.sheetRules, schemaField("Car", "driver"));
    }
    if (typeName === "Home") return homeSummary(item, state.inputs.you.currentAge, state.info.sheetRules);
    if (typeName === "RentPeriod") {
      const from = item.startAge == null ? "today" : String(timelineYear(item.startAge));
      const to = item.endAge == null ? "open" : String(timelineYear(item.endAge));
      return { name: item.name, detail: "per month · " + from + "-" + to, value: compactMoney(item.monthlyRent) };
    }
    if (typeName === "Heir") {
      const fields = Object.fromEntries(heirFieldsSchema().map((field) => [field.name, field]));
      const words = ["filingStatus", "state", "payout"].map((name) => choiceLabel(fields[name], item[name],
        SAME_STATE_LABEL));
      return { name: item.name, detail: words.join(" · ") + (item.child != null ? " · child" : ""),
        value: percent(Number(item.share) || 0, 0) };
    }
    if (typeName === "Child") {
      const age = state.inputs.you.currentAge - item.yourAgeAtBirth;
      return { name: item.name, detail: (age < 0 ? "not born yet" : "age " + age + " today") + ", child years up to age "
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
  // Lists whose order means nothing (children, homes, cars, expenses, loans, rent periods, heirs): no Move up, Move down
  // or drag handle; Delete stays. Accounts keep them: their order is the withdrawal priority and the deposit order.
  const UNORDERED_TYPES = new Set(["Child", "Home", "Car", "ExpenseItem", "Loan", "RentPeriod", "Heir"]);
  const isUnordered = (type) => UNORDERED_TYPES.has(type);

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
  function reorderBar(key, path, label, shown, selected, ordered = true) {
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
    if (ordered) bar.append(
      action("up", "Move up", "button-quiet", (items, picked) => moveSelected(items, picked, -1, shown)),
      action("down", "Move down", "button-quiet", (items, picked) => moveSelected(items, picked, 1, shown)));
    bar.append(action("delete", "Delete", "button-danger", (items, picked) => deleteSelected(items, picked)), count);
    bar.refresh = () => {
      const picked = selected();
      for (const button of bar.querySelectorAll("button")) {
        button.disabled = !picked.length;
        if (button.dataset.action === "delete" && button.dataset.armed === "true") {
          button.dataset.armed = "false";
          button.textContent = "Delete";
        }
      }
      count.textContent = picked.length ? picked.length + " ticked" : ordered ? "Tick items to move or delete them" : "Tick items to delete them";
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
    const ordered = !isUnordered(field.type);
    const bar = reorderBar(key, path, field.label, shown, selected, ordered);
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
      // A suggested expense row not filled in yet shows its $0 as a default (`.is-default`), like a blank figure.
      button.querySelector(".item-value").classList.toggle("is-default", Boolean(summary.isDefault));
      button.setAttribute("aria-label", "Edit " + (summary.name || "item") + ", position " + (index + 1));
      button.dataset.position = String(position);
      button.addEventListener("click", () => openSheet(field, path, position, false, filter));
      row.append(tick, button);
      if (ordered) row.append(dragHandle(key, path, position, name, shown, list));
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
    const homeOwner = homeOfLoans(path);  // a home's own loans (second mortgage, home equity)
    add.textContent = "Add " + (homeOwner ? "loan on this home" : typeWords(field.type));
    add.disabled = field.maximum != null && value.length >= field.maximum;
    // `preset`: for an expense row, the Add picker's choice (a preset row, or null for a row of your own); a preset
    // named like a cost another tab already counts asks first (`checked` once it was asked).
    const addItem = (preset, checked) => {
      if (field.type === "ExpenseItem" && preset && !checked
        && warnCountedElsewhere(preset.name, () => addItem(preset, true), () => {})) return;
      if (field.type === "Heir") {  // an equal part for the new beneficiary; the others keep their split of the rest
        beginSheetSession(path);  // Cancel on its sheet removes it again
        setPath(state.inputs, path, addHeir(getPath(state.inputs, path), heirFieldsSchema()));
        inputsChanged();
        openSheet(field, path, getPath(state.inputs, path).length - 1, false, filter);
        return;
      }
      // A home, car or rent period is added on its timeline: the first question there asks for its years.
      const timed = { Home: ["Home", null, 0], Car: ["Car", null, null], RentPeriod: ["Home", "rent", 0] }[field.type];
      if (timed) {
        openTimeline(timed[0], "add", { lane: timed[2], addChoice: timed[1] });
        return;
      }
      const items = getPath(state.inputs, path);
      let item = Object.assign(newItem(field.type), filterStartValues(filter));
      // An expense row starts as its preset (category, sales tax status and flags) or, of your own, taxable.
      if (field.type === "ExpenseItem") item = expensePresetItem(item, preset);
      const usual = field.type === "Account" && state.info.usualReturns[item.kind];
      if (usual) [item.meanReturn, item.returnStdDev] = usual;  // a new account starts with its kind's usual returns
      if (field.type === "Account") {  // a new account starts with its kind's owner (Joint for cash, You for a 401k)
        Object.assign(item, kindOwnerFilled({ ...item, owner: null }, null, state.info.defaultOwners));
      }
      if (field.type === "Child") item.yourAgeAtBirth = state.inputs.you.currentAge;  // a new child is born this year
      // A new Major Spending row is paid this year until its knob moves (with no From age it would never be paid).
      if (field.type === "ExpenseItem" && item.category === state.info.sheetRules.majorCategory && item.year == null) {
        item.year = state.inputs.you.currentAge;
      }
      // A loan added from inside its home's sheet keeps the home's sheet session to go back to.
      if (sheetOpen && sheetSession && path.startsWith(sheetOpen.path + "." + sheetOpen.position + ".")) {
        sheetSessionParents.push(sheetSession);
        sheetSession = null;
      }
      if (homeOwner) item.name = freeLoanName(homeOwner.name + " " + String(item.kind).toLowerCase());
      beginSheetSession(path);  // Cancel on the new item's sheet removes it again
      items.push(item);
      inputsChanged();
      openSheet(field, path, items.length - 1, false, filter);
    };
    add.addEventListener("click", () => addItem(null));
    const adder = field.type === "ExpenseItem" ? expensePicker(value, filter, add.disabled, addItem) : add;
    wrap.append(list, ...(shown.length ? [bar] : []), adder);
    return wrap;
  }

  // The Expenses Add picker: the common expenses of this list's categories not in the list yet (settings schema
  // `suggestedExpenses`) and not already counted on another tab (`countedElsewhere`), each added with its sales tax
  // status and flags set, and Other for a row of your own (in the list's first category); nothing is listed until
  // picked.
  function expensePicker(items, filter, disabled, addItem) {
    const presets = expensePresetChoices(state.schema.suggestedExpenses, items, filter, state.schema.countedElsewhere);
    const select = document.createElement("select");
    select.className = "input add-picker";
    select.setAttribute("aria-label", "Add expense");
    select.disabled = disabled;
    const prompt = document.createElement("option");
    prompt.value = "";
    prompt.textContent = "Add expense…";
    const common = document.createElement("optgroup");
    common.label = "Common expenses";
    presets.forEach((preset, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = preset.name;
      common.append(option);
    });
    const other = document.createElement("option");
    other.value = "other";
    other.textContent = "Other (your own)";
    select.append(prompt, ...(presets.length ? [common] : []), other);
    select.addEventListener("change", () => {
      const choice = select.value;
      select.value = "";
      if (choice === "") return;
      addItem(choice === "other" ? null : clone(presets[Number(choice)]));
    });
    return select;
  }

  // Before an Expenses row named like a cost another tab already counts (settings schema `countedElsewhere`, see
  // countedElsewhereMatch) is kept, a warning: Go to <Tab> (none for a tax the model works out), Add anyway and
  // Cancel. `keep` runs on Add anyway; `drop` on Cancel, Escape and the backdrop; `leave` (by default `drop`) on Go to,
  // before that tab's Inputs chip opens. False, and nothing shown, when the name matches no such cost.
  function warnCountedElsewhere(name, keep, drop, leave = drop) {
    const cost = countedElsewhereMatch(name, state.schema.countedElsewhere);
    if (!cost) return false;
    let settled = false;
    const once = (action) => () => {
      if (settled) return;
      settled = true;
      action();
    };
    const actions = [];
    if (cost.panel) {
      actions.push(["Go to " + cost.tab, "button", once(() => { leave(); goToInputsPanel(cost.panel); }),
        "countedElsewhereGo"]);
    }
    actions.push(["Add anyway", "button button-quiet", once(keep), "countedElsewhereAdd"],
      ["Cancel", "button button-quiet", once(drop), "countedElsewhereCancel"]);
    openDialog({ title: "Already counted", text: countedElsewhereText(name, cost), actions });
    dialog.onClose = once(drop);  // Escape and the backdrop cancel; after a button it does nothing
    return true;
  }

  // Open the Inputs chip of settings panel `panel` (the Low page has no chips: it opens Inputs; Strategies opens on
  // Strategy), closing any sheet.
  function goToInputsPanel(panel) {
    if (sheetOpen) closeSheet(true);
    if (panel === STRATEGY_PANEL) { goToPane("strategy"); return; }
    if (!lowOn() && state.chips.settings !== panel) {
      state.chips.settings = panel;
      savePrefs();
      renderSettings();
    }
    goTo("inputs", state.view);
  }

  // An expense sheet's Name box (`path`, the row's name): a name typed in and committed that looks like a cost another
  // tab already counts asks first (warnCountedElsewhere), unless the name the row had when its sheet opened matched the
  // same cost. Add anyway keeps it; Cancel puts back that earlier name (a row just added: its first name); Go to does
  // that too, or for a row just added removes it (as the sheet's Cancel), and opens the tab. Names are checked only
  // as they are typed, so saved rows load without a warning.
  function watchExpenseName(path, input) {
    input.addEventListener("change", () => {
      const typed = input.value;
      setTimeout(() => {  // a Cancel or Escape that blurred the box closes the sheet first: then nothing is asked
        const open = sheetOpen && sheetOpen.path + "." + sheetOpen.position + ".name" === path;
        if (!open || $("sheet").hidden || getPath(state.inputs, path) !== typed) return;
        const opened = sheetSession ? getPath(JSON.parse(sheetSession.inputs), sheetOpen.path) : null;
        const before = (opened || [])[sheetOpen.position];
        const earlier = before ? before.name : newItem("ExpenseItem").name;  // a row just added: its first name
        const counted = state.schema.countedElsewhere;
        const was = countedElsewhereMatch(earlier, counted);
        if (typed === earlier || (was && was === countedElsewhereMatch(typed, counted))) return;
        const putBack = () => {
          setValue(path, earlier);
          refreshForm();
        };
        warnCountedElsewhere(typed, () => {}, putBack, before ? putBack : cancelSheet);
      }, 0);
    });
  }

  // The home whose own loans a list path holds ("homes.<n>.loans"), or null for any other list.
  function homeOfLoans(path) {
    const match = /^homes\.(\d+)\.loans$/.exec(path);
    return match ? (state.inputs.homes || [])[Number(match[1])] || null : null;
  }

  // A loan name no loan uses yet (the Loans list, every home's mortgage and loans): `base`, else `base 2`, `base 3`...
  function freeLoanName(base) {
    const homes = state.inputs.homes || [];
    const taken = new Set([...(state.inputs.loans || []).map((loan) => loan.name),
      ...homes.map((home) => home.name + " mortgage"), ...homes.flatMap((home) => (home.loans || []).map((loan) => loan.name))]);
    let name = base;
    for (let number = 2; taken.has(name); number += 1) name = base + " " + number;
    return name;
  }

  function typeWords(typeName) {
    if (typeName === "Heir") return "beneficiary";  // the code name stays; users read "beneficiary"
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
  const sheetParents = [];  // the sheets a nested item's sheet goes back to on close, innermost last
  // An item sheet's edits apply as they are made; `sheetSession` holds the settings and the Undo history from just
  // before the sheet opened (before the item was added, for Add), so Cancel puts both back and Save leaves one Undo step.
  let sheetSession = null;  // {inputs (JSON text), undo, path}
  const sheetSessionParents = [];  // the sessions of the sheets in sheetParents, innermost last

  function beginSheetSession(path) {
    if (settleTimer) settle();  // an edit made before the sheet opened is a step of its own
    sheetSession = { inputs: JSON.stringify(state.inputs), undo: state.undo, path };
  }

  // Close the item sheet's session: kept (Save, Remove, a link away), its edits are one Undo step; cancelled, the
  // settings and the Undo history are put back as they were when it opened, so it leaves no step.
  function endSheetSession(keep) {
    const session = sheetSession;
    sheetSession = null;
    if (!session) return;
    clearTimeout(settleTimer);
    settleTimer = null;
    state.undo = session.undo;
    if (keep) { settle(); return; }
    if (JSON.stringify(state.inputs) === session.inputs) return;
    state.inputs = JSON.parse(session.inputs);
    clearSelections(session.path);
    inputsChanged();
  }

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
      ? "Charity amounts are per year, in today's dollars, and tax deductible; a Charity row is paid every year."
      : item.category === rules.majorCategory ? rules.majorCategory + " amounts are per year, in today's dollars, paid "
        + "once in the year you are the age below." : "";
    return note.textContent ? note : null;  // a monthly row needs no line: its amount reads Monthly
  }

  // The loan figures a car's or home's monthly payment line follows on its sheet, the first one drawn: its term (months
  // left, or the original term of a loan defined at purchase), else its rate, else what it owes.
  const LOAN_PAYMENT_AFTER = {
    Car: ["loanMonthsLeft", "loanTermMonths", "loanRate", "loanBalance", "loanOriginal", "loanStartYear",
      "downPaymentRate"],
    Home: ["mortgageMonthsLeft", "mortgageTermMonths", "mortgageRate", "mortgageBalance", "mortgageOriginal",
      "mortgageStartYear", "downPaymentRate"],
  };

  // A car paid with a loan or a home with a mortgage: a read-only Monthly payment line (principal and interest, from
  // sheetLoanPayment) below its loan figures, kept current as they are typed (refreshLoanPayment). A loan defined at
  // purchase also gets a grey line above it with today's balance and the time left worked out (`carLoanNow`).
  function placeLoanPayment(typeName, item, itemPath) {
    const loan = sheetLoanPayment(typeName, item, state.info.sheetRules);
    if (!loan) return;
    const anchor = (LOAN_PAYMENT_AFTER[typeName] || []).map((name) => $(fieldId(itemPath + "." + name)))
      .find(Boolean);
    const holder = anchor && anchor.closest(".field");
    if (!holder) return;
    const line = document.createElement("div");
    line.className = "field loan-payment";
    line.id = "sheetLoanPayment";
    line.innerHTML = "<div class=\"field-head\"><span class=\"field-label\">Monthly payment</span></div>"
      + "<p class=\"loan-payment-value\" aria-live=\"polite\"></p><p class=\"field-help loan-payment-note\"></p>";
    holder.after(line);
    if (loan.now && loan.now.derived) {
      const derived = document.createElement("div");
      derived.className = "field loan-derived";
      derived.id = "sheetLoanDerived";
      derived.innerHTML = "<p class=\"loan-payment-value\" aria-live=\"polite\"></p>";
      line.before(derived);
    }
    refreshLoanPayment();
  }

  // Months as "2 years 6 months", "3 years" or "7 months".
  function yearsMonthsText(months) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    const parts = [];
    if (years) parts.push(years + (years === 1 ? " year" : " years"));
    if (rest || !years) parts.push(rest + (rest === 1 ? " month" : " months"));
    return parts.join(" ");
  }

  // The grey line of a loan defined at purchase: today's balance and the time left, "Paid off", or what is missing.
  function loanDerivedText(now, typing) {
    if (typing) return "—";
    if (now.missing) return "Enter the original amount and start year";
    if (!now.complete) return "—";
    if (!(now.balance > 0) || now.monthsLeft <= 0) return "Paid off";
    return "Today's balance " + fullMoney(now.balance) + ", " + yearsMonthsText(now.monthsLeft) + " left";
  }

  // The open sheet's Monthly payment line read again from its item: "—" while a loan figure is incomplete, also while
  // one of its boxes holds text not stored yet (blank or not a number, `aria-invalid`, see numberInput).
  function refreshLoanPayment() {
    const line = $("sheetLoanPayment");
    if (!line || !sheetOpen) return;
    const item = (getPath(state.inputs, sheetOpen.path) || [])[sheetOpen.position];
    const loan = sheetLoanPayment(sheetOpen.field.type, item, state.info.sheetRules);
    if (!loan) return;
    const itemPath = sheetOpen.path + "." + sheetOpen.position;
    const typing = (LOAN_PAYMENT_AFTER[sheetOpen.field.type] || []).concat("purchasePrice").some((name) => {
      const box = $(fieldId(itemPath + "." + name));
      return box && box.getAttribute("aria-invalid") === "true";
    });
    line.querySelector(".loan-payment-value").textContent = loan.payment == null || typing ? "—"
      : fullMoney(loan.payment);
    const derived = $("sheetLoanDerived");
    if (derived) {
      derived.hidden = !(loan.now && loan.now.derived);
      if (!derived.hidden) derived.querySelector(".loan-payment-value").textContent = loanDerivedText(loan.now, typing);
    }
    line.querySelector(".loan-payment-note").textContent = "Principal and interest"
      + (loan.todaysDollars ? ", in today's dollars" : "")
      + (loan.withCosts == null || typing ? "" : "; " + fullMoney(loan.withCosts) + " with property tax and insurance") + ".";
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
      // Ticked over a rent period, it is refused (one primary residence at a time): the sheet says why, naming the
      // rent periods and the ages they share.
      const homes = getPath(state.inputs, sheetOpen.path);
      const low = state.inputs.you.currentAge;
      const clash = homes[sheetOpen.position].primaryResidence ? primaryClashText(homes[sheetOpen.position],
        state.inputs.rents, low, low + planYears(state.inputs) - 1, state.info.lawTaxYear) : null;
      choosePrimary(homes, sheetOpen.position, state.inputs.rents);
      inputsChanged();
      refreshForm();
      if (clash && sheetOpen) {
        const note = timelineNote(clash, true);
        note.classList.add("primary-refused");
        $("sheetBody").prepend(note);
      }
      return;
    }
    const item = getPath(state.inputs, sheetOpen.path)[sheetOpen.position];
    const cleared = clearedOnChange(sheetOpen.field.type, name, item, state.info.sheetRules);
    if (sheetOpen.field.type === "Account" && name === "kind") {  // the returns follow the kind unless overridden
      Object.assign(cleared, kindReturnsFilled(item, sheetOpen.kind, state.info.usualReturns),
        kindOwnerFilled(item, sheetOpen.kind, state.info.defaultOwners));
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
    // A list inside the open item (a home's loans): its item opens in the same sheet, and closing it goes back here;
    // it gets a session of its own, so its Cancel undoes only its own edits.
    if (sheetOpen && path.startsWith(sheetOpen.path + "." + sheetOpen.position + ".")) {
      sheetParents.push(sheetOpen);
      if (sheetSession && sheetSession.path !== path) {
        sheetSessionParents.push(sheetSession);
        sheetSession = null;
      }
    }
    if (!sheetSession) beginSheetSession(path);  // kept while the sheet redraws or Move up / Move down moves the item
    // The sheet follows the Add detail of the Inputs chip it was opened from (a nested item's, its parent's).
    const paneId = sheetOpen ? sheetOpen.paneId : selectedInputsPane();
    sheetOpen = { field, path, position, filter: filter || null, kind: items[position] && items[position].kind, paneId };
    $("sheetTitle").textContent = (items[position] && items[position].name) || typeWords(field.type);
    const body = $("sheetBody");
    const children = state.schema.types[field.type] || [];
    const layout = sheetFields(field.type, items[position], children, state.info.sheetRules);
    const detail = sheetDetail(field.type, items[position], layout.shown, children, paneId);
    layout.shown = detail.shown;
    const parts = [];
    const intro = sheetIntro(field.type, items[position]);
    if (intro) parts.push(intro);
    let returns = null;
    let ruleBox = null;
    let section = null;
    // The type's titled sections (a child's Daycare and College) follow its other fields, each below a divider.
    const sections = ((state.schema.sheetSections || {})[field.type] || []).map((section) => ({ section, fields: [] }));
    for (const entry of layout.shown) {
      if (field.type === "ExpenseItem" && entry.name === "toAge") continue;  // the year's ages slider has its knob
      const schemaChild = children.find((candidate) => candidate.name === entry.name);
      const label = sheetLabel(field.type, entry.name, items[position], state.info.sheetRules);
      const group = sheetGroup(field.type, entry.name, items[position], state.info.sheetRules);
      const child = { ...schemaChild, ...(label ? { label } : {}), ...(group ? { group } : {}) };
      if (layout.sections && child.group && child.group !== section) {  // a titled section per schema group
        parts.push(sheetHeading(child.group, section === null));
        section = child.group;
      }
      const listFilter = ((state.schema.itemListFilters || {})[field.type] || {})[child.name];  // a home's loans
      const element = fieldElement(child, path + "." + position + "." + child.name, listFilter);
      const noteText = sheetFieldNote(field.type, entry.name, items[position]);  // a 529's deposit stops on its own
      if (noteText) {
        const note = document.createElement("p");
        note.className = "field-help switch-note";
        note.textContent = noteText;
        element.append(note);
      }
      const holder = sections.find((item) => item.section.fields.includes(entry.name));
      if (holder) { holder.fields.push(element); continue; }
      if (entry.group && entry.group.startsWith("replaceRule")) {  // a car's replacement rule: one bordered block
        if (!ruleBox) parts.push(ruleBox = replaceRuleBox());
        placeInReplaceRule(ruleBox, entry.group, element, items[position]);
        continue;
      }
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
    if (field.type === "Account") {  // an IRA's deposit slider, linked to Benefits' Deposit per account
      const deposit = sheetDepositBox(items[position]);
      if (deposit) parts.push(deposit);
    }
    for (const { section, fields } of sections) {
      if (fields.length) parts.push(sheetSection(section, fields));  // a section with every field hidden is not drawn
    }
    body.replaceChildren(...parts);
    placeLoanPayment(field.type, items[position], path + "." + position);
    tintSections(body);
    const detailRow = paneDetailRow(paneId, detail.info);  // Medium: the pane's Add detail, above Remove
    if (detailRow) body.append(detailRow);
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
      if (timelineItemAt(field.type, position)) {  // a home, rent period or car: its neighbours refit to fill its time
        remove.disabled = true;
        clearSelections(path);
        timelineDeleteItem(field.type, position);
        return;
      }
      items.splice(position, 1);
      if (field.type === "Home") ensureOnePrimary(items);  // a removed primary passes to the first home left
      clearSelections(path);
      inputsChanged();
      closeSheet();
    });
    if (!isUnordered(field.type)) actions.append(move(-1, "Move up"), move(1, "Move down"));
    actions.append(remove);
    const onTimeline = sheetTimelineLink(field.type, position);  // a home, rent period or car: its years are there
    if (onTimeline) actions.prepend(onTimeline);
    body.append(actions);
    sheetFootFor(null);
    $("sheet").classList.remove("timeline-sheet");
    $("sheet").hidden = false;
    $("sheetBackdrop").hidden = false;
    $("app").classList.remove("typing");
    // The focus goes to the sheet's title, not its first field, so a phone's keyboard stays shut until a field is
    // tapped; a screen reader still lands in the sheet.
    const title = $("sheetTitle");
    if (!keepFocus) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
    // A sheet opened afresh (also a nested item's, the parent's again and after Move) starts at the top of its body,
    // not where the last sheet was scrolled; a redraw while it is open (keepFocus) keeps the place.
    if (!keepFocus) body.scrollTop = 0;
  }

  // A car's replacement rule on its sheet: a bordered block titled by `carReplaceRuleTitle` holding Replace by, the note
  // that Both replaces at the first rule reached (only while Both is chosen), then each selected rule's figures under
  // its sub-label (`carReplaceRules`); the price and pay figures follow below the block.
  function replaceRuleBox() {
    const group = document.createElement("fieldset");
    group.className = "group replace-rule";
    const legend = document.createElement("legend");
    legend.textContent = state.info.sheetRules.carReplaceRuleTitle;
    group.append(legend);
    return group;
  }

  function placeInReplaceRule(box, group, element, car) {
    const rules = state.info.sheetRules;
    const rule = group.split(".")[1];
    if (!rule) {
      box.append(element);
      if (car && car.replaceBy === "both") {
        const note = document.createElement("p");
        note.className = "field-help replace-rule-note";
        note.textContent = rules.carReplaceBothNote;
        box.append(note);
      }
      return;
    }
    let part = box.querySelector("[data-rule=\"" + rule + "\"]");
    if (!part) {
      part = document.createElement("div");
      part.className = "replace-rule-part";
      part.dataset.rule = rule;
      const label = document.createElement("p");
      label.className = "field-label replace-rule-label";
      label.textContent = rules.carReplaceRules[rule].label;
      part.append(label);
      box.append(part);
    }
    part.append(element);
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

  // The sheet's footer, always in view under the scrolling body: an item sheet's Cancel and Save (#sheetCancel,
  // #sheetDone), or a timeline screen's own Back, Cancel and Save row (`nav`) in their place.
  function sheetFootFor(nav) {
    const foot = $("sheetFoot");
    for (const old of foot.querySelectorAll(".timeline-nav")) old.remove();
    $("sheetFootActions").hidden = Boolean(nav);
    if (nav) foot.append(nav);
  }

  // The on-screen keyboard's height (--keyboard on the root): the part of the window the visual viewport no longer
  // shows at the bottom, so the sheets and dialogs sit above the keyboard with their header and footer in view. Zero
  // while the page is pinch-zoomed.
  function wireKeyboardInset() {
    const view = window.visualViewport;
    if (!view) return;
    const place = () => {
      const inset = view.scale > 1.01 ? 0 : Math.max(0, Math.round(window.innerHeight - view.height - view.offsetTop));
      document.documentElement.style.setProperty("--keyboard", inset + "px");
    };
    view.addEventListener("resize", place);
    view.addEventListener("scroll", place);
    place();
  }

  // Save (#sheetDone): the item sheet's edits already apply as they are made, so it closes the sheet keeping them.
  function saveSheet() {
    closeSheet();
  }

  // Cancel (#sheetCancel), Escape and a tap outside the sheet: the item sheet's edits are undone (a new item is
  // removed) and the sheet closes (a nested item's sheet goes back to its parent's); a timeline screen applies
  // nothing until its Save, so it just closes.
  function cancelSheet() {
    if ($("sheet").hidden) return;
    // A field still being typed in commits on blur: let it commit now, so Cancel undoes it too.
    if ($("sheet").contains(document.activeElement)) document.activeElement.blur();
    endSheetSession(false);
    closeSheet();
  }

  // Close the sheet, keeping its item's edits (see cancelSheet for the other way); an item opened from a list inside
  // another item's sheet (a home's loan) goes back to that sheet unless `all` is true.
  function closeSheet(all) {
    if ($("sheet").hidden) return;
    endSheetSession(true);
    if (all !== true && sheetParents.length) {
      const parent = sheetParents.pop();
      sheetSession = sheetSessionParents.pop() || null;
      sheetOpen = null;
      renderSettings();
      const items = getPath(state.inputs, parent.path);
      if (items && items[parent.position]) {
        const back = sheetReturn;  // focus still returns where the outer sheet was opened from
        openSheet(parent.field, parent.path, parent.position, false, parent.filter);
        sheetReturn = back;
        return;
      }
    }
    sheetParents.length = 0;
    while (sheetSessionParents.length) {  // closing every level keeps every level's edits
      sheetSession = sheetSessionParents.pop();
      endSheetSession(true);
    }
    if (timelineFlow && timelineFlow.notes.length) timelineNotes[timelineFlow.kind] = timelineFlow.notes.slice();
    timelineFlow = null;
    sheetOpen = null;
    $("sheet").hidden = true;
    $("sheet").classList.remove("timeline-sheet");
    sheetFootFor(null);
    $("sheetBackdrop").hidden = true;
    $("app").classList.remove("typing");
    renderSettings();
    if (sheetReturn && document.contains(sheetReturn)) sheetReturn.focus();
  }

  // ---- Ownership timeline: the Home and Cars panes' Timeline block and its workflow in the bottom sheet ----
  // Tapping a bar opens a popover naming the item: a car's has Edit (its edit sheet) and Delete, a home's Open to its
  // edit sheet. The Cars block also has an Add per lane and Add car (another car: a new lane); the workflow (Add, and
  // Edit timeline from an item's sheet) is also reached from the item list.
  // The segments and every edit come from wmti.assets.timeline through the worker (timelineView, timelineApply), so the
  // phone refits and fills exactly as wmti does. Each add or edit is one screen in the words of
  // schema.timeline.flow, with one Save (applies the edit and closes) and one Cancel (closes, applies nothing); its
  // notes, naming every neighbour it changed, show under the block. While an edit is on its way the buttons are disabled.
  const timelineNotes = {};  // by kind: the notes of the last edit, shown once under the block
  const timelineSegmentsShown = {};  // by kind: the segments last drawn, for the Add screen's "Replaces" choice
  let timelinePopover = null;  // the open bar popover: {bar, element, close}
  let timelineFlow = null;   // the open workflow: {kind, step, position, lane, year, history, notes, error, busy, addChoice,
  // atYear (a lane's own Add: a future purchase on that lane at any detail, with no Replaces choice)}

  function timelineWords(kind) {
    return state.schema.timeline.flow[kind];
  }

  // Whether the timeline offers a later purchase, its price and a planned sale (High inputs) for `kind`: at Medium only
  // with its pane's Add detail, or for an `item` that already has one (its values stay editable).
  function timelineLaterShown(kind, item = null) {
    if (item && (item.buysLater || item.sellsLater)) return true;
    const later = (state.schema.types[kind] || []).find((child) => child.name === "buysLater");
    return detailShownFor(kind, later, timelinePane(kind));
  }

  // The Inputs pane of a timeline's kind (Home: home, Car: cars), whose Add detail its screens follow.
  function timelinePane(kind) {
    const panels = state.schema.timeline.panels || {};
    return Object.keys(panels).find((id) => panels[id] === kind) || null;
  }

  // Whether a timeline screen of `kind` draws field `name` of `typeName` (the item's type, or RentPeriod): at Medium a
  // High field waits for the pane's Add detail, as on the sheets; a field not drawn keeps its stored value, and a new
  // item gets the field's default.
  function timelineFieldShown(typeName, name, kind = typeName) {
    const field = (state.schema.types[typeName] || []).find((child) => child.name === name);
    return !field || detailShownFor(typeName, field, timelinePane(kind));
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
    block.className = "group pane timeline summary-only";  // a summary with no inputs: it never folds (25-collapse.js)
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
    timelineSegmentsShown[kind] = reply.segments;
    const parts = [];
    for (const note of timelineNotes[kind] || []) parts.push(timelineNote(note));
    delete timelineNotes[kind];
    // One group per lane: its bar row only. The timeline is a picture: tapping a bar opens a small popover under its
    // row naming the item, with Open to its edit sheet (timelinePopover); the item list stays the way to edit.
    let calculatedShown = false;
    const usedKeys = new Set();  // the Home legend lists only the kinds a bar draws
    for (const row of timelineBars(reply.segments, reply.currentAge, reply.lastAge)) {
      const group = document.createElement("div");
      group.className = "timeline-group";
      group.dataset.lane = String(row.lane);
      const lane = document.createElement("div");
      lane.className = "timeline-lane";
      for (const bar of row.bars) {
        // A gap (no home, no car) is empty time, not an item: a plain stretch, not a button.
        const span = document.createElement(bar.mode === "gap" ? "span" : "button");
        span.className = "timeline-bar" + (bar.isCalculated ? " timeline-calculated" : "");
        span.dataset.mode = bar.mode;
        if (kind === "Home" && bar.mode !== "gap") {
          span.dataset.primary = String(bar.primary);
          if (!bar.isCalculated) usedKeys.add(bar.mode === "rent" ? "rent" : bar.primary ? "primary" : "second");
        }
        if (bar.isCalculated) {  // the Relocation strategy's home or rent: hatched, drawn over the stretch it replaces
          span.dataset.calculated = "true";
          calculatedShown = true;
        }
        span.style.left = bar.left + "%";
        span.style.width = bar.width + "%";
        span.title = bar.text;
        if (bar.mode === "gap") span.setAttribute("aria-hidden", "true");
        else {  // the pointer sits over the part not covered by its calculated replacements
          const shown = bar.calculated.length ? bar.calculated[0].left - bar.left : bar.width;
          timelineBarButton(span, bar.text, bar.left + shown / 2, () => timelinePopoverParts(kind, bar, words),
            false);  // the row's one open hint goes on its last bar, below
        }
        lane.append(span);
        for (const mark of bar.calculated) {  // hatched: worked out from the replacement rule, not entered
          const part = document.createElement("button");
          part.className = "timeline-bar timeline-calculated";
          part.dataset.mode = mark.method === "lease" ? "lease" : "own";
          part.style.left = mark.left + "%";
          part.style.width = mark.width + "%";
          part.title = mark.year + " " + mark.label + ": " + words.calculated;
          const name = words.replacementName.replace("{name}", bar.name);
          // A replacement whose stretch holds the year the commute stops says why the next comes later, or none.
          if (mark.note) part.title += ". " + mark.note;
          timelineBarButton(part, name + ", " + mark.year + " " + mark.label, mark.left + mark.width / 2,
            () => ({ name, role: "Car", years: "From " + mark.year + " (" + mark.label + ")",
              summary: words.calculated + (mark.note ? ". " + mark.note : ""), open: null }), false);
          lane.append(part);
          calculatedShown = true;
        }
      }
      // One open hint per row, at the right end of its last bar.
      const buttons = lane.querySelectorAll("button.timeline-bar");
      if (buttons.length) buttons[buttons.length - 1].append(timelineBarIcon());
      group.append(lane);
      // A car lane is one replacement chain: its own Add puts a car on it at a chosen year, between two cars too
      // (the neighbours refit, wmti.assets.timeline rule 1).
      if (kind === "Car") group.append(timelineAddButton("+ Add car to this timeline", "add-to-lane", row.lane));
      parts.push(group);
    }
    if (kind === "Home" && (usedKeys.size || calculatedShown)) parts.push(timelineHomeLegend(words, usedKeys, calculatedShown));
    else if (calculatedShown) {
      const legend = document.createElement("p");
      legend.className = "field-help timeline-legend";
      legend.innerHTML = "<span class=\"timeline-swatch\" aria-hidden=\"true\"></span>";
      legend.append(document.createTextNode(words.legendCalculated));
      parts.push(legend);
    }
    // Cars: with none yet, Add car; with one or more, Add another car starts a new lane (its own timeline). The item
    // list's Add opens the same screen. Homes are added from the item list.
    if (kind === "Car") {
      const any = reply.segments.some((segment) => segment.position != null);
      parts.push(timelineAddButton(any ? "Add another car" : "Add car", "add-car", null));
    }
    body.replaceChildren(...parts);
  }

  // A Cars timeline Add button: opens the Add screen for lane `lane` (null: a new lane). A lane's Add asks the year
  // the car is bought (a future purchase), so it can go anywhere on the lane.
  function timelineAddButton(text, action, lane) {
    const button = timelineButton(text, action, "button-quiet timeline-add-button");
    button.addEventListener("click", () => {
      closeTimelinePopover(false);
      openTimeline("Car", "add", lane == null ? { lane: null } : { lane, addChoice: "future", atYear: true });
    });
    return button;
  }

  // The Home timeline's legend under the bars: a swatch and its words for the primary residence, a second home, rent
  // and, while the Relocation strategy adds one, the calculated home or rent. The swatches are decoration; the words
  // (and each card's text) carry the meaning.
  function timelineHomeLegend(words, usedKeys, calculatedShown) {
    const legend = document.createElement("ul");
    legend.className = "field-help timeline-legend timeline-legend-home";
    legend.setAttribute("aria-label", "Legend");
    const keys = ["primary", "second", "rent"].filter((key) => usedKeys.has(key)).concat(calculatedShown ? ["calculated"] : []);
    for (const key of keys) {
      const entry = document.createElement("li");
      entry.dataset.swatch = key;
      const swatch = document.createElement("span");
      swatch.className = "timeline-swatch";
      swatch.dataset.swatch = key;
      swatch.setAttribute("aria-hidden", "true");
      entry.append(swatch, document.createTextNode(words.legend[key]));
      legend.append(entry);
    }
    return legend;
  }

  // What a bar's popover says: its name, role, years, a one-line summary and, for an entered item, Open to its sheet
  // (`open` is the item's list and index); the Relocation strategy's home or rent is calculated, with no Open.
  function timelinePopoverParts(kind, bar, words) {
    const role = kind === "Car" ? (bar.mode === "lease" ? "Car, leased" : "Car")
      : bar.mode === "rent" ? words.legend.rent : bar.primary ? words.legend.primary : words.legend.second;
    const years = (bar.startYear == null ? "" : bar.startYear + "-") + (bar.endYear == null ? "open" : bar.endYear);
    const prefix = bar.name + ", ";  // the label starts with the name: the rest is the summary
    const summary = bar.isCalculated ? words.calculated
      : bar.text.startsWith(prefix) ? bar.text.slice(prefix.length) : bar.text;
    const open = !bar.isCalculated && bar.itemList != null && bar.itemIndex != null
      ? { list: bar.itemList, index: bar.itemIndex } : null;
    // A car's popover offers Edit and Delete (`position`, its timeline position); a home's keeps Open.
    const position = kind === "Car" && open && bar.position != null ? bar.position : null;
    return { name: bar.name, role, years, summary, open, kind, position };
  }

  // The hint at a bar's right end that it opens: a finger tap on a touch screen, a mouse pointer with a mouse
  // (styles.css shows the one that fits the pointer and hides both on a bar too narrow for it).
  const TIMELINE_SVG = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\" class=";
  const TIMELINE_TAP_ICON = TIMELINE_SVG + "\"timeline-bar-tap\"><path d=\"M9 13V5.5a1.5 1.5 0 0 1 3 0V11\"/>"
    + "<path d=\"M12 10.5a1.5 1.5 0 0 1 3 0V12\"/><path d=\"M15 11.5a1.5 1.5 0 0 1 3 0V16a5 5 0 0 1-5 5h-1.5"
    + "a5 5 0 0 1-4-2l-2.6-3.4a1.4 1.4 0 0 1 2.1-1.9L9 15\"/></svg>";
  const TIMELINE_CLICK_ICON = TIMELINE_SVG + "\"timeline-bar-click\">"
    + "<path d=\"M6 3l13 7.5-5.5 1.5 3.5 6.5-2.5 1.3-3.5-6.5L6 17.5z\"/></svg>";
  const timelineTouch = () => Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

  function timelineBarIcon() {
    const icon = document.createElement("span");
    icon.className = "timeline-bar-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = TIMELINE_TAP_ICON + TIMELINE_CLICK_ICON;
    return icon;
  }

  // Make a timeline bar a button: its accessible name (with "tap to open" or "click to open"), the open hint at its
  // right end, and a tap (or Enter, Space) toggles its popover under the row, its pointer at `center` (percent of the
  // row) over the bar. `parts()` gives what the popover says; `hint` false leaves the open hint off.
  function timelineBarButton(button, label, center, parts, hint = true) {
    button.type = "button";
    button.setAttribute("aria-label", label + (timelineTouch() ? ", tap to open" : ", click to open"));
    if (hint) button.append(timelineBarIcon());
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      const shown = timelinePopover && timelinePopover.bar === button;
      closeTimelinePopover(false);
      if (!shown) openTimelinePopover(button, center, parts());
    });
  }

  // Close the open popover (X, Escape, a tap outside, Open or a second tap on its bar); `refocus` puts the focus back
  // on its bar.
  function closeTimelinePopover(refocus) {
    if (timelinePopover) timelinePopover.close(refocus);
  }

  function openTimelinePopover(bar, center, parts) {
    const pop = document.createElement("div");
    pop.className = "timeline-popover";
    pop.id = "timeline-popover-" + newHelpId();
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", parts.name);
    pop.style.setProperty("--caret", Math.min(Math.max(center, 4), 96) + "%");  // stays inside the box at the ends
    const head = document.createElement("div");
    head.className = "timeline-popover-head";
    const name = document.createElement("strong");
    name.className = "timeline-popover-name";
    name.textContent = parts.name;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "timeline-popover-close";
    close.dataset.action = "close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg>";
    head.append(name, close);
    const role = document.createElement("p");
    role.className = "timeline-popover-role";
    role.textContent = parts.role + " · " + parts.years;
    const summary = document.createElement("p");
    summary.className = "field-help timeline-popover-summary";
    summary.textContent = parts.summary;
    pop.append(head, role, summary);
    let openButton = null;
    if (parts.open && parts.position != null) {
      // A car: Edit opens its edit sheet; Delete (tap twice) removes it, its lane's neighbours refitting to fill
      // its time.
      const actions = document.createElement("div");
      actions.className = "timeline-popover-actions";
      openButton = timelineButton("Edit", "edit", "button-primary");
      openButton.setAttribute("aria-label", "Edit " + parts.name);
      openButton.addEventListener("click", () => {
        closeTimelinePopover(false);
        openTimelineItem(parts.open.list, parts.open.index);
      });
      const remove = timelineButton("Delete", "delete", "button-danger");
      remove.setAttribute("aria-label", "Delete " + parts.name);
      remove.addEventListener("click", async () => {
        if (remove.dataset.armed !== "true") {
          remove.dataset.armed = "true";
          remove.textContent = "Tap again to delete";
          remove.setAttribute("aria-label", "Tap again to delete " + parts.name);
          return;
        }
        remove.disabled = true;
        closeTimelinePopover(false);
        await timelineDeleteAt(parts.kind, parts.position);
      });
      actions.append(openButton, remove);
      pop.append(actions);
    } else if (parts.open) {
      openButton = timelineButton("Open " + parts.name, "open", "button-primary timeline-popover-open");
      openButton.addEventListener("click", () => {
        closeTimelinePopover(false);
        openTimelineItem(parts.open.list, parts.open.index);
      });
      pop.append(openButton);
    }
    const outside = (event) => {
      if (!pop.contains(event.target) && event.target !== bar) closeTimelinePopover(false);
    };
    const escape = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeTimelinePopover(true);
    };
    const entry = {
      bar, element: pop,
      close(refocus) {
        if (timelinePopover !== entry) return;
        timelinePopover = null;
        document.removeEventListener("click", outside, true);
        document.removeEventListener("keydown", escape, true);
        pop.remove();
        bar.setAttribute("aria-expanded", "false");
        bar.removeAttribute("aria-controls");
        if (refocus && document.contains(bar)) bar.focus();
      },
    };
    timelinePopover = entry;
    close.addEventListener("click", () => closeTimelinePopover(true));
    document.addEventListener("click", outside, true);
    document.addEventListener("keydown", escape, true);
    bar.closest(".timeline-lane").after(pop);  // under the bar row, above the lane's Add
    bar.setAttribute("aria-expanded", "true");
    bar.setAttribute("aria-controls", pop.id);
    (openButton || close).focus({ preventScroll: true });
    pop.scrollIntoView({ block: "nearest" });
  }

  // Open the sheet of item `index` of list `list` (homes, rents or cars), as tapping it in its list does.
  function openTimelineItem(list, index) {
    const item = document.querySelector("#settings-body .items[data-list='" + list + "'] button.item[data-position='"
      + index + "']");
    if (item) item.click();
  }

  // Apply one timeline edit through the worker: on success the inputs take the result (and every pane redraws), on
  // refusal, or when another edit came while it was on its way (inputsTicket), nothing changes.
  // Returns {ok, error, notes, position}.
  async function applyTimeline(kind, op) {
    const current = inputsTicket();
    const reply = await ask("timelineApply", [JSON.stringify(state.inputs), kind, JSON.stringify(op)]);
    if (!current()) return { ok: false, error: "Your plan changed while this step was on its way; try again.", notes: [] };
    if (!reply || !reply.ok) return { ok: false, error: reply ? reply.error : "The step was not applied; try again.", notes: [] };
    state.inputs = reply.inputs;
    inputsChanged();
    return { ok: true, error: null, notes: reply.notes || [], position: reply.position };
  }

  function openTimeline(kind, step, options) {
    if (!sheetOpen && $("sheet").hidden) sheetReturn = document.activeElement;
    sheetOpen = null;
    sheetParents.length = 0;
    timelineFlow = { kind, step, position: null, lane: 0, year: null, history: [], notes: [], error: null, busy: false,
      addChoice: null, atYear: false, ...(options || {}) };
    $("sheetTitle").textContent = "Timeline";
    $("sheet").classList.add("timeline-sheet");
    $("sheet").hidden = false;
    $("sheetBackdrop").hidden = false;
    timelineScreen();
    $("sheetBody").scrollTop = 0;  // at the top of the body, not where the last sheet was scrolled
  }

  function timelineClose() {
    closeSheet(true);  // keeps the workflow's notes for the block (see closeSheet)
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
    if (type !== "check") input.className = "input";  // the app's themed field, not the browser's dark default
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
    const last = first + planYears(state.inputs) - 1;
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

  // The Add screen's optional "Replaces" select for a future purchase (or a lease): "Nothing, a separate item" or an
  // owned item of the kind (homes: on the first lane, as a new home goes there; no rent periods). Choosing one puts the
  // new item in that item's lane and sets the start year (`start`) to its sale year when it has one; the backend's
  // `buy` refits the replaced item to end then. `lane()` is the chosen lane, or `fallback` for a separate item.
  function timelineReplaces(kind, start, chosen, fallback) {
    const segments = (timelineSegmentsShown[kind] || []).filter((segment) => segment.position != null
      && segment.mode === "own" && (kind === "Car" || segment.lane === 0));
    const wrap = document.createElement("label");
    wrap.className = "field timeline-field";
    const caption = document.createElement("span");
    caption.className = "field-label";
    caption.textContent = "Replaces";
    const select = document.createElement("select");
    select.className = "input";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Nothing, a separate item";
    select.append(none);
    for (const segment of segments) {
      const option = document.createElement("option");
      option.value = String(segment.position);
      option.textContent = segment.name;
      select.append(option);
    }
    const help = document.createElement("span");
    help.className = "field-help";
    help.textContent = "The new one starts when this one is sold.";
    const picked = () => segments.find((segment) => String(segment.position) === select.value) || null;
    if (chosen != null && segments.some((segment) => segment.position === chosen)) select.value = String(chosen);
    const sync = () => { help.hidden = !picked(); };
    select.addEventListener("change", () => {
      const segment = picked();
      if (segment && segment.endYear != null) {
        start.input.value = String(segment.endYear);
        start.input.dispatchEvent(new Event("input"));  // the age beside the year follows
      }
      sync();
    });
    sync();
    wrap.append(caption, select, help);
    wrap.hidden = !segments.length;
    wrap.lane = () => (picked() ? picked().lane : fallback);
    wrap.position = () => (picked() ? picked().position : null);
    return wrap;
  }

  // The figures a purchase screen asks: the buying figures and the financing switch with its figures, from the
  // schema (shares as percents), at the item type's defaults. For an item owned now (`owned`): its value today (a car:
  // the price paid and the year bought, labelled as on its sheet, then its value today, empty with the estimate shown
  // gray until a value is entered (`timelineCarValue`); a blank year stays blank) and the
  // financing switch with every financing figure, the balance owed among them. A car asks its How it is paid instead
  // of the switch (`timelinePayMethod`): Cash, Finance (the loan figures show) or Lease (only the lease payment and
  // its hint show; `leased()` is then true and `values()` holds the pay method, the switches and the payment).
  function timelineFigures(kind, owned, initial) {
    const words = timelineWords(kind);
    const fields = state.schema.types[kind];
    const blank = { ...Object.fromEntries(fields.map((field) => [field.name, field.default])), ...(initial || {}) };
    const replaced = state.info.sheetRules.itemSwitchReplaces[kind].buysLater || [];
    const own = (owned ? words.ownedFields : words.purchaseFields.filter((name) => name !== "purchaseAge"))
      .filter((name) => !words.financingFields.includes(name));
    const payChoice = kind === "Car";
    const leaseNames = payChoice ? words.leaseFields : [];
    // At Medium a High figure (a car's price paid, the extra payments) is not asked: the new
    // item takes its default.
    const names = own.concat([words.financingSwitch],
      words.financingFields.filter((name) => owned || !replaced.includes(name)), leaseNames)
      .filter((name) => name === words.financingSwitch || timelineFieldShown(kind, name));
    const inputs = {};
    const elements = names.map((name) => {
      if (payChoice && name === words.financingSwitch) return timelinePayMethod(blank, inputs);
      const field = fields.find((item) => item.name === name);
      const percentUnit = field.unit === "percent";
      const label = kind === "Car" && owned && name === "purchasePrice" ? state.info.sheetRules.carPricePaidLabel
        : field.label;
      const element = field.kind === "toggle" ? timelineInput(label, "check", blank[name])
        : timelineInput(label + (percentUnit ? " (%)" : ""), "number",
          percentUnit ? blank[name] * 100 : blank[name], { min: 0, step: "any" });
      inputs[name] = () => (field.kind === "toggle" ? element.input.checked
        : (percentUnit ? Number(element.input.value) / 100 : Number(element.input.value)));
      if (field.kind === "integer") inputs[name] = () => Math.round(Number(element.input.value));
      if (field.nullable && field.kind !== "toggle") {  // a figure that may be blank (a car's year bought) stays blank
        const read = inputs[name];
        inputs[name] = () => (element.input.value === "" ? null : read());
      }
      return element;
    });
    if (kind === "Car" && owned && names.includes("valueToday")) timelineCarValue(elements, names, blank, inputs);
    let hint = null;
    if (payChoice) {
      hint = document.createElement("p");
      hint.className = "field-help";
      hint.textContent = words.leaseHint;
      elements.push(hint);
    }
    // The financing figures show only while its switch (the mortgage) is ticked, or How it is paid is Finance; a
    // lease shows only the lease payment and its hint.
    const switchElement = elements[names.indexOf(words.financingSwitch)];
    const elementOf = (list) => names.map((name, at) => (list.includes(name) ? elements[at] : null)).filter(Boolean);
    const financing = elementOf(words.financingFields);
    const owning = elementOf(own);
    const leasing = elementOf(leaseNames).concat(hint ? [hint] : []);
    const leased = () => payChoice && switchElement.input.value === "lease";
    const listeners = [];
    const syncFinancing = () => {
      const financed = payChoice ? switchElement.input.value === "finance" : switchElement.input.checked;
      for (const element of financing) element.hidden = !financed;
      for (const element of owning) element.hidden = leased();
      for (const element of leasing) element.hidden = !leased();
      for (const listener of listeners) listener(leased());
    };
    switchElement.input.addEventListener("change", syncFinancing);
    syncFinancing();
    const values = () => {
      const all = Object.fromEntries(Object.entries(inputs).map(([name, read]) => [name, read()]));
      const kept = leased() ? ["payMethod", "hasLoan", "leases", ...leaseNames]
        : Object.keys(all).filter((name) => !leaseNames.includes(name));
      return Object.fromEntries(kept.map((name) => [name, all[name]]));
    };
    // `onPay(listener)`: call `listener(leased)` now and whenever How it is paid changes.
    const onPay = (listener) => {
      listeners.push(listener);
      listener(leased());
    };
    return { elements, values, leased, onPay };
  }

  // A car owned's value today (today's dollars) on the Add screen: empty (read as 0, the estimate) unless a value is set, with the
  // estimate from the price paid and the year bought as its gray placeholder (`carEstimatedValue`), or the prompt
  // `carValue.estimateNone` without a year bought; a value typed overrides it.
  function timelineCarValue(elements, names, blank, inputs) {
    const rules = state.info.sheetRules;
    const value = elements[names.indexOf("valueToday")].input;
    if (!(Number(blank.valueToday) > 0)) value.value = "";
    const sync = () => {
      const read = (name) => (inputs[name] ? inputs[name]() : blank[name]);  // a figure not asked keeps its default
      const estimate = carEstimatedValue({ ...blank, purchasePrice: read("purchasePrice"),
        purchaseYear: read("purchaseYear") }, rules);
      value.placeholder = estimate == null ? rules.carValue.estimateNone : fullMoney(estimate);
    };
    for (const name of ["purchasePrice", "purchaseYear"]) {
      if (names.includes(name)) elements[names.indexOf(name)].input.addEventListener("input", sync);
    }
    sync();
  }

  // A car's How it is paid on the Add screen: Cash, Finance or Lease (the schema's choices and labels), at the draft's
  // choice (`carPaidBy`); it sets the pay method and the Loan and Lease switches (`inputs`), so the three agree, as on
  // the car's sheet.
  function timelinePayMethod(blank, inputs) {
    const field = state.schema.types.Car.find((item) => item.name === "payMethod");
    const wrap = document.createElement("label");
    wrap.className = "field timeline-field";
    const caption = document.createElement("span");
    caption.className = "field-label";
    caption.textContent = field.label;
    const select = document.createElement("select");
    select.className = "input";
    for (const choice of field.choices) {
      const option = document.createElement("option");
      option.value = choice;
      option.textContent = choiceLabel(field, choice);
      select.append(option);
    }
    select.value = carPaidBy(blank);
    wrap.append(caption, select);
    wrap.input = select;
    inputs.payMethod = () => select.value;
    inputs.hasLoan = () => select.value === "finance";
    inputs.leases = () => select.value === "lease";
    return wrap;
  }

  // The State select of a home's or rent period's Add and Edit screens: the field of its sheet (`Home.state` or
  // `RentPeriod.state`: the same label and choices, blank first), at `value`. Picking a state other than the home
  // state shows the move note under it (the timeline's own note names the year once saved). `value()` reads the
  // choice, null for blank.
  function timelineState(type, value) {
    const field = state.schema.types[type].find((item) => item.name === "state");
    const id = "timeline-state-" + newHelpId();
    const wrap = document.createElement("div");
    wrap.className = "field timeline-field timeline-state";
    const caption = document.createElement("label");
    caption.className = "field-label";
    caption.htmlFor = id;
    caption.textContent = field.label;
    const select = document.createElement("select");
    select.className = "input";
    select.id = id;
    select.setAttribute("aria-describedby", id + "-note");
    for (const choice of [null].concat(field.choices)) {
      const option = document.createElement("option");
      option.value = choice == null ? "" : String(choice);
      option.textContent = choiceLabel(field, choice);
      select.append(option);
    }
    select.value = value == null ? "" : String(value);
    const note = document.createElement("span");
    note.className = "field-help timeline-state-note";
    note.id = id + "-note";
    note.setAttribute("aria-live", "polite");
    const sync = () => {
      const chosen = select.value;
      note.hidden = !chosen || chosen === String(state.inputs.homeState || "").toUpperCase();
      note.textContent = timelineWords("Home").stateNote.replace("{state}", chosen);
    };
    select.addEventListener("change", sync);
    sync();
    wrap.append(caption, select, note);
    stateCombobox(select);  // one box that filters the states as you type
    wrap.input = select;
    wrap.value = () => select.value || null;
    return wrap;
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
    let save = null;  // the screen's Save: an async step that applies the edit and closes the sheet once applied
    // The Edit screen is the timeline's own, not the item's sheet: its title says so and a link opens the full sheet.
    const editing = flow.step === "edit" && items[flow.position];
    $("sheetTitle").textContent = editing ? words.editTitle.replace("{name}", items[flow.position].name) : "Timeline";
    if (editing) parts.push(timelineDetailsLink(kind, flow.position, isRent, words));
    if (flow.step === "add") {
      // One screen: first what is added (owned now, a future purchase, or for a home a rent period); then that case's
      // fields below it. A car's lease is chosen by its How it is paid (`timelineFigures`), as on its sheet. Save
      // applies one buy and closes; nothing chains to a second screen.
      // At Medium a future purchase and a planned sale wait for the pane's Add detail (timelineLaterShown).
      const other = kind === "Home" ? "rent" : "lease";
      const later = timelineLaterShown(kind);
      const options = [["owned", words.addOptions.owned]]
        .concat(later || flow.atYear ? [["future", words.addOptions.future]] : [])
        .concat(kind === "Home" ? [[other, "Rent"]] : []);
      const choice = timelineChoice("What are you adding?", options, flow.addChoice || null);
      const holder = document.createElement("div");
      holder.className = "timeline-add";
      let read = null;  // the buy op of the drawn case
      const draw = () => {
        const value = choice.value() || null;
        flow.addChoice = value;
        if (!value) {
          holder.replaceChildren();
          read = null;
          return;
        }
        const kept = flow.addDraft && flow.addDraft.choice === value ? flow.addDraft : {};  // after a refusal
        const yearOf = (age) => (age != null ? timelineYear(age) : null);
        if (value === other) {
          const rent = value === "rent";
          const name = timelineInput(rent ? state.schema.types.RentPeriod.find((field) => field.name === "name").label
            : nameLabel, "text", kept.name || timelineFreeName(kind, rent));
          const start = timelineYearInput(rent ? words.rentStart : words.leaseStart, yearOf(kept.purchaseAge) || flow.year);
          const end = timelineYearInput(rent ? words.rentEnd : words.leaseEnd, yearOf(kept.saleAge), true);
          const monthly = timelineInput(rent ? words.rentQuestion
            : state.schema.types.Car.find((field) => field.name === "leaseMonthly").label, "number",
            kept.monthly != null ? kept.monthly : 0, { min: 0, step: "any" });
          const hint = document.createElement("p");
          hint.className = "field-help";
          hint.textContent = rent ? words.rentHint : words.leaseHint;
          const replaces = rent ? null : timelineReplaces(kind, start, kept.replaces, flow.lane);  // a lease may replace a car
          const where = rent && timelineFieldShown("RentPeriod", "state", kind) ? timelineState("RentPeriod", kept.state)
            : null;
          holder.replaceChildren(...[name, replaces, start, end, monthly, where, hint].filter(Boolean));
          read = () => {
            const endYear = end.input.value === "" ? null : Number(end.input.value);
            const fields = { name: name.input.value, mode: value, purchaseAge: timelineAge(Number(start.input.value)),
              saleAge: endYear == null ? null : timelineAge(endYear) };
            fields[rent ? "monthlyRent" : "leaseMonthly"] = Number(monthly.input.value);
            if (where) fields.state = where.value();
            flow.addDraft = { choice: value, name: fields.name, purchaseAge: fields.purchaseAge, saleAge: fields.saleAge,
              monthly: Number(monthly.input.value), replaces: replaces ? replaces.position() : null,
              state: where ? where.value() : null };
            return { op: "buy", lane: rent ? 0 : replaces.lane(), fields };
          };
          return;
        }
        const owned = value === "owned";
        const name = timelineInput(nameLabel, "text", kept.name || timelineFreeName(kind));
        const start = owned ? null : timelineYearInput(words.purchaseYear, kept.purchaseAge != null
          ? timelineYear(kept.purchaseAge) : flow.year || state.info.lawTaxYear + 1);
        const end = timelineYearInput(words.saleYear + " (optional)", yearOf(kept.saleAge), true);
        const figures = timelineFigures(kind, owned, kept.figures);
        const replaces = owned || flow.atYear ? null : timelineReplaces(kind, start, kept.replaces, flow.lane);
        end.hidden = !later;  // a planned sale (High); a car's lease end stays
        if (kind === "Car") {  // a car leased: the years are the lease's start and end
          const caption = (element) => element.querySelector(".field-label");
          figures.onPay((leased) => {
            if (start) caption(start).textContent = leased ? words.leaseStart : words.purchaseYear;
            caption(end).textContent = leased ? words.leaseEnd : words.saleYear + " (optional)";
            end.hidden = !later && !leased;
          });
        }
        const where = kind === "Home" && timelineFieldShown(kind, "state") ? timelineState("Home", kept.state) : null;
        holder.replaceChildren(...[name, replaces, start, end, where].filter(Boolean), ...figures.elements);
        read = () => {
          const fields = { name: name.input.value, purchaseAge: start ? timelineAge(Number(start.input.value)) : null,
            saleAge: end.hidden || end.input.value === "" ? null : timelineAge(Number(end.input.value)),
            ...figures.values() };
          if (figures.leased && figures.leased()) fields.mode = "lease";
          if (where) fields.state = where.value();
          flow.addDraft = { choice: value, name: fields.name, purchaseAge: fields.purchaseAge, saleAge: fields.saleAge,
            figures: figures.values(), replaces: replaces ? replaces.position() : null,
            state: where ? where.value() : null };  // kept for a refusal's redraw
          return { op: "buy", lane: replaces ? replaces.lane() : flow.lane, fields };
        };
      };
      choice.addEventListener("change", draw);
      draw();
      parts.push(choice, holder);
      save = async () => {
        if (!read) return;
        if (await timelineStep(read())) timelineClose();
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
      const where = timelineFieldShown("RentPeriod", "state", kind) ? timelineState("RentPeriod", period.state) : null;
      const sync = () => {
        startYear.hidden = today.input.checked;
        endYear.hidden = open.input.checked;
      };
      today.input.addEventListener("change", sync);
      open.input.addEventListener("change", sync);
      sync();
      parts.push(...[today, startYear, open, endYear, monthly, where].filter(Boolean));
      save = async () => {
        const fields = { monthlyRent: Number(monthly.input.value),
          purchaseAge: today.input.checked ? null : timelineAge(Number(startYear.input.value)),
          saleAge: open.input.checked ? null : timelineAge(Number(endYear.input.value)) };
        if (where) fields.state = where.value();  // not drawn at Medium: the stored state is kept
        if (await timelineStep({ op: "edit", position: flow.position, fields })) timelineClose();
      };
    } else if (flow.step === "edit") {
      const item = items[flow.position];
      const leased = kind === "Car" && item.leases;
      const currentAge = state.inputs.you.currentAge;
      let ownedNow = null;
      let selling = null;
      let where = null;  // a home's State select
      const startYear = timelineYearInput(leased ? words.leaseStart : words.purchaseYear,
        timelineYear(item.buysLater ? item.purchaseAge : currentAge + 1));
      const endYear = timelineYearInput(leased ? words.leaseEnd : words.saleYear,
        item.sellsLater ? timelineYear(item.saleAge) : (leased ? null : timelineYear(currentAge + 1)), leased);
      const figure = leased ? timelineInput(state.schema.types.Car.find((field) => field.name === "leaseMonthly").label,
        "number", item.leaseMonthly, { min: 0, step: "any" })
        : timelineInput(state.schema.types[kind].find((field) => field.name === "purchasePrice").label, "number",
          item.purchasePrice, { min: 0, step: "any" });
      if (!leased) {
        // At Medium an item owned now without a later purchase or sale keeps those controls behind Add detail.
        const later = timelineLaterShown(kind, item);
        ownedNow = timelineInput(words.ownedNow, "check", !item.buysLater);
        selling = timelineInput("Plan to sell it", "check", item.sellsLater);  // ticked: the sale year shows; unticked: kept
        const sync = () => {
          startYear.hidden = ownedNow.input.checked;
          figure.hidden = ownedNow.input.checked;
          endYear.hidden = !selling.input.checked;
        };
        ownedNow.input.addEventListener("change", sync);
        selling.input.addEventListener("change", sync);
        sync();
        if (later) parts.push(ownedNow, startYear, figure, selling, endYear);
        if (kind === "Home" && timelineFieldShown(kind, "state")) parts.push(where = timelineState("Home", item.state));
      } else {  // a lease running today keeps no start year unless one is given
        ownedNow = timelineInput(words.leasedNow, "check", !item.buysLater);
        const sync = () => { startYear.hidden = ownedNow.input.checked; };
        ownedNow.input.addEventListener("change", sync);
        sync();
        parts.push(ownedNow, startYear, endYear, figure);
      }
      save = async () => {
        const fields = {};
        fields.purchaseAge = ownedNow && ownedNow.input.checked ? null : timelineAge(Number(startYear.input.value));
        fields.saleAge = (selling && !selling.input.checked) || endYear.input.value === "" ? null
          : timelineAge(Number(endYear.input.value));
        if (leased) fields.leaseMonthly = Number(figure.input.value);
        else if (fields.purchaseAge != null) fields.purchasePrice = Number(figure.input.value);
        if (where) fields.state = where.value();
        if (await timelineStep({ op: "edit", position: flow.position, fields })) timelineClose();
      };
    }
    if (flow.error) parts.push(timelineNote(flow.error, true));
    for (const note of flow.notes) parts.push(timelineNote(note));
    const actions = document.createElement("div");
    actions.className = "sheet-actions timeline-nav";
    const back = timelineButton(words.start.back, "back");
    back.disabled = !flow.history.length;
    back.hidden = !flow.history.length;  // every add and edit is one screen, so Back shows only after a step back is possible
    back.addEventListener("click", () => {
      Object.assign(flow, { step: flow.history.pop(), error: null });
      timelineScreen();
    });
    const go = timelineButton("Save", "save", "button-primary");
    go.addEventListener("click", async () => {
      if (flow.busy) return;
      flow.busy = true;
      for (const button of actions.querySelectorAll("button")) button.disabled = true;
      try {
        await save();
      } finally {
        flow.busy = false;
        if (timelineFlow === flow && !$("sheet").hidden && document.contains(go)) {
          for (const button of actions.querySelectorAll("button")) button.disabled = false;
          back.disabled = !flow.history.length;
        }
      }
    });
    // In the sheet's footer: Save applies the edit and closes; Cancel closes with nothing applied.
    const cancel = timelineButton("Cancel", "cancel");
    cancel.addEventListener("click", timelineClose);
    actions.append(back, cancel, go);
    $("sheetBody").replaceChildren(...parts);
    sheetFootFor(actions);
    const first = $("sheetBody").querySelector("input");
    if (first) first.focus({ preventScroll: true });
  }

  // The Edit timeline screen's "Open full car details" (home, rent): closes the screen with nothing applied and opens
  // the item's sheet from its list, as tapping the item there does.
  function timelineDetailsLink(kind, position, isRent, words) {
    const link = timelineButton(isRent ? words.rentDetails : words.details, "details", "button-quiet timeline-details");
    link.addEventListener("click", () => {
      const homes = (state.inputs.homes || []).length;
      const list = kind === "Car" ? "cars" : isRent ? "rents" : "homes";
      const index = isRent ? position - homes : position;
      closeSheet(true);
      openTimelineItem(list, index);
    });
    return link;
  }

  // An item sheet's "Edit on timeline" for a home, rent period or car: closes the sheet and opens the item's Edit
  // timeline screen.
  function sheetTimelineLink(type, position) {
    const item = timelineItemAt(type, position);
    if (!item) return null;
    const link = timelineButton(timelineWords(item.kind).onTimeline, "timeline", "button-quiet sheet-timeline");
    link.addEventListener("click", () => {
      closeSheet(true);
      openTimeline(item.kind, "edit", { position: item.at });
    });
    return link;
  }

  // A sheet's item as the timeline knows it: its kind (Home or Car) and its timeline position (rent periods follow the
  // homes); null for an item type the timeline does not hold.
  function timelineItemAt(type, position) {
    const kind = { Home: "Home", RentPeriod: "Home", Car: "Car" }[type];
    if (!kind) return null;
    return { kind, at: type === "RentPeriod" ? (state.inputs.homes || []).length + position : position };
  }

  // Delete a home, rent period or car from its sheet as the timeline's Delete did: through the worker, so its
  // neighbours refit to fill its time (wmti.assets.timeline rule 3); the notes naming them (or the refusal) show under
  // the block once the sheet closes.
  async function timelineDeleteItem(type, position) {
    const { kind, at } = timelineItemAt(type, position);
    const result = await applyTimeline(kind, { op: "delete", position: at });
    timelineNotes[kind] = result.ok ? result.notes : [result.error];
    closeSheet();
  }

  // Delete the item at timeline position `at` from its bar's popover, the same way: the notes (or the refusal) show
  // under the block, redrawn.
  async function timelineDeleteAt(kind, at) {
    const result = await applyTimeline(kind, { op: "delete", position: at });
    timelineNotes[kind] = result.ok ? result.notes : [result.error];
    renderSettings();
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

  // ---- Final report (PDF): pick saved scenarios to compare, run what is missing, draw the PDF and download it ----
  // The current settings are always the base. Each picked saved scenario runs one Monte Carlo with the same runs and
  // seed; the current settings run only when their Monte Carlo is missing or stale (the result is kept as the
  // Outputs' own). Progress and the outcome show in the dialog; report.js builds and draws the report.
  const reportRun = { busy: false, job: null, cancelled: false };

  function reportNote(text) {
    const note = document.createElement("p");
    note.className = "field-help";
    note.textContent = text;
    return note;
  }

  function reportClosing(text, isError) {
    openDialog({ title: "Final report (PDF)", text: isError ? "" : text,
      actions: [["Close", "button", () => true, "reportClose"]] });
    if (isError) dialogError(text);
  }

  function openReportPicker() {
    if (reportRun.busy) return;
    if (needsSetup(state.inputs) || state.error) {
      reportClosing(state.error ? "Fix the settings first: " + state.error
        : "Finish setup first: fill in your age and the rest under Inputs.", Boolean(state.error));
      return;
    }
    if (state.compare.job || state.optimize.job) {
      reportClosing("Wait for the running comparison or search to finish, then try again.", false);
      return;
    }
    const names = savedNames().filter((name) => name !== state.scenarioName);
    const body = [];
    if (names.length) {
      const list = document.createElement("fieldset");
      list.className = "report-picks";
      list.innerHTML = "<legend class=\"field-help\">Compare with saved scenarios (up to " + report.MAX_SAVED
        + ", one run each)</legend>";
      for (const name of names) {
        const row = document.createElement("label");
        row.className = "report-pick";
        row.innerHTML = "<input type=\"checkbox\"><span></span>";
        row.querySelector("input").value = name;
        row.querySelector("span").textContent = name;
        list.append(row);
      }
      const boxes = [...list.querySelectorAll("input")];
      list.addEventListener("change", () => {
        const full = boxes.filter((box) => box.checked).length >= report.MAX_SAVED;
        boxes.forEach((box) => { box.disabled = full && !box.checked; });
      });
      body.push(list);
    } else {
      body.push(reportNote("No other saved scenarios: the report covers the current settings."));
    }
    openDialog({ title: "Final report (PDF)", text: "Covers " + state.scenarioName + " as set now.", body,
      actions: [CANCEL, ["Create report", "button", () => {
        const picked = [...$("dialogBody").querySelectorAll(".report-pick input:checked")].map((box) => box.value);
        createReport(report.capSelection(picked));
        return false;
      }, "reportCreate"]] });
  }

  // One Monte Carlo for the report: `inputs` with the current runs and seed; the dialog's progress shows `label`.
  async function reportMonteCarlo(inputs, label) {
    const job = engine.job("monteCarlo", [JSON.stringify(inputs), state.mc.runs, state.seed], null, (message) => {
      Object.assign(reportRun.job, { done: message.done, total: message.total, ms: message.ms });
      showProgress("report", reportRun.job);
    });
    reportRun.job = { id: job.id, done: 0, total: state.mc.runs, ms: 0, scenario: label };
    showProgress("report", reportRun.job);
    const reply = await job.promise;
    reportRun.job = null;
    if (!reply) throw new Error(reportRun.cancelled ? "cancelled" : "The run was stopped; try again.");
    if (!reply.value.ok) throw new Error(label + ": " + reply.value.error);
    return reply;
  }

  // A chart as a PNG for the PDF: the SVG drawn on the report's size in the light colors, rasterized at 2x.
  async function reportChartImage(spec) {
    const size = report.IMAGE_SIZE;
    const svg = report.standaloneSvg(charts.renderChart(spec, size));
    if (!svg) return null;
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("could not draw the chart " + spec.title));
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
    const canvas = document.createElement("canvas");
    canvas.width = size.width * 2;
    canvas.height = size.height * 2;
    const context = canvas.getContext("2d");
    context.scale(2, 2);
    context.drawImage(image, 0, 0, size.width, size.height);
    return { dataUrl: canvas.toDataURL("image/png"), width: size.width, height: size.height };
  }

  async function createReport(picked) {
    reportRun.busy = true;
    reportRun.cancelled = false;
    $("dialogText").textContent = "Running and drawing the report. Keep the app open.";
    $("dialogText").hidden = false;
    $("dialogBody").innerHTML = progressHtml("report", { done: 0, total: state.mc.runs });
    $("dialogActions").replaceChildren();
    $("reportCancel").addEventListener("click", () => {
      reportRun.cancelled = true;
      if (reportRun.job) engine.cancel(reportRun.job.id);
    });
    $("reportCancel").focus();
    let outcome;
    const scenario = state.scenarioName;  // stamped at the start, for the run diff (56-accountant.js)
    const seq = ++state.mc.seq;
    try {
      const key = mcKey();
      let current = cachedResult(state.mc.cache, key);
      if (!current) {
        if (state.mc.job) state.mc.job.silent = true;  // one batched job at a time: the report's run replaces it
        clearTimeout(mcTimer);
        const reply = await reportMonteCarlo(state.inputs, state.scenarioName);
        current = { key, value: reply.value, ms: reply.ms, scenario, seq };
        state.mc.cache = rememberResult(state.mc.cache, current);
        state.mc.message = null;
        renderPinned();
        renderMcBar();
        renderResults();
        renderPlots();
      }
      const configs = [];
      for (const name of picked) {
        if (!state.scenarios[name]) continue;
        const reply = await reportMonteCarlo(state.scenarios[name], name);
        configs.push({ name, result: reply.value });
      }
      // The settings each one changes from the current settings, as Compare lists them.
      for (const config of configs) {
        const found = await ask("compareDifferences", [JSON.stringify(state.inputs),
          JSON.stringify(state.scenarios[config.name]), state.scenarioName, config.name]);
        if (found && found.ok) config.differences = found.differences;
        else config.differencesError = found ? found.error : "no answer";
      }
      // Each person's Social Security benefit at the claim age, entered or estimated, for the Social Security table.
      const benefits = await ask("benefitTables", [JSON.stringify(state.inputs)]);
      if ($("reportProgressText")) $("reportProgressText").textContent = "Drawing the PDF";
      const data = report.buildReport({ scenarioName: state.scenarioName, date: new Date(), inputs: state.inputs,
        monteCarlo: current.value, single: state.result, configs, schema: state.schema, rules: state.info.sheetRules,
        benefits });
      const images = {};
      for (const spec of data.plots.map((plot) => plot.spec).concat(data.comparison ? [data.comparison.spec] : [])) {
        const image = await reportChartImage(spec);
        if (image) images[spec.id] = image;
      }
      const doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true });
      report.drawReport(doc, data, images);
      const blob = doc.output("blob");
      outcome = downloadFile(data.filename, blob) ? ["Downloaded " + data.filename + ".", false]
        : ["This browser cannot save files from this page. Open the app in a browser tab and try again.", true];
    } catch (error) {
      const text = String((error && error.message) || error);
      outcome = text === "cancelled" ? ["Report cancelled. Nothing was saved.", false] : ["Report not made: " + text, true];
    } finally {
      reportRun.busy = false;
      reportRun.job = null;
    }
    reportClosing(outcome[0], outcome[1]);
    renderAbout();
    scheduleMc();
  }

  // ---- Setup: scenario files (export, import), reset, about ----
  const downloadsReady = window.claude && window.claude.use ? window.claude.use("downloads").catch(() => null)
    : Promise.resolve(null);

  // The result of an export or import, under the open scenario card, scrolled into view so it is seen also when the
  // action was taken further down the page (an Other scenarios row's menu).
  function showFileMessage(text, isError) {
    const message = $("fileMessage");
    revealSetup();
    message.className = isError ? "banner banner-error" : "banner";
    message.textContent = text;
    if (isError) { stopBannerFade(message); message.hidden = false; } else showFadingBanner(message);  // errors stay
    if (typeof message.scrollIntoView === "function") message.scrollIntoView({ block: "nearest" });
  }

  // Start a real file download of `text` (or a Blob) in the browser (a Blob link). False when the page cannot make one.
  function downloadFile(filename, text) {
    try {
      const url = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type: "application/json" }));
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
  // text opens in a dialog to copy. A message under the card always says what happened. The file carries the
  // scenario's experience block (the open scenario's from state.experience, without the walkthrough's `before`).
  async function exportScenario(inputs = joinExperience(state.inputs, storedExperience(state.experience)),
    name = state.scenarioName) {
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
    const { inputs, experience } = splitExperience(reply.inputs);
    // The file's own effort and style, unless it was saved before the pickers (it keeps the current ones then); when
    // they differ from the current ones the user is asked which to keep, and Cancel leaves everything as it was.
    const block = reply.fromVersion < EXPERIENCE_VERSION ? null : await askExperience(fileName
      ? fileName.replace(/\.json$/i, "") : "Pasted scenario", experience);
    if (block === false) {
      showFileMessage("Import cancelled.", false);
      closeDialog();
      if (walk.open && walk.importing) walk.importing = false;
      return false;
    }
    forgetBlankWalk();
    state.inputs = inputs;
    state.base = clone(state.inputs);
    // Auto-save keeps it at once (resetUndo below), under a free name when another saved scenario has the file's.
    state.scenarioName = importedName(fileName ? fileName.replace(/\.json$/i, "") : "Pasted scenario", reply.inputs,
      state.scenarios, state.autoSaveOff, takenNames());
    // A walkthrough in progress keeps going when the file came from its first step.
    adoptExperience(block, walk.open && walk.importing);
    const upgraded = reply.fromVersion !== reply.inputs.schemaVersion;
    showFileMessage("Opened " + state.scenarioName + "."
      + (upgraded ? " Upgraded to the current format; export to save the new file." : ""), false);
    renderSettings();
    inputsChanged();
    resetUndo();
    renderSaved();
    closeDialog();
    highlightOpenCard();
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
  // a moment), so the caller can offer the paste box instead. It is a guess: iPad Safari's picker sends no focus change
  // and its file arrives later, so `blocked` must leave a pick that is still coming able to finish.
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
  // installed app's offline copy and saved documentation pages (its caches) and its service worker, then reloads, so
  // the page starts as on a first visit (the Terms step included).
  // Both start-over actions are menu items: a first tap changes the item's label (menuLabel) and the menu stays open
  // for the second.
  const menuLabel = (button) => button.querySelector("span") || button;

  async function clearAllData(button) {
    if (button.dataset.armed !== "true") {
      button.dataset.armed = "true";
      menuLabel(button).textContent = "Tap again to delete everything";
      setTimeout(() => {
        button.dataset.armed = "false";
        menuLabel(button).textContent = "Clear all data on this device";
      }, 4000);
      return;
    }
    button.dataset.armed = "false";
    button.disabled = true;
    state.clearing = true;  // store() writes nothing from here on
    for (const key of STORAGE_KEYS) {
      try { localStorage.removeItem(key); } catch (error) { /* storage blocked: nothing kept */ }
    }
    try {
      // This channel's offline copy and saved documentation pages (sw.js) and its own service worker only: the other
      // channel (the stable app at the site root, the beta under beta/) shares the origin and keeps its own.
      if (window.caches) {
        const prefixes = channelCachePrefixes(CHANNEL);
        for (const key of await caches.keys()) {
          if (prefixes.some((prefix) => key.startsWith(prefix))) await caches.delete(key);
        }
      }
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        const ownScope = new URL("./", location.href).href;
        for (const registration of await navigator.serviceWorker.getRegistrations()) {
          if (registration.scope === ownScope) await registration.unregister();
        }
      }
    } catch (error) { /* no offline copy here */ }
    $("clearMessage").textContent = "Everything this app kept on this device is deleted. Reloading.";
    showFadingBanner($("clearMessage"));
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
      menuLabel(button).textContent = "Tap again to replace your settings";
      setTimeout(() => {
        button.dataset.armed = "false";
        menuLabel(button).textContent = "Load example household";
      }, 4000);
      return;
    }
    button.dataset.armed = "false";
    menuLabel(button).textContent = "Load example household";
    closeMenu();
    forgetBlankWalk();
    state.inputs = clone(state.defaults);
    takeHeirsAsLoaded();
    state.base = clone(state.defaults);
    state.scenarioName = EXAMPLE_NAME;
    adoptExperience(null, false);  // the example household has no block: the effort and style stay
    state.exampleHidden = false;
    savePrefs();
    state.seed = state.info.defaultSeed;
    showFileMessage("The example household is loaded.", false);
    renderSettings();
    inputsChanged();
    resetUndo();
    renderSaved();
    highlightOpenCard();
  }

  // The About window: opened from the menu over the page, closed by Close, the backdrop or Escape.
  function openAbout() {
    closeMenu();
    renderAbout();
    $("aboutUpdateStatus").textContent = "";
    $("aboutSheet").hidden = false;
    $("aboutBackdrop").hidden = false;
    $("aboutClose").focus();
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

  // The Legal window: opened from the menu over the page, closed by Close, the backdrop or Escape.
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
    $("legalClose").focus();
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
    $("installClose").focus();
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
      + "<div class=\"sheet-head\"><h2 id=\"installTitle\">Install app</h2></div>"
      + "<div class=\"sheet-body\"><p class=\"field-help\" id=\"installHelp\"></p>"
      + "<p class=\"field-help\">Once added, it opens from your home screen with one tap and works offline.</p></div>"
      + "<div class=\"sheet-foot\"><button type=\"button\" class=\"button\" id=\"installClose\">Close</button></div></div>";
    $("app").append(...sheet.children);
    item.addEventListener("click", installApp);
    $("installClose").addEventListener("click", closeInstallHelp);
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
  // the open scenario's experience block's `walk` (state.experience.walk, saved with saveExperience; `before` stays in
  // the draft on this device, never in a saved copy or a file): {v, tree, status (active, paused, done or skipped),
  // current (a question id, "start", "welcome" or "review"), trail (the screens visited, for Back), opened (questions
  // and optional topics whose deeper questions are open), answers (id to {status, values}), before}. Before the
  // experience block it was kept per device under WALK_KEY, moved into the block once at start-up.
  const WALK_SWAP_MS = 340;  // the overlapping slide and fade between two screens
  const WALK_FLASH_MS = 1000;  // the highlight of a question total that changed
  const WALK_SCREENS = ["start", "welcome", "review"];  // the screens that are not questions
  // The walkthrough's questions are filtered at the scenario's effort (walkthroughPlan): Low asks the Low questions,
  // and its retirement and medical plans open their guided sheets (openGuidedPlan).
  const WALK_GUIDED = { plan401k: "retirement", medicalPlan: "medical" };  // a plan question and its guided sheet
  const walk = { saved: null, index: null, plan: null, open: false, busy: false, pending: null, swap: 0,
    mapReturn: null, importing: false, lastTotal: null, flashTimer: null, unlockFrom: null, fromLow: false,
    branchReturn: null, fromReview: false };

  function walkSave() {
    saveExperience({ walk: walk.saved });  // with storage blocked `walk.saved` still keeps this visit consistent
    gamerTick();  // an answer or the finished walkthrough may earn XP
  }

  // Read the open scenario's walkthrough progress (state.experience.walk). Progress an older page kept per device
  // (WALK_KEY) is moved into the block once, when the block has none, and the key is removed.
  function loadWalk() {
    if (!state.walkTree) return;
    walk.index = walkIndex(state.walkTree);
    walk.unlockFrom = null;
    let saved = state.experience ? state.experience.walk : null;
    const legacy = load(WALK_KEY);
    const moved = !isObject(saved) && isObject(legacy) && legacy.v === 1;
    if (moved) saved = legacy;
    if (!isObject(saved) || saved.v !== 1) {
      walk.saved = null;
    } else {
      const topicIds = state.walkTree.topics.map((topic) => topic.id);
      walk.saved = { ...walkClean(saved, walk.index, topicIds), tree: state.walkTree.version };
    }
    if (state.experience) state.experience.walk = walk.saved;
    if (moved) saveExperience();
    if (legacy !== null) {
      try { localStorage.removeItem(WALK_KEY); } catch (error) { /* storage blocked: nothing kept */ }
    }
  }

  // The effort was raised from `previous`: a walkthrough that exists (not skipped) is offered again as "Continue the
  // walkthrough..." and, when opened, goes to the first question the raise unlocked (firstUnlocked). Lowering the
  // effort keeps every answer.
  function walkEffortRaised(previous) {
    if (!walk.saved || walk.saved.status === "skipped") return;
    walk.unlockFrom = walk.unlockFrom || previous;
    if (walk.saved.status === "done") {
      walk.saved.status = "paused";
      walkSave();
    }
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
    const reply = await ask("walkthroughPlan", [JSON.stringify(state.inputs), JSON.stringify(walk.saved.opened),
      walkEffort()]);
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
    showWalkScreen(walkUnlocked(target), "forward", false);
  }

  // After a raised effort (walk.unlockFrom), the first question the raise unlocked (firstUnlocked); else `target`.
  function walkUnlocked(target) {
    if (!walk.unlockFrom) return target;
    if (walk.unlockFrom === "low") walk.fromLow = true;  // the screens it unlocks say the spending covers them
    const unlocked = firstUnlocked(walkRows(), walk.unlockFrom, state.experience.effort);
    walk.unlockFrom = null;
    return unlocked || target;
  }

  // Close the walkthrough with `status`. `ended` is false for a hand-off to an Inputs page (the walkthrough goes on
  // from its pill); when the first walkthrough ends, the tour opens once the caller has settled the page.
  function closeWalk(status, ended = true) {
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
    if (ended) walk.fromLow = false;
    if (ended && walk.tourAfter) {
      walk.tourAfter = false;
      setTimeout(() => { if (!walk.open) openFirstTour(); }, 0);
    }
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
  // A question's `prompt`, `offer`, `preview` or `choices` (`key`) as the open scenario's effort words it: at Medium
  // its `medium` wording where the tree gives one (the deeper questions cover less there), else its own. A household
  // with no partner reads a question's `singlePrompt` where it has one, and Low effort its `promptLow` (spending).
  function walkText(node, key) {
    if (key === "prompt" && node.promptLow && lowOn()) return node.promptLow;
    if (key === "prompt" && node.singlePrompt && state.inputs && state.inputs.partner == null) return node.singlePrompt;
    const medium = node.medium;
    if (medium && hasOwn(medium, key) && shownExperience().effort === "medium") return medium[key];
    return node[key];
  }

  // The welcome's time estimate by effort.
  const WALK_ESTIMATES = { low: "About 3 minutes", medium: "About 10 minutes",
    high: "As long as you like; stop or skip any time" };

  function walkPreviewHtml(preview) {
    if (!preview || !preview.length) return "";
    return "<ul class=\"walk-preview\">" + preview.map((bullet) => "<li>" + escapeText(bullet) + "</li>").join("")
      + "</ul>";
  }

  // The branch icon of Go deeper and of a deeper question's breadcrumb.
  const BRANCH_ICON = "<svg class=\"walk-branch-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"6\" "
    + "cy=\"5\" r=\"2.2\"/><circle cx=\"6\" cy=\"19\" r=\"2.2\"/><circle cx=\"18\" cy=\"9\" r=\"2.2\"/><path "
    + "d=\"M6 7.2v9.6M18 11.2c0 4-6 3-11 6\"/></svg>";
  const TIER_ORDER = { low: 0, medium: 1, high: 2 };

  // What a Go deeper branch holds, as its button says: "2 more detailed questions" ("Up to" while some depend on the
  // answers), or "Opens the Accounts page in the app" when it only leads to Inputs pages. Questions above the effort
  // are left out, as the plan leaves them out.
  function walkBranchLabel(node) {
    const effort = TIER_ORDER[walkEffort()] ?? 2;
    const found = [];
    const visit = (parent) => {
      for (const child of parent.deeper || []) {
        if ((TIER_ORDER[child.tier] ?? 0) > effort) continue;
        found.push(child);
        visit(child);
      }
    };
    visit(node);
    const pages = found.filter((child) => child.control === "handoff").map((child) => child.handoff.label);
    if (found.length && pages.length === found.length) {
      const names = [...new Set(pages)];
      return "Opens the " + names.join(" and ") + (names.length > 1 ? " pages" : " page") + " in the app";
    }
    const count = found.length;
    return (found.some((child) => child.conditional) ? "Up to " : "") + count + " more detailed question"
      + (count === 1 ? "" : "s");
  }

  // Where a deeper question sits in its branch: {number, total} among the deeper rows right after the main question
  // it branches from, or null for a main question.
  function walkBranchPlace(id) {
    const rows = walkRows();
    const at = rows.findIndex((row) => row.id === id);
    if (at < 0 || !rows[at].depth) return null;
    let root = at;
    while (root > 0 && rows[root].depth > 0) root -= 1;
    let end = root + 1;
    while (end < rows.length && rows[end].depth > 0) end += 1;
    return { number: at - root, total: end - root - 1 };
  }

  function walkBranchEyebrow(text) {
    const eyebrow = walkEyebrow("", "walk-deeper walk-branch-crumb");
    eyebrow.innerHTML = BRANCH_ICON + "<span>" + escapeText(text) + "</span>";
    return eyebrow;
  }

  function walkPreview(preview) {
    const holder = document.createElement("div");
    holder.innerHTML = walkPreviewHtml(preview);
    return holder.firstElementChild;
  }

  // Show a screen: the first step, the welcome, a question or the review. `direction` (forward or back) sets the slide;
  // `animate` false (opening) shows it at once.
  function showWalkScreen(id, direction, animate) {
    if (id !== "start") walk.importing = false;  // a picker left open on the first step no longer imports into it
    if (WALK_SCREENS.includes(id)) walk.fromReview = false;  // Back to summary is offered only on the way back to it
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
      : progress.extra ? "Extra question, " + (progress.topic || "")
      : "Question " + progress.number + " of " + progress.total + ", " + (progress.topic || "");
    bar.setAttribute("aria-valuemax", String(progress.total));
    bar.setAttribute("aria-valuenow", String(id === "review" || progress.extra ? progress.total : progress.number));
    bar.setAttribute("aria-valuetext", where);
    $("walkTopic").textContent = opening ? "Walk me through it" : id === "review" ? "Your plan"
      : progress.topic || "";
    $("walkBack").disabled = opening;
    $("walkMapButton").hidden = opening;
    $("walkLive").textContent = where;
    $("walkCount").hidden = opening || id === "review" || progress.extra;
    $("walkCountNumber").textContent = String(progress.number);
    $("walkCountTotal").textContent = String(progress.total);
    if (walk.lastTotal != null && progress.total !== walk.lastTotal) flashWalkTotal();
    walk.lastTotal = progress.total;
    renderWalkRail(id);
  }

  // The question timeline down the right side: a dot per planned question on the main line, Go deeper questions
  // stepped aside as a branch that rejoins the line at the next main question; the current one highlighted, answered
  // ones filled, skipped ones dimmed. A dot jumps to its question (walkTrailClick), as the Trail does.
  function renderWalkRail(id) {
    const rail = $("walkRail");
    const rows = walkRows();
    rail.hidden = id === "start" || id === "welcome" || !rows.length;
    if (rail.hidden) { rail.replaceChildren(); return; }
    rail.innerHTML = "<ol class=\"walk-rail-list\">" + rows.map((row, at) => {
      const status = walkStatus(walk.saved, row.id, id);
      const label = walkLabel(walk.index[row.id].node);
      const branch = row.depth > 0;
      const edge = branch && !(rows[at - 1] && rows[at - 1].depth > 0) ? " walk-rail-branch-start" : "";
      const end = branch && !(rows[at + 1] && rows[at + 1].depth > 0) ? " walk-rail-branch-end" : "";
      return "<li class=\"walk-rail-item" + (branch ? " walk-rail-branch" : "") + edge + end + "\"><button type=\"button\" "
        + "class=\"walk-rail-dot\" data-jump=\"" + escapeText(row.id) + "\" data-status=\"" + status + "\""
        + (status === "now" ? " aria-current=\"step\"" : "") + " aria-label=\"" + escapeText(label + ": "
        + WALK_TAGS[status] + (branch ? " (Go deeper)" : "")) + "\"><span class=\"walk-rail-mark\" aria-hidden=\"true\">"
        + "</span><span class=\"walk-rail-label\" aria-hidden=\"true\">" + escapeText(label) + "</span></button></li>";
    }).join("") + "</ol>";
    const current = rail.querySelector("[aria-current=step]");
    if (current) current.scrollIntoView({ block: "nearest" });
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

  // The first step: start fresh (the primary button, on to the welcome), or open an existing scenario file (the Setup
  // import's file picker).
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
    const continueButton = walkButton(start.continueLabel, "button walk-primary", null, true);
    continueButton.id = "walkContinue";
    const importButton = walkButton(start.importLabel, "button button-quiet", walkImport);
    importButton.id = "walkImport";
    return { element, actions: [continueButton, importButton] };
  }

  function walkImport() {
    if (walk.busy) return;
    walk.importing = true;
    walkError(null);
    // Only a hint: `walk.importing` stays set, since iPad Safari's picker sends the page no blur and its file arrives
    // after the pause; leaving the first step (showWalkScreen) or closing the walkthrough clears it.
    pickScenarioFile(() => {
      walkError("This browser did not open a file picker. Tap Start fresh, then paste the scenario text under "
        + "Setup, Import.");
    });
  }

  // After an import from the first step: the file is a whole scenario, so every question counts as answered, what
  // Undo my answers puts back is the imported scenario (never the settings it replaced), and the walkthrough closes as
  // finished on the Summary; the menu reopens it on the review.
  async function walkImported() {
    walk.importing = false;
    walk.tourAfter = false;  // an imported scenario is not a first look at the controls
    await walkReplan();
    for (const row of walkRows()) walk.saved.answers[row.id] = { status: "answered", values: null };
    walk.saved.before = clone(state.inputs);
    walk.saved.current = "review";
    walkFinish();
    walkToast("Opened " + state.scenarioName + ".");
  }

  function welcomeScreen() {
    const element = document.createElement("div");
    element.className = "walk-screen";
    element.append(walkEyebrow(WALK_ESTIMATES[shownExperience().effort]), walkHeading("Let's set up your plan"),
      walkParagraph("Each answer starts with your current setting, or an example if you have not entered one. "
        + "Change it to yours and tap Continue. Skip keeps what is shown. You can change anything later.",
        "walk-lede"));
    const start = walkButton("Start", "button walk-primary", null, true);
    const skip = walkButton("Skip for now", "walk-quiet", async () => {
      if (walk.busy) return;
      const hinted = walk.saved.hinted;
      walk.saved.hinted = true;
      walk.busy = true;
      try {
        await lowSkipClear();  // at Low the example's home, cars and loans go, as on a spending answer
      } finally {
        walk.busy = false;
      }
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
    return choiceLabel(field, choice);
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
    if (/(^|\.)socialSecurityAge$/.test(field.path)) {  // the claim age: the Inputs page's one-knob age slider
      const [low, high] = state.info.claimAgeRange.map(Number);
      const pending = { get value() { return walk.pending.values[field.path]; }, set: (age) => walkSet(field.path, age) };
      const slider = oneAgeField({ ...field, help: null }, field.path, low, high, field.label, pending,
        "walk-" + node.id + "-" + index);
      slider.classList.add("walk-age-slider");
      wrap.append(slider);
    } else if (field.kind === "toggle") {
      wrap.append(walkChoices(labelIds, [[true, field.yes || "Yes"], [false, field.no || "No"]], Boolean(current),
        (value) => walkSet(field.path, value)));
    } else if (field.choices && field.choices.length <= 6) {
      const choices = walkText(node, "choices") || field.choices;  // Medium may narrow them (the benefit basis)
      wrap.append(walkChoices(labelIds, choices.map((choice) => [choice, choiceText(field, choice)]), current,
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
      if (options.length > LONG_SELECT_CHOICES) stateCombobox(select);  // the state: one box that filters as you type
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
    if (node.action === "carCosts") return walkCarCosts(node);
    if (node.action === "childAges") return walkChildAges(node);
    const total = walk.plan.facts ? Math.round(walk.plan.facts.monthlySpending) : 0;
    walk.pending.values.total = total;
    // Above Low the number is only what the counted costs (walkCountedTable) leave out.
    const label = lowOn() ? "Monthly spending" : "Everything else, per month";
    return walkNumberBox(node, { kind: "number", unit: "money", label, minimum: 0, maximum: null,
      nullable: false }, "total", total, labelIds, 0);
  }

  // Above Low, the spending question's summary of the monthly costs the plan already counts from the other answers
  // (the rows of the Expenses tab's "Already counted from other tabs" table, settingsNotes `alreadyCounted`), with
  // their total, so the amount asked is only what is left. It reads "Reading your plan" until the notes arrive.
  function walkCountedTable() {
    const box = document.createElement("div");
    box.className = "walk-counted";
    box.id = "walkCounted";
    box.append(walkParagraph("Reading your plan", "walk-lede"));
    fillWalkCounted(box);
    return box;
  }

  async function fillWalkCounted(box) {
    const inputsText = JSON.stringify(state.inputs);
    const reply = await ask("settingsNotes", [inputsText, state.seed], "walkNotes");
    if (!box.isConnected || inputsText !== JSON.stringify(state.inputs)) return;  // left, or a newer edit
    const counted = reply && reply.ok && reply.alreadyCounted;
    if (!counted) {
      box.replaceChildren(walkParagraph("What your plan already counts could not be read; Inputs > Expenses lists it.",
        "walk-lede"));
      return;
    }
    const rows = counted.rows.filter((row) => row.monthly != null);  // the note on the taxes has no amount
    if (!rows.length) {
      box.replaceChildren(walkParagraph("Your other answers add no monthly costs yet.", "walk-lede"));
      return;
    }
    const line = (item, monthly, yearly, strong) => {
      const cell = (value) => "<td>" + (strong ? "<strong>" + fullMoney(value) + "</strong>" : fullMoney(value)) + "</td>";
      return "<tr><th scope=\"row\">" + escapeText(item) + "</th>" + cell(monthly) + cell(yearly) + "</tr>";
    };
    const monthly = rows.reduce((sum, row) => sum + row.monthly, 0);
    const yearly = rows.reduce((sum, row) => sum + row.yearly, 0);
    box.innerHTML = "<p class=\"walk-label\">Already counted from your other answers</p>"
      + "<table class=\"data-table wrap-first counted-table\"><thead><tr><th scope=\"col\">Item</th>"
      + "<th scope=\"col\">Monthly</th><th scope=\"col\">Yearly</th></tr></thead><tbody>"
      + rows.map((row) => line(row.item, row.monthly, row.yearly, false)).join("")
      + line("Already counted", monthly, yearly, true) + "</tbody></table>";
  }

  // Labelled number boxes of one action answer, one per [label, value, field]; `onValue(index, number)` takes each.
  function walkBoxes(node, boxes, onValue) {
    const wrap = document.createElement("div");
    boxes.forEach(([label, value, field], index) => {
      const labelElement = walkParagraph(label, "walk-label");
      labelElement.id = "walkLabel-" + index;
      wrap.append(labelElement, walkNumberBox(node, { ...field, label, nullable: false }, null, value,
        "walkTitle " + labelElement.id, index, (next) => onValue(index, next)));
    });
    return wrap;
  }

  // The cars' value and loans, all together (the backend spreads each over the cars).
  function walkCarCosts(node) {
    const facts = walk.plan.facts || {};
    const answer = { value: Math.round(facts.carValue || 0), loan: Math.round(facts.carLoan || 0) };
    walk.pending.values = { ...answer };
    const money = { kind: "number", unit: "money", minimum: 0, maximum: null };
    const keys = ["value", "loan"];
    return walkBoxes(node, [["Car value", answer.value, money], ["Car loans still owed", answer.loan, money]],
      (index, next) => walkSet(keys[index], next));
  }

  // One age box per child, from your age at each birth; a child you expect has a negative age.
  function walkChildAges(node) {
    const age = state.inputs.you.currentAge;
    const ages = (state.inputs.children || []).map((child) => age - child.yourAgeAtBirth);
    walk.pending.values.ages = ages.slice();
    const field = { kind: "integer", unit: "age", minimum: node.minimum, maximum: age };
    return walkBoxes(node, (state.inputs.children || []).map((child, index) => [child.name || "Child " + (index + 1),
      ages[index], field]), (index, next) => {
      ages[index] = next;
      walkSet("ages", ages.slice());
    });
  }

  // Whether the inputs hold the example household's answer to a question.
  function walkIsExample(node) {
    if (node.action === "partner") return (state.inputs.partner != null) === node.example;
    if (node.action === "carCosts") return sameValue(carTotalsOf(state.inputs, state.info.sheetRules), node.example);
    if (node.action === "childAges") {
      return sameValue((state.inputs.children || []).map((child) => child.yourAgeAtBirth), node.example);
    }
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
    // "Question X of Y" is pinned above the stage (renderWalkTop); a deeper question (a side branch: "Detail 1 of 2 ·
    // returns to main questions"), the first main question after a branch and a question of an optional topic
    // (counted in no total) are marked here.
    const branch = walkBranchPlace(id);
    const returned = walk.branchReturn === id;
    walk.branchReturn = null;
    if (branch) {
      element.classList.add("walk-in-branch");
      element.append(walkBranchEyebrow("Detail " + branch.number + " of " + branch.total + " \u00b7 returns to main "
        + "questions"));
    } else if (returned) {
      element.append(walkEyebrow("Back on the main questions", "walk-branch-back"));
    } else if (walk.index[id].topic.optional) {
      element.append(walkEyebrow("Extra question", "walk-deeper"));
    }
    const head = document.createElement("div");
    head.className = "walk-head";
    head.append(walkHeading(walkText(node, "prompt")));
    const help = node.fields.length === 1 ? node.fields[0].help : null;
    if (help && row.control !== "handoff") {
      const helpId = newHelpId();
      head.insertAdjacentHTML("beforeend", helpButtonHtml(node.fields[0].label, helpId));
      element.append(head);
      element.insertAdjacentHTML("beforeend", helpTextHtml(helpId, help, "walk-help"));
    } else {
      element.append(head);
    }
    const hintSpec = spendingHint(node, walk.plan.facts);  // the Low spending wording, else the question's own
    if (hintSpec && walk.plan.facts) {
      element.append(walkParagraph(walkHint(hintSpec.template, walk.plan.facts), "walk-lede walk-hint"));
    }
    if (walk.fromLow && LOW_RAISE_SCREENS.includes(id)) {  // raised from Low: the spending number still covers these
      element.append(walkParagraph(LOW_RAISE_NOTE, "walk-lede walk-low-note"));
    }
    const actions = [];
    if (row.control === "handoff" && lowOn()) {  // at Low only two accounts of a kind hand off: no Inputs page to open
      element.append(walkParagraph("You have more than one account of a kind. Change them at Medium effort (menu > "
        + "Effort and style...).", "walk-lede"));
      actions.push(walkButton("Continue", "button walk-primary", null, true));
      return { element, actions };
    }
    if (row.control === "handoff") {
      const panel = node.handoff;
      element.append(walkParagraph("This is set on the " + panel.label + " page, where you can see and change every "
        + "row. Your answers so far are kept.", "walk-lede"));
      // Open the page sits beside Continue, as large as Go deeper.
      const pair = document.createElement("div");
      pair.className = "walk-continue-row";
      pair.append(walkButton("Continue", "button walk-primary", null, true),
        walkButton("Open " + panel.label, "button button-quiet walk-deeper-button", () => walkHandoff(panel.panel)));
      actions.push(pair);
      return { element, actions };
    }
    const controls = document.createElement("div");
    controls.className = "walk-controls";
    if (node.action && node.action !== "balances") controls.append(walkAction(node));
    else node.fields.forEach((field, index) => controls.append(walkField(node, field, index)));
    element.append(controls);
    // Under the box, so it stays in view on a phone: what the other answers already count.
    if (id === "spending" && !lowOn()) element.append(walkCountedTable());
    const guided = lowOn() && WALK_GUIDED[id] && walkRead(state.inputs, node.fields[0].path)
      && walk.plan.facts && walk.plan.facts[WALK_GUIDED[id] + "Summary"];
    if (guided) {  // a plan that is on, at Low: its summary, and Change opens its guided sheet
      const summary = document.createElement("div");
      summary.className = "low-summary walk-summary";
      summary.append(walkParagraph(guided, "low-summary-text"));
      const change = walkButton("Change", "button button-quiet", () => walkGuided(id));
      change.id = "walkGuidedChange";
      summary.append(change);
      element.append(summary);
    }
    if (id === "spending" && lowOn() && lowCovered(walk.plan.facts)) {  // items counted on top of the number
      const remove = walkButton("Remove them", "button button-quiet walk-remove", walkRemoveCovered);
      remove.id = "walkRemoveCovered";
      element.append(remove, walkParagraph("or raise effort to Medium to edit them.", "walk-lede walk-remove-note"));
    }
    const hint = element.querySelector(".walk-hint");
    if (hint && hintSpec.fact && !node.action) {
      // A fact hint follows the shown answer as an edit ends (tap elsewhere, a choice, Enter): the facts of the inputs
      // with this answer applied, nothing saved. A shape-changing answer's hint describes what it replaces, so it stays.
      const refresh = () => walkRefreshHint(node, hint);
      controls.addEventListener("change", refresh);
      controls.addEventListener("focusout", refresh);
      controls.addEventListener("click", (event) => { if (event.target.closest(".walk-option")) refresh(); });
    }
    const example = walkParagraph("Example value", "walk-example");
    example.hidden = !walkIsExample(node);
    const error = walkParagraph("", "walk-error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    element.append(example, error);
    const proceed = walkButton("Continue", "button walk-primary", null, true);
    const beside = [];
    if (row.hasDeeper && node.offer && !walk.saved.opened.includes(id)) {
      // Go deeper is a side branch: it sits beside Continue, with a branch icon and what the branch holds (its count of
      // detailed questions, or the page it opens); the preview bullets stay in the question.
      const offer = walkText(node, "offer");
      const preview = walkText(node, "preview");
      const deeper = walkButton("", "button button-quiet walk-deeper-button", walkDeeper);
      deeper.id = "walkDeeper";
      deeper.innerHTML = BRANCH_ICON + "<span class=\"walk-deeper-text\"><span>Go deeper</span><span "
        + "class=\"walk-branch-label\">" + escapeText(walkBranchLabel(node)) + "</span></span>";
      deeper.setAttribute("aria-label", "Go deeper: " + offer);
      beside.push(deeper);
      if (preview && preview.length) {
        element.append(walkParagraph("Go deeper covers:", "walk-preview-title"), walkPreview(preview));
      }
    }
    if (walk.fromReview) {  // opened with Change on the summary: save this answer and go straight back to it
      const back = walkButton("Back to summary", "button button-quiet walk-summary-button", walkBackToSummary);
      back.id = "walkToSummary";
      beside.push(back);
    }
    if (beside.length) {
      const pair = document.createElement("div");
      pair.className = "walk-continue-row";
      pair.append(proceed, ...beside);
      actions.push(pair);
    } else {
      actions.push(proceed);
    }
    const game = walkGameButton(id);
    if (game) element.append(game);
    const quiet = document.createElement("div");
    quiet.className = "walk-quiet-row";
    quiet.append(walkButton("Skip", "walk-quiet", () => walkAnswerAndMove("skip")));
    actions.push(quiet);
    return { element, actions };
  }

  // Gamer: a quiet "Quick game" button on a question that has a mini game (appInfo experience.gameHooks); the game
  // opens over the walkthrough and Close or Escape comes back to this button.
  function walkGameButton(id) {
    const hooks = state.info.experience.gameHooks || {};
    const gameId = hooks[id];
    if (!gameId || !gamerOn() || !GAME_TITLES[gameId]) return null;
    const button = walkButton("Quick game: " + GAME_TITLES[gameId], "button button-quiet walk-game-button", () =>
      openGame(gameId, { who: id === "partnerSsAge" ? "partner" : "you", returnFocus: button }));
    button.id = "walkGame";
    return button;
  }

  // Refill a question's fact hint from the facts of the inputs with the shown (not yet saved) answer applied; an
  // invalid box or a refused answer keeps the sentence, and only the latest of overlapping refreshes is shown.
  let walkHintTurn = 0;
  async function walkRefreshHint(node, hint) {
    const turn = ++walkHintTurn;
    let facts = walk.plan.facts;
    if (walk.pending.touched) {
      if (hint.closest(".walk-screen").querySelector("[aria-invalid=true]")) return;
      const reply = await ask("walkthroughApply", [JSON.stringify(state.inputs), node.id,
        JSON.stringify(walk.pending.values), "answer", walkEffort()]);
      if (!reply || !reply.ok || !reply.facts) return;
      facts = reply.facts;
    }
    if (turn === walkHintTurn && hint.isConnected && facts) hint.textContent = walkHint(node.hint.template, facts);
  }

  // The effort the walkthrough's answers are given at: the open scenario's (High with gamify off).
  function walkEffort() {
    return state.experience && gamifyOn() ? state.experience.effort : "high";
  }

  // Write the current question's answer: `answer` (Continue: the shown values, written only when one was changed; an
  // empty or invalid box is refused) or `skip` (no change). Returns false when it was refused, with the message under
  // the field. At Low the spending question always goes to the backend, which clears what is still the example
  // household's home, cars and loans: Continue on the untouched example number sends that number, and Skip a skip.
  async function walkCommit(mode) {
    if (walk.busy) return false;
    const id = walk.saved.current;
    const row = walkRow(id);
    const lowSpending = id === "spending" && lowOn();
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
        } else if (lowSpending && walk.plan.facts && walk.plan.facts.coveredExample) {
          applyMode = "answer";
          values = { total: Math.round(walk.plan.facts.monthlySpending) };
        }
      }
    }
    walk.busy = true;
    try {
      if (applyMode !== "skip" || lowSpending) {
        const current = inputsTicket();
        const reply = await ask("walkthroughApply", [JSON.stringify(state.inputs), id, JSON.stringify(values),
          applyMode, walkEffort()]);
        if (!reply || !reply.ok || !current()) {  // !current(): an edit came after; this answer would undo it
          walkError(reply && !reply.ok ? reply.error : "The answer was not saved; try again.");
          const field = $("walkStage").querySelector(".walk-screen:last-child input, .walk-screen:last-child select");
          if (field) field.focus();
          return false;
        }
        if (applyMode !== "skip" || (reply.changed && reply.changed.length)) {
          state.inputs = reply.inputs;
          renderSettings();
          inputsChanged();
        }
      }
      walk.saved.answers[id] = { status, values };
      walkSave();
      await walkReplan();
      return true;
    } finally {
      walk.busy = false;
    }
  }

  // Answer and move on; at Low a plan question answered Yes first opens the plan's guided sheet (above the
  // walkthrough).
  async function walkAnswerAndMove(mode) {
    const id = walk.saved.current;
    const following = walkAfter(id);
    if (!(await walkCommit(mode))) return;
    if (mode === "answer" && WALK_GUIDED[id] && lowOn() && walkRead(state.inputs, walk.index[id].node.fields[0].path)) {
      walk.busy = true;
      try {
        await openGuidedPlan(WALK_GUIDED[id]);
        await walkReplan();
      } finally {
        walk.busy = false;
      }
    }
    if (!walk.open) return;
    const target = walkAfter(id, following);
    const from = walkRow(id);
    const to = walkRow(target);
    walk.branchReturn = from && from.depth > 0 && to && !to.depth ? target : null;  // the branch ends: say so
    walkGo(target, "forward");
  }

  // Change on a plan question's summary: the plan's guided sheet, then the same screen with the new summary.
  async function walkGuided(id) {
    if (walk.busy) return;
    walk.busy = true;
    try {
      await openGuidedPlan(WALK_GUIDED[id]);
      await walkReplan();
    } finally {
      walk.busy = false;
    }
    if (walk.open && walk.saved.current === id) showWalkScreen(id, "forward", false);
  }

  // Back to summary, on a question opened from the summary: the answer is saved as Continue saves it, then the
  // summary shows again.
  async function walkBackToSummary() {
    if (!(await walkCommit("answer"))) return;
    if (walk.open) walkGo("review", "forward");
  }

  async function walkDeeper() {
    const id = walk.saved.current;
    if (!(await walkCommit("answer"))) return;
    if (!walk.saved.opened.includes(id)) walk.saved.opened.push(id);
    await walkReplan();
    walkGo(walkAfter(id), "forward");
  }

  // Remove them on the Low spending screen: the homes, rent periods, cars, loans and utilities go (removeCovered),
  // and the screen is drawn again with the new hint.
  async function walkRemoveCovered() {
    if (walk.busy) return;
    walk.busy = true;
    try {
      if (!(await removeCovered())) {
        walkError("They were not removed; try again.");
        return;
      }
      await walkReplan();
    } finally {
      walk.busy = false;
    }
    if (walk.open) showWalkScreen(walk.saved.current, "forward", false);
  }

  // The form's submit (Continue, Enter in a field or a swipe forward): start, answer and move on, or finish; returns
  // the answer's promise so a swipe can tell whether it moved on.
  function walkSubmit() {
    if (walk.busy || !$("walkMap").hidden || !$("walkLeave").hidden) return null;
    const current = walk.saved.current;
    if (current === "start") walkGo("welcome", "forward");
    else if (current === "welcome") walkStart();
    else if (current === "review") walkFinish();
    else return walkAnswerAndMove("answer");
    return null;
  }

  function walkBack() {
    const trail = walk.saved.trail;
    while (trail.length) {
      const id = trail.pop();
      if (WALK_SCREENS.includes(id) || walkRow(id)) { showWalkScreen(id, "back"); return; }
    }
    if (walk.saved.current !== "welcome") showWalkScreen("welcome", "back");
  }

  // A hand-off: leave for an Inputs page (Strategies: Strategy's Strategies view), with a pill to come back to the
  // same question.
  function walkHandoff(panel) {
    closeWalk("paused", false);
    const tab = panel === STRATEGY_PANEL ? "strategy" : "inputs";
    if (tab === "inputs") state.chips.settings = panel;
    renderSettings();
    goToPane(tab);
    scrollPlaceTop(tab);
    $("walkResume").hidden = false;
  }

  // At High, the input path a review row's Open in Inputs opens: a question that writes one field drawn on a page
  // (its list selectors turned into item positions); null otherwise, and at Low and Medium.
  function reviewFieldPath(node) {
    if (shownExperience().effort !== "high" || node.handoff || !node.fields || node.fields.length !== 1) return null;
    const path = walkIndexedPath(state.inputs, node.fields[0].path);
    return path && undonePlaces(path).length ? path : null;
  }

  // A review row's Open in Inputs: the walkthrough pauses (Resume brings it back) and the input opens on its page,
  // through the lever whose first input it is when one names it (jumpToField), else on the first page that draws it.
  function walkOpenField(path) {
    closeWalk("paused", false);
    $("walkResume").hidden = false;
    const lever = surfaceLeverFor(path);
    if (!lever || !jumpToField(lever.id, lever.itemPath)) openInputsField(path);
  }

  function walkFinish() {
    closeWalk("done");
    goTo("outputs", "summary");
  }

  // ---- The Trail (the map of the questions) and the review ----
  function trailHtml(review) {
    const rows = walkRows();
    const facts = walk.plan.facts;
    const questMap = !review && gamerOn();  // Gamer: the Trail reads as a quest map (51-gamer.js)
    return walkTrail(state.walkTree, walk.index, rows, walk.saved, review ? null : walk.saved.current)
      .map((group) => {
        const stage = questMap ? questMapHtml(group) : { className: "", heading: escapeText(group.title) };
        let html = "<li class=\"walk-topic-group" + stage.className + "\"><h3 class=\"eyebrow\">" + stage.heading
          + "</h3>";
        if (group.offer) {
          return html + "<button type=\"button\" class=\"walk-row walk-offer\" data-topic=\"" + escapeText(group.id)
            + "\">+ Go deeper: " + escapeText(group.title) + "</button>"
            + walkPreviewHtml((state.walkTree.topics.find((topic) => topic.id === group.id) || {}).preview) + "</li>";
        }
        html += "<ol class=\"walk-trail-list\">" + group.items.map((item) => {
          const depth = " style=\"--depth:" + item.depth + "\"";
          const node = walk.index[item.id].node;
          if (item.kind === "offer") {
            return "<li" + depth + "><button type=\"button\" class=\"walk-row walk-offer\" data-offer=\""
              + escapeText(item.id) + "\">+ " + escapeText(walkText(node, "offer")) + "</button></li>";
          }
          const label = item.handoff ? walkText(node, "prompt") : item.label;  // a hand-off is labelled by its prompt
          const answer = item.status === "todo" && !review ? "Not yet"
            : answerText(node, state.inputs, facts, state.info.sheetRules);
          // The review leaves out the Answered pill (Skipped and Not yet keep theirs); the Trail shows every tag.
          const tag = review && item.status === "answered" ? ""
            : "<span class=\"walk-tag\" data-status=\"" + item.status + "\">" + WALK_TAGS[item.status] + "</span>";
          const text = "<span class=\"walk-row-text\"><span class=\"walk-row-label\">" + escapeText(label)
            + "</span><span class=\"walk-row-answer\">" + escapeText(answer) + "</span></span>";
          if (review) {
            const field = reviewFieldPath(node);  // High: a question that writes one field opens it on Inputs
            const open = field ? "<button type=\"button\" class=\"walk-change walk-open-field\" data-field=\""
              + escapeText(field) + "\" aria-label=\"Open " + escapeText(label) + " in Inputs\">Open in Inputs</button>"
              : "";
            return "<li class=\"walk-review-row\"" + depth + ">" + text + tag + "<button type=\"button\" "
              + "class=\"walk-change\" data-jump=\"" + escapeText(item.id) + "\" aria-label=\"Change "
              + escapeText(label) + "\">Change</button>" + open + "</li>";
          }
          const mapNode = questMap ? questNode(item) : "";
          return "<li" + depth + mapNode + "><button type=\"button\" class=\"walk-row\" data-jump=\"" + escapeText(item.id) + "\""
            + (item.status === "now" ? " aria-current=\"step\"" : "") + ">" + text + tag + "</button></li>";
        }).join("") + "</ol></li>";
        return html;
      }).join("");
  }

  // The parts the walkthrough does not set in full that still hold the example household's figures: [panel, label,
  // count, unit] each (shared.js exampleLeftoverList).
  function exampleLeftoverItems() {
    return exampleLeftoverList(state.inputs, state.defaults);
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
      walkParagraph("Check your answers, and tap Change to edit one. Go deeper adds extra questions on a topic. "
        + "Finish shows your results.", "walk-lede"));
    const list = document.createElement("ol");
    list.className = "walk-trail";
    list.innerHTML = trailHtml(true) + exampleLeftovers();
    element.append(list);
    if (shownExperience().effort !== "high") {  // below High a raised effort asks more questions
      const raise = walkButton("Change effort", "button button-quiet", walkChangeEffort);
      raise.id = "walkRaiseEffort";
      element.append(walkParagraph("Want more questions? Raise the effort in Effort and style.", "walk-lede"), raise);
    }
    return { element, actions: [walkButton("Finish", "button walk-primary", null, true)] };
  }

  // The Review screen's Change effort: the menu's picker (Cancel keeps everything). A raise goes on to the first
  // question it unlocked (walkEffortRaised, walkUnlocked); a lowered effort redraws the review with its questions.
  async function walkChangeEffort() {
    if (walk.busy) return;
    const before = shownExperience().effort;
    $("app").inert = false;  // the picker is in the page, which the walkthrough keeps inert
    const choice = await openExperiencePicker("settings");
    if (!walk.open) return;
    $("app").inert = true;
    if (!choice || shownExperience().effort === before) return;
    await walkReplan();
    const target = walkUnlocked("review");
    if (target === "review") showWalkScreen("review", "forward", false);
    else walkGo(target, "forward");
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
    const button = event.target.closest("[data-jump], [data-offer], [data-topic], [data-panel], [data-field]");
    if (!button || walk.busy) return;
    closeWalkMap(false);
    if (button.dataset.panel) { walkHandoff(button.dataset.panel); return; }
    if (button.dataset.field) { walkOpenField(button.dataset.field); return; }
    if (button.dataset.jump) {
      if (walk.saved.current === "review") walk.fromReview = true;  // Change on the summary: offer Back to summary
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
    $("walkRail").addEventListener("click", walkTrailClick);
    $("walkClose").addEventListener("click", openWalkLeave);
    $("walkKeep").addEventListener("click", () => closeWalkLeave());
    $("walkLeaveBackdrop").addEventListener("click", () => closeWalkLeave());
    $("walkLater").addEventListener("click", () => closeWalk("paused"));
    $("walkUndo").addEventListener("click", walkUndo);
    $("walkResume").addEventListener("click", openWalk);
    $("menuWalk").addEventListener("click", () => { closeMenu(); openWalk(); });
  }

  // ---- The tour of the controls (the ? button in the top bar) ----
  // One step per control: first the steps on what shows on every page (`fixed`: the bottom bar on a phone or the
  // three columns wide, then the headline strip), so they stay where the tour is; then the main parts, the pages in
  // bottom-bar order (Setup, Inputs, Outputs, Strategy), then the supporting tools: the top bar's Undo ("bar"), the menu's items
  // and the ? button (TOUR_PAGES); on a page top to bottom, left to right (a unit test checks the `fixed` steps come
  // first, then `page` and where `target`, a selector, sits in index.html). `view` is the Outputs or Strategy view a step shows,
  // `when` (optional) whether the step applies now, `opens` the closed section its control sits in and `place`
  // (optional, "top" or "bottom") where the card goes when the half the ring leaves free is not the right one. Before a step elsewhere
  // the tour goes there one hop at a time, all within the step (tourMove: scroll to the control, ring it with one
  // pulse, then hold the ring with a tap badge and "Tap <control> to continue" in the card until the control, the
  // badge or Next is tapped; then slide the page in as a swipe does, open the menu or the section); only then does the
  // step's text show. A step whose control is not drawn is skipped. Done, the close button and Escape put back the
  // tab, view and scroll the tour started from.
  const TOUR_PAGES = ["setup", "inputs", "outputs", "strategy", "bar", "menu", "help"];
  const TOUR_PULSE_MS = 600;  // the ring's one pulse on the control to tap before it holds there
  const TOUR_SCROLL_SPEED = 900;  // px a second the tour scrolls at, so the eye can follow
  const TOUR_SCROLL_MS = [400, 1500];  // the shortest and longest such scroll
  const TOUR_STEPS = [
    { title: "The three columns", page: "setup", fixed: true, when: () => wide.on, target: "#app",
      place: "bottom",  // the ring is the whole screen; the card at the top would cover the headline figures
      text: "Setup is on the left, your settings (Inputs) in the middle and your results (Outputs) on the right. The "
        + "Strategy chip over the results opens your strategies, Compare and Optimize in their place." },
    { title: "Setup, Inputs, Outputs and Strategy", page: "setup", fixed: true, when: () => !wide.on, target: ".tabbar",
      text: "The bar at the bottom moves between the four parts of the app: Setup (your scenarios and runs), Inputs "
        + "(your settings), Outputs (your results) and Strategy (your strategies, Compare and Optimize)." },
    { title: "Headline figures", page: "setup", fixed: true, target: "#pinned",
      text: "These figures sum up your plan: what you are worth today, a typical final worth, and what you earn or "
        + "take out and spend in an average year. They update after every change." },
    { title: "Your scenarios", page: "setup", target: "#scenarioPanel",
      text: "This panel holds the scenario you are working on: rename, duplicate or clear it. Scenario files, "
        + "under it, saves, imports and exports scenarios and opens another one." },
    { title: "Your household", page: "setup", when: () => !lowOn(), target: "#householdCard legend",
      text: "Household holds your partner, your ages, how you file taxes and your home state." },
    { title: "Advanced settings", page: "setup", target: "#advancedSettings", opens: "#advancedSettings",
      text: "Advanced settings hold how every result is worked out: the Inflation-adjusted dollars switch (off shows "
        + "today's dollars), the years to plan for, how many runs (possible futures) sit behind each result, and the "
        + "random seed. The defaults suit most people." },
    { title: "Groups of settings", page: "inputs", when: () => state.schema != null && !lowOn(),
      target: "#chips-settings",
      text: "Your settings are in groups such as Income, Home and Retirement. Tap a group to open it, or slide the "
        + "row sideways to see more." },
    { title: "Pin the groups", page: "inputs", when: () => state.schema != null && !wide.on && !lowOn(),
      target: "#chipsPin",
      text: "The pin keeps the groups under the top bar while you scroll. Tap it to let them scroll away with the page." },
    { title: "Your plan page", page: "inputs", when: () => gamifyOn() && lowOn(), target: "#lowPage",
      text: "At Low effort your settings are one page: about you, pay, spending, savings, children and the "
        + "retirement and medical plans. Every change reruns the plan." },
    { title: "Outputs views", page: "outputs", view: "summary", target: "#views-outputs",
      text: "Tap a view to see the results another way: Summary or Plots." },
    { title: "Summary", page: "outputs", view: "summary", target: "#view-summary",
      text: "Summary shows the results over all the runs: final worth before and after tax with its range, plus "
        + "warnings and opportunities for your plan." },
    { title: "Plots", page: "outputs", view: "plots", target: "#view-plots",
      text: "Plots draws the plan year by year: the total balance over the runs, each account's balance, cash flow, "
        + "deposits and withdrawals, taxes and expenses." },
    { title: "Strategy views", page: "strategy", view: "strategies", target: "#views-strategy",
      text: "Strategy holds your tax strategies, such as Roth conversions and relocation, and two ways to weigh "
        + "choices: Compare and Optimize." },
    { title: "Compare", page: "strategy", view: "compare", target: "#view-compare",
      text: "Compare puts two saved scenarios side by side. With only one so far, go to Setup and tap Duplicate, "
        + "change one thing in the copy, then compare." },
    { title: "Optimize", page: "strategy", view: "optimize", target: "#view-optimize",
      text: "Optimize tries other choices for you, such as when to claim Social Security or which state to retire "
        + "in, and shows what each would be worth. Tick what you would consider, then tap Find best settings." },
    { title: "Undo", page: "bar", target: "#undoButton",
      text: "Undo steps back through your last changes, one at a time. It is greyed out when there is nothing to undo." },
    { title: "Walk me through it", page: "menu", target: "#menuWalk",
      text: "Walk me through it asks one question at a time and fills in your settings. Where a topic has more "
        + "detail, Go deeper adds its extra questions." },
    { title: "Documentation", page: "menu", target: "#menuDocs",
      text: "Documentation opens the user guide, with the tax law and costs of every state." },
    { title: "Appearance", page: "menu", target: "#menuAppearance",
      text: "Appearance picks the app's color scheme." },
    { title: "Final report (PDF)", page: "menu", target: "#menuReport",
      text: "Final report (PDF) makes a printable summary of this plan, with the detailed tables." },
    { title: "This tour", page: "help", target: "#helpButton",
      text: "Tap ? any time to see this tour again." },
  ];
  // `move` is the hop under way on the way to step `pending` (null once the step shows).
  const tour = { steps: [], at: 0, from: null, direction: 1, token: 0, busy: false, skip: null, timers: [],
    relayoutTimer: 0, move: null, pending: 0 };

  const tourTarget = (step) => document.querySelector(step.target);

  // Where a step shows: its tab and Outputs or Strategy view (the menu, ? and a control on every page stay on the page
  // the tour is on), and whether the menu is open.
  function tourPlace(step) {
    if (step.fixed || step.page === "bar" || step.page === "menu" || step.page === "help") {
      return { tab: state.tab, view: placeView(state.tab) || state.view, menu: step.page === "menu" };
    }
    return { tab: step.page, view: step.view || placeView(step.page) || state.view, menu: false };
  }

  // A place's rank along the bottom bar and the Outputs and Strategy views, for the side a page slides in from.
  const tourRank = (tab, view) => TABS.indexOf(tab) * 10
    + (tab === "outputs" ? VIEWS.indexOf(view) : tab === "strategy" ? STRATEGY_VIEWS.indexOf(view) : 0);

  // The panel holding the wide layout's Outputs column now: Strategy or Garden while selected, else Outputs.
  const tourOutputsColumn = () => $(outputsColumnTaken() ? "panel-" + state.tab : "panel-outputs");

  // Run `then` after `ms`, unless the tour has closed or moved on since (its token changed).
  function tourLater(token, ms, then) {
    tour.timers.push(setTimeout(() => { if (token === tour.token && !$("tour").hidden) then(); }, ms));
  }

  // Cancel a move under way: its timers, the press on the ring and any page caught mid-slide.
  function tourStop() {
    for (const timer of tour.timers) clearTimeout(timer);
    tour.timers = [];
    $("tourRing").classList.remove("tour-pulse");
    for (const panel of document.querySelectorAll(".panel.tour-sliding")) {
      panel.classList.remove("tour-sliding");
      slideTo(panel, null, false);
      panel.style.transition = "";
    }
  }

  // The card back from the caption to the step's title and text.
  function tourCaptionOff() {
    tour.busy = false;
    tour.skip = null;
    $("tourNav").hidden = true;
    $("tourNav").textContent = "";
    $("tourTitle").hidden = false;
    $("tourText").hidden = false;
  }

  // Open `to` (a tab and view) at its top, sliding as a swipe does: the shown page out to one side, the new one in
  // from the other (`direction` 1 forward, -1 back); with reduced motion, or in the wide layout when no column changes,
  // it just opens. Then `done`.
  function tourSlide(to, token, done) {
    const direction = tourRank(to.tab, to.view) >= tourRank(state.tab, placeView(state.tab) || state.view) ? 1 : -1;
    const open = () => {
      goTo(to.tab, to.view);
      scrollPlaceTop(to.tab);
    };
    // Wide: the Outputs column slides when its view changes or Strategy comes or goes there.
    const columnMoves = (to.tab === "outputs" || to.tab === "strategy")
      && (to.view !== placeView(to.tab) || (to.tab === "strategy") !== (state.tab === "strategy"));
    const moving = wide.on ? (columnMoves ? tourOutputsColumn() : null) : shownPanel();
    if (!moving || reducedMotion() || tourMs(1) === 0) { open(); done(); return; }
    const width = window.innerWidth;
    moving.classList.add("tour-sliding");
    moving.style.transition = "transform 140ms ease-in";
    moving.style.transform = "translateX(" + (-direction * width) + "px)";
    tourLater(token, 140, () => {
      moving.classList.remove("tour-sliding");
      slideTo(moving, null, false);  // back at rest (hidden when the tab changed)
      moving.style.transition = "";
      open();
      const shown = wide.on ? tourOutputsColumn() : shownPanel();
      shown.classList.add("tour-sliding");
      slideTo(shown, direction * width * 0.35, false);
      void shown.offsetWidth;  // start the slide in from the far side
      slideTo(shown, null, true);
      tourLater(token, BUBBLE_MS, () => {
        shown.classList.remove("tour-sliding");
        shown.style.transition = "";
        done();
      });
    });
  }

  // A tour wait or scroll in ms, scaled by `window.WMTI_TOUR_SPEED` when a test sets it (0: at once).
  function tourMs(ms) {
    const speed = Number(window.WMTI_TOUR_SPEED);
    return window.WMTI_TOUR_SPEED != null && Number.isFinite(speed) && speed >= 0 ? ms * speed : ms;
  }

  // The next control the tour presses on its way to `step`, one hop at a time, or null once there: the bottom tab of
  // another page (the page keeps its Outputs view), then the chip of another Outputs view, the menu button for a
  // step in the menu, or the header of a closed section the step's control sits in (`opens`, Advanced settings); in
  // the wide layout a Setup step first unfolds a folded Setup column from its rail. `go` is the place the hop opens,
  // `menu` that it opens the menu, `section` the section it opens, `unfold` that it unfolds Setup.
  function tourHop(step) {
    const to = tourPlace(step);
    if (step.page === "setup" && !step.fixed && wide.on && setupFold.folded) {
      return { button: $("setupFold"), label: "Setup", unfold: true };
    }
    if (to.tab !== state.tab) {
      return { button: $("tab-" + to.tab), label: $("tab-" + to.tab).textContent.trim(),
        go: { tab: to.tab, view: placeView(to.tab) || state.view } };
    }
    if (to.view !== (placeView(to.tab) || state.view)) {
      return { button: $("sub-" + to.view), label: $("sub-" + to.view).textContent.trim(),
        go: { tab: to.tab, view: to.view } };
    }
    if (to.menu && $("menu").hidden) return { button: $("menuButton"), label: "the menu", menu: true };
    const section = step.opens ? document.querySelector(step.opens) : null;
    if (section && !section.open) {
      const header = section.querySelector("summary");
      return { button: header, label: (header.querySelector(".advanced-head > span") || header).textContent.trim(),
        section };
    }
    return null;
  }

  // Take a hop at once (a skip): the place opened at its top, the menu or the section opened.
  function tourHopNow(hop) {
    if (hop.go) { goTo(hop.go.tab, hop.go.view); scrollPlaceTop(hop.go.tab); }
    if (hop.menu) tourMenu(true);
    if (hop.section) hop.section.open = true;
    if (hop.unfold) foldSetup(false);
  }

  // The caption ("Next: <place>") in the card in place of the step's title and text, while the tour moves; Back and
  // Next then skip to the end of the move (tour.skip). With `title` the step's title stays above it (a hop).
  function tourCaption(text, skip, title) {
    tour.busy = true;
    tour.skip = skip;
    if (title) $("tourTitle").textContent = title;
    $("tourTitle").hidden = !title;
    $("tourText").hidden = true;
    $("tourNav").hidden = false;
    $("tourNav").textContent = text;
  }

  // Move to `step`'s place, then `done`, one hop at a time (tourHop) so the eye can follow, all within the step: the
  // card keeps the step's title and says "Tap <control> to continue" while the page scrolls to the control at a
  // readable pace (tourScrollInto), the ring pulses on it once and then holds there with a tap badge in its corner
  // (tourHold). The tour waits: a tap on the control, on the badge or on Next takes the hop (tourAdvance): the page
  // slides in as a swipe slides it, the menu opens or the section opens, and the next hop starts. Going back
  // (`direction` -1), and a hop whose control is not drawn (the wide layout has no bottom bar), are taken at once. The
  // menu closes for a step outside it.
  function tourMove(step, token, done, direction) {
    if (!tourPlace(step).menu) tourMenu(false);
    let hop = tourHop(step);
    for (let count = 0; hop && (direction < 0 || !tourShown(hop.button)) && count < 5; count += 1) {
      tourHopNow(hop);
      if (!tourPlace(step).menu) tourMenu(false);
      hop = tourHop(step);
    }
    if (!hop) {
      tour.move = null;
      tourTapOff();
      if (tour.busy) tourCaptionOff();
      done();
      return;
    }
    tour.move = { step, token, done, hop, phase: "scroll" };
    tourTapOff();
    tourCaption("Tap " + hop.label + " to continue", null, step.title);
    $("tourRing").hidden = true;
    tourScrollInto(hop.button, token, () => {
      // A chip cut off by its sideways-scrolling row (s421): the row centres it, then the ring holds on all of it.
      const seen = tourVisibleBox(hop.button);
      const box = hop.button.getBoundingClientRect();
      if (seen && seen.left <= box.left + 1 && seen.right >= box.right - 1) { tourHold(tour.move); return; }
      hop.button.scrollIntoView({ block: "nearest", inline: "center", behavior: tourScrollBehavior() });
      tourSettle(hop.button, () => { if (token === tour.token && !$("tour").hidden) tourHold(tour.move); });
    });
  }

  // How the tour scrolls a control sideways into its row: smooth, or at once with reduced motion or at tour speed 0.
  function tourScrollBehavior() {
    return reducedMotion() || tourMs(1) === 0 ? "instant" : "smooth";
  }

  // Ring the control a hop taps with one pulse (none with reduced motion), then hold the ring there with the tap
  // badge until a tap or Next takes the hop; a control that cannot be ringed is tapped at once.
  function tourHold(move) {
    if (!move || move !== tour.move || move.token !== tour.token) return;
    const ring = $("tourRing");
    const seen = tourVisibleBox(move.hop.button);
    if (!move.retried && (!seen || !seen.whole)) {
      move.retried = true;  // the layout changed under the scroll: there (centred in its row), once it has settled
      move.hop.button.scrollIntoView({ block: "nearest", inline: "center", behavior: tourScrollBehavior() });
      tourSettle(move.hop.button, () => tourHold(move));
      return;
    }
    if (!ringOver(move.hop.button)) { tourAdvance(); return; }  // still not drawn after the retry: tapped at once
    move.phase = "held";
    const pulse = !reducedMotion() && tourMs(1) > 0;
    $("tour").style.setProperty("--tour-pulse-ms", (pulse ? tourMs(TOUR_PULSE_MS) : 0) + "ms");
    ring.classList.remove("tour-pulse");
    if (pulse) {
      void ring.offsetWidth;  // the pulse starts afresh on each hop
      ring.classList.add("tour-pulse");
    }
    $("tourTap").hidden = false;
    placeTourTap();
    $("tour").dataset.hop = "held";
  }

  // Take the hop under way: the place slides in, the menu or the section opens, then the next hop (or the step). A
  // second Next while it moves finishes it at once.
  function tourAdvance() {
    const move = tour.move;
    if (!move) return;
    const { step, done, hop } = move;
    const quick = move.phase === "going";
    tourStop();
    tourTapOff();
    const token = ++tour.token;
    move.token = token;
    move.phase = "going";
    const next = () => tourMove(step, token, done, 1);
    if (hop.go && !quick) { tourSlide(hop.go, token, next); return; }
    tourHopNow(hop);
    if (hop.menu && !quick) { tourLater(token, tourMs(BUBBLE_MS), next); return; }  // the menu opens
    requestAnimationFrame(() => { if (token === tour.token) next(); });  // the section has opened
  }

  // The tap badge off and the hop no longer held.
  function tourTapOff() {
    $("tourTap").hidden = true;
    delete $("tour").dataset.hop;
  }

  // The tap badge on a corner of the ring: the top right, or the side and edge with room on the screen.
  function placeTourTap() {
    const ring = $("tourRing");
    const tap = $("tourTap");
    const size = 30;
    const half = size / 2;
    const left = parseFloat(ring.style.left);
    const top = parseFloat(ring.style.top);
    const right = left + parseFloat(ring.style.width);
    const bottom = top + parseFloat(ring.style.height);
    const x = right + half <= window.innerWidth - 4 || left - half < 4 ? right : left;
    const y = top - half >= 4 || bottom + half > window.innerHeight - 4 ? top : bottom;
    tap.style.left = Math.max(4, Math.min(window.innerWidth - 4 - size, x - half)) + "px";
    tap.style.top = Math.max(4, Math.min(window.innerHeight - 4 - size, y - half)) + "px";
  }

  // After a turn of the screen or a resize during a hop: the held ring and badge on its control where it is now, or
  // the hop worked out afresh (scrolled to again) when the new layout moved it or has another control to tap.
  function tourRehold() {
    const move = tour.move;
    if (!move || move.phase === "going" || $("tour").hidden) return;
    const hop = tourHop(move.step);
    if (move.phase === "held" && hop && hop.button === move.hop.button
      && (tourVisibleBox(hop.button) || {}).whole) {
      placeTourRing();
      return;
    }
    tourStop();
    tourMove(move.step, ++tour.token, move.done, 1);
  }

  // The nearest box around `element` that scrolls up and down (a wide layout column), or null for the page.
  function tourScroller(element) {
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
      if (style.position === "fixed") return undefined;  // a fixed bar: nothing to scroll
    }
    return null;
  }

  // Bring `element` to the middle of its scroller (or into it, when taller) at a readable pace, eased, about
  // TOUR_SCROLL_SPEED px a second within TOUR_SCROLL_MS, then `then`; with reduced motion at once. Left as it is when
  // it already shows whole. A tour that closes or moves on stops it (its token changed) without `then`.
  function tourScrollInto(element, token, then) {
    const scroller = tourScroller(element);
    if (scroller === undefined) { then(); return; }
    const page = scroller === null;
    const view = page ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const from = page ? window.scrollY : scroller.scrollTop;
    const room = page ? document.documentElement.scrollHeight - window.innerHeight
      : scroller.scrollHeight - scroller.clientHeight;
    const shows = box.top >= view.top && box.bottom <= view.bottom;
    const middle = box.height < view.bottom - view.top
      ? (box.top + box.bottom) / 2 - (view.top + view.bottom) / 2 : box.top - view.top - 8;
    const goal = Math.round(Math.max(0, Math.min(room, from + middle)));
    const set = (y) => { if (page) window.scrollTo(0, y); else scroller.scrollTop = y; };
    const distance = Math.abs(goal - from);
    if (shows || distance < 2) { then(); return; }
    const duration = tourMs(Math.min(TOUR_SCROLL_MS[1], Math.max(TOUR_SCROLL_MS[0], distance / TOUR_SCROLL_SPEED * 1000)));
    if (reducedMotion() || duration === 0) { set(goal); then(); return; }
    const start = performance.now();
    const frame = (now) => {
      if (token !== tour.token || $("tour").hidden) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;  // ease in and out
      set(Math.round(from + (goal - from) * eased));
      if (t < 1) requestAnimationFrame(frame);
      else then();
    };
    requestAnimationFrame(frame);
  }

  function tourShown(element) {
    return element != null && element.getClientRects().length > 0;
  }

  // The part of a control the eye can see: its box cut to the window and to every box that clips it on the way up
  // (a sideways chips row, a wide layout column), stopping at a fixed box; null when nothing of it shows.
  function tourVisibleBox(element) {
    const box = element.getBoundingClientRect();
    let left = Math.max(0, box.left);
    let top = Math.max(0, box.top);
    let right = Math.min(window.innerWidth, box.right);
    let bottom = Math.min(window.innerHeight, box.bottom);
    for (let node = element; node && node !== document.body && node !== document.documentElement;
      node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node !== element && (style.overflowX !== "visible" || style.overflowY !== "visible")) {
        const clip = node.getBoundingClientRect();
        left = Math.max(left, clip.left);
        top = Math.max(top, clip.top);
        right = Math.min(right, clip.right);
        bottom = Math.min(bottom, clip.bottom);
      }
      if (style.position === "fixed") break;
    }
    if (right - left < 1 || bottom - top < 1) return null;
    return { left, top, right, bottom, whole: left <= box.left + 1 && right >= box.right - 1
      && top <= box.top + 1 && bottom >= box.bottom - 1, box };
  }

  // Call `done` once a control's box, the window's size and the layout (phone or wide) have held still for a few frames
  // (a scroll or a turn of the screen has settled), or after about a second.
  function tourSettle(target, done) {
    let last = "";
    let still = 0;
    let frames = 0;
    const tick = () => {
      const box = target.getBoundingClientRect();
      const key = [box.left, box.top, box.width, box.height, window.innerWidth, window.innerHeight, wide.on].join(",");
      still = key === last ? still + 1 : 0;
      last = key;
      frames += 1;
      if (still >= 2 || frames > 60) done();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Bring the shown step's control into view (the page, its column and its chips row), wait for the scroll to settle,
  // then place the ring; a control still not visible is skipped in the tour's direction rather than ringed over nothing.
  // A control further down the page is scrolled to at a readable pace (tourScrollInto) while the card says "Next:
  // <step>" and no ring shows, so the step's ring and text come once it is there; `instant` (a resize or a turn of
  // the screen) jumps there instead.
  function tourFocusTarget(instant) {
    if ($("tour").hidden || tour.busy) return;  // a move to another page places the ring itself
    const token = ++tour.token;
    delete $("tour").dataset.ready;
    const step = tour.steps[tour.at];
    const target = step && tourTarget(step);
    if (target) revealPanels(target);  // a folded panel opens first
    if (!tourShown(target) || (step.when && !step.when())) {
      showTourStep(tour.at + tour.direction, tour.direction);
      return;
    }
    const seen = tourVisibleBox(target);
    const box = target.getBoundingClientRect();
    const across = !seen || seen.left > box.left + 1 || seen.right < box.right - 1;
    const down = !seen || seen.top > box.top + 1 || seen.bottom < box.bottom - 1;
    const ring = () => {
      if (across || (down && instant === true)) {
        target.scrollIntoView({ block: down ? "center" : "nearest", inline: across ? "center" : "nearest" });
      }
      placeTourRing();  // where it shows now; placed again once any scroll has settled
      tourSettle(target, () => {
        if (token !== tour.token || $("tour").hidden) return;
        if (!tourVisibleBox(target)) { showTourStep(tour.at + tour.direction, tour.direction); return; }
        placeTourRing();
        $("tour").dataset.ready = "true";
      });
    };
    if (!down || instant === true || tourScroller(target) === undefined) { ring(); return; }
    $("tourRing").hidden = true;
    tourCaption("Next: " + step.title, () => {  // skip: there at once
      tour.token += 1;
      tourCaptionOff();
      target.scrollIntoView({ block: "center", inline: "nearest" });
      tourFocusTarget(true);
    });
    tourScrollInto(target, token, () => {
      tourCaptionOff();
      ring();
    });
  }

  // After a resize, a turn of the screen or a switch between the phone and wide layouts: place the ring now, and again
  // once the turn has finished (TOUR_RELAYOUT_MS after the last such event). A turn reports its size in steps and the
  // wide layout's class follows the resize (its media query listener runs after the resize handlers), so a ring
  // measured only at the first event can stay where the control was in the old layout: a corner of the new one.
  const TOUR_RELAYOUT_MS = 350;
  function tourRelayout() {
    if ($("tour").hidden) return;
    if (tour.move) {
      tourRehold();
      clearTimeout(tour.relayoutTimer);
      tour.relayoutTimer = setTimeout(tourRehold, TOUR_RELAYOUT_MS);
      return;
    }
    tourFocusTarget(true);
    clearTimeout(tour.relayoutTimer);
    tour.relayoutTimer = setTimeout(() => tourFocusTarget(true), TOUR_RELAYOUT_MS);
  }

  function openTour() {
    if (!$("tour").hidden) return;
    tour.steps = TOUR_STEPS.filter((step) => !step.when || step.when());
    tour.from = { tab: state.tab, view: state.view, strategyView: state.strategyView, scroll: window.scrollY,
      advanced: $("advancedSettings").open };
    $("tour").hidden = false;
    $("app").inert = true;
    $("helpButton").setAttribute("aria-expanded", "true");
    showTourStep(0, 1);
    $("tourCard").focus();
  }

  // Whether the tour has opened by itself on this device; blocked storage reads as not yet.
  function tourSeen() {
    try { return localStorage.getItem(TOUR_KEY) === "seen"; } catch (error) { return false; }
  }

  // The tour after the first walkthrough: once per device (without storage it may show again on a later first visit).
  function openFirstTour() {
    try { localStorage.setItem(TOUR_KEY, "seen"); } catch (error) { /* storage blocked */ }
    openTour();
  }

  // The menu, shown or hidden for the tour's steps that point into it (no focus change; the tour card keeps focus).
  function tourMenu(open) {
    if (!open && $("menu").hidden) return;
    if (open) { markScheme(); closeAppearance(); }
    $("menu").hidden = !open;
    $("menuBackdrop").hidden = !open;
    $("menuButton").setAttribute("aria-expanded", String(open));
  }

  function closeTour() {
    if ($("tour").hidden) return;
    tour.token += 1;  // a move under way stops here
    clearTimeout(tour.relayoutTimer);
    tourStop();
    tour.move = null;
    tourTapOff();
    tourCaptionOff();
    $("tourRing").hidden = false;
    delete $("tour").dataset.ready;
    tourMenu(false);
    $("tour").hidden = true;
    $("app").inert = false;
    $("helpButton").setAttribute("aria-expanded", "false");
    const from = tour.from;
    if (from && (from.tab !== state.tab || from.view !== state.view || from.strategyView !== state.strategyView)) {
      if (from.tab === "setup") revealSetup();
      state.tab = from.tab;  // the tab and both views back as they were (goTo sets one view)
      state.view = from.view;
      state.strategyView = from.strategyView;
      showPlace();
      savePrefs();
    }
    if (from) centerSwipedChips();  // each chips row back on its selected chip
    if (from) $("advancedSettings").open = from.advanced;  // shut again when the tour opened it
    if (from) window.scrollTo(0, from.scroll);
    $("helpButton").focus();
  }

  // Show step `at` once its page shows, or the next one in `direction` (1 or -1) whose control is drawn; past either
  // end the tour closes.
  function showTourStep(at, direction) {
    if (at < 0 && tour.at >= 0 && direction < 0) { showTourStep(tour.at, 1); return; }  // nothing drawn before it
    if (at < 0 || at >= tour.steps.length) { closeTour(); return; }
    const token = ++tour.token;
    tourStop();
    tour.move = null;
    tourTapOff();
    delete $("tour").dataset.ready;
    tour.pending = at;
    $("tourCount").textContent = (at + 1) + " of " + tour.steps.length;
    $("tourBack").disabled = at === 0;
    const step = tour.steps[at];
    if (step.when && !step.when()) { showTourStep(at + direction, direction); return; }  // no longer applies (a turn)
    tourMove(step, token, () => {
      if (step.page === "setup" && !step.fixed) revealSetup();
      if (!tourShown(tourTarget(step))) { showTourStep(at + direction, direction); return; }
      tour.at = at;
      tour.direction = direction;
      $("tourCount").textContent = (at + 1) + " of " + tour.steps.length;
      $("tourTitle").textContent = step.title;
      $("tourText").textContent = step.text;
      $("tourBack").disabled = at === 0;
      $("tourNext").textContent = at === tour.steps.length - 1 ? "Done" : "Next";
      tourFocusTarget();
    }, direction);
  }

  // The ring over the visible part of the shown control (kept inside the screen), and the card on the half of the
  // screen it leaves free; left alone while a move to another page holds it on the button pressed.
  function placeTourRing() {
    if ($("tour").hidden) return;
    if (tour.move && tour.move.phase === "held") {
      if (ringOver(tour.move.hop.button)) placeTourTap();
      return;
    }
    if (tour.busy) return;
    const step = tour.steps[tour.at];
    const target = step && tourTarget(step);
    if (tourShown(target)) ringOver(target, step.place);
  }

  // Put the ring over the visible part of `element`; false (the ring left as it is) when nothing of it shows. The
  // card goes to `place` when given, else to the half of the screen the ring leaves free.
  function ringOver(element, place) {
    const box = tourVisibleBox(element);
    if (!box) return false;
    const pad = 6;
    const top = Math.max(4, box.top - pad);
    const bottom = Math.min(window.innerHeight - 4, box.bottom + pad);
    const left = Math.max(4, box.left - pad);
    const right = Math.min(window.innerWidth - 4, box.right + pad);
    const ring = $("tourRing");
    ring.style.top = top + "px";
    ring.style.left = left + "px";
    ring.style.width = Math.max(0, right - left) + "px";
    ring.style.height = Math.max(0, bottom - top) + "px";
    ring.hidden = false;
    $("tourCard").dataset.place = place || ((top + bottom) / 2 < window.innerHeight / 2 ? "bottom" : "top");
    return true;
  }

  function wireTour() {
    $("helpButton").setAttribute("aria-expanded", "false");
    $("helpButton").addEventListener("click", openTour);
    $("tourClose").addEventListener("click", closeTour);
    // A held hop: a tap on its control (under the ring) or on the tap badge takes it, as Next does.
    $("tour").addEventListener("click", (event) => {
      const move = tour.move;
      if (!move || move.phase !== "held" || $("tourCard").contains(event.target)) return;
      const ring = $("tourRing").getBoundingClientRect();
      const onRing = event.clientX >= ring.left && event.clientX <= ring.right && event.clientY >= ring.top
        && event.clientY <= ring.bottom;
      if (onRing || $("tourTap").contains(event.target)) tourAdvance();
    });
    // During a hop Next takes it and Back goes to the step before; during a scroll to the step's control either skips
    // to its end and shows the step (tour.skip); pressed again they move on.
    const skipped = () => {
      if (!tour.busy) return false;
      if (tour.skip) tour.skip();
      return true;
    };
    $("tourBack").addEventListener("click", () => {
      if (tour.move) { if (tour.pending > 0) showTourStep(tour.pending - 1, -1); return; }
      if (!skipped()) showTourStep(tour.at - 1, -1);
    });
    $("tourNext").addEventListener("click", () => {
      if (tour.move) { tourAdvance(); return; }
      if (skipped()) return;
      if (tour.at >= tour.steps.length - 1) closeTour();
      else showTourStep(tour.at + 1, 1);
    });
    // Ahead of the page's own Escape handling (capture), so Escape closes only the tour, wherever the focus is.
    document.addEventListener("keydown", (event) => {
      if ($("tour").hidden) return;
      if (event.key === "Escape") { event.stopPropagation(); closeTour(); return; }
      if (event.key === "Tab" && !$("tourCard").contains(document.activeElement)) {
        event.preventDefault();
        $("tourNext").focus();
        return;
      }
      trapFocus(event, $("tourCard"));
    }, true);
    // A turned or resized screen: bring the control back in view and ring it again where it is now.
    window.addEventListener("resize", tourRelayout);
    window.addEventListener("orientationchange", tourRelayout);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", tourRelayout);
    window.addEventListener("scroll", placeTourRing, { passive: true });
    document.addEventListener("scroll", placeTourRing, { passive: true, capture: true });  // a wide layout column
  }

  // ---- Wiring ----
  function wire() {
    for (const tab of document.querySelectorAll(".tab")) {
      tab.addEventListener("click", () => selectTabFresh(tab.dataset.tab));
    }
    for (const tab of document.querySelectorAll(".view-tab")) {
      tab.insertAdjacentHTML("afterbegin", iconSvg(VIEW_ICONS[tab.dataset.view], "chip-icon"));
      tab.addEventListener("click", () => selectView(tab.dataset.view));
    }
    $("views-outputs").chipBubble = makeBubble("viewBubbleFill");
    $("views-outputs").append($("views-outputs").chipBubble);
    $("views-strategy").chipBubble = makeBubble("strategyBubbleFill");
    $("views-strategy").append($("views-strategy").chipBubble);
    wireTabKeys(document.querySelector(".tabbar"), ".tab:not([hidden])", (tab) => selectTabFresh(tab.dataset.tab));
    wireTabKeys($("views-outputs"), ".view-tab:not([hidden])", (tab) => selectView(tab.dataset.view));
    wireTabKeys($("views-strategy"), ".view-tab:not([hidden])", (tab) => selectView(tab.dataset.view));
    document.addEventListener("focusin", (event) => $("app").classList.toggle("typing", isTyping(event.target)));
    document.addEventListener("focusout", () => $("app").classList.remove("typing"));
    document.addEventListener("keyup", enterEndsEdit);
    wireHoldSliders();
    document.addEventListener("click", (event) => {
      const button = event.target.closest(".help-button");
      if (button) toggleHelp(button);
    });
    $("settings-body").addEventListener("submit", (event) => event.preventDefault());
    $("strategy-body").addEventListener("submit", (event) => event.preventDefault());
    $("household-body").addEventListener("submit", (event) => event.preventDefault());
    $("sheetDone").addEventListener("click", saveSheet);
    $("sheetCancel").addEventListener("click", cancelSheet);
    $("sheetBackdrop").addEventListener("click", cancelSheet);
    $("sheetBody").addEventListener("input", refreshLoanPayment);  // a car's or home's Monthly payment, live
    wireKeyboardInset();
    wireCollapse();
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!$("rowMenu").hidden) { closeRowMenu(); return; }
      if (!$("dialog").hidden) { closeDialog(); return; }
      if (gameEscape()) return;  // a mini game over the walkthrough closes alone
      if (experienceEscape()) return;
      if (walkEscape()) return;
      closeMenu();
      closeAbout();
      closeLegal();
      closeInstallHelp();
      cancelSheet();
    });
    $("menuButton").addEventListener("click", openMenu);
    $("menuBackdrop").addEventListener("click", closeMenu);
    $("undoButton").addEventListener("click", undoLast);
    $("menuAbout").addEventListener("click", openAbout);
    $("menuReport").addEventListener("click", () => { closeMenu(); openReportPicker(); });
    document.addEventListener("click", (event) => { if (event.target.closest(".open-report")) openReportPicker(); });
    $("aboutCheck").addEventListener("click", checkForUpdates);
    $("aboutClose").addEventListener("click", closeAbout);
    $("aboutBackdrop").addEventListener("click", closeAbout);
    $("menuLegal").addEventListener("click", openLegal);
    $("legalClose").addEventListener("click", closeLegal);
    $("legalBackdrop").addEventListener("click", closeLegal);
    $("legalDocs").addEventListener("click", showLegalDocument);
    $("menuAppearance").addEventListener("click", toggleAppearance);
    for (const button of document.querySelectorAll(".scheme")) {
      button.addEventListener("click", () => setScheme(button.dataset.scheme));
    }
    $("menuHelpButton").addEventListener("click", () => toggleHelp($("menuHelpButton")));
    wireInstall();
    wireWalk();
    wireExperience();
    wireGamer();
    wireGames();
    document.addEventListener("visibilitychange", coachVisibilityChanged);
    markScheme();
    wireWide();
    wireTabsPin();
    wirePanelsSwipe();
    wireWalkSwipe();
    wireTour();
    const placeBubbles = () => {
      placeBubble($("chips-settings"), false);
      placeBubble($("views-outputs"), false);
      placeBubble($("views-strategy"), false);
    };
    window.addEventListener("resize", placeBubbles);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeBubbles);
    // A face fetched later (the selected chip's bolder label) moves the chips too; so may a page shown again.
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", placeBubbles);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) placeBubbles(); });
    $("saveButton").addEventListener("click", saveButtonPressed);
    $("autoSave").addEventListener("click", toggleAutoSave);
    // Setup's Advanced settings (the Run card): shut on every start (the tests open it with WMTI_ADVANCED_OPEN); open
    // or shut holds for the visit only.
    $("advancedSettings").open = window.WMTI_ADVANCED_OPEN === true;
    $("renameButton").addEventListener("click", () => renameDialog(state.scenarioName));
    $("duplicateButton").addEventListener("click", duplicateOpen);
    $("clearButton").addEventListener("click", clearDialog);
    $("exportButton").addEventListener("click", () => exportScenario());
    $("newButton").addEventListener("click", newDialog);
    $("importButton").addEventListener("click", importDialog);
    $("dialog").addEventListener("keydown", (event) => trapFocus(event, $("dialog")));
    $("dialogBackdrop").addEventListener("click", () => closeDialog());
    // A headline chip with a plot opens it (renderPinned, openPinPlot).
    $("pinned").addEventListener("click", (event) => {
      const chip = event.target.closest(".pin-button");
      if (chip) openPinPlot(chip.dataset.plot);
    });
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
    $("channelBadge").hidden = !isBetaChannel(CHANNEL);  // the beta app says so in the top bar
  }

  // ---- Documentation (menu) and the "See this state's rules" links ----
  // Both open the user documentation in a new tab. Its address comes from the build (window.WMTI_BUILD.docs, set by
  // build.py from DOCS_LOCATIONS): the Pages build's docs/ folder, where a state's own law page can be linked, or the
  // docs artifact of the artifact build, which every link opens at its home.
  function docsUrl(page) {
    return docsLink((window.WMTI_BUILD || {}).docs, page);
  }

  // A small link under a state select to the chosen state's law page (the home state's when the select is blank); in
  // the artifact build, which can only open the docs home, it says "Open the documentation" (stateRulesText).
  function stateRulesLink(select) {
    const link = document.createElement("a");
    link.className = "state-rules-link";
    link.textContent = stateRulesText((window.WMTI_BUILD || {}).docs);
    link.target = "_blank";
    link.rel = "noopener";
    const point = () => {
      const code = select.value || (state.inputs && state.inputs.homeState) || "";
      link.href = docsUrl(code ? "law/" + String(code).toLowerCase() + ".html" : "law/index.html");
    };
    point();
    select.addEventListener("change", point);
    link.addEventListener("click", point);  // before the browser follows it, so it names the state shown now
    return link;
  }

  function wireDocs() {
    $("menuDocs").href = docsUrl("index.html");
    $("menuDocs").addEventListener("click", closeMenu);
  }

  renderBootSteps();
  wire();
  wireDocs();
  startTerms();
  engine.start();
})();

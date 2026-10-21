// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// Runs all Python for the page: boots the self-hosted Pyodide, loads numpy and pandas, unpacks wmti and answers
// calls to wmti.dashboard.web. Messages in: {id, fn, args, lane}; a newer request in the same lane replaces a
// queued older one, which is answered {kind: "dropped"}. Messages out: {kind: "step"} while booting, {kind: "ready"},
// then {id, kind: "result" | "error" | "progress" | "dropped"}. A Monte Carlo ("monteCarlo") or a comparison
// ("compare") runs in time-sized batches; the worker yields to its message queue between calls and between batches,
// so a newer request or a cancel ({fn: "cancel", target}) is seen within one batch. One batched job runs at a time; a
// new one replaces the old, which is answered "dropped". A strategy search ("optimize") is batched too; a finish
// ({fn: "finish", target}) stops it and keeps the best so far, which the next batch posts as its result. A search
// paused at its run budget (its progress `capped`) waits for {fn: "answerCap", target, more}: true continues with
// another budget of runs, false ends it with the best so far. A search's progress carries its `checkpoint` (JSON text
// that a new search started with it resumes from) at most every CHECKPOINT_MS, at its run budget and when it pauses,
// since the page stores no more often; {fn: "pause", target} holds it after its batch (the page went to the
// background; the paused time is not counted) until {fn: "resume", target}.
"use strict";

// The host refuses .whl and .zip files, so they are published as *_whl.wasm / *_zip.wasm with unchanged bytes.
// Pyodide asks for the real names from its lock file; map those fetches to the published names.
const realFetch = self.fetch.bind(self);
self.fetch = (input, init) => {
  if (typeof input !== "string" && !(input instanceof URL)) return realFetch(input, init);
  return realFetch(String(input).replace(/\.(whl|zip)$/, "_$1.wasm"), init);
};

const WEB_FUNCTIONS = new Set(["appInfo", "settingsSchema", "defaultInputs", "checkInputs", "applySettings",
  "setPartner", "syncRollover", "importScenario", "exportScenario", "runSingle", "runTables", "runFrames", "rebalanceSurplus",
  "settingsNotes", "compareVariants", "benefitTables", "earningsPreview", "depositSliders", "moveDeposit",
  "matchProblems", "compareDifferences", "mergeCompareDifference",
  "walkthroughTree", "walkthroughPlan", "walkthroughApply", "timelineView", "timelineApply", "optimizeInfo",
  "optimizeAvailability", "applyOptimum"]);
// Batched jobs: the wmti.dashboard.web function that starts one, given the job's arguments.
const BATCHED = { monteCarlo: "startMonteCarlo", compare: "startCompare", optimize: "startOptimize" };
const MODEL_FILE = "wmti.a6d04f7b64.wasm";  // the build gives it a content-hashed name
const CHECKPOINT_MS = 5000;  // a search's checkpoint is serialized at most this often while it runs
const queue = [];
let pyodide = null;
let web = null;
let batched = null;
let pumping = false;

const post = (message) => self.postMessage(message);
const yieldToMessages = () => new Promise((resolve) => setTimeout(resolve, 0));
const errorText = (error) => String((error && error.message) || error).slice(-2000);

async function step(key, label, work) {
  post({ kind: "step", key, label, status: "wait" });
  const started = performance.now();
  try {
    const detail = await work();
    post({ kind: "step", key, label, status: "done", ms: Math.round(performance.now() - started) });
    return detail;
  } catch (error) {
    post({ kind: "step", key, label, status: "fail", error: errorText(error) });
    throw error;
  }
}

async function boot() {
  const base = new URL("pyodide/", self.location.href).href;
  const started = performance.now();
  try {
    await step("script", "Loading the calculator", () => importScripts(base + "pyodide.js"));
    await step("boot", "Starting up", async () => { pyodide = await loadPyodide({ indexURL: base }); });
    await step("packages", "Installing libraries", () =>
      pyodide.loadPackage(["numpy", "pandas"], { messageCallback: () => {} }));
    await step("imports", "Importing libraries", () => pyodide.runPython("import numpy, pandas"));
    await step("model", "Loading the retirement model", async () => {
      const response = await realFetch(MODEL_FILE);
      if (!response.ok) throw new Error(MODEL_FILE + ": HTTP " + response.status);
      pyodide.unpackArchive(await response.arrayBuffer(), "zip", { extractDir: "/wmti" });
      pyodide.runPython("import sys\nsys.path.insert(0, '/wmti/backend')\nfrom wmti.dashboard import web");
      web = pyodide.globals.get("web");
    });
    const startup = await step("startup", "Reading your settings and the example household", () => ({
      info: JSON.parse(web.appInfo()), schema: JSON.parse(web.settingsSchema()),
      defaults: JSON.parse(web.defaultInputs()), walkthrough: JSON.parse(web.walkthroughTree()),
    }));
    post({ kind: "ready", ...startup, bootMs: Math.round(performance.now() - started),
      pyodideVersion: pyodide.version });
    pump();
  } catch (error) {
    post({ kind: "failed", error: errorText(error) });
  }
}

function callWeb(job) {
  if (!WEB_FUNCTIONS.has(job.fn)) throw new Error("unknown call " + job.fn);
  const started = performance.now();
  const text = web[job.fn](...(job.args || []));
  return { value: JSON.parse(text), ms: Math.round(performance.now() - started) };
}

function startBatched(job) {
  batched = { id: job.id, fn: job.fn, batches: web[BATCHED[job.fn]](...job.args), started: performance.now() };
}

function stopBatched(reply) {
  if (!batched) return;
  if (reply) post({ id: batched.id, kind: "dropped" });
  batched.batches.destroy();
  batched = null;
}

function advanceBatched() {
  const job = batched;
  const progress = JSON.parse(job.batches.advance());
  if (!progress.ok) {
    post({ id: job.id, kind: "error", error: progress.error });
    stopBatched(false);
  } else if (progress.finished) {
    const value = JSON.parse(job.batches.result());
    post({ id: job.id, kind: "result", value, ms: Math.round(performance.now() - job.started) });
    stopBatched(false);
    pyodide.runPython("import gc\ngc.collect()");
  } else {
    job.waiting = Boolean(progress.capped);
    job.progress = progress;
    const due = job.fn === "optimize"
      && (progress.capped || performance.now() - (job.checkpointAt || 0) >= CHECKPOINT_MS);
    postProgress(job, due);
  }
}

// Post a batched job's latest progress; with `withCheckpoint`, a search's checkpoint too.
function postProgress(job, withCheckpoint) {
  const progress = job.progress;
  if (withCheckpoint) job.checkpointAt = performance.now();
  post({ id: job.id, kind: "progress", done: progress.done, total: progress.total, scenario: progress.scenario,
    detail: progress.detail, ms: Math.round(performance.now() - job.started),
    checkpoint: withCheckpoint ? job.batches.checkpoint() : undefined });
}

async function pump() {
  if (pumping || !web) return;
  pumping = true;
  while (queue.length || (batched && !batched.waiting && !batched.paused)) {
    let currentId = batched && batched.id;
    try {
      if (queue.length) {
        const job = queue.shift();
        currentId = job.id;
        if (BATCHED[job.fn]) startBatched(job);
        else post({ id: job.id, kind: "result", ...callWeb(job) });
      } else {
        advanceBatched();
      }
    } catch (error) {
      if (batched && batched.id === currentId) stopBatched(false);
      post({ id: currentId, kind: "error", error: errorText(error) });
    }
    await yieldToMessages();
  }
  pumping = false;
}

self.onmessage = (event) => {
  const job = event.data;
  if (job.fn === "cancel") {
    if (batched && batched.id === job.target) stopBatched(true);
    for (let position = queue.length - 1; position >= 0; position -= 1) {
      if (queue[position].id === job.target) post({ id: queue.splice(position, 1)[0].id, kind: "dropped" });
    }
    return;
  }
  if (job.fn === "finish" || job.fn === "answerCap") {
    if (!batched || batched.id !== job.target) return;
    if (job.fn === "finish") batched.batches.stop();
    else batched.batches.answerCap(Boolean(job.more));
    batched.waiting = false;
    pump();
    return;
  }
  if (job.fn === "pause" || job.fn === "resume") {
    if (!batched || batched.id !== job.target || batched.fn !== "optimize") return;
    batched.paused = job.fn === "pause";
    if (batched.paused) {
      batched.batches.pause();
      if (batched.progress) postProgress(batched, true);  // the page keeps the search as it pauses
    } else {
      batched.batches.resume();
    }
    pump();
    return;
  }
  if (job.lane) {
    for (let position = queue.length - 1; position >= 0; position -= 1) {
      if (queue[position].lane === job.lane) post({ id: queue.splice(position, 1)[0].id, kind: "dropped" });
    }
  }
  if (BATCHED[job.fn]) {
    stopBatched(true);
    for (let position = queue.length - 1; position >= 0; position -= 1) {
      if (BATCHED[queue[position].fn]) post({ id: queue.splice(position, 1)[0].id, kind: "dropped" });
    }
  }
  queue.push(job);
  pump();
};

boot();

// Copyright (c) 2026 [BRAND NAME], Walk Me Through It (WMTI) ([PUBLIC REPOSITORY URL]). PolyForm Noncommercial License 1.0.0; see LICENSE.
// Draws the chart specs that wmti.dashboard.web returns as inline SVG, with a legend, a text summary, a table view
// and a tap or hover readout. renderChart and renderTable return markup strings (they also run in Node for the
// tests); attachChart adds the readout in the browser. Series colors come from the spec's palette slot through the
// page's --s0..--s7 tokens, so dark mode can use its own steps of the same slots.
(function (root) {
  "use strict";

  const shared = typeof module !== "undefined" && module.exports ? require("./shared.js") : root.WmtiShared;
  const { escapeText, tickMoney, formatValue, percent } = shared;

  const TYPES = ["stackedArea", "lines", "stackedBars", "barsAndLine", "histogram", "bands", "compareBands", "boxes"];
  const BASE_SIZE = { width: 360, height: 220 };  // the viewBox of a chart in its card
  const FULL_MAX_WIDTH = 960;  // the widest viewBox full screen draws
  const MARGIN = { top: 12, right: 14, bottom: 28, left: 50 };
  // The viewBox the chart being drawn uses: the card's own size, or a wider one while full screen (see `sized`).
  let WIDTH = BASE_SIZE.width;
  let HEIGHT = BASE_SIZE.height;
  let PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
  let PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
  const BAR_GAP = 2;
  const MAX_BAR = 24;
  // The after-tax step of a compared balance: room kept right of the last year, how far past it the first marker sits
  // and how far apart the configs' markers sit.
  const AFTER_TAX = { room: 24, out: 9, stagger: 7 };

  const color = (series) => "var(--s" + (series.slot % 8) + ", " + series.color + ")";
  const number = (value) => (value == null || !isFinite(value) ? 0 : value);
  const round = (value) => Math.round(value * 10) / 10;

  function niceStep(span, count) {
    const raw = span / Math.max(count, 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const fraction = raw / magnitude;
    return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * magnitude;
  }

  // Rounded tick values covering [low, high]; a flat range becomes [0, 1] so the axis still has a scale.
  function niceTicks(low, high, count) {
    if (!(high > low)) {
      if (low === 0 && high === 0) return [0, 1];
      low = Math.min(low, 0);
      high = Math.max(high, 0) || 1;
    }
    const step = niceStep(high - low, count);
    const ticks = [];
    const first = Math.floor(low / step);
    for (let index = first; ; index += 1) {
      const tick = index * step;
      ticks.push(Math.abs(tick) < step * 1e-9 ? 0 : tick);
      if (tick >= high - step * 1e-9) break;
    }
    return ticks;
  }

  function linear(domainLow, domainHigh, rangeLow, rangeHigh) {
    const span = domainHigh - domainLow || 1;
    return (value) => rangeLow + ((value - domainLow) / span) * (rangeHigh - rangeLow);
  }

  function tickText(value, unit) {
    if (unit === "money") return tickMoney(value);
    if (unit === "percent") return percent(value, 0);
    return String(Math.round(value * 100) / 100);
  }

  function seriesOf(spec, mark) {
    return spec.series.filter((series) => !mark || series.mark === mark);
  }

  // A series shown for records only (`counted: false`, such as the sales tax already in the expenses): drawn hatched
  // above its stack, never added to a stack's height or a total.
  const counted = (series) => series.counted !== false;
  const RECORDS_HELP = "Already in expenses, shown for records; not added to any total.";

  // The hatch fill of a records series: a pattern in the series color on the page's hatch background.
  function hatchId(spec, series) {
    return "hatch-" + String(spec.id).replace(/[^A-Za-z0-9_-]/g, "") + "-" + series.slot;
  }

  function hatchPattern(spec, series) {
    return "<pattern id=\"" + hatchId(spec, series) + "\" patternUnits=\"userSpaceOnUse\" width=\"6\" height=\"6\" "
      + "patternTransform=\"rotate(45)\"><rect class=\"hatch-bg\" width=\"6\" height=\"6\" fill=\"var(--hatch-bg, #ffffff)\">"
      + "</rect><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"6\" stroke=\"" + color(series) + "\" stroke-width=\"3\"></line>"
      + "</pattern>";
  }

  function hasData(spec) {
    if (spec.type === "histogram") return (spec.bins || []).some((bin) => bin.count > 0);
    if (spec.type === "boxes") return spec.series.some((series) => number(series.low) !== 0 || number(series.high) !== 0);
    return spec.series.some((series) => (series.values || []).some((value) => number(value) !== 0)
      || (series.high || []).some((value) => number(value) !== 0));
  }

  // Positive and negative stacks per x position: [{low, high}] per series, plus the extremes.
  function stack(seriesList, length) {
    const up = new Array(length).fill(0);
    const down = new Array(length).fill(0);
    const layers = seriesList.map((series) => series.values.map((raw, position) => {
      const value = number(raw);
      if (value >= 0) {
        const low = up[position];
        up[position] += value;
        return { low, high: up[position] };
      }
      const high = down[position];
      down[position] += value;
      return { low: down[position], high };
    }));
    return { layers, max: Math.max(0, ...up), min: Math.min(0, ...down) };
  }

  function axisY(ticks, scaleY, unit) {
    return ticks.map((tick) => {
      const y = round(scaleY(tick));
      return "<line class=\"grid\" x1=\"" + MARGIN.left + "\" x2=\"" + (WIDTH - MARGIN.right) + "\" y1=\"" + y
        + "\" y2=\"" + y + "\"></line><text class=\"tick\" x=\"" + (MARGIN.left - 6) + "\" y=\"" + (y + 3.5)
        + "\" text-anchor=\"end\">" + escapeText(tickText(tick, unit)) + "</text>";
    }).join("");
  }

  function axisX(values, positionOf, unit) {
    const numeric = values.every((value) => typeof value === "number");
    let picked;
    if (numeric && values.length > 1) {
      const step = Math.max(1, niceStep(values[values.length - 1] - values[0], 5));
      picked = values.map((value, position) => [value, position]).filter(([value]) => value % step === 0);
      if (picked.length < 2) picked = [[values[0], 0], [values[values.length - 1], values.length - 1]];
    } else {
      picked = values.map((value, position) => [value, position]);
    }
    const baseline = HEIGHT - MARGIN.bottom;
    return picked.map(([value, position]) => "<text class=\"tick\" x=\"" + round(positionOf(position)) + "\" y=\""
      + (baseline + 16) + "\" text-anchor=\"middle\">" + escapeText(unit ? tickText(value, unit) : value) + "</text>")
      .join("");
  }

  function barPath(x, y, width, height) {
    // A bar from y (its data end) down by height; the data end gets 4 px rounding when the bar is wide enough.
    const radius = width >= 8 ? Math.min(4, height / 2, width / 2) : 0;
    if (radius <= 0) return "M" + round(x) + "," + round(y) + "h" + round(width) + "v" + round(height) + "h"
      + round(-width) + "z";
    return "M" + round(x) + "," + round(y + height) + "V" + round(y + radius) + "Q" + round(x) + "," + round(y) + " "
      + round(x + radius) + "," + round(y) + "H" + round(x + width - radius) + "Q" + round(x + width) + "," + round(y)
      + " " + round(x + width) + "," + round(y + radius) + "V" + round(y + height) + "z";
  }

  function areaPath(points) {
    return points.map((point, position) => (position ? "L" : "M") + round(point[0]) + "," + round(point[1])).join("")
      + "Z";
  }

  // Points of a series where it has a value: a compared scenario with a shorter horizon has null after its last year.
  function presentPoints(values, scaleX, scaleY) {
    return values.map((value, position) => (value == null ? null : [scaleX(position), scaleY(value)]))
      .filter((point) => point);
  }

  function linePath(points) {
    return points.map((point, position) => (position ? "L" : "M") + round(point[0]) + "," + round(point[1])).join("");
  }

  function endDot(x, y, series) {
    return "<circle class=\"dot\" cx=\"" + round(x) + "\" cy=\"" + round(y) + "\" r=\"4\" fill=\"" + color(series)
      + "\"></circle>";
  }

  // Geometry and marks for each chart type: returns {marks, yTicks, unit, xAxis, positions}.
  const DRAW = {
    stackedArea(spec) {
      const values = spec.x.values;
      const { layers, max, min } = stack(spec.series, values.length);
      const ticks = niceTicks(min, max, 4);
      const scaleY = linear(ticks[0], ticks[ticks.length - 1], HEIGHT - MARGIN.bottom, MARGIN.top);
      const scaleX = linear(0, Math.max(values.length - 1, 1), MARGIN.left, WIDTH - MARGIN.right);
      const marks = layers.map((layer, index) => {
        const upper = layer.map((part, position) => [scaleX(position), scaleY(part.high)]);
        const lower = layer.map((part, position) => [scaleX(position), scaleY(part.low)]).reverse();
        return "<path class=\"area\" fill=\"" + color(spec.series[index]) + "\" d=\"" + areaPath(upper.concat(lower))
          + "\"></path><path class=\"seam\" d=\"" + linePath(upper) + "\"></path>";
      }).join("");
      return { marks, ticks, scaleY, positionOf: scaleX, values };
    },
    lines(spec) {
      const values = spec.x.values;
      const all = spec.series.flatMap((series) => series.values.map(number));
      const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
      const scaleY = linear(ticks[0], ticks[ticks.length - 1], HEIGHT - MARGIN.bottom, MARGIN.top);
      const scaleX = linear(0, Math.max(values.length - 1, 1), MARGIN.left, WIDTH - MARGIN.right);
      const marks = spec.series.map((series) => {
        const points = series.values.map((value, position) => [scaleX(position), scaleY(number(value))]);
        const last = points[points.length - 1];
        return "<path class=\"line\" stroke=\"" + color(series) + "\" d=\"" + linePath(points) + "\"></path>"
          + (last ? endDot(last[0], last[1], series) : "");
      }).join("");
      return { marks, ticks, scaleY, positionOf: scaleX, values };
    },
    stackedBars(spec) {
      return DRAW.barsAndLine(spec);
    },
    barsAndLine(spec) {
      const values = spec.x.values;
      const bars = seriesOf(spec, "bar").filter(counted);
      const records = seriesOf(spec, "bar").filter((series) => !counted(series));
      const lines = seriesOf(spec, "line");
      const { layers, max, min } = stack(bars, values.length);
      // A records bar sits on top of the counted stack (from its positive top), so the axis makes room for it.
      const tops = values.map((unused, position) => layers.reduce((most, layer) =>
        Math.max(most, layer[position].high), 0));
      const recordTops = values.map((unused, position) => tops[position] + records.reduce((sum, series) =>
        sum + Math.max(0, number(series.values[position])), 0));
      const lineValues = lines.flatMap((series) => series.values.map(number));
      const ticks = niceTicks(Math.min(min, ...lineValues, 0), Math.max(max, ...recordTops, ...lineValues, 0), 4);
      const scaleY = linear(ticks[0], ticks[ticks.length - 1], HEIGHT - MARGIN.bottom, MARGIN.top);
      const band = PLOT_WIDTH / Math.max(values.length, 1);
      const barWidth = Math.max(1, Math.min(MAX_BAR, band - BAR_GAP));
      const positionOf = (position) => MARGIN.left + band * (position + 0.5);
      let marks = "";
      layers.forEach((layer, index) => {
        layer.forEach((part, position) => {
          if (part.high === part.low) return;
          const top = scaleY(part.high);
          const height = scaleY(part.low) - top;
          const isEnd = part.high > 0 ? part.high === layers.reduce((most, other) => Math.max(most,
            other[position].high), 0) : false;
          const gap = layer === layers[0] || height <= BAR_GAP ? 0 : BAR_GAP;
          const x = positionOf(position) - barWidth / 2;
          const path = isEnd ? barPath(x, top, barWidth, Math.max(height - gap, 0.5))
            : "M" + round(x) + "," + round(top) + "h" + round(barWidth) + "v" + round(Math.max(height - gap, 0.5))
              + "h" + round(-barWidth) + "z";
          marks += "<path class=\"bar\" fill=\"" + color(bars[index]) + "\" d=\"" + path + "\"></path>";
        });
      });
      if (records.length) marks += "<defs>" + records.map((series) => hatchPattern(spec, series)).join("") + "</defs>";
      const recordLows = tops.slice();
      records.forEach((series) => {
        series.values.forEach((raw, position) => {
          const value = Math.max(0, number(raw));
          if (!value) return;
          const top = scaleY(recordLows[position] + value);
          const height = Math.max(scaleY(recordLows[position]) - top - (recordLows[position] > 0 ? BAR_GAP : 0), 0.5);
          recordLows[position] += value;
          const x = positionOf(position) - barWidth / 2;
          marks += "<path class=\"bar bar-records\" fill=\"url(#" + hatchId(spec, series) + ")\" stroke=\"" + color(series)
            + "\" d=\"M" + round(x) + "," + round(top) + "h" + round(barWidth) + "v" + round(height) + "h" + round(-barWidth)
            + "z\"></path>";
        });
      });
      marks += lines.map((series) => {
        const points = presentPoints(series.values, positionOf, scaleY);  // a blank year (no RMD yet) is skipped
        const last = points[points.length - 1];
        return "<path class=\"line\" stroke=\"" + color(series) + "\" d=\"" + linePath(points)
          + "\"></path>" + (last ? endDot(last[0], last[1], series) : "");
      }).join("");
      return { marks, ticks, scaleY, positionOf, values };
    },
    histogram(spec) {
      const bins = spec.bins || [];
      const ticks = niceTicks(0, Math.max(0, ...bins.map((bin) => bin.share)), 4);
      const scaleY = linear(ticks[0], ticks[ticks.length - 1], HEIGHT - MARGIN.bottom, MARGIN.top);
      const low = bins.length ? bins[0].from : 0;
      const high = bins.length ? bins[bins.length - 1].to : 1;
      const scaleX = linear(low, high, MARGIN.left, WIDTH - MARGIN.right);
      const series = spec.series[0];
      const marks = bins.map((bin) => {
        if (!bin.count) return "";
        const x = scaleX(bin.from) + BAR_GAP / 2;
        const width = Math.max(scaleX(bin.to) - scaleX(bin.from) - BAR_GAP, 1);
        const top = scaleY(bin.share);
        return "<path class=\"bar\" fill=\"" + color(series) + "\" d=\"" + barPath(x, top, width,
          scaleY(0) - top) + "\"></path>";
      }).join("");
      const xTicks = niceTicks(low, high, 4).filter((tick) => tick >= low && tick <= high);
      const xAxis = xTicks.map((tick) => "<text class=\"tick\" x=\"" + round(scaleX(tick)) + "\" y=\""
        + (HEIGHT - MARGIN.bottom + 16) + "\" text-anchor=\"middle\">" + escapeText(tickMoney(tick)) + "</text>")
        .join("");
      const positionOf = (position) => (scaleX(bins[position].from) + scaleX(bins[position].to)) / 2;
      return { marks, ticks, scaleY, positionOf, values: bins.map((bin) => bin.from), xAxis, yUnit: "percent" };
    },
    bands(spec) {
      const values = spec.x.values;
      const series = spec.series[0];
      const all = series.low.concat(series.high, series.values).map(number);
      const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
      const scaleY = linear(ticks[0], ticks[ticks.length - 1], HEIGHT - MARGIN.bottom, MARGIN.top);
      const scaleX = linear(0, Math.max(values.length - 1, 1), MARGIN.left, WIDTH - MARGIN.right);
      const upper = series.high.map((value, position) => [scaleX(position), scaleY(number(value))]);
      const lower = series.low.map((value, position) => [scaleX(position), scaleY(number(value))]).reverse();
      const median = series.values.map((value, position) => [scaleX(position), scaleY(number(value))]);
      const last = median[median.length - 1];
      const marks = "<path class=\"band\" fill=\"" + color(series) + "\" d=\"" + areaPath(upper.concat(lower))
        + "\"></path><path class=\"line\" stroke=\"" + color(series) + "\" d=\"" + linePath(median) + "\"></path>"
        + (last ? endDot(last[0], last[1], series) : "");
      return { marks, ticks, scaleY, positionOf: scaleX, values };
    },
    // One median line and 10th-90th percentile band per compared scenario on a shared age axis. A series with an
    // after-tax value ends in a dashed step right past the last year, then up or down to a dot at that value.
    compareBands(spec) {
      const values = spec.x.values;
      const taxed = spec.series.filter((series) => series.afterTax != null);
      const all = spec.series.flatMap((series) => series.low.concat(series.high, series.values)).map(number)
        .concat(taxed.map((series) => number(series.afterTax)));
      const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all), 4);
      const scaleY = linear(ticks[0], ticks[ticks.length - 1], HEIGHT - MARGIN.bottom, MARGIN.top);
      const right = WIDTH - MARGIN.right - (taxed.length ? AFTER_TAX.room + AFTER_TAX.stagger * (taxed.length - 1) : 0);
      const scaleX = linear(0, Math.max(values.length - 1, 1), MARGIN.left, right);
      const bands = spec.series.map((series) => {
        const upper = presentPoints(series.high, scaleX, scaleY);
        const lower = presentPoints(series.low, scaleX, scaleY).reverse();
        return upper.length ? "<path class=\"band band-compare\" fill=\"" + color(series) + "\" d=\""
          + areaPath(upper.concat(lower)) + "\"></path>" : "";
      }).join("");
      const lines = spec.series.map((series) => {
        const median = presentPoints(series.values, scaleX, scaleY);
        const last = median[median.length - 1];
        return median.length ? "<path class=\"line\" stroke=\"" + color(series) + "\" d=\"" + linePath(median)
          + "\"></path>" + endDot(last[0], last[1], series) : "";
      }).join("");
      const steps = taxed.map((series, index) => {
        const median = presentPoints(series.values, scaleX, scaleY);
        if (!median.length) return "";
        const last = median[median.length - 1];
        const x = right + AFTER_TAX.out + AFTER_TAX.stagger * index;
        const y = scaleY(number(series.afterTax));
        return "<path class=\"after-tax-step\" stroke=\"" + color(series) + "\" stroke-dasharray=\"3 2\" fill=\"none\" d=\"M"
          + round(last[0]) + "," + round(last[1]) + "H" + round(x) + "V" + round(y) + "\"></path><circle class=\"dot "
          + "after-tax-dot\" cx=\"" + round(x) + "\" cy=\"" + round(y) + "\" r=\"4\" fill=\"" + color(series) + "\"><title>"
          + escapeText(series.name + " after tax: " + formatValue(series.afterTax, "money")) + "</title></circle>";
      }).join("");
      return { marks: bands + lines + steps, ticks, scaleY, positionOf: scaleX, values };
    },
    // One horizontal box per compared scenario (whiskers, quartile box, median), its name above it.
    boxes(spec) {
      const series = spec.series;
      const low = Math.min(0, ...series.map((item) => number(item.low)));
      const high = Math.max(0, ...series.map((item) => number(item.high)));
      const xTicks = niceTicks(low, high, 4);
      const scaleX = linear(xTicks[0], xTicks[xTicks.length - 1], MARGIN.left, WIDTH - MARGIN.right);
      const band = PLOT_HEIGHT / Math.max(series.length, 1);
      const boxHeight = Math.max(6, Math.min(18, band - 18));
      const middleOf = (position) => MARGIN.top + band * position + 14 + (band - 14) / 2;
      const marks = series.map((item, position) => {
        const middle = middleOf(position);
        const top = middle - boxHeight / 2;
        const boxLeft = scaleX(number(item.q1));
        const boxWidth = Math.max(scaleX(number(item.q3)) - boxLeft, 2);
        return "<text class=\"box-label\" x=\"" + MARGIN.left + "\" y=\"" + round(MARGIN.top + band * position + 11)
          + "\">" + escapeText(item.name) + "</text><path class=\"whisker\" stroke=\"" + color(item) + "\" d=\"M"
          + round(scaleX(number(item.low))) + "," + round(middle) + "H" + round(scaleX(number(item.high))) + "M"
          + round(scaleX(number(item.low))) + "," + round(top + 3) + "V" + round(top + boxHeight - 3) + "M"
          + round(scaleX(number(item.high))) + "," + round(top + 3) + "V" + round(top + boxHeight - 3)
          + "\"></path><rect class=\"box\" x=\"" + round(boxLeft) + "\" y=\"" + round(top) + "\" width=\""
          + round(boxWidth) + "\" height=\"" + round(boxHeight) + "\" rx=\"3\" fill=\"" + color(item) + "\" stroke=\""
          + color(item) + "\"></rect><path class=\"median\" d=\"M" + round(scaleX(number(item.median))) + ","
          + round(top) + "V" + round(top + boxHeight) + "\"></path>";
      }).join("");
      const grid = xTicks.map((tick) => "<line class=\"grid\" x1=\"" + round(scaleX(tick)) + "\" x2=\""
        + round(scaleX(tick)) + "\" y1=\"" + MARGIN.top + "\" y2=\"" + (HEIGHT - MARGIN.bottom) + "\"></line>").join("");
      const xAxis = xTicks.map((tick) => "<text class=\"tick\" x=\"" + round(scaleX(tick)) + "\" y=\""
        + (HEIGHT - MARGIN.bottom + 16) + "\" text-anchor=\"middle\">" + escapeText(tickMoney(tick)) + "</text>")
        .join("");
      return { marks, yAxis: grid, xAxis, rows: true, rowOf: (y) => Math.floor((y - MARGIN.top) / band),
        positionOf: middleOf, values: series.map((item) => item.name) };
    },
  };

  function legendItems(spec) {
    if (spec.type === "bands") {
      const series = spec.series[0];
      const [low, high] = spec.percentiles || [10, 90];
      return [{ name: "Median", series, key: "line" }, { name: low + "th to " + high + "th percentile", series,
        key: "band" }];
    }
    if (spec.type === "compareBands") {
      return spec.series.map((series) => ({ name: series.name + (series.afterTax != null ? " (after tax "
        + tickMoney(series.afterTax) + ")" : ""), series, key: "line" }));
    }
    // Series with a group (deposits, withdrawals) get a heading item before the first series of each group.
    const items = [];
    let group = null;
    for (const series of spec.series) {
      if (series.group && series.group !== group) items.push({ name: series.group, heading: true });
      group = series.group || null;
      items.push({ name: series.name, series, key: series.mark === "line" ? "line" : series.hatched ? "hatch" : "box" });
    }
    return items;
  }

  function legend(spec) {
    const items = legendItems(spec);
    if (items.filter((item) => !item.heading).length < 2) return "";
    return "<ul class=\"legend\">" + items.map((item) => (item.heading ? "<li class=\"legend-group\">"
      + escapeText(item.name) + "</li>" : "<li><span class=\"key key-" + item.key + "\" style=\"--key:"
      + color(item.series) + "\"></span>" + escapeText(item.name) + "</li>")).join("") + "</ul>";
  }

  function dollarsNote(spec) {
    return spec.dollars === "future" ? "Inflation adjusted" : "Today's value";
  }

  // One sentence that says what the chart shows, for screen readers and the chart's caption.
  function chartSummary(spec) {
    if (spec.type === "boxes") {
      return spec.title + ", " + dollarsNote(spec).toLowerCase() + ": " + spec.series.map((series) => series.name
        + " median " + tickMoney(series.median) + ", middle half " + tickMoney(series.q1) + " to "
        + tickMoney(series.q3)).join("; ") + ".";
    }
    if (spec.type === "histogram") {
      const bins = spec.bins || [];
      const peak = bins.reduce((best, bin) => (bin.count > (best ? best.count : -1) ? bin : best), null);
      return spec.title + ", " + dollarsNote(spec).toLowerCase() + ": " + spec.shown + " runs in " + bins.length
        + " bins" + (peak ? "; most common " + tickMoney(peak.from) + " to " + tickMoney(peak.to) : "") + ".";
    }
    const values = spec.x.values;
    const range = values.length ? " by " + spec.x.label.toLowerCase() + " from " + values[0] + " to "
      + values[values.length - 1] : "";
    const names = spec.series.map((series) => series.name).join(", ");
    const taxed = spec.series.filter((series) => series.afterTax != null);
    const afterTax = taxed.length ? " After tax at the end (median): " + taxed.map((series) => series.name + " "
      + tickMoney(series.afterTax)).join("; ") + "." : "";
    return spec.title + ", " + dollarsNote(spec).toLowerCase() + range + ". " + spec.series.length + " series: "
      + names + "." + afterTax;
  }

  // Run `draw` with the viewBox set to `size` ({width, height}; null for the card's own size), then put it back.
  function sized(size, draw) {
    const kept = [WIDTH, HEIGHT];
    [WIDTH, HEIGHT] = size ? [size.width, size.height] : [BASE_SIZE.width, BASE_SIZE.height];
    PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
    PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
    try {
      return draw();
    } finally {
      [WIDTH, HEIGHT] = kept;
      PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
      PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
    }
  }

  // The chart as markup; `size` ({width, height}) draws it on a larger viewBox, as full screen does.
  function renderChart(spec, size) {
    return sized(size || null, () => drawChart(spec));
  }

  function drawChart(spec) {
    if (!TYPES.includes(spec.type)) throw new Error("chart " + spec.id + ": unknown type " + spec.type);
    const summary = chartSummary(spec);
    let body;
    if (!hasData(spec)) {
      body = "<p class=\"chart-empty\">Nothing to plot: every value in this chart is zero. The table lists the "
        + "years.</p>";
    } else {
      const drawn = DRAW[spec.type](spec);
      const unit = drawn.yUnit || spec.y.unit;
      const xAxis = drawn.xAxis || axisX(drawn.values, drawn.positionOf);
      const yAxis = drawn.yAxis != null ? drawn.yAxis : axisY(drawn.ticks, drawn.scaleY, unit)
        + "<line class=\"baseline\" x1=\"" + MARGIN.left + "\" x2=\"" + (WIDTH - MARGIN.right) + "\" y1=\""
        + round(drawn.scaleY(0)) + "\" y2=\"" + round(drawn.scaleY(0)) + "\"></line>";
      body = "<div class=\"chart-plot\"><svg class=\"chart-svg\" viewBox=\"0 0 " + WIDTH + " " + HEIGHT
        + "\" role=\"img\" tabindex=\"0\" aria-label=\"" + escapeText(summary + " Use the arrow keys to read values.")
        + "\" data-type=\"" + spec.type + "\">" + yAxis + drawn.marks + xAxis
        + "<line class=\"crosshair\" x1=\"0\" x2=\"0\" y1=\"" + MARGIN.top + "\" y2=\"" + (HEIGHT - MARGIN.bottom)
        + "\" visibility=\"hidden\"></line><rect class=\"hit\" x=\"" + MARGIN.left + "\" y=\"0\" width=\"" + PLOT_WIDTH
        + "\" height=\"" + HEIGHT + "\" fill=\"transparent\"></rect></svg><div class=\"readout\" aria-live=\"polite\" "
        + "hidden></div></div>";
    }
    return "<figure class=\"chart\" data-chart=\"" + escapeText(spec.id) + "\"><figcaption><span class=\"chart-title\">"
      + escapeText(spec.title) + "</span><span class=\"chart-note\">" + escapeText(dollarsNote(spec))
      + "</span></figcaption>" + legend(spec) + body + "<p class=\"sr-only\">" + escapeText(summary) + "</p></figure>";
  }

  function columnUnits(spec) {
    if (spec.type === "histogram") return ["money", "money", "count", "percent"];
    return spec.table.columns.map((name, position) => (position === 0 ? "label" : spec.y.unit));
  }

  function renderTable(spec) {
    const units = columnUnits(spec);
    const records = new Set((spec.series || []).filter((series) => !counted(series)).map((series) => series.name));
    // A records column (last) gets a greyed header with a tooltip: it is already counted elsewhere.
    const head = spec.table.columns.map((name, position) => (position > 0 && records.has(name)
      ? "<th scope=\"col\" class=\"records\" title=\"" + escapeText(RECORDS_HELP) + "\">" : "<th scope=\"col\">")
      + escapeText(name) + "</th>").join("");
    const rows = spec.table.rows.map((row) => "<tr>" + row.map((value, position) => {
      const text = units[position] === "label" || units[position] === "count" ? String(value)
        : formatValue(value, units[position]);
      return position === 0 ? "<th scope=\"row\">" + escapeText(text) + "</th>" : "<td>" + escapeText(text) + "</td>";
    }).join("") + "</tr>").join("");
    return "<div class=\"table-scroll\" tabindex=\"0\" role=\"region\" aria-label=\"" + escapeText(spec.title)
      + " table\"><table class=\"data-table\"><caption class=\"sr-only\">" + escapeText(spec.title + ", "
      + dollarsNote(spec)) + "</caption><thead><tr>" + head + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }

  // How a frame column is shown: text as is, years, ages and counts as plain numbers, divisors with one decimal,
  // everything else as whole dollars.
  function frameColumnFormat(name, values) {
    if (values.every((value) => value == null || typeof value === "string")) return "text";
    if (/^(Year|Age|Dependents)/.test(name)) return "plain";
    if (/^Divisor/.test(name)) return "decimal";
    if (name === "Inflation") return "index";  // the inflation index, about 1, is not money
    return "money";
  }

  function frameCell(value, format) {
    if (value == null) return "";
    if (format === "text" || typeof value !== "number") return String(value);
    if (format === "plain") return String(value);
    if (format === "decimal") return value.toFixed(1);
    if (format === "index") return value.toFixed(3);
    return formatValue(value, "money");
  }

  // A {columns, index, data} frame from wmti.dashboard.web as a scrolling table; the index (when there is one) is
  // the sticky first column under options.indexLabel. options.wrapFirst lets long first-column labels wrap.
  // options.columnHelp (column name to text) gives those column headings a tooltip.
  function renderFrame(frame, options) {
    const settings = options || {};
    const hasIndex = Array.isArray(frame.index);
    const helps = settings.columnHelp || {};
    const formats = frame.columns.map((name, position) => frameColumnFormat(name, frame.data.map((row) => row[position])));
    const head = (hasIndex ? ["<th scope=\"col\">" + escapeText(settings.indexLabel || "") + "</th>"] : [])
      .concat(frame.columns.map((name) => "<th scope=\"col\"" + (helps[name] ? " title=\"" + escapeText(helps[name]) + "\"" : "")
        + ">" + escapeText(name) + "</th>")).join("");
    const rows = frame.data.map((row, rowPosition) => "<tr>" + (hasIndex ? "<th scope=\"row\">"
      + escapeText(frame.index[rowPosition]) + "</th>" : "") + row.map((value, position) => {
      const text = escapeText(frameCell(value, formats[position]));
      const cell = formats[position] === "text" ? "td class=\"text\"" : "td";
      return !hasIndex && position === 0 ? "<th scope=\"row\">" + text + "</th>" : "<" + cell + ">" + text + "</td>";
    }).join("") + "</tr>").join("");
    return tableShell(settings, head, rows);
  }

  function tableShell(settings, head, rows) {
    return "<div class=\"table-scroll\" tabindex=\"0\" role=\"region\" aria-label=\"" + escapeText(settings.title || "Table")
      + "\"><table class=\"data-table" + (settings.wrapFirst ? " wrap-first" : "") + "\"><caption class=\"sr-only\">"
      + escapeText(settings.title || "") + "</caption><thead><tr>" + head + "</tr></thead><tbody>" + rows
      + "</tbody></table></div>";
  }

  // Text of one cell by its column's unit: money in whole dollars, change with a sign, percent with one decimal,
  // ordinal as 5th, text as is; null is blank.
  function unitCell(value, unit) {
    if (value == null) return "";
    if (typeof value !== "number" || unit === "text") return String(value);
    if (unit === "money") return formatValue(value, "money");
    if (unit === "change") return (value > 0 ? "+" : "") + formatValue(value, "money");
    if (unit === "percent") return percent(value, 1);
    if (unit === "ordinal") return value + "th";
    return formatValue(value, unit);
  }

  // A {columns, data} frame (no index) whose columns each have a unit; the first column is the sticky row label.
  function renderUnitsTable(frame, units, options) {
    const settings = options || {};
    const head = frame.columns.map((name) => "<th scope=\"col\">" + escapeText(name) + "</th>").join("");
    const rows = frame.data.map((row) => "<tr>" + row.map((value, position) => {
      const text = escapeText(unitCell(value, units[position]));
      if (position === 0) return "<th scope=\"row\">" + text + "</th>";
      return units[position] === "text" ? "<td class=\"text\">" + text + "</td>" : "<td>" + text + "</td>";
    }).join("") + "</tr>").join("");
    return tableShell(settings, head, rows);
  }

  // Rows of the readout at one x position: [label, value text, series or null].
  function readoutRows(spec, position) {
    const unit = spec.y.unit;
    if (spec.type === "histogram") {
      const bin = spec.bins[position];
      return { title: tickMoney(bin.from) + " to " + tickMoney(bin.to), rows: [["Runs", String(bin.count), null],
        ["Share of runs", percent(bin.share, 1), spec.series[0]]] };
    }
    if (spec.type === "boxes") {
      const series = spec.series[position];
      return { title: series.name, rows: [["Upper whisker", formatValue(series.high, unit), null],
        ["75th percentile", formatValue(series.q3, unit), null], ["Median", formatValue(series.median, unit), series],
        ["25th percentile", formatValue(series.q1, unit), null], ["Lower whisker", formatValue(series.low, unit), null]] };
    }
    const title = spec.x.label + " " + spec.x.values[position];
    if (spec.type === "compareBands") {
      const rows = [];
      for (const series of spec.series.filter((item) => item.values[position] != null)) {
        rows.push([series.name + " (10th to 90th: " + tickMoney(series.low[position]) + " to "
          + tickMoney(series.high[position]) + ")", formatValue(series.values[position], unit), series]);
        const last = series.values.reduce((found, value, index) => (value == null ? found : index), -1);
        if (series.afterTax != null && position === last) {
          rows.push([series.name, "After tax: " + formatValue(series.afterTax, unit), series]);
        }
      }
      return { title, rows };
    }
    if (spec.type === "bands") {
      const series = spec.series[0];
      return { title, rows: [["90th percentile", formatValue(series.high[position], unit), null],
        ["Median", formatValue(series.values[position], unit), series],
        ["10th percentile", formatValue(series.low[position], unit), null]] };
    }
    const rows = spec.series.map((series) => [series.name, formatValue(series.values[position], unit), series]);
    if (spec.type !== "lines") {
      const total = seriesOf(spec, spec.type === "stackedArea" ? "area" : "bar").filter(counted)
        .reduce((sum, series) => sum + number(series.values[position]), 0);
      rows.push(["Total", formatValue(total, unit), null]);
    }
    return { title, rows };
  }

  function attachChart(figure, spec) {
    const svg = figure.querySelector("svg.chart-svg");
    if (!svg) return;
    const [, , width, height] = svg.getAttribute("viewBox").split(" ").map(Number);
    const drawn = sized({ width, height }, () => DRAW[spec.type](spec));
    // In the turned full screen overlay the drawing's x axis runs down the screen and its y axis right to left.
    const turned = () => Boolean(figure.closest(".chart-rotated"));
    const count = drawn.values.length;
    const crosshair = svg.querySelector(".crosshair");
    const readout = figure.querySelector(".readout");
    let current = -1;

    function show(position) {
      current = Math.max(0, Math.min(count - 1, position));
      if (drawn.rows) {
        svg.querySelectorAll(".box").forEach((box, index) => box.classList.toggle("box-picked", index === current));
      } else {
        const x = drawn.positionOf(current);
        crosshair.setAttribute("x1", x);
        crosshair.setAttribute("x2", x);
        crosshair.setAttribute("visibility", "visible");
      }
      const { title, rows } = readoutRows(spec, current);
      readout.replaceChildren();
      const heading = document.createElement("div");
      heading.className = "readout-title";
      heading.textContent = title;
      readout.append(heading);
      for (const [label, value, series] of rows) {
        const row = document.createElement("div");
        row.className = "readout-row";
        const key = document.createElement("span");
        key.className = series ? "key key-line" : "key key-none";
        if (series) key.style.setProperty("--key", color(series));
        const strong = document.createElement("strong");
        strong.textContent = value;
        const name = document.createElement("span");
        name.textContent = label;
        row.append(key, strong, name);
        readout.append(row);
      }
      readout.hidden = false;
    }

    function hide() {
      crosshair.setAttribute("visibility", "hidden");
      svg.querySelectorAll(".box-picked").forEach((box) => box.classList.remove("box-picked"));
      readout.hidden = true;
      current = -1;
    }

    function fromPointer(event) {
      const box = svg.getBoundingClientRect();
      const across = turned() ? (event.clientY - box.top) / box.height : (event.clientX - box.left) / box.width;
      const down = turned() ? (box.right - event.clientX) / box.width : (event.clientY - box.top) / box.height;
      if (drawn.rows) {
        show(drawn.rowOf(down * height));
        return;
      }
      const x = across * width;
      let best = 0;
      for (let position = 1; position < count; position += 1) {
        if (Math.abs(drawn.positionOf(position) - x) < Math.abs(drawn.positionOf(best) - x)) best = position;
      }
      show(best);
    }

    svg.addEventListener("pointerdown", fromPointer);
    svg.addEventListener("pointermove", fromPointer);
    svg.addEventListener("keydown", (event) => {
      const forward = event.key === "ArrowRight" || (drawn.rows && event.key === "ArrowDown");
      if (forward || event.key === "ArrowLeft" || (drawn.rows && event.key === "ArrowUp")) {
        event.preventDefault();
        show(current < 0 ? 0 : current + (forward ? 1 : -1));
      } else if (event.key === "Escape") {
        hide();
      }
    });
  }

  // ---- Full screen: a chart card shown on the whole screen in landscape ----

  // The viewBox for a chart full screen on a viewport: landscape (the long side across), as wide as the room under the
  // title, legend and Close button (`chrome`, in pixels) allows at the card's own height, never narrower than in the
  // card and at most FULL_MAX_WIDTH.
  function fullScreenSize(viewWidth, viewHeight, chrome) {
    const across = Math.max(viewWidth, viewHeight);
    const down = Math.max(Math.min(viewWidth, viewHeight) - (chrome || 0), 120);
    const width = Math.round(BASE_SIZE.height * across / down);
    return { width: Math.min(FULL_MAX_WIDTH, Math.max(BASE_SIZE.width, width)), height: BASE_SIZE.height };
  }

  const FULL_CHROME = 130;  // pixels the title, legend and Close button take above the chart in full screen

  // Wire a chart card's Full screen button (`.chart-full`): it shows the card on the whole screen in landscape.
  function attachFullScreen(card, spec) {
    const button = card.querySelector(".chart-full");
    if (button) button.addEventListener("click", () => openFullScreen(card, spec, button));
  }

  // Show a card full screen: the browser's full screen with a landscape lock where they work (either may fail, which
  // is ignored), else (iOS has no element full screen) a fixed overlay turned a quarter while the phone is upright.
  // The chart is drawn again at the new size and on every resize; Close, Esc or Back puts the card back where it was,
  // at its own size, with the page scrolled back.
  function openFullScreen(card, spec, button) {
    const doc = card.ownerDocument;
    const win = doc.defaultView;
    const scroll = win.scrollY;
    let overlay = false;
    let closed = false;
    let pushed = false;
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "button chart-full-close";
    close.textContent = "Close";
    close.setAttribute("aria-label", "Close full screen");
    card.append(close);
    card.classList.add("chart-full-on");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", spec.title + ", full screen");

    function redraw(size) {
      const figure = card.querySelector("figure.chart");
      if (!figure) return;
      const holder = doc.createElement("div");
      holder.innerHTML = renderChart(spec, size);
      const fresh = holder.firstElementChild;
      figure.replaceWith(fresh);
      attachChart(fresh, spec);
    }

    function fit() {
      if (closed) return;
      if (!card.isConnected) {  // the plots were drawn again underneath
        finish();
        return;
      }
      if (overlay) card.classList.toggle("chart-rotated", win.innerHeight > win.innerWidth);
      redraw(fullScreenSize(win.innerWidth, win.innerHeight, FULL_CHROME));
    }

    function useOverlay() {
      if (closed) return;
      overlay = true;
      card.classList.add("chart-overlay");
      fit();
    }

    function onKey(event) {
      if (event.key === "Escape") finish();
    }

    function onFullScreenChange() {
      if (!overlay && doc.fullscreenElement !== card) finish();  // Esc or Back left the browser's full screen
    }

    function onBack() {
      pushed = false;
      finish();
    }

    function finish() {
      if (closed) return;
      closed = true;
      win.removeEventListener("resize", fit);
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("fullscreenchange", onFullScreenChange);
      win.removeEventListener("popstate", onBack);
      if (doc.fullscreenElement === card && doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
      const orientation = win.screen && win.screen.orientation;
      if (orientation && orientation.unlock) {
        try {
          orientation.unlock();
        } catch (error) {
          // nothing was locked
        }
      }
      card.classList.remove("chart-full-on", "chart-overlay", "chart-rotated");
      for (const name of ["role", "aria-modal", "aria-label"]) card.removeAttribute(name);
      close.remove();
      redraw(null);
      if (pushed) {
        pushed = false;
        win.history.back();
      }
      win.scrollTo(0, scroll);
      if (button.isConnected) button.focus();
    }

    close.addEventListener("click", finish);
    win.addEventListener("resize", fit);
    doc.addEventListener("keydown", onKey);
    doc.addEventListener("fullscreenchange", onFullScreenChange);
    try {  // Back closes the full screen view rather than leaving the page
      win.history.pushState({ wmtiFullScreen: true }, "");
      pushed = true;
      win.addEventListener("popstate", onBack);
    } catch (error) {
      // a sandboxed frame may refuse; Close and Esc still work
    }
    if (typeof card.requestFullscreen === "function") {
      card.requestFullscreen().then(() => {
        const orientation = win.screen && win.screen.orientation;
        if (orientation && orientation.lock) orientation.lock("landscape").catch(() => {});
        fit();
      }).catch(useOverlay);
    } else {
      useOverlay();
    }
    close.focus();
  }

  const api = { TYPES, renderChart, renderTable, renderFrame, renderUnitsTable, unitCell, attachChart, chartSummary,
    niceTicks, fullScreenSize, attachFullScreen, readoutRows, BASE_SIZE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WmtiCharts = api;
})(typeof self !== "undefined" ? self : this);

/* Climate Analytics: rainfall, dry spells, temperature and hot days, baseline period against recent period. */
(function () {
  "use strict";
  var FV = window.FV, C = FV.climate;
  var $ = function (id) { return document.getElementById(id); };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var COL = { base: "#B08A5E", recent: "#2F6F9F", other: "#C9CFC8" };
  var data = null, rows = null, o = null, loadedKey = null;

  function readForm() {
    var errs = [];
    function n(id, lo, hi) { var el = $(id), v = Number(el.value), bad = el.value === "" || isNaN(v) || v < lo || v > hi; el.setAttribute("aria-invalid", bad ? "true" : "false"); if (bad) errs.push(id); return v; }
    var maxY = new Date().getFullYear();
    var f = { lat: n("cl-lat", 6, 37.5), lon: n("cl-lon", 68, 97.5), b0: n("cl-b0", 1991, maxY), b1: n("cl-b1", 1991, maxY), r0: n("cl-r0", 1991, maxY), r1: n("cl-r1", 1991, maxY),
      dry: n("cl-dry", 0.1, 20), hot: n("cl-hot", 30, 48) };
    $("cl-form-e").textContent = "";
    if (!errs.length && (f.b0 > f.b1 || f.r0 > f.r1)) { $("cl-form-e").textContent = "Each period must start before it ends."; errs.push("order"); }
    else if (!errs.length && f.b1 >= f.r0) { $("cl-form-e").textContent = "The baseline must end before the recent period starts."; errs.push("overlap"); }
    else if (errs.length) $("cl-form-e").textContent = "Check the highlighted fields.";
    f.ok = !errs.length; return f;
  }
  function inP(y, a, b) { return y >= a && y <= b; }
  function color(y) { return inP(y, o.r0, o.r1) ? COL.recent : inP(y, o.b0, o.b1) ? COL.base : COL.other; }
  function pm(field, a, b) { return C.mean(rows.filter(function (r) { return inP(r.year, a, b); }).map(function (r) { return r[field]; })); }
  function meanLine(field) { var bm = pm(field, o.b0, o.b1), rm = pm(field, o.r0, o.r1); return [
    { type: "line", label: "Baseline mean", data: rows.map(function (r) { return inP(r.year, o.b0, o.b1) ? bm : null; }), borderColor: "#7A5D40", borderDash: [5, 4], borderWidth: 2, pointRadius: 0 },
    { type: "line", label: "Recent mean", data: rows.map(function (r) { return inP(r.year, o.r0, o.r1) ? rm : null; }), borderColor: "#142019", borderDash: [5, 4], borderWidth: 2, pointRadius: 0 }]; }

  function compute() {
    var ys = C.years(data);
    var normal = C.mean(C.range(1991, 2020).map(function (y) { return C.seasonTotal(data, y, 6, 9); }));
    rows = ys.map(function (y) {
      var j = C.seasonTotal(data, y, 6, 9);
      return { year: y, jjas: j, ond: C.seasonTotal(data, y, 10, 12), dry: C.drySpell(data, y, 6, 9, o.dry), hot: C.hotDays(data, y, o.hot),
        tmax: C.annualMean(data, y, "tx"), tmin: C.annualMean(data, y, "tn"), anom: j === null ? null : j / normal * 100, annual: (function () { var t = 0; for (var m = 1; m <= 12; m++) { var v = C.monthTotal(data, y, m); if (v === null) return null; t += v; } return t; })() };
    });
    rows.normal = normal;
  }

  function charts() {
    var labels = rows.map(function (r) { return String(r.year); });
    var scales = { x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } } };
    FV.chart("c-jjas", { type: "bar", data: { labels: labels, datasets: [{ label: "June to September (mm)", data: rows.map(function (r) { return r.jjas; }), backgroundColor: rows.map(function (r) { return color(r.year); }), order: 2 }].concat(meanLine("jjas")) },
      options: { plugins: { legend: { display: false } }, scales: Object.assign({ y: { beginAtZero: true, title: { display: true, text: "mm" } } }, scales) } });
    $("src-jjas").innerHTML = FV.tag(data.source === "cache" ? "cached" : "obs", data.source === "cache" ? "Cached NASA POWER" : "Live NASA POWER") + " Grid point " + (data.grid ? data.grid.lat.toFixed(2) + " N, " + data.grid.lon.toFixed(2) + " E" : "") + ". Years with any missing day are left blank. District normal in the ICAR-CRIDA plan (gauges): 644 mm.";
    var cb = C.monthlyClimatology(data, o.b0, o.b1), cr = C.monthlyClimatology(data, o.r0, o.r1);
    FV.chart("c-month", { type: "bar", data: { labels: MONTHS, datasets: [{ label: o.b0 + " to " + o.b1, data: cb.map(function (m) { return m.mean; }), backgroundColor: COL.base }, { label: o.r0 + " to " + o.r1, data: cr.map(function (m) { return m.mean; }), backgroundColor: COL.recent }] },
      options: { scales: { y: { beginAtZero: true, title: { display: true, text: "mm per month" } }, x: { grid: { display: false } } } } });
    // cumulative this year
    var last = data.days[data.days.length - 1], y = last.y;
    var dn = C.dailyNormal(data, "pr", 1991, 2020), cumN = [], cumY = [], lab = [], acc = 0, accN = 0;
    data.byYear[y].forEach(function (r, i) { acc += r.pr || 0; accN += dn[Math.min(i, 364)] || 0; cumY.push(acc); cumN.push(accN); lab.push(r.key.slice(4, 6) + "-" + r.key.slice(6)); });
    FV.chart("c-cum", { type: "line", data: { labels: lab, datasets: [{ label: String(y), data: cumY, borderColor: COL.recent, borderWidth: 2.5, pointRadius: 0 }, { label: "1991 to 2020 normal", data: cumN, borderColor: "#7A857D", borderDash: [5, 4], borderWidth: 2, pointRadius: 0 }] },
      options: { scales: { y: { beginAtZero: true, title: { display: true, text: "mm since 1 January" } }, x: { ticks: { maxTicksLimit: 8 } } } } });
    $("src-cum").textContent = "To " + last.key.slice(0, 4) + "-" + last.key.slice(4, 6) + "-" + last.key.slice(6) + ": " + Math.round(acc) + " mm against a normal of " + Math.round(accN) + " mm for the same days.";
    FV.chart("c-anom", { type: "bar", data: { labels: labels, datasets: [{ label: "% of normal", data: rows.map(function (r) { return r.anom; }), backgroundColor: rows.map(function (r) { return r.anom === null ? "#ccc" : r.anom < 100 ? "#C7652A" : "#2F6F9F"; }) }] },
      options: { plugins: { legend: { display: false } }, scales: Object.assign({ y: { title: { display: true, text: "% of 1991 to 2020 normal" }, suggestedMin: 0 } }, scales) } });
    FV.chart("c-dry", { type: "bar", data: { labels: labels, datasets: [{ label: "Longest dry spell (days)", data: rows.map(function (r) { return r.dry; }), backgroundColor: rows.map(function (r) { return color(r.year); }), order: 2 },
      { type: "line", label: "14 days", data: rows.map(function () { return 14; }), borderColor: "#C7652A", borderDash: [2, 3], borderWidth: 1.5, pointRadius: 0 }].concat(meanLine("dry")) },
      options: { plugins: { legend: { display: false } }, scales: Object.assign({ y: { beginAtZero: true, title: { display: true, text: "days" } } }, scales) } });
    var ys = rows.map(function (r) { return r.year; });
    var sx = C.slope(ys, rows.map(function (r) { return r.tmax; })), sn = C.slope(ys, rows.map(function (r) { return r.tmin; }));
    function trendLine(field, s) { var v = rows.filter(function (r) { return r[field] !== null; }); var mx = C.mean(v.map(function (r) { return r.year; })), my = C.mean(v.map(function (r) { return r[field]; })); return rows.map(function (r) { return s === null ? null : my + s * (r.year - mx); }); }
    FV.chart("c-temp", { type: "line", data: { labels: labels, datasets: [
      { label: "Mean daily maximum (°C)", data: rows.map(function (r) { return r.tmax; }), borderColor: "#C7652A", borderWidth: 2, pointRadius: 2 },
      { label: "Trend (max)", data: trendLine("tmax", sx), borderColor: "#C7652A", borderDash: [5, 4], borderWidth: 1.2, pointRadius: 0 },
      { label: "Mean daily minimum (°C)", data: rows.map(function (r) { return r.tmin; }), borderColor: "#2F6F9F", borderWidth: 2, pointRadius: 2 },
      { label: "Trend (min)", data: trendLine("tmin", sn), borderColor: "#2F6F9F", borderDash: [5, 4], borderWidth: 1.2, pointRadius: 0 }] },
      options: { scales: Object.assign({ y: { title: { display: true, text: "°C" } } }, scales) } });
    $("src-temp").textContent = "Least-squares trend over complete years: maximum " + FV.signed(sx * 10, 2) + " °C per decade, minimum " + FV.signed(sn * 10, 2) + " °C per decade. No significance test applied.";
    $("h-hot").textContent = "Days per year with maximum temperature at or above " + o.hot + " °C";
    FV.chart("c-hot", { type: "bar", data: { labels: labels, datasets: [{ label: "Hot days", data: rows.map(function (r) { return r.hot; }), backgroundColor: rows.map(function (r) { return color(r.year); }), order: 2 }].concat(meanLine("hot")) },
      options: { plugins: { legend: { display: false } }, scales: Object.assign({ y: { beginAtZero: true, title: { display: true, text: "days" } } }, scales) } });
    rows.slopes = { tmax: sx, tmin: sn };
  }

  function table() {
    var defs = [["June to September rainfall", "jjas", "mm", 0], ["October to December rainfall", "ond", "mm", 0], ["Annual rainfall", "annual", "mm", 0], ["Longest June to September dry spell", "dry", "days", 1],
      ["Days with maximum at or above " + o.hot + " °C", "hot", "days/year", 1], ["Mean daily maximum temperature", "tmax", "°C", 2], ["Mean daily minimum temperature", "tmin", "°C", 2]];
    $("cl-table").innerHTML = defs.map(function (d) { var b = pm(d[1], o.b0, o.b1), r = pm(d[1], o.r0, o.r1);
      return "<tr><td>" + d[0] + '</td><td class="n">' + FV.fmt(b, d[3]) + '</td><td class="n">' + FV.fmt(r, d[3]) + '</td><td class="n">' + (b === null || r === null ? "n/a" : FV.signed(r - b, d[3])) + "</td><td>" + d[2] + "</td></tr>"; }).join("");
    $("cl-cap").textContent = "Baseline " + o.b0 + " to " + o.b1 + "; recent " + o.r0 + " to " + o.r1 + ". Means of complete years only.";
    var b = pm("jjas", o.b0, o.b1), r = pm("jjas", o.r0, o.r1), db = pm("dry", o.b0, o.b1), dr = pm("dry", o.r0, o.r1), hb = pm("hot", o.b0, o.b1), hr = pm("hot", o.r0, o.r1);
    var items = [
      [r < b * 0.95 ? "neg" : r > b * 1.05 ? "pos" : "neu", "Average monsoon rain (June to September) was " + Math.round(r) + " mm in " + o.r0 + " to " + o.r1 + ", compared with " + Math.round(b) + " mm in " + o.b0 + " to " + o.b1 + "."],
      [dr > db + 0.5 ? "neg" : "neu", "The longest dry spell in the monsoon averaged " + dr.toFixed(1) + " days recently, compared with " + db.toFixed(1) + " days before."],
      [hr > hb + 0.5 ? "neg" : "neu", "Very hot days (" + o.hot + " °C or more) averaged " + hr.toFixed(1) + " per year recently, compared with " + hb.toFixed(1) + " before."],
      [rows.slopes.tmax > 0 ? "neg" : "neu", "Daytime temperatures have changed by about " + FV.signed(rows.slopes.tmax * 10, 2) + " °C per decade since 1991."]];
    $("cl-plain").innerHTML = items.map(function (i) { return '<li class="' + i[0] + '">' + FV.icon(i[0] === "neg" ? FV.ICONS.warn : i[0] === "pos" ? FV.ICONS.check : FV.ICONS.minus) + "<span>" + FV.esc(i[1]) + "</span></li>"; }).join("");
    $("cl-stats").innerHTML = [["Normal Jun to Sep", Math.round(rows.normal) + " mm"], ["Recent Jun to Sep", Math.round(r) + " mm"], ["Max temp trend", FV.signed(rows.slopes.tmax * 10, 2) + " °C/decade"]]
      .map(function (s) { return '<div class="band-stat"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + "</div></div>"; }).join("");
  }

  function render() { compute(); charts(); table(); $("cl-csv").disabled = false; }

  function run() {
    o = readForm(); if (!o.ok) return;
    var key = o.lat.toFixed(3) + "," + o.lon.toFixed(3);
    if (data && key === loadedKey) { render(); return; }
    $("cl-status").className = "status loading"; $("cl-status").querySelector(".text").textContent = "Loading NASA POWER data. A new location is requested live and can take up to a minute.";
    $("cl-error").hidden = true;
    C.load({ lat: o.lat, lon: o.lon }).then(function (d) {
      data = d; loadedKey = key; $("cl-results").hidden = false;
      $("cl-status").className = "status ok";
      $("cl-status").querySelector(".text").textContent = (d.source === "cache" ? "Cached copy saved " + (d.fetchedAt || "").slice(0, 10) : "Loaded live from NASA POWER") + ". Daily record " + d.first.slice(0, 4) + " to " + d.last.slice(0, 4) + "-" + d.last.slice(4, 6) + "-" + d.last.slice(6) + ".";
      render();
    }).catch(function (e) {
      $("cl-results").hidden = true; $("cl-error").hidden = false; $("cl-error-d").textContent = "Reason: " + e.message;
      $("cl-status").className = "status err"; $("cl-status").querySelector(".text").textContent = FV.t("c.unavailable");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var q = new URLSearchParams(location.search);
    if (q.get("lat") && q.get("lon")) { $("cl-lat").value = (+q.get("lat")).toFixed(2); $("cl-lon").value = (+q.get("lon")).toFixed(2); }
    $("cl-r1").value = new Date().getFullYear() - 1;
    $("cl-form").addEventListener("submit", function (e) { e.preventDefault(); run(); });
    $("cl-csv").addEventListener("click", function () {
      var lines = ["year,jjas_rain_mm,ond_rain_mm,annual_rain_mm,longest_dry_spell_days,hot_days,mean_tmax_c,mean_tmin_c"];
      rows.forEach(function (r) { lines.push([r.year, r.jjas, r.ond, r.annual, r.dry, r.hot, r.tmax, r.tmin].map(function (v) { return v === null || v === undefined ? "" : (typeof v === "number" && v % 1 ? v.toFixed(2) : v); }).join(",")); });
      lines.push("# NASA POWER daily, " + data.url); lines.push("# Dry day < " + o.dry + " mm; hot day >= " + o.hot + " C");
      FV.download("farmverse_climate_indicators.csv", lines.join("\n"));
    });
    document.querySelectorAll("[data-tab]").forEach(function (t) { t.addEventListener("click", function () {
      document.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      document.querySelectorAll("[data-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== t.getAttribute("data-tab"); });
    }); });
    run();
  });
})();

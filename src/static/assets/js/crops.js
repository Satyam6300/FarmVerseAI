/* Crop Intelligence: government statistics, baseline model validation and the team pipeline slot. */
(function () {
  "use strict";
  var FV = window.FV;
  var $ = function (id) { return document.getElementById(id); };
  var stats, model, key = "tur";
  var SHORT = { year: "Year trend", kharif_rain: "Jun to Sep rain", dry_spell: "Monsoon dry spell", rabi_rain: "Oct to Dec rain", hot_days_jjas: "Hot days Jun to Sep", tmax_nd: "Nov and Dec max temp" };
  var NAMES = { model: "Weather model", mean: "Training-period mean", persistence: "Last year's yield", trend: "Trend line only" };

  function render() {
    var s = stats.crops[key], m = model.models[key];
    var rows = s.rows;
    FV.chart("c-yield", { type: "bar", data: { labels: rows.map(function (r) { return r.year; }), datasets: [{ label: "Yield (t/ha)", data: rows.map(function (r) { return r.yield_t_ha; }),
      backgroundColor: rows.map(function (r) { return r.flag ? "#C9CFC8" : r.source === "UPAG" ? "#8B6A47" : "#D9B44A"; }) }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: function (x) { var r = rows[x.dataIndex]; return r.source + (r.flag ? "; " + r.flag : ""); } } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "tonnes per hectare" } }, x: { ticks: { maxTicksLimit: 14 } } } } });
    var flagged = rows.filter(function (r) { return r.flag; });
    $("src-yield").innerHTML = FV.tag("gov") + " " + FV.esc(s.label) + ", " + s.season + ", Kalaburagi district. " + rows.length + " seasons." + (flagged.length ? " Flagged: " + flagged.map(function (r) { return r.year + " (" + r.area_ha + " ha)"; }).join(", ") + "." : "") +
      ' <a href="' + stats._farmverse.dataset_page + '" target="_blank" rel="noopener">India Data Portal</a>';
    FV.chart("c-area", { type: "line", data: { labels: rows.map(function (r) { return r.year; }), datasets: [{ label: "Area (thousand ha)", data: rows.map(function (r) { return r.area_ha / 1000; }), borderColor: "#8B6A47", backgroundColor: "rgba(176,138,94,0.15)", fill: true, pointRadius: 2 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: "thousand ha" } }, x: { ticks: { maxTicksLimit: 8 } } } } });

    var plain = [];
    var recent = rows.slice(-5).filter(function (r) { return !r.flag; }), early = rows.slice(0, 5).filter(function (r) { return !r.flag; });
    function avg(a) { return a.reduce(function (t, r) { return t + r.yield_t_ha; }, 0) / a.length; }
    plain.push(["neu", "Average yield in the last five reported seasons: " + avg(recent).toFixed(2) + " t/ha, against " + avg(early).toFixed(2) + " t/ha in the first five (" + rows[0].year + " onward). These are district averages, not what one farm will harvest."]);
    var minR = rows.filter(function (r) { return !r.flag; }).reduce(function (a, r) { return r.yield_t_ha < a.yield_t_ha ? r : a; });
    plain.push(["neg", "The lowest reported yield was " + minR.yield_t_ha.toFixed(2) + " t/ha in " + minR.year + ", a reminder of how much yields swing between years."]);

    if (!m) {
      ["c-val", "c-coef"].forEach(function (id) { FV.empty($(id).parentNode, "Not enough clean years to test a model for this crop."); });
      $("cr-scores").innerHTML = ""; $("cr-verdict").textContent = ""; $("cr-est").innerHTML = '<div class="empty">No validated estimate for this crop.</div>';
    } else {
      var v = m.validation, sc = v.scores, best = v.best_baseline;
      $("lg-best").textContent = "Best simple baseline (" + NAMES[best].toLowerCase() + ")";
      FV.chart("c-val", { type: "line", data: { labels: m.predictions.map(function (p) { return p.year; }), datasets: [
        { label: "Reported", data: m.predictions.map(function (p) { return p.actual; }), borderColor: "#142019", borderWidth: 2.5, pointRadius: 3 },
        { label: "Weather model", data: m.predictions.map(function (p) { return p.model; }), borderColor: "#C9A227", borderWidth: 2, pointRadius: 2 },
        { label: NAMES[best], data: m.predictions.map(function (p) { return p[best]; }), borderColor: "#7A857D", borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 }] },
        options: { plugins: { legend: { display: false } }, interaction: { mode: "index", intersect: false }, scales: { y: { beginAtZero: true, title: { display: true, text: "t/ha" } } } } });
      $("cr-scores").innerHTML = ["model", "mean", "persistence", "trend"].map(function (k) {
        return "<tr" + (k === "model" ? ' style="font-weight:600"' : "") + "><td>" + NAMES[k] + '</td><td class="n">' + sc[k].mae.toFixed(3) + '</td><td class="n">' + sc[k].rmse.toFixed(3) + "</td></tr>"; }).join("");
      $("cr-verdict").innerHTML = (v.beats_all_baselines
        ? FV.tag("model") + " On " + sc.model.n + " test years the weather model had a lower average error than every simple baseline. With so few years this is weak evidence."
        : FV.tag("model") + " On " + sc.model.n + " test years the weather model did <strong>not</strong> beat the best simple baseline (" + NAMES[best].toLowerCase() + "). Weather at one point explains little of the year-to-year change in district yield for this crop.");
      plain.push([v.beats_all_baselines ? "pos" : "neg", v.beats_all_baselines ? "In testing, weather data improved district yield estimates slightly over simple rules." : "In testing, weather data did not estimate district yield better than a simple trend or average. Treat any estimate with caution."]);
      var labels = Object.keys(m.standardised_coefficients);
      FV.chart("c-coef", { type: "bar", data: { labels: labels.map(function (k) { return SHORT[k] || k; }), datasets: [{ data: labels.map(function (k) { return m.standardised_coefficients[k]; }),
        backgroundColor: labels.map(function (k) { return m.standardised_coefficients[k] >= 0 ? "#3E8E41" : "#C7652A"; }) }] },
        options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: "change in t/ha per standard deviation" } }, y: { ticks: { font: { size: 10 } } } } } });
      var e = m.in_season_estimate;
      if (e) {
        $("cr-est").innerHTML = '<div class="kpi"><div class="label">' + FV.esc(s.label) + ", season starting " + e.season_year + '</div><div class="value">' + e.yield_t_ha.toFixed(2) + '<small>t/ha</small></div>' +
          '<div class="small">80% range from test errors: ' + e.interval_80[0].toFixed(2) + " to " + e.interval_80[1].toFixed(2) + " t/ha</div></div>" +
          '<div class="notice ' + (e.beats_all_baselines ? "info" : "warn") + '" style="margin-top:12px">' + FV.icon(FV.ICONS.warn) + "<p>" +
          ("Experimental. This version uses only June to September weather, so it is available once the monsoon ends. In forward-chaining tests its mean absolute error was " + e.validation.model.mae.toFixed(2) + " t/ha against " + Math.min(e.validation.mean.mae, e.validation.persistence.mae, e.validation.trend.mae).toFixed(2) + " t/ha for the best simple baseline" + (e.beats_all_baselines ? ", a small improvement on few test years." : ", so it is <strong>not better than a simple rule</strong>. Shown for transparency, not for decisions.")) +
          " It is a district average, not a forecast for any farm.</p></div>" +
          '<details class="more expert-only" style="margin-top:10px"><summary>Inputs</summary><div><ul>' + Object.keys(e.features).map(function (k) { return "<li>" + FV.esc(k) + ": " + e.features[k] + "</li>"; }).join("") + "</ul></div></details>";
      } else $("cr-est").innerHTML = '<div class="empty">No estimate: the latest reported season is as recent as the latest complete weather.</div>';
    }
    $("cr-plain").innerHTML = plain.map(function (i) { return '<li class="' + i[0] + '">' + FV.icon(i[0] === "neg" ? FV.ICONS.warn : i[0] === "pos" ? FV.ICONS.check : FV.ICONS.minus) + "<span>" + FV.esc(i[1]) + "</span></li>"; }).join("");
  }

  function team() {
    var el = $("cr-team");
    FV.data.get("team_model.json").then(function (t) {
      if (!t || t.connected === false || !t.predictions) throw new Error("not connected");
      var rows = (t.predictions || []).slice(0, 50);
      el.innerHTML = "<header><h3>" + FV.esc(t.name || "Team model") + '</h3><span class="tag model" data-i18n="tag.model"></span></header><p class="small">' + FV.esc(t.description || "") + "</p>" +
        '<p class="small"><strong>Validation:</strong> ' + FV.esc(t.validation ? JSON.stringify(t.validation) : "not provided, so results are shown as unvalidated") + "</p>" +
        '<div class="table-wrap"><table><thead><tr><th>District</th><th>Crop</th><th>Season</th><th class="n">Predicted (t/ha)</th><th class="n">Actual (t/ha)</th></tr></thead><tbody>' +
        rows.map(function (r) { return "<tr><td>" + FV.esc(r.district) + "</td><td>" + FV.esc(r.crop) + "</td><td>" + FV.esc(r.season) + '</td><td class="n">' + FV.esc(r.predicted_t_ha) + '</td><td class="n">' + FV.esc(r.actual_t_ha == null ? "" : r.actual_t_ha) + "</td></tr>"; }).join("") + "</tbody></table></div>";
      FV.applyI18n(el);
    }).catch(function () {
      el.innerHTML = '<header><h3>Sentinel-2 and Earth Engine yield pipeline</h3><span class="tag missing">Not connected</span></header>' +
        "<p>The team's existing pipeline (data.gov.in statistics, Sentinel-2 NDVI, EVI, NDWI and SAVI from Google Earth Engine, weather features) has not been shared with this build, so none of its results appear here.</p>" +
        "<p class=\"small\">To show it, export its predictions to <span class=\"mono\">data/team_model.json</span>. The page will list them with their validation. It should be compared against the baseline above using the same forward-chaining years.</p>" +
        '<details class="more expert-only"><summary>Expected file format</summary><div><pre class="mono small" style="white-space:pre-wrap">{\n  "name": "Sentinel-2 yield model v1",\n  "description": "Random forest on GEE indices and weather",\n  "validation": {"method": "leave-one-year-out", "mae_t_ha": 0.21, "rmse_t_ha": 0.27, "n_years": 8},\n  "predictions": [\n    {"district": "Kalaburagi", "crop": "Tur", "season": "Kharif 2023-24", "predicted_t_ha": 0.81, "actual_t_ha": 0.85}\n  ]\n}</pre></div></details>';
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    Promise.all([FV.data.get("crop_stats.json"), FV.data.get("yield_model.json")]).then(function (r) {
      stats = r[0]; model = r[1];
      $("cr-crop").innerHTML = Object.keys(stats.crops).map(function (k) { return '<option value="' + k + '">' + FV.esc(stats.crops[k].label) + " (" + stats.crops[k].season + ")</option>"; }).join("");
      var f = FV.getFarm(); if (f.currentCrop === "chickpea") key = "gram";
      $("cr-crop").value = key;
      $("cr-crop").addEventListener("change", function () { key = $("cr-crop").value; render(); });
      render();
    }).catch(function (e) { $("cr-error").hidden = false; $("cr-error-t").textContent = "Crop data unavailable: " + e.message; });
    team();
  });
})();

/* Farm report: printable summary and CSV/JSON exports, all built in the browser from loaded data. */
(function () {
  "use strict";
  var FV = window.FV, R = window.FVRotations, RU = window.FVRules, C = FV.climate;
  var $ = function (id) { return document.getElementById(id); };
  var D = {};
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function csvCell(v) { if (v === null || v === undefined) return ""; var s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(rows) { return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n"); }

  function farm() {
    var f = D.farm, rot = RU.byId(f.rotation);
    $("rp-title").textContent = f.name || "Unnamed farm";
    $("rp-date").textContent = "Generated " + new Date().toLocaleString();
    var rows = [["Location", f.lat ? f.lat.toFixed(4) + " N, " + f.lon.toFixed(4) + " E" : null], ["Village", f.village], ["District", f.district], ["Area (acres)", f.areaAcres],
      ["Current crop", f.currentCrop && R.CROPS[f.currentCrop] ? R.CROPS[f.currentCrop].name : null], ["Current rotation", rot ? rot.name : null], ["Soil situation", f.soil ? R.SOILS[f.soil] : null],
      ["Soil pH", f.ph], ["Organic carbon (%)", f.oc], ["Irrigation", f.irrigation]];
    $("rp-farm").innerHTML = (f.demo ? '<p class="small">' + FV.tag("demo") + " Demonstration farm, not a real farmer's field.</p>" : "") +
      '<div class="table-wrap"><table><tbody>' + rows.map(function (r) { var have = r[1] !== null && r[1] !== "" && r[1] !== undefined;
        return "<tr><td>" + r[0] + "</td><td>" + (have ? FV.esc(r[1]) + " " + FV.tag(f.demo ? "demo" : "farmer") : FV.tag("missing")) + "</td></tr>"; }).join("") + "</tbody></table></div>";
  }
  function climate() {
    var s = D.status; if (!s) { $("rp-climate").innerHTML = '<p class="small">NASA POWER data unavailable.</p>'; return; }
    $("rp-climate").innerHTML = '<ul class="small"><li>June to September ' + s.jjasYear + " rainfall: <strong>" + Math.round(s.jjas) + " mm</strong>, " + Math.round(s.jjasPct) + "% of the 1991 to 2020 average (" + Math.round(s.normalJJAS) + " mm).</li>" +
      "<li>Longest monsoon dry spell: " + s.dry + " days (usual " + s.normalDry.toFixed(1) + " days).</li><li>Last 30 days: average maximum " + s.tx30.toFixed(1) + " °C (" + FV.signed(s.tx30 - s.tx30Normal, 1) + " °C against normal).</li>" +
      "<li>Data to " + s.lastDay.slice(0, 4) + "-" + s.lastDay.slice(4, 6) + "-" + s.lastDay.slice(6) + ".</li></ul>";
    FV.chart("rp-c-month", { type: "bar", data: { labels: MONTHS, datasets: [{ label: s.year + " (mm)", data: s.monthsThisYear, backgroundColor: "#2F6F9F" }, { label: "1991 to 2020 average (mm)", data: s.climatology.map(function (m) { return m.mean; }), backgroundColor: "#C9CFC8" }] },
      options: { animation: false, scales: { y: { beginAtZero: true } } } });
  }
  function veg() {
    var g = D.gibs; if (!g) { $("rp-veg").innerHTML = '<p class="small">Satellite series unavailable.</p>'; return; }
    var nd = FV.series.latest(g.ndvi), nn = FV.series.sameDateNormal(g.ndvi, nd.date, 2001, +nd.date.slice(0, 4) - 1), sm = FV.series.latest(g.smap), sn = FV.series.sameDateNormal(g.smap, sm.date, 2015, +sm.date.slice(0, 4) - 1);
    $("rp-veg").innerHTML = '<ul class="small"><li>District NDVI on ' + nd.date + ": " + nd.value.toFixed(2) + " (usual for this date " + nn.mean.toFixed(2) + "). Demonstration field pixel: " + (nd.field === null ? "n/a" : nd.field.toFixed(2)) + ".</li>" +
      "<li>SMAP surface soil moisture on " + sm.date + ": " + sm.value.toFixed(2) + " m³/m³ (usual " + (sn.mean === null ? "n/a" : sn.mean.toFixed(2)) + ").</li></ul>";
  }
  function twinScenarios() {
    try { var s = JSON.parse(sessionStorage.getItem("fv-twin")); if (s && s.scen) return s.scen; } catch (e) { /* none saved */ }
    var f = D.farm; return [f.rotation || "R1", "R2", "R5"].map(function (id) { var r = RU.byId(id); return { rotId: id, custom: false, water: "rainfed", plots: r.kharif.map(function (k) { return { season: "kharif", crop: k }; }).concat(r.rabi.map(function (k) { return { season: "rabi", crop: k }; })) }; });
  }
  function rot() {
    var sc = twinScenarios(), labels = ["A. " + FV.t("twin.current"), "B. " + FV.t("twin.adaptive"), "C. " + FV.t("twin.restore")], soil = D.farm.soil;
    $("rp-rot").innerHTML = '<div class="table-wrap"><table><thead><tr><th>Scenario</th><th>Kharif</th><th>Rabi</th><th>Legume</th><th>Listed for soil</th></tr></thead><tbody>' + sc.map(function (s, i) {
      var k = s.plots.filter(function (p) { return p.season === "kharif" && p.crop; }).map(function (p) { return p.crop; }), r = s.plots.filter(function (p) { return p.season === "rabi" && p.crop; }).map(function (p) { return p.crop; });
      var like = { kharif: k, rabi: r, soils: s.custom ? null : (RU.byId(s.rotId) || {}).soils }, leg = RU.legumeStatus(like);
      return "<tr><td>" + FV.esc(labels[i]) + "</td><td>" + FV.esc(RU.cropNames(k)) + "</td><td>" + FV.esc(r.length ? RU.cropNames(r) : "None") + "</td><td>" + (leg === true ? "Yes" : leg === null ? "Unknown" : "No") + "</td><td>" +
        (!soil ? "Soil unknown" : !like.soils ? "Custom" : RU.soilMatch(like, soil) ? "Yes" : "No") + "</td></tr>"; }).join("") + "</tbody></table></div><p class=\"small faint\">Open the Digital Twin for calendars and weather exposure.</p>";
  }
  function iot() {
    $("rp-iot").innerHTML = FV.settings.iotEndpoint ? '<p class="small">Gateway backend configured at ' + FV.esc(FV.settings.iotEndpoint) + ". See IoT Monitoring for current readings.</p>" : '<p class="small">' + FV.tag("missing") + " No field sensor connected. No readings are included.</p>";
  }

  var DL = {
    climate: function () {
      var d = D.power; if (!d) return alert("Climate data unavailable.");
      var rows = [["year", "jjas_rain_mm", "ond_rain_mm", "longest_dry_spell_days", "hot_days_40c", "mean_tmax_c", "mean_tmin_c"]];
      C.years(d).forEach(function (y) { rows.push([y, r1(C.seasonTotal(d, y, 6, 9)), r1(C.seasonTotal(d, y, 10, 12)), C.drySpell(d, y, 6, 9, 2.5), C.hotDays(d, y, 40), r2(C.annualMean(d, y, "tx")), r2(C.annualMean(d, y, "tn"))]); });
      rows.push(["# NASA POWER daily, " + d.url]); FV.download("farmverse_climate_yearly.csv", csv(rows));
    },
    ndvi: function () {
      var g = D.gibs; if (!g) return alert("Satellite series unavailable.");
      var rows = [["layer", "date", "district_mean", "valid_fraction", "field_pixel"]];
      ["ndvi", "evi", "smap"].forEach(function (k) { var s = g[k]; s.dates.forEach(function (d, i) { rows.push([s.layer, d, s.district_mean[i], s.valid_fraction[i], s.field_value[i]]); }); });
      rows.push(["# Decoded from NASA GIBS tiles with official colormaps; see scripts/fetch_gibs_series.py"]); FV.download("farmverse_satellite_series.csv", csv(rows));
    },
    crops: function () {
      var c = D.crop; if (!c) return alert("Crop statistics unavailable.");
      var rows = [["crop", "season", "year", "area_ha", "production_t", "yield_t_ha", "source", "flag"]];
      Object.keys(c.crops).forEach(function (k) { c.crops[k].rows.forEach(function (r) { rows.push([c.crops[k].label, c.crops[k].season, r.year, r.area_ha, r.production_t, r.yield_t_ha, r.source, r.flag]); }); });
      rows.push(["# " + c._farmverse.dataset_page]); FV.download("farmverse_kalaburagi_crop_stats.csv", csv(rows));
    },
    twin: function () {
      var rows = [["scenario", "season", "crop", "sowing_day_of_year", "duration_days", "water_assumption", "preset_rotation", "custom"]];
      twinScenarios().forEach(function (s, i) { s.plots.forEach(function (p) { rows.push(["ABC"[i], p.season, p.crop ? R.CROPS[p.crop].name : "none", p.sow, p.dur, s.water, (RU.byId(s.rotId) || {}).name, s.custom]); }); });
      FV.download("farmverse_twin_scenarios.csv", csv(rows));
    },
    farm: function () { FV.download("farmverse_farm_profile.json", JSON.stringify(D.farm, null, 2), "application/json"); }
  };
  function r1(v) { return v === null ? null : Math.round(v * 10) / 10; }
  function r2(v) { return v === null ? null : Math.round(v * 100) / 100; }

  document.addEventListener("DOMContentLoaded", function () {
    D.farm = FV.getFarm(); farm(); rot(); iot();
    $("rp-print").addEventListener("click", function () { window.print(); });
    document.querySelectorAll("[data-toggle]").forEach(function (c) { c.addEventListener("change", function () { document.querySelector('[data-sec="' + c.getAttribute("data-toggle") + '"]').hidden = !c.checked; }); });
    document.querySelectorAll("[data-dl]").forEach(function (b) { b.addEventListener("click", function () { DL[b.getAttribute("data-dl")](); }); });
    Promise.all([C.load().then(function (d) { D.power = d; D.status = C.currentStatus(d); }).catch(function () {}), FV.series.load().then(function (g) { D.gibs = g; }).catch(function () {}),
      FV.data.get("crop_stats.json").then(function (c) { D.crop = c; }).catch(function () {})]).then(function () { climate(); veg(); });
  });
})();

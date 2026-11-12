/* NASA Intelligence: vegetation and soil moisture series and the mission inventory. */
(function () {
  "use strict";
  var FV = window.FV;
  var $ = function (id) { return document.getElementById(id); };
  var g = null, idx = "ndvi";

  function vts() {
    var s = g[idx];
    var pts = s.dates.map(function (d, i) { return { d: d, v: s.valid_fraction[i] >= 0.5 ? s.district_mean[i] : null, f: s.field_value[i] }; });
    FV.chart("c-vts", { type: "line", data: { labels: pts.map(function (p) { return p.d; }), datasets: [
      { label: "District mean", data: pts.map(function (p) { return p.v; }), borderColor: "#3E8E41", borderWidth: 1.6, pointRadius: 0, spanGaps: false },
      { label: "Field pixel", data: pts.map(function (p) { return p.f; }), borderColor: "#8B6A47", borderWidth: 1, pointRadius: 0, spanGaps: false, hidden: FV.settings.mode === "farmer" }] },
      options: { plugins: { legend: { display: false } }, interaction: { mode: "index", intersect: false }, scales: { y: { min: 0, max: idx === "ndvi" ? 0.9 : 0.6, title: { display: true, text: idx.toUpperCase() } }, x: { ticks: { maxTicksLimit: 14 } } } } });
    var lowCov = s.valid_fraction.filter(function (f) { return f < 0.5; }).length;
    $("src-vts").innerHTML = FV.tag("obs") + " " + s.layer + ", " + s.dates.length + " composites, " + s.dates[0] + " to " + s.dates[s.dates.length - 1] + ". " +
      lowCov + " composites with under 50% usable pixels are left blank. " + FV.tag("cached") + " retrieved " + g._farmverse.fetched_at.slice(0, 10) + ".";
    var y = +$("n-year").value;
    var pr = FV.series.profile(s, y, 2001, 2025);
    FV.chart("c-prof", { type: "line", data: { labels: pr.map(function (p) { return p.md; }), datasets: [
      { label: String(y), data: pr.map(function (p) { return p.cur; }), borderColor: "#1B4430", borderWidth: 2.5, pointRadius: 2 },
      { label: "Median 2001 to 2025", data: pr.map(function (p) { return p.p50; }), borderColor: "#7A857D", borderDash: [4, 3], borderWidth: 1.2, pointRadius: 0 },
      { label: "90th percentile", data: pr.map(function (p) { return p.p90; }), borderColor: "transparent", backgroundColor: "#DCEBD8", fill: "+1", pointRadius: 0 },
      { label: "10th percentile", data: pr.map(function (p) { return p.p10; }), borderColor: "transparent", pointRadius: 0 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, title: { display: true, text: idx.toUpperCase() } }, x: { ticks: { maxTicksLimit: 12 } } } } });
    var pk = FV.series.annualPeak(s, 8, 10), yrs = Object.keys(pk).map(Number).sort();
    FV.chart("c-peak", { type: "bar", data: { labels: yrs.map(String), datasets: [{ label: "Peak " + idx.toUpperCase(), data: yrs.map(function (y) { return pk[y]; }), backgroundColor: yrs.map(function (y) { return y >= 2011 ? "#3E8E41" : "#A9C9A2"; }) }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, title: { display: true, text: idx.toUpperCase() } }, x: { ticks: { maxTicksLimit: 13 } } } } });
  }

  function soil(power) {
    var s = g.smap;
    FV.chart("c-smap", { type: "line", data: { labels: s.dates, datasets: [{ label: "Surface soil moisture (m³/m³)", data: s.dates.map(function (d, i) { return s.valid_fraction[i] >= 0.5 ? s.district_mean[i] : null; }), borderColor: "#8B6A47", backgroundColor: "rgba(139,106,71,0.12)", fill: true, borderWidth: 1.8, pointRadius: 0 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, title: { display: true, text: "m³/m³" } }, x: { ticks: { maxTicksLimit: 12 } } } } });
    if (!power) { FV.empty($("c-gwet").parentNode, "NASA POWER data unavailable."); return; }
    var months = {}, out = [];
    power.days.forEach(function (r) { if (r.y < 2015) return; var k = r.key.slice(0, 6); months[k] = months[k] || { t: [], r: [] }; if (r.gt !== null) months[k].t.push(r.gt); if (r.gr !== null) months[k].r.push(r.gr); });
    Object.keys(months).sort().forEach(function (k) { out.push({ k: k.slice(0, 4) + "-" + k.slice(4), t: FV.climate.mean(months[k].t), r: FV.climate.mean(months[k].r) }); });
    FV.chart("c-gwet", { type: "line", data: { labels: out.map(function (o) { return o.k; }), datasets: [
      { label: "Surface wetness (GWETTOP)", data: out.map(function (o) { return o.t; }), borderColor: "#B08A5E", borderWidth: 1.8, pointRadius: 0 },
      { label: "Root zone wetness (GWETROOT)", data: out.map(function (o) { return o.r; }), borderColor: "#1B4430", borderWidth: 1.8, pointRadius: 0 }] },
      options: { scales: { y: { min: 0, max: 1, title: { display: true, text: "0 dry to 1 saturated" } }, x: { ticks: { maxTicksLimit: 12 } } } } });
  }

  function missions(power) {
    var nd = FV.series.latest(g.ndvi), sm = FV.series.latest(g.smap);
    var M = [
      ["NASA POWER", "NASA Langley Research Center", "Daily rainfall, max and min temperature, modelled soil wetness", "About 0.5° (MERRA-2 grid)", "1991 to " + (power ? power.last.slice(0, 4) + "-" + power.last.slice(4, 6) + "-" + power.last.slice(6) : "n/a"), "Integrated", "live"],
      ["MODIS Terra NDVI and EVI", "NASA (Terra satellite)", "16-day vegetation indices", "About 250 m", "2001 to " + (nd ? nd.date : "n/a"), "Integrated", "live"],
      ["SMAP Level 4 soil moisture", "NASA (SMAP mission)", "Surface soil moisture, top 5 cm", "9 km", "2015 to " + (sm ? sm.date : "n/a"), "Integrated", "live"],
      ["GPM IMERG", "NASA and JAXA (GPM mission)", "Daily precipitation rate", "About 10 km", "Map layer, any date", "Map layer only", "live"],
      ["MODIS land surface temperature", "NASA (Terra satellite)", "8-day daytime surface temperature", "About 1 km", "Map layer, any date", "Map layer only", "live"],
      ["MODIS true colour", "NASA (Terra satellite)", "Corrected reflectance image", "About 250 m", "Map layer, any date", "Map layer only", "live"],
      ["Harmonized Landsat Sentinel-2 (HLS)", "NASA, combining NASA/USGS Landsat and ESA Sentinel-2", "30 m surface reflectance", "30 m", "Not loaded", "Not integrated", "missing"],
      ["Sentinel-2 (team pipeline)", "ESA Copernicus mission, via Google Earth Engine", "NDVI, EVI, NDWI, SAVI for the yield pipeline", "10 to 20 m", "Not loaded", "Awaiting team pipeline", "missing"]
    ];
    $("n-missions").innerHTML = M.map(function (m) {
      return '<article class="card"><header><h3>' + FV.esc(m[0]) + '</h3><span class="tag ' + m[6] + '">' + FV.esc(m[5]) + '</span></header><dl class="small"><dt class="faint">Organisation</dt><dd>' + FV.esc(m[1]) + '</dd><dt class="faint">Variable</dt><dd>' + FV.esc(m[2]) +
        '</dd><dt class="faint">Resolution</dt><dd>' + FV.esc(m[3]) + '</dd><dt class="faint">Period in app</dt><dd>' + FV.esc(m[4]) + "</dd></dl></article>";
    }).join("");
    var lat = nd ? nd.value : null;
    $("n-stats").innerHTML = [["Latest NDVI", lat === null ? "n/a" : lat.toFixed(2) + " (" + nd.date + ")"], ["Latest SMAP", sm ? sm.value.toFixed(2) + " m³/m³" : "n/a"], ["Composites", g.ndvi.dates.length]]
      .map(function (s) { return '<div class="band-stat"><div class="k">' + s[0] + '</div><div class="v">' + s[1] + "</div></div>"; }).join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-tab]").forEach(function (t) { t.addEventListener("click", function () {
      document.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      document.querySelectorAll("[data-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== t.getAttribute("data-tab"); });
    }); });
    var powerP = FV.climate.load().catch(function () { return null; });
    FV.series.load().then(function (data) {
      g = data;
      var years = {}; g.ndvi.dates.forEach(function (d) { years[d.slice(0, 4)] = 1; });
      $("n-year").innerHTML = Object.keys(years).sort().reverse().map(function (y) { return "<option>" + y + "</option>"; }).join("");
      $("n-year").addEventListener("change", vts);
      document.querySelectorAll("[data-idx]").forEach(function (b) { b.addEventListener("click", function () {
        idx = b.getAttribute("data-idx"); document.querySelectorAll("[data-idx]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); vts(); }); });
      vts();
      powerP.then(function (p) { soil(p); missions(p); });
    }).catch(function (e) { $("n-error").hidden = false; $("n-error-t").textContent = "Satellite series unavailable: " + e.message; });
    FV.onChange.push(function (w) { if (w === "mode" && g) vts(); });
  });
})();

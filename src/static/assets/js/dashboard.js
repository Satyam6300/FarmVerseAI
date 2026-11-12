/* Command Center: farm summary, observed indicators, rule-based alerts, map preview and data freshness. */
(function () {
  "use strict";
  var FV = window.FV, R = window.FVRotations;
  var st = {};
  var $ = function (id) { return document.getElementById(id); };
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dateStr(k) { return k.slice(0, 4) + "-" + k.slice(4, 6) + "-" + k.slice(6, 8); }
  function pos(v, lo, hi) { return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)); }

  function farmHeader() {
    var f = st.farm;
    $("d-farm-name").textContent = f.name || FV.t("c.unknown");
    var crop = R.CROPS[f.currentCrop];
    $("d-season").textContent = FV.t("season." + FV.seasonOf(new Date()));
    var parts = [(f.village ? f.village + ", " : "") + (f.district || "Kalaburagi") + ", Karnataka"];
    parts.push(FV.t("dash.crop") + ": " + (crop ? crop.name : FV.t("c.unknown")));
    if (f.areaAcres) parts.push(FV.fmt(f.areaAcres, 1) + " acres");
    $("d-farm-meta").textContent = parts.join("  ·  ");
    $("d-demo-note").hidden = !f.demo;
  }

  function kpis() {
    var c = st.status;
    if (c) {
      $("k-rain").innerHTML = FV.fmt(c.jjas, 0) + "<small>mm</small>";
      var p = c.jjasPct;
      $("k-rain-bar").style.width = pos(p, 0, 200) + "%";
      $("k-rain-d").className = "delta " + (p < 90 ? "down" : p > 110 ? "up" : "flat");
      $("k-rain-d").textContent = FV.t("dash.rainOf", { pct: FV.fmt(p, 0) }) + " (" + c.jjasYear + ", June to September)";
      $("k-rain-x").textContent = "1991 to 2020 mean " + FV.fmt(c.normalJJAS, 0) + " mm. NASA POWER PRECTOTCORR at " + FV.climate.DEFAULT.lat + " N, " + FV.climate.DEFAULT.lon + " E. Marker = 100% of normal.";
      $("k-temp").innerHTML = FV.fmt(c.tx30, 1) + "<small>°C avg max</small>";
      var dt = c.tx30 - c.tx30Normal;
      $("k-temp-d").className = "delta " + (dt > 0.5 ? "down" : dt < -0.5 ? "up" : "flat");
      $("k-temp-d").textContent = FV.signed(dt, 1) + " °C vs 1991 to 2020 for the same days (to " + dateStr(c.lastDay) + ")";
      var idx = c.last30.map(function (r) { var i = r.doy - 1; if (FV.climate.isLeap(r.y) && r.doy > 59) i--; return c.tnorm[Math.min(i, 364)]; });
      FV.chart("c-spark-temp", { type: "line", data: { labels: c.last30.map(function (r) { return dateStr(r.key); }), datasets: [
        { data: c.last30.map(function (r) { return r.tx; }), borderColor: "#C7652A", borderWidth: 2, pointRadius: 0, tension: 0.3, label: "Max temperature (°C)" },
        { data: idx, borderColor: "#9AA59D", borderDash: [4, 3], borderWidth: 1.5, pointRadius: 0, label: "1991 to 2020 normal" }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } } });
    } else {
      ["k-rain", "k-temp"].forEach(function (id) { $(id).textContent = FV.t("c.unavailable"); });
    }
    var g = st.gibs;
    if (g) {
      var sm = FV.series.latest(g.smap);
      if (sm) {
        var smn = FV.series.sameDateNormal(g.smap, sm.date, 2015, +sm.date.slice(0, 4) - 1);
        $("k-soil").innerHTML = FV.fmt(sm.value, 2) + "<small>m³/m³</small>";
        $("k-soil-bar").style.width = pos(sm.value, 0, 0.5) + "%";
        if (smn.mean !== null) $("k-soil-mark").style.left = pos(smn.mean, 0, 0.5) + "%";
        $("k-soil-d").className = "delta " + (smn.p10 !== null && sm.value < smn.p10 ? "down" : smn.p90 !== null && sm.value > smn.p90 ? "up" : "flat");
        $("k-soil-d").textContent = "District mean, " + sm.date + "; usual for this date " + FV.fmt(smn.mean, 2) + " (2015 onward, n=" + smn.n + ")";
        var gt = st.status && st.status.gwettop;
        $("k-soil-x").textContent = "SMAP L4 top 5 cm, 9 km, model value-added. Separately, NASA POWER modelled surface wetness (GWETTOP) on " + (st.status ? dateStr(st.status.lastDay) : "n/a") + ": " + (gt === null || gt === undefined ? "n/a" : gt.toFixed(2)) + " (0 dry to 1 saturated). Marker = usual level.";
        st.smLatest = sm; st.smNormal = smn;
      } else $("k-soil").textContent = FV.t("c.unavailable");
      var nd = FV.series.latest(g.ndvi);
      if (nd) {
        var ndn = FV.series.sameDateNormal(g.ndvi, nd.date, 2001, +nd.date.slice(0, 4) - 1);
        $("k-veg").innerHTML = FV.fmt(nd.value, 2) + "<small>NDVI</small>";
        $("k-veg-bar").style.width = pos(nd.value, 0, 0.9) + "%";
        if (ndn.mean !== null) $("k-veg-mark").style.left = pos(ndn.mean, 0, 0.9) + "%";
        $("k-veg-d").className = "delta " + (nd.value < ndn.p10 ? "down" : nd.value > ndn.p90 ? "up" : "flat");
        $("k-veg-d").textContent = "District, composite " + nd.date + "; usual " + FV.fmt(ndn.mean, 2);
        $("k-veg-x").textContent = "Demonstration field pixel: " + (nd.field === null ? "n/a" : nd.field.toFixed(2)) + ". Coverage " + Math.round(nd.coverage * 100) + "%. Marker = 2001 to " + (+nd.date.slice(0, 4) - 1) + " mean for this composite date.";
        st.ndLatest = nd; st.ndNormal = ndn;
      } else $("k-veg").textContent = FV.t("c.unavailable");
    }
  }

  function alerts() {
    var out = [], c = st.status;
    function add(kind, icon, text, src) { out.push('<li class="alert ' + kind + '"><span class="ic">' + FV.icon(FV.ICONS[icon]) + "</span><div><strong>" + FV.esc(text) + "</strong><span>" + src + "</span></div></li>"); }
    if (c && c.jjasPct !== null) {
      var p = c.jjasPct, key = p < 90 ? "alert.rainLow" : p > 110 ? "alert.rainHigh" : "alert.rainNormal";
      add(p < 90 ? "dry" : p > 110 ? "wet" : "info", "drop", FV.t(key, { pct: FV.fmt(p, 0) }), FV.tag("obs") + " NASA POWER, June to September " + c.jjasYear);
    }
    if (c && c.dry !== null && c.normalDry !== null) {
      var longer = c.dry > c.normalDry + 0.5;
      add(longer ? "dry" : "info", "sun", FV.t(longer ? "alert.dryLong" : "alert.dryShort", { d: c.dry, b: FV.fmt(c.normalDry, 0) }), FV.tag("obs") + " Days with rain below 2.5 mm, June to September " + c.jjasYear);
    }
    if (st.ndLatest && st.ndNormal && st.ndNormal.n >= 5) {
      var v = st.ndLatest.value, n = st.ndNormal;
      var k = v < n.p10 ? "alert.vegLow" : v > n.p90 ? "alert.vegHigh" : "alert.vegNormal";
      add("veg", "leaf", FV.t(k, { v: v.toFixed(2), n: n.mean.toFixed(2) }), FV.tag("obs") + " MODIS NDVI, composite " + st.ndLatest.date);
      add("info", "sat", FV.t("alert.newSat", { date: st.ndLatest.date }), FV.tag("cached") + " NASA GIBS");
    }
    if (st.smLatest && st.smNormal && st.smNormal.n >= 4) {
      var s = st.smLatest.value, sn = st.smNormal;
      var sk = s < sn.p10 ? "alert.soilDry" : s > sn.p90 ? "alert.soilWet" : "alert.soilNormal";
      add(sk === "alert.soilDry" ? "dry" : sk === "alert.soilWet" ? "wet" : "info", "drop", FV.t(sk), FV.tag("obs") + " SMAP L4, " + st.smLatest.date);
    }
    $("d-alerts").innerHTML = out.length ? out.join("") : "<li class=\"faint\">" + FV.esc(FV.t("c.unavailable")) + "</li>";
  }

  function monthlyChart() {
    var c = st.status; if (!c) { FV.empty($("c-monthly").parentNode, FV.t("c.unavailable")); return; }
    $("lg-year").textContent = String(c.year);
    FV.chart("c-monthly", { type: "bar", data: { labels: MONTHS, datasets: [
      { type: "line", label: "1991 to 2020 average (mm)", data: c.climatology.map(function (m) { return m.mean; }), borderColor: "#142019", borderWidth: 1.5, pointRadius: 2, order: 0 },
      { label: c.year + " (mm)", data: c.monthsThisYear, backgroundColor: "#2F6F9F", barPercentage: 0.45, grouped: false, order: 1 },
      { label: "10th to 90th percentile (mm)", data: c.climatology.map(function (m) { return [m.p10, m.p90]; }), backgroundColor: "#D6E3EC", barPercentage: 0.9, grouped: false, order: 2 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) {
        var v = x.raw; if (Array.isArray(v)) return x.dataset.label + ": " + Math.round(v[0]) + " to " + Math.round(v[1]);
        return x.dataset.label + ": " + (v === null ? "incomplete month" : Math.round(v)); } } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: "mm" } }, x: { grid: { display: false } } } } });
    $("src-monthly").innerHTML = FV.tag(st.power.source === "cache" ? "cached" : "obs", st.power.source === "cache" ? "Cached NASA POWER" : "Live NASA POWER") + " Daily data to " + dateStr(c.lastDay) + ". Incomplete months are not shown.";
  }

  function vegChart() {
    var g = st.gibs; if (!g) return;
    var nd = FV.series.latest(g.ndvi); if (!nd) return;
    var y = +nd.date.slice(0, 4);
    var prof = FV.series.profile(g.ndvi, y, 2001, y - 1);
    var fprof = FV.series.profile(g.ndvi, y, 2001, y - 1, true);
    FV.chart("c-veg", { type: "line", data: { labels: prof.map(function (p) { return p.md; }), datasets: [
      { label: "District " + y, data: prof.map(function (p) { return p.cur; }), borderColor: "#3E8E41", borderWidth: 2.5, pointRadius: 2, spanGaps: false },
      { label: "Field pixel " + y, data: fprof.map(function (p) { return p.cur; }), borderColor: "#8B6A47", borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0 },
      { label: "90th percentile", data: prof.map(function (p) { return p.p90; }), borderColor: "transparent", backgroundColor: "#DCEBD8", fill: "+1", pointRadius: 0 },
      { label: "10th percentile", data: prof.map(function (p) { return p.p10; }), borderColor: "transparent", pointRadius: 0 }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 0.9, title: { display: true, text: "NDVI" } }, x: { ticks: { maxTicksLimit: 12 } } } } });
  }

  function mapPreview() {
    var map = FV.mapkit.create("d-map", { zoom: 13, center: [st.farm.lat, st.farm.lon], scroll: false });
    var esri = FV.mapkit.esri(), ndvi = null, truecolor = null;
    var offline = !navigator.onLine;
    FV.mapkit.loadManifest().then(function () {
      truecolor = new FV.mapkit.GibsLayer("truecolor", FV.mapkit.defaultDate("truecolor"));
      ndvi = new FV.mapkit.GibsLayer("ndvi", FV.mapkit.defaultDate("ndvi"), { opacity: 0.85 });
      (offline ? truecolor : esri).addTo(map);
      $("d-map-note").innerHTML = offline ? "Offline: showing cached MODIS true colour from " + FV.mapkit.defaultDate("truecolor") + "." :
        "Esri World Imagery basemap (date varies by area). Lime outline: " + (st.farm.demo ? FV.tag("demo") + " illustrative demonstration field." : FV.tag("farmer") + " your field.");
    });
    esri.on("tileerror", function () { if (map.hasLayer(esri) && truecolor && !map.hasLayer(truecolor)) { truecolor.addTo(map); } });
    var fl = FV.mapkit.farmLayer(st.farm); if (fl) { fl.addTo(map); if (fl.getBounds) map.fitBounds(fl.getBounds(), { maxZoom: 15, padding: [30, 30] }); }
    FV.mapkit.boundary().then(function (b) { b.district.addTo(map); });
    document.querySelectorAll("[data-layer]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll("[data-layer]").forEach(function (o) { o.setAttribute("aria-pressed", o === btn ? "true" : "false"); });
        if (!ndvi) return;
        if (btn.getAttribute("data-layer") === "ndvi") { ndvi.addTo(map); map.setZoom(Math.min(map.getZoom(), 11)); $("d-map-note").textContent = FV.mapkit.LAYERS.ndvi.note + " Composite " + FV.mapkit.defaultDate("ndvi") + "."; }
        else { map.removeLayer(ndvi); map.setView([st.farm.lat, st.farm.lon], 14); }
      });
    });
  }

  function rotation() {
    var f = st.farm, rot = R.ROTATIONS.filter(function (r) { return r.id === f.rotation; })[0];
    $("d-rot-tag").innerHTML = f.demo ? FV.tag("demo") : FV.tag("farmer");
    if (!rot) { $("d-rot").innerHTML = "<p class=\"muted\">" + FV.esc(FV.t("c.unknown")) + "</p>"; return; }
    function crops(list) { return list.map(function (k) { return '<span class="crop-swatch" style="background:' + FV.cropColor(k) + '"></span>' + FV.esc(R.CROPS[k].name); }).join(" + ") || "Fallow"; }
    $("d-rot").innerHTML = "<p><strong>" + FV.esc(rot.name) + "</strong></p><div class=\"small\"><div>" + FV.esc(FV.t("season.kharif")) + ": " + crops(rot.kharif) +
      "</div><div>" + FV.esc(FV.t("season.rabi")) + ": " + (rot.rabiNote ? FV.esc(rot.rabiNote) : crops(rot.rabi)) + "</div></div>";
  }

  function iot() {
    var s = FV.settings, el = $("d-iot");
    if (s.iotEndpoint) {
      el.innerHTML = '<span class="status loading"><span class="dot"></span>Checking ' + FV.esc(s.iotEndpoint) + "</span>";
      fetch(s.iotEndpoint.replace(/\/$/, "") + "/api/nodes").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) { el.innerHTML = '<span class="status ok"><span class="dot"></span>Gateway backend reachable: ' + (j.nodes || []).length + " node(s)</span>"; })
        .catch(function (e) { el.innerHTML = '<span class="status err"><span class="dot"></span>Backend not reachable (' + FV.esc(e.message) + ")</span>"; });
    } else {
      el.innerHTML = '<span class="status"><span class="dot"></span>' + FV.esc(FV.t("dash.noIot")) + "</span><p class=\"small muted\" style=\"margin-top:8px\">No field readings are shown here. The IoT page has a clearly labelled demo mode.</p>";
    }
  }

  function updates() {
    var rows = [];
    if (st.power) rows.push(["NASA POWER daily", dateStr(st.power.last), st.power.source === "cache" ? "cached " + (st.power.fetchedAt || "").slice(0, 10) : "live"]);
    if (st.gibs) {
      var n = FV.series.latest(st.gibs.ndvi), s = FV.series.latest(st.gibs.smap);
      if (n) rows.push(["MODIS NDVI composite", n.date, "GIBS series " + (st.gibs._farmverse.fetched_at || "").slice(0, 10)]);
      if (s) rows.push(["SMAP L4 soil moisture", s.date, "GIBS series"]);
    }
    if (st.crop) {
      var t = st.crop.crops.tur.rows; rows.push(["District crop statistics", t[t.length - 1].year, "DES / UPAG"]);
    }
    $("d-updates").innerHTML = rows.map(function (r) { return "<tr><td>" + FV.esc(r[0]) + '</td><td class="n">' + FV.esc(r[1]) + '</td><td class="small faint">' + FV.esc(r[2]) + "</td></tr>"; }).join("");
  }

  function renderAll() { farmHeader(); kpis(); alerts(); monthlyChart(); vegChart(); rotation(); updates(); }

  document.addEventListener("DOMContentLoaded", function () {
    st.farm = FV.getFarm();
    farmHeader(); rotation(); iot(); mapPreview();
    var p1 = FV.climate.load().then(function (d) { st.power = d; st.status = FV.climate.currentStatus(d); }).catch(function (e) {
      $("d-error").hidden = false; $("d-error-text").textContent = "NASA POWER data unavailable: " + e.message + ". Climate indicators are not shown.";
    });
    var p2 = FV.series.load().then(function (g) { st.gibs = g; }).catch(function () { st.gibs = null; });
    var p3 = FV.data.get("crop_stats.json").then(function (c) { st.crop = c; }).catch(function () { st.crop = null; });
    Promise.all([p1, p2, p3]).then(renderAll);
    FV.onChange.push(function () { renderAll(); });
  });
})();

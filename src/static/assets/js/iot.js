/* IoT Monitoring: live readings from the FARMVERSE backend, or clearly labelled DEMO DATA. */
(function () {
  "use strict";
  var FV = window.FV;
  var $ = function (id) { return document.getElementById(id); };
  var mode, series = {}, nodes = [], timer = null;

  // Deterministic demo generator: smooth daily cycles and slow drying. Every value it produces is labelled DEMO DATA.
  function demo() {
    var now = Date.now(), pts = [], seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; }
    for (var h = 47; h >= 0; h--) {
      var t = new Date(now - h * 3600000), hr = t.getHours() + t.getMinutes() / 60, ph = Math.sin((hr - 9) / 24 * 2 * Math.PI);
      pts.push({ ts: t.toISOString(), sm15: 22 - (47 - h) * 0.06 + rnd() * 0.4, sm30: 27 - (47 - h) * 0.03 + rnd() * 0.3,
        st: 26 + 3 * ph + rnd() * 0.3, at: 27 + 6 * ph + rnd() * 0.6, rh: 58 - 18 * ph + rnd() * 2 });
    }
    series = { demo: true, pts: pts };
    var last = pts[pts.length - 1];
    nodes = [{ node_id: "DEMO-01", depth_cm: 15, ts: last.ts, battery_v: 3.58, rssi: -97, soil_moisture_pct: last.sm15 },
      { node_id: "DEMO-02", depth_cm: 30, ts: last.ts, battery_v: 3.61, rssi: -102, soil_moisture_pct: last.sm30 },
      { node_id: "DEMO-03", depth_cm: null, ts: last.ts, battery_v: 3.12, rssi: -109, air_temp_c: last.at, rh_pct: last.rh }];
    render();
  }

  function live() {
    var ep = (FV.settings.iotEndpoint || "").replace(/\/$/, "");
    if (!ep) { banner("warn", "<strong>No gateway backend configured.</strong> Add its address in <a href=\"settings.html\">Settings</a>, or switch to Demo mode. No readings are shown."); clearView(); return; }
    banner("info", "Connecting to " + FV.esc(ep) + " ...");
    fetch(ep + "/api/nodes").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) {
      nodes = j.nodes || [];
      if (!nodes.length) { banner("warn", "Connected to " + FV.esc(ep) + ", but no readings have been received yet."); clearView(); return; }
      return Promise.all(nodes.map(function (n) { return fetch(ep + "/api/readings?hours=48&node_id=" + encodeURIComponent(n.node_id)).then(function (r) { return r.json(); }); })).then(function (all) {
        var pts = {}; all.forEach(function (a) { (a.readings || []).forEach(function (r) { var k = r.ts.slice(0, 13); pts[k] = pts[k] || { ts: r.ts };
          if (r.soil_moisture_pct !== null) { if ((r.depth_cm || 0) <= 20) pts[k].sm15 = r.soil_moisture_pct; else pts[k].sm30 = r.soil_moisture_pct; }
          if (r.soil_temp_c !== null) pts[k].st = r.soil_temp_c; if (r.air_temp_c !== null) pts[k].at = r.air_temp_c; if (r.rh_pct !== null) pts[k].rh = r.rh_pct; }); });
        series = { demo: false, pts: Object.keys(pts).sort().map(function (k) { return pts[k]; }) };
        banner("ok", "Live readings from " + FV.esc(ep) + ". Refreshes every 60 seconds.");
        render();
      });
    }).catch(function (e) { banner("err", "<strong>Gateway backend not reachable</strong> (" + FV.esc(e.message) + "). No readings are shown. Check that the backend is running and that its CORS setting allows this site."); clearView(); });
  }

  function banner(kind, html) { $("io-banner").innerHTML = '<div class="notice ' + kind + '" style="margin-bottom:16px">' + FV.icon(kind === "ok" ? FV.ICONS.check : FV.ICONS.warn) + "<p>" + html + "</p></div>"; }
  function clearView() { series = { pts: [] }; nodes = []; render(); }
  function tag() { return series.demo ? '<span class="watermark">DEMO DATA</span>' : series.pts && series.pts.length ? '<span class="tag live">Live</span>' : FV.tag("missing"); }
  function ago(ts) { var m = Math.round((Date.now() - Date.parse(ts)) / 60000); return m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago"; }

  function render() {
    var p = series.pts || [], last = p[p.length - 1] || {};
    ["io-tag1", "io-tag2", "io-tag3"].forEach(function (id) { $(id).innerHTML = tag(); });
    function k(label, v, unit, ic) { return '<article class="card kpi"><div class="label">' + label + " " + tag() + '</div><div class="value">' + (v === undefined || v === null ? "–" : v.toFixed(1) + "<small>" + unit + "</small>") + "</div>" +
      '<div class="small faint">' + (last.ts ? "Measured " + new Date(last.ts).toLocaleString() : "No reading") + "</div></article>"; }
    $("io-kpis").innerHTML = k("Soil moisture, 15 cm", last.sm15, "%") + k("Soil moisture, 30 cm", last.sm30, "%") + k("Soil temperature", last.st, "°C") + k("Air temperature", last.at, "°C");
    var labels = p.map(function (x) { var d = new Date(x.ts); return d.getDate() + "/" + (d.getMonth() + 1) + " " + String(d.getHours()).padStart(2, "0") + ":00"; });
    if (!p.length) { ["c-sm", "c-tp", "c-rh"].forEach(function (id) { if (FV.charts[id]) { FV.charts[id].destroy(); delete FV.charts[id]; } }); }
    else {
      var o = { interaction: { mode: "index", intersect: false }, scales: { x: { ticks: { maxTicksLimit: 8 } } } };
      FV.chart("c-sm", { type: "line", data: { labels: labels, datasets: [{ label: "15 cm (%)", data: p.map(function (x) { return x.sm15; }), borderColor: "#8B6A47", pointRadius: 0, borderWidth: 2 }, { label: "30 cm (%)", data: p.map(function (x) { return x.sm30; }), borderColor: "#1B4430", pointRadius: 0, borderWidth: 2 }] }, options: o });
      FV.chart("c-tp", { type: "line", data: { labels: labels, datasets: [{ label: "Soil (°C)", data: p.map(function (x) { return x.st; }), borderColor: "#8B6A47", pointRadius: 0, borderWidth: 2 }, { label: "Air (°C)", data: p.map(function (x) { return x.at; }), borderColor: "#C7652A", pointRadius: 0, borderWidth: 2 }] }, options: o });
      FV.chart("c-rh", { type: "line", data: { labels: labels, datasets: [{ label: "Humidity (%)", data: p.map(function (x) { return x.rh; }), borderColor: "#2F6F9F", pointRadius: 0, borderWidth: 2 }] }, options: o });
    }
    $("io-nodes").innerHTML = nodes.length ? nodes.map(function (n) { var stale = Date.now() - Date.parse(n.ts) > 2 * 3600000;
      return "<tr><td class=\"mono\">" + FV.esc(n.node_id) + "</td><td>" + (n.depth_cm ? n.depth_cm + " cm" : "Air") + "</td><td>" + ago(n.ts) + '</td><td class="n">' + (n.battery_v ? n.battery_v.toFixed(2) + " V" : "–") + '</td><td class="n">' + (n.rssi ? n.rssi + " dBm" : "–") + "</td><td>" +
        (stale ? '<span class="status err"><span class="dot"></span>Stale</span>' : '<span class="status ' + (series.demo ? "demo" : "ok") + '"><span class="dot"></span>' + (series.demo ? "Demo" : "Reporting") + "</span>") + "</td></tr>"; }).join("")
      : '<tr><td colspan="6" class="faint">No nodes reporting.</td></tr>';
    alerts();
  }

  function alerts() {
    var p = series.pts || [], last = p[p.length - 1], out = [], smin = +$("io-smin").value, tmax = +$("io-tmax").value;
    if (!last) { $("io-alerts").innerHTML = '<li class="faint small">No readings to check.</li>'; return; }
    var pre = series.demo ? "[DEMO] " : "";
    if (last.sm15 !== undefined && last.sm15 < smin) out.push(["dry", pre + "Soil moisture at 15 cm is " + last.sm15.toFixed(1) + "%, below your threshold of " + smin + "%."]);
    if (last.at !== undefined && last.at > tmax) out.push(["dry", pre + "Air temperature is " + last.at.toFixed(1) + " °C, above your threshold of " + tmax + " °C."]);
    nodes.forEach(function (n) { if (n.battery_v && n.battery_v < 3.3) out.push(["info", pre + "Node " + n.node_id + " battery is low (" + n.battery_v.toFixed(2) + " V)."]); });
    $("io-alerts").innerHTML = out.length ? out.map(function (a) { return '<li class="alert ' + a[0] + '"><span class="ic">' + FV.icon(FV.ICONS.warn) + "</span><div><strong>" + FV.esc(a[1]) + "</strong></div></li>"; }).join("") : '<li class="faint small">' + (series.demo ? "[DEMO] " : "") + "No thresholds crossed in the latest reading.</li>";
  }

  function setMode(m) {
    mode = m; FV.settings.iotDemo = m === "demo"; FV.saveSettings();
    document.querySelectorAll("[data-src]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-src") === m ? "true" : "false"); });
    if (timer) { clearInterval(timer); timer = null; }
    if (m === "demo") { banner("warn", "<strong>Demo mode.</strong> Every value on this page is simulated DEMO DATA generated in the browser. No field sensor is connected."); demo(); }
    else { live(); timer = setInterval(live, 60000); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-src]").forEach(function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-src")); }); });
    ["io-smin", "io-tmax"].forEach(function (id) { $(id).addEventListener("input", alerts); });
    setMode(FV.settings.iotEndpoint && !FV.settings.iotDemo ? "live" : (FV.settings.iotEndpoint ? "live" : "demo"));
  });
})();

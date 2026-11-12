/*
 * Farm Digital Twin.
 * A scenario is a crop calendar: plots (season, crop, sowing day, duration) plus a water assumption.
 * The twin draws the field month by month, draws the calendar for all three scenarios, and applies each
 * calendar to observed NASA POWER weather (FV.climate.windowExposure) to describe the conditions it would
 * have met. It does not estimate yield, income, soil health or water savings.
 */
(function () {
  "use strict";
  var FV = window.FV, R = window.FVRotations, RU = window.FVRules, C = FV.climate;
  var $ = function (id) { return document.getElementById(id); };
  var MONTHS = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
  var MSTART = [0, 30, 61, 92, 122, 153, 183, 214, 245, 273, 304, 334, 365];
  var FORTNIGHTS = [[152, "1 Jun"], [167, "16 Jun"], [182, "1 Jul"], [197, "16 Jul"], [213, "1 Aug"], [228, "16 Aug"], [244, "1 Sep"], [259, "16 Sep"], [274, "1 Oct"], [289, "16 Oct"], [305, "1 Nov"], [320, "16 Nov"], [335, "1 Dec"]];
  var KHARIF = ["redgram", "sorghumK", "bajra", "greengram", "soybean", "sunflower", "greenManure"];
  var RABI = ["chickpea", "sorghumR"];
  var SC = [
    { key: "A", label: "twin.current", color: "#B08A5E", preset: null, why: "Starts from the rotation in your farm profile." },
    { key: "B", label: "twin.adaptive", color: "#2F6F9F", preset: "R2", why: "Preset by the team: a sorghum and pigeonpea intercrop that the district plan lists for every kharif soil situation and keeps unchanged when the monsoon is delayed by two to six weeks. The label describes intent; it is not a proven adaptation." },
    { key: "C", label: "twin.restore", color: "#2F7D4F", preset: "R5", why: "Preset by the team: legumes in both seasons (green gram, then chickpea). Whether this restores soil is not measured or modelled here." }
  ];
  var state = { active: 0, month: 2, scen: [], farm: null, data: null, ystart: 2011, yend: null, exp: {} };

  function sd(doy) { return doy >= 152 ? doy - 152 : doy + 213; }
  function defaultSow(crop) {
    var c = R.CROPS[crop]; if (!c) return 167;
    if (c.window) { for (var i = 0; i < FORTNIGHTS.length; i++) if (FORTNIGHTS[i][0] >= c.window[0]) return FORTNIGHTS[i][0]; }
    return c.season === "rabi" ? 289 : 167;
  }
  function defaultDur(crop) { var c = R.CROPS[crop]; return c && c.dur ? c.dur[2] : null; }
  function plotsFromRotation(rot) {
    var p = [];
    (rot.kharif || []).forEach(function (k) { p.push({ season: "kharif", crop: k, sow: defaultSow(k), dur: defaultDur(k) }); });
    (rot.rabi || []).forEach(function (k) { p.push({ season: "rabi", crop: k, sow: defaultSow(k), dur: defaultDur(k) }); });
    if (rot.rabiNote) p.push({ season: "rabi", crop: null, sow: 289, dur: null, note: rot.rabiNote });
    if (!(rot.kharif || []).length) p.unshift({ season: "kharif", crop: null, sow: null, dur: null, note: "Fallow with in-situ moisture conservation" });
    return p;
  }
  function buildScenario(i, rotId) {
    var rot = RU.byId(rotId) || RU.byId("R1");
    return { rotId: rot.id, custom: false, plots: plotsFromRotation(rot), water: (state.farm.irrigation === "protective" || state.farm.irrigation === "irrigated") ? "protective" : "rainfed" };
  }
  function save() { try { sessionStorage.setItem("fv-twin", JSON.stringify({ scen: state.scen, active: state.active })); } catch (e) { /* not stored */ } }
  function restore() {
    try { var s = JSON.parse(sessionStorage.getItem("fv-twin")); if (s && s.scen && s.scen.length === 3) { state.scen = s.scen; state.active = s.active || 0; return; } } catch (e) { /* defaults */ }
    state.scen = SC.map(function (s, i) { return buildScenario(i, i === 0 ? (state.farm.rotation || "R1") : s.preset); });
  }
  function rotLike(s) {
    var rot = RU.byId(s.rotId);
    return { name: rot ? rot.name : "Custom", kharif: s.plots.filter(function (p) { return p.season === "kharif" && p.crop; }).map(function (p) { return p.crop; }),
      rabi: s.plots.filter(function (p) { return p.season === "rabi" && p.crop; }).map(function (p) { return p.crop; }),
      rabiNote: s.plots.some(function (p) { return p.season === "rabi" && !p.crop && p.note; }) ? "unspecified" : null,
      soils: s.custom ? null : rot.soils, contingencyOnly: !s.custom && rot.contingencyOnly };
  }

  /* ---------- exposure ---------- */
  function exposure(p, y0, y1) {
    if (!state.data || !p.crop || !p.dur || p.sow === null) return null;
    var k = p.crop + "|" + p.sow + "|" + p.dur + "|" + y0 + "|" + y1;
    if (!state.exp[k]) state.exp[k] = C.windowExposure(state.data, p.sow, p.dur, y0, y1);
    return state.exp[k];
  }
  function metrics(s) {
    var plots = s.plots.filter(function (p) { return p.crop && p.dur && p.sow !== null; });
    var kh = plots.filter(function (p) { return p.season === "kharif"; }), rb = plots.filter(function (p) { return p.season === "rabi"; });
    function longest(list) { return list.slice().sort(function (a, b) { return b.dur - a.dur; })[0] || null; }
    var kL = longest(kh), rL = longest(rb);
    var m = { cover: 0, kRain: null, kRainBase: null, rRain: null, rRainBase: null, dryRisk: null, dryRiskBase: null, hot: null, inWindow: [], overlap: false };
    var covered = new Array(12).fill(0);
    plots.forEach(function (p) {
      var a = sd(p.sow), b = a + p.dur;
      for (var mi = 0; mi < 12; mi++) { var lo = Math.max(a, MSTART[mi]), hi = Math.min(b, MSTART[mi + 1]); if (hi - lo >= 15) covered[mi] = 1; }
      var c = R.CROPS[p.crop];
      m.inWindow.push(c.window ? (p.sow >= c.window[0] && p.sow <= c.window[1] ? "yes" : "no") : "none");
    });
    m.cover = covered.reduce(function (a, b) { return a + b; }, 0);
    if (kh.length && rb.length) { var kEnd = Math.max.apply(null, kh.map(function (p) { return sd(p.sow) + p.dur; })); var rStart = Math.min.apply(null, rb.map(function (p) { return sd(p.sow); })); m.overlap = rStart < kEnd; }
    var y1 = state.yend;
    if (kL) { var e = exposure(kL, state.ystart, y1), eb = exposure(kL, 1991, 2010); if (e) { m.kRain = e.rain; m.hot = e.hot; } if (eb) m.kRainBase = eb.rain;
      var risks = kh.map(function (p) { var x = exposure(p, state.ystart, y1); return x ? x.dryRisk : null; }).filter(function (v) { return v !== null; });
      var risksB = kh.map(function (p) { var x = exposure(p, 1991, 2010); return x ? x.dryRisk : null; }).filter(function (v) { return v !== null; });
      m.dryRisk = risks.length ? Math.max.apply(null, risks) : null; m.dryRiskBase = risksB.length ? Math.max.apply(null, risksB) : null; }
    if (rL) { var er = exposure(rL, state.ystart, y1), erb = exposure(rL, 1991, 2010); if (er) { m.rRain = er.rain; m.hot = Math.max(m.hot || 0, er.hot); } if (erb) m.rRainBase = erb.rain; }
    return m;
  }
  function missing(s) {
    var out = [];
    s.plots.forEach(function (p) {
      var c = p.crop && R.CROPS[p.crop];
      if (!p.crop && p.note && p.season === "rabi") out.push("Rabi crop not specified by the plan for this system.");
      if (c && !c.window) out.push(c.name + ": sowing window not given in the district plan; the date used is a team assumption.");
      if (c && !c.dur) out.push(c.name + ": crop duration not available from the sources used, so its exposure is not calculated.");
      if (c && c.legume === null) out.push(c.name + ": species not specified, so legume status is unknown.");
    });
    if (metrics(s).overlap) out.push("The rabi crop is sown before the kharif crop is harvested on the same land. Change a sowing date or duration.");
    return out;
  }

  /* ---------- editor ---------- */
  function tabs() {
    $("tw-tabs").innerHTML = SC.map(function (s, i) {
      var rot = RU.byId(state.scen[i].rotId);
      return '<button role="tab" type="button" aria-selected="' + (i === state.active) + '" data-sc="' + i + '" style="--sc:' + s.color + '"><span class="eyebrow" style="color:' + s.color + '">' + s.key + "</span><strong>" + FV.esc(FV.t(s.label)) + "</strong>" + FV.esc(state.scen[i].custom ? "Custom" : rot.name) + "</button>";
    }).join("");
  }
  function cropOptions(season, sel) {
    var list = season === "kharif" ? KHARIF : RABI;
    return '<option value="">' + (season === "kharif" ? "Fallow" : "No rabi crop") + "</option>" + list.map(function (k) { return '<option value="' + k + '"' + (k === sel ? " selected" : "") + ">" + FV.esc(R.CROPS[k].name) + "</option>"; }).join("");
  }
  function editor() {
    var s = state.scen[state.active], meta = SC[state.active];
    var html = "<header><h3>Scenario " + meta.key + ": " + FV.esc(FV.t(meta.label)) + "</h3></header><p class=\"small muted\">" + FV.esc(meta.why) + "</p>";
    html += '<div class="field"><label for="tw-preset">Start from a district-plan rotation</label><select id="tw-preset">' + R.ROTATIONS.map(function (r) { return '<option value="' + r.id + '"' + (r.id === s.rotId ? " selected" : "") + ">" + FV.esc(r.name) + "</option>"; }).join("") + "</select>" +
      (s.custom ? '<span class="hint">Edited: this custom sequence is not checked against the plan\'s soil list.</span>' : "") + "</div>";
    s.plots.forEach(function (p, i) {
      var c = p.crop && R.CROPS[p.crop];
      html += '<fieldset style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><legend class="small" style="font-weight:600">' + FV.esc(FV.t("season." + p.season)) +
        (c ? ' <span class="crop-swatch" style="background:' + FV.cropColor(p.crop) + '"></span>' : "") + "</legend>";
      html += '<div class="field"><label for="tw-c' + i + '">Crop</label><select id="tw-c' + i + '" data-plot="' + i + '" data-k="crop">' + cropOptions(p.season, p.crop) + "</select></div>";
      if (c) {
        var w = c.window, inW = w ? p.sow >= w[0] && p.sow <= w[1] : null;
        html += '<div class="field" style="margin-top:8px"><label for="tw-s' + i + '">Sowing date</label><select id="tw-s' + i + '" data-plot="' + i + '" data-k="sow">' + FORTNIGHTS.map(function (f) {
          var mark = w ? (f[0] >= w[0] && f[0] <= w[1] ? " (in plan window)" : "") : ""; return '<option value="' + f[0] + '"' + (f[0] === p.sow ? " selected" : "") + ">" + f[1] + mark + "</option>"; }).join("") + "</select>" +
          '<span class="hint">' + (w ? (inW ? "Inside the plan's sowing window" : "Outside the plan's sowing window" + (c.windowNote ? " (" + c.windowNote + ")" : "")) : "No window in the district plan: assumed date") + "</span></div>";
        if (c.dur) {
          html += '<div class="field" style="margin-top:8px"><label for="tw-d' + i + '">Duration: <span class="num" id="tw-dv' + i + '">' + p.dur + "</span> days</label>" +
            '<input id="tw-d' + i + '" type="range" data-plot="' + i + '" data-k="dur" min="' + c.dur[0] + '" max="' + Math.max(c.dur[1], c.dur[0] + 1) + '" step="5" value="' + p.dur + '"' + (c.dur[0] === c.dur[1] ? " disabled" : "") + ">" +
            '<span class="hint">Variety range ' + c.dur[0] + (c.dur[1] !== c.dur[0] ? " to " + c.dur[1] : "") + ' days. <a href="' + c.src.url + '" target="_blank" rel="noopener">' + FV.esc(c.src.label) + "</a>" + (c.durNote ? ". " + FV.esc(c.durNote) : "") + "</span></div>";
        } else html += '<p class="small" style="margin-top:6px">' + FV.tag("missing") + " Duration not available.</p>";
      } else if (p.note) html += '<p class="small faint" style="margin-top:6px">' + FV.esc(p.note) + "</p>";
      html += "</fieldset>";
    });
    html += '<div class="field" style="margin-top:14px"><label for="tw-water">Water assumption</label><select id="tw-water"><option value="rainfed"' + (s.water === "rainfed" ? " selected" : "") + '>Rainfed</option><option value="protective"' + (s.water === "protective" ? " selected" : "") + '>Protective irrigation available</option></select><span class="hint">Recorded as an assumption; irrigation amounts are not modelled.</span></div>';
    html += '<div class="btn-row" style="margin-top:14px"><button class="btn btn-ghost btn-sm" type="button" id="tw-reset">Reset this scenario</button></div>';
    $("tw-editor").innerHTML = html;
    $("tw-preset").addEventListener("change", function () { state.scen[state.active] = buildScenario(state.active, this.value); refresh(); });
    $("tw-water").addEventListener("change", function () { s.water = this.value; refresh(true); });
    $("tw-reset").addEventListener("click", function () { state.scen[state.active] = buildScenario(state.active, state.active === 0 ? (state.farm.rotation || "R1") : SC[state.active].preset); refresh(); });
    $("tw-editor").querySelectorAll("[data-plot]").forEach(function (el) {
      el.addEventListener(el.type === "range" ? "input" : "change", function () {
        var p = s.plots[+el.getAttribute("data-plot")], k = el.getAttribute("data-k");
        if (k === "crop") { p.crop = el.value || null; p.sow = p.crop ? defaultSow(p.crop) : null; p.dur = p.crop ? defaultDur(p.crop) : null; p.note = null; s.custom = true; refresh(); }
        else if (k === "sow") { p.sow = +el.value; refresh(); }
        else { p.dur = +el.value; $("tw-dv" + el.getAttribute("data-plot")).textContent = p.dur; refresh(true); }
      });
    });
  }

  /* ---------- field view ---------- */
  function field() {
    var s = state.scen[state.active], mi = state.month, mid = MSTART[mi] + 15;
    var growing = s.plots.filter(function (p) { return p.crop && p.dur && p.sow !== null && mid >= sd(p.sow) && mid <= sd(p.sow) + p.dur; });
    var kh = growing.filter(function (p) { return p.season === "kharif"; }), rb = growing.filter(function (p) { return p.season === "rabi"; });
    var layer = kh.length ? kh : rb;
    var pattern = [null];
    if (layer.length === 1) pattern = [layer[0]];
    else if (layer.length > 1) { var rot = RU.byId(s.rotId), r = (!s.custom && rot && RU.ratio(rot)) || [1, 1]; pattern = []; for (var i = 0; i < r[0]; i++) pattern.push(layer[0]); for (var j = 0; j < r[1]; j++) pattern.push(layer[1]); }
    var N = 12, x0 = 30, y0 = 50, W = 580, H = 220, sw = W / N;
    var out = ['<rect x="' + x0 + '" y="' + y0 + '" width="' + W + '" height="' + H + '" rx="6" fill="#6B5440" stroke="#C4DE5A" stroke-width="2"/>'];
    for (var k = 0; k < N; k++) {
      var p = pattern[k % pattern.length], x = x0 + k * sw;
      out.push('<line x1="' + (x + sw / 2) + '" y1="' + (y0 + 6) + '" x2="' + (x + sw / 2) + '" y2="' + (y0 + H - 6) + '" stroke="#5A4535" stroke-width="2"/>');
      if (!p) continue;
      var f = Math.max(0, Math.min(1, (mid - sd(p.sow)) / p.dur)), col = FV.cropColor(p.crop);
      out.push('<rect x="' + (x + 2) + '" y="' + (y0 + 3) + '" width="' + (sw - 4) + '" height="' + (H - 6) + '" fill="' + col + '" opacity="' + (0.15 + 0.25 * f).toFixed(2) + '"/>');
      for (var row = 0; row < 9; row++) { var cy = y0 + 18 + row * 24; out.push('<circle cx="' + (x + sw / 2) + '" cy="' + cy + '" r="' + (2 + 7 * Math.sqrt(f)).toFixed(1) + '" fill="' + col + '" opacity="' + (0.55 + 0.45 * f).toFixed(2) + '"/>'); }
    }
    var title = growing.length ? growing.map(function (p) { var f = Math.round(Math.max(0, Math.min(1, (mid - sd(p.sow)) / p.dur)) * 100); return R.CROPS[p.crop].name + " (" + f + "% of season)"; }).join("  ·  ") : "No crop on the field";
    out.push('<text x="' + x0 + '" y="30" fill="#FFFFFF" font-size="16" font-weight="600">' + FV.esc(MONTHS[mi]) + "</text>");
    out.push('<text x="' + (x0 + 50) + '" y="30" fill="#CFE0D3" font-size="13">' + FV.esc(title) + "</text>");
    if (kh.length && rb.length) out.push('<text x="' + x0 + '" y="292" fill="#E9A970" font-size="12">Overlap: the rabi crop is on the calendar before the kharif crop is harvested.</text>');
    $("tw-field").innerHTML = out.join("");
    $("tw-month-label").textContent = MONTHS[mi];
    $("tw-active-name").textContent = SC[state.active].key + ", " + FV.t(SC[state.active].label);
    var info = "Strip layout is illustrative" + (layer.length > 1 ? " (intercrop row ratio from the plan)" : "") + ".";
    if (state.clim) { var m = (mi + 6 - 1) % 12; info = MONTHS[mi] + " rain at this location: " + Math.round(state.clim.base[m].mean) + " mm on average in 1991 to 2010, " + Math.round(state.clim.recent[m].mean) + " mm in " + state.ystart + " to " + state.yend + ". " + info; }
    $("tw-month-info").textContent = info;
  }

  /* ---------- timeline ---------- */
  function timeline() {
    var L0 = 170, W = 720, px = W / 365, out = [];
    function X(d) { return L0 + d * px; }
    for (var mi = 0; mi < 12; mi++) {
      out.push('<line x1="' + X(MSTART[mi]) + '" y1="8" x2="' + X(MSTART[mi]) + '" y2="352" stroke="#ECE9DF"/>');
      out.push('<text x="' + (X(MSTART[mi]) + 4) + '" y="20" font-size="11" fill="#4E5B52">' + MONTHS[mi] + "</text>");
    }
    out.push('<text x="8" y="58" font-size="11" fill="#4E5B52">Monthly rain (mm)</text><text x="8" y="100" font-size="11" fill="#4E5B52">Hot days, recent</text>');
    if (state.clim) {
      var mx = Math.max.apply(null, state.clim.base.concat(state.clim.recent).map(function (m) { return m.mean || 0; }));
      for (var i = 0; i < 12; i++) {
        var m = (i + 5) % 12, b = state.clim.base[m].mean || 0, r = state.clim.recent[m].mean || 0, x = X(MSTART[i]) + 6, w = (MSTART[i + 1] - MSTART[i]) * px / 2 - 6;
        out.push('<rect x="' + x + '" y="' + (84 - b / mx * 56) + '" width="' + w + '" height="' + (b / mx * 56) + '" fill="#B08A5E"><title>' + MONTHS[i] + " 1991 to 2010: " + Math.round(b) + " mm</title></rect>");
        out.push('<rect x="' + (x + w + 2) + '" y="' + (84 - r / mx * 56) + '" width="' + w + '" height="' + (r / mx * 56) + '" fill="#2F6F9F"><title>' + MONTHS[i] + " " + state.ystart + " onward: " + Math.round(r) + " mm</title></rect>");
        var h = state.clim.hot[m] || 0;
        out.push('<rect x="' + X(MSTART[i]) + '" y="92" width="' + (MSTART[i + 1] - MSTART[i]) * px + '" height="12" fill="#C7652A" opacity="' + Math.min(1, h / 20).toFixed(2) + '"><title>' + MONTHS[i] + ": " + h.toFixed(1) + " days at or above 35 C on average</title></rect>");
      }
    }
    var y = 122;
    state.scen.forEach(function (s, si) {
      var meta = SC[si];
      out.push('<text x="8" y="' + (y + 12) + '" font-size="12" font-weight="600" fill="' + meta.color + '">' + meta.key + ". " + FV.esc(FV.t(meta.label)) + "</text>");
      y += 18;
      s.plots.forEach(function (p) {
        var c = p.crop && R.CROPS[p.crop];
        out.push('<text x="16" y="' + (y + 13) + '" font-size="11" fill="#142019">' + FV.esc(c ? c.name.split(" (")[0] : (p.season === "kharif" ? "Kharif fallow" : "Rabi: unspecified")) + "</text>");
        if (c && c.window) out.push('<rect x="' + X(sd(c.window[0])) + '" y="' + (y + 1) + '" width="' + (c.window[1] - c.window[0]) * px + '" height="18" fill="#E8E4D6" rx="2"/>');
        if (c && p.dur && p.sow !== null) {
          var a = sd(p.sow), e = Math.min(365, a + p.dur);
          out.push('<rect x="' + X(a) + '" y="' + (y + 4) + '" width="' + (e - a) * px + '" height="12" fill="' + FV.cropColor(p.crop) + '" rx="2"><title>' + FV.esc(c.name) + ": sown " + FORTNIGHTS.filter(function (f) { return f[0] === p.sow; }).map(function (f) { return f[1]; })[0] + ", about " + p.dur + " days</title></rect>");
          if (a + p.dur > 365) out.push('<text x="' + (X(365) - 4) + '" y="' + (y + 14) + '" font-size="10" text-anchor="end" fill="#fff">→</text>');
        } else if (c) out.push('<text x="' + X(sd(p.sow || 167)) + '" y="' + (y + 13) + '" font-size="10" fill="#7A857D">duration unknown</text>');
        y += 22;
      });
      y += 6;
    });
    $("tw-timeline").setAttribute("viewBox", "0 0 900 " + Math.max(200, y + 8));
    $("tw-timeline").innerHTML = out.join("");
  }

  /* ---------- comparison ---------- */
  function compare() {
    var M = state.scen.map(metrics), soil = state.farm.soil;
    function bar(v, max, si) { return '<div class="bar" style="--sc:' + SC[si].color + '"><i style="width:' + (max ? Math.max(2, v / max * 100) : 0) + '%"></i></div>'; }
    function row(label, cells, tag) { return '<div class="cmp-row"><div>' + label + (tag ? " " + tag : "") + "</div>" + cells.map(function (c) { return '<div class="cmp-cell">' + c + "</div>"; }).join("") + "</div>"; }
    var head = '<div class="cmp-row head"><div>Indicator</div>' + SC.map(function (s) { return '<div style="color:' + s.color + '">' + s.key + ". " + FV.esc(FV.t(s.label)) + "</div>"; }).join("") + "</div>";
    function maxOf(f) { return Math.max.apply(null, M.map(function (m) { return m[f] || 0; })); }
    var rows = [head];
    rows.push(row("Crops", state.scen.map(function (s) { var r = rotLike(s); return '<span class="small">' + FV.esc(RU.cropNames(r.kharif)) + " / " + FV.esc(r.rabi.length ? RU.cropNames(r.rabi) : r.rabiNote ? "unspecified" : "none") + "</span>"; })));
    rows.push(row("Legume in sequence", state.scen.map(function (s) { var l = RU.legumeStatus(rotLike(s)); return l === true ? "Yes" : l === null ? "Unknown" : "No"; }), FV.tag("obs", "Fact")));
    rows.push(row("Months with a crop on the field", M.map(function (m, i) { return m.cover + " of 12" + bar(m.cover, 12, i); }), FV.tag("sim")));
    var kr = maxOf("kRain");
    rows.push(row("Rain during the kharif crop window", M.map(function (m, i) { return m.kRain === null ? FV.tag("missing") : Math.round(m.kRain) + " mm <span class=\"faint small\">(" + Math.round(m.kRainBase) + " in 1991 to 2010)</span>" + bar(m.kRain, kr, i); }), FV.tag("sim")));
    var rr = maxOf("rRain");
    rows.push(row("Rain during the rabi crop window", M.map(function (m, i) { return m.rRain === null ? '<span class="faint small">No rabi crop</span>' : Math.round(m.rRain) + " mm <span class=\"faint small\">(" + Math.round(m.rRainBase) + " before)</span>" + bar(m.rRain, rr, i); }), FV.tag("sim")));
    rows.push(row("Years with a 14-day dry spell in the first month after kharif sowing", M.map(function (m, i) { return m.dryRisk === null ? '<span class="faint small">n/a</span>' : Math.round(m.dryRisk * 100) + "% <span class=\"faint small\">(" + Math.round(m.dryRiskBase * 100) + "% before)</span>" + bar(m.dryRisk, 1, i); }), FV.tag("sim")));
    var hm = maxOf("hot");
    rows.push(row("Days at or above 35 °C while the crop is in the field", M.map(function (m, i) { return m.hot === null ? '<span class="faint small">n/a</span>' : m.hot.toFixed(0) + " days" + bar(m.hot, hm, i); }), FV.tag("sim")));
    rows.push(row("Sowing inside the plan's window", M.map(function (m) { if (!m.inWindow.length) return "n/a"; var y = m.inWindow.filter(function (x) { return x === "yes"; }).length, n = m.inWindow.filter(function (x) { return x === "no"; }).length, z = m.inWindow.length - y - n;
      return y + " of " + m.inWindow.length + (n ? ' <span style="color:var(--heat)">(' + n + " outside)</span>" : "") + (z ? ' <span class="faint small">(' + z + " not given)</span>" : ""); }), FV.tag("gov", "ICAR-CRIDA")));
    rows.push(row("Listed for this farm's soil", state.scen.map(function (s) { var r = rotLike(s); if (!soil) return FV.tag("missing"); if (!r.soils) return '<span class="faint small">Custom, not checked</span>'; return RU.soilMatch(r, soil) ? "Yes" : '<span style="color:var(--heat)">No</span>'; }), FV.tag("gov", "ICAR-CRIDA")));
    rows.push(row("Water assumption", state.scen.map(function (s) { return s.water === "protective" ? "Protective irrigation" : "Rainfed"; }), FV.tag("farmer")));
    rows.push(row("Missing information", state.scen.map(function (s) { var n = missing(s).length + (soil ? 0 : 1); return n ? '<span style="color:var(--heat)">' + n + " item" + (n > 1 ? "s" : "") + "</span>" : "None"; })));
    $("tw-cmp").innerHTML = rows.join("");

    var base = rotLike(state.scen[0]), m0 = M[0];
    $("tw-changes").innerHTML = [1, 2].map(function (i) {
      var r = rotLike(state.scen[i]), m = M[i], items = RU.changes(r, base, soil);
      if (m.cover !== m0.cover) items.push(["neu", "Field is planted " + m.cover + " months a year instead of " + m0.cover + "."]);
      if (m.dryRisk !== null && m0.dryRisk !== null && Math.abs(m.dryRisk - m0.dryRisk) >= 0.05) items.push([m.dryRisk > m0.dryRisk ? "neg" : "pos", "Early dry-spell exposure after kharif sowing: " + Math.round(m.dryRisk * 100) + "% of recent years, against " + Math.round(m0.dryRisk * 100) + "% for the current rotation."]);
      if (m.overlap) items.push(["neg", "Calendar conflict: rabi sowing overlaps the kharif crop."]);
      return '<div><h4 style="color:' + SC[i].color + '">' + SC[i].key + ". " + FV.esc(FV.t(SC[i].label)) + "</h4><ul class=\"check-list\">" + items.map(function (x) {
        return '<li class="' + x[0] + '">' + FV.icon(x[0] === "pos" ? FV.ICONS.check : x[0] === "neg" ? FV.ICONS.warn : FV.ICONS.minus) + "<span>" + FV.esc(x[1]) + "</span></li>"; }).join("") + "</ul></div>";
    }).join("");

    var ass = ["Crop durations are variety ranges from published lists (linked in the editor); actual duration depends on variety and season.",
      "Weather comes from one NASA POWER grid point (about 50 km) at " + C.DEFAULT.lat + " N, " + C.DEFAULT.lon + " E. Exposure averages use " + state.ystart + " to " + state.yend + "; values in brackets use 1991 to 2010.",
      "A dry spell is consecutive days with less than 2.5 mm of rain, following the district plan's definition. Hot days are days with a maximum of 35 °C or more.",
      "Intercrop strips follow the row ratio named in the plan and are drawn for illustration only.",
      "Water assumptions are recorded but irrigation is not modelled, so exposure figures do not change with them."];
    $("tw-assume").innerHTML = ass.map(function (a) { return "<li>" + FV.esc(a) + "</li>"; }).join("");
    var miss = []; if (!soil) miss.push("Farm soil situation (needed to check rotations against the plan). Add it in My Farm.");
    if (!state.farm.ph) miss.push("Soil pH and organic carbon from a Soil Health Card.");
    if (!state.data) miss.push("NASA POWER weather (could not be loaded), so exposure rows are empty.");
    state.scen.forEach(function (s, i) { missing(s).forEach(function (t) { miss.push(SC[i].key + ": " + t); }); });
    miss.push("Market prices, input costs and labour are outside this tool.");
    $("tw-missing").innerHTML = miss.map(function (a) { return "<li>" + FV.esc(a) + "</li>"; }).join("");
  }

  function farmPanel() {
    var f = state.farm;
    $("tw-farm").innerHTML = "<div>" + FV.esc(f.name || "Unnamed farm") + " " + FV.tag(f.demo ? "demo" : "farmer") + "</div><div>Soil: " + (f.soil ? FV.esc(R.SOILS[f.soil]) : FV.tag("missing")) + "</div><div>Water: " + FV.esc(f.irrigation || "not given") + "</div>";
  }

  function refresh(keepEditor) {
    save(); tabs(); if (!keepEditor) editor(); field(); timeline(); compare();
    var M = metrics(state.scen[state.active]);
    $("tw-stats").innerHTML = [["Scenario", SC[state.active].key + ". " + FV.t(SC[state.active].label)], ["Months planted", M.cover + " of 12"], ["Weather years", state.data ? state.ystart + " to " + state.yend : "n/a"]]
      .map(function (s) { return '<div class="band-stat"><div class="k">' + FV.esc(s[0]) + '</div><div class="v">' + FV.esc(s[1]) + "</div></div>"; }).join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    state.farm = FV.getFarm();
    state.yend = new Date().getFullYear() - 1;
    restore(); farmPanel(); refresh();
    $("tw-tabs").addEventListener("click", function (e) { var b = e.target.closest("[data-sc]"); if (!b) return; state.active = +b.getAttribute("data-sc"); refresh(); });
    $("tw-month").value = state.month;
    $("tw-month").addEventListener("input", function () { state.month = +this.value; field(); });
    var timer = null;
    $("tw-play").addEventListener("click", function () {
      if (timer) { clearInterval(timer); timer = null; return; }
      state.month = 0; $("tw-month").value = 0; field();
      timer = setInterval(function () { state.month++; if (state.month > 11) { clearInterval(timer); timer = null; state.month = 11; } $("tw-month").value = state.month; field(); }, 800);
    });
    C.load().then(function (d) {
      state.data = d; var last = d.days[d.days.length - 1]; if (last.y <= state.yend) state.yend = last.y - 1;
      var hot = []; for (var m = 1; m <= 12; m++) { var v = []; for (var y = state.ystart; y <= state.yend; y++) { var l = d.byYear[y]; if (l) v.push(l.filter(function (r) { return r.m === m && r.tx !== null && r.tx >= 35; }).length); } hot.push(C.mean(v)); }
      state.clim = { base: C.monthlyClimatology(d, 1991, 2010), recent: C.monthlyClimatology(d, state.ystart, state.yend), hot: hot };
      refresh(true);
    }).catch(function (e) { $("tw-climate-msg").hidden = false; $("tw-climate-t").textContent = "NASA POWER weather unavailable (" + e.message + "). Calendars still work; exposure rows stay empty."; });
    FV.onChange.push(function () { refresh(); });
    document.addEventListener("fv:tour", function (e) { if (e.detail === 4) { state.active = 1; refresh(); } });
    if (FV.tourStep() === 4) { state.active = 1; refresh(); }
  });
})();

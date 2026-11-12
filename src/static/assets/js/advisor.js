/* AI Farm Advisor: a transparent rule-based assistant over the app's own data. No language model; no invented figures. */
(function () {
  "use strict";
  var FV = window.FV, R = window.FVRotations, RU = window.FVRules, C = FV.climate;
  var $ = function (id) { return document.getElementById(id); };
  var D = { ready: false };
  var TOPICS = [
    ["rain", ["rain", "rainfall", "monsoon", "precip", "ಮಳೆ", "बारिश", "वर्षा", "मानसून"]],
    ["dry", ["dry spell", "dry", "drought", "ಒಣ", "सूखा", "सूखे"]],
    ["veg", ["vegetation", "ndvi", "evi", "green", "crop condition", "ಸಸ್ಯ", "वनस्पति", "हरियाली"]],
    ["soil", ["soil moisture", "moisture", "wet", "smap", "ತೇವ", "नमी"]],
    ["heat", ["hot", "heat", "temperature", "warm", "ಬಿಸಿ", "ತಾಪ", "गर्मी", "तापमान"]],
    ["rot", ["rotation", "compare", "sequence", "which crop", "ಸರದಿ", "फसल चक्र", "तुलना"]],
    ["missing", ["missing", "unknown", "before i decide", "what information", "ಕೊರತೆ", "अनुपलब्ध", "कम है"]],
    ["yield", ["yield", "harvest", "production", "expect", "ಇಳುವರಿ", "उपज", "उत्पादन"]],
    ["expert", ["officer", "expert", "discuss", "kvk", "ಅಧಿಕಾರಿ", "अधिकारी", "चर्चा"]],
    ["sources", ["source", "where does", "data come", "nasa data", "ಮೂಲ", "स्रोत"]]
  ];
  var CHIPS = [["rain", "adv.q.rain"], ["dry", "adv.q.dry"], ["veg", "adv.q.veg"], ["soil", "adv.q.soil"], ["heat", "adv.q.heat"], ["rot", "adv.q.rot"], ["yield", "adv.q.yield"], ["missing", "adv.q.missing"], ["expert", "adv.q.expert"]];

  function topic(q) {
    q = q.toLowerCase(); var best = null, bestLen = 0;
    TOPICS.forEach(function (t) { t[1].forEach(function (k) { if (q.indexOf(k) > -1 && k.length > bestLen) { best = t[0]; bestLen = k.length; } }); });
    return best;
  }
  function sec(key, items) { return items && items.length ? "<h4>" + FV.esc(FV.t(key)) + "</h4><ul>" + items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>" : ""; }
  function answer(parts) {
    var lead = parts.lead ? "<p>" + parts.lead + "</p>" : "";
    var note = FV.settings.lang !== "en" ? '<p class="small faint">' + FV.esc(FV.t("adv.enNote")) + "</p>" : "";
    return lead + note + sec("adv.h.data", parts.data) + sec("adv.h.why", parts.why) + sec("adv.h.options", parts.options) + sec("adv.h.risks", parts.risks) + sec("adv.h.missing", parts.missing) +
      (parts.links ? '<p class="small">' + parts.links + "</p>" : "");
  }
  function farmMissing() {
    var f = D.farm, m = [];
    if (f.demo) m.push("This is the demonstration farm. Your own farm details have not been entered.");
    if (!f.soil) m.push("Soil situation (needed to check rotations against the district plan).");
    if (!f.ph) m.push("Soil test values such as pH and organic carbon (Soil Health Card).");
    if (!f.irrigation) m.push("Whether the farm has irrigation.");
    if (!f.rotation) m.push("The current rotation.");
    if (!FV.settings.iotEndpoint) m.push("Field sensor readings (no gateway connected).");
    return m;
  }

  var H = {
    rain: function () {
      var s = D.status; if (!s) return answer({ lead: "NASA POWER rainfall data is not available right now, so I cannot answer this.", missing: ["NASA POWER data"] });
      var p = s.jjasPct, key = p < 90 ? "alert.rainLow" : p > 110 ? "alert.rainHigh" : "alert.rainNormal";
      return answer({ lead: FV.esc(FV.t(key, { pct: Math.round(p) })),
        data: [FV.tag("obs") + " June to September " + s.jjasYear + ": " + Math.round(s.jjas) + " mm at the pilot point, against a 1991 to 2020 average of " + Math.round(s.normalJJAS) + " mm.",
          FV.tag("obs") + " Data runs to " + s.lastDay.slice(0, 4) + "-" + s.lastDay.slice(4, 6) + "-" + s.lastDay.slice(6) + " (NASA POWER, MERRA-2 based, about 50 km grid)."],
        why: ["Kharif crops such as pigeonpea depend on monsoon rain, and rainfed rabi crops depend on the moisture it stores in the soil."],
        options: ["Look at the month-by-month pattern on Climate Analytics: a total close to normal can still hide a dry month.", "Compare how each rotation's crop window would have met this rainfall in the Digital Twin."],
        risks: ["The value describes a grid cell of about 50 km, not your field. Local rain can differ a lot."],
        links: '<a href="climate.html">Climate Analytics</a> · <a href="twin.html">Digital Twin</a>' });
    },
    dry: function () {
      var s = D.status; if (!s) return answer({ lead: "NASA POWER data is not available, so dry spells cannot be measured.", missing: ["NASA POWER data"] });
      var longer = s.dry > s.normalDry + 0.5;
      return answer({ lead: FV.esc(FV.t(longer ? "alert.dryLong" : "alert.dryShort", { d: s.dry, b: Math.round(s.normalDry) })),
        data: [FV.tag("obs") + " A dry spell here is consecutive days with less than 2.5 mm of rain in June to September, the definition used in the ICAR-CRIDA district plan.", FV.tag("obs") + " Longest spell in " + s.jjasYear + ": " + s.dry + " days; 1991 to 2020 average: " + s.normalDry.toFixed(1) + " days."],
        why: ["The plan treats two rainless weeks in the season as a mid-season drought, when young or flowering crops are most sensitive."],
        options: ["Measures the district plan lists for mid-season dry spells: thinning alternate rows of sorghum or bajra, repeated intercultivation, conservation furrows and protective irrigation where available.", "In the Digital Twin, check how often a 14-day dry spell followed sowing for each scenario."],
        risks: ["Dry spells are measured at one grid point; your field may have had more or less rain."],
        links: '<a href="climate.html">Climate Analytics</a> · <a href="twin.html">Digital Twin</a>' });
    },
    veg: function () {
      var g = D.gibs; if (!g) return answer({ lead: "Satellite vegetation data is not available.", missing: ["MODIS series"] });
      var nd = FV.series.latest(g.ndvi), n = FV.series.sameDateNormal(g.ndvi, nd.date, 2001, +nd.date.slice(0, 4) - 1);
      var k = nd.value < n.p10 ? "alert.vegLow" : nd.value > n.p90 ? "alert.vegHigh" : "alert.vegNormal";
      return answer({ lead: FV.esc(FV.t(k, { v: nd.value.toFixed(2), n: n.mean.toFixed(2) })),
        data: [FV.tag("obs") + " MODIS Terra 16-day NDVI composite of " + nd.date + ": district mean " + nd.value.toFixed(2) + "; usual for this date " + n.mean.toFixed(2) + " (10th to 90th percentile " + n.p10.toFixed(2) + " to " + n.p90.toFixed(2) + ", " + n.n + " years).",
          FV.tag("obs") + " The 250 m pixel containing the demonstration field: " + (nd.field === null ? "no value" : nd.field.toFixed(2)) + "."],
        why: ["Higher NDVI means more green leaf cover in the composite. It helps to see whether the season is greening as usual."],
        risks: ["NDVI does not measure crop health, nutrients or yield directly. Weeds, trees and cloud also affect it.", "One MODIS pixel is about 300 m and includes neighbouring fields."],
        links: '<a href="nasa.html">NASA Intelligence</a> · <a href="map.html">Farm Map</a>' });
    },
    soil: function () {
      var g = D.gibs, sm = g && FV.series.latest(g.smap);
      if (!sm) return answer({ lead: "Satellite soil moisture is not available.", missing: ["SMAP series"] });
      var n = FV.series.sameDateNormal(g.smap, sm.date, 2015, +sm.date.slice(0, 4) - 1);
      var k = sm.value < n.p10 ? "alert.soilDry" : sm.value > n.p90 ? "alert.soilWet" : "alert.soilNormal";
      var data = [FV.tag("obs") + " SMAP Level 4 surface soil moisture (top 5 cm, 9 km) on " + sm.date + ": " + sm.value.toFixed(2) + " m³/m³; usual for this date since 2015: " + (n.mean === null ? "n/a" : n.mean.toFixed(2)) + "."];
      if (D.status && D.status.gwettop !== null) data.push(FV.tag("model") + " NASA POWER modelled surface wetness (0 dry to 1 saturated): " + D.status.gwettop.toFixed(2) + ".");
      return answer({ lead: FV.esc(FV.t(k)), data: data,
        why: ["Moisture stored after the monsoon decides how well rainfed rabi crops such as chickpea and rabi sorghum can establish."],
        risks: ["SMAP Level 4 combines satellite observations with a model and averages over 9 km. It is not a reading from your field.", "The record starts in 2015, so 'usual' is based on few years."],
        missing: FV.settings.iotEndpoint ? [] : ["Field sensor readings: no gateway is connected, so there is no measurement at a known depth."],
        links: '<a href="nasa.html">NASA Intelligence</a> · <a href="iot.html">IoT Monitoring</a>' });
    },
    heat: function () {
      var d = D.power; if (!d) return answer({ lead: "Temperature data is not available.", missing: ["NASA POWER data"] });
      var ys = C.range(1991, new Date().getFullYear() - 1), tx = ys.map(function (y) { return C.annualMean(d, y, "tx"); }), sl = C.slope(ys, tx);
      var hb = C.mean(C.range(1991, 2010).map(function (y) { return C.hotDays(d, y, 40); })), hr = C.mean(C.range(2011, ys[ys.length - 1]).map(function (y) { return C.hotDays(d, y, 40); }));
      return answer({ lead: "Daytime temperatures at the pilot point have changed by about " + FV.signed(sl * 10, 2) + " °C per decade since 1991.",
        data: [FV.tag("obs") + " Days at or above 40 °C: " + hb.toFixed(1) + " per year in 1991 to 2010, " + hr.toFixed(1) + " per year from 2011.", FV.tag("obs") + " Last 30 days: average maximum " + D.status.tx30.toFixed(1) + " °C, " + FV.signed(D.status.tx30 - D.status.tx30Normal, 1) + " °C against normal for those dates."],
        why: ["The Digital Twin counts hot days inside each crop's calendar window, so scenarios with different sowing dates can be compared on heat exposure."],
        risks: ["The trend is a straight-line fit with no significance test, at one grid point."],
        links: '<a href="climate.html">Climate Analytics</a>' });
    },
    rot: function () {
      var f = D.farm, cur = RU.byId(f.rotation) || RU.byId("R1");
      var alts = f.soil ? R.ROTATIONS.filter(function (r) { return r.id !== cur.id && r.soils.indexOf(f.soil) > -1 && !r.contingencyOnly; }) : [];
      var data = [FV.tag(f.demo ? "demo" : "farmer") + " Current rotation: " + FV.esc(cur.name) + "."];
      if (!f.soil) return answer({ lead: "I cannot compare rotations for this farm yet, because its soil situation is not known.", data: data, missing: farmMissing(), links: '<a href="farm.html">My Farm</a> · <a href="rotation.html">Crop Rotation</a>' });
      var alt = alts[0];
      data.push(FV.tag("gov", "ICAR-CRIDA") + " For " + FV.esc(R.SOILS[f.soil]) + " the plan lists " + alts.length + " other normal systems: " + alts.map(function (r) { return FV.esc(r.name); }).join("; ") + ".");
      var ch = alt ? RU.changes(alt, cur, f.soil).map(function (c) { return FV.esc(c[1]); }) : [];
      return answer({ lead: alt ? "One option the district plan lists for your soil is " + FV.esc(alt.name) + ". Here is how it differs from your current rotation." : "The plan lists no other normal system for this soil situation.",
        data: data, why: ch, options: ["Open the Digital Twin to see each scenario's crop calendar against 35 years of observed weather.", "Use the Crop Rotation planner to test a two-year sequence."],
        risks: ["The comparison uses one district plan from 2011 and does not account for prices, inputs or labour. Rotations are not ranked."],
        missing: farmMissing(), links: '<a href="rotation.html">Crop Rotation</a> · <a href="twin.html">Digital Twin</a>' });
    },
    missing: function () {
      return answer({ lead: "Before deciding, these pieces of information are still missing or uncertain:", missing: farmMissing().concat(["Seed availability, market prices and input costs (outside this tool).", "Local pest and disease pressure this season.", "Your own experience of how this field behaves in dry and wet years."]),
        options: ["Fill in My Farm; pages that need a detail tell you when it is missing.", "Bring your Soil Health Card to the Krishi Vigyan Kendra."], links: '<a href="farm.html">My Farm</a>' });
    },
    yield: function () {
      var f = D.farm, key = f.currentCrop === "chickpea" ? "gram" : f.currentCrop === "sorghumR" ? "jowar_rabi" : "tur";
      var s = D.crop && D.crop.crops[key], m = D.model && D.model.models[key];
      if (!s) return answer({ lead: "District crop statistics are not available.", missing: ["Crop statistics"] });
      var rows = s.rows.filter(function (r) { return !r.flag; }), recent = rows.slice(-5), avg = recent.reduce(function (a, r) { return a + r.yield_t_ha; }, 0) / recent.length;
      var data = [FV.tag("gov") + " " + FV.esc(s.label) + ", Kalaburagi district: average " + avg.toFixed(2) + " t/ha over the last five reported seasons (" + recent[0].year + " to " + recent[recent.length - 1].year + ")."];
      var risks = ["District averages are not a prediction for your farm; individual fields vary widely."];
      if (m && m.in_season_estimate) { var e = m.in_season_estimate; data.push(FV.tag("model") + " Experimental district estimate for the season starting " + e.season_year + ": " + e.yield_t_ha.toFixed(2) + " t/ha (80% range " + e.interval_80[0].toFixed(2) + " to " + e.interval_80[1].toFixed(2) + ")."); risks.push(e.beats_all_baselines ? "The estimating model only slightly beat simple baselines in testing." : "In testing the estimating model did not beat a simple baseline, so this number is not reliable."); }
      return answer({ lead: "I cannot predict the yield of your farm. I can show what the district has recorded.", data: data, risks: risks, missing: ["Farm-level yield records, which would be needed to say anything about your field.", "The team's Sentinel-2 yield pipeline is not connected yet."], links: '<a href="crops.html">Crop Intelligence</a>' });
    },
    expert: function () {
      var items = [];
      if (D.status) items.push("This year's monsoon rainfall was " + Math.round(D.status.jjasPct) + "% of the 1991 to 2020 average at the pilot point, and the longest dry spell was " + D.status.dry + " days.");
      var f = D.farm, cur = RU.byId(f.rotation); if (cur) items.push("Whether " + FV.esc(cur.name) + " still suits your soil and water, and which alternatives listed in the district contingency plan are realistic for you.");
      items.push("Varieties suited to the sowing window you can manage, and their duration.", "Your Soil Health Card results and what they mean for the next crop.", "Pest and disease risks this season for the crops you are considering.");
      return answer({ lead: "Points worth raising with an agricultural officer or the Krishi Vigyan Kendra:", options: items, risks: ["FARMVERSE gives evidence, not instructions. Doses of fertiliser, pesticide or water should come from a qualified adviser."], links: '<a href="reports.html">Print a farm report to take along</a>' });
    },
    sources: function () {
      return answer({ lead: "Every number in this app comes from a named source:", data: ["NASA POWER daily rainfall, temperature and modelled soil wetness, 1991 to present.", "NASA GIBS imagery: MODIS NDVI and EVI since 2001, SMAP Level 4 soil moisture since 2015, GPM IMERG rainfall and MODIS land surface temperature.",
        "District crop area and yield from DES and UPAG via the India Data Portal.", "Cropping systems, sowing windows and drought measures from the ICAR-CRIDA contingency plan for Gulbarga district."], links: '<a href="data-sources.html">Data Sources</a>' });
    }
  };

  function say(cls, html) { var d = document.createElement("div"); d.className = "msg " + cls; d.innerHTML = html; $("ad-log").appendChild(d); d.scrollIntoView({ block: "end", behavior: "smooth" }); }
  function ask(q, forced) {
    q = (q || "").trim(); if (!q) return;
    say("user", FV.esc(q));
    if (!D.ready) { say("bot", "<p>" + FV.esc(FV.t("c.loading")) + "...</p>"); return; }
    var t = forced || topic(q);
    say("bot", t ? H[t]() : "<p>" + FV.esc(FV.t("adv.unknown")) + "</p>");
  }
  function chips() { $("ad-chips").innerHTML = CHIPS.map(function (c) { return '<button class="chip" type="button" data-t="' + c[0] + '" data-k="' + c[1] + '">' + FV.esc(FV.t(c[1])) + "</button>"; }).join(""); }

  document.addEventListener("DOMContentLoaded", function () {
    D.farm = FV.getFarm(); chips();
    $("ad-chips").addEventListener("click", function (e) { var b = e.target.closest("[data-t]"); if (b) ask(FV.t(b.getAttribute("data-k")), b.getAttribute("data-t")); });
    $("ad-form").addEventListener("submit", function (e) { e.preventDefault(); ask($("ad-q").value); $("ad-q").value = ""; });
    say("bot", "<p>" + FV.esc(FV.t("sub.advisor")) + "</p>");
    Promise.all([C.load().then(function (d) { D.power = d; D.status = C.currentStatus(d); }).catch(function () {}),
      FV.series.load().then(function (g) { D.gibs = g; }).catch(function () {}),
      FV.data.get("crop_stats.json").then(function (c) { D.crop = c; }).catch(function () {}),
      FV.data.get("yield_model.json").then(function (m) { D.model = m; }).catch(function () {})]).then(function () {
      D.ready = true;
      if (FV.tourStep() === 6) ask(FV.t("adv.q.missing"), "missing");
    });
    FV.onChange.push(chips);
  });
})();

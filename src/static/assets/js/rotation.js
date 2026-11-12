/* Crop Rotation: side-by-side comparison (from version 1), two-year planner and soil shortlist. */
(function () {
  "use strict";
  var FV = window.FV, R = window.FVRotations, RU = window.FVRules;
  var $ = function (id) { return document.getElementById(id); };
  var climate = null, farm;
  function icon(k) { return FV.icon(k === "pos" ? FV.ICONS.check : k === "neg" ? FV.ICONS.warn : FV.ICONS.minus); }
  function list(items) { return '<ul class="check-list">' + items.map(function (i) { return '<li class="' + i[0] + '">' + icon(i[0]) + "<span>" + FV.esc(i[1]) + "</span></li>"; }).join("") + "</ul>"; }
  function prof() { return { soil: $("ro-soil").value, leg: $("ro-p-leg").checked, two: $("ro-p-two").checked, one: $("ro-p-one").checked, ids: [$("ro-a").value, $("ro-b").value, $("ro-c").value] }; }
  function prio(rot, p) {
    var o = [];
    if (p.leg) { var l = RU.legumeStatus(rot); o.push(l === true ? ["pos", "Includes a legume."] : l === null ? ["neu", "Legume depends on species."] : ["neg", "No legume."]); }
    if (p.two) o.push(RU.usesBothSeasons(rot) ? ["pos", "Uses both seasons."] : ["neg", "Single season."]);
    if (p.one) o.push(!RU.usesBothSeasons(rot) ? ["pos", "One season per year."] : ["neg", "Two seasons."]);
    return o;
  }
  function climLines(rot) {
    if (!climate) return ["NASA POWER data unavailable or loading."];
    var o = [];
    if (rot.kharif.length) o.push("June to September rain: " + Math.round(climate.kb) + " mm (1991 to 2010) to " + Math.round(climate.kr) + " mm (2011 onward); longest dry spell " + climate.db.toFixed(1) + " to " + climate.dr.toFixed(1) + " days.");
    if (rot.rabi.length || rot.rabiNote || !rot.kharif.length) o.push("October to December rain: " + Math.round(climate.rb) + " mm to " + Math.round(climate.rr) + " mm. Rainfed rabi crops also rely on moisture stored from the monsoon.");
    return o;
  }
  function card(rot, i, base, p) {
    var lab = ["Current rotation", "Alternative 1", "Alternative 2"][i], sm = RU.soilMatch(rot, p.soil), leg = RU.legumeStatus(rot);
    var crops = RU.crops(RU.allCrops(rot));
    var h = '<article class="card" style="border-top:3px solid ' + (i ? "var(--green)" : "var(--earth-2)") + '"><p class="eyebrow">' + lab + "</p><h3>" + FV.esc(rot.name) + '</h3><dl class="small" style="display:grid;gap:8px;margin:12px 0 0">';
    h += "<dt class=\"faint\">" + FV.esc(FV.t("season.kharif")) + "</dt><dd>" + FV.esc(RU.cropNames(rot.kharif)) + "</dd>";
    h += "<dt class=\"faint\">" + FV.esc(FV.t("season.rabi")) + "</dt><dd>" + FV.esc(rot.rabiNote || (rot.rabi.length ? RU.cropNames(rot.rabi) : "None")) + "</dd>";
    h += "<dt class=\"faint\">Legume in sequence</dt><dd>" + (leg === true ? "Yes: " + FV.esc(RU.legumeNames(rot).join(", ")) : leg === null ? "Depends on species" : "No") + "</dd>";
    h += "<dt class=\"faint\">Listed for this soil " + FV.tag("gov", "ICAR-CRIDA") + "</dt><dd>" + (sm === null ? FV.tag("missing") + " Choose the soil situation." : sm ? "Yes" : "No. Listed under: " + FV.esc(rot.soils.map(function (s) { return R.SOILS[s]; }).join("; "))) + "</dd>";
    h += "<dt class=\"faint\">Climate evidence " + FV.tag("obs", "NASA POWER") + "</dt><dd>" + climLines(rot).map(FV.esc).join("<br>") + "</dd>";
    h += "<dt class=\"faint\">Sowing windows</dt><dd>" + crops.map(function (c) { return FV.esc(c.name + ": " + (c.sowing || "not given in the plan")); }).join("<br>") + "</dd>";
    h += "<dt class=\"faint\">District record " + FV.tag("gov") + "</dt><dd>" + crops.map(function (c) { return FV.esc(c.name + ": " + (c.yieldKgHa ? c.area + " thousand ha (2008 to 09), " + c.yieldKgHa + " kg/ha (2004 to 2008)" : "not in the plan's tables")); }).join("<br>") + "</dd>";
    if (i) h += "<dt class=\"faint\">What changes compared with the current rotation</dt><dd>" + list(RU.changes(rot, base, p.soil)) + "</dd>";
    var pr = prio(rot, p); if (pr.length) h += "<dt class=\"faint\">Against your priorities</dt><dd>" + list(pr) + "</dd>";
    h += "<dt class=\"faint\">Contingency notes from the plan</dt><dd>" + rot.contingency.map(FV.esc).join("<br>") + "</dd>";
    return h + "</dl></article>";
  }
  function renderCompare() {
    var p = prof(), rots = p.ids.map(RU.byId);
    $("ro-dup").hidden = !(p.ids[0] === p.ids[1] || p.ids[0] === p.ids[2] || p.ids[1] === p.ids[2]);
    $("ro-cards").innerHTML = rots.map(function (r, i) { return card(r, i, rots[0], p); }).join("");
    renderShort(p);
  }
  function renderShort(p) {
    var el = $("ro-short");
    if (!p.soil) { el.innerHTML = '<div class="notice warn">' + FV.icon(FV.ICONS.warn) + "<p><strong>No shortlist yet.</strong> The soil situation decides which rotations the plan lists for this farm. Choose it on the Compare tab or in My Farm.</p></div>"; return; }
    var fits = R.ROTATIONS.filter(function (r) { return r.soils.indexOf(p.soil) > -1; });
    el.innerHTML = (farm.irrigation === "irrigated" ? '<div class="notice warn" style="margin-bottom:10px">' + FV.icon(FV.ICONS.warn) + "<p>The farm has assured irrigation. This catalogue covers rainfed systems only.</p></div>" : "") +
      "<p>For <strong>" + FV.esc(R.SOILS[p.soil]) + "</strong> the plan lists " + fits.length + " of " + R.ROTATIONS.length + " systems. Listed in catalogue order, not ranked.</p>" +
      '<div class="table-wrap"><table><thead><tr><th>Rotation</th><th>Legume</th><th>Seasons</th><th>Priorities met</th></tr></thead><tbody>' + fits.map(function (r) {
        var pr = prio(r, p), met = pr.filter(function (x) { return x[0] === "pos"; }).length, l = RU.legumeStatus(r);
        return "<tr><td>" + FV.esc(r.name) + (r.contingencyOnly ? ' <span class="tag demo">Contingency</span>' : "") + "</td><td>" + (l === true ? "Yes" : l === null ? "Depends" : "No") + "</td><td>" + (RU.usesBothSeasons(r) ? "Kharif and rabi" : r.kharif.length ? "Kharif" : "Rabi") + "</td><td>" + (pr.length ? met + " of " + pr.length : "None selected") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    $("ro-stats").innerHTML = '<div class="band-stat"><div class="k">Listed for this soil</div><div class="v">' + fits.length + " of " + R.ROTATIONS.length + "</div></div>";
  }

  /* ---------- planner ---------- */
  var SLOTS = [["y1k", "Year 1 kharif", "kharif"], ["y1r", "Year 1 rabi", "rabi"], ["y2k", "Year 2 kharif", "kharif"], ["y2r", "Year 2 rabi", "rabi"]];
  function planner() {
    var kh = ["redgram", "sorghumK", "bajra", "greengram", "soybean", "sunflower"], rb = ["chickpea", "sorghumR"];
    $("pl-grid").innerHTML = SLOTS.map(function (s) {
      var l = s[2] === "kharif" ? kh : rb;
      return '<div class="field"><label for="pl-' + s[0] + '">' + s[1] + '</label><select id="pl-' + s[0] + '"><option value="">' + (s[2] === "kharif" ? "Fallow" : "No rabi crop") + "</option>" + l.map(function (k) { return '<option value="' + k + '">' + FV.esc(R.CROPS[k].name) + "</option>"; }).join("") + "</select></div>";
    }).join("");
    var rot = RU.byId(farm.rotation) || RU.byId("R1");
    $("pl-y1k").value = rot.kharif[0] || ""; $("pl-y1r").value = rot.rabi[0] || ""; $("pl-y2k").value = "greengram"; $("pl-y2r").value = "chickpea";
    $("pl-grid").addEventListener("change", planChecks);
    planChecks();
  }
  function planChecks() {
    var v = {}; SLOTS.forEach(function (s) { v[s[0]] = $("pl-" + s[0]).value; });
    var crops = SLOTS.map(function (s) { return v[s[0]]; }).filter(Boolean);
    var distinct = crops.filter(function (c, i) { return crops.indexOf(c) === i; });
    var legSeasons = crops.filter(function (c) { return R.CROPS[c].legume; }).length;
    var out = [];
    out.push(["neu", distinct.length + " different crop" + (distinct.length === 1 ? "" : "s") + " across " + crops.length + " cropped season" + (crops.length === 1 ? "" : "s") + " of 4."]);
    out.push([legSeasons ? "pos" : "neg", legSeasons ? "A legume is grown in " + legSeasons + " of 4 seasons." : "No legume in the two years."]);
    if (v.y1k && v.y1k === v.y2k) out.push(["neu", "The same kharif crop (" + R.CROPS[v.y1k].name + ") is grown in both years, with no break between."]);
    [["y1k", "y1r", "Year 1"], ["y2k", "y2r", "Year 2"]].forEach(function (pair) {
      var k = v[pair[0]], r = v[pair[1]];
      var match = R.ROTATIONS.filter(function (rot) { return (rot.kharif.length === 1 ? rot.kharif[0] : rot.kharif.length ? "x" : "") === k && (rot.rabi[0] || "") === r; })[0];
      if (match) {
        var sm = RU.soilMatch(match, farm.soil);
        out.push([sm === false ? "neg" : "pos", pair[2] + " matches the plan's system “" + match.name + "”" + (sm === null ? "; add your soil situation to check it fits." : sm ? ", listed for your soil." : ", but not listed for your soil situation.")]);
      } else out.push(["neu", pair[2] + " is not one of the plan's named systems, so it cannot be checked against the plan."]);
      if (k === "redgram" && r) out.push(["neg", pair[2] + ": with the durations used here (pigeonpea 160 days or more from June sowing), pigeonpea is still in the field when the rabi sowing window opens in October."]);
    });
    $("pl-checks").innerHTML = out.map(function (i) { return '<li class="' + i[0] + '">' + icon(i[0]) + "<span>" + FV.esc(i[1]) + "</span></li>"; }).join("");
    $("pl-strip").innerHTML = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">' + SLOTS.map(function (s) { var c = v[s[0]];
      return '<div style="background:' + (c ? FV.cropColor(c) : "#E8E4D6") + ';color:' + (c ? "#fff" : "#4E5B52") + ';border-radius:4px;padding:10px 8px;font-size:0.8rem;min-height:70px"><div class="mono" style="opacity:.85">' + s[1] + "</div>" + FV.esc(c ? R.CROPS[c].name : "Fallow / none") + "</div>"; }).join("") + "</div>";
  }

  document.addEventListener("DOMContentLoaded", function () {
    farm = FV.getFarm();
    var opts = R.ROTATIONS.map(function (r) { return '<option value="' + r.id + '">' + FV.esc(r.name) + "</option>"; }).join("");
    ["ro-a", "ro-b", "ro-c"].forEach(function (id) { $(id).innerHTML = opts; });
    $("ro-soil").innerHTML = '<option value="">Not known yet</option>' + Object.keys(R.SOILS).map(function (k) { return '<option value="' + k + '">' + FV.esc(R.SOILS[k]) + "</option>"; }).join("");
    $("ro-soil").value = farm.soil || ""; $("ro-a").value = farm.rotation || "R1"; $("ro-b").value = "R2"; $("ro-c").value = "R5";
    $("ro-form").addEventListener("change", renderCompare);
    document.querySelectorAll("[data-tab]").forEach(function (t) { t.addEventListener("click", function () {
      document.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); });
      document.querySelectorAll("[data-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== t.getAttribute("data-tab"); });
    }); });
    renderCompare(); planner();
    FV.climate.load().then(function (d) {
      var C = FV.climate, y1 = new Date().getFullYear() - 1;
      function m(f, a, b) { return C.mean(C.range(a, b).map(f)); }
      climate = { kb: m(function (y) { return C.seasonTotal(d, y, 6, 9); }, 1991, 2010), kr: m(function (y) { return C.seasonTotal(d, y, 6, 9); }, 2011, y1),
        rb: m(function (y) { return C.seasonTotal(d, y, 10, 12); }, 1991, 2010), rr: m(function (y) { return C.seasonTotal(d, y, 10, 12); }, 2011, y1),
        db: m(function (y) { return C.drySpell(d, y, 6, 9, 2.5); }, 1991, 2010), dr: m(function (y) { return C.drySpell(d, y, 6, 9, 2.5); }, 2011, y1) };
      renderCompare();
    }).catch(function () { climate = null; });
    FV.onChange.push(renderCompare);
  });
})();

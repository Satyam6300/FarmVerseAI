/*
 * FARMVERSE AI core: settings, farm profile, translation, data loading, shell behaviour, helpers.
 * Storage: settings and the farm profile are kept in this browser's localStorage only.
 */
(function () {
  "use strict";
  var FV = window.FV = window.FV || {};

  /* ---------------- storage ---------------- */
  function load(key, dflt) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }

  FV.settings = Object.assign({ lang: "en", mode: "farmer", iotEndpoint: "", iotDemo: true }, load("fv-settings", {}));
  FV.saveSettings = function () { save("fv-settings", FV.settings); };

  // Demonstration farm. Everything here is labelled DEMO in the interface.
  FV.DEMO_FARM = {
    demo: true, name: "Demonstration field", village: "", district: "Kalaburagi",
    lat: 17.3700, lon: 76.9000,
    polygon: [[17.36920, 76.89880], [17.36920, 76.90120], [17.37080, 76.90120], [17.37080, 76.89880]],
    areaAcres: null, currentCrop: "redgram", season: "kharif", prevKharif: "redgram", prevRabi: "",
    soil: "S1", soilType: "", ph: "", oc: "", irrigation: "rainfed", water: "", rotation: "R1"
  };
  FV.getFarm = function () { return load("fv-farm", null) || Object.assign({}, FV.DEMO_FARM); };
  FV.saveFarm = function (f) { f.demo = false; f.updated = new Date().toISOString(); return save("fv-farm", f); };
  FV.clearFarm = function () { try { localStorage.removeItem("fv-farm"); } catch (e) { /* nothing stored */ } };

  /* ---------------- i18n ---------------- */
  FV.t = function (key, params) {
    var d = window.FV_I18N || {};
    var s = (d[FV.settings.lang] && d[FV.settings.lang][key]) || (d.en && d.en[key]) || key;
    if (params) Object.keys(params).forEach(function (k) { s = s.split("{" + k + "}").join(params[k]); });
    return s;
  };
  FV.applyI18n = function (root) {
    root = root || document;
    document.documentElement.lang = FV.settings.lang;
    root.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = FV.t(el.getAttribute("data-i18n")); });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) { el.placeholder = FV.t(el.getAttribute("data-i18n-placeholder")); });
    root.querySelectorAll("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", FV.t(el.getAttribute("data-i18n-aria"))); });
  };

  /* ---------------- helpers ---------------- */
  FV.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  FV.fmt = function (v, d, unit) {
    if (v === null || v === undefined || isNaN(v)) return FV.t("c.unavailable");
    var s = Number(v).toLocaleString("en-IN", { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
    return unit ? s + " " + unit : s;
  };
  FV.signed = function (v, d) {
    if (v === null || v === undefined || isNaN(v)) return "n/a";
    var f = Math.pow(10, d || 0), r = Math.round(v * f) / f;
    if (r === 0) r = 0;
    return (r > 0 ? "+" : "") + r.toLocaleString("en-IN", { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 });
  };
  var TAGS = { obs: "tag.obs", model: "tag.model", sim: "tag.sim", farmer: "tag.farmer", demo: "tag.demo", missing: "tag.missing", gov: "tag.gov", cached: "tag.cached" };
  FV.tag = function (kind, text) { return '<span class="tag ' + kind + '">' + FV.esc(text || FV.t(TAGS[kind] || kind)) + "</span>"; };
  FV.download = function (name, text, type) {
    var blob = new Blob([text], { type: type || "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };
  FV.icon = function (paths) { return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>"; };
  FV.ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    minus: '<path d="M5 12h14"/>',
    drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    sat: '<path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/><path d="m8 12 4 4 6-6-4-4Z"/><path d="m16 8 3-3"/><path d="M9 21a6 6 0 0 0-6-6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
  };
  FV.cropColor = function (key) {
    return ({ redgram: "#B5651D", chickpea: "#D9B44A", sorghumK: "#8E9B3A", sorghumR: "#6E7F2A", bajra: "#A68A5B", greengram: "#5FAF5A",
      soybean: "#C9A227", sunflower: "#E8B923", greenManure: "#3E8E41", fallow: "#7A6450", urad: "#4B4B4B" })[key] || "#8FA89A";
  };

  /* Season of a date, using the conventional Indian crop calendar:
     kharif June to October, rabi November to March, summer April and May. */
  FV.seasonOf = function (d) {
    var m = (d || new Date()).getMonth() + 1;
    if (m >= 6 && m <= 10) return "kharif";
    if (m >= 11 || m <= 3) return "rabi";
    return "summer";
  };

  /* ---------------- data ---------------- */
  var cache = {};
  FV.data = {
    get: function (name) {
      if (!cache[name]) {
        cache[name] = fetch("data/" + name, { cache: "no-cache" }).then(function (r) {
          if (!r.ok) throw new Error(name + ": HTTP " + r.status);
          return r.json();
        });
      }
      return cache[name];
    }
  };

  /* ---------------- charts ---------------- */
  FV.chartDefaults = function () {
    if (!window.Chart) return;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = "#4E5B52";
    Chart.defaults.animation = { duration: 450 };
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.tooltip.backgroundColor = "#0D2219";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.titleFont = { weight: "600" };
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.scale.grid.color = "#ECE9DF";
  };
  FV.charts = {};
  FV.chart = function (id, cfg) {
    if (FV.charts[id]) FV.charts[id].destroy();
    var el = document.getElementById(id);
    if (!el) return null;
    FV.charts[id] = new Chart(el, cfg);
    return FV.charts[id];
  };
  FV.empty = function (el, msg) {
    if (typeof el === "string") el = document.getElementById(el);
    if (el) el.innerHTML = '<div class="empty"><div>' + FV.icon(FV.ICONS.info) + FV.esc(msg) + "</div></div>";
  };

  /* ---------------- guided demo ---------------- */
  var TOUR = [
    { page: "map.html", t: "tour.1t", b: "tour.1b" },
    { page: "climate.html", t: "tour.2t", b: "tour.2b" },
    { page: "nasa.html", t: "tour.3t", b: "tour.3b" },
    { page: "twin.html", t: "tour.4t", b: "tour.4b" },
    { page: "twin.html", t: "tour.5t", b: "tour.5b" },
    { page: "twin.html#compare", t: "tour.6t", b: "tour.6b" },
    { page: "advisor.html", t: "tour.7t", b: "tour.7b" }
  ];
  function tourStep() { try { var s = sessionStorage.getItem("fv-tour"); return s === null ? -1 : +s; } catch (e) { return -1; } }
  function setTour(i) { try { if (i < 0) sessionStorage.removeItem("fv-tour"); else sessionStorage.setItem("fv-tour", String(i)); } catch (e) { /* ignore */ } }
  FV.startTour = function () { setTour(0); location.href = TOUR[0].page; };
  function renderTour() {
    var i = tourStep();
    var old = document.getElementById("tour");
    if (old) old.remove();
    if (i < 0 || i >= TOUR.length) return;
    var s = TOUR[i];
    var box = document.createElement("aside");
    box.className = "tour no-print"; box.id = "tour"; box.setAttribute("aria-live", "polite");
    box.innerHTML = '<div class="prog">' + (i + 1) + " / " + TOUR.length + "</div><h3>" + FV.esc(FV.t(s.t)) + "</h3><p>" + FV.esc(FV.t(s.b)) + '</p><div class="btn-row">' +
      (i > 0 ? '<button class="btn btn-dark-ghost btn-sm" data-tour="back">' + FV.esc(FV.t("c.back")) + "</button>" : "") +
      (i < TOUR.length - 1 ? '<button class="btn btn-lime btn-sm" data-tour="next">' + FV.esc(FV.t("c.next")) + "</button>" : '<button class="btn btn-lime btn-sm" data-tour="end">' + FV.esc(FV.t("c.finish")) + "</button>") +
      '<button class="btn btn-dark-ghost btn-sm" data-tour="end">' + FV.esc(FV.t("tour.end")) + "</button></div>";
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      var a = e.target.closest("[data-tour]"); if (!a) return;
      var act = a.getAttribute("data-tour");
      if (act === "end") { setTour(-1); box.remove(); return; }
      var n = act === "next" ? i + 1 : i - 1;
      setTour(n);
      var target = TOUR[n].page;
      var here = location.pathname.split("/").pop() || "index.html";
      if (target.split("#")[0] === here) {
        renderTour();
        if (target.indexOf("#") > -1) { var el = document.getElementById(target.split("#")[1]); if (el) el.scrollIntoView({ behavior: "smooth" }); }
        document.dispatchEvent(new CustomEvent("fv:tour", { detail: n }));
      } else location.href = target;
    });
  }
  FV.tourStep = tourStep;

  /* ---------------- shell ---------------- */
  function applyMode() {
    document.body.classList.toggle("mode-farmer", FV.settings.mode === "farmer");
    document.body.classList.toggle("mode-expert", FV.settings.mode === "expert");
    document.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-mode") === FV.settings.mode ? "true" : "false"); });
  }
  FV.onChange = [];
  function changed(what) { FV.onChange.forEach(function (fn) { try { fn(what); } catch (e) { console.error(e); } }); }

  document.addEventListener("DOMContentLoaded", function () {
    applyMode();
    FV.applyI18n();
    FV.chartDefaults();
    var farm = FV.getFarm();
    var chip = document.getElementById("farm-chip-name");
    if (chip) chip.textContent = farm.name || FV.t("c.unknown");
    var lang = document.getElementById("lang-select");
    if (lang) {
      lang.value = FV.settings.lang;
      lang.addEventListener("change", function () { FV.settings.lang = lang.value; FV.saveSettings(); FV.applyI18n(); renderTour(); changed("lang"); });
    }
    document.querySelectorAll("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () { FV.settings.mode = b.getAttribute("data-mode"); FV.saveSettings(); applyMode(); changed("mode"); });
    });
    var menu = document.querySelector(".menu-btn"), sb = document.querySelector(".sidebar");
    if (menu && sb) {
      menu.addEventListener("click", function () { var o = sb.classList.toggle("open"); menu.setAttribute("aria-expanded", o ? "true" : "false"); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && sb.classList.contains("open")) { sb.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); menu.focus(); } });
      document.addEventListener("click", function (e) { if (sb.classList.contains("open") && !sb.contains(e.target) && !menu.contains(e.target)) { sb.classList.remove("open"); menu.setAttribute("aria-expanded", "false"); } });
    }
    var tb = document.getElementById("tour-btn");
    if (tb) tb.addEventListener("click", FV.startTour);
    renderTour();
  });
})();

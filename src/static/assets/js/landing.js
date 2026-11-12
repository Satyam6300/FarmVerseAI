/* Landing page: satellite image toggle and figures read from the cached datasets. */
(function () {
  "use strict";
  var FV = window.FV;
  var $ = function (id) { return document.getElementById(id); };
  document.addEventListener("DOMContentLoaded", function () {
    var caps = {};
    FV.data.get("tiles.json").then(function (t) {
      var m = t._farmverse;
      caps = { tc: "NASA MODIS Terra true colour, " + m.hero_truecolor_date + ". White line: Kalaburagi district (Census 2011).", ndvi: "MODIS Terra 16-day NDVI composite from " + m.hero_ndvi_date + ". Greener means higher vegetation index." };
      $("lp-cap").textContent = caps.tc;
    }).catch(function () {});
    document.querySelectorAll("[data-view]").forEach(function (b) { b.addEventListener("click", function () {
      var v = b.getAttribute("data-view");
      document.querySelectorAll("[data-view]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      $("lp-img").src = v === "tc" ? "data/hero_truecolor.jpg" : "data/hero_ndvi.jpg";
      $("lp-img").alt = v === "tc" ? "NASA MODIS true colour image of Kalaburagi district" : "MODIS NDVI image of Kalaburagi district";
      if (caps[v]) $("lp-cap").textContent = caps[v];
    }); });
    FV.data.get("power_kalaburagi.json").then(function (p) {
      var last = p._farmverse.last_valid_day, days = Object.keys(p.properties.parameter.PRECTOTCORR).length;
      $("lp-power").textContent = days.toLocaleString("en-IN") + " days";
      $("lp-power-s").textContent = "1991-01-01 to " + last.slice(0, 4) + "-" + last.slice(4, 6) + "-" + last.slice(6);
      var stats = [["Daily climate record", "since 1991"], ["Last NASA POWER day", last.slice(0, 4) + "-" + last.slice(4, 6) + "-" + last.slice(6)]];
      FV.data.get("gibs_series.json").then(function (g) {
        $("lp-modis").textContent = g.ndvi.dates.length + " composites"; $("lp-modis-s").textContent = g.ndvi.dates[0] + " to " + g.ndvi.dates[g.ndvi.dates.length - 1];
        $("lp-smap").textContent = g.smap.dates.length + " dates"; $("lp-smap-s").textContent = g.smap.dates[0] + " to " + g.smap.dates[g.smap.dates.length - 1];
        stats.push(["MODIS composites", String(g.ndvi.dates.length)]);
        $("lp-stats").innerHTML = stats.map(function (s) { return '<div class="band-stat"><div class="k">' + FV.esc(s[0]) + '</div><div class="v">' + FV.esc(s[1]) + "</div></div>"; }).join("");
      });
    }).catch(function () { $("lp-stats").innerHTML = ""; });
  });
})();

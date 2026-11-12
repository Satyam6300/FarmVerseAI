/* Data Sources: fills retrieval dates and periods from the cached files' own provenance blocks. */
(function () {
  "use strict";
  var FV = window.FV;
  function d(s) { return s ? String(s).slice(0, 10) : "n/a"; }
  document.addEventListener("DOMContentLoaded", function () {
    Promise.all(["power_kalaburagi.json", "gibs_series.json", "tiles.json", "crop_stats.json", "boundaries.json"].map(function (n) { return FV.data.get(n).catch(function () { return null; }); })).then(function (r) {
      var p = r[0], g = r[1], t = r[2], c = r[3], b = r[4];
      var last = p ? p._farmverse.last_valid_day : null;
      var rows = [
        ['<a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noopener">NASA POWER Daily API</a>', "NASA Langley Research Center", "PRECTOTCORR (mm/day), T2M_MAX, T2M_MIN (°C), GWETTOP, GWETROOT (0 to 1)", "Daily; about 0.5°", "1991-01-01 to " + (last ? last.slice(0, 4) + "-" + last.slice(4, 6) + "-" + last.slice(6) : "n/a"), "REST API, no key; cached copy plus live requests for other points", d(p && p._farmverse.fetched_at)],
        ["MODIS Terra NDVI and EVI (16-day)", "NASA, via GIBS", "District mean and field pixel", "About 250 m", g ? g.ndvi.dates[0] + " to " + g.ndvi.dates[g.ndvi.dates.length - 1] : "n/a", "GIBS WMTS tiles decoded with official colormaps", d(g && g._farmverse.fetched_at)],
        ["SMAP L4 surface soil moisture", "NASA, via GIBS", "Top 5 cm volumetric soil moisture (m³/m³)", "9 km", g ? g.smap.dates[0] + " to " + g.smap.dates[g.smap.dates.length - 1] : "n/a", "GIBS WMTS tiles decoded with official colormap", d(g && g._farmverse.fetched_at)],
        ["GIBS map layers", "NASA", "MODIS true colour, NDVI, EVI, IMERG precipitation rate, SMAP, land surface temperature", "250 m to 10 km", "Any available date (live); cached dates for offline use", "WMTS tiles in the browser", d(t && t._farmverse.fetched_at)],
        ['<a href="https://ckandev.indiadataportal.com/dataset/area-production-yield-apy" target="_blank" rel="noopener">Crop-wise Area, Production and Yield</a>', "DES and UPAG, Ministry of Agriculture and Farmers Welfare", "Area (ha), production (t), yield (t/ha) by crop and season", "District", c ? "1997-98 to 2024-25" : "n/a", "CSV from India Data Portal, filtered to Kalaburagi", d(c && c._farmverse.fetched_at)],
        ['<a href="https://github.com/datameet/maps" target="_blank" rel="noopener">District boundaries (Census 2011)</a>', "DataMeet India community", "Gulbarga (Kalaburagi) district polygon", "Vector", "Census 2011", "GeoJSON", d(b && b._farmverse.fetched_at)],
        ['<a href="https://www.icar-crida.res.in/CP/Karnataka/UAS,%20Raichur/KA8-Gulbarga%203.2.2011.pdf" target="_blank" rel="noopener">Agriculture Contingency Plan, Gulbarga</a>', "ICAR-CRIDA with UAS Raichur", "Cropping systems by soil, sowing windows, drought measures, crop area and productivity", "District", "Plan dated 2011", "PDF, transcribed into the app", "Transcribed 2026-11-12"]
      ];
      document.getElementById("ds-int").innerHTML = rows.map(function (x) { return "<tr>" + x.map(function (v, i) { return "<td" + (i === 6 ? ' class="n"' : "") + ">" + (i === 0 ? v : FV.esc(v)) + "</td>"; }).join("") + "</tr>"; }).join("");
    });
  });
})();

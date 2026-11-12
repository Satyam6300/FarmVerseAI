/* Farm Map: NASA GIBS layers, district boundary, field drawing, place search and point inspection. */
(function () {
  "use strict";
  var FV = window.FV, K = FV.mapkit;
  var $ = function (id) { return document.getElementById(id); };
  var map, base, overlay = null, overlayKey = "ndvi", date, drawn = null, farmLyr = null, districtLyr = null, districtFeature = null;
  var bases = {};

  function inside(lat, lon, ring) {
    var c = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) c = !c;
    }
    return c;
  }

  function setBase(key) {
    if (base) map.removeLayer(base);
    base = bases[key]();
    base.addTo(map); base.bringToBack();
  }

  function overlayOptions() {
    var keys = ["none", "ndvi", "evi", "imerg", "smap", "lst"];
    $("m-overlays").innerHTML = keys.map(function (k) {
      var l = K.LAYERS[k];
      return '<label class="layer-opt"><input type="radio" name="ov" value="' + k + '"' + (k === overlayKey ? " checked" : "") + "><span>" +
        (k === "none" ? "None" : FV.esc(l.label)) + (l ? "<small>" + (l.period === "P16D" ? "16-day composite" : l.period === "P8D" ? "8-day composite" : "Daily") + "</small>" : "") + "</span></label>";
    }).join("");
    $("m-overlays").addEventListener("change", function (e) { if (e.target.name === "ov") { overlayKey = e.target.value; date = overlayKey === "none" ? date : K.defaultDate(overlayKey); setOverlay(); } });
  }

  function setOverlay() {
    if (overlay) { map.removeLayer(overlay); overlay = null; }
    var l = K.LAYERS[overlayKey];
    $("m-date").disabled = !l;
    if (!l) { $("m-legend").innerHTML = ""; $("m-note").textContent = ""; $("m-cached").innerHTML = ""; $("m-badge").hidden = true; updateMeta(); return; }
    date = K.snap(overlayKey, date || K.defaultDate(overlayKey));
    $("m-date").value = date;
    overlay = new K.GibsLayer(overlayKey, date, { opacity: +$("m-opacity").value });
    overlay.on("tileerror", function () { $("m-badge").textContent = "Some tiles could not load for " + date + ". The date may have no data yet, or the map is offline with no cached tiles for it."; });
    overlay.addTo(map);
    $("m-legend").innerHTML = K.legendHtml(overlayKey);
    $("m-note").textContent = l.note;
    $("m-date-hint").textContent = l.period === "P16D" ? "Snapped to the 16-day composite start date." : l.period === "P8D" ? "Snapped to the 8-day composite start date." : "Daily product.";
    var cd = K.cachedDates(overlayKey);
    $("m-cached").innerHTML = cd.length ? '<span class="small faint">Cached for offline:</span>' + cd.map(function (d) { return '<button class="btn btn-ghost btn-sm" type="button" data-date="' + d + '">' + d + "</button>"; }).join("") : '<span class="small faint">No cached dates; needs internet.</span>';
    $("m-badge").hidden = false;
    $("m-badge").textContent = l.label + " · " + date + (cd.indexOf(date) > -1 ? " · cached" : " · live from NASA GIBS");
    if (map.getZoom() > l.maxNative + 3) map.setZoom(l.maxNative + 2);
    updateMeta();
  }

  function updateMeta() {
    var l = K.LAYERS[overlayKey];
    $("m-meta").innerHTML = l ? "<dl class=\"small\"><dt>GIBS layer</dt><dd class=\"mono\">" + l.id + "</dd><dt>Tile matrix set</dt><dd class=\"mono\">" + l.tms + "</dd><dt>Native zoom</dt><dd>" + l.maxNative +
      " (beyond this the map enlarges existing pixels)</dd><dt>Date</dt><dd>" + FV.esc(date) + "</dd><dt>Source</dt><dd><a href=\"https://earthdata.nasa.gov/gibs\" target=\"_blank\" rel=\"noopener\">NASA GIBS</a> (public domain)</dd></dl>" : "<p class=\"small\">No NASA layer selected.</p>";
  }

  function inspect(e) {
    var ll = e.latlng, ring = districtFeature ? districtFeature.geometry.coordinates[0] : null;
    var inD = ring ? inside(ll.lat, ll.lng, ring) : null;
    var html = "<p class=\"num\">" + ll.lat.toFixed(5) + " N, " + ll.lng.toFixed(5) + " E</p><p class=\"small\">" +
      (inD === null ? "" : inD ? "Inside Kalaburagi district (Census 2011 boundary)." : "Outside Kalaburagi district.") + "</p>";
    html += '<div id="m-val"><span class="status loading"><span class="dot"></span>Reading layer value</span></div>';
    html += '<div class="btn-row" style="margin-top:10px"><a class="btn btn-ghost btn-sm" href="climate.html?lat=' + ll.lat.toFixed(4) + "&lon=" + ll.lng.toFixed(4) + '">Analyse climate here</a>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="m-use-point">Use as my farm location</button></div>';
    $("m-info").innerHTML = html;
    $("m-use-point").addEventListener("click", function () {
      var f = FV.getFarm(); if (f.demo) f = Object.assign({}, FV.DEMO_FARM, { name: "", rotation: "", currentCrop: "", soil: "", polygon: null });
      f.lat = +ll.lat.toFixed(5); f.lon = +ll.lng.toFixed(5); f.polygon = null; f.areaAcres = f.areaAcres || null;
      FV.saveFarm(f); refreshFarm();
      $("m-use-point").outerHTML = '<span class="small" style="color:var(--ok-ink)">Saved. Complete the details in My Farm.</span>';
    });
    if (!overlay) { $("m-val").innerHTML = "<p class=\"small muted\">Select a NASA data layer to read its value here.</p>"; return; }
    var key = overlayKey, d = date;
    K.valueAt(key, d, ll, map.getZoom()).then(function (v) {
      if (!v) { $("m-val").innerHTML = ""; return; }
      if (v.value === null) { $("m-val").innerHTML = "<p class=\"small\"><strong>" + FV.esc(v.label) + ":</strong> " + FV.esc(v.reason) + "</p>"; return; }
      var r = v.value, txt = r[0] === null ? "below " + r[1] : r[1] === null || r[1] === r[0] ? String(r[0]) : r[0] + " to " + r[1];
      var extra = key === "lst" && r[0] !== null ? " (" + (r[0] - 273.15).toFixed(1) + " to " + ((r[1] || r[0]) - 273.15).toFixed(1) + " °C)" : "";
      $("m-val").innerHTML = '<div class="kpi"><div class="label">' + FV.esc(v.label) + " " + FV.tag("obs") + '</div><div class="value" style="font-size:1.2rem">' + FV.esc(txt) + " <small>" + FV.esc(v.unit || "") + "</small></div><div class=\"small faint\">" + FV.esc(d) + extra + ", read at zoom " + v.zoom + "</div></div>";
    }).catch(function (err) { $("m-val").innerHTML = "<p class=\"small\" style=\"color:var(--err-ink)\">Value unavailable: " + FV.esc(err.message) + "</p>"; });
  }

  function refreshFarm() {
    if (farmLyr) map.removeLayer(farmLyr);
    var f = FV.getFarm();
    farmLyr = K.farmLayer(f);
    if (farmLyr && $("m-farm").checked) {
      farmLyr.addTo(map);
      farmLyr.bindTooltip((f.demo ? "Demonstration field (illustrative, DEMO DATA)" : FV.esc(f.name || "My farm")), { sticky: true });
    }
  }

  function search() {
    var q = $("m-search").value.trim(); if (!q) return;
    $("m-search-msg").textContent = "Searching...";
    fetch("https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&limit=5&q=" + encodeURIComponent(q))
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (list) {
        $("m-search-msg").textContent = list.length ? "Results from OpenStreetMap Nominatim:" : "No places found.";
        $("m-search-results").innerHTML = list.map(function (p, i) { return '<li><button class="chip" type="button" data-i="' + i + '" style="margin:3px 0;width:100%">' + FV.esc(p.display_name) + "</button></li>"; }).join("");
        $("m-search-results").onclick = function (e) { var b = e.target.closest("[data-i]"); if (!b) return; var p = list[+b.getAttribute("data-i")]; map.setView([+p.lat, +p.lon], 14); inspect({ latlng: L.latLng(+p.lat, +p.lon) }); };
      }).catch(function (e) { $("m-search-msg").textContent = "Search unavailable (" + e.message + "). Enter coordinates on My Farm instead."; });
  }

  document.addEventListener("DOMContentLoaded", function () {
    map = K.create("m-map", { zoom: 9 });
    bases = { esri: K.esri, osm: K.osm, truecolor: function () { return new K.GibsLayer("truecolor", K.defaultDate("truecolor")); } };
    K.loadManifest().then(function () {
      setBase(navigator.onLine ? "esri" : "truecolor");
      if (!navigator.onLine) document.querySelector('input[name=base][value=truecolor]').checked = true;
      overlayOptions(); date = K.defaultDate("ndvi"); setOverlay();
    });
    K.boundary().then(function (b) { districtLyr = b.district; districtFeature = b.feature; districtLyr.addTo(map); setTimeout(function () { map.invalidateSize(); map.fitBounds(districtLyr.getBounds(), { padding: [10, 10] }); }, 100); });
    refreshFarm();
    document.querySelectorAll("input[name=base]").forEach(function (r) { r.addEventListener("change", function () { setBase(r.value); }); });
    $("m-date").addEventListener("change", function () { if ($("m-date").value) { date = $("m-date").value; setOverlay(); } });
    $("m-cached").addEventListener("click", function (e) { var b = e.target.closest("[data-date]"); if (b) { date = b.getAttribute("data-date"); setOverlay(); } });
    $("m-opacity").addEventListener("input", function () { if (overlay) overlay.setOpacity(+$("m-opacity").value); });
    $("m-district").addEventListener("change", function () { if (districtLyr) { if ($("m-district").checked) districtLyr.addTo(map); else map.removeLayer(districtLyr); } });
    $("m-farm").addEventListener("change", refreshFarm);
    $("m-search-btn").addEventListener("click", search);
    $("m-search").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); search(); } });
    map.on("click", inspect);

    var drawItems = new L.FeatureGroup().addTo(map);
    map.addControl(new L.Control.Draw({ position: "topright", draw: { polygon: { allowIntersection: false, showArea: true }, rectangle: true, polyline: false, circle: false, marker: false, circlemarker: false }, edit: { featureGroup: drawItems } }));
    map.on(L.Draw.Event.CREATED, function (e) {
      drawItems.clearLayers(); drawItems.addLayer(e.layer); drawn = e.layer;
      var pts = e.layer.getLatLngs()[0].map(function (p) { return [p.lat, p.lng]; });
      var acres = K.areaAcres(pts);
      $("m-draw").hidden = false;
      $("m-draw-area").textContent = "Area: " + acres.toFixed(2) + " acres (" + (acres * 0.4047).toFixed(2) + " ha), computed from the outline.";
    });
    $("m-save-field").addEventListener("click", function () {
      if (!drawn) return;
      var pts = drawn.getLatLngs()[0].map(function (p) { return [+p.lat.toFixed(6), +p.lng.toFixed(6)]; });
      var f = FV.getFarm(); if (f.demo) f = Object.assign({}, FV.DEMO_FARM, { name: "", rotation: "", currentCrop: "", soil: "" });
      var c = drawn.getBounds().getCenter();
      f.polygon = pts; f.lat = +c.lat.toFixed(5); f.lon = +c.lng.toFixed(5); f.areaAcres = +K.areaAcres(pts).toFixed(2);
      FV.saveFarm(f); drawItems.clearLayers(); drawn = null; $("m-draw").hidden = true; refreshFarm();
      $("m-info").innerHTML = '<div class="notice ok">' + FV.icon(FV.ICONS.check) + "<p>Field saved in this browser. Add crop and soil details in <a href=\"farm.html\">My Farm</a>.</p></div>";
    });
    $("m-discard").addEventListener("click", function () { drawItems.clearLayers(); drawn = null; $("m-draw").hidden = true; });
  });
})();

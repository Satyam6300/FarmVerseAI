/* My Farm: four-step profile with validation. Data stays in localStorage. */
(function () {
  "use strict";
  var FV = window.FV, R = window.FVRotations, K = FV.mapkit;
  var $ = function (id) { return document.getElementById(id); };
  var step = 1, map, marker = null, farm;

  function opts(list, unknownLabel) {
    return '<option value="">' + FV.esc(unknownLabel || FV.t("farm.notSure")) + "</option>" + list.map(function (o) { return '<option value="' + o[0] + '">' + FV.esc(o[1]) + "</option>"; }).join("");
  }
  var cropList = Object.keys(R.CROPS).filter(function (k) { return k !== "greenManure"; }).map(function (k) { return [k, R.CROPS[k].name]; });

  function fill() {
    $("f-crop").innerHTML = opts(cropList); $("f-prevk").innerHTML = opts(cropList.concat([["fallow", "Fallow"]])); $("f-prevr").innerHTML = opts(cropList.concat([["fallow", "Fallow"]]));
    $("f-rot").innerHTML = opts(R.ROTATIONS.map(function (r) { return [r.id, r.name]; }));
    $("f-soil").innerHTML = opts(Object.keys(R.SOILS).map(function (k) { return [k, R.SOILS[k]]; }));
  }
  function load() {
    farm = FV.getFarm();
    $("f-lat").value = farm.lat || ""; $("f-lon").value = farm.lon || "";
    $("f-name").value = farm.name || ""; $("f-village").value = farm.village || ""; $("f-district").value = farm.district || "Kalaburagi";
    $("f-area").value = farm.areaAcres || "";
    $("f-area-hint").textContent = farm.polygon ? "Computed from your field outline: " + (K.areaAcres(farm.polygon) || 0).toFixed(2) + " acres." : "";
    $("f-crop").value = farm.currentCrop || ""; $("f-season").value = farm.season || ""; $("f-prevk").value = farm.prevKharif || ""; $("f-prevr").value = farm.prevRabi || "";
    $("f-rot").value = farm.rotation || ""; $("f-soil").value = farm.soil || ""; $("f-soiltype").value = farm.soilType || "";
    $("f-ph").value = farm.ph || ""; $("f-oc").value = farm.oc || ""; $("f-irr").value = farm.irrigation || ""; $("f-water").value = farm.water || "";
  }
  function num(id, min, max, label) {
    var el = $(id), v = el.value.trim(), e = $(id + "-e");
    if (v === "") { el.removeAttribute("aria-invalid"); if (e) e.textContent = ""; return { ok: true, v: null }; }
    var n = Number(v), bad = isNaN(n) || n < min || n > max;
    el.setAttribute("aria-invalid", bad ? "true" : "false");
    if (e) e.textContent = bad ? label + " must be between " + min + " and " + max + "." : "";
    return { ok: !bad, v: bad ? null : n };
  }
  function collect() {
    var lat = num("f-lat", 6, 37.5, "Latitude"), lon = num("f-lon", 68, 97.5, "Longitude"), area = num("f-area", 0, 10000, "Area"),
      ph = num("f-ph", 3, 11, "pH"), oc = num("f-oc", 0, 10, "Organic carbon");
    var ok = lat.ok && lon.ok && area.ok && ph.ok && oc.ok;
    var f = Object.assign({}, farm.demo ? {} : farm, {
      lat: lat.v, lon: lon.v, areaAcres: area.v, ph: ph.v === null ? "" : ph.v, oc: oc.v === null ? "" : oc.v,
      name: $("f-name").value.trim(), village: $("f-village").value.trim(), district: $("f-district").value.trim(),
      currentCrop: $("f-crop").value, season: $("f-season").value, prevKharif: $("f-prevk").value, prevRabi: $("f-prevr").value,
      rotation: $("f-rot").value, soil: $("f-soil").value, soilType: $("f-soiltype").value, irrigation: $("f-irr").value, water: $("f-water").value
    });
    if (farm.polygon && lat.v !== null && Math.abs(lat.v - farm.lat) < 1e-6 && Math.abs(lon.v - farm.lon) < 1e-6) f.polygon = farm.polygon;
    else if (farm.polygon && (lat.v === null || Math.abs(lat.v - farm.lat) > 1e-6 || Math.abs(lon.v - farm.lon) > 1e-6)) f.polygon = null;
    return { ok: ok, farm: f };
  }
  function summary() {
    var c = collect().farm;
    var rows = [
      ["Location", c.lat !== null && c.lon !== null ? c.lat.toFixed(4) + ", " + c.lon.toFixed(4) : null],
      ["Field outline", c.polygon ? c.polygon.length + " points" : null],
      [FV.t("farm.name"), c.name], [FV.t("farm.village"), c.village], [FV.t("farm.area"), c.areaAcres],
      [FV.t("farm.current"), c.currentCrop && R.CROPS[c.currentCrop] ? R.CROPS[c.currentCrop].name : null],
      [FV.t("farm.season"), c.season ? FV.t("season." + c.season) : null],
      ["Current rotation", c.rotation ? R.ROTATIONS.filter(function (r) { return r.id === c.rotation; })[0].name : null],
      [FV.t("farm.soilSit"), c.soil ? R.SOILS[c.soil] : null], [FV.t("farm.ph"), c.ph], [FV.t("farm.oc"), c.oc],
      [FV.t("farm.irr"), c.irrigation], [FV.t("farm.water"), c.water]
    ];
    var known = rows.filter(function (r) { return r[1] !== null && r[1] !== "" && r[1] !== undefined; }).length;
    var src = farm.demo ? "demo" : "farmer";
    $("f-summary").innerHTML = '<div class="meter" style="margin-bottom:10px"><i style="width:' + Math.round(known / rows.length * 100) + '%"></i></div><p class="small muted">' + known + " of " + rows.length + " details provided</p>" +
      '<ul class="check-list">' + rows.map(function (r) {
        var have = r[1] !== null && r[1] !== "" && r[1] !== undefined;
        return '<li class="' + (have ? "pos" : "neu") + '">' + FV.icon(have ? FV.ICONS.check : FV.ICONS.minus) + "<span>" + FV.esc(r[0]) + ": " + (have ? FV.esc(r[1]) + " " + FV.tag(src) : FV.tag("missing")) + "</span></li>";
      }).join("") + "</ul>";
  }
  function show(n) {
    step = Math.max(1, Math.min(4, n));
    document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = +p.getAttribute("data-panel") !== step; });
    document.querySelectorAll("[data-step]").forEach(function (b) { if (+b.getAttribute("data-step") === step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
    $("f-back").disabled = step === 1; $("f-next").disabled = step === 4;
    if (step === 1 && map) setTimeout(function () { map.invalidateSize(); }, 50);
  }
  function placeMarker(lat, lon) {
    if (marker) map.removeLayer(marker);
    if (lat === null || lon === null || isNaN(lat)) return;
    marker = L.circleMarker([lat, lon], { radius: 9, color: "#C4DE5A", weight: 3, fillOpacity: 0.25 }).addTo(map);
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.innerWidth < 900) $("farm-grid").style.gridTemplateColumns = "1fr";
    fill(); load();
    map = K.create("f-map", { zoom: 12, center: [farm.lat || 17.33, farm.lon || 76.83] });
    K.loadManifest().then(function () { (navigator.onLine ? K.esri() : new K.GibsLayer("truecolor", K.defaultDate("truecolor"))).addTo(map); });
    K.boundary().then(function (b) { b.district.addTo(map); });
    var fl = K.farmLayer(farm); if (fl && farm.polygon) { fl.addTo(map); map.fitBounds(fl.getBounds(), { maxZoom: 15 }); } else placeMarker(farm.lat, farm.lon);
    map.on("click", function (e) { $("f-lat").value = e.latlng.lat.toFixed(5); $("f-lon").value = e.latlng.lng.toFixed(5); placeMarker(e.latlng.lat, e.latlng.lng); summary(); });
    ["f-lat", "f-lon"].forEach(function (id) { $(id).addEventListener("change", function () { placeMarker(+$("f-lat").value, +$("f-lon").value); }); });
    document.querySelectorAll("[data-step]").forEach(function (b) { b.addEventListener("click", function () { show(+b.getAttribute("data-step")); }); });
    $("f-next").addEventListener("click", function () { show(step + 1); });
    $("f-back").addEventListener("click", function () { show(step - 1); });
    $("farm-form").addEventListener("input", summary);
    $("farm-form").addEventListener("change", summary);
    $("farm-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var c = collect();
      if (!c.ok) { $("f-saved").hidden = true; var bad = document.querySelector('[aria-invalid="true"]'); if (bad) { show(+bad.closest("[data-panel]").getAttribute("data-panel")); bad.focus(); } return; }
      FV.saveFarm(c.farm); farm = FV.getFarm(); $("f-saved").hidden = false;
      var chip = document.getElementById("farm-chip-name"); if (chip) chip.textContent = farm.name || FV.t("c.unknown");
      summary();
    });
    $("f-demo").addEventListener("click", function () { FV.clearFarm(); load(); placeMarker(farm.lat, farm.lon); summary(); $("f-saved").hidden = true; var chip = document.getElementById("farm-chip-name"); if (chip) chip.textContent = farm.name; });
    show(1); summary();
    FV.onChange.push(function () { fill(); load(); summary(); });
  });
})();

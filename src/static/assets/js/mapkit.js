/*
 * Map toolkit built on Leaflet 1.9.
 * - NASA GIBS layers (MODIS, SMAP, IMERG) with a cached-tile fallback for offline demos.
 * - District boundary (DataMeet, Census 2011) and the farm polygon.
 * - Reading a value under the cursor by decoding the GIBS tile pixel with its official colormap.
 */
(function () {
  "use strict";
  var FV = window.FV;
  var GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/";
  var CENTER = [17.15, 76.88];

  // Layer catalogue. "period" drives the date picker; "maxNative" is the native GIBS zoom.
  var LAYERS = {
    truecolor: { id: "MODIS_Terra_CorrectedReflectance_TrueColor", tms: "GoogleMapsCompatible_Level9", ext: "jpg", maxNative: 9, period: "P1D",
      label: "MODIS true colour", unit: "", legend: null, kind: "base",
      note: "MODIS Terra corrected reflectance, about 250 m. Daily; clouds appear as observed." },
    ndvi: { id: "MODIS_Terra_L3_NDVI_16Day", tms: "GoogleMapsCompatible_Level9", ext: "png", maxNative: 9, period: "P16D",
      label: "NDVI (vegetation index)", legend: "MODIS_L3_NDVI_H.svg", kind: "overlay",
      note: "MODIS Terra 16-day NDVI, about 250 m. Greener colours mean relatively higher vegetation index values in this composite. NDVI is not a direct measure of crop health or nutrients." },
    evi: { id: "MODIS_Terra_L3_EVI_16Day", tms: "GoogleMapsCompatible_Level9", ext: "png", maxNative: 9, period: "P16D",
      label: "EVI (enhanced vegetation index)", legend: "MODIS_L3_EVI_H.svg", kind: "overlay",
      note: "MODIS Terra 16-day EVI, about 250 m. Less sensitive than NDVI to soil background and saturation in dense vegetation." },
    imerg: { id: "IMERG_Precipitation_Rate", tms: "GoogleMapsCompatible_Level6", ext: "png", maxNative: 6, period: "P1D",
      label: "Rainfall rate (GPM IMERG)", legend: "GPM_Precipitation_Rate_H.svg", kind: "overlay",
      note: "GPM IMERG daily precipitation rate, about 10 km. Dry areas are transparent." },
    smap: { id: "SMAP_L4_Analyzed_Surface_Soil_Moisture", tms: "GoogleMapsCompatible_Level6", ext: "png", maxNative: 6, period: "P1D",
      label: "Surface soil moisture (SMAP L4)", legend: "SMAP_Analyzed_Soil_Moisture_H.svg", kind: "overlay",
      note: "SMAP Level 4 surface soil moisture (top 5 cm), model value-added, 9 km. Not comparable with a sensor at a specific depth." },
    lst: { id: "MODIS_Terra_L3_Land_Surface_Temp_8Day_Day", tms: "GoogleMapsCompatible_Level7", ext: "png", maxNative: 7, period: "P8D",
      label: "Land surface temperature (day)", legend: "MODIS_Land_Surface_Temp_H.svg", kind: "overlay",
      note: "MODIS Terra 8-day daytime land surface temperature, about 1 km. Surface skin temperature, not air temperature." }
  };

  var manifest = null, colormaps = null;
  function loadManifest() { return manifest ? Promise.resolve(manifest) : FV.data.get("tiles.json").then(function (m) { manifest = m; return m; }).catch(function () { manifest = { cached: [], _farmverse: { bbox: [0, 0, 0, 0] } }; return manifest; }); }
  function loadColormaps() { return colormaps ? Promise.resolve(colormaps) : FV.data.get("colormaps.json").then(function (c) { colormaps = c; return c; }); }

  function tileRange(z) {
    var b = manifest._farmverse.bbox;
    function tx(lon) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
    function ty(lat) { var r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z)); }
    return { x0: tx(b[0]), x1: tx(b[2]), y0: ty(b[3]), y1: ty(b[1]) };
  }
  function cachedEntry(key, date) {
    if (!manifest) return null;
    var id = LAYERS[key].id;
    return manifest.cached.filter(function (c) { return c.layer === id && c.date === date && c.tiles > 0; })[0] || null;
  }
  function tileUrl(key, date, z, x, y) {
    var L_ = LAYERS[key], c = cachedEntry(key, date);
    if (c && c.zooms.indexOf(z) > -1) {
      var r = tileRange(z);
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return "data/tiles/" + L_.id + "/" + date + "/" + z + "/" + y + "/" + x + "." + L_.ext;
    }
    return GIBS + L_.id + "/default/" + date + "/" + L_.tms + "/" + z + "/" + y + "/" + x + "." + L_.ext;
  }

  var GibsLayer = L.TileLayer.extend({
    initialize: function (key, date, opts) {
      this._key = key; this._date = date;
      L.TileLayer.prototype.initialize.call(this, "", Object.assign({ maxNativeZoom: LAYERS[key].maxNative, maxZoom: 18, tileSize: 256,
        attribution: 'NASA <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">GIBS</a>', crossOrigin: true, bounds: null }, opts || {}));
    },
    getTileUrl: function (c) { return tileUrl(this._key, this._date, c.z, c.x, c.y); },
    setDate: function (d) { this._date = d; this.redraw(); }
  });

  function esri() {
    return L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community" });
  }
  function osm() {
    return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' });
  }

  function create(el, opts) {
    opts = opts || {};
    var map = L.map(el, { center: opts.center || CENTER, zoom: opts.zoom || 9, zoomControl: true, attributionControl: true, scrollWheelZoom: opts.scroll !== false });
    map.attributionControl.setPrefix(false);
    return map;
  }

  function boundary() {
    return FV.data.get("boundaries.json").then(function (fc) {
      var district = L.geoJSON(fc.features[0], { style: { color: "#FFFFFF", weight: 2.5, fill: false, dashArray: null }, interactive: false });
      return { district: district, feature: fc.features[0], demoField: fc.features[1] };
    });
  }

  function farmLayer(farm) {
    if (!farm || !farm.polygon || farm.polygon.length < 3) {
      if (farm && farm.lat) return L.circleMarker([farm.lat, farm.lon], { radius: 8, color: "#C4DE5A", weight: 3, fillOpacity: 0.2 });
      return null;
    }
    return L.polygon(farm.polygon, { color: "#C4DE5A", weight: 3, fillColor: "#C4DE5A", fillOpacity: 0.12 });
  }

  /* Latest cached date for a layer, falling back to a sensible live date. */
  function defaultDate(key) {
    var c = manifest && manifest.cached.filter(function (e) { return e.layer === LAYERS[key].id && e.tiles > 0; });
    if (c && c.length) return c.map(function (e) { return e.date; }).sort().pop();
    var d = new Date(Date.now() - 20 * 86400000);
    return d.toISOString().slice(0, 10);
  }
  function cachedDates(key) { return (manifest ? manifest.cached : []).filter(function (e) { return e.layer === LAYERS[key].id && e.tiles > 0; }).map(function (e) { return e.date; }); }

  /* Snap a date to the layer's compositing period start (16-day composites start on 1 Jan, then every 16 days). */
  function snap(key, iso) {
    var p = LAYERS[key].period, d = new Date(iso + "T00:00:00Z");
    if (p === "P1D") return iso;
    var step = p === "P16D" ? 16 : 8;
    var jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
    var k = Math.floor((d - jan1) / 86400000 / step) * step;
    return new Date(jan1 + k * 86400000).toISOString().slice(0, 10);
  }

  /* Value of a GIBS layer at a point: decode the pixel colour with the layer colormap. */
  function valueAt(key, date, latlng, zoom) {
    var L_ = LAYERS[key];
    if (L_.kind !== "overlay") return Promise.resolve(null);
    var z = Math.min(Math.round(zoom), L_.maxNative);
    var n = Math.pow(2, z);
    var fx = (latlng.lng + 180) / 360 * n;
    var r = latlng.lat * Math.PI / 180;
    var fy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
    var x = Math.floor(fx), y = Math.floor(fy), px = Math.floor((fx - x) * 256), py = Math.floor((fy - y) * 256);
    return Promise.all([loadColormaps(), loadManifest()]).then(function (res) {
      var cm = res[0][L_.id];
      return fetch(tileUrl(key, date, z, x, y)).then(function (rsp) {
        if (!rsp.ok) throw new Error("tile HTTP " + rsp.status);
        return rsp.blob();
      }).then(function (b) { return createImageBitmap(b); }).then(function (bmp) {
        var c = document.createElement("canvas"); c.width = 256; c.height = 256;
        var ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(bmp, 0, 0);
        var d = ctx.getImageData(px, py, 1, 1).data;
        if (d[3] === 0) return { value: null, label: cm.label, unit: cm.unit, reason: "No data at this pixel (masked, cloud, water or below range)" };
        var range = cm.classes[d[0] + "," + d[1] + "," + d[2]];
        if (!range) return { value: null, label: cm.label, unit: cm.unit, reason: "Colour not in the layer colormap" };
        return { value: range, label: cm.label, unit: cm.unit, zoom: z };
      });
    });
  }

  function areaAcres(latlngs) {
    if (!L.GeometryUtil || !latlngs || latlngs.length < 3) return null;
    var m2 = L.GeometryUtil.geodesicArea(latlngs.map(function (p) { return L.latLng(p[0], p[1]); }));
    return m2 / 4046.8564224;
  }

  function legendHtml(key) {
    var L_ = LAYERS[key];
    if (!L_.legend) return "";
    return '<img class="legend-img" src="data/legends/' + L_.legend + '" alt="Colour scale for ' + FV.esc(L_.label) + '" loading="lazy">';
  }

  FV.mapkit = { LAYERS: LAYERS, CENTER: CENTER, create: create, GibsLayer: GibsLayer, esri: esri, osm: osm, boundary: boundary, farmLayer: farmLayer,
    loadManifest: loadManifest, defaultDate: defaultDate, cachedDates: cachedDates, snap: snap, valueAt: valueAt, areaAcres: areaAcres, legendHtml: legendHtml };
})();

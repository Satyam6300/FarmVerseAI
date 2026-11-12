/*
 * Satellite time-series helpers for the cached GIBS series (scripts/fetch_gibs_series.py):
 * MODIS NDVI and EVI 16-day composites (district mean and field pixel) and SMAP L4 surface soil moisture.
 */
(function () {
  "use strict";
  var FV = window.FV;
  function load() { return FV.data.get("gibs_series.json"); }

  // Latest composite with a usable district value (coverage at least 50%).
  function latest(s) {
    for (var i = s.dates.length - 1; i >= 0; i--) {
      if (s.district_mean[i] !== null && s.valid_fraction[i] >= 0.5) return { i: i, date: s.dates[i], value: s.district_mean[i], field: s.field_value ? s.field_value[i] : null, coverage: s.valid_fraction[i] };
    }
    return null;
  }

  // Mean of the same composite date (MM-DD) across a range of years, excluding low-coverage composites.
  function sameDateNormal(s, date, y0, y1) {
    var md = date.slice(5), vals = [];
    s.dates.forEach(function (d, i) {
      var y = +d.slice(0, 4);
      if (d.slice(5) === md && y >= y0 && y <= y1 && s.district_mean[i] !== null && s.valid_fraction[i] >= 0.5) vals.push(s.district_mean[i]);
    });
    return { mean: FV.climate.mean(vals), n: vals.length, p10: FV.climate.pct(vals, 0.1), p90: FV.climate.pct(vals, 0.9) };
  }

  // Seasonal profile: for each composite slot (MM-DD) the value in a given year and the p10/p50/p90 across reference years.
  function profile(s, year, y0, y1, field) {
    var key = field ? "field_value" : "district_mean";
    var slots = {};
    s.dates.forEach(function (d, i) {
      var md = d.slice(5), y = +d.slice(0, 4), v = s[key][i];
      if (v === null || (!field && s.valid_fraction[i] < 0.5)) return;
      slots[md] = slots[md] || { ref: [], cur: null };
      if (y === year) slots[md].cur = v;
      if (y >= y0 && y <= y1) slots[md].ref.push(v);
    });
    return Object.keys(slots).sort().map(function (md) {
      var r = slots[md].ref;
      return { md: md, cur: slots[md].cur, p10: FV.climate.pct(r, 0.1), p50: FV.climate.pct(r, 0.5), p90: FV.climate.pct(r, 0.9), n: r.length };
    });
  }

  // Annual peak of the district mean between months m0 and m1 (inclusive) for each year.
  function annualPeak(s, m0, m1) {
    var out = {};
    s.dates.forEach(function (d, i) {
      var y = +d.slice(0, 4), m = +d.slice(5, 7), v = s.district_mean[i];
      if (m < m0 || m > m1 || v === null || s.valid_fraction[i] < 0.5) return;
      out[y] = Math.max(out[y] || -1, v);
    });
    return out;
  }

  FV.series = { load: load, latest: latest, sameDateNormal: sameDateNormal, profile: profile, annualPeak: annualPeak };
})();

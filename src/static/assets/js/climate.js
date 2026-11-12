/*
 * Climate engine. Loads NASA POWER daily data and computes every climate indicator in the app.
 * Source: NASA POWER Daily API (AG community): PRECTOTCORR (mm/day), T2M_MAX and T2M_MIN (C),
 * GWETTOP and GWETROOT (modelled soil wetness, 0 to 1). Fill values (-999) are treated as missing.
 * A season with any missing day is excluded rather than estimated.
 */
(function () {
  "use strict";
  var FV = window.FV;
  var PARAMS = ["PRECTOTCORR", "T2M_MAX", "T2M_MIN", "GWETTOP", "GWETROOT"];
  var API = "https://power.larc.nasa.gov/api/temporal/daily/point";
  var DEFAULT = { lat: 17.33, lon: 76.83 };
  var NORMAL = [1991, 2020];

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function dim(y, m) { return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
  function doy(y, m, d) { var n = 0; for (var i = 1; i < m; i++) n += dim(y, i); return n + d; }

  function parse(json) {
    var p = json && json.properties && json.properties.parameter;
    if (!p || !p.PRECTOTCORR) throw new Error("POWER response has no PRECTOTCORR values");
    var fill = (json.header && typeof json.header.fill_value === "number") ? json.header.fill_value : -999;
    var keys = Object.keys(p.PRECTOTCORR).filter(function (k) { return /^\d{8}$/.test(k); }).sort();
    function val(k, key) { var v = p[key] ? p[key][k] : undefined; return (typeof v === "number" && v !== fill && v > -900) ? v : null; }
    var days = keys.map(function (k) {
      var y = +k.slice(0, 4), m = +k.slice(4, 6), d = +k.slice(6, 8);
      return { key: k, y: y, m: m, d: d, doy: doy(y, m, d), pr: val(k, "PRECTOTCORR"), tx: val(k, "T2M_MAX"), tn: val(k, "T2M_MIN"), gt: val(k, "GWETTOP"), gr: val(k, "GWETROOT") };
    });
    while (days.length && days[days.length - 1].pr === null) days.pop(); // trailing near-real-time gap
    var byYear = {};
    days.forEach(function (r) { (byYear[r.y] = byYear[r.y] || []).push(r); });
    var coords = json.geometry && json.geometry.coordinates;
    return { days: days, byYear: byYear, first: days[0].key, last: days[days.length - 1].key, grid: coords ? { lon: coords[0], lat: coords[1] } : null,
      meta: json._farmverse || null };
  }

  var cache = {};
  function load(point) {
    point = point || DEFAULT;
    var isDefault = Math.abs(point.lat - DEFAULT.lat) < 0.005 && Math.abs(point.lon - DEFAULT.lon) < 0.005;
    var key = point.lat.toFixed(3) + "," + point.lon.toFixed(3);
    if (cache[key]) return cache[key];
    var end = new Date(Date.now() - 86400000);
    var endS = end.getUTCFullYear() + String(end.getUTCMonth() + 1).padStart(2, "0") + String(end.getUTCDate()).padStart(2, "0");
    var url = API + "?parameters=" + PARAMS.join(",") + "&community=AG&longitude=" + point.lon.toFixed(4) + "&latitude=" + point.lat.toFixed(4) +
      "&start=19910101&end=" + endS + "&format=JSON&time-standard=LST";
    var live = function () {
      return fetch(url).then(function (r) { if (!r.ok) throw new Error("NASA POWER HTTP " + r.status); return r.json(); })
        .then(function (j) { var d = parse(j); d.source = "live"; d.url = url; d.fetchedAt = new Date().toISOString(); return d; });
    };
    cache[key] = (isDefault ? FV.data.get("power_kalaburagi.json").then(function (j) {
      var d = parse(j); d.source = "cache"; d.url = (j._farmverse && j._farmverse.request_url) || url; d.fetchedAt = j._farmverse && j._farmverse.fetched_at; return d;
    }).catch(live) : live());
    cache[key].catch(function () { delete cache[key]; });
    return cache[key];
  }

  /* ---------- indicators ---------- */
  function window_(data, y, m0, m1) {
    var list = data.byYear[y]; if (!list) return null;
    var sel = list.filter(function (r) { return r.m >= m0 && r.m <= m1; });
    var n = 0; for (var m = m0; m <= m1; m++) n += dim(y, m);
    return sel.length === n ? sel : null;
  }
  function seasonTotal(data, y, m0, m1) {
    var s = window_(data, y, m0, m1); if (!s) return null;
    var t = 0; for (var i = 0; i < s.length; i++) { if (s[i].pr === null) return null; t += s[i].pr; } return t;
  }
  function longestDry(list, th) {
    var best = 0, run = 0;
    for (var i = 0; i < list.length; i++) { if (list[i].pr === null) return null; if (list[i].pr < th) { run++; if (run > best) best = run; } else run = 0; }
    return best;
  }
  function drySpell(data, y, m0, m1, th) { var s = window_(data, y, m0, m1); return s ? longestDry(s, th) : null; }
  function hotDays(data, y, th) {
    var l = data.byYear[y]; if (!l || l.length !== (isLeap(y) ? 366 : 365)) return null;
    var n = 0; for (var i = 0; i < l.length; i++) { if (l[i].tx === null) return null; if (l[i].tx >= th) n++; } return n;
  }
  function annualMean(data, y, f) {
    var l = data.byYear[y]; if (!l || l.length !== (isLeap(y) ? 366 : 365)) return null;
    var s = 0; for (var i = 0; i < l.length; i++) { if (l[i][f] === null) return null; s += l[i][f]; } return s / l.length;
  }
  function monthTotal(data, y, m) {
    var l = data.byYear[y]; if (!l) return null;
    var sel = l.filter(function (r) { return r.m === m; });
    if (sel.length !== dim(y, m) || sel.some(function (r) { return r.pr === null; })) return null;
    return sel.reduce(function (a, r) { return a + r.pr; }, 0);
  }
  function mean(a) { var v = a.filter(function (x) { return x !== null && !isNaN(x); }); return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : null; }
  function pct(a, q) { var v = a.filter(function (x) { return x !== null; }).sort(function (x, y) { return x - y; }); if (!v.length) return null; var i = (v.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); }
  function years(data) { return Object.keys(data.byYear).map(Number).sort(function (a, b) { return a - b; }); }
  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }

  // Ordinary least squares slope of values on years (units per year).
  function slope(xs, ys) {
    var pts = xs.map(function (x, i) { return [x, ys[i]]; }).filter(function (p) { return p[1] !== null; });
    if (pts.length < 5) return null;
    var mx = mean(pts.map(function (p) { return p[0]; })), my = mean(pts.map(function (p) { return p[1]; }));
    var num = 0, den = 0; pts.forEach(function (p) { num += (p[0] - mx) * (p[1] - my); den += (p[0] - mx) * (p[0] - mx); });
    return den ? num / den : null;
  }

  // Monthly rainfall climatology over a period: mean, 10th and 90th percentile per month.
  function monthlyClimatology(data, y0, y1) {
    var out = [];
    for (var m = 1; m <= 12; m++) {
      var vals = range(y0, y1).map(function (y) { return monthTotal(data, y, m); });
      out.push({ m: m, mean: mean(vals), p10: pct(vals, 0.1), p90: pct(vals, 0.9), n: vals.filter(function (v) { return v !== null; }).length });
    }
    return out;
  }

  // Mean daily value by day of year over a period (365 slots; Feb 29 folded into Feb 28).
  function dailyNormal(data, field, y0, y1) {
    var sum = new Array(366).fill(0), cnt = new Array(366).fill(0);
    data.days.forEach(function (r) {
      if (r.y < y0 || r.y > y1 || r[field] === null) return;
      var i = r.doy - 1; if (isLeap(r.y) && r.doy > 59) i -= 1; if (i > 364) i = 364;
      sum[i] += r[field]; cnt[i]++;
    });
    return sum.slice(0, 365).map(function (s, i) { return cnt[i] ? s / cnt[i] : null; });
  }

  /* Current-season facts for the dashboard and advisor. */
  function currentStatus(data) {
    var last = data.days[data.days.length - 1];
    var y = last.y;
    var monsoonDone = last.m >= 10;
    var jjasYear = monsoonDone ? y : y - 1;
    var normalJJAS = mean(range(NORMAL[0], NORMAL[1]).map(function (yy) { return seasonTotal(data, yy, 6, 9); }));
    var jjas = seasonTotal(data, jjasYear, 6, 9);
    var normalDry = mean(range(NORMAL[0], NORMAL[1]).map(function (yy) { return drySpell(data, yy, 6, 9, 2.5); }));
    var dry = drySpell(data, jjasYear, 6, 9, 2.5);
    var tnorm = dailyNormal(data, "tx", NORMAL[0], NORMAL[1]);
    var last30 = data.days.slice(-30);
    var tx30 = mean(last30.map(function (r) { return r.tx; }));
    var tx30n = mean(last30.map(function (r) { var i = r.doy - 1; if (isLeap(r.y) && r.doy > 59) i--; return tnorm[Math.min(i, 364)]; }));
    var months = [];
    for (var m = 1; m <= 12; m++) months.push(monthTotal(data, y, m));
    return {
      lastDay: last.key, year: y, jjasYear: jjasYear, jjas: jjas, normalJJAS: normalJJAS,
      jjasPct: (jjas !== null && normalJJAS) ? jjas / normalJJAS * 100 : null,
      dry: dry, normalDry: normalDry, tx30: tx30, tx30Normal: tx30n, last30: last30, tnorm: tnorm,
      monthsThisYear: months, climatology: monthlyClimatology(data, NORMAL[0], NORMAL[1]),
      gwettop: last.gt, gwetroot: last.gr
    };
  }

  /* Crop-window exposure for the digital twin.
     startDoy: sowing day of year; duration: days. For each complete year in [y0, y1] it computes
     rainfall in the window, the longest dry spell in the first 30 days after sowing, and the number of
     days with maximum temperature at or above 35 C. Windows may run into the next calendar year. */
  function windowExposure(data, startDoy, duration, y0, y1) {
    var idx = {}; data.days.forEach(function (r, i) { idx[r.key] = i; });
    var rows = [];
    for (var y = y0; y <= y1; y++) {
      var start = new Date(Date.UTC(y, 0, 1)); start.setUTCDate(startDoy);
      var k = start.getUTCFullYear() + String(start.getUTCMonth() + 1).padStart(2, "0") + String(start.getUTCDate()).padStart(2, "0");
      var i0 = idx[k]; if (i0 === undefined) continue;
      var seg = data.days.slice(i0, i0 + duration);
      if (seg.length < duration || seg.some(function (r) { return r.pr === null || r.tx === null; })) continue;
      rows.push({ year: y, rain: seg.reduce(function (a, r) { return a + r.pr; }, 0), dryEarly: longestDry(seg.slice(0, 30), 2.5),
        hot: seg.filter(function (r) { return r.tx >= 35; }).length });
    }
    function summ(f) { return mean(rows.map(function (r) { return r[f]; })); }
    return { n: rows.length, rain: summ("rain"), dryEarly: summ("dryEarly"), hot: summ("hot"),
      dryRisk: rows.length ? rows.filter(function (r) { return r.dryEarly >= 14; }).length / rows.length : null, rows: rows };
  }

  FV.climate = {
    DEFAULT: DEFAULT, NORMAL: NORMAL, load: load, parse: parse,
    seasonTotal: seasonTotal, drySpell: drySpell, hotDays: hotDays, annualMean: annualMean, monthTotal: monthTotal,
    monthlyClimatology: monthlyClimatology, dailyNormal: dailyNormal, currentStatus: currentStatus, windowExposure: windowExposure,
    mean: mean, pct: pct, slope: slope, years: years, range: range, isLeap: isLeap, doy: doy, dim: dim
  };
})();

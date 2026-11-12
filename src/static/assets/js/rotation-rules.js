/*
 * Shared rotation rules (ported from the version 1 comparison page).
 * Used by Crop Rotation, the Digital Twin and the Advisor. Facts come from the ICAR-CRIDA
 * Gulbarga contingency plan (rotations-data.js); legume status is botanical fact only.
 */
(function () {
  "use strict";
  var R = window.FVRotations;
  function crops(list) { return (list || []).map(function (k) { return R.CROPS[k]; }); }
  function allCrops(rot) { return (rot.kharif || []).concat(rot.rabi || []); }
  function byId(id) { return R.ROTATIONS.filter(function (r) { return r.id === id; })[0] || null; }
  function cropNames(list) { return list && list.length ? crops(list).map(function (c) { return c.name; }).join(" + ") : "Fallow"; }
  function legumeStatus(rot) {
    var cs = crops(allCrops(rot));
    if (cs.some(function (c) { return c.legume === true; })) return true;
    if (cs.some(function (c) { return c.legume === null; })) return null;
    return false;
  }
  function legumeNames(rot) { return crops(allCrops(rot)).filter(function (c) { return c.legume === true; }).map(function (c) { return c.name; }); }
  function usesBothSeasons(rot) { return (rot.kharif || []).length > 0 && ((rot.rabi || []).length > 0 || !!rot.rabiNote); }
  function soilMatch(rot, soil) { if (!soil || !rot.soils) return null; return rot.soils.indexOf(soil) !== -1; }
  function ratio(rot) { var m = /\((\d+):(\d+)/.exec(rot.name || ""); return m ? [+m[1], +m[2]] : null; }

  /* Rule-based differences between an alternative and the current rotation.
     Returns [kind, text] pairs; kind is pos, neg or neu. */
  function changes(alt, base, soil) {
    var out = [];
    var la = legumeStatus(alt), lb = legumeStatus(base);
    if (la === true && lb !== true) out.push(["pos", "Adds a legume (" + legumeNames(alt).join(", ") + ") to a sequence that had none."]);
    if (la === false && lb === true) out.push(["neg", "Removes the legume that the current rotation includes."]);
    if (la === null && lb !== true) out.push(["neu", "Legume status depends on which green manure species is used."]);
    var ab = usesBothSeasons(alt), bb = usesBothSeasons(base);
    if (ab && !bb) out.push(["neu", "Uses both kharif and rabi seasons. The second crop depends on stored soil moisture, which the plan ties to medium to deep black soils."]);
    if (!ab && bb) out.push(["neu", "Uses one season instead of two."]);
    if (!(alt.kharif || []).length && (base.kharif || []).length) out.push(["neg", "Gives up the kharif crop to conserve moisture for rabi."]);
    var sa = soilMatch(alt, soil), sb = soilMatch(base, soil);
    if (sa === true && sb === false) out.push(["pos", "Listed for this farm's soil situation, while the current rotation is not."]);
    if (sa === false) out.push(["neg", "Not listed in the plan for this farm's soil situation."]);
    var pa = crops(allCrops(alt)).map(function (c) { return c.name; }), pb = crops(allCrops(base)).map(function (c) { return c.name; });
    var added = pa.filter(function (n) { return pb.indexOf(n) === -1; });
    if (added.length) out.push(["neu", "New crops to manage: " + added.join(", ") + "."]);
    if (alt.contingencyOnly) out.push(["neg", "The plan lists this as a delayed-monsoon contingency, not a normal system."]);
    if (!out.length) out.push(["neu", "No rule-based difference from the current rotation."]);
    return out;
  }

  window.FVRules = { crops: crops, allCrops: allCrops, byId: byId, cropNames: cropNames, legumeStatus: legumeStatus, legumeNames: legumeNames,
    usesBothSeasons: usesBothSeasons, soilMatch: soilMatch, ratio: ratio, changes: changes };
})();

/*
 * Rotation catalogue for the Kalaburagi pilot.
 *
 * Every cropping system, soil situation, sowing window and contingency note below is taken from:
 *   ICAR-CRIDA and UAS Raichur, "Agriculture Contingency Plan for District: Gulbarga" (Karnataka KA8, 2011).
 *   https://www.icar-crida.res.in/CP/Karnataka/UAS,%20Raichur/KA8-Gulbarga%203.2.2011.pdf
 * District area (2008-09) and productivity (average of 2004 to 2008) are copied from tables 1.7 and 1.11
 * of the same plan. They are government-reported district averages, not farm predictions.
 *
 * The plan covers rainfed situations. Irrigated rotations are not in this catalogue.
 * Whether a crop is a legume is a botanical fact and says nothing about how much nitrogen it supplies.
 */
(function () {
  "use strict";

  var SOURCE_URL = "https://www.icar-crida.res.in/CP/Karnataka/UAS,%20Raichur/KA8-Gulbarga%203.2.2011.pdf";

  // Farming situations exactly as the contingency plan groups them.
  var SOILS = {
    S1: "Medium deep black and red clay loams (kharif and rabi)",
    S2: "Medium and deep black soils and red clay loam soils (kharif)",
    S3: "Medium to deep black soils (rabi)",
    S4: "Shallow black soils and red sandy soils (kharif)"
  };

  // Crop facts used by the rules. Productivity in kg/ha, area in thousand hectares (rainfed).
  var CROPS = {
    redgram:   { name: "Pigeonpea (redgram, tur)", legume: true,  season: "kharif", sowing: "June to July 2nd fortnight", area: 378.8, yieldKgHa: 640,
                 pests: "Blight, pod borer, sterility mosaic" },
    sorghumK:  { name: "Sorghum (kharif)", legume: false, season: "kharif", sowing: "June 1st fortnight to June 2nd fortnight", area: 7.3, yieldKgHa: 1515,
                 pests: "Rust, grain mould" },
    sorghumR:  { name: "Sorghum (rabi jowar)", legume: false, season: "rabi", sowing: "September 2nd fortnight to October 1st fortnight", area: 171.7, yieldKgHa: 1037,
                 pests: "Rust, grain mould" },
    chickpea:  { name: "Chickpea (Bengal gram)", legume: true,  season: "rabi", sowing: "October 1st fortnight to November 2nd fortnight", area: 115.6, yieldKgHa: 582,
                 pests: "Wilt, pod borer" },
    sunflower: { name: "Sunflower", legume: false, season: "kharif", sowing: "August 2nd fortnight to September 2nd fortnight (kharif); October (rabi)", area: 47.0, yieldKgHa: 380,
                 pests: "Bihar hairy caterpillar, necrosis disease, earhead borer" },
    bajra:     { name: "Pearl millet (bajra)", legume: false, season: "kharif", sowing: "June 2nd fortnight to July 2nd fortnight", area: 34.3, yieldKgHa: 730,
                 pests: "Ergot" },
    greengram: { name: "Green gram", legume: true,  season: "kharif", sowing: null, area: null, yieldKgHa: null, pests: null },
    soybean:   { name: "Soybean", legume: true,  season: "kharif", sowing: null, area: null, yieldKgHa: null, pests: null },
    greenManure: { name: "Green manuring crop", legume: null, season: "kharif", sowing: null, area: null, yieldKgHa: null, pests: null }
  };

  /*
   * Rotations. "soils" lists the farming situations under which the plan lists this system as a normal
   * crop or cropping system. "contingency" holds notes the plan gives for the crops in the system.
   */
  var ROTATIONS = [
    {
      id: "R1", name: "Sole pigeonpea", short: "Pigeonpea",
      kharif: ["redgram"], rabi: [], soils: ["S1", "S2"],
      contingency: [
        "Delayed monsoon by 2 weeks: no change in crop; follow dry sowing of pigeonpea.",
        "Delayed by 4 weeks: use 20% extra seed, avoid long-duration varieties, or transplant 25 to 30 day old seedlings.",
        "Delayed by 8 weeks (August 2nd week): on medium deep black and red clay loams the plan lists sunflower, horsegram or navane; on medium and deep black soils, sunflower or fodder crops."
      ]
    },
    {
      id: "R2", name: "Sorghum + pigeonpea intercrop (2:1)", short: "Sorghum + pigeonpea",
      kharif: ["sorghumK", "redgram"], rabi: [], soils: ["S1", "S2", "S4"],
      contingency: [
        "Listed as a normal system on all three kharif soil situations, including shallow black and red sandy soils.",
        "Mid-season dry spell: the plan advises thinning alternate rows of sorghum at 30 to 45 days after sowing and repeated intercultivation."
      ]
    },
    {
      id: "R3", name: "Pigeonpea + green gram intercrop (1:2 or 2:4)", short: "Pigeonpea + green gram",
      kharif: ["redgram", "greengram"], rabi: [], soils: ["S1", "S2"],
      contingency: [
        "Terminal drought: the plan notes pigeonpea and green gram can be harvested for vegetable purpose.",
        "Flowering-stage dry spell: the plan suggests incorporating green gram into the soil as green manure."
      ]
    },
    {
      id: "R4", name: "Pearl millet + pigeonpea intercrop (2:1)", short: "Bajra + pigeonpea",
      kharif: ["bajra", "redgram"], rabi: [], soils: ["S1", "S2", "S4"],
      contingency: [
        "Flowering-stage dry spell: the plan suggests harvesting bajra for fodder and allowing ratooning."
      ]
    },
    {
      id: "R5", name: "Green gram, then chickpea", short: "Green gram then chickpea",
      kharif: ["greengram"], rabi: ["chickpea"], soils: ["S3"],
      contingency: [
        "Rabi crop relies on moisture stored in medium to deep black soils; the plan advises compartment bunding to conserve it.",
        "Delayed monsoon by 4 weeks or more: the plan lists keeping the kharif season fallow with compartment bunds and sowing chickpea in rabi."
      ]
    },
    {
      id: "R6", name: "Soybean, then rabi sorghum", short: "Soybean then rabi jowar",
      kharif: ["soybean"], rabi: ["sorghumR"], soils: ["S3"],
      contingency: [
        "Rabi crop relies on stored soil moisture; the plan advises compartment bunding and tied ridges.",
        "Delayed monsoon by 4 weeks or more: kharif fallow with in-situ moisture conservation, then rabi sorghum."
      ]
    },
    {
      id: "R7", name: "Sunflower, then chickpea", short: "Sunflower then chickpea",
      kharif: ["sunflower"], rabi: ["chickpea"], soils: ["S3"],
      contingency: [
        "Rabi crop relies on stored soil moisture; the plan advises compartment bunding."
      ]
    },
    {
      id: "R8", name: "Kharif fallow with compartment bunds, then chickpea", short: "Fallow then chickpea",
      kharif: [], rabi: ["chickpea"], soils: ["S3"], contingencyOnly: true,
      contingency: [
        "The plan lists this as a contingency when the monsoon is delayed by 4 to 8 weeks, not as the normal system.",
        "Keeping kharif fallow forgoes a kharif crop in exchange for conserving moisture for chickpea."
      ]
    },
    {
      id: "R9", name: "Green manuring crop, then a rabi crop", short: "Green manure then rabi crop",
      kharif: ["greenManure"], rabi: [], rabiNote: "Rabi crop not specified in the plan", soils: ["S3"],
      contingency: [
        "The plan does not name the green manure species. Whether it is a legume depends on the species chosen."
      ]
    },
    {
      id: "R10", name: "Sole sorghum (kharif)", short: "Sole kharif sorghum",
      kharif: ["sorghumK"], rabi: [], soils: ["S1", "S4"],
      contingency: [
        "Delayed monsoon by 6 weeks on shallow black and red sandy soils: the plan lists spreading groundnut, sunflower, castor, setaria or horsegram instead of sorghum."
      ]
    }
  ];

  window.FVRotations = { SOURCE_URL: SOURCE_URL, SOILS: SOILS, CROPS: CROPS, ROTATIONS: ROTATIONS };
})();

/*
 * Crop durations and machine-readable sowing windows (added in version 2).
 * Durations are variety ranges from published variety lists; they vary with variety and season.
 *   Pigeonpea: Karnataka variety list, varieties recommended for the Gulbarga area (ikisan, Nagarjuna group).
 *   Others: Tamil Nadu Agricultural University (TNAU) Agritech portal variety pages. These are not
 *   Karnataka-specific; local varieties may differ and should be confirmed with UAS Raichur or the KVK.
 * Sowing windows come from the ICAR-CRIDA plan above, as day-of-year ranges. Where the plan gives no
 * window (green gram, soybean, green manure) the window is null and the interface shows it as missing.
 */
(function () {
  "use strict";
  var C = window.FVRotations.CROPS;
  var SRC = {
    ikisan: { label: "Karnataka redgram varieties (ikisan)", url: "https://www.ikisan.com/ka-redgram-varieties.html" },
    tnauBg: { label: "TNAU Agritech: Bengal gram varieties", url: "https://agritech.tnau.ac.in/agriculture/agri_seasonandvarieties_bengalgram.html" },
    tnauSg: { label: "TNAU Agritech: sorghum varieties", url: "https://agritech.tnau.ac.in/agriculture/agri_seasonandvarieties_sorghum.html" },
    tnauPm: { label: "TNAU Agritech: pearl millet varieties", url: "https://agritech.tnau.ac.in/agriculture/agri_seasonandvarieties_cumbu.html" },
    tnauSf: { label: "TNAU Agritech: sunflower varieties", url: "https://agritech.tnau.ac.in/agriculture/agri_seasonandvarieties_sunflower.html" },
    tnauSb: { label: "TNAU Agritech: soybean varieties", url: "https://agritech.tnau.ac.in/agriculture/agri_seasonandvarieties_soybean.html" },
    tnauGg: { label: "TNAU Agritech: green gram", url: "https://agritech.tnau.ac.in/agriculture/pulses_greengram.html" }
  };
  // [min, max, typical] days; window: [first day of year, last day of year] of the plan's sowing window.
  var X = {
    redgram:   { dur: [160, 215, 180], src: SRC.ikisan, window: [152, 212], windowNote: "June to July 2nd fortnight" },
    sorghumK:  { dur: [90, 150, 105], src: SRC.tnauSg, window: [152, 181] },
    sorghumR:  { dur: [90, 150, 105], src: SRC.tnauSg, window: [259, 288] },
    chickpea:  { dur: [85, 85, 85], src: SRC.tnauBg, window: [274, 334], durNote: "One variety (CO 4) listed; varieties grown in Karnataka may take longer." },
    sunflower: { dur: [85, 95, 90], src: SRC.tnauSf, window: [228, 273] },
    bajra:     { dur: [75, 90, 85], src: SRC.tnauPm, window: [167, 212] },
    greengram: { dur: [56, 90, 65], src: SRC.tnauGg, window: null },
    soybean:   { dur: [80, 100, 90], src: SRC.tnauSb, window: null },
    greenManure: { dur: null, src: null, window: null }
  };
  Object.keys(X).forEach(function (k) { if (C[k]) Object.assign(C[k], X[k]); });
  window.FVRotations.DURATION_SOURCES = SRC;
})();

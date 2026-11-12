# FARMVERSE AI 2.0

Agricultural decision support for the NASA Space Apps Challenge 2026, challenge
"Field Shift: Adapting Farms with NASA Data". Pilot: Kalaburagi district, Karnataka.

One decision: **which crop rotation should this farm consider for the next growing cycle?**

**Status: pre-launch. Do not deploy publicly until every item in DEPLOYMENT.md is done.**

## Run it

```bash
python3 tools/build.py                 # builds site/ from src/
cd site && python3 -m http.server 8000 # open http://localhost:8000
```

Serve over HTTP; browsers block data loading from `file://` pages. No build tools, Node or API keys are needed to run the site.

## Modules

| Page | What it does | Data |
|---|---|---|
| `index.html` | Landing page with real MODIS imagery of the district | GIBS, cached |
| `dashboard.html` Command Center | Season rainfall, 30-day temperature, SMAP soil moisture, NDVI vs usual, rule-based alerts, farm map, rotation, sensors, data freshness | POWER, GIBS series |
| `farm.html` My Farm | Four-step profile: location (map), field, crops, soil and water; validation; unknowns marked Missing | localStorage |
| `map.html` Farm Map | Leaflet map: Esri imagery, MODIS true colour, NDVI, EVI, IMERG, SMAP, LST layers with date picker, legends, click-to-read values, field drawing, place search | GIBS live + cached tiles |
| `nasa.html` NASA Intelligence | NDVI and EVI 2001 to 2026 (district and field pixel), seasonal profile, monsoon peaks, SMAP 2015 to 2026, POWER modelled soil wetness, mission status | GIBS series, POWER |
| `climate.html` Climate Analytics | Seasonal rainfall, anomalies, monthly climatology, cumulative year-to-date, dry spells, Tmax and Tmin trends, hot days, any point in India (live), CSV | POWER |
| `crops.html` Crop Intelligence | District area and yield 1997-98 to 2024-25, forward-chaining validation of a baseline model against simple baselines, coefficients, in-season estimate, team pipeline slot | DES, UPAG, POWER |
| `rotation.html` Crop Rotation | Current vs two alternatives, two-year planner, shortlist by soil | ICAR-CRIDA plan |
| `twin.html` Farm Digital Twin | Three editable scenarios; month-by-month field view; calendar for all scenarios; exposure to observed weather; what changes; assumptions and missing data | Plan, durations, POWER |
| `iot.html` IoT Monitoring | Live readings from the backend, or labelled DEMO DATA; nodes, health, thresholds | backend/ |
| `advisor.html` AI Farm Advisor | Rule-based Q&A over the app's own data, in five sections | All of the above |
| `reports.html` Reports | Printable report (Save as PDF) and CSV/JSON exports | All of the above |
| `data-sources.html`, `settings.html`, `about.html`, `privacy.html`, `terms.html`, `404.html` | Transparency, settings, legal | |

Farmer and Expert modes and English, Kannada and Hindi are switchable from the top bar on every app page.
Kannada and Hindi strings (178 interface strings) were written with AI assistance and need native-speaker review.
Crop names, farm names and Expert-mode technical text remain in English.

## Data pipeline (run before the event)

```bash
python3 scripts/run_all.py   # about 15 to 25 minutes; needs internet
python3 tools/build.py
```

| Script | Output (`src/static/data/`) |
|---|---|
| `fetch_power.py` | `power_kalaburagi.json`: NASA POWER daily 1991 to yesterday (PRECTOTCORR, T2M_MAX, T2M_MIN, GWETTOP, GWETROOT) |
| `fetch_boundary.py` | `boundaries.json`: Gulbarga district (DataMeet, Census 2011, CC BY 4.0) plus the illustrative demo field |
| `fetch_colormaps.py` | `colormaps.json`: GIBS colormaps for click-to-read values |
| `fetch_gibs_tiles.py` | `tiles/`, `legends/`, `hero_*.jpg`, `tiles.json`: offline map tiles for chosen dates |
| `fetch_gibs_series.py` | `gibs_series.json`: NDVI, EVI (2001+) and SMAP (2015+) decoded from GIBS tiles with official colormaps |
| `build_crop_data.py` | `crop_stats.json`, `yield_model.json`: Kalaburagi statistics and the validated baseline model |

The cached files in this package were retrieved on 12 November 2026.

## Your existing pipelines

- **Crop-yield pipeline (Sentinel-2, Earth Engine, data.gov.in):** not included; it was not shared with this build. Export predictions to `src/static/data/team_model.json` (format shown on the Crop Intelligence page in Expert mode) and they appear on that page. Compare them with the baseline model using the same forward-chaining years before claiming improvement.
- **LoRa / IoT:** `backend/` contains a FastAPI service (SQLite storage, API-key ingest, validation) and `mqtt_bridge.py` for ChirpStack, The Things Stack or Node-RED messages. Field names follow common Dragino decoders and must be checked against your devices.

```bash
cd backend && pip install -r requirements.txt
export FARMVERSE_INGEST_KEY=change-me FARMVERSE_ALLOWED_ORIGINS=http://localhost:8000
uvicorn app:app --port 8080          # then set http://localhost:8080 in Settings
python3 -m pytest -q tests           # 4 tests
```

## What was tested

Headless Chromium on every page at 1440, 820 and 390 px wide; English, Kannada and Hindi; Farmer and Expert modes; and with all external network blocked (offline). Checks: no JavaScript errors, no horizontal overflow, no untranslated keys, all internal links and anchors resolve. Interactions exercised: scenario edits in the Digital Twin, farm save and validation, rotation shortlist and planner, map click value read-out and layer switching, advisor questions, period validation, all five downloads, IoT demo and unconfigured live mode, language and mode switching, the seven-step guided demo. The indicator maths in version 1 was checked against an independent Python calculation; the yield model is validated inside `build_crop_data.py`.

Offline behaviour: everything works from cache except high-resolution Esri imagery, street map tiles, place search, live POWER requests for new points, and GIBS dates that were not cached; those show clear unavailable states.

## Limitations

See the Data Sources page. In short: POWER values are a 50 km grid cell; GIBS-derived values are quantised colormap classes; SMAP L4 starts in 2015 and is model value-added; the ICAR-CRIDA plan is from 2011 and covers rainfed farming; most crop durations come from Tamil Nadu variety lists; the demo field is illustrative; the baseline model does not beat a simple trend for most crops.

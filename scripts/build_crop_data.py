"""Kalaburagi crop statistics and a transparent, validated baseline yield model.

Inputs
  - Crop-wise Area, Production & Yield (DES), 1997-98 to 2022-23, India Data Portal (ODC-By).
  - Crop-wise Area, Production & Yield (UPAG), 2013-14 to 2024-25, India Data Portal (ODC-By).
  - NASA POWER daily data cached by fetch_power.py.
  The two government series agree exactly where they overlap; DES is used up to 2022-23 and
  UPAG adds 2023-24 and 2024-25.

Quality flags
  A district-season row is flagged when its area is below 10% of that crop's median area
  (for example gram 2009-10, 317 ha). Flagged rows are shown but excluded from the model.

Baseline model (district level, not farm level)
  Ridge regression on standardised features: linear year trend plus season weather from NASA POWER.
  Validation is forward-chaining by year: to predict year t, the model is fitted only on years before t
  (minimum 10 training years). It is compared with three simple baselines on the same years:
  the training-period mean, last year's yield (persistence) and a trend-only line.
  Prediction intervals come from the 10th and 90th percentiles of the out-of-sample errors.

This is NOT the team's Sentinel-2 / Earth Engine pipeline. It is a transparent reference model
that the team's model should beat before it is shown as better.
"""
import json
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from common import DATA, UA, now_iso, write_json

RAW = Path(__file__).resolve().parent / "raw"
DES_URL = "https://ckandev.indiadataportal.com/dataset/f2bbc28c-6c7c-462b-9064-ea4c4213d466/resource/f980409d-49a2-42ae-9eb0-182365005c04/download/crop-wise-area-production-yield.csv"
UPAG_URL = "https://ckandev.indiadataportal.com/dataset/f2bbc28c-6c7c-462b-9064-ea4c4213d466/resource/6f70d961-3a4f-4caa-b08f-f72f708791e1/download/cropwise-area-production-yield-upag.csv"
DATASET_PAGE = "https://ckandev.indiadataportal.com/dataset/area-production-yield-apy"

# key: (label, DES crop name, UPAG crop name, season, weather feature set)
CROPS = {
    "tur": ("Pigeonpea (tur)", "Arhar/Tur", "Tur", "Kharif", "kharif_long"),
    "jowar_rabi": ("Sorghum, rabi (jowar)", "Jowar", "Jowar", "Rabi", "rabi"),
    "gram": ("Chickpea (gram)", "Gram", "Gram", "Rabi", "rabi"),
    "jowar_kharif": ("Sorghum, kharif (jowar)", "Jowar", "Jowar", "Kharif", "kharif"),
    "bajra": ("Pearl millet (bajra)", "Bajra", "Bajra", "Kharif", "kharif"),
    "moong": ("Green gram (moong)", "Moong(Green Gram)", "Moong", "Kharif", "kharif"),
    "urad": ("Black gram (urad)", "Urad", "Urad", "Kharif", "kharif"),
    "sunflower_kharif": ("Sunflower, kharif", "Sunflower", "Sunflower", "Kharif", "kharif"),
    "soybean": ("Soybean", "Soyabean", "Soybean", "Kharif", "kharif"),
}

FEATURE_SETS = {
    # Pigeonpea occupies the field from June into winter: monsoon rain, dry spell and post-monsoon rain.
    "kharif_long": ["kharif_rain", "dry_spell", "rabi_rain"],
    "kharif": ["kharif_rain", "dry_spell", "hot_days_jjas"],
    # Rainfed rabi crops grow on stored monsoon moisture plus October to December rain.
    "rabi": ["kharif_rain", "rabi_rain", "tmax_nd"],
}
# Features that are complete as soon as September ends, used for an in-season estimate.
EARLY = ["kharif_rain", "dry_spell", "hot_days_jjas"]

FEATURE_LABELS = {
    "kharif_rain": "June to September rainfall (mm)",
    "dry_spell": "Longest June to September dry spell (days, rain < 2.5 mm)",
    "rabi_rain": "October to December rainfall (mm)",
    "hot_days_jjas": "June to September days with maximum at or above 35 C",
    "tmax_nd": "Mean maximum temperature, November and December (C)",
    "year": "Linear year trend",
}


def ensure(path, url):
    if not path.exists():
        RAW.mkdir(exist_ok=True)
        print("downloading", url)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        path.write_bytes(urllib.request.urlopen(req, timeout=600).read())
    return path


def weather_table():
    d = json.loads((DATA / "power_kalaburagi.json").read_text())
    p = d["properties"]["parameter"]
    fill = d["header"].get("fill_value", -999)
    df = pd.DataFrame({k: pd.Series(p[k]) for k in ["PRECTOTCORR", "T2M_MAX"]})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df = df.mask(df == fill)
    rows = []
    for y in sorted(set(df.index.year)):
        jjas = df[(df.index.year == y) & (df.index.month.isin([6, 7, 8, 9]))]
        ond = df[(df.index.year == y) & (df.index.month.isin([10, 11, 12]))]
        nd = df[(df.index.year == y) & (df.index.month.isin([11, 12]))]
        r = {"year": y}
        if len(jjas) == 122 and jjas.PRECTOTCORR.notna().all():
            pr = jjas.PRECTOTCORR.values
            run = best = 0
            for v in pr:
                run = run + 1 if v < 2.5 else 0
                best = max(best, run)
            r["kharif_rain"] = float(pr.sum())
            r["dry_spell"] = best
            r["hot_days_jjas"] = int((jjas.T2M_MAX >= 35).sum())
        if len(ond) == 92 and ond.PRECTOTCORR.notna().all():
            r["rabi_rain"] = float(ond.PRECTOTCORR.sum())
        if len(nd) == 61 and nd.T2M_MAX.notna().all():
            r["tmax_nd"] = float(nd.T2M_MAX.mean())
        rows.append(r)
    return pd.DataFrame(rows).set_index("year")


def crop_series(des, upag, dname, uname, season):
    a = des[(des.state_name == "Karnataka") & (des.district_name == "Kalaburagi") & (des.crop_name == dname) & (des.season == season)]
    a = a[["year", "area", "production", "yield"]].copy()
    a["source"] = "DES"
    b = upag[(upag.state_name == "Karnataka") & (upag.district_name == "Kalaburagi") & (upag.crop_name == uname) & (upag.season == season)]
    b = b[["year", "area", "production", "yield"]].copy()
    b["yield"] = b["yield"] / 1000.0  # UPAG yield is kg/ha; convert to t/ha
    b["source"] = "UPAG"
    b = b[~b.year.isin(a.year)]
    s = pd.concat([a, b]).sort_values("year")
    s["season_year"] = s.year.str.slice(0, 4).astype(int)
    s = s.dropna(subset=["yield"])
    med = s.area.median()
    s["flag"] = np.where(s.area < 0.1 * med, "area below 10% of median; excluded from model", "")
    return s


def evaluate(df, feats, min_train=10):
    """Forward-chaining evaluation. Returns per-year predictions for model and baselines."""
    df = df.dropna(subset=feats + ["yield"]).sort_values("season_year")
    years = df.season_year.values
    out = []
    for i in range(min_train, len(df)):
        tr, te = df.iloc[:i], df.iloc[i]
        X = tr[["season_year"] + feats].values
        m = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(X, tr["yield"].values)
        pred = float(m.predict(te[["season_year"] + feats].values.reshape(1, -1))[0])
        t = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(tr[["season_year"]].values, tr["yield"].values)
        trend = float(t.predict([[te.season_year]])[0])
        out.append({"year": int(te.season_year), "actual": float(te["yield"]), "model": pred,
                    "mean": float(tr["yield"].mean()), "persistence": float(tr["yield"].iloc[-1]), "trend": trend})
    return out, years


def scores(rows, key):
    e = np.array([r[key] - r["actual"] for r in rows])
    return {"mae": float(np.mean(np.abs(e))), "rmse": float(np.sqrt(np.mean(e ** 2))), "n": len(e)}


def main():
    des = pd.read_csv(ensure(RAW / "des_apy.csv", DES_URL))
    upag = pd.read_csv(ensure(RAW / "upag_apy.csv", UPAG_URL))
    w = weather_table()
    stats, models = {}, {}
    for key, (label, dname, uname, season, fset) in CROPS.items():
        s = crop_series(des, upag, dname, uname, season)
        if s.empty:
            continue
        stats[key] = {"label": label, "season": season, "rows": [
            {"year": r.year, "season_year": int(r.season_year), "area_ha": round(float(r.area), 1), "production_t": round(float(r.production), 1),
             "yield_t_ha": round(float(r["yield"]), 3), "source": r.source, "flag": r.flag} for _, r in s.iterrows()]}

        feats = FEATURE_SETS[fset]
        df = s[s.flag == ""].merge(w, left_on="season_year", right_index=True, how="left")
        rows, _ = evaluate(df, feats)
        if len(rows) < 8:
            continue
        sc = {k: scores(rows, k) for k in ["model", "mean", "persistence", "trend"]}
        best_baseline = min(["mean", "persistence", "trend"], key=lambda k: sc[k]["mae"])
        errs = np.array([r["model"] - r["actual"] for r in rows])
        q10, q90 = np.percentile(errs, [10, 90])

        # Fit on all clean years for coefficients (standardised scale) and the in-season estimate.
        full = df.dropna(subset=feats + ["yield"])
        m = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(full[["season_year"] + feats].values, full["yield"].values)
        coefs = dict(zip(["year"] + feats, [round(float(c), 4) for c in m[-1].coef_]))

        # In-season estimate for the latest year whose June to September weather is complete,
        # using only early features, validated the same way.
        early_df = df.copy()
        early_rows, _ = evaluate(early_df, EARLY)
        estimate = None
        latest_year = int(w.dropna(subset=EARLY).index.max())
        last_yield_year = int(s.season_year.max())
        if latest_year > last_yield_year and len(early_rows) >= 8:
            e_full = early_df.dropna(subset=EARLY + ["yield"])
            em = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(e_full[["season_year"] + EARLY].values, e_full["yield"].values)
            xrow = [latest_year] + [float(w.loc[latest_year, f]) for f in EARLY]
            pred = float(em.predict([xrow])[0])
            ee = np.array([r["model"] - r["actual"] for r in early_rows])
            eq10, eq90 = np.percentile(ee, [10, 90])
            esc = {k: scores(early_rows, k) for k in ["model", "mean", "persistence", "trend"]}
            estimate = {"season_year": latest_year, "yield_t_ha": round(pred, 3),
                        "interval_80": [round(pred - eq90, 3), round(pred - eq10, 3)],
                        "features": {f: round(float(w.loc[latest_year, f]), 2) for f in EARLY},
                        "validation": esc,
                        "beats_all_baselines": bool(esc["model"]["mae"] < min(esc[k]["mae"] for k in ["mean", "persistence", "trend"]))}

        models[key] = {
            "label": label, "season": season, "features": feats, "feature_labels": {k: FEATURE_LABELS[k] for k in ["year"] + feats},
            "validation": {"method": "Forward-chaining by year, minimum 10 training years", "scores": sc,
                           "best_baseline": best_baseline,
                           "beats_all_baselines": bool(sc["model"]["mae"] < sc[best_baseline]["mae"]),
                           "interval_80_offsets": [round(float(-q90), 3), round(float(-q10), 3)]},
            "predictions": [{k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()} for r in rows],
            "standardised_coefficients": coefs,
            "in_season_estimate": estimate,
            "training_years": [int(full.season_year.min()), int(full.season_year.max())],
        }
        print(f"{key:18s} n={sc['model']['n']:2d} MAE model {sc['model']['mae']:.3f} | mean {sc['mean']['mae']:.3f} | persistence {sc['persistence']['mae']:.3f} | trend {sc['trend']['mae']:.3f} | estimate {estimate and estimate['yield_t_ha']}")

    meta = {"fetched_at": now_iso(), "dataset_page": DATASET_PAGE, "des_url": DES_URL, "upag_url": UPAG_URL,
            "licence": "Open Data Commons Attribution License (India Data Portal); original data: DES and UPAG, Ministry of Agriculture & Farmers Welfare",
            "notes": "Kalaburagi district as reported in each year. Yadgir district was formed in 2009-10. Abrupt changes in area may reflect reporting or boundary changes."}
    write_json("crop_stats.json", {"_farmverse": meta, "crops": stats})
    write_json("yield_model.json", {"_farmverse": {**meta, "method": __doc__.strip().split("\n\n")[3]}, "models": models,
                                    "weather_years": {str(k): {c: (None if pd.isna(v) else round(float(v), 2)) for c, v in r.items()} for k, r in w.iterrows()}})


if __name__ == "__main__":
    main()

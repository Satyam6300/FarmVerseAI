"""Build vegetation and soil-moisture time series for Kalaburagi from NASA GIBS tiles.

Method
------
NASA GIBS serves MODIS and SMAP products as colour-mapped PNG tiles and publishes the
colormap for each layer (an exact RGB colour -> value-range table). For each date this script:
  1. downloads the tiles covering the district,
  2. converts every pixel back to the midpoint of its colormap class
     (NDVI classes are 0.01 wide, EVI 0.025, SMAP 0.003 m3/m3),
  3. averages pixels whose centres fall inside the district boundary,
  4. reads the single pixel containing the demonstration field centre (vegetation layers only).
Transparent pixels (no data, cloud-masked or below the colormap range) are skipped and the
fraction of usable pixels is stored, so the site can flag low-coverage composites.

Layers
------
MODIS_Terra_L3_NDVI_16Day  MODIS Terra 16-day NDVI (MOD13Q1 based), read at zoom 8 for the district, zoom 9 for the field
MODIS_Terra_L3_EVI_16Day   MODIS Terra 16-day EVI, same zooms
SMAP_L4_Analyzed_Surface_Soil_Moisture  SMAP Level 4 surface soil moisture (model value-added), zoom 6

Limits: values are quantised to the colormap classes; lower zoom levels are resampled
versions of the native data; the field value is one roughly 300 m pixel that also covers
neighbouring land.
"""
import datetime as dt
import io
import json
import math
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

from common import DATA, DEMO_FIELD, UA, now_iso, write_json

GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
LAYERS = {
    "ndvi": {"id": "MODIS_Terra_L3_NDVI_16Day", "tms": "GoogleMapsCompatible_Level9", "cmap": "MODIS_L3_NDVI", "z": 8, "zfield": 9, "unit": ""},
    "evi": {"id": "MODIS_Terra_L3_EVI_16Day", "tms": "GoogleMapsCompatible_Level9", "cmap": "MODIS_L3_EVI", "z": 8, "zfield": 9, "unit": ""},
    "smap": {"id": "SMAP_L4_Analyzed_Surface_Soil_Moisture", "tms": "GoogleMapsCompatible_Level6", "cmap": "SMAP_Analyzed_Soil_Moisture", "z": 6, "zfield": None, "unit": "m3/m3"},
}


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
    return None


def load_colormap(name):
    root = ET.fromstring(get(f"https://gibs.earthdata.nasa.gov/colormaps/v1.3/{name}.xml"))
    table = {}
    for e in root.iter("ColorMapEntry"):
        rgb = tuple(int(v) for v in e.get("rgb").split(","))
        if e.get("transparent") == "true" or e.get("nodata") == "true":
            continue
        v = e.get("value").strip("[]()")
        parts = [p for p in v.split(",") if p]
        lo = float(parts[0])
        hi = float(parts[1]) if len(parts) > 1 and "INF" not in parts[1] else lo
        table[rgb] = (lo + hi) / 2 if hi != lo else lo
    return table


def tile_xy(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    lr = math.radians(lat)
    y = (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n
    return x, y


def pixel_lonlat(z, tx, ty):
    n = 256 * 2 ** z
    i = np.arange(256) + 0.5
    gx = tx * 256 + i
    gy = ty * 256 + i
    lon = gx / n * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * gy / n))))
    return np.meshgrid(lon, lat)


def inside(poly, lon, lat):
    """Vectorised ray casting for one polygon ring."""
    res = np.zeros(lon.shape, dtype=bool)
    xs, ys = poly[:, 0], poly[:, 1]
    j = len(poly) - 1
    for k in range(len(poly)):
        cond = ((ys[k] > lat) != (ys[j] > lat)) & (lon < (xs[j] - xs[k]) * (lat - ys[k]) / (ys[j] - ys[k] + 1e-15) + xs[k])
        res ^= cond
        j = k
    return res


def decode(png, table):
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    a = np.asarray(im)
    vals = np.full(a.shape[:2], np.nan)
    opaque = a[:, :, 3] > 0
    keys = a[:, :, 0].astype(np.int32) * 65536 + a[:, :, 1].astype(np.int32) * 256 + a[:, :, 2].astype(np.int32)
    lut = {r * 65536 + g * 256 + b: v for (r, g, b), v in table.items()}
    uniq = np.unique(keys[opaque])
    unmatched = 0
    for u in uniq:
        m = (keys == u) & opaque
        if int(u) in lut:
            vals[m] = lut[int(u)]
        else:
            unmatched += int(m.sum())
    return vals, unmatched


def dates_16day(first_year, last_date):
    out = []
    for y in range(first_year, last_date.year + 1):
        d = dt.date(y, 1, 1)
        while d.year == y:
            if d <= last_date:
                out.append(d)
            d += dt.timedelta(days=16)
    return out


def run_layer(key, dates, boundary):
    cfg = LAYERS[key]
    table = load_colormap(cfg["cmap"])
    z = cfg["z"]
    xs = boundary[:, 0]
    ys = boundary[:, 1]
    x0, y0 = tile_xy(xs.min(), ys.max(), z)
    x1, y1 = tile_xy(xs.max(), ys.min(), z)
    tiles = [(tx, ty) for tx in range(int(x0), int(x1) + 1) for ty in range(int(y0), int(y1) + 1)]
    masks = {}
    for tx, ty in tiles:
        lon, lat = pixel_lonlat(z, tx, ty)
        masks[(tx, ty)] = inside(boundary, lon, lat)
    total_px = sum(int(m.sum()) for m in masks.values())

    f = DEMO_FIELD["center"]
    field = None
    if cfg["zfield"]:
        fx, fy = tile_xy(f["lon"], f["lat"], cfg["zfield"])
        field = (int(fx), int(fy), int((fx % 1) * 256), int((fy % 1) * 256))

    def one(d):
        ds = d.isoformat()
        acc, n, unmatched, ok_tiles = 0.0, 0, 0, 0
        for tx, ty in tiles:
            png = get(f"{GIBS}/{cfg['id']}/default/{ds}/{cfg['tms']}/{z}/{ty}/{tx}.png")
            if not png:
                continue
            ok_tiles += 1
            v, um = decode(png, table)
            unmatched += um
            sel = v[masks[(tx, ty)]]
            sel = sel[~np.isnan(sel)]
            acc += float(sel.sum())
            n += sel.size
        fv = None
        if field:
            png = get(f"{GIBS}/{cfg['id']}/default/{ds}/{cfg['tms']}/{cfg['zfield']}/{field[1]}/{field[0]}.png")
            if png:
                v, _ = decode(png, table)
                pv = v[field[3], field[2]]
                fv = None if np.isnan(pv) else round(float(pv), 4)
        if ok_tiles == 0:
            return ds, None, 0.0, fv, 0
        return ds, (round(acc / n, 4) if n else None), round(n / total_px, 3), fv, unmatched

    with ThreadPoolExecutor(max_workers=8) as ex:
        rows = list(ex.map(one, dates))
    print(key, "dates:", len(rows), "with district value:", sum(1 for r in rows if r[1] is not None))
    return {
        "layer": cfg["id"], "unit": cfg["unit"], "zoom_district": z, "zoom_field": cfg["zfield"],
        "district_pixels": total_px, "tiles": tiles,
        "dates": [r[0] for r in rows], "district_mean": [r[1] for r in rows],
        "valid_fraction": [r[2] for r in rows], "field_value": [r[3] for r in rows],
        "unmatched_pixels": [r[4] for r in rows],
    }


def main():
    b = json.loads((DATA / "boundaries.json").read_text())
    ring = np.array(b["features"][0]["geometry"]["coordinates"][0])
    veg_last = dt.date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else dt.date.today() - dt.timedelta(days=20)
    veg_dates = dates_16day(2001, veg_last)
    out = {"_farmverse": {"fetched_at": now_iso(), "method": __doc__.strip().split("\n\n")[1], "source": GIBS,
                          "field_center": DEMO_FIELD["center"]}}
    out["ndvi"] = run_layer("ndvi", veg_dates, ring)
    out["evi"] = run_layer("evi", veg_dates, ring)
    smap_dates = [d for d in dates_16day(2015, dt.date.today() - dt.timedelta(days=5)) if d >= dt.date(2015, 4, 7)]
    out["smap"] = run_layer("smap", smap_dates, ring)
    write_json("gibs_series.json", out)


if __name__ == "__main__":
    main()

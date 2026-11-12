"""Cache NASA GIBS map tiles over Kalaburagi for offline demonstrations, plus legends and
two stitched images (true colour and NDVI) used on the landing page.

Tiles are saved unchanged under src/static/data/tiles/<layer>/<date>/<z>/<y>/<x>.<ext>
and listed in src/static/data/tiles.json. The map uses a cached tile when one exists for the
selected layer, date and zoom, and otherwise requests the tile live from GIBS.
GIBS imagery is NASA open data.
"""
import datetime as dt
import io
import json
import math
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw

from common import DATA, UA, now_iso, write_json

GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
BBOX = (75.9, 16.55, 77.85, 17.95)  # lon_min, lat_min, lon_max, lat_max (district plus margin)

# layer id -> (tile matrix set, extension, zooms, legend file)
LAYERS = {
    "MODIS_Terra_CorrectedReflectance_TrueColor": ("GoogleMapsCompatible_Level9", "jpg", [7, 8, 9], None),
    "MODIS_Terra_L3_NDVI_16Day": ("GoogleMapsCompatible_Level9", "png", [7, 8, 9], "MODIS_L3_NDVI_H.svg"),
    "MODIS_Terra_L3_EVI_16Day": ("GoogleMapsCompatible_Level9", "png", [7, 8, 9], "MODIS_L3_EVI_H.svg"),
    "IMERG_Precipitation_Rate": ("GoogleMapsCompatible_Level6", "png", [5, 6], "GPM_Precipitation_Rate_H.svg"),
    "SMAP_L4_Analyzed_Surface_Soil_Moisture": ("GoogleMapsCompatible_Level6", "png", [5, 6], "SMAP_Analyzed_Soil_Moisture_H.svg"),
    "MODIS_Terra_L3_Land_Surface_Temp_8Day_Day": ("GoogleMapsCompatible_Level7", "png", [6, 7], "MODIS_Land_Surface_Temp_H.svg"),
}


def get(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except Exception:
        return None


def txy(lon, lat, z):
    n = 2 ** z
    lr = math.radians(lat)
    return (lon + 180) / 360 * n, (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n


def tiles_for(z):
    x0, y0 = txy(BBOX[0], BBOX[3], z)
    x1, y1 = txy(BBOX[2], BBOX[1], z)
    return [(int(x), int(y)) for x in range(int(x0), int(x1) + 1) for y in range(int(y0), int(y1) + 1)]


def cache(layer, date):
    tms, ext, zooms, _ = LAYERS[layer]
    jobs = [(z, x, y) for z in zooms for (x, y) in tiles_for(z)]

    def one(j):
        z, x, y = j
        b = get(f"{GIBS}/{layer}/default/{date}/{tms}/{z}/{y}/{x}.{ext}")
        if not b:
            return 0
        p = DATA / "tiles" / layer / date / str(z) / str(y) / f"{x}.{ext}"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b)
        return 1

    with ThreadPoolExecutor(8) as ex:
        n = sum(ex.map(one, jobs))
    print(layer, date, f"{n}/{len(jobs)} tiles")
    return {"layer": layer, "date": date, "zooms": zooms, "ext": ext, "tiles": n, "expected": len(jobs)}


def stitch(layer, date, z, name, boundary):
    tms, ext, _, _ = LAYERS[layer]
    ts = tiles_for(z)
    xs = sorted({t[0] for t in ts}); ys = sorted({t[1] for t in ts})
    img = Image.new("RGBA", (256 * len(xs), 256 * len(ys)), (17, 25, 21, 255))
    for (x, y) in ts:
        p = DATA / "tiles" / layer / date / str(z) / str(y) / f"{x}.{ext}"
        if p.exists():
            t = Image.open(p).convert("RGBA")
            img.alpha_composite(t, ((x - xs[0]) * 256, (y - ys[0]) * 256))
    d = ImageDraw.Draw(img)
    pts = []
    for lon, lat in boundary:
        fx, fy = txy(lon, lat, z)
        pts.append(((fx - xs[0]) * 256, (fy - ys[0]) * 256))
    d.line(pts + [pts[0]], fill=(255, 255, 255, 235), width=3)
    # crop to the boundary extent plus a margin
    minx = min(p[0] for p in pts) - 40; maxx = max(p[0] for p in pts) + 40
    miny = min(p[1] for p in pts) - 40; maxy = max(p[1] for p in pts) + 40
    img = img.crop((int(minx), int(miny), int(maxx), int(maxy))).convert("RGB")
    out = DATA / name
    img.save(out, quality=86)
    print("stitched", out.name, img.size)


def main():
    veg = sys.argv[1] if len(sys.argv) > 1 else "2026-10-16"
    veg_prev = sys.argv[2] if len(sys.argv) > 2 else "2025-10-16"
    tc = sys.argv[3] if len(sys.argv) > 3 else "2026-11-01"
    smap = sys.argv[4] if len(sys.argv) > 4 else "2026-11-08"
    imerg = sys.argv[5] if len(sys.argv) > 5 else "2026-09-15"
    lst = sys.argv[6] if len(sys.argv) > 6 else "2026-11-01"
    plan = [
        ("MODIS_Terra_CorrectedReflectance_TrueColor", tc),
        ("MODIS_Terra_L3_NDVI_16Day", veg), ("MODIS_Terra_L3_NDVI_16Day", veg_prev),
        ("MODIS_Terra_L3_EVI_16Day", veg), ("MODIS_Terra_L3_EVI_16Day", veg_prev),
        ("SMAP_L4_Analyzed_Surface_Soil_Moisture", smap),
        ("IMERG_Precipitation_Rate", imerg),
        ("MODIS_Terra_L3_Land_Surface_Temp_8Day_Day", lst),
    ]
    entries = [cache(l, d) for l, d in plan]
    (DATA / "legends").mkdir(exist_ok=True)
    for layer, (_, _, _, leg) in LAYERS.items():
        if leg:
            b = get(f"https://gibs.earthdata.nasa.gov/legends/{leg}")
            if b:
                (DATA / "legends" / leg).write_bytes(b)
    b = json.loads((DATA / "boundaries.json").read_text())
    ring = b["features"][0]["geometry"]["coordinates"][0]
    stitch("MODIS_Terra_CorrectedReflectance_TrueColor", tc, 9, "hero_truecolor.jpg", ring)
    stitch("MODIS_Terra_L3_NDVI_16Day", veg, 9, "hero_ndvi.jpg", ring)
    write_json("tiles.json", {"_farmverse": {"fetched_at": now_iso(), "source": GIBS, "bbox": BBOX,
                                              "hero_truecolor_date": tc, "hero_ndvi_date": veg}, "cached": entries})


if __name__ == "__main__":
    main()

"""Save GIBS colormaps as compact JSON so the map can read a value at the clicked pixel.

Each entry maps an exact "r,g,b" colour to the [low, high] range of its class.
Source: https://gibs.earthdata.nasa.gov/colormaps/v1.3/ (NASA open data).
"""
import urllib.request
import xml.etree.ElementTree as ET

from common import UA, now_iso, write_json

MAPS = {
    "MODIS_Terra_L3_NDVI_16Day": ("MODIS_L3_NDVI", "NDVI", ""),
    "MODIS_Terra_L3_EVI_16Day": ("MODIS_L3_EVI", "EVI", ""),
    "SMAP_L4_Analyzed_Surface_Soil_Moisture": ("SMAP_Analyzed_Soil_Moisture", "Surface soil moisture", "m3/m3"),
    "IMERG_Precipitation_Rate": ("GPM_Precipitation_Rate", "Precipitation rate", "mm/hr"),
    "MODIS_Terra_L3_Land_Surface_Temp_8Day_Day": ("MODIS_Land_Surface_Temp", "Land surface temperature (day)", "K"),
}


def parse(name):
    req = urllib.request.Request(f"https://gibs.earthdata.nasa.gov/colormaps/v1.3/{name}.xml", headers={"User-Agent": UA})
    root = ET.fromstring(urllib.request.urlopen(req, timeout=60).read())
    out, units = {}, None
    for cm in root.iter("ColorMap"):
        if cm.get("units"):
            units = cm.get("units")
        for e in cm.iter("ColorMapEntry"):
            if e.get("transparent") == "true" or e.get("nodata") == "true":
                continue
            v = e.get("value").strip("[]()")
            parts = [p for p in v.split(",") if p]
            lo = float(parts[0]) if "INF" not in parts[0] else None
            hi = float(parts[1]) if len(parts) > 1 and "INF" not in parts[1] else lo
            out[e.get("rgb")] = [lo, hi]
    return out, units


def main():
    res = {"_farmverse": {"fetched_at": now_iso(), "source": "https://gibs.earthdata.nasa.gov/colormaps/v1.3/"}}
    for layer, (cm, label, unit) in MAPS.items():
        table, units = parse(cm)
        res[layer] = {"colormap": cm, "label": label, "unit": units or unit, "classes": table}
        print(layer, len(table), units)
    write_json("colormaps.json", res)


if __name__ == "__main__":
    main()

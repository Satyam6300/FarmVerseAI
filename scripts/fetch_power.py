"""Cache NASA POWER daily data for the pilot point (1 Jan 1991 to the latest available day).

Parameters (POWER Daily API, AG community, MERRA-2 based):
  PRECTOTCORR  precipitation, mm/day (bias corrected)
  T2M_MAX      maximum air temperature at 2 m, degrees C
  T2M_MIN      minimum air temperature at 2 m, degrees C
  GWETTOP      surface soil wetness, 0 to 1 (modelled, top layer)
  GWETROOT     root zone soil wetness, 0 to 1 (modelled)
The response is saved unchanged, plus a "_farmverse" provenance block.
"""
import datetime as dt
import json
import sys
import urllib.request

from common import POINT, UA, now_iso, write_json

PARAMS = "PRECTOTCORR,T2M_MAX,T2M_MIN,GWETTOP,GWETROOT"


def main() -> int:
    end = dt.date.today() - dt.timedelta(days=1)
    url = ("https://power.larc.nasa.gov/api/temporal/daily/point"
           f"?parameters={PARAMS}&community=AG&longitude={POINT['lon']:.4f}&latitude={POINT['lat']:.4f}"
           f"&start=19910101&end={end:%Y%m%d}&format=JSON&time-standard=LST")
    print("GET", url)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.load(r)
    p = data["properties"]["parameter"]
    fill = data["header"].get("fill_value", -999)
    last_valid = max(k for k, v in p["PRECTOTCORR"].items() if v != fill)
    for k in PARAMS.split(","):
        if not p.get(k):
            print("missing", k, file=sys.stderr)
            return 1
    data["_farmverse"] = {"request_url": url, "fetched_at": now_iso(), "last_valid_day": last_valid,
                          "licence": "NASA open data; acknowledge the NASA Langley Research Center POWER Project"}
    write_json("power_kalaburagi.json", data)
    print("days:", len(p["PRECTOTCORR"]), "last valid precipitation day:", last_valid)
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Extract the Gulbarga (Kalaburagi) district boundary from DataMeet's Census 2011 district GeoJSON.

Source: https://github.com/datameet/maps (CC BY 4.0, DataMeet India community).
Census 2011 boundaries; Yadgir district, carved out in 2009, is excluded.
"""
import json
import urllib.request

from common import DEMO_FIELD, UA, now_iso, write_json

SRC = "https://raw.githubusercontent.com/datameet/maps/master/website/docs/data/geojson/dists11.geojson"


def main() -> None:
    req = urllib.request.Request(SRC, headers={"User-Agent": UA})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    feats = [f for f in d["features"] if f["properties"].get("DISTRICT") == "Gulbarga" and f["properties"].get("ST_NM") == "Karnataka"]
    assert len(feats) == 1, f"expected one Gulbarga feature, got {len(feats)}"
    f = feats[0]
    f["properties"] = {"name": "Kalaburagi (Gulbarga)", "state": "Karnataka", "census_code": f["properties"].get("censuscode"),
                       "source": SRC, "licence": "CC BY 4.0, DataMeet India community", "boundary_vintage": "Census 2011"}
    demo = {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [DEMO_FIELD["polygon"]]},
            "properties": {"name": "Demonstration field", "status": "DEMO DATA",
                           "note": "Illustrative boundary drawn by the FARMVERSE AI team on farmland visible in satellite imagery. Not a surveyed land parcel."}}
    write_json("boundaries.json", {"type": "FeatureCollection", "features": [f, demo], "_farmverse": {"fetched_at": now_iso(), "source": SRC}})


if __name__ == "__main__":
    main()

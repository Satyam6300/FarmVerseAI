"""Shared settings for the FARMVERSE AI data pipeline.

Every script writes into src/static/data/ and records where each file came from,
when it was retrieved and under which licence, so the site can show provenance.
"""
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "static" / "data"
DATA.mkdir(parents=True, exist_ok=True)

# Pilot point used for NASA POWER (Kalaburagi city, approximate centre).
POINT = {"lat": 17.33, "lon": 76.83}

# Demonstration field. An ILLUSTRATIVE rectangle on farmland east of Kalaburagi city,
# drawn by the team from satellite imagery. It is not a surveyed land parcel.
DEMO_FIELD = {
    "center": {"lat": 17.3700, "lon": 76.9000},
    "polygon": [[76.89880, 17.36920], [76.90120, 17.36920], [76.90120, 17.37080], [76.89880, 17.37080], [76.89880, 17.36920]],
}

UA = "FARMVERSE-AI/2.0 (NASA Space Apps 2026 hackathon data pipeline)"


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def write_json(name: str, obj) -> Path:
    path = DATA / name
    path.write_text(json.dumps(obj, separators=(",", ":")))
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size/1024:.0f} KB)")
    return path

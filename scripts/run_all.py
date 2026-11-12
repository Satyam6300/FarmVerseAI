"""Refresh every cached dataset used by the FARMVERSE AI demo. Run before the event:
    python3 scripts/run_all.py
Needs internet access. Takes about 15 to 25 minutes, mostly for the GIBS time series.
"""
import subprocess
import sys

STEPS = ["fetch_power.py", "fetch_boundary.py", "fetch_colormaps.py", "fetch_gibs_tiles.py", "fetch_gibs_series.py", "build_crop_data.py"]
for s in STEPS:
    print("==>", s)
    r = subprocess.run([sys.executable, s], cwd=__file__.rsplit("/", 1)[0] or ".")
    if r.returncode:
        sys.exit(f"{s} failed; earlier cached files are unchanged where that step did not run")
print("All data refreshed. Rebuild the site with: python3 tools/build.py")

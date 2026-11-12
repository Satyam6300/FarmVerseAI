#!/usr/bin/env python3
"""Build the FARMVERSE AI static site.

Pages in src/pages/*.html start with a metadata comment:
    <!-- title: ... | desc: ... | page: key | layout: app|landing|plain | icon: lucide-name | scripts: a.js,b.js -->
The build wraps app pages in the shell (sidebar, top bar, footer), injects the head,
replaces <i data-icon="name"></i> with inline Lucide SVG (ISC licence), copies
src/static/ and writes everything to site/.

Usage:  python3 tools/build.py
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "site"
ICONS = ROOT / "tools" / "icons"

NAV = [
    ("g.farm", [("dashboard", "dashboard.html", "nav.command", "layout-dashboard"),
                ("farm", "farm.html", "nav.myfarm", "tractor"),
                ("map", "map.html", "nav.map", "map")]),
    ("g.intel", [("nasa", "nasa.html", "nav.nasa", "satellite"),
                 ("climate", "climate.html", "nav.climate", "cloud-sun"),
                 ("crops", "crops.html", "nav.crops", "wheat")]),
    ("g.decide", [("rotation", "rotation.html", "nav.rotation", "repeat"),
                  ("twin", "twin.html", "nav.twin", "box"),
                  ("advisor", "advisor.html", "nav.advisor", "bot")]),
    ("g.monitor", [("iot", "iot.html", "nav.iot", "radio")]),
    ("g.output", [("reports", "reports.html", "nav.reports", "file-bar-chart"),
                  ("data", "data-sources.html", "nav.data", "database"),
                  ("settings", "settings.html", "nav.settings", "settings")]),
]

COMMON_SCRIPTS = ["assets/js/i18n.js", "assets/js/core.js"]


def icon(name: str, cls: str = "ico") -> str:
    raw = (ICONS / f"{name}.svg").read_text()
    inner = re.sub(r"\s+", " ", re.search(r"<svg[^>]*>(.*)</svg>", raw, re.S).group(1)).strip()
    return (f'<svg class="{cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
            f"{inner}</svg>")


def sidebar(active: str) -> str:
    out = ['<aside class="sidebar" id="sidebar" aria-label="Main navigation">',
           '<a class="sb-brand" href="index.html"><img src="favicon.svg" alt="" width="30" height="30"><span>FARMVERSE<em>AI</em></span></a>',
           '<div class="sb-group"><ul><li><a href="index.html">' + icon("house") + '<span data-i18n="nav.overview">Overview</span></a></li></ul></div>']
    for gkey, items in NAV:
        out.append(f'<nav class="sb-group" aria-labelledby="{gkey}"><h2 id="{gkey}" data-i18n="{gkey}"></h2><ul>')
        for key, href, label, ic in items:
            cur = ' aria-current="page"' if key == active else ""
            out.append(f'<li><a href="{href}"{cur}>{icon(ic)}<span data-i18n="{label}"></span></a></li>')
        out.append("</ul></nav>")
    out.append('<div class="sb-foot">NASA Space Apps Challenge 2026<br>Field Shift: Adapting Farms with NASA Data<br>'
               '<a href="privacy.html">Privacy</a> &middot; <a href="terms.html">Terms</a> &middot; <a href="about.html">About</a></div>')
    out.append("</aside>")
    return "\n".join(out)


def topbar(title_key: str, ic: str) -> str:
    return f'''<header class="topbar">
  <button class="btn btn-ghost btn-sm menu-btn" type="button" aria-controls="sidebar" aria-expanded="false" data-i18n-aria="top.menu">{icon("menu")}</button>
  <div class="page-title">{icon(ic)}<span data-i18n="{title_key}"></span></div>
  <a class="farm-chip" href="farm.html">{icon("map-pin")}<span id="farm-chip-name"></span></a>
  <div class="seg" role="group" aria-label="View mode"><button type="button" data-mode="farmer" data-i18n="top.farmer"></button><button type="button" data-mode="expert" data-i18n="top.expert"></button></div>
  <label class="visually-hidden" for="lang-select" data-i18n="top.lang">Language</label>
  <select id="lang-select" class="lang-select"><option value="en">English</option><option value="kn">ಕನ್ನಡ</option><option value="hi">हिन्दी</option></select>
  <button class="btn btn-lime btn-sm" type="button" id="tour-btn">{icon("play")}<span data-i18n="top.demo"></span></button>
</header>'''


APP_FOOT = '''<footer class="app-foot">
  <span>Climate: NASA POWER (NASA Langley Research Center). Imagery: NASA GIBS (MODIS, SMAP, GPM IMERG). Crop statistics: DES and UPAG via India Data Portal. Agronomy: ICAR-CRIDA.</span>
  <span>NASA does not endorse this project.</span>
  <a href="data-sources.html" data-i18n="nav.data"></a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a>
</footer>'''


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC / "static", OUT)
    head_t = (SRC / "partials" / "head.html").read_text()
    for page in sorted((SRC / "pages").glob("*.html")):
        text = page.read_text()
        m = re.match(r"<!--(.*?)-->\s*", text, re.S)
        if not m:
            raise SystemExit(f"{page.name}: missing metadata comment")
        meta = dict((k.strip(), v.strip()) for k, v in (part.split(":", 1) for part in m.group(1).split("|")))
        body = text[m.end():]
        layout = meta.get("layout", "app")
        key = meta.get("page", "")
        scripts = COMMON_SCRIPTS + [s.strip() for s in meta.get("scripts", "").split(",") if s.strip()]
        script_tags = "\n".join(f'<script src="{s}"></script>' for s in scripts)
        head = head_t.replace("{{TITLE}}", meta["title"]).replace("{{DESC}}", meta["desc"])
        extra_css = "".join(f'<link rel="stylesheet" href="{c.strip()}">' for c in meta.get("css", "").split(",") if c.strip())
        head += extra_css
        if layout == "app":
            html = (f'<!doctype html>\n<html lang="en">\n<head>\n{head}\n</head>\n<body data-page="{key}" class="mode-farmer">\n'
                    f'<a class="skip-link" href="#main">Skip to content</a>\n<div class="shell">\n{sidebar(key)}\n<div class="main">\n'
                    f'{topbar("title." + key, meta.get("icon", "leaf"))}\n<main id="main" class="content">\n{body}\n</main>\n{APP_FOOT}\n</div>\n</div>\n'
                    f'{script_tags}\n</body>\n</html>\n')
        else:
            html = (f'<!doctype html>\n<html lang="en">\n<head>\n{head}\n</head>\n<body data-page="{key}" class="mode-farmer {layout}">\n'
                    f'<a class="skip-link" href="#main">Skip to content</a>\n{body}\n{script_tags}\n</body>\n</html>\n')
        html = re.sub(r'<i data-icon="([a-z0-9-]+)"></i>', lambda mm: icon(mm.group(1)), html)
        if "{{" in html:
            raise SystemExit(f"{page.name}: unreplaced template token")
        (OUT / page.name).write_text(html)
        print("built", page.name)


if __name__ == "__main__":
    main()

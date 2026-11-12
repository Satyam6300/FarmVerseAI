"""Render favicon.svg to PNG and ICO sizes with headless Chromium. Usage: python3 tools/make_icons.py"""
import asyncio, io
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "src" / "static"
SVG = (ROOT / "favicon.svg").read_text()

async def render(size, page):
    sized = SVG.replace("<svg ", '<svg width="%d" height="%d" ' % (size, size), 1)
    await page.set_viewport_size({"width": size, "height": size})
    await page.set_content('<html><body style="margin:0;background:transparent">' + sized + "</body></html>")
    return Image.open(io.BytesIO(await page.screenshot(omit_background=True))).convert("RGBA")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        page = await b.new_page()
        for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
            (await render(size, page)).save(ROOT / name)
        big = await render(256, page)
        big.save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
        await b.close()

asyncio.run(main())
print("icons written")

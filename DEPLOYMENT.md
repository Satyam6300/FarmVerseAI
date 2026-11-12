# Deployment: blocked until launch conditions are met

The site must not be published to any public URL, including a temporary hosting subdomain,
until **every** item below is checked. Local preview (`python3 -m http.server`) is fine.

## Launch checklist

- [ ] 1. Custom domain chosen and provided: `__________________`
- [ ] 2. DNS records created at the registrar for the chosen host
- [ ] 3. Domain connection verified by the host (domain shows as connected, not pending)
- [ ] 4. HTTPS certificate issued and HTTP redirects to HTTPS
- [ ] 5. Favicon checked in a browser tab on the live domain (favicon.ico, favicon.svg, apple-touch-icon.png)
- [ ] 6. Privacy Policy reachable at `/privacy.html` with contact email and hosting provider filled in
- [ ] 7. Terms and Conditions reachable at `/terms.html` with contact email filled in
- [ ] 8. Team names filled in on `/about.html`
- [ ] 9. No builder or platform badge (for example "Made with ..." or "Edit with ...") visible on the live site. The site code contains none; check the host's settings, since some hosts inject one
- [ ] 10. Security checks: response headers set (below), no secrets in the repository, `site/` contains only intended files
- [ ] 11. Cached data refreshed with `python3 scripts/run_all.py` and rebuilt; live NASA POWER and GIBS requests work on the domain
- [ ] 11a. If a sensor backend is used: its HTTPS address added to `connect-src` in `src/partials/head.html`, `FARMVERSE_INGEST_KEY` set, `FARMVERSE_ALLOWED_ORIGINS` set to the custom domain only
- [ ] 11b. Kannada and Hindi strings reviewed by native speakers
- [ ] 12. Pre-launch blocks removed (below)
- [ ] 13. Final approval from the team: `name, date`

## Remove pre-launch blocks only at step 12

1. In `src/partials/head.html`, delete the `<meta name="robots" content="noindex, nofollow">` line and its comment.
2. Replace `src/static/robots.txt` with:
   ```
   User-agent: *
   Allow: /
   ```
3. Rebuild: `python3 tools/build.py`

## Recommended response headers on the host

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

Remove `http://localhost:* http://127.0.0.1:*` from the page CSP meta tag for production unless the sensor backend runs locally.

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://gibs.earthdata.nasa.gov https://server.arcgisonline.com https://tile.openstreetmap.org; connect-src 'self' https://power.larc.nasa.gov https://gibs.earthdata.nasa.gov https://nominatim.openstreetmap.org; base-uri 'self'; form-action 'self'; object-src 'none'; frame-ancestors 'none'
```

The pages already carry the same Content-Security-Policy as a meta tag. `frame-ancestors` only works as a header.

## What to upload

The contents of `site/` after a build. It is plain static files: no server code, no environment variables, no API keys. The optional sensor backend in `backend/` is deployed separately.
Set the host's 404 page to `404.html` if it supports one.

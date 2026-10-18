# RepRival v1.4.7 — Illustration deployment fix

This release fixes missing workout images after deploying to GitHub / Netlify.

## What changed
- All 23 original Bryl Lim / Everkinetic-derived SVG exercise artworks are **embedded locally inside illustrations.js** as image data. No external fetches, nested illustrations folders or third-party CDN requests are required.
- Workout artwork uses the same exact existing exercise-ID mappings and tap-to-enlarge feature.
- Site cache updated to `reprival-v147`, with all required root files precached.
- No changes to the saved profile/workout data structure or localStorage key `reprival-athletes-v12`.

## Deploy
1. On the existing live site, **export a complete backup (JSON)** first.
2. Extract `RepRival_v1_4_7_GitHub_Update.zip`.
3. Upload **all files at the extracted folder's top level** to the ROOT of your GitHub repository (alongside the existing `index.html`). Commit replacements. There is **no illustrations folder to upload**.
4. Netlify should publish the new version. Open the live site and confirm `1.4.7` appears at the top.
5. If the old version persists, reload the existing tab once after Netlify deploys. **Do not clear site data or uninstall the PWA**, because workout records are local to the browser.

Files previously present in your repository under `illustrations/` can remain, but v1.4.7 no longer needs or requests them.

## Illustrations & licence
Illustrations by Bryl Lim / Workout Guide based on Everkinetic under CC BY-SA 4.0. Bundled image bytes are unmodified. The app applies its colour tint through CSS. See `ATTRIBUTION.md`, `LICENSES.md` and `LICENSE-ASSETS` for credit and asset licensing. Code and exercise data preserved.

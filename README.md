# RepRival v1.4.6 — Real exercise artwork

**Release replaces the v1.4.4/1.4.5 homemade illustrations** with original Workout Guide exercise SVGs from Bryl Lim's Everkinetic-derived collection. All 19 distinct built-in movement IDs are mapped to locally included assets. A couple of closely related poses are representative rather than the identical equipment variation, such as suitcase carry shown with farmer carry artwork.

## How to deploy

1. Export a complete backup of your existing live RepRival data. Keep it safe.
2. Extract the ZIP file. Its *root* contains the project's `index.html`, `app.js`, `program.js`, `plan-library.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `illustrations.js`, icons, and `illustrations/` folder.
3. Upload all of those files and the whole `illustrations/` directory to the **root of your GitHub repository** and commit. Do NOT upload the outer extracted folder itself.
4. Netlify will redeploy, and the new cache version will update after a reload.

No stored workout/profile data formats or localStorage keys were changed.

## Licences

The artwork in `illustrations/workout-guide/` is from Bryl Lim's Workout Guide, based on Everkinetic poses. Art under CC BY-SA 4.0, retained unmodified; its displayed color is adjusted by CSS. See `ATTRIBUTION.md`, `LICENSES.md` and `LICENSE-ASSETS` for upstream attribution and license. Program code remains independently licensed.

## Changes

- Exact built-in movement ID matching; no more generic bench or row pictures across unrelated exercises.
- Artwork bundled as local SVG files and prefetched by the service worker for offline use.
- Tap artwork to enlarge during workout (close to resume).
- New app and offline cache version 1.4.6.
- Home screen overview refinements and scheduled weigh-ins from previous releases preserved.

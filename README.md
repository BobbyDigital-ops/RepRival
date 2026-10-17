# RepRival v1.3 — preview / GitHub / Netlify

**IMPORTANT: Export a backup from your existing live RepRival before replacing any files.** Do not test new features on your production workout history until you are happy with the preview. All data is local to each browser and website origin; this is not an online account system.

## What's new

- Initial admin setup: choose your own username and 4-digit PIN; remember last-used profile; PIN required when switching profiles only.
- Fifth `Admin` tab, local athlete creation, PIN reset, switching and 10 simulated demo athletes (demo PIN is **1234**).
- Each profile has isolated local workouts, history, plan, measurements and chosen graphs.
- Home: all muscle groups, Athlete Rating calibration, weight-tracking chart, recent milestones, training consistency and training insight; Spotlight removed.
- Weigh-ins with optional waist and body fat; per-athlete display preference for kilograms, pounds, stone/lb, cm/ft/in.
- Progress: select multiple movement graphs; scorecard's actual first/latest effort integrated into graphs, plus percent change.
- Workouts: recommended weight/reps from last matching set and RIR; click Edit to override; RIR tap buttons; larger 'next' preview.
- Plan editor: set counts, rep ranges, exercise replacement and addition, moving and removing, workout renaming, rest periods and earlier plan version restore.
- Six built-in programmes: existing Pump Plan plus five variants using your home equipment.
- Performance uses best working set for each workout; total training volume tracked separately.

## What has NOT been built

- No cloud login/synchronisation, real online accounts, or enforced server-side admin permissions. Four-digit PINs are stored locally and provide **convenience only**, not serious security.
- No online competition, leaderboards, live rival matching, or automatic publishing to GitHub.
- Plan library programmes are starting templates, not a substitute for individual coaching; select appropriate loads and amend exercise choices for suitability.
- No actual Android device test; automated Chromium browser smoke tests were performed at 320, 390 and 768 pixels.

## How to preview before going live

1. Open the separately supplied **RepRival_v1_2_Standalone_Preview.html**. This has a separate local storage origin and normally won't show data saved at reprivalapp.netlify.app. On first launch, create the admin username and PIN you choose yourself.
2. Test the 10 simulated demo athletes from Admin (their PINs are **1234**).
3. Export a backup from your *current live* RepRival under My Plan **before** publishing to the real URL.
4. Once happy, extract this ZIP and upload the **contents** over files in the root of GitHub `main` (or preferably test on a separate beta branch/site first). Commit; Netlify builds automatically.
5. Reopen the real site and create your admin profile. The new app copies the existing V1 workout data into that admin profile. It writes to `reprival-athletes-v12` in localStorage and leaves old `repquest-prototype-v01` intact for rollback. Export a new **all-profiles** backup after checking the import.

### Your admin login

**There is no predefined admin PIN.** You choose both username and 4-digit PIN on the new app's first launch. The last-used profile opens automatically without a PIN; switching athletes asks for the target athlete's PIN.

### Backup formats

The v1.3 export includes all local athletes. You may import a v1.3 all-profiles backup (replaces the local roster) or an old V1 workout backup (replaces the current athlete's workout record after confirmation). Always export before replacing any backup.

### Deployment and cache

- No build command; publish directory `.` (repository root).
- Service worker cache renamed to `reprival-v12` for the upgrade. Chrome may need a normal refresh to update after deployment.
- Code runs entirely in the browser; PINs and workout data remain on the current device/site origin.
- Hosting the static site does **not** make local workout histories accessible to other site visitors, but the included `program.js` contains the original publicly served V5 example import data, as in v1.

## Files

`index.html`, `styles.css`, `app.js`, `program.js`, `plan-library.js`, `sw.js`, `manifest.webmanifest`, icons and this README.


## v1.3 additions
- Compact mobile workout with exercise posture cues, previous-set comparisons, single-touch RIR and editable recommendations.
- Dumbbell recommendations use 2.5 kg per single dumbbell / 5 kg per pair total, based on load type. Historical measured weights are not rewritten.
- Profile creation and editing: measurement units, DOB, sex, height, starting weight and optional goal / waist / body fat.
- Plan activation records the start date and intended weekly workout count; Home tracks anchored seven-day weeks.
- Training Workload explains kg lifted and allows like-for-like workout filtering; Athlete Rating now explains its personal baseline.
- Main Focus and Cardio preferences were nonfunctional in v1.2, so have been removed from the UI while leaving existing backup data intact.

### Important data protection
The `reprival-athletes-v12` localStorage key and serialized version **12** are intentionally unchanged to ensure existing saved workouts and demo accounts are recognised. The old `repquest-prototype-v01` key remains untouched. Export a complete JSON backup before deploying on your real Netlify address. The standalone preview runs under a different browser origin, so its demo data does not automatically appear on Netlify.

# RepRival — Muscle Intelligence v2 targeted corrections

## What changed

This is a targeted correction of the 23 October 2026 exported project, not a redesign. The original ZIP is unchanged; training histories, profiles, Firebase credentials/config and the application's storage formats are not migrated or rewritten.

### Core scientific-engine contract

* Removed the extra within-session `1/(1 + 0.10*(set index - 1))` penalty. Each valid working set contributes its muscle coefficient and RIR effort weight to the canonical 28-day recency-weighted dose. Diminishing returns occur **once** in the final logarithmic conversion.
* Canonical definitions, per muscle:
  * `C = (10/7) * (1 - exp(-28/10))`
  * `D = sum(muscleCoefficient * rirWeight * exp(-setAgeDays/10)) / C`
  * `stimulusScore = round(100 * min(1, log(1 + D/10) / log(1 + weeklyReference/10)))`
  * No bonus for a raw increase in kilograms. RIR 0–1=1.0, RIR 5=0.4, missing/blank RIR=0.75 with uncertainty.
* Group stimulus scores for Shoulders and Arms now derive from **sum of underlying full-precision weekly-equivalent doses and sum of the group's reference targets**, rather than averaging separately rounded individual percentage scores. Individual anatomical regions retain their own scores.
* The displayed `effectiveSets` now counts qualifying primary and secondary working sets (fractional for meaningful secondary muscles), without the unjustified session index discount. The UI's seven-day effective-set count remains distinct from the **28-day** recency-weighted Stimulus index.
* Invalid/skipped/warm-up records (zero/negative reps, negative load, impossible RIR, future sessions) cannot create training exposure or fatigue. An empty historical RIR is treated as missing, never as failure.
* Blue is now reserved for an explicit conservative `isDetraining` risk state requiring an established training baseline (at least three logged quality-set equivalents in two sessions), sustained inactivity (21+ days) and low current stimulus (<8%). One ancient workout or a low stimulus percentage alone cannot turn a region blue. **Blue is a heuristic risk flag, not measured atrophy.**

### Performance progression

* Comparative performance now incorporates repetitions, load and recorded RIR using an approximate repetitions-to-failure adjusted exercise-specific performance estimate (Epley-style). It refuses to compare different exercise IDs and reports lower confidence with missing/high RIR.
* The existing workout's double-progression mechanics and available dumbbell increments remain unchanged. When there are sufficient comparable, explicitly RIR-logged historical sessions, the current recommendation reason can show an **estimated performance trend**. This is advisory; it never directly boosts Stimulus.

### Anatomy

* The overlapping rear-shoulder SVG paths have been partitioned into separate approximate Side delts and Rear delts overlays. This avoids drawing two distinct muscle scores over the same region.
* Normal low-stimulus colouring is neutral grey/warm rather than bluish; the distinct blue detraining shades are only used when `isDetraining` is explicitly true.
* Exact anatomical modelling of separate **front delts** and **trapezius subdivisions** remains unsupported in the current 11-muscle data model. This update does not fabricate region geometry or precise physiological coefficients for them.

### What the tests show

* 5 primary back sets at 1 RIR, completed today, T=10, no preceding workouts: **46%** (previously 40%).
* 9 primary chest sets at 1 RIR, completed today, T=10, no preceding workouts: **74%** (previously 58%).
* The light 3x10 goblet squat at 5 RIR still earns modest Quad stimulus and smaller Glute credit; calf supporting involvement is tracked without invented calf hypertrophy sets.
* 460/460 `node scripts/run-regression-tests.cjs` assertions PASS (including 20 new contract assertions), zero failures.
* `node --check` passes for `public/muscle-intelligence.js`, `public/body-map.js`, `public/app.js`, and `scripts/run-regression-tests.cjs`.
* **Build and TypeScript lint NOT verified:** Vite and the Vite client types are not installed in the exported archive and were not available in the runtime. In an environment with dependencies installed, run `npm install`, then `npm run build`, `npm run lint` and `npm test`.

## Files edited

* `public/muscle-intelligence.js`
* `public/body-map.js`
* `public/app.js`
* `scripts/run-regression-tests.cjs`

## Remaining uncertainties and limits

All scores and acute recovery multipliers remain engineering estimates, not measurements of hypertrophy, muscle loss, or physiological recovery. Exercise-to-muscle contribution coefficients and the 21-day risk rule are heuristics. A full React browser run with Firebase authentication and the actual signed-in athlete data was not available in this offline archive. The 28-day Stimulus index may remain higher than the seven-day sets shown alongside it, because the metrics intentionally use different periods. This document does not claim to verify the source project's entire exercise mapping catalogue, nor to scientifically validate the recovery time constant.

## Applying changes

For a manual AI Studio code update, copy the four files listed above **using their paths**, retaining other project files and live data. The ZIP contains the complete exported project plus these notes. A separate four-file patch ZIP is also provided, so the unchanged project files need not be replaced. Save a Versions checkpoint before applying any update.

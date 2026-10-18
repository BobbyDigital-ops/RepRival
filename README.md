# RepRival v1.6.1 — Usability and Adaptive Training update

RepRival remains a local-first/offline-capable workout tracker. Existing profile and workout history format/key `reprival-athletes-v12` is preserved. This build does **not** sync users across devices.

## Changes
1. **Anatomical map:** manually redrawn muscle hot-zone paths against the image's native coordinates, soft-edge rendering and silhouette clipping; selectable front/back muscles, red for recent work and blue only for longer-term decline in stimulus when meaningful history exists. It is an approximate training map, not a precise physiological measurement.
2. **Progress:** removed Performance Journey graphs and mixed-workout workload charts; replaced with understandable 30-day stats, recent exercise comparisons and workout history. No claim to measured muscle growth.
3. **Adaptive workout generator:** duration-aware 4–9 exercise choices; 40-minute plans aim around 6 distinct exercises, 18 working sets and 3 complementary supersets. Different movement-pattern tracking prevents redundant carries and near-duplicate moves. It uses logged history, equipment and preferences.
4. **Guided setup:** three steps for focus/time, actual equipment plus available space/restrictions (small space by default — no travelling carries), and muscle priority/review. Supports running/sport load and hard days.
5. **Session alternatives:** Randomise next workout from the preparation screen while keeping focus groups. Active started sessions are never rewritten.
6. **Home:** Daily Check-in moved inside the Good Morning hero as a small button; the separate Check-in card has been removed.
7. **Plan management:** direct New Workout, Adjust Plan, Focus Review actions, with a clearer summary of planned session and setup. All data stays per-athlete.
8. **Buttons:** restrained chromatic/lacquer highlight over the same coral colour, no new colour scheme.

## Reality checks and limitations
- The map's hotspot alignment is visually improved but traced by hand, not a clinically segmented anatomical atlas. Muscle-zone colours are training-exposure estimates, not proof of growth, detraining or recovery.
- Workout time estimates are approximate; rest durations and repetitions vary. More restrictive equipment choices may reduce available movements. Confirm equipment and review every generated workout before starting.
- The readiness check-in and recovery timer are advisory and optional, not diagnostic.
- Competitive opponents remain fictional, simulated locally; cloud accounts/multiplayer are not implemented.

## Deployment and data protection
1. Open **live** RepRival on the original `reprivalapp.netlify.app` domain and **export complete JSON backup**. Keep it safely.
2. Extract the ZIP and upload its **files directly to the GitHub repository root**, not a nested version folder. Replace all existing files including `sw.js`, `adaptive.js`, `body-map.js`, `app.js` and `styles.css`.
3. Commit via GitHub and wait for Netlify to deploy. Verify the header says `1.6.1`.
4. Do not clear site storage or uninstall the PWA. The local standalone preview/demo uses a different storage origin and does not show the live site's saved data.

## Testing
Automated Node syntax checks, deterministic generation tests, and mobile Chromium interaction tests: profile/history loaded; guided setup three steps and activation; 6 exercises/18 sets for a 40-minute plan; randomised alternatives; readiness check-in; readable Progress and Movement Trends Modify; active workout opens. ZIP integrity checked. Live Netlify deployment was not tested.

Artwork credits: see `ATTRIBUTION.md` and `LICENSES.md`.

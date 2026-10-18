# RepRival v1.6.4 — Usability and Adaptive Training update

RepRival remains a local-first/offline-capable workout tracker. Existing profile and workout history format/key `reprival-athletes-v12` is preserved. This build does **not** sync users across devices.

## v1.6.4 changes — Clarity-first Progress
- **Overview** keeps the overall progress summary, adds historical body-weight line chart and current BMI (where height and weight are recorded), and removes redundant tab shortcut cards. Select weight chart period or log a weigh-in. No invented weight values.
- **Muscles** places group strength improvement **above** the anatomical heatmap. Bars use a constant 0–100% reference, so +43% fills 43% of a bar. The numerical value can exceed 100% if the measured change does.
- **Movement Trends** automatically shows mini charts for all recorded exercises performed during the last seven days, plus pinned/added exercises; adjustable 4W/12W/6M/All time determines chart history but **not** which exercises qualify as recent.
- Tap a mini chart for a large **Movement Spotlight** graph and first/latest/best values; Modify supports adding, hiding and pinning exercises.
- Profile storage key and completed workout log format are unchanged. No live data is altered by previews.

## v1.6.3 changes — Guided Progress tabs
- **Overview:** immediately understandable Athlete Rating, consistency, median estimated group strength change, short links to further detail and recent workout history.
- **Muscles:** separate *training stimulus* heatmap and *strength performance* bars; period filters (4 weeks, 12 weeks, 6 months, all time); tap a group to see comparable exercises.
- **Movements:** automatic recent/pinned exercise selection with a single focused historical chart, dropdown movement selector and Modify to add, hide, or pin.
- Percentages come from comparing the same exercise over multiple sessions, with no fabricated values when there are insufficient sessions; estimated strength is not measured muscle growth.
- Time-sensitive Home greeting (morning, afternoon, evening).
- Preserves storage key `reprival-athletes-v12`, active plans, existing logs, league score records, and background assets.

## v1.6.2 previous change — Movement Trends
- The Progress overview now shows just a compact **Movement Trends** shortcut card.
- Opening the card displays a dedicated, readable exercise progress page with individual charts: estimated strength for weighted exercises, reps for bodyweight; first/latest/best recorded sets, dates, and a recent-set history disclosure.
- Movements trained in the past seven days appear automatically, with all historical sessions available for each chart.
- **Modify** opens a searchable movement list to add/hide exercises; pinning keeps favourites visible even outside the recent seven-day window.
- Exercise selections are saved inside each athlete profile. No workout/session, score, plan, or league calculations have been modified.

## Existing v1.6.1 changes
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
3. Commit via GitHub and wait for Netlify to deploy. Verify the header says `1.6.4`.
4. Do not clear site storage or uninstall the PWA. The local standalone preview/demo uses a different storage origin and does not show the live site's saved data.

## Testing
Automated Node syntax checks, deterministic generation tests, and mobile Chromium interaction tests: profile/history loaded; guided setup three steps and activation; 6 exercises/18 sets for a 40-minute plan; randomised alternatives; readiness check-in; readable Progress and Movement Trends Modify; active workout opens. ZIP integrity checked. Live Netlify deployment was not tested.

Artwork credits: see `ATTRIBUTION.md` and `LICENSES.md`.

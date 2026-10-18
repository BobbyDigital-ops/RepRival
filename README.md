# RepRival 1.5.0 — Equipment-aware plans and movement explorer

This release extends v1.4.9. It keeps the existing profile format, local workout records, leagues, embedded original licensed workout illustrations, recovery settings, set logging, and all existing saved/customised plan rotations.

## What's new

- Personal **equipment checklist**, available in **My plan → Your equipment**. The original owner's `admin` profile is initially populated with dumbbells, an adjustable bench, a kettlebell, ab wheel, pull-up bar, dip bars, and a low inverted-row bar (the last item is inferred from the current Pump Plan, so please confirm it). Other athlete profiles start with empty equipment selections. Selections are saved *per athlete profile*.
- **146 curated movement types and variations**, including dumbbell and bench work, Bulgarian split squats (with and without dumbbells), inverted rows, unilateral squats/RDLs, kettlebell work, core work, bands, and gym equipment when selected. Equipment requirements are explicit and applied to the catalogue. This is a curated selection, not literally every biomechanically possible exercise.
- **17 genuine programme structures**: the original Pump Plan, strength, athletic, hypertrophy, endurance, balanced, 3-day PPL, 6-day PPL, 4-day upper/lower, 5-day bro split, 2- and 4-day full-body, upper-emphasis, kettlebell, calisthenics, barbell gym powerbuilding, and no-equipment travel.
- **Automatic equipment-matched choices** inside the templates: e.g., an inverted row may be used instead of a chin-up if that's the available suitable pattern. Plans requiring unowned kit are visibly marked and cannot be activated until that kit is selected. With the prefilled kit, 16 of the 17 programmes are available; the barbell-centred gym programme remains unavailable.
- **Exercise explorer** filters by muscle and selected equipment, offers text search, and can add a compatible movement to any workout in the active rotation. Changes affect *future sessions only*, and the plan editor retains its previous-version restoration feature.
- **Pre-workout overview**: selecting the Workout tab shows the upcoming session, estimated duration, exercise blocks, total sets, selectable rotation day, and a **Begin workout** button. The workout is not started until Begin. Active sessions show **Resume workout** instead.
- The **Movement leagues** promotional shortcut is removed from Home. The actual Leagues tab remains available.
- **Expanded original illustrations**: 122 movement IDs have selected matching Everkinetic-derived exercise illustrations, backed by 98 embedded SVG files (some movement variations share an illustration). Unsupported variations use explicitly representative art where possible.
- Glutes and calves added to muscle reporting, and seconds/steps shown in workout labels for movement types logged using duration or steps. Internally the value still uses the standard existing set repetition field, for backward compatibility.

## Equipment limitations

- Confirm the low inverted-row setup and adjustable bench options: they were inferred from movements in the established plan and are editable.
- Plan templates do not silently rewrite themselves when your equipment list changes. An already active or custom-edited rotation stays as you last saved it, even if you subsequently untick one of its required items.
- Programmes offer a *starting point*, not individual coaching. You may need to adjust sets and exercise choices to fit your experience, technique, recovery, and available weights. Full-body and six-day plans have different weekly demands.
- Some illustrations are only representative of a movement family, not precise visual technique instruction. Use good form and equipment safely, particularly when stepping onto a bench or loading split squats.
- The league simulator continues to use per-exercise IDs. New exercise variants start unranked and only obtain league ratings after you log completed qualifying sets.
- All data remains in browser-local storage on the deployed origin. This is not yet cloud-synchronised multiplayer.

## How to install through GitHub and Netlify

1. On your **existing deployed Netlify app**, use **Export complete backup (JSON)** and keep a copy. Do **not** delete or clear site data, remove the PWA, or change domains.
2. Extract the `RepRival_v1_5_0_GitHub_Update.zip` archive. Upload the **contents**, not the outer folder and not the ZIP itself, to the root of the GitHub repository `BobbyDigital-ops/RepRival` on `main`.
3. Replace existing `index.html`, `app.js`, `plan-library.js`, `program.js`, `styles.css`, `sw.js`, `illustrations.js`, etc., and **include the new `exercise-library.js`**. Commit the changes and allow Netlify to deploy.
4. Open the deployed site again. The header should show **LEAGUE SANDBOX · 1.5.0**. Check your old history, then open **My plan → Your equipment** and confirm the selected gear.
5. Try **Browse training plans** and **Explore 146 movements**, then open **Workout** to see the new pre-workout overview.

## Data preservation

The localStorage key remains **`reprival-athletes-v12`** and the manager schema remains **version 12**. Existing workout logs, active sets, history, muscle trends, personal measurements, league data, profiles, and customised plans are not deleted or rewritten by this release. The new `equipment` array is optional on older saved profiles; it is initialised only when missing. Save a manual backup before deploying any site update.

## Licence

Workout SVGs originally by Bryl Lim / Workout Guide, based on Everkinetic, under **Creative Commons Attribution-ShareAlike 4.0**. See `ATTRIBUTION.md`, `LICENSE-ASSETS`, and `LICENSES.md` for terms. The application code is distinct from licensed illustration assets.

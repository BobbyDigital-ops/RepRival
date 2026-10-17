# RepRival — Swiss Minimal (v1.0)

A local-first guided strength-training web application based on the user's real Pump Plan V5. Simple during workouts; rich personal performance analytics after training. Designed for Android-sized screens.

## Run it

- **Simplest:** double-click `RepRival_v1_Working_Prototype.html` from the release (standalone HTML).
- **Hosted / Android PWA:** deploy all the files from this folder to an HTTPS static host. Open in Android Chrome and choose **Install app** / **Add to Home screen**.
- **Local multi-file testing:** from this folder, run `python -m http.server 8080` and open `http://localhost:8080`.

## Workflow

- Preserves the original A/B/C plan. Current working sets: **A=18, B=19, C=21**.
- Supersets are logged **round by round**, with separate weight, reps, and RIR inputs on the same screen. Rest runs **after each round** rather than between the two movements. Solo sets work similarly.
- **Back** revisits and edits the previous round without duplicating records. **Save & exit** pauses the session, which can be resumed later. **Discard workout** explicitly warns about lost unsaved-session data.
- Home shows a personalised muscle-progress snapshot, meaningful Athlete Score, next workout, last sessions, and league calibration.
- Progress displays real sets and weights/reps, movement histories, muscle-level relative performance, detailed charts and full session history. No XP or character levels. Real online league opponents are not implemented.

## Athlete Score

Starts at **100** for the first baseline of each movement. It aggregates **relative changes in comparable completed workout performance** using a geometric mean across tracked movements. A value above or below 100 reflects improvements or declines versus the user's own baseline — it is **not** a comparison with other athletes, a medical fitness score, or a measure of muscle size. Comparisons are provisional when only one rotation is recorded.

## Import and protect workout data

`program.js` embeds the 17 October 2026 V5 Workout A record (**18 individual sets**) and historical references. Import it explicitly on the home screen (or My Plan) if not already in history. Do not manually double-enter it.

For backward compatibility, localStorage retains the key `repquest-prototype-v01`. This makes in-place updates at the same origin work with previous RepQuest data. Saved backup JSON files from earlier versions remain importable. To move between local HTML, PC and hosted Android versions use **My Plan → Export backup**, then **Import backup** at the destination. Browser storage is not synced or guaranteed.

**Privacy:** The V5 baseline and historical reference records are embedded in `program.js`. A public deployment makes those source data accessible to anyone with the website URL. Do not make that publicly accessible without accepting/removing that exposure. A private GitHub repository does not automatically make a Netlify deployment private.

## Development/deployment

1. Create a private GitHub repository called `reprival` and upload all files from this folder, including `.gitignore`.
2. Connect the repository to Netlify and publish the repository root (`.`), with no build command.
3. Deploy tested changes from `main` to the stable Live URL; use branch Deploy Previews for Beta. **The browser storage is separate between preview and live sites.**
4. Export and restore backups before significant updates. Keep the live URL stable to retain browser origin.
5. Change `sw.js` cache version when publishing new static assets to an existing PWA.

Files: `app.js` contains the application; `program.js` the A/B/C data; `styles.css` the Swiss Minimal design; `manifest.webmanifest` and `sw.js` provide installability/offline support.

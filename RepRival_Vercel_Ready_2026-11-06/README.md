# RepRival — Vercel migration baseline (6 November 2026)

This source is the current Google AI Studio export with a preserved functional RepRival `index.html` entry point. The obsolete React/GitHub-access placeholder was removed. `public/` assets are served at the root by Vite.

## Commands

- `npm install`
- `npm run dev`
- `npm test` (554 assertions passed on the exported code)
- `npm run build`
- `npm run lint`

## Vercel

1. Import GitHub repository **BobbyDigital-ops/RepRival** into Vercel after pushing these files to the `migration/aistudio-to-vercel-2026-11-06` branch.
2. Use Framework **Vite**, Build **npm run build**, Output **dist**.
3. Deploy to a preview URL before merging to main or changing a live domain.
4. Add the Vercel preview/production domains to **Firebase Authentication > Settings > Authorized domains**.
5. Keep the existing Firebase project ID and Firestore database ID in `firebase-applet-config.json`; never create a new database to test migration.
6. Sign into the same Google account on two devices and verify cloud workouts. Program preferences and equipment settings may still be local-only and require separate sync work.
7. Do not use real athlete accounts for destructive sync tests. Back up local athlete settings before any migration.

## Security / data

Firebase web API configuration is a public client identifier, not a service-account secret. Firestore rules must continue to enforce ownership, and the rules are **not** deployed automatically by Vercel. Never upload private `.env` files, OAuth client secrets, service-account JSON or athlete data exports to GitHub.

## Verification scope

Tests: 554/554 passed locally. Full Vite build and TypeScript verification require dependency installation. These could not be completed offline in the preparation environment; verify them in GitHub/Vercel before release.

The first deployment is a **preview**, not a replacement for the existing AI Studio live app.

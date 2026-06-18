# Cosmic Goblin Joke Grimoire Web App

Mobile-first static PWA for browsing, filtering, analyzing, and building setlists from the consolidated joke database.

## Changes in this build

- Conservative joke consolidation pass at about 70%+ confidence.
- Best-version joke cards now prioritize clean standalone versions.
- Other drafts remain available under the Variations section.
- Removed the eye/circle/question-mark card graphics.
- Added original SVG background/emblem assets.
- Added filter controls for maturity, length, style, subject, comedian-style match, search, sort, and sort direction.
- Vercel static deployment configured with `outputDirectory: "."`.

## Deploy

Push the contents of this folder to GitHub root and deploy on Vercel with:

- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `.`

# Battleship — Devin Edition

A polished, browser-based Battleship game built to showcase how a non-engineer can *direct* AI (e.g., Cognition's **Devin**) to deliver a high-quality, playable experience quickly.

<!-- Verification comment: This change demonstrates successful repo access and PR workflow -->

## Features
- Classic Battleship rules (10×10 grid, 5 ships per side)
- **AI opponent** with simple hunt/target logic (smarter than random)
- **Voice commands** (Web Speech API): _"Fire at B5"_
- **Lightweight animations** and clean, responsive UI
- **Local analytics**: games played, wins, average turns
- No external libraries; works offline

## How to Run
Just open `index.html` in a modern browser (Chrome, Edge). No build step.

## Deploy to GitHub Pages
1. Create a new GitHub repo and upload these files.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch` and **Branch** to `main / (root)`.
4. Save. Your game will be live at a `github.io` URL in about a minute.

## Notes
- Voice commands require a browser that supports the Web Speech API (e.g., Chrome). The game degrades gracefully if unavailable.
- Code is intentionally clean and commented for interview walkthroughs.
- Suggested talking points and a GTM case study are provided separately.

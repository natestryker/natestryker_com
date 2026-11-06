# Under the Rift 1.0

Complete editable browser game: HTML, CSS and JavaScript, with all player portraits, champion sprites, team logos and tests included.

## Open in VS Code

1. Extract this ZIP first (Windows: right-click > Extract All).
2. In VS Code choose File > Open Folder, then select the extracted Under-the-Rift folder.
3. Install the Live Server extension by Ritwick Dey if you do not already have it.
4. Open dist/index.html, right-click inside the editor and choose Open with Live Server.
5. Keep using the same localhost address and port so your local saves remain available.

Do not launch index.html by double-clicking it in File Explorer. The game uses JavaScript modules and needs a local web server.

Alternative if Python is installed: open a terminal in this folder, run `python -m http.server 5500 --directory dist`, then visit http://localhost:5500. Press Ctrl+C to stop the server.

## Edit the game

- dist/index.html — page entry point
- dist/style.css — styling and responsive layout
- dist/app.js — interface and interactions
- dist/engine.js — game simulation and seasons
- dist/data.js — teams, names, traits and compositions
- dist/market.js — contracts, trades and offseason
- dist/career-storage.js — saved careers
- dist/discoveries.js / achievements.js — secrets and achievement tracking
- dist/assets/ — every bundled image and logo, including source notes
- tests/ — automated regression tests
- docs/DEVELOPMENT-NOTES.md — development history and mechanics

There is no build step, API key, backend or npm installation required to play. Fonts are requested from Google Fonts when available; local fallback fonts are provided.

## Bring your current career over

Your live-site saves are stored in that browser/site, not in these project files.
On the live game, use Settings > Export save. Open your local game and use Import save to bring it over as a separate career. Repeat for other careers you want to move. Each export includes that career's achievement contributions; achievements from other careers are not included in that file. Imported careers contribute to the shared achievement collection on the local address.

Live game: https://nate-esports-front-office.natestryker.chatgpt.site

## Put it on your own website

Copy the CONTENTS of dist into your chosen game folder on your website, keeping all subfolders intact. For example, place dist/index.html at games/under-the-rift/index.html, with the JS, CSS and assets alongside it. All game file paths are relative, so it can run in a subfolder. The tests and package.json do not need to be uploaded.

Changing domains, ports or browsers creates a different save location. Export/import careers to move them.

## Optional tests

With Node.js 22 or newer installed, run `npm test` from this project folder. No npm install is needed. The final release passed 105 automated checks; browser visual verification was unavailable.

## Release

Version 1.0, exported from source commit 0e978af2e289ac897831adac08ce97d7c945aff8. Game source and assets match the published release. Team names and logos belong to their respective owners; this is an unofficial game featuring fictional players and custom competition rules.
